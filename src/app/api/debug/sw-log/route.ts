// SW 디버그 로깅 엔드포인트 — 인증 없이 누구나 기록 가능 (진단용 임시)
// pm2 logs coinbot 에서 [SW-DEBUG] 로 검색

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const url = new URL(req.url)
    const event = url.searchParams.get('event') || body.event || 'unknown'
    const ts = new Date().toISOString()
    console.log(`[SW-DEBUG] ${ts} event=${event}`, JSON.stringify(body).slice(0, 500))
  } catch (e) {
    console.log('[SW-DEBUG] error', e)
  }
  return new Response('ok', { status: 200 })
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const event = url.searchParams.get('event') || 'unknown'
  const ts = new Date().toISOString()
  console.log(`[SW-DEBUG-GET] ${ts} event=${event} qs=${url.search}`)
  return new Response('ok', { status: 200 })
}
