import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase'
import { isAdmin } from '@/lib/admin'
import { validateMarket, getBalance, getCoinBalance, getCurrentPrice } from '@/lib/exchange'
import type { Exchange } from '@/types/database'

export interface ValidationItem {
  accountId: string
  exchange: string
  accountName: string
  orderSummary: string
  balance: number       // KRW 잔고 (BUY/CYCLE), SELL일 때는 0
  coinQty?: number      // SELL: 보유 코인 수량
  coin?: string         // SELL: 코인 심볼
  feasible: boolean
  reason: string
}

// POST /api/validate → 실행 전 검증
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return Response.json({ error: '로그인 필요' }, { status: 401 })

  const { exchange, coin, tradeType, amountKrw, accountIds } = await req.json()

  if (!exchange || !coin || !tradeType || !accountIds?.length) {
    return Response.json({ error: '필수 항목이 누락되었습니다.' }, { status: 400 })
  }

  // 1) 코인 유효성 검증
  const { valid, symbol } = await validateMarket(exchange as Exchange, coin)
  if (!valid) {
    return Response.json({ error: `${coin}은(는) ${exchange}에서 지원하지 않는 코인입니다.` }, { status: 400 })
  }

  // 2) 선택된 계정 목록 조회 (본인 + 관리자일 때 위임 계정)
  const db = createServerClient()
  const { data: myAccounts } = await db
    .from('exchange_accounts')
    .select('*')
    .in('id', accountIds)
    .eq('user_id', session.userId)

  let delegatedAccounts: typeof myAccounts = []
  if (isAdmin(session.loginId)) {
    const { data: delegators } = await db
      .from('users')
      .select('id')
      .eq('delegated', true)
    const delegatorIds = (delegators ?? []).map((u) => u.id)
    if (delegatorIds.length > 0) {
      const { data } = await db
        .from('exchange_accounts')
        .select('*')
        .in('id', accountIds)
        .in('user_id', delegatorIds)
      delegatedAccounts = data ?? []
    }
  }

  const accounts = [...(myAccounts ?? []), ...(delegatedAccounts ?? [])]
  if (accounts.length === 0) {
    return Response.json({ error: '계정을 찾을 수 없습니다.' }, { status: 404 })
  }

  const isSell = tradeType === 'SELL'
  const isCycle = tradeType === 'CYCLE'
  const upperCoin = coin.toUpperCase()

  // 주문 요약
  const orderSummary = isCycle
    ? `${symbol} 매수(시장가) & 매도(시장가, 전체 수량) ${Number(amountKrw).toLocaleString()}원`
    : isSell
    ? `${symbol} 전량 매도(시장가)`
    : `${symbol} 매수(시장가) ${Number(amountKrw).toLocaleString()}원`

  // 매도/사이클: 현재가 미리 조회
  let currentPrice = 0
  if (isSell || isCycle) {
    try {
      currentPrice = await getCurrentPrice(exchange as Exchange, coin)
    } catch { /* 현재가 조회 실패 시 0으로 진행 */ }
  }

  const results: ValidationItem[] = await Promise.all(
    accounts.map(async (acc) => {
      try {
        // CYCLE: KRW 잔고 검증
        if (isCycle) {
          const { krw } = await getBalance(exchange as Exchange, acc.access_key, acc.secret_key)
          const feasible = krw >= amountKrw
          return {
            accountId: acc.id,
            exchange: acc.exchange,
            accountName: acc.account_name,
            orderSummary,
            balance: krw,
            feasible,
            reason: feasible ? '가능 (매수 후 전량 매도)' : '잔고 부족',
          }
        }

        // SELL: 코인 잔고 검증 (보유량 × 현재가 >= 5,000원)
        if (isSell) {
          const coinBalance = await getCoinBalance(exchange as Exchange, acc.access_key, acc.secret_key, coin)
          const valueKrw = currentPrice > 0 ? coinBalance * currentPrice : 0
          const coinDisplay = coinBalance.toFixed(8).replace(/\.?0+$/, '') || '0'
          const feasible = coinBalance > 0 && (currentPrice <= 0 || valueKrw >= 5000)
          const reason = !feasible
            ? coinBalance <= 0
              ? `매도 불가 — 보유 ${upperCoin} 없음`
              : `매도 불가 — 보유 ${upperCoin}의 시장가 환산액이 5,000원 미만입니다 (보유: ${coinDisplay} ${upperCoin} ≈ ${Math.floor(valueKrw).toLocaleString()}원)`
            : `가능 (보유 ${coinDisplay} ${upperCoin} 전량 매도)`
          return {
            accountId: acc.id,
            exchange: acc.exchange,
            accountName: acc.account_name,
            orderSummary,
            balance: 0,
            coinQty: coinBalance,
            coin: upperCoin,
            feasible,
            reason,
          }
        }

        // BUY: KRW 잔고 검증
        const { krw } = await getBalance(exchange as Exchange, acc.access_key, acc.secret_key)
        const feasible = krw >= amountKrw
        return {
          accountId: acc.id,
          exchange: acc.exchange,
          accountName: acc.account_name,
          orderSummary,
          balance: krw,
          feasible,
          reason: feasible ? '가능' : '잔고 부족',
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'API 오류'
        return {
          accountId: acc.id,
          exchange: acc.exchange,
          accountName: acc.account_name,
          orderSummary,
          balance: 0,
          feasible: false,
          reason: `API 오류: ${msg.slice(0, 60)}`,
        }
      }
    }),
  )

  return Response.json(results)
}
