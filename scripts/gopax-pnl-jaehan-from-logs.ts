// 일회용: trade_logs DB에서 고팍스(김재한) DEGEN/UP 손익 집계
// 사용: cd ~/coinbot && npx tsx scripts/gopax-pnl-jaehan-from-logs.ts

import { createServerClient } from '../src/lib/supabase'

interface Window { coin: string; from: string; to: string; reward: number }
const WINDOWS: Window[] = [
  { coin: 'DEGEN', from: '2026-03-25T11:00:00+09:00', to: '2026-04-07T23:59:59+09:00', reward: 13617 },
  { coin: 'UP',    from: '2026-03-31T15:00:00+09:00', to: '2026-04-13T23:59:59+09:00', reward: 19289 },
]

interface LogRow {
  id: string
  exchange: string
  coin: string
  trade_type: string
  amount_krw: number
  account_name: string | null
  success: boolean
  reason: string | null
  source: string
  executed_at: string
}

async function main() {
  const db = createServerClient()
  const minIso = WINDOWS.reduce((m, w) => (w.from < m ? w.from : m), WINDOWS[0].from)
  const maxIso = WINDOWS.reduce((m, w) => (w.to > m ? w.to : m), WINDOWS[0].to)

  const { data, error } = await db
    .from('trade_logs')
    .select('id, exchange, coin, trade_type, amount_krw, account_name, success, reason, source, executed_at')
    .eq('exchange', 'GOPAX')
    .eq('account_name', '김재한')
    .gte('executed_at', new Date(minIso).toISOString())
    .lte('executed_at', new Date(maxIso).toISOString())
    .order('executed_at', { ascending: true })
    .limit(2000)

  if (error) throw new Error('trade_logs 조회 실패: ' + error.message)
  const rows = (data ?? []) as LogRow[]
  console.log(`전체 trade_logs (GOPAX/김재한, ${minIso}~${maxIso}): ${rows.length}건`)
  const successRows = rows.filter((r) => r.success)
  console.log(`그 중 성공: ${successRows.length}건`)

  console.log('\n=== 코인별 / 기간별 손익 ===')
  console.log('| 코인 | 기간 | 매수액 | 매도액 | 차액 | 수익 | 손익 | 거래 |')
  console.log('|------|------|--------|--------|------|------|------|------|')

  const fmt = (n: number) => Math.round(n).toLocaleString('ko-KR')

  let totalDelta = 0
  let totalReward = 0
  for (const w of WINDOWS) {
    const fromMs = new Date(w.from).getTime()
    const toMs = new Date(w.to).getTime()
    const filt = successRows.filter((r) => {
      const t = new Date(r.executed_at).getTime()
      return t >= fromMs && t <= toMs && r.coin.toUpperCase() === w.coin
    })
    const buy = filt.filter((r) => r.trade_type === 'BUY').reduce((s, r) => s + (r.amount_krw ?? 0), 0)
    const sell = filt.filter((r) => r.trade_type === 'SELL').reduce((s, r) => s + (r.amount_krw ?? 0), 0)
    const delta = buy - sell
    const pnl = w.reward - delta
    totalDelta += delta
    totalReward += w.reward
    console.log(`| ${w.coin} | ${w.from.slice(5,10)}~${w.to.slice(5,10)} | ${fmt(buy)} | ${fmt(sell)} | ${fmt(delta)} | ${fmt(w.reward)} | ${fmt(pnl)} | ${filt.length}건 |`)
  }
  console.log(`| 합계 | — | — | — | ${fmt(totalDelta)} | ${fmt(totalReward)} | ${fmt(totalReward - totalDelta)} | — |`)

  console.log('\n=== 원본 trade_logs 덤프 (성공만) ===')
  for (const r of successRows) {
    console.log(`${r.executed_at} | ${r.coin} | ${r.trade_type} | ${r.amount_krw}원 | source=${r.source}`)
  }
}

main().catch((err) => {
  console.error('ERROR:', err)
  process.exit(1)
})
