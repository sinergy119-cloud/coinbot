// 코인원 V2.1 API 직접 구현
// 인증: X-COINONE-PAYLOAD (base64 JSON) + X-COINONE-SIGNATURE (HMAC-SHA512 hex)
// Body: access_token + nonce + 요청 파라미터를 JSON → base64
// 마켓 심볼: target_currency (BTC) + quote_currency (KRW) 분리 형식

import { createHmac, randomUUID } from 'crypto'

const BASE_URL = 'https://api.coinone.co.kr'

async function coinonePrivate(
  accessKey: string,
  secretKey: string,
  path: string,
  extraBody: Record<string, unknown> = {},
) {
  const body: Record<string, unknown> = {
    access_token: accessKey,
    nonce: randomUUID(),
    ...extraBody,
  }
  const json = JSON.stringify(body)
  const payload = Buffer.from(json, 'utf8').toString('base64')
  const signature = createHmac('sha512', Buffer.from(secretKey.toUpperCase(), 'utf8'))
    .update(payload, 'utf8')
    .digest('hex')

  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'X-COINONE-PAYLOAD': payload,
      'X-COINONE-SIGNATURE': signature,
      'Content-Type': 'application/json',
    },
    body: payload,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`코인원 API 오류 (${res.status}): ${text.slice(0, 120)}`)
  }

  const data = await res.json() as { errorCode?: string; result?: string }
  if (data.errorCode && data.errorCode !== '0') {
    throw new Error(`코인원 API 오류 (errorCode: ${data.errorCode})`)
  }
  return data
}

// ──────────────────────────────────────
// 1) 잔고 조회: POST /v2.1/account/balance/all
// 응답: { balances: [{ currency: 'KRW', avail: '50000', ... }] }
// ──────────────────────────────────────
export async function coinoneGetBalance(
  accessKey: string,
  secretKey: string,
): Promise<{ krw: number }> {
  const data = (await coinonePrivate(accessKey, secretKey, '/v2.1/account/balance/all')) as {
    balances?: Array<{ currency: string; available: string }>
  }
  const krwItem = data.balances?.find((b) => b.currency.toLowerCase() === 'krw')
  return { krw: Number(krwItem?.available ?? 0) }
}

export async function coinoneGetCoinBalance(
  accessKey: string,
  secretKey: string,
  coin: string,
): Promise<number> {
  const data = (await coinonePrivate(accessKey, secretKey, '/v2.1/account/balance/all')) as {
    balances?: Array<{ currency: string; available: string }>
  }
  const item = data.balances?.find((b) => b.currency.toLowerCase() === coin.toLowerCase())
  return Number(item?.available ?? 0)
}

// ──────────────────────────────────────
// 1-c) 전체 잔고 (KRW + 코인) 조회
// ──────────────────────────────────────
export async function coinoneGetFullBalance(
  accessKey: string,
  secretKey: string,
): Promise<{ krw: number; coins: Record<string, number> }> {
  const data = (await coinonePrivate(accessKey, secretKey, '/v2.1/account/balance/all')) as {
    balances?: Array<{ currency: string; available: string }>
  }
  const coins: Record<string, number> = {}
  let krw = 0
  for (const item of data.balances ?? []) {
    const amount = Number(item.available)
    const cur = item.currency.toUpperCase()
    if (cur === 'KRW') krw = amount
    else if (amount > 0) coins[cur] = amount
  }
  return { krw, coins }
}

// ──────────────────────────────────────
// 3-b) 거래내역 조회: POST /v2.1/order/list
// ──────────────────────────────────────
export interface CoinoneTradeHistoryItem {
  id: string
  datetime: string
  coin: string
  side: 'buy' | 'sell'
  quantity: number
  total: number
}

