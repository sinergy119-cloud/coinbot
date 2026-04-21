/**
 * /api/admin/crawl-preview — 이벤트 URL 크롤링 후 코인·금액·기간 자동 추출 (관리자 전용)
 *
 * GET ?url=<이벤트URL>&title=<제목>
 * Returns { coin, amount, startDate, endDate, rewardDate, requireApply, apiAllowed }
 *
 * 추출 우선순위:
 *   startDate/endDate : RSC eventPeriod > Claude Vision > 텍스트 정규식
 *   rewardDate        : Claude Vision (이미지 OCR) > 텍스트 정규식
 *   requireApply      : Claude Vision > 텍스트 정규식
 *   apiAllowed        : Claude Vision > 텍스트 정규식
 *   coin              : Claude Vision > 제목 파싱
 *   amount            : 텍스트 정규식 > Claude Vision
 *
 * ANTHROPIC_API_KEY 환경변수가 없으면 Claude Vision 스킵, 정규식만 사용
 */

import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'

// ═══════════════════════════════════════════════════════════════
// 타입 정의
// ═══════════════════════════════════════════════════════════════

interface PreviewResult {
  coin: string | null
  amount: string | null
  startDate: string | null
  endDate: string | null
  rewardDate: string | null
  requireApply: boolean
  apiAllowed: boolean
}

interface FetchResult {
  bodyText: string
  rscDates: { startDate: string | null; endDate: string | null } | null
  imageUrls: string[]
}

// ═══════════════════════════════════════════════════════════════
// API 핸들러
// ═══════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session || !session.isAdmin) {
    return Response.json({ error: '관리자만 접근 가능합니다.' }, { status: 403 })
  }

  const url = req.nextUrl.searchParams.get('url')
  const title = req.nextUrl.searchParams.get('title') ?? ''

  if (!url) {
    return Response.json({ error: 'url 파라미터가 필요합니다.' }, { status: 400 })
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return Response.json({ error: '유효하지 않은 URL' }, { status: 400 })
    }
  } catch {
    return Response.json({ error: '유효하지 않은 URL' }, { status: 400 })
  }

  // 1. HTML 페치 + 텍스트/RSC날짜/이미지 URL 추출
  const { bodyText, rscDates, imageUrls } = await fetchBodyTextAndDates(parsedUrl)

  // 2. 텍스트 정규식 기반 추출 (베이스라인)
  const regexCoin = extractCoinFromTitle(title)
  const regexAmount = extractAmount(bodyText, title)
  const regexDates = extractDateRange(bodyText)
  const regexRewardDate = extractRewardDate(bodyText)
  const regexRequireApply = extractRequireApply(bodyText)
  const regexApiAllowed = extractApiAllowed(bodyText)

  // 3. Claude Vision 추출 (ANTHROPIC_API_KEY 있을 때만)
  let vision: Partial<PreviewResult> | null = null
  if (process.env.ANTHROPIC_API_KEY && imageUrls.length > 0) {
    vision = await extractWithClaude(bodyText, imageUrls, title)
  }

  // 4. 우선순위 병합
  const result: PreviewResult = {
    coin:         vision?.coin        ?? regexCoin,
    amount:       regexAmount         ?? vision?.amount ?? null,
    startDate:    rscDates?.startDate ?? vision?.startDate ?? regexDates.startDate,
    endDate:      rscDates?.endDate   ?? vision?.endDate   ?? regexDates.endDate,
    rewardDate:   vision?.rewardDate  ?? regexRewardDate,
    requireApply: vision?.requireApply != null ? vision.requireApply : regexRequireApply,
    apiAllowed:   vision?.apiAllowed  != null ? vision.apiAllowed   : regexApiAllowed,
  }

  return Response.json(result)
}

// ═══════════════════════════════════════════════════════════════
// HTML 페치 — 거래소별 전략
// ═══════════════════════════════════════════════════════════════

