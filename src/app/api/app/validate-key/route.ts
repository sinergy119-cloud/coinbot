// POST /api/app/validate-key — 앱 API Key 등록 전 유효성 검증
// 키는 저장하지 않음 — 검증 후 메모리에서 즉시 폐기
// 웹의 /api/exchange-accounts 등록 라우트와 동일한 검증 로직 사용

import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { encrypt } from '@/lib/crypto'
import { getBalance } from '@/lib/exchange'
import { userRateLimit } from '@/lib/app/rate-limit'
import { ok, unauthorized, fail } from '@/lib/app/response'
import { isValidExchange } from '@/lib/validation'
import type { Exchange } from '@/types/database'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()

  // 분당 10회 제한 — 검증은 거래소 API 호출이라 비용 있음
  const rl = userRateLimit(session.userId, 'validate-key', 10)
  if (!rl.ok) return fail(`요청이 너무 많습니다. ${rl.resetInSec}초 후 다시 시도하세요.`, 429)

  let body: { exchange?: unknown; accessKey?: unknown; secretKey?: unknown }
  try {
    body = await req.json()
  } catch {
    return fail('잘못된 요청 형식입니다.')
  }

  // eslint-disable-next-line prefer-const
  let { exchange, accessKey, secretKey } = body
  if (!isValidExchange(exchange)) return fail('유효하지 않은 거래소입니다.')
  if (typeof accessKey !== 'string' || typeof secretKey !== 'string') {
    return fail('Access Key / Secret Key를 입력해주세요.')
  }
  const accessTrim = accessKey.trim()
  const secretTrim = secretKey.trim()
  if (accessTrim.length < 5 || secretTrim.length < 5) {
    return fail('유효한 API Key를 입력해주세요.')
  }

  // 암호화 → getBalance 호출 (저장은 안 함)
  const encAccess = encrypt(accessTrim)
  const encSecret = encrypt(secretTrim)
  // 평문 즉시 폐기
  accessKey = null
  secretKey = null

  try {
    const result = await getBalance(exchange as Exchange, encAccess, encSecret)
    return ok({ valid: true, balanceKrw: Math.floor(result.krw) })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'API 인증 실패'
    return Response.json(
      { ok: false, valid: false, error: `API 검증 실패: ${msg.slice(0, 100)}` },
      { status: 400 },
    )
  }
}
