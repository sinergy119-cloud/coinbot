/**
 * 코인원 공지사항 크롤러 (HTML 파싱)
 * 대상 URL: https://coinone.co.kr/info/notice/
 *
 * ⚠️ 코인원은 공식 API가 없어 HTML을 파싱합니다.
 *    사이트 구조 변경 시 정규식/선택자를 수정하세요.
 *
 * 날짜 필터: __NEXT_DATA__에서 날짜를 추출할 수 있으면 12시간 필터 적용
 *            날짜 파싱 불가 시 source_id 중복 제거(DB upsert)에 의존
 */

import { matchesKeyword, Keywords } from './keywords'
import { withRetry } from './retry'

const NOTICE_URL = 'https://coinone.co.kr/info/notice/'
const BASE_URL = 'https://coinone.co.kr'

export interface CrawledItem {
  exchange: string
  sourceId: string
  title: string
  url: string | null
}

export async function crawlCoinone(keywords: Keywords, since: Date): Promise<CrawledItem[]> {
  const res = await withRetry(
    () =>
      fetch(NOTICE_URL, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; MyCoinBot-Crawler/1.0)',
          'Accept': 'text/html',
        },
        signal: AbortSignal.timeout(15_000),
      }).then((r) => {
        if (!r.ok) throw new Error(`코인원 공지 페이지 오류: ${r.status}`)
        return r
      }),
    { label: 'COINONE' },
  )

  const html = await res.text()
  const results: CrawledItem[] = []

  // 방법 1: __NEXT_DATA__ 파싱 (날짜 포함 가능)
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
  if (nextDataMatch) {
    try {
      const nextData = JSON.parse(nextDataMatch[1])
      const notices =
        nextData?.props?.pageProps?.notices ??
        nextData?.props?.pageProps?.data?.notices ??
        nextData?.props?.pageProps?.list ??
        []
      if (Array.isArray(notices) && notices.length > 0) {
        return notices
          .filter((n: { title?: string; created_at?: string; createdAt?: string; regDate?: string }) => {
            // 날짜 필터
            const dateStr = n.created_at ?? n.createdAt ?? n.regDate
            if (dateStr) {
              const posted = new Date(dateStr)
              if (!isNaN(posted.getTime()) && posted < since) return false
            }
            return matchesKeyword(n.title ?? '', keywords)
          })
          .map((n: { id?: string | number; title?: string; slug?: string }) => ({
            exchange: 'COINONE',
            sourceId: String(n.id ?? n.slug ?? ''),
            title: String(n.title ?? ''),
            url: n.id ? `${BASE_URL}/info/notice/${n.id}` : null,
          }))
      }
    } catch {
      // JSON 파싱 실패 → HTML 정규식 폴백
    }
  }

  // 방법 2: HTML 정규식 파싱
  const linkPattern = /href="(\/info\/notice\/(\d+)[^"]*)">([^<]+)</g
  let match
  while ((match = linkPattern.exec(html)) !== null) {
    const path = match[1]
    const id = match[2]
    const title = match[3].trim()
    if (!title || !matchesKeyword(title, keywords)) continue
    if (results.some((r) => r.sourceId === id)) continue
    results.push({
      exchange: 'COINONE',
      sourceId: id,
      title,
      url: `${BASE_URL}${path}`,
    })
  }

  return results
}
