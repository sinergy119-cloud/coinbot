/**
 * DELETE /api/user/withdraw — 회원 탈퇴
 *
 * 처리 순서:
 *  1. 세션 확인
 *  2. 활성 스케줄(trade_jobs) 확인 → 있으면 400 차단
 *  3. 사용자 정보·거래소 계정 수 조회 (텔레그램 알림용)
 *  4. exchange_accounts 삭제
 *  5. login_history 삭제
 *  6. inquiries 삭제
 *  7. users 삭제
 *  8. 관리자 텔레그램 발송
 *  9. 세션 파기
 */

import { getSession, deleteSession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase'
import { sendTelegramMessage } from '@/lib/telegram'

export async function DELETE() {
  const session = await getSession()
  if (!session) return Response.json({ error: '로그인 필요' }, { status: 401 })

  const db = createServerClient()

  // ── 1. 활성 스케줄 확인 ──────────────────────────────────
  // 본인이 등록한 스케줄
  const { data: myJobs } = await db
    .from('trade_jobs')
    .select('id, coin, exchange')
    .eq('user_id', session.userId)

  // 본인 계정이 포함된 타인 스케줄
  const { data: myAccounts } = await db
    .from('exchange_accounts')
    .select('id')
    .eq('user_id', session.userId)
  const myAccountIds = (myAccounts ?? []).map((a) => a.id)

  let delegatedJobCount = 0
  if (myAccountIds.length > 0) {
    const { data: otherJobs } = await db
      .from('trade_jobs')
      .select('id, account_ids')
      .neq('user_id', session.userId)
    delegatedJobCount = (otherJobs ?? []).filter((j) =>
      (j.account_ids as string[]).some((id) => myAccountIds.includes(id))
    ).length
  }

  const totalJobs = (myJobs?.length ?? 0) + delegatedJobCount
  if (totalJobs > 0) {
    return Response.json(
      {
        error: '활성 스케줄이 있어 탈퇴할 수 없습니다. 스케줄 탭에서 모든 스케줄을 삭제한 후 다시 시도해주세요.',
        jobCount: totalJobs,
      },
      { status: 400 },
    )
  }

  // ── 2. 탈퇴 전 정보 조회 (알림용) ──────────────────────
  const { data: user } = await db
    .from('users')
    .select('name, email, user_id, created_at')
    .eq('id', session.userId)
    .single()

  const accountCount = myAccountIds.length

  // 소셜 로그인 구분
  const userId = user?.user_id ?? session.loginId
  const socialLabel = userId.startsWith('kakao_')
    ? '카카오'
    : userId.startsWith('naver_')
    ? '네이버'
    : userId.startsWith('google_')
    ? '구글'
    : '일반'

  // ── 3. 데이터 삭제 ──────────────────────────────────────
  // exchange_accounts
  if (myAccountIds.length > 0) {
    await db.from('exchange_accounts').delete().eq('user_id', session.userId)
  }

  // notification_settings (users FK 참조)
  await db.from('notification_settings').delete().eq('user_id', session.userId)

  // notifications
  await db.from('notifications').delete().eq('user_id', session.userId)

  // login_history
  await db.from('login_history').delete().eq('user_id', session.userId)

  // inquiries
  await db.from('inquiries').delete().eq('user_id', session.userId)

  // users
  const { error: deleteError } = await db.from('users').delete().eq('id', session.userId)
  if (deleteError) {
    console.error('[withdraw] users delete error:', deleteError)
    return Response.json({ error: '탈퇴 처리 중 오류가 발생했습니다.' }, { status: 500 })
  }

  // ── 4. 관리자 텔레그램 알림 ─────────────────────────────
  try {
    const adminId = process.env.ADMIN_USER_ID
    if (adminId) {
      const { data: admin } = await db
        .from('users')
        .select('telegram_chat_id')
        .eq('user_id', adminId)
        .single()

      if (admin?.telegram_chat_id) {
        const kst = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
        const joinedAt = user?.created_at
          ? new Date(user.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
          : '알 수 없음'

        const msg = [
          `🚪 <b>회원 탈퇴 알림</b>`,
          ``,
          `• 닉네임: <b>${user?.name ?? '미등록'}</b>`,
          `• 소셜: <b>${socialLabel}</b>`,
          `• 이메일: <b>${user?.email ?? '미등록'}</b>`,
          `• 가입일: ${joinedAt}`,
          `• 보유 거래소 계정: ${accountCount}개`,
          `• 탈퇴 일시: ${kst}`,
        ].join('\n')

        await sendTelegramMessage(admin.telegram_chat_id, msg)
      }
    }
  } catch (err) {
    // 알림 실패는 탈퇴 처리에 영향 없음
    console.error('[withdraw] telegram error:', err)
  }

  // ── 5. 세션 파기 ────────────────────────────────────────
  await deleteSession()

  return Response.json({ ok: true })
}
