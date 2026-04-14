/**
 * 업비트 공지사항 크롤러
 *
 * ⚠️ 업비트는 공지사항 공개 API를 제공하지 않으며,
 *    SPA(React) 방식으로 클라이언트 렌더링을 사용합니다.
 *    서버사이드 HTML 파싱이 불가능한 구조입니다.
 *
 * 현재 상태: 빈 배열 반환 (수집 불가)
 *
 * 향후 개선 방법:
 *   1. 업비트 공식 API 공개 시 엔드포인트 추가
 *   2. Puppeteer/Playwright 등 헤드리스 브라우저로 전환
 *
 * 비고: 업비트 공지는 https://upbit.com/service_center/notice 에서 직접 확인하세요.
 */

import { CrawledItem } from './bithumb'

export async function crawlUpbit(): Promise<CrawledItem[]> {
  // 현재 수집 불가 — 공개 API 미제공 거래소
  return []
}
