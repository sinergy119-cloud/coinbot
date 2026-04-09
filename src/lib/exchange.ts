import ccxt, { Exchange as CcxtExchange } from 'ccxt'
import type { Exchange } from '@/types/database'
import { decrypt } from '@/lib/crypto'
import {
  bithumbGetBalance,
  bithumbGetCoinBalance,
  bithumbGetMarkets,
  bithumbGetPrice,
  bithumbPlaceMarketOrder,
  bithumbGetTradeHistory,
} from '@/lib/bithumb-v2'
import {
  gopaxGetBalance,
  gopaxGetCoinBalance,
  gopaxGetMarkets,
  gopaxGetPrice,
  gopaxPlaceMarketOrder,
  gopaxGetFullBalance,
  gopaxGetTradeHistory,
} from '@/lib/gopax'
import {
  coinoneGetBalance,
  coinoneGetCoinBalance,
  coinoneGetMarkets,
  coinoneGetPrice,
  coinonePlaceMarketOrder,
  coinoneGetFullBalance,
  coinoneGetTradeHistory,
} from '@/lib/coinone'
import {
  korbitGetBalance,
  korbitGetCoinBalance,
  korbitGetMarkets,
  korbitGetPrice,
  korbitPlaceMarketOrder,
  korbitGetFullBalance,
  korbitGetTradeHistory,
} from '@/lib/korbit'

// ──────────────────────────────────────
// ccxt는 업비트만 사용
// 빗썸: bithumb-v2.ts (JWT Bearer HS256)
// 고팍스: gopax.ts (HMAC-SHA512, base64 decoded key)
// 코인원: coinone.ts (X-COINONE-PAYLOAD, HMAC-SHA512)
// 코빗: korbit.ts (X-KAPI-KEY, HMAC-SHA256)
// ──────────────────────────────────────

function createUpbitPrivate(encryptedAccessKey: string, encryptedSecretKey: string): CcxtExchange {
  const ExchangeClass = (ccxt as unknown as Record<string, typeof CcxtExchange>)['upbit']
  if (!ExchangeClass) throw new Error('업비트 ccxt 클래스를 찾을 수 없습니다.')
  return new ExchangeClass({
    apiKey: decrypt(encryptedAccessKey),
    secret: decrypt(encryptedSecretKey),
    enableRateLimit: true,
  })
}

function createUpbitPublic(): CcxtExchange {
  const ExchangeClass = (ccxt as unknown as Record<string, typeof CcxtExchange>)['upbit']
  if (!ExchangeClass) throw new Error('업비트 ccxt 클래스를 찾을 수 없습니다.')
  return new ExchangeClass({ enableRateLimit: true })
}

// ──────────────────────────────────────
// 마켓 목록 캐시 (5분)
// ──────────────────────────────────────
const marketCache = new Map<string, { markets: string[]; expiresAt: number }>()
const MARKET_CACHE_TTL_MS = 5 * 60 * 1000

async function getCachedMarkets(key: string, fetcher: () => Promise<string[]>): Promise<string[]> {
  const cached = marketCache.get(key)
  if (cached && Date.now() < cached.expiresAt) return cached.markets
  const markets = await fetcher()
  marketCache.set(key, { markets, expiresAt: Date.now() + MARKET_CACHE_TTL_MS })
  return markets
}

// ──────────────────────────────────────
// 1) 코인 유효성 검증 (KRW 마켓 존재 여부)
// ──────────────────────────────────────
export async function validateMarket(
  exchange: Exchange,
  coin: string,
): Promise<{ valid: boolean; symbol: string }> {
  const upperCoin = coin.toUpperCase()

  if (exchange === 'BITHUMB') {
    const markets = await getCachedMarkets('BITHUMB', bithumbGetMarkets)
    const symbol = `KRW-${upperCoin}`
    return { valid: markets.includes(symbol), symbol }
  }

  if (exchange === 'GOPAX') {
    const markets = await getCachedMarkets('GOPAX', gopaxGetMarkets)
    const symbol = `${upperCoin}-KRW`
    return { valid: markets.includes(symbol), symbol }
  }

  if (exchange === 'COINONE') {
    const markets = await getCachedMarkets('COINONE', coinoneGetMarkets)
    const symbol = `${upperCoin}/KRW`
    return { valid: markets.includes(symbol), symbol }
  }

  if (exchange === 'KORBIT') {
    const markets = await getCachedMarkets('KORBIT', korbitGetMarkets)
    const symbol = `${upperCoin}/KRW`
    return { valid: markets.includes(symbol), symbol }
  }

  // 업비트 (ccxt): "BTC/KRW" 형식
  const upbitMarkets = await getCachedMarkets('UPBIT', async () => {
    const ex = createUpbitPublic()
    await ex.loadMarkets()
    return Object.keys(ex.markets)
  })
  const symbol = `${upperCoin}/KRW`
  return { valid: upbitMarkets.includes(symbol), symbol }
}

