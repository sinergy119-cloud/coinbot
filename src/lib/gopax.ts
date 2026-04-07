// GOPAX API 직접 구현
// 인증: t{timestamp}{METHOD}{path}{bodyJson} → HMAC-SHA512 (base64 decoded secret)
// Headers: API-Key, Timestamp, Signature
// 마켓 심볼: BTC-KRW 형식

import { createHmac } from 'crypto'

const BASE_URL = 'https://api.gopax.co.kr'

function signGopax(
  secretKey: string,
  method: string,
  path: string,
  bodyJson: string,
): { timestamp: string; signature: string } {
  const timestamp = Date.now().toString()
  const message = `t${timestamp}${method}${path}${bodyJson}`
  const keyBytes = Buffer.from(secretKey, 'base64')
  const signature = createHmac('sha512', keyBytes)
    .update(message, 'utf8')
    .digest('base64')
  return { timestamp, signature }
}

async function gopaxPrivate(
  accessKey: string,
  secretKey: string,
  method: 'GET' | 'POST',
  path: string,
  body?: Record<string, unknown>,
) {
  const bodyJson = body ? JSON.stringify(body) : ''
  // 서명에는 쿼리스트링 제외한 경로만 사용 (GOPAX 스펙)
  const pathForSign = path.split('?')[0]
  const { timestamp, signature } = signGopax(secretKey, method, pathForSign, bodyJson)

  const headers: Record<string, string> = {
    'API-Key': accessKey,
    Timestamp: timestamp,
    Signature: signature,
  }

  const options: RequestInit = { method, headers }
  if (body) {
    headers['Content-Type'] = 'application/json'
    options.body = bodyJson
  }

  const res = await fetch(`${BASE_URL}${path}`, options)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`고팍스 API 오류 (${res.status}): ${text.slice(0, 120)}`)
  }
  return res.json()
}

// ──────────────────────────────────────
// 1) 잔고 조회: GET /balances
// 응답: [{ asset: 'KRW', avail: '50000', hold: '0' }, ...]
// ──────────────────────────────────────
export async function gopaxGetBalance(
  accessKey: string,
  secretKey: string,
): Promise<{ krw: number }> {
  const data = (await gopaxPrivate(accessKey, secretKey, 'GET', '/balances')) as Array<{
    asset: string
    avail: string
  }>
  const krwItem = data.find((item) => item.asset === 'KRW')
  return { krw: Number(krwItem?.avail ?? 0) }
}

export async function gopaxGetCoinBalance(
  accessKey: string,
  secretKey: string,
  coin: string,
): Promise<number> {
  const data = (await gopaxPrivate(accessKey, secretKey, 'GET', '/balances')) as Array<{
    asset: string
    avail: string
  }>
  const item = data.find((b) => b.asset.toUpperCase() === coin.toUpperCase())
  return Number(item?.avail ?? 0)
}

// ──────────────────────────────────────
// 1-c) 전체 잔고 (KRW + 코인) 조회
// ──────────────────────────────────────
export async function gopaxGetFullBalance(
  accessKey: string,
  secretKey: string,
): Promise<{ krw: number; coins: Record<string, number> }> {
  const data = (await gopaxPrivate(accessKey, secretKey, 'GET', '/balances')) as Array<{
    asset: string
    avail: string
  }>
  const coins: Record<string, number> = {}
  let krw = 0
  for (const item of data) {
    const amount = Number(item.avail)
    if (item.asset === 'KRW') krw = amount
    else if (amount > 0) coins[item.asset.toUpperCase()] = amount
  }
  return { krw, coins }
}

// ──────────────────────────────────────
// 3-b) 거래내역 조회: GET /orders
// ──────────────────────────────────────
export interface GopaxTradeHistoryItem {
  id: string
  datetime: string
  coin: string
  side: 'buy' | 'sell'
  quantity: number
  total: number
}

export async function gopaxGetTradeHistory(
  accessKey: string,
  secretKey: string,
  limit = 50,
): Promise<GopaxTradeHistoryItem[]> {
  const data = (await gopaxPrivate(accessKey, secretKey, 'GET', `/trades?limit=${limit}`)) as Array<{
    id: string | number
    tradingPairName: string
    side: string
    baseAmount: number    // 코인 수량
    quoteAmount: number   // KRW 금액
    price: number
    timestamp: string     // ISO 문자열
  }>
  if (!Array.isArray(data)) return []
  return data.map((o) => ({
    id: String(o.id),
    datetime: o.timestamp,
    coin: String(o.tradingPairName).replace('-KRW', '').replace('-krw', ''),
    side: (o.side === 'buy' ? 'buy' : 'sell') as 'buy' | 'sell',
    quantity: Number(o.baseAmount),
    total: Number(o.quoteAmount),
  }))
}

// ──────────────────────────────────────
// 2) 마켓 목록 (public): GET /trading-pairs
// 응답: [{ name: 'BTC-KRW', ... }, ...]
// ──────────────────────────────────────
export async function gopaxGetMarkets(): Promise<string[]> {
  const res = await fetch(`${BASE_URL}/trading-pairs`)
  if (!res.ok) throw new Error(`고팍스 마켓 조회 실패 (${res.status})`)
  const data = (await res.json()) as Array<{ id?: number; name?: string }>
  return data.map((m) => m.name ?? '').filter(Boolean)
}

// ──────────────────────────────────────
// 3) 현재가 (public): GET /trading-pairs/{name}/stats
// 응답: { close: '51000000', ... }
// ──────────────────────────────────────
export async function gopaxGetPrice(tradingPairName: string): Promise<number> {
  const res = await fetch(`${BASE_URL}/trading-pairs/${tradingPairName}/stats`)
  if (!res.ok) throw new Error(`고팍스 현재가 조회 실패 (${res.status})`)
  const data = (await res.json()) as { close?: number | string; price?: number | string; last?: number | string }
  return Number(data.close ?? data.price ?? data.last ?? 0)
}

// ──────────────────────────────────────
// 4) 시장가 주문: POST /orders
// 매수: side=buy, type=market, amount=KRW금액
// 매도: side=sell, type=market, amount=코인수량
// ──────────────────────────────────────
export interface GopaxOrderResult {
  success: boolean
  orderId?: string
  reason?: string
}

export async function gopaxPlaceMarketOrder(
  accessKey: string,
  secretKey: string,
  tradingPairName: string, // 예: "BTC-KRW"
  side: 'buy' | 'sell',
  amount: number, // 매수: KRW금액, 매도: 코인수량
): Promise<GopaxOrderResult> {
  try {
    const body: Record<string, unknown> = {
      tradingPairName,
      side,
      type: 'market',
      amount: side === 'sell' ? parseFloat(Number(amount).toFixed(8)) : amount,
    }
    const data = (await gopaxPrivate(accessKey, secretKey, 'POST', '/orders', body)) as {
      id?: string | number
    }
    return { success: true, orderId: String(data.id) }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '알 수 없는 오류'
    if (msg.includes('insufficient_funds') || msg.includes('부족') || msg.includes('balance') || msg.includes('잔고'))
      return { success: false, reason: '잔고 부족' }
    if (msg.includes('min') || msg.includes('minimum') || msg.includes('최소'))
      return { success: false, reason: '최소 금액 미달' }
    return { success: false, reason: `API 오류: ${msg.slice(0, 80)}` }
  }
}
