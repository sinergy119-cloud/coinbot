// GET/PATCH /api/app/notification-settings — 알림 설정 조회/수정
// design-schema.md §4-4

import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase'
import { ok, unauthorized, fail } from '@/lib/app/response'

const DEFAULTS = {
  masterEnabled: true,
  eventEnabled: true,
  tradeResultEnabled: true,
  scheduleEnabled: true,
  systemEnabled: true,
  announcementEnabled: false,
}

type SettingsRow = {
  master_enabled: boolean
  event_enabled: boolean
  trade_result_enabled: boolean
  schedule_enabled: boolean
  system_enabled: boolean
  announcement_enabled: boolean
}

function toApi(row: SettingsRow | null) {
  if (!row) return DEFAULTS
  return {
    masterEnabled: row.master_enabled,
    eventEnabled: row.event_enabled,
    tradeResultEnabled: row.trade_result_enabled,
    scheduleEnabled: row.schedule_enabled,
    systemEnabled: row.system_enabled,
    announcementEnabled: row.announcement_enabled,
  }
}

export async function GET() {
  const session = await getSession()
  if (!session) return unauthorized()

  const db = createServerClient()
  const { data } = await db
    .from('notification_settings')
    .select('*')
    .eq('user_id', session.userId)
    .maybeSingle()

  return ok(toApi(data as SettingsRow | null))
}

export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return fail('잘못된 요청 형식입니다.')
  }

  // camelCase → snake_case 매핑 + boolean 검증
  const patch: Partial<SettingsRow> = {}
  const keyMap: Record<string, keyof SettingsRow> = {
    masterEnabled: 'master_enabled',
    eventEnabled: 'event_enabled',
    tradeResultEnabled: 'trade_result_enabled',
    scheduleEnabled: 'schedule_enabled',
    systemEnabled: 'system_enabled',
    announcementEnabled: 'announcement_enabled',
  }
  for (const [apiKey, dbKey] of Object.entries(keyMap)) {
    if (apiKey in body) {
      const v = body[apiKey]
      if (typeof v !== 'boolean') return fail(`${apiKey}는 boolean이어야 합니다.`)
      patch[dbKey] = v
    }
  }
  if (Object.keys(patch).length === 0) return fail('변경할 설정이 없습니다.')

  const db = createServerClient()
  // UPSERT: 기존 행 없으면 기본값 + patch, 있으면 patch만 반영
  const { data: existing } = await db
    .from('notification_settings')
    .select('*')
    .eq('user_id', session.userId)
    .maybeSingle()

  if (existing) {
    const { data: updated } = await db
      .from('notification_settings')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('user_id', session.userId)
      .select()
      .single()
    return ok(toApi(updated as SettingsRow))
  } else {
    const base: SettingsRow = {
      master_enabled: DEFAULTS.masterEnabled,
      event_enabled: DEFAULTS.eventEnabled,
      trade_result_enabled: DEFAULTS.tradeResultEnabled,
      schedule_enabled: DEFAULTS.scheduleEnabled,
      system_enabled: DEFAULTS.systemEnabled,
      announcement_enabled: DEFAULTS.announcementEnabled,
    }
    const { data: inserted } = await db
      .from('notification_settings')
      .insert({ user_id: session.userId, ...base, ...patch })
      .select()
      .single()
    return ok(toApi(inserted as SettingsRow))
  }
}
