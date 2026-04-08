import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase'

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
  // 업데이트 가능 필드: telegramChatId, delegated
  const updates: Record<string, unknown> = {}
  if ('telegramChatId' in body) updates.telegram_chat_id = body.telegramChatId || null
  if ('delegated' in body) updates.delegated = !!body.delegated

  const { error } = await db
    .from('users')
    .update(updates)
    .eq('id', session.userId)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ success: true })
}
