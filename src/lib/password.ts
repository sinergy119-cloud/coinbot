// 비밀번호 강도 정책
// 최소 8자, 영문 + 숫자 + 특수문자 조합
export const PASSWORD_MIN_LENGTH = 8

export function validatePassword(password: string): { valid: boolean; error?: string } {
  if (!password || password.length < PASSWORD_MIN_LENGTH) {
    return { valid: false, error: `비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상이어야 합니다.` }
  }
  if (!/[a-zA-Z]/.test(password)) {
    return { valid: false, error: '비밀번호에 영문을 포함해야 합니다.' }
  }
  if (!/\d/.test(password)) {
    return { valid: false, error: '비밀번호에 숫자를 포함해야 합니다.' }
  }
  if (!/[!@#$%^&*()_+\-=[\]{};':"|,.<>/?~`]/.test(password)) {
    return { valid: false, error: '비밀번호에 특수문자를 포함해야 합니다.' }
  }
  return { valid: true }
}
