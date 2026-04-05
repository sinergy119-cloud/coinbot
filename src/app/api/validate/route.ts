import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase'
import { validateMarket, getBalance, getCoinBalance, getCurrentPrice } from '@/lib/exchange'
import type { Exchange } from '@/types/database'

export interface ValidationItem {
  accountId: string
  exchange: string
  accountName: string
  orderSummary: string
  balance: number
  feasible: boolean
  reason: string
}

// POST /api/validate → 실행 전 검증
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return Response.json({ error: '로그인 필요' }, { status: 401 })

  const { exchange, coin, tradeType, amountKrw, accountIds } = await req.json()

  if (!exchange || !coin || !tradeType || !amountKrw || !accountIds?.length) {
    return Response.json({ error: '필수 항목이 누락되었습니다.' }, { status: 400 })
  }

  // 1) 코인 유효성 검증
  const { valid, symbol } = await validateMarket(exchange as Exchange, coin)
  if (!valid) {
    return Response.json({ error: `${coin}은(는) ${exchange}에서 지원하지 않는 코인입니다.` }, { status: 400 })
  }

  // 2) 선택된 계정 목록 조회
  const db = createServerClient()
  const { data: accounts } = await db
    .from('exchange_accounts')
    .select('*')
    .in('id', accountIds)
    .eq('user_id', session.userId)

  if (!accounts || accounts.length === 0) {
    return Response.json({ error: '계정을 찾을 수 없습니다.' }, { status: 404 })
  }

  // 3) 계정별 잔고 조회 + 가능 여부 판단 (Promise.all 동시 실행)
  const isSell = tradeType === 'SELL'
  const orderSummary = `${symbol} ${isSell ? '매도' : '매수'} ${Number(amountKrw).toLocaleString()}원`

  // 매도의 경우 현재가 미리 조회 (공유)
  let currentPrice = 0
  if (isSell) {
    try {
      currentPrice = await getCurrentPrice(exchange as Exchange, coin)
    } catch { /* 현재가 조회 실패 시 0으로 진행 */ }
  }

  const results: ValidationItem[] = await Promise.all(
    accounts.map(async (acc) => {
      try {
        if (isSell) {
          // 매도: 코인 잔고 확인
          const coinQty = await getCoinBalance(exchange as Exchange, acc.access_key, acc.secret_key, coin)
          const neededQty = currentPrice > 0 ? amountKrw / currentPrice : 0
          const feasible = coinQty > 0 && (neededQty <= 0 || coinQty >= neededQty)
          const coinDisplay = coinQty.toFixed(8).replace(/\.?0+$/, '')
          return {
            accountId: acc.id,
            exchange: acc.exchange,
            accountName: acc.account_name,
            orderSummary,
            balance: coinQty,           // 코인 수량으로 표시
            feasible,
            reason: feasible ? `가능 (보유 ${coinDisplay} ${coin.toUpperCase()})` : `잔고 부족 (보유 ${coinDisplay} ${coin.toUpperCase()})`,
          }
        } else {
          // 매수: KRW 잔고 확인
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
