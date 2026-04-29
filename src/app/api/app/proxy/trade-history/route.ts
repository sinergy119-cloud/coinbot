// POST /api/app/proxy/trade-history — 거래소 체결 내역 조회 프록시
//
// 클라이언트가 IndexedDB에서 복호화한 키 N개를 본문으로 보내면,
// 서버는 각 거래소 API를 호출해 체결 완료된 거래 내역을 받아 정규화 형태로 반환.
//
// 주의: 서버는 받은 키를 메모리에서만 사용하고 저장하지 않음.
//      keys는 한 번 encrypt해서 getTradeHistory에 넘기고 (decrypt 후 사용 즉시 폐기)
//      응답에는 키 정보 절대 포함 안 함.

import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { encrypt } from '@/lib/crypto'
import { getTradeHistory } from '@/lib/exchange'
import { userRateLimit } from '@/lib/app/rate-limit'
import { ok, unauthorized, fail } from '@/lib/app/response'
import { isValidExchange } from '@/lib/validation'
import type { Exchange } from '@/types/database'

interface AccountInput {
  exchange: unknown
  accessKey: unknown
  secretKey: unknown
  label?: unknown
}

interface UnifiedHistoryItem {
  /** 'order_filled' | 'order_open' | 'deposit' | 'withdrawal' (Phase 1: order_filled만) */
  type: 'order_filled'
  exchange: Exchange
  accountLabel: string | null
  /** 거래소 주문 ID */
  id: string
  /** ISO 8601 datetime */
  datetime: string
  coin: string
  side: 'buy' | 'sell'
  /** 체결 수량 (코인 단위) */
  quantity: number
  /** 체결 금액 (KRW) */
  total: number
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()

  const rl = userRateLimit(session.userId, 'proxy:trade-history', 60)
  if (!rl.ok) return fail(`요청이 너무 많습니다. ${rl.resetInSec}초 후 다시 시도하세요.`, 429)

  let body: { accounts?: AccountInput[]; limit?: number }
  try {
    body = await req.json()
  } catch {
    return fail('잘못된 요청 형식입니다.')
  }

  const accounts = Array.isArray(body.accounts) ? body.accounts : []
  if (accounts.length === 0 || accounts.length > 10) {
    return fail('accounts는 1~10개여야 합니다.')
  }
  const limit = Math.min(Math.max(Number(body.limit) || 50, 1), 200)

  const results = await Promise.all(
    accounts.map(async (a) => {
      if (!isValidExchange(a.exchange) || typeof a.accessKey !== 'string' || typeof a.secretKey !== 'string') {
        return { ok: false, label: typeof a.label === 'string' ? a.label : null, error: '입력값 오류' as const, items: [] as UnifiedHistoryItem[] }
      }
      const encAccess = encrypt(a.accessKey)
      const encSecret = encrypt(a.secretKey)
      const accountLabel = typeof a.label === 'string' ? a.label : null
      try {
        const history = await getTradeHistory(a.exchange as Exchange, encAccess, encSecret, limit)
        const items: UnifiedHistoryItem[] = history.map((h) => ({
          type: 'order_filled',
          exchange: a.exchange as Exchange,
          accountLabel,
          id: h.id,
          datetime: h.datetime,
          coin: h.coin,
          side: h.side,
          quantity: h.quantity,
          total: h.total,
        }))
        return { ok: true, label: accountLabel, exchange: a.exchange, items }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        return { ok: false, label: accountLabel, exchange: a.exchange, error: msg.slice(0, 200), items: [] as UnifiedHistoryItem[] }
      }
    }),
  )

  // 모든 계정의 거래내역을 합쳐 datetime 내림차순 정렬
  const allItems: UnifiedHistoryItem[] = []
  for (const r of results) {
    if (r.ok) allItems.push(...(r.items as UnifiedHistoryItem[]))
  }
  allItems.sort((a, b) => (a.datetime < b.datetime ? 1 : -1))

  return ok({
    items: allItems,
    perAccount: results.map((r) => ({
      label: r.label,
      exchange: r.exchange ?? null,
      ok: r.ok,
      count: r.ok ? (r.items as UnifiedHistoryItem[]).length : 0,
      error: r.ok ? null : (r as { error: string }).error,
    })),
  })
}