export async function coinoneGetTradeHistory(
  accessKey: string,
  secretKey: string,
  limit = 50,
): Promise<CoinoneTradeHistoryItem[]> {
  const toTs = Date.now()
  const fromTs = toTs - 30 * 24 * 60 * 60 * 1000 // 최근 30일
  const data = (await coinonePrivate(accessKey, secretKey, '/v2.1/order/completed_orders/all', {
    from_ts: fromTs,
    to_ts: toTs,
    size: limit,
  })) as {
    completed_orders?: Array<{
      trade_id: string
      order_id: string
      is_ask: boolean
      target_currency: string
      qty: string
      price: string
      timestamp: number
    }>
  }
  return (data.completed_orders ?? []).map((o) => ({
    id: o.trade_id || o.order_id,
    datetime: new Date(o.timestamp).toISOString(),
    coin: o.target_currency.toUpperCase(),
    side: (o.is_ask ? 'sell' : 'buy') as 'buy' | 'sell',
    quantity: Number(o.qty),
    total: Number(o.price) * Number(o.qty),
  }))
}

// ──────────────────────────────────────
// 2) 마켓 목록 (public): GET /public/v2/ticker_new/KRW
// 응답: { result: 'success', tickers: { BTC: {...}, ETH: {...} } }
// ──────────────────────────────────────
export async function coinoneGetMarkets(): Promise<string[]> {
  const res = await fetch(`${BASE_URL}/public/v2/ticker_new/KRW`)
  if (!res.ok) throw new Error(`코인원 마켓 조회 실패 (${res.status})`)
  const data = (await res.json()) as { result?: string; tickers?: Array<{ target_currency: string }> }
  if (!Array.isArray(data.tickers)) return []
  // 내부 심볼 형식: "BTC/KRW"
  return data.tickers.map((t) => `${t.target_currency.toUpperCase()}/KRW`)
}

// ──────────────────────────────────────
// 3) 현재가 (public): GET /public/v2/ticker_new/KRW/{targetCurrency}
// 응답: { tickers: [{ last: '50000000', ... }] }
// ──────────────────────────────────────
export async function coinoneGetPrice(targetCurrency: string): Promise<number> {
  const res = await fetch(`${BASE_URL}/public/v2/ticker_new/KRW/${targetCurrency.toUpperCase()}`)
  if (!res.ok) throw new Error(`코인원 현재가 조회 실패 (${res.status})`)
  const data = (await res.json()) as { tickers?: Array<{ last?: string | number }> }
  return Number(data.tickers?.[0]?.last ?? 0)
}

// ──────────────────────────────────────
// 4) 시장가 주문: POST /v2.1/order
// 매수: side=BUY, type=MARKET, amount=KRW금액
// 매도: side=SELL, type=MARKET, qty=코인수량
// ──────────────────────────────────────
export interface CoinoneOrderResult {
  success: boolean
  orderId?: string
  reason?: string
}

export async function coinonePlaceMarketOrder(
  accessKey: string,
  secretKey: string,
  targetCurrency: string, // 예: "BTC"
  side: 'buy' | 'sell',
  amountKrw: number,
  coinQty?: number, // 매도 시 필요
): Promise<CoinoneOrderResult> {
  try {
    const extraBody: Record<string, unknown> = {
      side: side === 'buy' ? 'BUY' : 'SELL',
      quote_currency: 'KRW',
      target_currency: targetCurrency.toUpperCase(),
      type: 'MARKET',
    }
    if (side === 'buy') {
      extraBody.amount = String(amountKrw)
    } else {
      extraBody.qty = String(parseFloat(Number(coinQty ?? 0).toFixed(8)))
    }

    const data = (await coinonePrivate(accessKey, secretKey, '/v2.1/order', extraBody)) as {
      order_id?: string
    }
    return { success: true, orderId: data.order_id }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '알 수 없는 오류'
    if (msg.includes('insufficient_funds') || msg.includes('부족') || msg.includes('balance') || msg.includes('잔고') || msg.includes('INSUFFICIENT'))
      return { success: false, reason: '잔고 부족' }
    if (msg.includes('min') || msg.includes('minimum') || msg.includes('최소'))
      return { success: false, reason: '최소 금액 미달' }
    return { success: false, reason: `API 오류: ${msg.slice(0, 80)}` }
  }
}
