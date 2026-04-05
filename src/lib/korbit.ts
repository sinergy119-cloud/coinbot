// 코빗 V2 API 직접 구현
// 인증: X-KAPI-KEY 헤더 + timestamp + signature (HMAC-SHA256 base64)
// signature 대상: 전체 query/body string (timestamp 포함, signature 제외)
// POST: application/x-www-form-urlencoded
// 마켓 심볼: btc_krw 형식 (소문자, 언더스코어)

import { createHmac } from 'crypto'

const BASE_URL = 'https://api.korbit.co.kr'

function korbitSign(secretKey: string, plainText: string): string {
  return createHmac('sha256', Buffer.from(secretKey, 'utf8'))
    .update(plainText, 'utf8')
    .digest('base64')
}

function buildParamString(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&')
}

async function korbitPrivate(
  accessKey: string,
  secretKey: string,
  method: 'GET' | 'POST',
  path: string,
  params: Record<string, string> = {},
) {
  const allParams = {
    ...params,
    timestamp: Date.now().toString(),
  }
  const paramString = buildParamString(allParams)
  const signature = korbitSign(secretKey, paramString)
  const headers: Record<string, string> = { 'X-KAPI-KEY': accessKey }

  let res: Response
  if (method === 'GET') {
    res = await fetch(`${BASE_URL}${path}?${paramString}&signature=${encodeURIComponent(signature)}`, {
      method: 'GET',
      headers,
    })
  } else {
    headers['Content-Type'] = 'application/x-www-form-urlencoded'
    res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers,
      body: `${paramString}&signature=${encodeURIComponent(signature)}`,
    })
  }

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`코빗 API 오류 (${res.status}): ${text.slice(0, 120)}`)
  }

  const data = await res.json() as { success?: boolean; errorCode?: string }
  if (data.success === false) {
    throw new Error(`코빗 API 오류 (errorCode: ${data.errorCode ?? 'unknown'})`)
  }
  return data
}

// ──────────────────────────────────────
// 1) 잔고 조회: GET /v2/balance
// 응답: { data: [{ currency: 'krw', available: '50000', ... }] }
// ──────────────────────────────────────
export async function korbitGetBalance(
  accessKey: string,
  secretKey: string,
): Promise<{ krw: number }> {
  const data = (await korbitPrivate(accessKey, secretKey, 'GET', '/v2/balance')) as {
    data?: Array<{ currency: string; available: string }>
  }
  const krwItem = data.data?.find((b) => b.currency.toLowerCase() === 'krw')
  return { krw: Number(krwItem?.available ?? 0) }
}

export async function korbitGetCoinBalance(
  accessKey: string,
  secretKey: string,
  coin: string,
): Promise<number> {
  const data = (await korbitPrivate(accessKey, secretKey, 'GET', '/v2/balance')) as {
    data?: Array<{ currency: string; available: string }>
  }
  const item = data.data?.find((b) => b.currency.toLowerCase() === coin.toLowerCase())
  return Number(item?.available ?? 0)
}

// ──────────────────────────────────────
// 2) 마켓 목록 (public): GET /v1/ticker/detailed/all
// 응답: { data: { btc_krw: {...}, eth_krw: {...} } }
// 내부 심볼: "BTC/KRW" 형식으로 변환
// ──────────────────────────────────────
export async function korbitGetMarkets(): Promise<string[]> {
  const res = await fetch(`${BASE_URL}/v1/ticker/detailed/all`)
  if (!res.ok) throw new Error(`코빗 마켓 조회 실패 (${res.status})`)
  const data = (await res.json()) as { data?: Record<string, unknown> } | Record<string, unknown>
  const pairs = ('data' in data && data.data) ? data.data : data
  // btc_krw → BTC/KRW
  return Object.keys(pairs as object)
    .filter((key) => key.endsWith('_krw'))
    .map((key) => {
      const [base] = key.split('_')
      return `${base.toUpperCase()}/KRW`
    })
}

// ──────────────────────────────────────
// 3) 현재가 (public): GET /v1/ticker?currency_pair=btc_krw
// 응답: { timestamp: ..., last: '50000000', ... }
// ──────────────────────────────────────
export async function korbitGetPrice(symbol: string): Promise<number> {
  // symbol: btc_krw 형식
  const res = await fetch(`${BASE_URL}/v1/ticker?currency_pair=${symbol}`)
  if (!res.ok) throw new Error(`코빗 현재가 조회 실패 (${res.status})`)
  const data = (await res.json()) as { last?: string | number; data?: { last?: string | number } }
  const last = data.last ?? data.data?.last ?? 0
  return Number(last)
}

// ──────────────────────────────────────
// 4) 시장가 주문: POST /v2/orders
// 매수: side=buy, orderType=market, amt=KRW금액
// 매도: side=sell, orderType=market, qty=코인수량
// 심볼 형식: btc_krw (소문자 언더스코어)
// ──────────────────────────────────────
export interface KorbitOrderResult {
  success: boolean
  orderId?: string
  reason?: string
}

export async function korbitPlaceMarketOrder(
  accessKey: string,
  secretKey: string,
  symbol: string, // 예: "btc_krw"
  side: 'buy' | 'sell',
  amountKrw: number,
  coinQty?: number,
): Promise<KorbitOrderResult> {
  try {
    const params: Record<string, string> = {
      symbol,
      side,
      orderType: 'market',
    }
    if (side === 'buy') {
      params.amt = String(amountKrw)
    } else {
      params.qty = String(coinQty ?? 0)
    }

    const data = (await korbitPrivate(accessKey, secretKey, 'POST', '/v2/orders', params)) as {
      data?: { orderId?: string }
    }
    return { success: true, orderId: data.data?.orderId }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '알 수 없는 오류'
    if (msg.includes('balance') || msg.includes('잔고') || msg.includes('insufficient'))
      return { success: false, reason: '잔고 부족' }
    if (msg.includes('min') || msg.includes('minimum') || msg.includes('최소'))
      return { success: false, reason: '최소 금액 미달' }
    return { success: false, reason: `API 오류: ${msg.slice(0, 80)}` }
  }
}
