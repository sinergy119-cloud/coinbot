/**
 * /api/admin/crawl-preview — 이벤트 URL을 크롤링해 코인·금액·기간 자동 추출 (관리자 전용)
 *
 * GET ?url=<이벤트URL>&title=<제목>
 * Returns { coin, amount, startDate, endDate }
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

  // URL 검증
  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return Response.json({ error: '유효하지 않은 URL' }, { status: 400 })
    }
  } catch {
    return Response.json({ error: '유효하지 않은 URL' }, { status: 400 })
  }

  // 제목에서 코인 코드 추출 — (ELSA), (BTC) 형태
  const coin = extractCoinFromTitle(title)

  // 페이지 HTML 가져오기
  let bodyText = ''
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(parsedUrl.toString(), {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'ko-KR,ko;q=0.9',
      },
    })
    clearTimeout(timeout)

    if (res.ok) {
      const html = await res.text()
      bodyText = extractTextFromHtml(html)
    }
  } catch {
    // URL 페치 실패 시 빈 텍스트로 진행
  }

  const amount = extractAmount(bodyText)
  const { startDate, endDate } = extractDateRange(bodyText)

  return Response.json({ coin, amount, startDate, endDate })
}

// ── 헬퍼 함수들 ───────────────────────────────────────────────

/** 제목에서 괄호 안 대문자 코인 코드 추출 — 예: 헤이엘사(ELSA) → ELSA */
function extractCoinFromTitle(title: string): string | null {
  const matches = [...title.matchAll(/\(([A-Z]{2,10})\)/g)]
  if (matches.length === 0) return null
  return matches[0][1]
}

/**
 * HTML → 순수 텍스트
 * 전략:
 *   1) __NEXT_DATA__ (script JSON) 에서 먼저 텍스트 추출 → GOPAX·코인원·코빗 등 Next.js 사이트
 *   2) 나머지 script/style 제거 후 HTML 태그 제거
 *   두 결과를 이어붙여 반환
 */
function extractTextFromHtml(html: string): string {
  let extra = ''

  // ① __NEXT_DATA__ JSON 추출 — script 태그 제거 전에 실행
  const nextDataMatch = html.match(
    /<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i,
  )
  if (nextDataMatch) {
    try {
      // JSON 파싱 후 전체를 평탄화된 문자열로 변환 (모든 값이 검색 대상이 됨)
      const parsed = JSON.parse(nextDataMatch[1])
      extra = flattenJsonToText(parsed)
    } catch {
      // 파싱 실패 시 raw 문자열 그대로 사용 (이스케이프 해제)
      extra = nextDataMatch[1]
        .replace(/\\n/g, ' ')
        .replace(/\\t/g, ' ')
        .replace(/\\r/g, ' ')
        .replace(/\\u[\da-f]{4}/gi, '')
    }
  }

  // ② 일반 HTML → 텍스트
  const bodyText = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()

  return `${bodyText} ${extra}`
}

/** JSON 객체/배열을 재귀적으로 순회하며 문자열 값만 이어붙임 */
function flattenJsonToText(value: unknown): string {
  if (typeof value === 'string') return value + ' '
  if (Array.isArray(value)) return value.map(flattenJsonToText).join(' ')
  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).map(flattenJsonToText).join(' ')
  }
  return ''
}

/**
 * 일일 에어드랍 금액 추출
 * 최대 금액 기준으로 임계치 적용:
 *   ≥ 100,000원 → "10만원(일일)"
 *   ≥  10,000원 →  "1만원(일일)"
 */
function extractAmount(text: string): string | null {
  let maxAmount = 0

  // Pattern 1: N만 원 / N만원 (예: 10만원 = 100,000 / 100만 원 = 1,000,000)
  for (const m of text.matchAll(/(\d+)\s*만\s*원/g)) {
    maxAmount = Math.max(maxAmount, parseInt(m[1]) * 10000)
  }

  // Pattern 2: 콤마 포함 숫자 + 원 (예: 100,000원)
  for (const m of text.matchAll(/(\d{1,3}(?:,\d{3})+)\s*원/g)) {
    const val = parseInt(m[1].replace(/,/g, ''))
    maxAmount = Math.max(maxAmount, val)
  }

  // Pattern 3: 5자리 이상 숫자 + 원 (예: 10000원)
  for (const m of text.matchAll(/\b(\d{5,})\s*원/g)) {
    maxAmount = Math.max(maxAmount, parseInt(m[1]))
  }

  if (maxAmount >= 100000) return '10만원(일일)'
  if (maxAmount >= 10000) return '1만원(일일)'
  return null
}

/**
 * 텍스트에서 이벤트 기간(시작일/종료일) 추출
 * 우선순위:
 *   1. "YYYY.MM.DD(요일) HH:MM ~ YYYY.MM.DD(요일) HH:MM" 형태 범위
 *   2. 개별 날짜 목록에서 최소/최대
 */
function extractDateRange(text: string): { startDate: string | null; endDate: string | null } {
  /** "2026.04.14(화) 16:00" 같은 날짜 원시 문자열 → "2026-04-14" */
  function parseDate(raw: string): string | null {
    const m = raw.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/)
    if (!m) return null
    const y = m[1]
    const mo = m[2].padStart(2, '0')
    const d = m[3].padStart(2, '0')
    const dt = new Date(`${y}-${mo}-${d}`)
    if (isNaN(dt.getTime())) return null
    if (dt.getFullYear() < 2020 || dt.getFullYear() > 2030) return null
    return `${y}-${mo}-${d}`
  }

  /**
   * 날짜 토큰: YYYY.MM.DD 에 선택적으로 (요일), HH:MM 까지 허용
   * 예: 2026.04.14(화) 16:00
   */
  const D = String.raw`\d{4}\s*[.년]\s*\d{1,2}\s*[.월]\s*\d{1,2}(?:\s*\([월화수목금토일]\))?(?:\s+\d{1,2}:\d{2})?`

  // ① 범위 패턴 우선: date1 ~ date2
  const rangePat = new RegExp(`(${D})\\s*[~～]\\s*(${D})`, 'g')

  for (const m of text.matchAll(rangePat)) {
    const s = parseDate(m[1])
    const e = parseDate(m[2])
    if (s && e) return { startDate: s, endDate: e }
  }

  // ② 개별 날짜 수집 후 min/max
  const datePat = /\d{4}\s*[.년]\s*\d{1,2}\s*[.월]\s*\d{1,2}/g
  const dates: string[] = []
  for (const m of text.matchAll(datePat)) {
    const d = parseDate(m[0])
    if (d) dates.push(d)
  }
  const unique = [...new Set(dates)].sort()
  if (unique.length === 0) return { startDate: null, endDate: null }
  if (unique.length === 1) return { startDate: unique[0], endDate: unique[0] }
  return { startDate: unique[0], endDate: unique[unique.length - 1] }
}
