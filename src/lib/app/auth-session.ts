'use client'

// 인증 세션 — 카카오뱅크/토스 표준
//
// 정책:
// 1) 콜드 스타트 (앱 처음 실행) → PIN/지문 인증 필수
// 2) 백그라운드 → 포그라운드 복귀
//    - 백그라운드 < 15분: 통과 (인증 생략)
//    - 백그라운드 ≥ 15분: 재인증 필요
// 3) 마지막 인증 후 24시간 경과 → 강제 재인증 (포그라운드여도)
// 4) API Key 등록·삭제는 세션 무관, 항상 별도 PIN 인증
//
// 보안:
// - PIN을 메모리(JS heap)에만 보관. IndexedDB·localStorage 절대 안 씀
// - 페이지 새로고침/PWA 재시작/탭 종료 시 메모리 휘발 → 자동 폐기
// - Visibility API로 백그라운드 시간 추적

const BACKGROUND_TIMEOUT_MS = 15 * 60 * 1000  // 15분
const MAX_SESSION_MS = 24 * 60 * 60 * 1000     // 24시간

interface SessionState {
  pin: string | null
  authedAt: number       // 마지막 인증 시각 (ms)
  backgroundedAt: number | null // 백그라운드 진입 시각 (ms), null이면 포그라운드
}

const session: SessionState = {
  pin: null,
  authedAt: 0,
  backgroundedAt: null,
}

/** 인증 성공 시 호출 — PIN을 세션에 저장 */
export function setSessionPin(pin: string): void {
  session.pin = pin
  session.authedAt = Date.now()
  session.backgroundedAt = null
}

/** 세션 종료 — PIN 폐기 */
export function clearSession(): void {
  session.pin = null
  session.authedAt = 0
  session.backgroundedAt = null
}

/** 세션이 유효한지 검사 */
export function isSessionValid(): boolean {
  if (!session.pin) return false

  const now = Date.now()
  // 24시간 절대 만료
  if (now - session.authedAt >= MAX_SESSION_MS) {
    clearSession()
    return false
  }

  // 백그라운드 15분 경과 만료
  if (session.backgroundedAt !== null) {
    const bgDuration = now - session.backgroundedAt
    if (bgDuration >= BACKGROUND_TIMEOUT_MS) {
      clearSession()
      return false
    }
  }

  return true
}

/** 세션 PIN 조회 — 만료된 경우 null 반환 */
export function getSessionPin(): string | null {
  return isSessionValid() ? session.pin : null
}

/** 백그라운드 진입 시각 기록 (Visibility 리스너에서 호출) */
export function markBackgrounded(): void {
  if (session.pin && session.backgroundedAt === null) {
    session.backgroundedAt = Date.now()
  }
}

/** 포그라운드 복귀 — 만료 검사 후 valid면 backgroundedAt 초기화 */
export function markForegrounded(): void {
  // isSessionValid()가 만료 검사 + clearSession 처리
  if (isSessionValid()) {
    session.backgroundedAt = null
  }
  // 만료된 경우는 이미 clearSession됨 → 다음 작업이 PIN 요구
}

// ─────────────────────────────────────────────────────────────
// Visibility API 리스너 — 한 번만 설치
// ─────────────────────────────────────────────────────────────

let listenerInstalled = false

export function installVisibilityListener(): void {
  if (typeof document === 'undefined') return
  if (listenerInstalled) return
  listenerInstalled = true

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      markBackgrounded()
    } else if (document.visibilityState === 'visible') {
      markForegrounded()
    }
  })

  // 일부 환경에서 visibilitychange 누락 대응 (탭 닫힘/앱 종료)
  window.addEventListener('pagehide', () => markBackgrounded())
  window.addEventListener('pageshow', () => markForegrounded())
}
