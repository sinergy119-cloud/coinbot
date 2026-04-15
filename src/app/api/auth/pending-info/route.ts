import { getPendingSignup } from '@/lib/pendingSignup'

// GET /api/auth/pending-info → 임시 가입 정보 조회 (약관 동의 페이지용)
export async function GET() {
  const pending = await getPendingSignup()
  if (!pending) {
    return Response.json(
      { error: '가입 정보가 없거나 만료되었습니다. 다시 로그인해주세요.' },
      { status: 404 },
    )
  }
  // userId(내부 키)는 클라이언트에 노출하지 않음
  return Response.json({
    provider: pending.provider,
    name: pending.name,
    email: pending.email,
  })
}
