// 메모리 기반 rate limit (EC2 단일 인스턴스 전제)
// design-security.md §2-3

type Bucket = { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()

// 주기적 청소 (1분마다 만료 버킷 제거) — 단일 프로세스 전제
const CLEANUP_INTERVAL_MS = 60_000
let _lastCleanup = 0
function cleanup(now: number) {
  if (now - _lastCleanup < CLEANUP_INTERVAL_MS) return
  _lastCleanup = now
  for (const [key, b] of buckets) {
    if (b.resetAt < now) buckets.delete(key)
  }
}

export interface RateLimitResult {
  ok: boolean
  remaining: number
  resetInSec: number
}

export function rateLimit(key: string, maxPerMin: number, windowMs = 60_000): RateLimitResult {
  const now = Date.now()
  cleanup(now)
  let bucket = buckets.get(key)
  if (!bucket || bucket.resetAt < now) {
    bucket = { count: 0, resetAt: now + windowMs }
    buckets.set(key, bucket)
  }
  if (bucket.count >= maxPerMin) {
    return { ok: false, remaining: 0, resetInSec: Math.ceil((bucket.resetAt - now) / 1000) }
  }
  bucket.count += 1
  return { ok: true, remaining: maxPerMin - bucket.count, resetInSec: Math.ceil((bucket.resetAt - now) / 1000) }
}

// 편의 함수: 사용자별 + 엔드포인트 키
export function userRateLimit(userId: string, endpoint: string, maxPerMin: number): RateLimitResult {
  return rateLimit(`${userId}:${endpoint}`, maxPerMin)
}
