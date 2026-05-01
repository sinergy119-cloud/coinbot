// 일회용: 고팍스 API의 페이징/날짜 파라미터를 탐색해 과거 거래내역 조회
// 사용: cd ~/coinbot && npx tsx scripts/gopax-history-explore.ts

import { createServerClient } from '../src/lib/supabase'
import { decrypt } from '../src/lib/crypto'
import { createHmac } from 'crypto'

const BASE_URL = 'https://api.gopax.co.kr'

function sign(secretKey: string, method: string, path: string, body: string) {
  const timestamp = Date.now().toString()
  const message = `t${timestamp}${method}${path}${body}`
  const keyBytes = Buffer.from(secretKey, 'base64')
  const signature = createHmac('sha512', keyBytes).update(message, 'utf8').digest('base64')
  return { timestamp, signature }
}

async function call(accessKey: string, secretKey: string, path: string) {
  const pathForSign = path.split('?')[0]
  const { timestamp, signature } = sign(secretKey, 'GET', pathForSign, '')
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'GET',
    headers: { 'API-Key': accessKey, Timestamp: timestamp, Signature: signature },
  })
  const text = await res.text()
  let parsed: unknown = text
  try { parsed = JSON.parse(text) } catch {}
  return { status: res.status, data: parsed }
}

async function main() {
  const db = createServerClient()
  const { data: accounts } = await db
    .from('exchange_accounts')
    .select('access_key, secret_key')
    .eq('exchange', 'GOPAX')
    .eq('account_name', '김재한')
    .limit(1)

  const acc = accounts?.[0]
  if (!acc) { console.error('no account'); process.exit(1) }
  const ak = decrypt(acc.access_key)
  const sk = decrypt(acc.secret_key)

  // 다양한 엔드포인트/파라미터 시도
  // 이벤트 기간을 모두 포함하는 from~to: 2026-03-25 ~ 2026-04-13 (KST)
  const fromMs = new Date('2026-03-25T00:00:00+09:00').getTime()
  const toMs = new Date('2026-04-13T23:59:59+09:00').getTime()

  const tries = [
    `/trades?limit=1000`,
    `/trades?limit=1000&pastmax=${fromMs}`,
    `/trades?limit=1000&latestmax=${toMs}`,
    `/trades?limit=1000&from=${fromMs}&to=${toMs}`,
    `/trades?limit=1000&start=${new Date(fromMs).toISOString()}&end=${new Date(toMs).toISOString()}`,
    `/orders?limit=1000`,
    `/orders/history?limit=1000`,
    `/orders?limit=1000&statuses=completed`,
    `/orders?limit=1000&from=${fromMs}&to=${toMs}`,
    `/orders/history?limit=1000&from=${fromMs}&to=${toMs}`,
  ]

  for (const path of tries) {
    const r = await call(ak, sk, path)
    const arr = Array.isArray(r.data) ? r.data : null
    let oldestTs = '?'
    let newestTs = '?'
    if (arr && arr.length > 0) {
      const tsList: string[] = []
      for (const o of arr as Array<{ timestamp?: string; createdAt?: string }>) {
        const t = o.timestamp ?? o.createdAt
        if (t) tsList.push(t)
      }
      tsList.sort()
      oldestTs = tsList[0] ?? '?'
      newestTs = tsList[tsList.length - 1] ?? '?'
    }
    const summary = arr
      ? `arr len=${arr.length} oldest=${oldestTs} newest=${newestTs}`
      : `非array, status=${r.status}, data=${JSON.stringify(r.data).slice(0, 120)}`
    console.log(`[${r.status}] ${path}\n   → ${summary}`)
  }
}

main().catch((err) => { console.error(err); process.exit(1) })
