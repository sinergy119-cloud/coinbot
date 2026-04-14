/**
 * 텔레그램 발송 테스트 API
 * POST /api/admin/test-telegram
 *
 * 관리자 전용. 텔레그램 봇 설정이 올바른지 확인용 메시지를 발송합니다.
 */

import { getSession } from '@/lib/session'
import { isAdmin } from '@/lib/admin'
import { sendTelegramMessage } from '@/lib/telegram'

export async function POST() {
  // 관리자 세션 확인
  const session = await getSession()
  if (!session || !isAdmin(session.loginId)) {
    return Response.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  const chatId = process.env.TELEGRAM_CHAT_ID?.trim()
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim()

  if (!botToken) {
    return Response.json(
      { ok: false, reason: 'TELEGRAM_BOT_TOKEN 환경변수가 설정되지 않았습니다.' },
    )
  }
  if (!chatId) {
    return Response.json(
      { ok: false, reason: 'TELEGRAM_CHAT_ID 환경변수가 설정되지 않았습니다.' },
    )
  }

  const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })

  try {
    await sendTelegramMessage(
      chatId,
      `✅ <b>MyCoinBot 텔레그램 연동 테스트</b>\n\n` +
        `발송 시각: ${now}\n` +
        `Chat ID: <code>${chatId}</code>\n\n` +
        `텔레그램 알림이 정상 작동 중입니다.`,
    )
    return Response.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ ok: false, reason: message })
  }
}
