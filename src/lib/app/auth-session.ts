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

// ─────────────────────────────────────────────────────────────
// 앱 진입 시 인증 설정 (localStorage 기반, 기기별)
// ─────────────────────────────────────────────────────────────
const ENTRY_AUTH_KEY = 'mycoinbot:app_entry_auth_enabled'

/** 앱 진입 시 PIN/생체 인증을 요구할지 여부 (기본: ON, 미설정 시 ON) */
export function isAppEntryAuthEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const v = window.localStorage.getItem(ENTRY_AUTH_KEY)
    if (v === null) return true     // 신규 사용자 기본값 = ON
    return v === '1'
  } catch {
    return false
  }
}

export function setAppEntryAuthEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(ENTRY_AUTH_KEY, enabled ? '1' : '0')
  } catch {
    /* 무시 */
  }
}

// ─────────────────────────────────────────────────────────────
// 진입 인증 통과 플래그 (PIN 메모리 보관과 별개로, 게이트 통과 표시)
// 거래는 device key로 복호화하므로 PIN을 메모리에 보관할 필요가 없음.
// 정책은 일반 세션과 동일: 백그라운드 15분 / 절대 24시간.
// ─────────────────────────────────────────────────────────────
const entry: { authedAt: number; backgroundedAt: number | null } = {
  authedAt: 0,
  backgroundedAt: null,
}

export function markEntryAuthed(): void {
  entry.authedAt = Date.now()
  entry.backgroundedAt = null
}

export function clearEntryAuth(): void {
  entry.authedAt = 0
  entry.backgroundedAt = null
}

export function isEntryAuthValid(): boolean {
  if (entry.authedAt === 0) return false
  const now = Date.now()
  if (now - entry.authedAt >= MAX_SESSION_MS) {
    clearEntryAuth()
    return false
  }
  if (entry.backgroundedAt !== null && now - entry.backgroundedAt >= BACKGROUND_TIMEOUT_MS) {
    clearEntryAuth()
    return false
  }
  return true
}

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
  if (entry.authedAt > 0 && entry.backgroundedAt === null) {
    entry.backgroundedAt = Date.now()
  }
}

/** 포그라운드 복귀 — 만료 검사 후 valid면 backgroundedAt 초기화 */
export function markForegrounded(): void {
  // isSessionValid()가 만료 검사 + clearSession 처리
  if (isSessionValid()) {
    session.backgroundedAt = null
  }
  if (isEntryAuthValid()) {
    entry.backgroundedAt = null
  }
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

  // BFCache(뒤로가기 캐시·앱 종료 후 복원) 처리
  // - pagehide persisted=true: 페이지가 BFCache로 들어감 → 세션 폐기 (다음 복원 시 새 인증)
  // - pageshow persisted=true: BFCache에서 복원됨 → 세션 폐기 (사용자가 "앱 다시 켰다"고 느낌)
  window.addEventListener('pagehide', (e) => {
    if ((e as PageTransitionEvent).persisted) {
      clearSession()
      clearEntryAuth()
    } else {
      markBackgrounded()
    }
  })
  window.addEventListener('pageshow', (e) => {
    if ((e as PageTransitionEvent).persisted) {
      // BFCache 복원 = 사용자 입장에서 '앱 새로 켬' → 강제 재인증
      clearSession()
      clearEntryAuth()
    } else {
      markForegrounded()
    }
  })
}
