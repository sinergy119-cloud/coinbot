import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase'
import { placeMarketOrder, placeCycleOrder, placeMarketOrderByCoinQty, getCoinBalance, getBalance } from '@/lib/exchange'
import { sendTelegramMessage } from '@/lib/telegram'
import { isValidExchange, isValidTradeType, isValidCoin, isValidUuidArray, parseAmountKrw } from '@/lib/validation'
import type { Exchange, TradeType } from '@/types/database'

const TRADE_TYPE_LABEL: Record<string, string> = { BUY: '매수', SELL: '매도', CYCLE: '매수 & 매도' }

export interface ExecutionResultItem {
  accountId: string
  accountName: string
  exchange: string
  orderSummary: string
  balanceBefore: number
  balance: number
  success: boolean
  reason: string
}

// POST /api/execute → 즉시 실행
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return Response.json({ error: '로그인 필요' }, { status: 401 })

  const { exchange, coin, tradeType, amountKrw, accountIds } = await req.json()

  if (!isValidExchange(exchange)) {
    return Response.json({ error: '유효하지 않은 거래소입니다.' }, { status: 400 })
  }
  if (!isValidCoin(coin)) {
    return Response.json({ error: '유효하지 않은 코인입니다.' }, { status: 400 })
  }
  if (!isValidTradeType(tradeType)) {
    return Response.json({ error: '유효하지 않은 거래 방식입니다.' }, { status: 400 })
  }
  if (!isValidUuidArray(accountIds)) {
    return Response.json({ error: '계정을 선택해주세요.' }, { status: 400 })
  }

  const tt = tradeType as TradeType
  const parsedAmount = parseAmountKrw(amountKrw)

  // 매도는 금액 불필요, 매수/사이클은 최소 금액 검증
  if (tt !== 'SELL') {
    if (parsedAmount === null || parsedAmount < 5100) {
      return Response.json({ error: '최소 거래 금액은 5,100원입니다.' }, { status: 400 })
    }
  }

  const db = createServerClient()

  // 본인 계정 조회
  const { data: myAccounts } = await db
    .from('exchange_accounts')
    .select('*')
    .in('id', accountIds)
    .eq('user_id', session.userId)

  // 관리자인 경우: 위임된 계정도 허용
  let delegatedAccounts: typeof myAccounts = []
  if (session.isAdmin) {
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

  const upperCoin = coin.toUpperCase()
  const orderSummary = tt === 'CYCLE'
    ? `${upperCoin}/KRW 매수(시장가) & 매도(시장가, 전체 수량) ${(parsedAmount ?? 0).toLocaleString()}원`
    : tt === 'SELL'
    ? `${upperCoin}/KRW 전량 매도(시장가)`
    : `${upperCoin}/KRW 매수(시장가) ${(parsedAmount ?? 0).toLocaleString()}원`

  // 전부 동시에 실행 (planning.md 8.4)
  const results: ExecutionResultItem[] = await Promise.all(
    accounts.map(async (acc) => {
      // 실행 전 잔고 조회
      let balanceBefore = 0
      try {
        const bb = await getBalance(exchange as Exchange, acc.access_key, acc.secret_key)
        balanceBefore = bb.krw
      } catch { /* 무시 */ }

      try {
        // CYCLE: 매수 후 전량 매도
        if (tt === 'CYCLE') {
          const result = await placeCycleOrder(
            exchange as Exchange,
            acc.access_key,
            acc.secret_key,
            coin,
            parsedAmount ?? 0,
          )
          let balance = 0
          try {
            const bal = await getBalance(exchange as Exchange, acc.access_key, acc.secret_key)
            balance = bal.krw
          } catch { /* 무시 */ }
          return {
            accountId: acc.id,
            accountName: acc.account_name,
            exchange: acc.exchange,
            orderSummary,
            balanceBefore,
            balance,
            success: result.success,
            reason: result.success
              ? `SUCCESS (매수:${result.buyOrderId?.slice(0, 8)} 매도:${result.sellOrderId?.slice(0, 8)})`
              : `FAIL (${result.reason})`,
          }
        }

        // SELL: 보유 코인 전량 매도
        if (tt === 'SELL') {
          const coinQty = await getCoinBalance(exchange as Exchange, acc.access_key, acc.secret_key, coin)
          if (coinQty <= 0) {
            return {
              accountId: acc.id,
              accountName: acc.account_name,
              exchange: acc.exchange,
              orderSummary,
              balanceBefore,
              balance: 0,
              success: false,
              reason: `FAIL (보유 ${upperCoin} 없음)`,
            }
          }
          const result = await placeMarketOrderByCoinQty(
            exchange as Exchange,
            acc.access_key,
            acc.secret_key,
            coin,
            coinQty,
          )
          let balance = 0
          try {
            const bal = await getBalance(exchange as Exchange, acc.access_key, acc.secret_key)
            balance = bal.krw
          } catch { /* 무시 */ }
          return {
            accountId: acc.id,
            accountName: acc.account_name,
            exchange: acc.exchange,
            orderSummary,
            balanceBefore,
            balance,
            success: result.success,
            reason: result.success ? 'SUCCESS' : `FAIL (${result.reason})`,
          }
        }

        // BUY: 시장가 매수
        const result = await placeMarketOrder(
          exchange as Exchange,
          acc.access_key,
          acc.secret_key,
          coin,
          'buy',
          parsedAmount ?? 0,
        )

        let balance = 0
        try {
          const bal = await getBalance(exchange as Exchange, acc.access_key, acc.secret_key)
          balance = bal.krw
        } catch { /* 잔고 조회 실패는 무시 */ }

        return {
          accountId: acc.id,
          accountName: acc.account_name,
          exchange: acc.exchange,
          orderSummary,
          balanceBefore,
          balance,
          success: result.success,
          reason: result.success ? 'SUCCESS' : `FAIL (${result.reason})`,
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '알 수 없는 오류'
        return {
          accountId: acc.id,
          accountName: acc.account_name,
          exchange: acc.exchange,
          orderSummary,
          balanceBefore,
          balance: 0,
          success: false,
          reason: `FAIL (${msg.slice(0, 60)})`,
        }
      }
    }),
  )

  // 거래 실행 로그 저장 — user_id는 실제 계정 소유자(관리자가 위임 실행한 경우 피위임자)
  try {
    const accOwnerMap = new Map<string, string>()
    for (const acc of accounts) accOwnerMap.set(acc.id, acc.user_id)

    const logs = results.map((r) => ({
      user_id: accOwnerMap.get(r.accountId) ?? session.userId,
      exchange,
      coin,
      trade_type: tradeType,
      amount_krw: parsedAmount ?? 0,
      account_id: r.accountId,
      account_name: r.accountName,
      success: r.success,
      order_id: r.reason?.match(/[a-f0-9-]{8}/)?.[0] || null,
      reason: r.reason?.slice(0, 200),
      balance_before: r.balanceBefore,
      balance: r.balance,
      source: 'manual',
    }))
    await db.from('trade_logs').insert(logs)
  } catch { /* 로그 저장 실패는 무시 */ }

  // 텔레그램 알림: 수신자별 본인 계정 결과만 필터링
  try {
    const accOwnerMap = new Map<string, string>()
    for (const acc of accounts) accOwnerMap.set(acc.id, acc.user_id)

    const targetUserIds = new Set<string>([session.userId])
    for (const acc of accounts) targetUserIds.add(acc.user_id)

    const { data: targetUsers } = await db
      .from('users')
      .select('id, telegram_chat_id')
      .in('id', Array.from(targetUserIds))

    const upperCoin = coin.toUpperCase()
    for (const tu of targetUsers ?? []) {
      if (!tu.telegram_chat_id) continue

      const isExecutor = tu.id === session.userId
      const filtered = isExecutor
        ? results
        : results.filter((r) => accOwnerMap.get(r.accountId) === tu.id)

      if (filtered.length === 0) continue

      const successCount = filtered.filter((r) => r.success).length
      const failCount = filtered.length - successCount
      const icon = failCount === 0 ? '✅' : successCount === 0 ? '❌' : '⚠️'
      const showAdmin = !isExecutor
      const msg = [
        `${icon} <b>MyCoinBot 즉시 실행 결과</b>`,
        ...(showAdmin ? [``, `🔑 실행자: MyCoinBot`] : []),
        ``,
        `거래소: ${exchange}`,
        `코인: ${upperCoin}`,
        `방식: ${TRADE_TYPE_LABEL[tradeType] ?? tradeType}`,
        tt !== 'SELL' ? `금액: ${(parsedAmount ?? 0).toLocaleString()}원` : '',
        ``,
        `<b>계정별 결과 (${successCount}성공 / ${failCount}실패)</b>`,
        ...filtered.map((r) => `${r.success ? '✅' : '❌'} ${r.accountName}${r.success ? '' : `: ${r.reason}`}`),
      ].filter(Boolean).join('\n')
      await sendTelegramMessage(tu.telegram_chat_id, msg)
    }
  } catch { /* 알림 실패는 무시 */ }

  return Response.json(results)
}
