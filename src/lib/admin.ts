// 관리자 판정 유틸
export function isAdmin(loginId: string): boolean {
  const adminId = process.env.ADMIN_USER_ID
  return !!adminId && loginId === adminId
}
