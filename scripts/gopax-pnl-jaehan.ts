// 일회용: 고팍스(김재한) DEGEN/UP 이벤트 기간 매수·매도 합계 조회
// 사용: cd ~/coinbot && npx tsx scripts/gopax-pnl-jaehan.ts

import { createServerClient } from '../src/lib/supabase'
import { getTradeHistory } from '../src/lib/exchange'

interface Window { coin: string; from: string; to: string; reward: number }
const WINDOWS: Window[] = [
  { coin: 'DEGEN', from: '2026-03-25T11:00:00+09:00', to: '2026-04-07T23:59:59+09:00', reward: 13617 },
  { coin: 'UP',    from: '2026-03-31T15:00:00+09:00', to: '2026-04-13T23:59:59+09:00', reward: 19289 },
]

async function main() {
  const db = createServerClient()
  const { data: accounts, error } = await db
    .from('exchange_accounts')
    .select('id, exchange, account_name, access_key, secret_key, user_id, users!inner(user_id)')
    .eq('exchange', 'GOPAX')
    .eq('account_name', '김재한')

  if (error) throw new Error('계정 조회 실패: ' + error.message)
  if (!accounts || accounts.length === 0) {
    console.error('고팍스(김재한) 계정 없음')
    process.exit(1)
  }
  console.log(`발견된 계정: ${accounts.length}개`)
  const acc = accounts[0]
  console.log(`사용자 user_id: ${(acc as { users: { user_id: string } }).users.user_id}`)

  // 가능한 한 많이 조회 (limit=1000)
  const orders = await getTradeHistory('GOPAX', acc.access_key, acc.secret_key, 1000)
  console.log(`조회된 체결 주문: ${orders.length}건`)
  if (orders.length > 0) {
    const dates = orders.map((o) => o.datetime).sort()
    console.log(`범위: ${dates[0]} ~ ${dates[dates.length - 1]}`)
  }

  console.log('\n=== 이벤트 기간 손익 ===')
  console.log('| 코인 | 기간 | 매수액 | 매도액 | 차액(매수-매도) | 수익 | 손익 |')
  console.log('|------|------|--------|--------|-----------------|------|------|')

  for (const w of WINDOWS) {
    const fromMs = new Date(w.from).getTime()
    const toMs = new Date(w.to).getTime()
    const filtered = orders.filter((o) => {
      const t = new Date(o.datetime).getTime()
      return t >= fromMs && t <= toMs && o.coin.toUpperCase() === w.coin
    })
    const buyTotal = filtered.filter((o) => o.side === 'buy').reduce((s, o) => s + o.total, 0)
    const sellTotal = filtered.filter((o) => o.side === 'sell').reduce((s, o) => s + o.total, 0)
    const delta = buyTotal - sellTotal
    const pnl = w.reward - delta
    const fmt = (n: number) => Math.round(n).toLocaleString('ko-KR')
    console.log(`| ${w.coin} | ${w.from.slice(5,10)}~${w.to.slice(5,10)} | ${fmt(buyTotal)} | ${fmt(sellTotal)} | ${fmt(delta)} | ${fmt(w.reward)} | ${fmt(pnl)} |`)
    console.log(`  └ ${w.coin} 거래 ${filtered.length}건 (매수 ${filtered.filter((o) => o.side === 'buy').length} / 매도 ${filtered.filter((o) => o.side === 'sell').length})`)
  }
}

main().catch((err) => {
  console.error('ERROR:', err)
  process.exit(1)
})
