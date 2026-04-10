import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

// IP 기반 브루트포스 방어 (10분 내 10회 실패 시 차단)
const MAX_ATTEMPTS = 10
const WINDOW_MS = 10 * 60 * 1000
const attempts = new Map<string, { count: number; firstAt: number }>()

function checkRate(ip: string): boolean {
  const now = Date.now()
  const rec = attempts.get(ip)
  if (!rec || now - rec.firstAt > WINDOW_MS) {
    attempts.set(ip, { count: 1, firstAt: now })
    return true
  }
  rec.count += 1
  return rec.count <= MAX_ATTEMPTS
}

// POST /api/auth/find-id → 이름 + 이메일로 아이디 조회
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
  if (!checkRate(ip)) {
    return Response.json({ error: '너무 많은 시도입니다. 10분 후 다시 시도해주세요.' }, { status: 429 })
  }

  const { name, email } = await req.json()

  if (!name?.trim() || !email?.trim()) {
    return Response.json({ error: '이름과 이메일을 입력해주세요.' }, { status: 400 })
  }

  const db = createServerClient()
  const { data: user } = await db
    .from('users')
    .select('user_id')
    .eq('name', name.trim())
    .eq('email', email.trim().toLowerCase())
    .single()

  if (!user) {
    return Response.json({ error: '일치하는 회원 정보가 없습니다.' }, { status: 404 })
  }

  // 아이디 일부 마스킹 (예: sinergy1 → sin***y1)
  const id = user.user_id
  const masked = id.length <= 3
    ? id[0] + '**'
    : id.slice(0, 3) + '*'.repeat(Math.max(id.length - 5, 1)) + id.slice(-2)

  return Response.json({ userId: masked })
}
