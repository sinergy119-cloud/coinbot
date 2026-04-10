// HTML escape 유틸 (XSS 방어)
// 서버에서 직접 HTML 문자열을 구성하는 모든 곳에서 사용자 입력을 이 함수로 감싸야 합니다.
export function escapeHtml(str: string | null | undefined): string {
  if (str == null) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
