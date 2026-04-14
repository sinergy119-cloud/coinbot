/**
 * 거래소 이벤트 크롤러 — 키워드 설정
 *
 * DB(crawler_keywords 테이블)에 저장된 키워드를 우선 사용합니다.
 * 테이블이 비어 있으면 아래 DEFAULT_* 배열을 폴백으로 사용합니다.
 *
 * 유지보수: 관리자 페이지 → 수집 이벤트 탭 → 키워드 설정에서 관리
 */

export interface Keywords {
  include: string[]
  exclude: string[]
}

/** DB가 비어 있을 때 사용하는 기본값 */
export const DEFAULT_INCLUDE_KEYWORDS: string[] = [
  'N빵',
  'n빵',
  '에어드랍',
  'airdrop',
  '나눔',
  '리워드',
  'reward',
  '지급',
  '증정',
  '선착순',
  '추첨',
  '공동구매',
  '분배',
  '배분',
  '무상지급',
  '무료지급',
  '이벤트 지급',
]

export const DEFAULT_EXCLUDE_KEYWORDS: string[] = [
  '점검',
  '안내',
  '종료',
  '정책',
  '약관',
  '시스템',
  '긴급',
  '임시',
  '상장',
  '폐지',
  '채용',
]

/**
 * 제목이 수집 대상인지 확인
 * @param title 게시글 제목
 * @param keywords include/exclude 키워드 목록
 */
export function matchesKeyword(title: string, keywords: Keywords): boolean {
  const lower = title.toLowerCase()
  const excluded = keywords.exclude.some((kw) => lower.includes(kw.toLowerCase()))
  if (excluded) return false
  return keywords.include.some((kw) => title.includes(kw) || lower.includes(kw.toLowerCase()))
}
