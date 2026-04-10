import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { isAdmin } from '@/lib/admin'
import { createServerClient } from '@/lib/supabase'
import { sendTelegramMessage } from '@/lib/telegram'
import { escapeHtml } from '@/lib/html'

type Params = Promise<{ id: string }>

const CATEGORY_LABEL: Record<string, string> = {
  bug: '🐛 오류 신고',
  feature: '💡 기능 개선',
  general: '❓ 일반 문의',
}

// PATCH /api/admin/inquiries/[id] → 관리자 답변 등록/수정
export async function PATCH(req: NextRequest, { params }: { params: Params }) {
  const session = await getSession()
  if (!session || !isAdmin(session.loginId)) {
    return Response.json({ error: '관리자만 접근 가능합니다.' }, { status: 403 })
  }

  const { id } = await params
  const { adminReply } = await req.json()

  if (!adminReply?.trim()) {
    return Response.json({ error: '답변 내용을 입력해주세요.' }, { status: 400 })
  }
  if (adminReply.length > 2000) {
    return Response.json({ error: '답변은 2000자 이내로 입력해주세요.' }, { status: 400 })
  }

  const db = createServerClient()

  // 답변 저장
  const { data: updated, error } = await db
    .from('inquiries')
    .update({
      admin_reply: adminReply.trim(),
      status: 'answered',
      answered_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('id, user_id, category, title')
    .single()

  if (error || !updated) {
    console.error('[admin/inquiries] update error:', error)
    return Response.json({ error: '답변 저장에 실패했습니다.' }, { status: 500 })
  }

  // 회원 텔레그램 알림
  try {
    const { data: member } = await db
      .from('users')
      .select('telegram_chat_id')
      .eq('id', updated.user_id)
      .single()
    if (member?.telegram_chat_id) {
      const msg = [
        `💬 <b>문의에 답변이 등록되었습니다</b>`,
        ``,
        `카테고리: ${CATEGORY_LABEL[updated.category] ?? updated.category}`,
        `제목: ${escapeHtml(updated.title)}`,
        ``,
        `<b>답변</b>`,
        `${escapeHtml(adminReply.trim().slice(0, 500))}${adminReply.length > 500 ? '...' : ''}`,
        ``,
        `MyCoinBot에서 자세한 내용을 확인하세요.`,
      ].join('\n')
      await sendTelegramMessage(member.telegram_chat_id, msg)
    }
  } catch { /* 알림 실패 무시 */ }

  return Response.json({ ok: true })
}

// DELETE /api/admin/inquiries/[id] → 문의 삭제
export async function DELETE(_req: NextRequest, { params }: { params: Params }) {
  const session = await getSession()
  if (!session || !isAdmin(session.loginId)) {
    return Response.json({ error: '관리자만 접근 가능합니다.' }, { status: 403 })
  }

  const { id } = await params
  const db = createServerClient()
  const { error } = await db.from('inquiries').delete().eq('id', id)

  if (error) {
    console.error('[admin/inquiries] delete error:', error)
    return Response.json({ error: '삭제에 실패했습니다.' }, { status: 500 })
  }

  return Response.json({ ok: true })
}
