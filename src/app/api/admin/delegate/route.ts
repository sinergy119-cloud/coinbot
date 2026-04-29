/**
 * /api/admin/delegate — 관리자 위임 승인/거절 (관리자 전용)
 *
 * PATCH { action: 'approve' | 'reject', userId: string }
 *   approve → delegated=true,  delegate_pending=false
 *   reject  → delegated=false, delegate_pending=false
 */

import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/session'
import { logAdminAudit, adminRateLimit } from '@/lib/admin-audit'
import { createServerClient } from '@/lib/supabase'
import { sendNotification } from '@/lib/app/notifications'
import { sendTelegramMessage } from '@/lib/telegram'

export async function PATCH(req: NextRequest) {
  const session = await requireAdmin()
  if (!session) {
    return Response.json({ error: '관리자만 접근 가능합니다.' }, { status: 403 })
  }
  const rl = adminRateLimit(session.userId, 'delegate:patch')
  if (!rl.ok) return Response.json({ error: `요청이 너무 많습니다. ${rl.resetInSec}초 후 다시 시도하세요.` }, { status: 429 })

  const body = await req.json()
  const { action, userId } = body

  if (!userId || !action) {
    return Response.json({ error: 'userId와 action은 필수입니다.' }, { status: 400 })
  }
  if (action !== 'approve' && action !== 'reject') {
    return Response.json({ error: "action은 'approve' 또는 'reject'만 허용됩니다." }, { status: 400 })
  }

  const db = createServerClient()
  const updates =
    action === 'approve'
      ? { delegated: true, delegate_pending: false }
      : { delegated: false, delegate_pending: false }

  const { error } = await db.from('users').update(updates).eq('id', userId)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  await logAdminAudit(db, {
    adminId: session.userId,
    action: action === 'approve' ? 'delegate.approve' : 'delegate.reject',
    targetUserId: userId,
  })

  // 키 소유자에게 알림 발송 (푸시 system + 텔레그램)
  // 발송 실패해도 처리 자체는 성공
  ;(async () => {
    try {
      const { data: targetUser } = await db
        .from('users')
        .select('telegram_chat_id, name, user_id')
        .eq('id', userId)
        .single()
      if (!targetUser) return

      const title = action === 'approve'
        ? '✅ 관리자 위임이 승인되었습니다'
        : '🔓 관리자 위임이 해제되었습니다'
      const body = action === 'approve'
        ? '이제 관리자가 회원님 계정으로 자동 매수를 대행할 수 있습니다. 회원님의 API Key는 그대로 보존됩니다.'
        : '관리자가 더 이상 회원님 계정으로 거래하지 않습니다. 회원님의 API Key는 그대로 보존됩니다.'

      // 푸시
      await sendNotification({
        userId,
        category: 'system',
        title,
        body,
        deepLink: '/app/profile',
      })

      // 텔레그램
      if (targetUser.telegram_chat_id) {
        const tgMsg = [
          `<b>${title}</b>`,
          ``,
          body,
        ].join('\n')
        await sendTelegramMessage(targetUser.telegram_chat_id, tgMsg)
      }
    } catch (err) {
      console.error('[admin/delegate] notify error:', err)
    }
  })()

  return Response.json({ ok: true })
}
