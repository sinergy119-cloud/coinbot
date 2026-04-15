/**
 * /api/admin/crawl-preview — 이벤트 URL 크롤링 후 코인·금액·기간 자동 추출 (관리자 전용)
 *
 * GET ?url=<이벤트URL>&title=<제목>
 * Returns { coin, amount, startDate, endDate }
 *
 * 거래소별 전략:
 *   GOPAX  → api.gopax.co.kr/notices/{id} (REST API, content 필드 포함)
 *   기타   → HTML 페치 + __NEXT_DATA__ 우선 파싱
 */

import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { isAdmin } from '@/lib/admin'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session || !isAdmin(session.loginId)) {
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

  // 1. 제목에서 코인 코드 추출
  const coin = extractCoinFromTitle(title)

  // 2. 본문 텍스트 추출 (거래소별 전략)
  const bodyText = await fetchBodyText(parsedUrl)

  const amount = extractAmount(bodyText)
  const { startDate, endDate } = extractDateRange(bodyText)
  const rewardDate = extractRewardDate(bodyText)

  return Response.json({ coin, amount, startDate, endDate, rewardDate })
}

// ═══════════════════════════════════════════════════════════════
// 본문 텍스트 추출 — 거래소별 전략
// ═══════════════════════════════════════════════════════════════

async function fetchBodyText(url: URL): Promise<string> {
  // ── GOPAX: api.gopax.co.kr/notices/{id} 직접 호출
  if (url.hostname.includes('gopax.co.kr')) {
    const m = url.pathname.match(/\/notice\/(\d+)/)
    if (m) {
      const text = await fetchGopaxNotice(m[1])
      if (text) return text
    }
  }

  // ── 기타 거래소: HTML 페치 + __NEXT_DATA__ 우선 파싱
  return fetchHtmlText(url.toString())
}

/**
 * GOPAX 공지 본문 가져오기
 * - /notices/{id} 엔드포인트는 존재하지 않음
 * - /notices?type=0&limit=N&page=P 목록에서 ID 검색
 */
async function fetchGopaxNotice(noticeId: string): Promise<string> {
  // page 0, 1 순서로 검색 (최근 공지는 page 0에 존재)
  for (const page of [0, 1]) {
    try {
      const res = await fetch(
        `https://api.gopax.co.kr/notices?type=0&limit=50&page=${page}`,
        {
          headers: { 'User-Agent': 'MyCoinBot-Crawler/1.0', Accept: 'application/json' },
          signal: AbortSignal.timeout(8000),
        },
      )
      if (!res.ok) break
      const list = await res.json()
      if (!Array.isArray(list)) break

      const found = list.find(
        (item: { id?: number | string }) => String(item.id) === noticeId,
      )
      if (found) {
        const raw = `${found.title ?? ''} ${found.content ?? ''}`
        return stripHtmlTags(raw)
      }

      // 결과가 50개 미만이면 다음 페이지 없음
      if (list.length < 50) break
    } catch {
      break
    }
  }
  return ''
}

/** HTML 페치 → __NEXT_DATA__ 우선, 없으면 body 텍스트 */
async function fetchHtmlText(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'ko-KR,ko;q=0.9',
      },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return ''
    const html = await res.text()
    return extractTextFromHtml(html)
  } catch {
    return ''
  }
}

/**
 * HTML → 순수 텍스트
 * 1) __NEXT_DATA__ JSON 먼저 평탄화 (Next.js 사이트 대응)
 * 2) 나머지 HTML body 텍스트
 */
function extractTextFromHtml(html: string): string {
  let extra = ''

  const nextDataMatch = html.match(
    /<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i,
  )
  if (nextDataMatch) {
    try {
      const parsed = JSON.parse(nextDataMatch[1])
      extra = flattenJsonToText(parsed)
    } catch {
      extra = nextDataMatch[1].replace(/\\[ntr]/g, ' ')
    }
  }

  const bodyText = stripHtmlTags(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' '),
  )

  return `${bodyText} ${extra}`
}

/** HTML 태그·엔티티 제거 → 순수 텍스트 */
function stripHtmlTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

/** JSON 값을 재귀 평탄화 — 문자열 값만 이어붙임 */
function flattenJsonToText(value: unknown): string {
  if (typeof value === 'string') return `${value} `
  if (Array.isArray(value)) return value.map(flattenJsonToText).join('')
  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>)
      .map(flattenJsonToText)
      .join('')
  }
  return ''
}

// ═══════════════════════════════════════════════════════════════
// 코인 코드 추출
// ═══════════════════════════════════════════════════════════════

/** 제목에서 괄호 안 대문자 코인 코드 추출 — 헤이엘사(ELSA) → ELSA */
function extractCoinFromTitle(title: string): string | null {
  const matches = [...title.matchAll(/\(([A-Z]{2,10})\)/g)]
  return matches.length > 0 ? matches[0][1] : null
}