// ──────────────────────────────────────
// 2) 잔고 조회
// ──────────────────────────────────────
export async function getBalance(
  exchange: Exchange,
  encAccessKey: string,
  encSecretKey: string,
): Promise<{ krw: number }> {
  const accessKey = decrypt(encAccessKey)
  const secretKey = decrypt(encSecretKey)

  if (exchange === 'BITHUMB') {
    const { krw } = await bithumbGetBalance(accessKey, secretKey)
    return { krw }
  }

  if (exchange === 'GOPAX') {
    return gopaxGetBalance(accessKey, secretKey)
  }

  if (exchange === 'COINONE') {
    return coinoneGetBalance(accessKey, secretKey)
  }

  if (exchange === 'KORBIT') {
    return korbitGetBalance(accessKey, secretKey)
  }

  // 업비트 (ccxt)
  const ex = createUpbitPrivate(encAccessKey, encSecretKey)
  const balance = await ex.fetchBalance()
  const free = balance.free as unknown as Record<string, number> | undefined
  const krw = free?.KRW ?? free?.krw ?? 0
  return { krw: Number(krw) }
}

// ──────────────────────────────────────
// 2-a) 전체 잔고 조회 (KRW + 보유 코인 전체)
// ──────────────────────────────────────
export async function getFullBalance(
  exchange: Exchange,
  encAccessKey: string,
  encSecretKey: string,
): Promise<{ krw: number; coins: Record<string, number> }> {
  const accessKey = decrypt(encAccessKey)
  const secretKey = decrypt(encSecretKey)

  if (exchange === 'BITHUMB') return bithumbGetBalance(accessKey, secretKey)
  if (exchange === 'GOPAX') return gopaxGetFullBalance(accessKey, secretKey)
  if (exchange === 'COINONE') return coinoneGetFullBalance(accessKey, secretKey)
  if (exchange === 'KORBIT') return korbitGetFullBalance(accessKey, secretKey)

  // 업비트 (ccxt)
  const ex = createUpbitPrivate(encAccessKey, encSecretKey)
  const balance = await ex.fetchBalance()
  const free = balance.free as unknown as Record<string, number> | undefined
  const coins: Record<string, number> = {}
  let krw = 0
  for (const [currency, amount] of Object.entries(free ?? {})) {
    if (!amount || Number(amount) <= 0) continue
    if (currency === 'KRW') krw = Number(amount)
    else coins[currency] = Number(amount)
  }
  return { krw, coins }
}

// ──────────────────────────────────────
// 2-b) 코인 잔고 조회 (매도 검증용)
// ──────────────────────────────────────
export async function getCoinBalance(
  exchange: Exchange,
  encAccessKey: string,
  encSecretKey: string,
  coin: string,
): Promise<number> {
  const accessKey = decrypt(encAccessKey)
  const secretKey = decrypt(encSecretKey)
  const upperCoin = coin.toUpperCase()

  if (exchange === 'BITHUMB') return bithumbGetCoinBalance(accessKey, secretKey, upperCoin)
  if (exchange === 'GOPAX') return gopaxGetCoinBalance(accessKey, secretKey, upperCoin)
  if (exchange === 'COINONE') return coinoneGetCoinBalance(accessKey, secretKey, upperCoin)
  if (exchange === 'KORBIT') return korbitGetCoinBalance(accessKey, secretKey, upperCoin)

  // 업비트 (ccxt)
  const ex = createUpbitPrivate(encAccessKey, encSecretKey)
  const balance = await ex.fetchBalance()
  const free = balance.free as unknown as Record<string, number> | undefined
  return Number(free?.[upperCoin] ?? 0)
}

// ──────────────────────────────────────
// 2-c) 거래내역 조회
// ──────────────────────────────────────
export interface TradeHistoryItem {
  id: string
  datetime: string
  coin: string
  side: 'buy' | 'sell'
  quantity: number
  total: number
}

export async function getTradeHistory(
  exchange: Exchange,
  encAccessKey: string,
  encSecretKey: string,
  limit = 50,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  coin?: string,
): Promise<TradeHistoryItem[]> {
  const accessKey = decrypt(encAccessKey)
  const secretKey = decrypt(encSecretKey)

  if (exchange === 'BITHUMB') return bithumbGetTradeHistory(accessKey, secretKey, limit)
  if (exchange === 'GOPAX') return gopaxGetTradeHistory(accessKey, secretKey, limit)
  if (exchange === 'COINONE') return coinoneGetTradeHistory(accessKey, secretKey, limit)
  if (exchange === 'KORBIT') return korbitGetTradeHistory(accessKey, secretKey, limit)

  // 업비트 (ccxt)
  const ex = createUpbitPrivate(encAccessKey, encSecretKey)
  const orders = await ex.fetchClosedOrders(undefined, undefined, limit)
  return orders.map((o) => ({
    id: o.id,
    datetime: o.datetime ?? new Date(o.timestamp).toISOString(),
    coin: (o.symbol ?? '').replace('/KRW', ''),
    side: o.side as 'buy' | 'sell',
    quantity: o.filled ?? o.amount ?? 0,
    total: o.cost ?? 0,
  }))
}

