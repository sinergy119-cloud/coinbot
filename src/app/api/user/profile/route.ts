import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase'
import { sendTelegramMessage } from '@/lib/telegram'

// GET /api/user/profile → 텔레그램 Chat ID 조회
export async function GET() {
  const session = await getSession()
  if (!session) return Response.json({ error: '로그인 필요' }, { status: 401 })

  const db = createServerClient()
  const { data } = await db
    .from('users')
    .select('telegram_chat_id, delegated')
    .eq('id', session.userId)
    .single()

  return Response.json({
    telegramChatId: data?.telegram_chat_id ?? '',
    delegated: data?.delegated ?? false,
  })
}

// PATCH /api/user/profile → 텔레그램 Chat ID 저장
export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session) return Response.json({ error: '로그인 필요' }, { status: 401 })

  const body = await req.json()

  const db = createServerClient()
  const updates: Record<string, unknown> = {}
  if ('delegated' in body) updates.delegated = !!body.delegated

  // 텔레그램 Chat ID 저장 시 테스트 메시지로 유효성 검증
  if ('telegramChatId' in body) {
    const chatId = body.telegramChatId?.trim() || null
    if (chatId) {
      try {
        await sendTelegramMessage(chatId, '🔔 <b>MyCoinBot 텔레그램 연결 테스트</b>\n\n연결이 정상적으로 완료되었습니다.')
      } catch {
        return Response.json({ error: '유효하지 않은 Chat ID입니다. 텔레그램에서 Chat ID를 다시 확인해주세요.' }, { status: 400 })
      }
    }
    updates.telegram_chat_id = chatId
  }

  const { error } = await db
    .from('users')
    .update(updates)
    .eq('id', session.userId)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ success: true })
}
