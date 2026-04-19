// POST /api/app/proxy/balance — 거래소별 잔고 조회 프록시
// design-schema.md §4-9

import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { encrypt } from '@/lib/crypto'
import { getFullBalance, getCurrentPrice } from '@/lib/exchange'
import { userRateLimit } from '@/lib/app/rate-limit'
import { ok, unauthorized, fail } from '@/lib/app/response'
import { isValidExchange } from '@/lib/validation'
import type { Exchange } from '@/types/database'

// 가격 캐시 (5분)
const PRICE_CACHE_TTL_MS = 5 * 60 * 1000
const priceCache = new Map<string, { price: number; expiresAt: number }>()

async function getCachedPrice(exchange: Exchange, coin: string): Promise<number> {
  const key = `${exchange}:${coin}`
  const cached = priceCache.get(key)
  const now = Date.now()
  if (cached && cached.expiresAt > now) return cached.price
  try {
    const price = await getCurrentPrice(exchange, coin)
    priceCache.set(key, { price, expiresAt: now + PRICE_CACHE_TTL_MS })
    return price
  } catch {
    return 0
  }
}

interface AccountInput {
  exchange: unknown
  accessKey: unknown
  secretKey: unknown
  label?: unknown
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()

  const rl = userRateLimit(session.userId, 'proxy:balance', 60)
  if (!rl.ok) return fail(`요청이 너무 많습니다. ${rl.resetInSec}초 후 다시 시도하세요.`, 429)

  let body: { accounts?: AccountInput[] }
  try {
    body = await req.json()
  } catch {
    return fail('잘못된 요청 형식입니다.')
  }

  const accounts = Array.isArray(body.accounts) ? body.accounts : []
  if (accounts.length === 0 || accounts.length > 10) {
    return fail('accounts는 1~10개여야 합니다.')
  }

  const results = await Promise.all(
    accounts.map(async (a) => {
      if (!isValidExchange(a.exchange) || typeof a.accessKey !== 'string' || typeof a.secretKey !== 'string') {
        return { ok: false, label: typeof a.label === 'string' ? a.label : null, error: '입력값 오류' }
      }
      const encAccess = encrypt(a.accessKey)
      const encSecret = encrypt(a.secretKey)
      try {
        const bal = await getFullBalance(a.exchange as Exchange, encAccess, encSecret)
        // 코인 평가액 병렬 조회 (5분 캐시)
        const coinEntries = Object.entries(bal.coins)
        const coins = await Promise.all(
          coinEntries.map(async ([coin, amount]) => {
            const amt = Number(amount)
            if (amt <= 0) return { coin, amount: amt, valueKrw: 0 }
            const price = await getCachedPrice(a.exchange as Exchange, coin)
            return { coin, amount: amt, valueKrw: Math.floor(amt * price) }
          }),
        )
        const coinsTotal = coins.reduce((s, c) => s + c.valueKrw, 0)
        const totalKrw = bal.krw + coinsTotal
        return {
          ok: true,
          label: typeof a.label === 'string' ? a.label : null,
          exchange: a.exchange,
          krw: bal.krw,
          coins,
          totalKrw,
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        return { ok: false, label: typeof a.label === 'string' ? a.label : null, exchange: a.exchange, error: msg.slice(0, 100) }
      }
    }),
  )

  const grandTotalKrw = results.reduce((sum, r) => sum + ((r as { totalKrw?: number }).totalKrw ?? 0), 0)
  return ok({ balances: results, grandTotalKrw })
}
