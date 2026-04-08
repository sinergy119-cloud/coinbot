// 코빗 V2 API 직접 구현
// 인증: X-KAPI-KEY 헤더 + timestamp + signature (HMAC-SHA256 base64)
// signature 대상: 전체 query/body string (timestamp 포함, signature 제외)
// POST: application/x-www-form-urlencoded
// 마켓 심볼: btc_krw 형식 (소문자, 언더스코어)

import { createHmac } from 'crypto'

const BASE_URL = 'https://api.korbit.co.kr'

// 서명: HMAC-SHA256 HEX (reference 기준 — base64 아님)
function korbitSign(secretKey: string, plainText: string): string {
  return createHmac('sha256', Buffer.from(secretKey, 'utf8'))
    .update(plainText, 'utf8')
    .digest('hex')
}

// 키는 인코딩 안 함, 값만 encodeURIComponent (reference New-FormString 동일)
function buildParamString(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
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
  // 서명은 paramString 기준으로 계산하고, URL/body에 raw로 append (인코딩 없음)
  const signature = korbitSign(secretKey, paramString)
  const headers: Record<string, string> = { 'X-KAPI-KEY': accessKey }

  let res: Response
  if (method === 'GET') {
    res = await fetch(`${BASE_URL}${path}?${paramString}&signature=${signature}`, {
      method: 'GET',
      headers,
    })
  } else {
    headers['Content-Type'] = 'application/x-www-form-urlencoded'
    res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers,
      body: `${paramString}&signature=${signature}`,
    })
  }

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`코빗 API 오류 (${res.status}): ${text.slice(0, 300)}`)
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
// 1-c) 전체 잔고 (KRW + 코인) 조회
// ──────────────────────────────────────
export async function korbitGetFullBalance(
  accessKey: string,
  secretKey: string,
): Promise<{ krw: number; coins: Record<string, number> }> {
  const data = (await korbitPrivate(accessKey, secretKey, 'GET', '/v2/balance')) as {
    data?: Array<{ currency: string; available: string }>
  }
  const coins: Record<string, number> = {}
  let krw = 0
  for (const item of data.data ?? []) {
    const amount = Number(item.available)
    const cur = item.currency.toUpperCase()
    if (cur === 'KRW') krw = amount
    else if (amount > 0) coins[cur] = amount
  }
  return { krw, coins }
}

// ──────────────────────────────────────
// 3-b) 거래내역 조회: GET /v2/orders
// ──────────────────────────────────────
export interface KorbitTradeHistoryItem {
  id: string
  datetime: string
  coin: string
  side: 'buy' | 'sell'
  quantity: number
  total: number
}

// 코빗 주요 코인 목록 (symbol 필수이므로 병렬 조회)
const KORBIT_MAJOR_COINS = ['btc', 'eth', 'xrp', 'usdt', 'ada', 'sol', 'dot', 'avax', 'link', 'matic', 'bch', 'ltc', 'doge', 'trx', 'etc']

export async function korbitGetTradeHistory(
  accessKey: string,
  secretKey: string,
  limit = 50,
): Promise<KorbitTradeHistoryItem[]> {
  // /v2/myTrades 는 최대 36시간 이전까지만 조회 가능 (startTime 미지정 시 기본값 36시간 전)
  // 공식 docs.korbit.co.kr 기준 응답 필드
  type RawTrade = {
    tradeId: string | number
    symbol: string
    side: string
    price: string
    qty: string   // 코인 수량
    amt: string   // KRW 금액
    tradedAt: number  // UNIX ms
  }

  // 보유 코인 목록을 먼저 조회하여 major 목록과 합산 (사용자가 보유한 코인이 목록에 없을 경우 대비)
  let userCoins: string[] = []
  try {
    const balData = (await korbitPrivate(accessKey, secretKey, 'GET', '/v2/balance')) as {
      data?: Array<{ currency: string; available: string; hold?: string }>
    }
    userCoins = (balData.data ?? [])
      .filter((b) => b.currency.toLowerCase() !== 'krw')
      .map((b) => b.currency.toLowerCase())
  } catch { /* 잔고 조회 실패 시 major 목록만 사용 */ }

  const allCoins = Array.from(new Set([...KORBIT_MAJOR_COINS, ...userCoins]))

  // rate limit 대비: 5개씩 나눠서 순차 처리
  const CHUNK = 5
  const settled: PromiseSettledResult<RawTrade[]>[] = []
  for (let i = 0; i < allCoins.length; i += CHUNK) {
    const chunk = allCoins.slice(i, i + CHUNK)
    const chunkResults = await Promise.allSettled(
      chunk.map((coin) =>
        korbitPrivate(accessKey, secretKey, 'GET', '/v2/myTrades', {
          symbol: `${coin}_krw`,
          limit: '100',
        }).then((data) => {
          const d = data as { data?: RawTrade[] } | RawTrade[]
          if (Array.isArray(d)) return d
          return d.data ?? []
        })
      )
    )
    settled.push(...chunkResults)
  }
  const results = settled

  // 전부 실패 시 첫 번째 에러를 throw하여 원인 노출
  const failures = results.filter((r) => r.status === 'rejected')
  if (failures.length === results.length) {
    const firstErr = (failures[0] as PromiseRejectedResult).reason
    throw new Error(firstErr instanceof Error ? firstErr.message : String(firstErr))
  }

  const all: KorbitTradeHistoryItem[] = []
  for (const r of results) {
    if (r.status !== 'fulfilled') continue
    for (const o of r.value) {
      all.push({
        id: String(o.tradeId),
        datetime: new Date(o.tradedAt).toISOString(),
        coin: o.symbol.split('_')[0].toUpperCase(),
        side: (o.side === 'buy' ? 'buy' : 'sell') as 'buy' | 'sell',
        quantity: Number(o.qty),
        total: Number(o.amt),
      })
    }
  }

  // 최신순 정렬 후 limit 건 반환
  return all
    .sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime())
    .slice(0, limit)
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
      params.qty = String(parseFloat(Number(coinQty ?? 0).toFixed(8)))
    }

    const data = (await korbitPrivate(accessKey, secretKey, 'POST', '/v2/orders', params)) as {
      data?: { orderId?: string }
    }
    return { success: true, orderId: data.data?.orderId != null ? String(data.data.orderId) : undefined }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '알 수 없는 오류'
    if (msg.includes('insufficient_funds') || msg.includes('부족') || msg.includes('balance') || msg.includes('잔고') || msg.includes('insufficient'))
      return { success: false, reason: '잔고 부족' }
    if (msg.includes('min') || msg.includes('minimum') || msg.includes('최소') || msg.includes('ORDER_VALUE_TOO_SMALL'))
      return { success: false, reason: '최소 금액 미달' }
    if (msg.includes('ORDER_VALUE_TOO_LARGE') || msg.includes('max') || msg.includes('maximum'))
      return { success: false, reason: '최대 주문 금액 초과' }
    return { success: false, reason: `API 오류: ${msg.slice(0, 200)}` }
  }
}
