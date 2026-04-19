// 알림 기록 + 발송 통합 유틸
// design-schema.md §4-3, §5 / design-security.md §5

import { createServerClient } from '@/lib/supabase'
import { sendFCMToTokens } from '@/lib/push'

export type NotificationCategory =
  | 'event'
  | 'trade_result'
  | 'schedule'
  | 'system'
  | 'announcement'

export interface NotificationInput {
  userId: string
  category: NotificationCategory
  title: string
  body: string
  deepLink?: string
  metadata?: Record<string, unknown>
}

interface SettingsRow {
  master_enabled: boolean
  event_enabled: boolean
  trade_result_enabled: boolean
  schedule_enabled: boolean
  system_enabled: boolean
  announcement_enabled: boolean
}

const DEFAULT_SETTINGS: SettingsRow = {
  master_enabled: true,
  event_enabled: true,
  trade_result_enabled: true,
  schedule_enabled: true,
  system_enabled: true,
  announcement_enabled: false,
}

// 카테고리가 해당 사용자에게 활성화되어 있는지
export async function isNotificationEnabled(
  userId: string,
  category: NotificationCategory,
): Promise<boolean> {
  const db = createServerClient()
  const { data } = await db
    .from('notification_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  const settings = (data as SettingsRow | null) ?? DEFAULT_SETTINGS
  if (!settings.master_enabled) return false

  switch (category) {
    case 'event':
      return settings.event_enabled
    case 'trade_result':
      return settings.trade_result_enabled
    case 'schedule':
      return settings.schedule_enabled
    case 'system':
      return settings.system_enabled
    case 'announcement':
      return settings.announcement_enabled
  }
}

// notifications 테이블에 무조건 기록 (설정 무관)
// 반환: notification.id — FCM data payload에 포함 가능
export async function recordNotification(input: NotificationInput): Promise<string | null> {
  const db = createServerClient()
  const { data, error } = await db
    .from('notifications')
    .insert({
      user_id: input.userId,
      category: input.category,
      title: input.title,
      body: input.body,
      deep_link: input.deepLink ?? null,
      metadata: input.metadata ?? {},
    })
    .select('id')
    .single()

  if (error) {
    console.error('[notifications] insert error:', error)
    return null
  }
  return data.id
}

// 통합 발송 — DB 기록 + (설정 활성 시) FCM 발송
export async function sendNotification(input: NotificationInput): Promise<{ notificationId: string | null; pushSent: number; pushFailed: number }> {
  const notificationId = await recordNotification(input)
  if (!notificationId) return { notificationId: null, pushSent: 0, pushFailed: 0 }

  const enabled = await isNotificationEnabled(input.userId, input.category)
  if (!enabled) return { notificationId, pushSent: 0, pushFailed: 0 }

  // 푸시 구독 토큰 조회
  const db = createServerClient()
  const { data: subs } = await db
    .from('push_subscriptions')
    .select('id, endpoint')
    .eq('user_id', input.userId)

  const tokens = (subs ?? []).map((s) => s.endpoint as string)
  if (tokens.length === 0) return { notificationId, pushSent: 0, pushFailed: 0 }

  const result = await sendFCMToTokens(tokens, {
    title: input.title,
    body: input.body,
    deepLink: input.deepLink,
    category: input.category,
    data: {
      notificationId,
      ...Object.fromEntries(
        Object.entries(input.metadata ?? {}).map(([k, v]) => [k, String(v)]),
      ),
    },
  })

  // 만료 토큰 정리
  if (result.invalidTokens.length > 0) {
    await db
      .from('push_subscriptions')
      .delete()
      .eq('user_id', input.userId)
      .in('endpoint', result.invalidTokens)
  }

  return { notificationId, pushSent: result.sent, pushFailed: result.failed }
}
