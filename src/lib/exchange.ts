import ccxt, { Exchange as CcxtExchange } from 'ccxt'
import type { Exchange } from '@/types/database'
import { decrypt } from '@/lib/crypto'
import {
  bithumbGetBalance,
  bithumbGetCoinBalance,
  bithumbGetMarkets,
  bithumbGetPrice,
  bithumbPlaceMarketOrder,
} from '@/lib/bithumb-v2'
import {
  gopaxGetBalance,
  gopaxGetCoinBalance,
  gopaxGetMarkets,
  gopaxGetPrice,
  gopaxPlaceMarketOrder,
} from '@/lib/gopax'
import {
  coinoneGetBalance,
  coinoneGetCoinBalance,
  coinoneGetMarkets,
  coinoneGetPrice,
  coinonePlaceMarketOrder,
} from '@/lib/coinone'
import {
  korbitGetBalance,
  korbitGetCoinBalance,
  korbitGetMarkets,
  korbitGetPrice,
  korbitPlaceMarketOrder,
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
// 1) 코인 유효성 검증 (KRW 마켓 존재 여부)
// ──────────────────────────────────────
export async function validateMarket(
  exchange: Exchange,
  coin: string,
): Promise<{ valid: boolean; symbol: string }> {
  const upperCoin = coin.toUpperCase()

  if (exchange === 'BITHUMB') {
    // 빗썸: "KRW-BTC" 형식
    const markets = await bithumbGetMarkets()
    const symbol = `KRW-${upperCoin}`
    return { valid: markets.includes(symbol), symbol }
  }

  if (exchange === 'GOPAX') {
    // 고팍스: "BTC-KRW" 형식
    const markets = await gopaxGetMarkets()
    const symbol = `${upperCoin}-KRW`
    return { valid: markets.includes(symbol), symbol }
  }

  if (exchange === 'COINONE') {
    // 코인원: "BTC/KRW" 형식
    const markets = await coinoneGetMarkets()
    const symbol = `${upperCoin}/KRW`
    return { valid: markets.includes(symbol), symbol }
  }

  if (exchange === 'KORBIT') {
    // 코빗: 내부적으로 "BTC/KRW" 형식으로 반환
    const markets = await korbitGetMarkets()
    const symbol = `${upperCoin}/KRW`
    return { valid: markets.includes(symbol), symbol }
  }

  // 업비트 (ccxt): "BTC/KRW" 형식
  const ex = createUpbitPublic()
  await ex.loadMarkets()
  const symbol = `${upperCoin}/KRW`
  return { valid: symbol in ex.markets, symbol }
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
      amount = amountKrw / price
    }
    return gopaxPlaceMarketOrder(accessKey, secretKey, tradingPairName, side, amount)
  }

  if (exchange === 'COINONE') {
    let coinQty: number | undefined
    if (side === 'sell') {
      const price = await coinoneGetPrice(upperCoin)
      if (price <= 0) return { success: false, reason: '현재가 조회 실패' }
      coinQty = amountKrw / price
    }
    return coinonePlaceMarketOrder(accessKey, secretKey, upperCoin, side, amountKrw, coinQty)
  }

  if (exchange === 'KORBIT') {
    const symbol = `${upperCoin.toLowerCase()}_krw`
    let coinQty: number | undefined
    if (side === 'sell') {
      const price = await korbitGetPrice(symbol)
      if (price <= 0) return { success: false, reason: '현재가 조회 실패' }
      coinQty = amountKrw / price
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
      const qty = amountKrw / price
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