async function fetchBodyTextAndDates(url: URL): Promise<FetchResult> {
  // GOPAX: REST API 직접 호출
  if (url.hostname.includes('gopax.co.kr')) {
    const m = url.pathname.match(/\/notice\/(\d+)/)
    if (m) {
      const text = await fetchGopaxNotice(m[1])
      if (text) return { bodyText: text, rscDates: null, imageUrls: [] }
    }
  }

  // KORBIT: Contentful API 직접 호출 (CSR 페이지라 HTML fetch 불가)
  if (url.hostname.includes('korbit.co.kr')) {
    const noticeId = url.searchParams.get('noticeId')
    if (noticeId) {
      const text = await fetchKorbitNotice(noticeId)
      if (text) return { bodyText: text, rscDates: null, imageUrls: [] }
    }
  }

  // 기타: HTML 페치
  return fetchHtmlTextAndDates(url.toString())
}

async function fetchKorbitNotice(noticeId: string): Promise<string> {
  try {
    const res = await fetch(
      `https://portal-prod.korbit.co.kr/api/korbit/v2/contentful?content_type=notice&sys.id=${encodeURIComponent(noticeId)}&limit=1`,
      {
        headers: {
          'User-Agent': 'MyCoinBot-Crawler/1.0',
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'platform-identifier': 'witcher_ios',
          'korbit_platform_id': '21',
        },
        signal: AbortSignal.timeout(10_000),
      },
    )
    if (!res.ok) return ''
    const data = await res.json()
    const item = data?.items?.[0]
    if (!item) return ''
    // fields.contents는 Contentful rich text — 텍스트 노드만 추출
    const title = item.fields?.title ?? ''
    const richText = item.fields?.contents
    const richTexts: string[] = []
    function extractRichText(node: unknown): void {
      if (!node || typeof node !== 'object') return
      const n = node as Record<string, unknown>
      if (n.nodeType === 'text' && typeof n.value === 'string') richTexts.push(n.value)
      if (Array.isArray(n.content)) n.content.forEach(extractRichText)
    }
    if (richText) extractRichText(richText)
    return `${title} ${richTexts.join(' ')}`.trim()
  } catch {
    return ''
  }
}

async function fetchGopaxNotice(noticeId: string): Promise<string> {
  for (const page of [0, 1]) {
    try {
      const res = await fetch(
        `https://api.gopax.co.kr/notices?type=0&limit=50&page=${page}`,
        { headers: { 'User-Agent': 'MyCoinBot-Crawler/1.0', Accept: 'application/json' }, signal: AbortSignal.timeout(8000) },
      )
      if (!res.ok) break
      const list = await res.json()
      if (!Array.isArray(list)) break
      const found = list.find((item: { id?: number | string }) => String(item.id) === noticeId)
      if (found) return stripHtmlTags(`${found.title ?? ''} ${found.content ?? ''}`)
      if (list.length < 50) break
    } catch { break }
  }
  return ''
}

async function fetchHtmlTextAndDates(url: string): Promise<FetchResult> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'ko-KR,ko;q=0.9',
      },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return { bodyText: '', rscDates: null, imageUrls: [] }
    const html = await res.text()
    return {
      bodyText:  extractTextFromHtml(html),
      rscDates:  extractRscEventPeriod(html),
      imageUrls: extractImageUrls(html),
    }
  } catch {
    return { bodyText: '', rscDates: null, imageUrls: [] }
  }
}

// ═══════════════════════════════════════════════════════════════
// Claude Vision — 이미지 기반 종합 추출
// ═══════════════════════════════════════════════════════════════

