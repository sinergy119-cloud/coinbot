/**
 * 코빗 공지사항 크롤러 (HTML 파싱)
 * 대상 URL: https://www.korbit.co.kr/support/notices
 *
 * ⚠️ 코빗은 공식 API가 없어 HTML을 파싱합니다.
 *    사이트 구조 변경 시 정규식/선택자를 수정하세요.
 */

import { matchesKeyword, Keywords } from './keywords'
import { withRetry } from './retry'

const NOTICE_URL = 'https://www.korbit.co.kr/support/notices'
const BASE_URL = 'https://www.korbit.co.kr'

export interface CrawledItem {
  exchange: string
  sourceId: string
  title: string
  url: string | null
}

export async function crawlKorbit(keywords: Keywords, since: Date): Promise<CrawledItem[]> {
  const res = await withRetry(
    () =>
      fetch(NOTICE_URL, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; MyCoinBot-Crawler/1.0)',
          'Accept': 'text/html',
        },
        signal: AbortSignal.timeout(15_000),
      }).then((r) => {
        if (!r.ok) throw new Error(`코빗 공지 페이지 오류: ${r.status}`)
        return r
      }),
    { label: 'KORBIT' },
  )

  const html = await res.text()
  const results: CrawledItem[] = []

  // 방법 1: __NEXT_DATA__ 파싱
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
  if (nextDataMatch) {
    try {
      const nextData = JSON.parse(nextDataMatch[1])
      const notices =
        nextData?.props?.pageProps?.notices ??
        nextData?.props?.pageProps?.data ??
        nextData?.props?.pageProps?.list ??
        []
      if (Array.isArray(notices) && notices.length > 0) {
        return notices
          .filter((n: { title?: string; subject?: string; created_at?: string; createdAt?: string; regDate?: string }) => {
            const dateStr = n.created_at ?? n.createdAt ?? n.regDate
            if (dateStr) {
              const posted = new Date(dateStr)
              if (!isNaN(posted.getTime()) && posted < since) return false
            }
            return matchesKeyword(n.title ?? n.subject ?? '', keywords)
          })
          .map((n: { id?: string | number; title?: string; subject?: string; slug?: string }) => {
            const title = String(n.title ?? n.subject ?? '')
            const id = String(n.id ?? n.slug ?? '')
            return {
              exchange: 'KORBIT',
              sourceId: id,
              title,
              url: id ? `${BASE_URL}/support/notices/${id}` : null,
            }
          })
      }
    } catch {
      // 폴백
    }
  }

  // 방법 2: HTML 정규식
  const linkPattern = /href="(\/support\/notices\/(\d+)[^"]*)">([^<]+)</g
  let match
  while ((match = linkPattern.exec(html)) !== null) {
    const path = match[1]
    const id = match[2]
    const title = match[3].trim()
    if (!title || !matchesKeyword(title, keywords)) continue
    if (results.some((r) => r.sourceId === id)) continue
    results.push({
      exchange: 'KORBIT',
      sourceId: id,
      title,
      url: `${BASE_URL}${path}`,
    })
  }

  return results
}
