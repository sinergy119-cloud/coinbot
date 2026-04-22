// 관리자 행동 감사 로그
// admin_audits 테이블에 관리자 행동 기록 (audit trail)
//
// 사용법:
//   await logAdminAudit(db, {
//     adminId: session.userId,
//     action: 'account.register',
//     targetUserId,
//     payload: { exchange, accountName },
//   })
//
// 실패해도 메인 로직을 막지 않도록 내부 try/catch 처리.

import type { SupabaseClient } from '@supabase/supabase-js'

export interface AdminAuditEntry {
  adminId: string
  action: string            // e.g. 'account.register', 'account.delete', 'delegate.approve'
  targetUserId?: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: Record<string, any> | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function logAdminAudit(db: SupabaseClient<any, any, any, any, any>, entry: AdminAuditEntry): Promise<void> {
  try {
    await db.from('admin_audits').insert({
      admin_id: entry.adminId,
      action: entry.action,
      target_user_id: entry.targetUserId ?? null,
      payload: entry.payload ?? null,
    })
  } catch (err) {
    console.error('[admin-audit] 기록 실패:', err instanceof Error ? err.message : err)
  }
}

// 관리자 엔드포인트용 rate limit (관대: 분당 60회)
import { userRateLimit, type RateLimitResult } from '@/lib/app/rate-limit'
export function adminRateLimit(adminUserId: string, endpoint: string): RateLimitResult {
  return userRateLimit(adminUserId, `admin:${endpoint}`, 60)
}