// ──────────────────────────────────────
// 3) 현재가 조회
// ──────────────────────────────────────
export async function getCurrentPrice(exchange: Exchange, coin: string): Promise<number> {
  const upperCoin = coin.toUpperCase()

  if (exchange === 'BITHUMB') {
    return bithumbGetPrice(`KRW-${upperCoin}`)
  }

  if (exchange === 'GOPAX') {
    return gopaxGetPrice(`${upperCoin}-KRW`)
  }

  if (exchange === 'COINONE') {
    return coinoneGetPrice(upperCoin)
  }

  if (exchange === 'KORBIT') {
    return korbitGetPrice(`${upperCoin.toLowerCase()}_krw`)
  }

  // 업비트 (ccxt)
  const ex = createUpbitPublic()
  const symbol = `${upperCoin}/KRW`
  const ticker = await ex.fetchTicker(symbol)
  return ticker.last ?? 0
}

// ──────────────────────────────────────
// 4) 시장가 주문 실행
// ──────────────────────────────────────
export interface OrderResult {
  success: boolean
  orderId?: string
  reason?: string
}

export async function placeMarketOrder(
  exchange: Exchange,
  encAccessKey: string,
  encSecretKey: string,
  coin: string,
  side: 'buy' | 'sell',
  amountKrw: number,
): Promise<OrderResult> {
  const upperCoin = coin.toUpperCase()
  const accessKey = decrypt(encAccessKey)
  const secretKey = decrypt(encSecretKey)

  if (exchange === 'BITHUMB') {
    const market = `KRW-${upperCoin}`
    let coinQty: number | undefined
    if (side === 'sell') {
      const price = await bithumbGetPrice(market)
      if (price <= 0) return { success: false, reason: '현재가 조회 실패' }
      coinQty = amountKrw / price
    }
    return bithumbPlaceMarketOrder(accessKey, secretKey, market, side, amountKrw, coinQty)
  }

  if (exchange === 'GOPAX') {
    const tradingPairName = `${upperCoin}-KRW`
    let amount = amountKrw
    if (side === 'sell') {
      const price = await gopaxGetPrice(tradingPairName)
      if (price <= 0) return { success: false, reason: '현재가 조회 실패' }
      amount = parseFloat((amountKrw / price).toFixed(8))
    }
    return gopaxPlaceMarketOrder(accessKey, secretKey, tradingPairName, side, amount)
  }

  if (exchange === 'COINONE') {
    let coinQty: number | undefined
    if (side === 'sell') {
      const price = await coinoneGetPrice(upperCoin)
      if (price <= 0) return { success: false, reason: '현재가 조회 실패' }
      coinQty = parseFloat((amountKrw / price).toFixed(8))
    }
    return coinonePlaceMarketOrder(accessKey, secretKey, upperCoin, side, amountKrw, coinQty)
  }

  if (exchange === 'KORBIT') {
    const symbol = `${upperCoin.toLowerCase()}_krw`
    let coinQty: number | undefined
    if (side === 'sell') {
      const price = await korbitGetPrice(symbol)
      if (price <= 0) return { success: false, reason: '현재가 조회 실패' }
      coinQty = parseFloat((amountKrw / price).toFixed(8))
    }
    return korbitPlaceMarketOrder(accessKey, secretKey, symbol, side, amountKrw, coinQty)
  }

  // 업비트 (ccxt)
  try {
    const ex = createUpbitPrivate(encAccessKey, encSecretKey)
    const symbol = `${upperCoin}/KRW`

    if (side === 'buy') {
      const order = await ex.createMarketBuyOrder(symbol, amountKrw, { cost: amountKrw })
      return { success: true, orderId: order.id }
    } else {
      const price = await getCurrentPrice(exchange, coin)
      if (price <= 0) return { success: false, reason: '현재가 조회 실패' }
      const qty = parseFloat((amountKrw / price).toFixed(8))
      const order = await ex.createMarketSellOrder(symbol, qty)
      return { success: true, orderId: order.id }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류'
    if (message.includes('balance') || message.includes('insufficient'))
      return { success: false, reason: '잔고 부족' }
    if (message.includes('minimum') || message.includes('min'))
      return { success: false, reason: '최소 금액 미달' }
    return { success: false, reason: `API 오류: ${message.slice(0, 80)}` }
  }
}

// ──────────────────────────────────────
// 5) CYCLE: 시장가 매수 → 체결 대기(폴링) → 전량 매도
// reference의 market-cycle 패턴:
//   매수 → Start-Sleep → GetStableOrderCheck(폴링) → 잔고조회 → 매도
// ──────────────────────────────────────

// reference Get-PollDelayMilliseconds 스케줄과 동일
const POLL_DELAYS_MS = [250, 350, 500, 700, 900, 1200, 1500, 1800]

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export interface CycleOrderResult {
  success: boolean
  buyOrderId?: string
  sellOrderId?: string
  reason?: string
}

export async function placeCycleOrder(
  exchange: Exchange,
  encAccessKey: string,
  encSecretKey: string,
  coin: string,
  amountKrw: number,
): Promise<CycleOrderResult> {
  // 1) 매수
  const buyResult = await placeMarketOrder(exchange, encAccessKey, encSecretKey, coin, 'buy', amountKrw)
  if (!buyResult.success) {
    return { success: false, reason: `매수 실패: ${buyResult.reason}` }
  }

  // 2) 매수 체결 대기 — 점진적 딜레이로 최대 8회 폴링
  //    전체 보유량이 0보다 크면 체결된 것으로 판단
  let coinQty = 0
  for (let i = 0; i < POLL_DELAYS_MS.length; i++) {
    await sleep(POLL_DELAYS_MS[i])
    try {
      coinQty = await getCoinBalance(exchange, encAccessKey, encSecretKey, coin)
    } catch { /* 잠시 후 재시도 */ }
    if (coinQty > 0) break
  }

  if (coinQty <= 0) {
    return {
      success: false,
      buyOrderId: buyResult.orderId,
      reason: '매수 체결 대기 시간 초과 — 코인 잔고 미확인',
    }
  }

  // 3) 전체 보유량 매도 (기존 잔량 + 매수량) — 실패 시 최대 3회 재시도 (1s/2s/4s)
  const SELL_RETRY_DELAYS_MS = [1000, 2000, 4000]
  let sellResult = await placeMarketOrderByCoinQty(exchange, encAccessKey, encSecretKey, coin, coinQty)
  for (let i = 0; !sellResult.success && i < SELL_RETRY_DELAYS_MS.length; i++) {
    await sleep(SELL_RETRY_DELAYS_MS[i])
    // 재시도 전 최신 잔고 재조회
    try {
      const latestQty = await getCoinBalance(exchange, encAccessKey, encSecretKey, coin)
      if (latestQty > 0) coinQty = latestQty
    } catch { /* 재조회 실패 시 기존 coinQty 유지 */ }
    sellResult = await placeMarketOrderByCoinQty(exchange, encAccessKey, encSecretKey, coin, coinQty)
  }

  return {
    success: sellResult.success,
    buyOrderId: buyResult.orderId,
    sellOrderId: sellResult.orderId,
    reason: sellResult.success ? undefined : `매도 실패: ${sellResult.reason}`,
  }
}

// 코인 수량으로 직접 매도 (CYCLE / SELL 전량 매도용)
export async function placeMarketOrderByCoinQty(
  exchange: Exchange,
  encAccessKey: string,
  encSecretKey: string,
  coin: string,
  coinQty: number,
): Promise<OrderResult> {
  const upperCoin = coin.toUpperCase()
  const accessKey = decrypt(encAccessKey)
  const secretKey = decrypt(encSecretKey)
  const vol = parseFloat(coinQty.toFixed(8))

  if (exchange === 'BITHUMB') {
    return bithumbPlaceMarketOrder(accessKey, secretKey, `KRW-${upperCoin}`, 'sell', 0, vol)
  }
  if (exchange === 'GOPAX') {
    return gopaxPlaceMarketOrder(accessKey, secretKey, `${upperCoin}-KRW`, 'sell', vol)
  }
  if (exchange === 'COINONE') {
    return coinonePlaceMarketOrder(accessKey, secretKey, upperCoin, 'sell', 0, vol)
  }
  if (exchange === 'KORBIT') {
    return korbitPlaceMarketOrder(accessKey, secretKey, `${upperCoin.toLowerCase()}_krw`, 'sell', 0, vol)
  }
  // 업비트 (ccxt)
  try {
    const ex = createUpbitPrivate(encAccessKey, encSecretKey)
    const order = await ex.createMarketSellOrder(`${upperCoin}/KRW`, vol)
    return { success: true, orderId: order.id }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '알 수 없는 오류'
    return { success: false, reason: `API 오류: ${msg.slice(0, 80)}` }
  }
}
