/**
 * 거래소 이벤트 크롤러 — 키워드 설정
 *
 * 유지보수 방법:
 *  - INCLUDE_KEYWORDS: 이 키워드 중 하나라도 제목에 포함되면 수집 대상
 *  - EXCLUDE_KEYWORDS: 이 키워드가 있으면 제외 (노이즈 제거)
 *
 * 키워드는 소문자로 작성하면 대소문자 무관하게 매칭됩니다.
 */

export const INCLUDE_KEYWORDS: string[] = [
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

export const EXCLUDE_KEYWORDS: string[] = [
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
 */
export function matchesKeyword(title: string): boolean {
  const lower = title.toLowerCase()

  const excluded = EXCLUDE_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()))
  if (excluded) return false

  return INCLUDE_KEYWORDS.some((kw) => title.includes(kw) || lower.includes(kw.toLowerCase()))
}
