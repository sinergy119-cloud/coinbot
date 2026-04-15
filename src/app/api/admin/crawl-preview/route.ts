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

/** HTML → 순수 텍스트 (태그 제거, 공백 정리) */
function extractTextFromHtml(html: string): string {
  // script/style 블록 먼저 제거
  let text = html
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
  return text
}

/**
 * 일일 에어드랍 금액 추출
 * - 최대 금액 기준으로 임계치 적용:
 *   ≥ 100,000원 → "10만원(일일)"
 *   ≥  10,000원 → "1만원(일일)"
 */
function extractAmount(text: string): string | null {
  let maxAmount = 0

  // Pattern 1: N만원 → N * 10000 (예: 10만원 = 100000)
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
 *   1. "YYYY.MM.DD ~ YYYY.MM.DD" 형태의 범위
 *   2. 개별 날짜 목록에서 최소/최대
 */
function extractDateRange(text: string): { startDate: string | null; endDate: string | null } {
  // 날짜 파싱 헬퍼
  function parseDate(raw: string): string | null {
    // YYYY.MM.DD / YYYY년 MM월 DD일 / YYYY. MM. DD 등
    const m = raw.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/)
    if (!m) return null
    const y = m[1]
    const mo = m[2].padStart(2, '0')
    const d = m[3].padStart(2, '0')
    const dt = new Date(`${y}-${mo}-${d}`)
    if (isNaN(dt.getTime())) return null
    // 범위 검증: 2020 ~ 2030
    if (dt.getFullYear() < 2020 || dt.getFullYear() > 2030) return null
    return `${y}-${mo}-${d}`
  }

  // 날짜 패턴 (YYYY로 시작하는 날짜)
  const datePat = /\d{4}\s*[.년]\s*\d{1,2}\s*[.월]\s*\d{1,2}/g

  // ① 범위 패턴 우선: date1 ~ date2
  const rangePat = /(\d{4}\s*[.년]\s*\d{1,2}\s*[.월]\s*\d{1,2}(?:\s*\([월화수목금토일]\))?)\s*[~～\-]\s*(\d{4}\s*[.년]\s*\d{1,2}\s*[.월]\s*\d{1,2}(?:\s*\([월화수목금토일]\))?)/g

  for (const m of text.matchAll(rangePat)) {
    const s = parseDate(m[1])
    const e = parseDate(m[2])
    if (s && e) return { startDate: s, endDate: e }
  }

  // ② 개별 날짜 수집 후 min/max
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
