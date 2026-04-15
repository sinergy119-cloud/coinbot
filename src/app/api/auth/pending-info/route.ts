import { NextRequest } from 'next/server'
import { getPendingSignup } from '@/lib/pendingSignup'

// GET /api/auth/pending-info → 임시 가입 정보 조회 (약관 동의 페이지용)
export async function GET(req: NextRequest) {
  console.log('[pending-info] 요청 시작')
  console.log('[pending-info] 쿠키 headers:', req.headers.get('cookie'))

  const pending = await getPendingSignup()
  console.log('[pending-info] pending 결과:', pending ? `{ provider: ${pending.provider}, name: ${pending.name}, email: ${pending.email} }` : 'null')

  if (!pending) {
    console.log('[pending-info] pending 없음 → 404 반환')
    return Response.json(
      { error: '가입 정보가 없거나 만료되었습니다. 다시 로그인해주세요.' },
      { status: 404 },
    )
  }
  // userId(내부 키)는 클라이언트에 노출하지 않음
  console.log('[pending-info] pending 있음 → 200 반환')
  return Response.json({
    provider: pending.provider,
    name: pending.name,
    email: pending.email,
  })
}
