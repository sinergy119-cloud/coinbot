// 빗썸 V2 API 클라이언트 (JWT Bearer 인증)
// ccxt에는 아직 V2 지원이 없어서 직접 구현
// 문서: https://apidocs.bithumb.com

import { createHash, randomUUID } from 'crypto'
import { SignJWT } from 'jose'

const BASE_URL = 'https://api.bithumb.com'

// ──────────────────────────────────────
// JWT 토큰 생성 (HS256)
// payload: access_key, nonce, timestamp, query_hash?, query_hash_alg?
// ──────────────────────────────────────
async function signToken(
  accessKey: string,
  secretKey: string,
  params?: Record<string, string | number>,
): Promise<string> {
  const payload: Record<string, string | number> = {
    access_key: accessKey,
    nonce: randomUUID(),
    timestamp: Date.now(),
  }

  if (params && Object.keys(params).length > 0) {
    // query string 생성 (key=value 형식, & 구분)
    const queryString = Object.entries(params)
      .map(([k, v]) => `${k}=${v}`)
      .join('&')
    const hash = createHash('sha512').update(queryString).digest('hex')
    payload.query_hash = hash
    payload.query_hash_alg = 'SHA512'
  }

  const secret = new TextEncoder().encode(secretKey)
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .sign(secret)

  return token
}

// ──────────────────────────────────────
// 1) 잔고 조회: GET /v1/accounts
// ──────────────────────────────────────
export async function bithumbGetBalance(
  accessKey: string,
  secretKey: string,
): Promise<{ krw: number; coins: Record<string, number> }> {
  const token = await signToken(accessKey, secretKey)
  const res = await fetch(`${BASE_URL}/v1/accounts`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`빗썸 잔고 조회 실패 (${res.status}): ${text.slice(0, 100)}`)
  }

  // 응답 예: [{ currency: 'KRW', balance: '10000', locked: '0', ... }, ...]
  const data = (await res.json()) as Array<{ currency: string; balance: string }>
  const coins: Record<string, number> = {}
  let krw = 0
  for (const item of data) {
    const amount = Number(item.balance ?? 0)
    if (item.currency === 'KRW') krw = amount
    else coins[item.currency] = amount
  }
  return { krw, coins }
}

// ──────────────────────────────────────
// 1-b) 특정 코인 잔고 조회
// ──────────────────────────────────────
export async function bithumbGetCoinBalance(
  accessKey: string,
  secretKey: string,
  coin: string,
): Promise<number> {
  const { coins } = await bithumbGetBalance(accessKey, secretKey)
  return coins[coin.toUpperCase()] ?? 0
}

// ──────────────────────────────────────
// 2) 마켓 목록 조회 (public, 인증 불필요)
//    GET /v1/market/all
// ──────────────────────────────────────
export async function bithumbGetMarkets(): Promise<string[]> {
  const res = await fetch(`${BASE_URL}/v1/market/all?isDetails=false`)
  if (!res.ok) throw new Error(`빗썸 마켓 조회 실패 (${res.status})`)
  const data = (await res.json()) as Array<{ market: string }>
  // market 형식: "KRW-BTC"
  return data.map((m) => m.market)
}

// ──────────────────────────────────────
// 3) 현재가 조회 (public)
//    GET /v1/ticker?markets=KRW-BTC
// ──────────────────────────────────────
export async function bithumbGetPrice(market: string): Promise<number> {
  const res = await fetch(`${BASE_URL}/v1/ticker?markets=${market}`)
  if (!res.ok) throw new Error(`빗썸 현재가 조회 실패 (${res.status})`)
  const data = (await res.json()) as Array<{ trade_price: number }>
  return data[0]?.trade_price ?? 0
}

// ──────────────────────────────────────
// 4) 시장가 주문: POST /v1/orders
// ──────────────────────────────────────
export interface BithumbOrderResult {
  success: boolean
  orderId?: string
  reason?: string
}

export async function bithumbPlaceMarketOrder(
  accessKey: string,
  secretKey: string,
  market: string,      // 예: "KRW-BTC"
  side: 'buy' | 'sell',
  amountKrw: number,
  coinQty?: number,    // 매도 시 필요 (매수는 price만)
): Promise<BithumbOrderResult> {
  try {
    // 시장가 매수: ord_type=price, price=금액
    // 시장가 매도: ord_type=market, volume=수량
    const params: Record<string, string> = {
      market,
      side: side === 'buy' ? 'bid' : 'ask',
    }
    if (side === 'buy') {
      params.ord_type = 'price'
      params.price = String(amountKrw)
    } else {
      params.ord_type = 'market'
      params.volume = String(coinQty ?? 0)
    }

    const token = await signToken(accessKey, secretKey, params)
    const res = await fetch(`${BASE_URL}/v1/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(params),
    })

    if (!res.ok) {
      const text = await res.text()
      const msg = text.slice(0, 200)
      if (
        msg.includes('insufficient_funds') ||
        msg.includes('부족') ||
        msg.includes('balance') ||
        msg.includes('잔고')
      ) return { success: false, reason: '잔고 부족' }
      if (msg.includes('min') || msg.includes('minimum') || msg.includes('최소'))
        return { success: false, reason: '최소 금액 미달' }
      return { success: false, reason: `API 오류: ${msg}` }
    }

    const data = (await res.json()) as { uuid?: string }
    return { success: true, orderId: data.uuid }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '알 수 없는 오류'
    return { success: false, reason: `API 오류: ${msg.slice(0, 80)}` }
  }
}
