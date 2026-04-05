import { getSession } from '@/lib/session'

export async function GET() {
  const session = await getSession()
  if (!session) {
    return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }
  return Response.json({ userId: session.userId, loginId: session.loginId })
}