// ═══════════════════════════════════════════════════════════════
// 금액 추출
// ═══════════════════════════════════════════════════════════════

/**
 * 일일 에어드랍 금액 추출
 *   최대 금액 기준으로 임계치 적용:
 *   ≥ 100,000원 → "10만원(일일)"
 *   ≥  10,000원 →  "1만원(일일)"
 */
function extractAmount(text: string): string | null {
  let maxAmount = 0

  // N만원 / N만 원 (예: 10만원 = 100,000 / 100만 원 = 1,000,000)
  for (const m of text.matchAll(/(\d+)\s*만\s*원/g)) {
    maxAmount = Math.max(maxAmount, parseInt(m[1]) * 10000)
  }

  // 콤마 숫자 + 원 (예: 100,000원)
  for (const m of text.matchAll(/(\d{1,3}(?:,\d{3})+)\s*원/g)) {
    maxAmount = Math.max(maxAmount, parseInt(m[1].replace(/,/g, '')))
  }

  // 5자리 이상 숫자 + 원 (예: 10000원)
  for (const m of text.matchAll(/\b(\d{5,})\s*원/g)) {
    maxAmount = Math.max(maxAmount, parseInt(m[1]))
  }

  if (maxAmount >= 100000) return '10만원(일일)'
  if (maxAmount >= 10000) return '1만원(일일)'
  return null
}

// ═══════════════════════════════════════════════════════════════
// 리워드 지급일 추출
// ═══════════════════════════════════════════════════════════════

/**
 * 리워드 지급일 추출
 * 패턴 예: "리워드 지급일: 2026.05.15(금)", "지급일: 2026.05.15", "지급 예정일 2026.05.15"
 */
function extractRewardDate(text: string): string | null {
  const keywordPat = /(?:리워드\s*지급일|지급\s*예정일|지급일|보상\s*지급일)\s*[:：]?\s*(\d{4}[.년/-]\d{1,2}[.월/-]\d{1,2})/
  const m = text.match(keywordPat)
  if (m) {
    const raw = m[1]
    const parts = raw.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/)
    if (parts) {
      return `${parts[1]}-${parts[2].padStart(2, '0')}-${parts[3].padStart(2, '0')}`
    }
  }
  return null
}

// ═══════════════════════════════════════════════════════════════
// 날짜 범위 추출
// ═══════════════════════════════════════════════════════════════

/**
 * 이벤트 기간(시작일/종료일) 추출
 *
 * 우선순위:
 *   1. 범위 패턴: "YYYY.MM.DD(요일) HH:MM ~ YYYY.MM.DD(요일) HH:MM"
 *   2. 개별 날짜 목록에서 min/max
 */
function extractDateRange(text: string): { startDate: string | null; endDate: string | null } {
  /** "2026.04.14(화) 16:00" → "2026-04-14" */
  function toISODate(raw: string): string | null {
    const m = raw.match(/(\d{4})\D+?(\d{1,2})\D+?(\d{1,2})/)
    if (!m) return null
    const y = m[1], mo = m[2].padStart(2, '0'), d = m[3].padStart(2, '0')
    const dt = new Date(`${y}-${mo}-${d}`)
    if (isNaN(dt.getTime()) || dt.getFullYear() < 2020 || dt.getFullYear() > 2030) return null
    return `${y}-${mo}-${d}`
  }

  // 날짜 토큰 정규식 (요일, 시간 모두 선택적)
  //   2026.04.14          ← 기본
  //   2026.04.14(화)      ← + 요일
  //   2026.04.14(화) 16:00 ← + 시간
  const dateToken =
    /\d{4}\s*[.년]\s*\d{1,2}\s*[.월]\s*\d{1,2}(?:\s*\([월화수목금토일]\))?(?:\s+\d{1,2}:\d{2})?/

  // ① 범위 패턴 우선
  const rangeSource = dateToken.source
  const rangePat = new RegExp(`(${rangeSource})\\s*[~～]\\s*(${rangeSource})`, 'g')

  for (const m of text.matchAll(rangePat)) {
    const s = toISODate(m[1])
    const e = toISODate(m[2])
    if (s && e) return { startDate: s, endDate: e }
  }

  // ② 개별 날짜 수집 후 min/max
  const singlePat = /\d{4}\s*[.년]\s*\d{1,2}\s*[.월]\s*\d{1,2}/g
  const dates: string[] = []
  for (const m of text.matchAll(singlePat)) {
    const d = toISODate(m[0])
    if (d) dates.push(d)
  }

  const unique = [...new Set(dates)].sort()
  if (unique.length === 0) return { startDate: null, endDate: null }
  if (unique.length === 1) return { startDate: unique[0], endDate: unique[0] }
  return { startDate: unique[0], endDate: unique[unique.length - 1] }
}