async function extractWithClaude(
  bodyText: string,
  imageUrls: string[],
  title: string,
): Promise<Partial<PreviewResult> | null> {
  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    // 이미지 다운로드: 20KB~600KB, 최대 5장
    type AllowedMime = 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp'
    const ALLOWED_MIMES: AllowedMime[] = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
    type ImageBlock = { type: 'image'; source: { type: 'base64'; media_type: AllowedMime; data: string } }
    const imageParts: ImageBlock[] = []

    for (const imgUrl of imageUrls.slice(0, 10)) {
      if (imageParts.length >= 5) break
      try {
        const imgRes = await fetch(imgUrl, { signal: AbortSignal.timeout(6000) })
        if (!imgRes.ok) continue
        const contentLength = parseInt(imgRes.headers.get('content-length') ?? '0')
        if (contentLength > 0 && (contentLength < 20_000 || contentLength > 600_000)) continue
        const buf = await imgRes.arrayBuffer()
        if (buf.byteLength < 20_000 || buf.byteLength > 600_000) continue
        const b64 = Buffer.from(buf).toString('base64')
        const rawMime = (imgRes.headers.get('content-type') ?? 'image/png').split(';')[0].trim()
        const mime: AllowedMime = ALLOWED_MIMES.includes(rawMime as AllowedMime)
          ? (rawMime as AllowedMime)
          : 'image/png'
        imageParts.push({ type: 'image', source: { type: 'base64', media_type: mime, data: b64 } })
      } catch { continue }
    }

    if (imageParts.length === 0) return null

    const textSnippet = bodyText.slice(0, 1500)

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: [
          ...imageParts,
          {
            type: 'text',
            text: `이 이미지들은 한국 암호화폐 거래소 이벤트 공지의 본문 이미지입니다.
공지 제목: ${title}
공지 텍스트(일부): ${textSnippet}

아래 항목을 이미지와 텍스트에서 파악해 JSON만 응답하세요 (설명 없이 JSON만):
{
  "coin": "코인 티커 코드(예: BTC, SPACE, ETH) 또는 null",
  "amount": "지급 금액/수량 요약(예: '1위 200,000 SPACE') 또는 null",
  "rewardDate": "혜택·리워드 지급일 YYYY-MM-DD 또는 null",
  "requireApply": true 또는 false,
  "apiAllowed": true 또는 false
}

판단 기준:
- requireApply: 이벤트 코드 등록, 사전 신청, 응모 등이 필요하면 true
- apiAllowed: "API를 통한 거래는 제외" 등 문구가 있으면 false, 언급 없으면 true`,
          },
        ],
      }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null

    const raw = JSON.parse(jsonMatch[0])
    return {
      coin:         typeof raw.coin === 'string'         ? raw.coin         : null,
      amount:       typeof raw.amount === 'string'       ? raw.amount       : null,
      rewardDate:   typeof raw.rewardDate === 'string'   ? raw.rewardDate   : null,
      requireApply: typeof raw.requireApply === 'boolean' ? raw.requireApply : undefined,
      apiAllowed:   typeof raw.apiAllowed === 'boolean'   ? raw.apiAllowed   : undefined,
    }
  } catch (err) {
    console.error('[crawl-preview] Claude Vision 실패:', err instanceof Error ? err.message : err)
    return null
  }
}

// ═══════════════════════════════════════════════════════════════
// 이미지 URL 추출
// ═══════════════════════════════════════════════════════════════

/**
 * HTML에서 공지 본문 이미지 URL 추출
 * - <img src="..."> 태그
 * - RSC 페이로드의 S3/CDN 이미지 URL
 */
