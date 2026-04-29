import Link from 'next/link'
import { Suspense } from 'react'
import { getSession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase'
import OnboardingBanner from '../_components/OnboardingBanner'
import StatsCards, { StatsCardsSkeleton } from './_sections/StatsCards'
import ActiveEvents, { ActiveEventsSkeleton } from './_sections/ActiveEvents'
import UserSchedules, { UserSchedulesSkeleton } from './_sections/UserSchedules'

export default async function AppHomePage() {
  const session = await getSession()
  // 인사말용 사용자명만 즉시 가져옴 (가벼운 단일 쿼리)
  const db = createServerClient()
  const { data: user } = await db
    .from('users')
    .select('name, user_id')
    .eq('id', session!.userId)
    .single()

  const rawId = user?.user_id ?? ''
  const fallbackName = rawId.startsWith('kakao_') || rawId.startsWith('naver_') || rawId.startsWith('google_')
    ? '회원'
    : rawId
  const displayName = user?.name || fallbackName || '회원'

  return (
    <div className="flex flex-col gap-4 pb-2" style={{ background: '#F9FAFB', minHeight: '100%' }}>

      {/* 인사 — 즉시 렌더 */}
      <header className="px-4 pt-5 pb-0 break-keep">
        <p className="text-[13px]" style={{ color: '#6B7684' }}>안녕하세요</p>
        <h1 className="text-[22px] font-bold mt-0.5" style={{ color: '#191F28' }}>
          {displayName}님 👋
        </h1>
      </header>

      {/* 온보딩 배너 — 즉시 렌더 */}
      <OnboardingBanner />

      {/* 현황 요약 카드 — Suspense로 streaming */}
      <Suspense fallback={<StatsCardsSkeleton />}>
        <StatsCards userId={session!.userId} />
      </Suspense>

      {/* 빠른 거래 — 정적, 즉시 렌더 */}
      <section className="px-4">
        <div className="grid grid-cols-2 gap-2.5">
          <Link
            href="/app/trade?tab=instant"
            className="rounded-2xl p-3 flex items-center gap-2.5 active:opacity-80 transition-opacity"
            style={{ background: '#191F28' }}
          >
            <span className="text-[22px]">⚡</span>
            <span className="text-[13px] font-semibold" style={{ color: '#fff' }}>즉시 거래</span>
          </Link>
          <Link
            href="/app/trade?tab=schedule"
            className="rounded-2xl p-3 flex items-center gap-2.5 active:opacity-80 transition-opacity"
            style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
          >
            <span className="text-[22px]">📅</span>
            <span className="text-[13px] font-semibold" style={{ color: '#191F28' }}>스케줄 등록</span>
          </Link>
        </div>
      </section>

      {/* 진행 중인 이벤트 — Suspense (캐시 60초 + tag invalidation) */}
      <Suspense fallback={<ActiveEventsSkeleton />}>
        <ActiveEvents />
      </Suspense>

      {/* 등록된 스케줄 — Suspense (사용자별 데이터) */}
      <Suspense fallback={<UserSchedulesSkeleton />}>
        <UserSchedules userId={session!.userId} />
      </Suspense>

    </div>
  )
}
