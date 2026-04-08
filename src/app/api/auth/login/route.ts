import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { createServerClient } from '@/lib/supabase'
import { createSession } from '@/lib/session'

// 브루트포스 방어: IP 기반 실패 횟수 추적 (10분 / 10회 제한)
const loginAttempts = new Map<string, { count: number; resetAt: number }>()
const MAX_ATTEMPTS = 10
const WINDOW_MS = 10 * 60 * 1000

function getClientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const now = Date.now()
  const entry = loginAttempts.get(ip)

  if (entry && now < entry.resetAt) {
    if (entry.count >= MAX_ATTEMPTS) {
      const remaining = Math.ceil((entry.resetAt - now) / 60000)
      return Response.json({ error: `로그인 시도 횟수 초과. ${remaining}분 후 다시 시도해주세요.` }, { status: 429 })
    }
  } else {
    loginAttempts.set(ip, { count: 0, resetAt: now + WINDOW_MS })
  }

  const { userId, password } = await req.json()

  if (!userId || !password) {
    return Response.json({ error: '사용자 ID와 비밀번호를 입력해주세요.' }, { status: 400 })
  }

  const db = createServerClient()
  const { data: user } = await db
    .from('users')
    .select('id, user_id, password_hash')
    .eq('user_id', userId)
    .single()

  // 보안: 사용자 존재 여부와 비밀번호 오류를 동일한 메시지로 처리 (user enumeration 방지)
  const valid = user ? await bcrypt.compare(password, user.password_hash) : false
  if (!user || !valid) {
    const cur = loginAttempts.get(ip)
    if (cur) cur.count += 1
    return Response.json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' }, { status: 401 })
  }

  // 로그인 성공 시 실패 카운트 초기화 + 마지막 로그인 시간 갱신
  loginAttempts.delete(ip)
  await db.from('users').update({ last_login_at: new Date().toISOString() }).eq('id', user.id)
  await createSession(user.id, user.user_id)
  return Response.json({ ok: true, loginId: user.user_id })
}
