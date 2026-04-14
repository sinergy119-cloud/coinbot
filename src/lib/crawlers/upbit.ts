/**
 * 업비트 공지사항 크롤러 (비공식 API)
 * 출처: https://api-manager.upbit.com/api/v1/notices (공개 엔드포인트, 로그인 불필요)
 *
 * ⚠️ 비공식 API이므로 구조가 변경될 수 있습니다. 오류 시 URL/파싱 로직을 확인하세요.
 */

import { matchesKeyword } from './keywords'

const NOTICE_API_URL = 'https://api-manager.upbit.com/api/v1/notices?page=1&per_page=30'
const BASE_URL = 'https://upbit.com/service_center/notice'

export interface CrawledItem {
  exchange: string
  sourceId: string
  title: string
  url: string | null
}

export async function crawlUpbit(): Promise<CrawledItem[]> {
  const res = await fetch(NOTICE_API_URL, {
    headers: {
      'User-Agent': 'MyCoinBot-Crawler/1.0',
      'Accept': 'application/json',
    },
    signal: AbortSignal.timeout(10_000),
  })

  if (!res.ok) {
    throw new Error(`업비트 공지 API 오류: ${res.status}`)
  }

  const json = await res.json()

  // 응답 구조: { success: true, data: { list: [{ id, title, ... }] } }
  // ⚠️ 실제 응답 구조가 다르면 아래 경로를 수정하세요.
  const list: Array<{ id?: string | number; title?: string }> =
    json?.data?.list ?? json?.list ?? []

  if (!Array.isArray(list)) return []

  return list
    .filter((item) => {
      const title = item.title ?? ''
      return matchesKeyword(title)
    })
    .map((item) => {
      const id = String(item.id ?? '')
      return {
        exchange: 'UPBIT',
        sourceId: id,
        title: String(item.title ?? ''),
        url: id ? `${BASE_URL}?id=${id}` : null,
      }
    })
}
