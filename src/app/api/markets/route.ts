import { NextRequest } from 'next/server'
import { bithumbGetMarkets } from '@/lib/bithumb-v2'
import type { Exchange } from '@/types/database'

// 각 거래소별 마켓 목록에서 KRW 코인 심볼만 추출
async function getCoins(exchange: Exchange): Promise<string[]> {
  try {
    if (exchange === 'BITHUMB') {
      const m = await bithumbGetMarkets()
      return m.map((s) => s.replace('KRW-', '')).filter(Boolean)
    }
    if (exchange === 'GOPAX') {
      const { gopaxGetMarkets } = await import('@/lib/gopax')
      const m = await gopaxGetMarkets()
      return m.map((s) => s.replace('-KRW', '').replace('-krw', '')).filter(Boolean)
    }
    if (exchange === 'COINONE') {
      const { coinoneGetMarkets } = await import('@/lib/coinone')
      const m = await coinoneGetMarkets()
      return m.map((s) => s.replace('/KRW', '')).filter(Boolean)
    }
    if (exchange === 'KORBIT') {
      const { korbitGetMarkets } = await import('@/lib/korbit')
      const m = await korbitGetMarkets()
      return m.map((s) => s.replace('/KRW', '')).filter(Boolean)
    }
    if (exchange === 'UPBIT') {
      const ccxt = (await import('ccxt')).default
      const ExchangeClass = (ccxt as unknown as Record<string, typeof ccxt.Exchange>)['upbit']
      const ex = new ExchangeClass({ enableRateLimit: true })
      await ex.loadMarkets()
      return Object.keys(ex.markets)
        .filter((s) => s.endsWith('/KRW'))
        .map((s) => s.replace('/KRW', ''))
    }
  } catch { /* 오류 시 빈 배열 */ }
  return []
}

// GET /api/markets?exchange=BITHUMB
export async function GET(req: NextRequest) {
  const exchange = req.nextUrl.searchParams.get('exchange') as Exchange | null
  if (!exchange) return Response.json({ error: 'exchange 파라미터 필요' }, { status: 400 })

  const coins = await getCoins(exchange)
  return Response.json(coins, {
    headers: { 'Cache-Control': 'public, max-age=300' }, // 5분 캐시
  })
}