function extractImageUrls(html: string): string[] {
  const seen = new Set<string>()

  // 1. <img src="..."> 태그
  for (const m of html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)) {
    const u = m[1]
    if (u.startsWith('http') && /\.(png|jpe?g|webp)(\?|$)/i.test(u)) seen.add(u)
  }

  // 2. HTML 내 절대 이미지 URL (RSC 페이로드 포함, 이스케이프 해제)
  for (const m of html.matchAll(/https?:\\?\/\\?\/[^\s"'<>\\]+?\.(png|jpe?g|webp)/gi)) {
    seen.add(m[0].replace(/\\\//g, '/'))
  }

  // 3. 첫 번째 URL(썸네일)은 제외 (주로 메인 배너 — 정보가 없음)
  const urls = [...seen]
  return urls.length > 1 ? urls.slice(1) : urls
}

// ═══════════════════════════════════════════════════════════════
// RSC eventPeriod 추출
// ═══════════════════════════════════════════════════════════════

function extractRscEventPeriod(html: string): { startDate: string | null; endDate: string | null } | null {
  const escapedPat = /\\"eventPeriod\\":\{\\"startDate\\":\\"(?:\\\$D|\$D)([\dT:.Z-]+)\\",\\"endDate\\":\\"(?:\\\$D|\$D)([\dT:.Z-]+)\\"/
  const m = html.match(escapedPat)
  if (m) return { startDate: utcIsoToKstDate(m[1]), endDate: utcIsoToKstDate(m[2]) }

  const normalPat = /"eventPeriod":\{"startDate":"(?:\$D)?([\dT:.Z-]+)","endDate":"(?:\$D)?([\dT:.Z-]+)"/
  const m2 = html.match(normalPat)
  if (m2) return { startDate: utcIsoToKstDate(m2[1]), endDate: utcIsoToKstDate(m2[2]) }

  return null
}

function utcIsoToKstDate(iso: string): string | null {
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return null
    const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
    const y = kst.getUTCFullYear()
    const mo = String(kst.getUTCMonth() + 1).padStart(2, '0')
    const da = String(kst.getUTCDate()).padStart(2, '0')
    return `${y}-${mo}-${da}`
  } catch { return null }
}

// ═══════════════════════════════════════════════════════════════
// HTML → 텍스트
// ═══════════════════════════════════════════════════════════════

function extractTextFromHtml(html: string): string {
  let extra = ''
  const nd = html.match(/<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i)
  if (nd) {
    try { extra = flattenJsonToText(JSON.parse(nd[1])) }
    catch { extra = nd[1].replace(/\\[ntr]/g, ' ') }
  }
  const body = stripHtmlTags(
    html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
  )
  return `${body} ${extra}`
}

function stripHtmlTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ').trim()
}

function flattenJsonToText(value: unknown): string {
  if (typeof value === 'string') return `${value} `
  if (Array.isArray(value)) return value.map(flattenJsonToText).join('')
  if (value && typeof value === 'object')
    return Object.values(value as Record<string, unknown>).map(flattenJsonToText).join('')
  return ''
}

// ═══════════════════════════════════════════════════════════════
// 텍스트 정규식 추출 함수들 (Claude Vision 실패 시 폴백)
// ═══════════════════════════════════════════════════════════════

function extractCoinFromTitle(title: string): string | null {
  // 패턴 1: 괄호 안 코인 코드 — 비트코인(BTC)
  const parenMatch = title.match(/\(([A-Z]{2,10})\)/)
  if (parenMatch) return parenMatch[1]

  // 패턴 2: 수량 뒤 코인 코드 — 4,200,000 SPACE
  const amountCoin = title.match(/[\d,]+\s+([A-Z]{2,10})(?:\s|$)/)
  if (amountCoin) return amountCoin[1]

  // 패턴 3: 이벤트 키워드 앞 코인 코드 — SPACE 에어드랍, BTC 스테이킹
  const eventCoin = title.match(/([A-Z]{2,10})\s+(?:에어드랍|이벤트|스테이킹|런치패드|거래지원|입출금|거래소)/)
  if (eventCoin) return eventCoin[1]

  // 패턴 4: 숫자 없이 단독 대문자 토큰 — "[SPACE] 이벤트" 형태
  const bracketCoin = title.match(/\[([A-Z]{2,10})\]/)
  if (bracketCoin) return bracketCoin[1]

  return null
}

function extractAmount(text: string, title?: string): string | null {
  // 우선: 제목에서 코인 수량 추출 — "총 4,200,000 SPACE" 형태
  if (title) {
    const coinQty = title.match(/(?:총\s*)?([\d,]+(?:\.\d+)?)\s+([A-Z]{2,10})(?:\s|$)/)
    if (coinQty) return `${coinQty[1]} ${coinQty[2]}`
  }

  // 본문에서도 코인 수량 탐색 — "N,NNN TICKER 에어드랍"
  const bodyQty = text.match(/([\d,]{4,})\s+([A-Z]{2,10})\s+(?:에어드랍|지급|보상|리워드)/)
  if (bodyQty) return `${bodyQty[1]} ${bodyQty[2]}`

  // KRW 금액 추출 (기존 로직)
  let maxAmount = 0
  for (const m of text.matchAll(/(\d+)\s*만\s*원/g))
    maxAmount = Math.max(maxAmount, parseInt(m[1]) * 10000)
  for (const m of text.matchAll(/(\d{1,3}(?:,\d{3})+)\s*원/g))
    maxAmount = Math.max(maxAmount, parseInt(m[1].replace(/,/g, '')))
  for (const m of text.matchAll(/\b(\d{5,})\s*원/g))
    maxAmount = Math.max(maxAmount, parseInt(m[1]))
  if (maxAmount >= 100000) return '10만원(일일)'
  if (maxAmount >= 10000) return '1만원(일일)'
  return null
}

function extractRewardDate(text: string): string | null {
  const keywordPat = /(?:혜택\s*지급일|리워드\s*지급일|지급\s*예정일|지급일|보상\s*지급일)\s*[:：]?\s*(\d{4}\s*[.년/-]\s*\d{1,2}\s*[.월/-]\s*\d{1,2})/
  const m = text.match(keywordPat)
  if (m) {
    const parts = m[1].match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/)
    if (parts) return `${parts[1]}-${parts[2].padStart(2, '0')}-${parts[3].padStart(2, '0')}`
  }
  return null
}

function extractDateRange(text: string): { startDate: string | null; endDate: string | null } {
  function toISODate(raw: string): string | null {
    const m = raw.match(/(\d{4})\D+?(\d{1,2})\D+?(\d{1,2})/)
    if (!m) return null
    const y = m[1], mo = m[2].padStart(2, '0'), d = m[3].padStart(2, '0')
    const dt = new Date(`${y}-${mo}-${d}`)
    if (isNaN(dt.getTime()) || dt.getFullYear() < 2020 || dt.getFullYear() > 2030) return null
    return `${y}-${mo}-${d}`
  }
  const dateToken = /\d{4}\s*[.년]\s*\d{1,2}\s*[.월]\s*\d{1,2}(?:\s*\([월화수목금토일]\))?(?:\s+\d{1,2}:\d{2})?/
  const rangePat = new RegExp(`(${dateToken.source})\\s*[~～]\\s*(${dateToken.source})`, 'g')
  for (const m of text.matchAll(rangePat)) {
    const s = toISODate(m[1]), e = toISODate(m[2])
    if (s && e) return { startDate: s, endDate: e }
  }
  const dates: string[] = []
  for (const m of text.matchAll(/\d{4}\s*[.년]\s*\d{1,2}\s*[.월]\s*\d{1,2}/g)) {
    const d = toISODate(m[0]); if (d) dates.push(d)
  }
  const unique = [...new Set(dates)].sort()
  if (unique.length === 0) return { startDate: null, endDate: null }
  if (unique.length === 1) return { startDate: unique[0], endDate: unique[0] }
  return { startDate: unique[0], endDate: unique[unique.length - 1] }
}

function extractRequireApply(text: string): boolean {
  return /이벤트\s*코드|코드\s*등록|코드\s*입력|사전\s*신청|신청\s*필요|응모\s*신청|이벤트\s*응모/.test(text)
}

function extractApiAllowed(text: string): boolean {
  return !/API를?\s*통한?\s*거래는?\s*혜택\s*지급\s*대상에서\s*제외|API\s*이벤트\s*제외/.test(text)
}
