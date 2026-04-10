import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase'
import { sendTelegramMessage } from '@/lib/telegram'
import { escapeHtml } from '@/lib/html'

const VALID_CATEGORIES = ['bug', 'feature', 'general'] as const
const CATEGORY_LABEL: Record<string, string> = {
  bug: '🐛 오류 신고',
  feature: '💡 기능 개선',
  general: '❓ 일반 문의',
}

// GET /api/inquiries → 본인 문의 목록
export async function GET() {
  const session = await getSession()
  if (!session) return Response.json({ error: '로그인 필요' }, { status: 401 })

  const db = createServerClient()
  const { data } = await db
    .from('inquiries')
    .select('id, category, title, content, status, admin_reply, created_at, answered_at')
    .eq('user_id', session.userId)
    .order('created_at', { ascending: false })

  return Response.json(data ?? [])
}

// POST /api/inquiries → 문의 등록
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return Response.json({ error: '로그인 필요' }, { status: 401 })

  const { category, title, content } = await req.json()

  if (!category || !VALID_CATEGORIES.includes(category)) {
    return Response.json({ error: '유효하지 않은 카테고리입니다.' }, { status: 400 })
  }
  if (!title?.trim() || !content?.trim()) {
    return Response.json({ error: '제목과 내용을 입력해주세요.' }, { status: 400 })
  }
  if (title.length > 100) {
    return Response.json({ error: '제목은 100자 이내로 입력해주세요.' }, { status: 400 })
  }
  if (content.length > 2000) {
    return Response.json({ error: '내용은 2000자 이내로 입력해주세요.' }, { status: 400 })
  }

  const db = createServerClient()

  // 회원 정보
  const { data: user } = await db
    .from('users')
    .select('id, user_id, name')
    .eq('id', session.userId)
    .single()
  if (!user) return Response.json({ error: '사용자 없음' }, { status: 404 })

  const { data, error } = await db
    .from('inquiries')
    .insert({
      user_id: session.userId,
      category,
      title: title.trim(),
      content: content.trim(),
    })
    .select()
    .single()

  if (error) {
    console.error('[inquiries] insert error:', error)
    return Response.json({ error: '문의 등록에 실패했습니다.' }, { status: 500 })
  }

  // 관리자 텔레그램 알림
  try {
    const adminId = process.env.ADMIN_USER_ID
    if (adminId) {
      const { data: admin } = await db
        .from('users')
        .select('telegram_chat_id')
        .eq('user_id', adminId)
        .single()
      if (admin?.telegram_chat_id) {
        const msg = [
          `📬 <b>신규 문의</b>`,
          ``,
          `카테고리: ${CATEGORY_LABEL[category] ?? category}`,
          `회원: ${escapeHtml(user.name ?? user.user_id)} (${escapeHtml(user.user_id)})`,
          `제목: ${escapeHtml(title.trim())}`,
          ``,
          `${escapeHtml(content.trim().slice(0, 300))}${content.length > 300 ? '...' : ''}`,
        ].join('\n')
        await sendTelegramMessage(admin.telegram_chat_id, msg)
      }
    }
  } catch { /* 알림 실패 무시 */ }

  return Response.json(data, { status: 201 })
}
