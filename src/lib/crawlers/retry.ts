/**
 * 크롤러 재시도 유틸리티
 *
 * 일시적 네트워크 오류(5xx, timeout)에 대해 지수 백오프로 재시도합니다.
 * 사용법:
 *   const res = await withRetry(() => fetch(url, options), { label: 'BITHUMB' })
 */

export interface RetryOptions {
  /** 재시도 횟수 (기본: 2) */
  retries?: number
  /** 초기 대기 시간(ms) — 시도마다 2배 증가 (기본: 1000) */
  delayMs?: number
  /** 로그 레이블 */
  label?: string
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  { retries = 2, delayMs = 1000, label = '' }: RetryOptions = {},
): Promise<T> {
  let lastErr: unknown

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err

      if (attempt < retries) {
        const wait = delayMs * Math.pow(2, attempt) // 1s → 2s → 4s
        console.warn(
          `[${label}] 요청 실패 (시도 ${attempt + 1}/${retries + 1}) — ${wait}ms 후 재시도:`,
          err instanceof Error ? err.message : String(err),
        )
        await new Promise((r) => setTimeout(r, wait))
      }
    }
  }

  throw lastErr
}
