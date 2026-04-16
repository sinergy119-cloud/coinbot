/**
 * 코인원 공지사항 크롤러 (HTML 파싱)
 * 대상 URL: https://coinone.co.kr/info/notice/
 *
 * ⚠️ 코인원은 공식 API가 없어 HTML을 파싱합니다.
 *    2026-04 기준: 코인원이 Next.js RSC(React Server Components) 스트리밍으로
 *    전환되어 `__NEXT_DATA__` 스크립트가 사라지고, 대신 HTML 안에
 *    escape된 JSON 페이로드가 인라인 문자열로 포함됨.
 *    예) {\"id\":5320,\"category\":\"이벤트\",...,\"title\":\"[...]\",
 *        \"exposedAt\":\"$D2026-04-16T01:00:00.000Z\"...}
 *
 *    사이트 구조 변경 시 정규식을 수정하세요.
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

// RSC 페이로드 내 JSON 문자열에서 \"(backslash+quote) → " 등으로 언이스케이프
function unescapeRscString(s: string): string {
  return s
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
    .replace(/\\n/g, '\n')
    .replace(/\\\//g, '/')
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
}

export async function crawlCoinone(keywords: Keywords, since: Date, until?: Date): Promise<CrawledItem[]> {
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
  const seen = new Set<string>()

  // RSC 페이로드 내 이스케이프된 JSON 블록을 매칭
  //   시작: \"id\":숫자,\"category\":\"카테고리\"
  //   끝:   \"exposedAt\":\"$D날짜\"
  //   사이 거리: 최대 3000자 (안전 마진)
  const blockPattern =
    /\\"id\\":(\d+),\\"category\\":\\"([^"\\]+)\\"[\s\S]{0,3000}?\\"exposedAt\\":\\"\$D(\d{4}-\d{2}-\d{2}T[\d:.]+Z)\\"/g

  let match
  while ((match = blockPattern.exec(html)) !== null) {
    const id = match[1]
    const exposedAt = match[3]
    const block = match[0]

    if (seen.has(id)) continue

    // 블록 내에서 title 추출
    const titleMatch = block.match(/\\"title\\":\\"((?:[^"\\]|\\.)*?)\\"/)
    if (!titleMatch) continue
    const title = unescapeRscString(titleMatch[1]).trim()
    if (!title) continue

    // 날짜 필터 (exposedAt 기준)
    const posted = new Date(exposedAt)
    if (!isNaN(posted.getTime())) {
      if (posted < since) continue
      if (until && posted >= until) continue
    }

    if (!matchesKeyword(title, keywords)) continue

    seen.add(id)
    results.push({
      exchange: 'COINONE',
      sourceId: id,
      title,
      url: `${BASE_URL}/info/notice/${id}`,
    })
  }

  return results
}
