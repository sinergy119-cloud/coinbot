/**
 * 코인원 공지사항 크롤러 (HTML 파싱)
 * 대상 URL: https://coinone.co.kr/info/notice/
 *
 * ⚠️ 코인원은 공식 API가 없어 HTML을 파싱합니다.
 *    사이트 구조 변경 시 정규식/선택자를 수정하세요.
 */

import { matchesKeyword } from './keywords'

const NOTICE_URL = 'https://coinone.co.kr/info/notice/'
const BASE_URL = 'https://coinone.co.kr'

export interface CrawledItem {
  exchange: string
  sourceId: string
  title: string
  url: string | null
}

export async function crawlCoinone(): Promise<CrawledItem[]> {
  const res = await fetch(NOTICE_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; MyCoinBot-Crawler/1.0)',
      'Accept': 'text/html',
    },
    signal: AbortSignal.timeout(15_000),
  })

  if (!res.ok) {
    throw new Error(`코인원 공지 페이지 오류: ${res.status}`)
  }

  const html = await res.text()
  const results: CrawledItem[] = []

  // ⚠️ 아래 정규식은 코인원 HTML 구조에 맞게 작성되었습니다.
  //    구조 변경 시 다음 패턴을 조정하세요:
  //    - <a href="/info/notice/ID"> 또는 <a href="/info/notice/ID/">
  //    - 제목은 태그 내 텍스트

  // 방법 1: JSON-LD 또는 Next.js __NEXT_DATA__ 에서 추출 시도
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
  if (nextDataMatch) {
    try {
      const nextData = JSON.parse(nextDataMatch[1])
      // 공지 목록이 있는 경우 props.pageProps 탐색
      const notices =
        nextData?.props?.pageProps?.notices ??
        nextData?.props?.pageProps?.data?.notices ??
        nextData?.props?.pageProps?.list ??
        []
      if (Array.isArray(notices) && notices.length > 0) {
        return notices
          .filter((n: { title?: string }) => matchesKeyword(n.title ?? ''))
          .map((n: { id?: string | number; title?: string; slug?: string }) => ({
            exchange: 'COINONE',
            sourceId: String(n.id ?? n.slug ?? ''),
            title: String(n.title ?? ''),
            url: n.id ? `${BASE_URL}/info/notice/${n.id}` : null,
          }))
      }
    } catch {
      // JSON 파싱 실패 → HTML 정규식 방법으로 폴백
    }
  }

  // 방법 2: HTML 정규식 파싱
  // <a href="/info/notice/12345">제목</a> 패턴
  const linkPattern = /href="(\/info\/notice\/(\d+)[^"]*)">([^<]+)</g
  let match
  while ((match = linkPattern.exec(html)) !== null) {
    const path = match[1]
    const id = match[2]
    const title = match[3].trim()
    if (!title || !matchesKeyword(title)) continue
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
