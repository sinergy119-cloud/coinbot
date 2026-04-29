// 현황 카드 (진행 이벤트 수 / 활성 스케줄 수 / 오늘 거래 성공)
// async server component — 자체 데이터 fetch
//
// 최적화:
// - 이벤트 카운트는 캐시된 announcements에서 totalCount 재사용 (별도 쿼리 X)
// - 활성 스케줄도 list 쿼리 하나로 count + first row 한꺼번에 (count: 'exact')
// - 오늘 거래 성공만 별도 쿼리 (가장 가벼움 — id, success만)

import Link from 'next/link'
import { createServerClient } from '@/lib/supabase'
import { getActiveAnnouncements } from '@/lib/data/announcements'

function kstToday(): string {
  const kst = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
  const y = kst.getFullYear()
  const m = String(kst.getMonth() + 1).padStart(2, '0')
  const d = String(kst.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function kstTodayStartUtc(): string {
  const kst = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
  kst.setHours(0, 0, 0, 0)
  return new Date(kst.getTime() - 9 * 60 * 60 * 1000).toISOString()
}

export default async function StatsCards({ userId }: { userId: string }) {
  const today = kstToday()
  const todayStartUtc = kstTodayStartUtc()
  const db = createServerClient()

  const [
    { totalCount: eventCount },
    { count: scheduleCount },
    { data: todayTrades },
  ] = await Promise.all([
    // 이벤트 — 캐시된 함수 사용 (60초)
    getActiveAnnouncements(today, 1),
    // 활성 스케줄 카운트
    db.from('trade_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .in('status', ['active', 'paused']),
    // 오늘 거래 성공
    db.from('trade_logs')
      .select('id, success')
      .eq('user_id', userId)
      .eq('success', true)
      .gte('executed_at', todayStartUtc),
  ])

  const activeScheduleCount = scheduleCount ?? 0
  const todaySuccessCount = todayTrades?.length ?? 0

  return (
    <section className="px-4">
      <div className="grid grid-cols-3 gap-2.5">
        <Link
          href="/app/events"
          className="rounded-2xl p-3 text-center active:opacity-80 transition-opacity"
          style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
        >
          <p className="text-[18px] font-bold leading-none" style={{ color: '#0064FF' }}>
            {eventCount}
          </p>
          <p className="text-[10px] mt-1 break-keep" style={{ color: '#6B7684' }}>진행 이벤트</p>
        </Link>
        <Link
          href="/app/trade?tab=list"
          className="rounded-2xl p-3 text-center active:opacity-80 transition-opacity"
          style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
        >
          <p className="text-[18px] font-bold leading-none" style={{ color: '#FF9500' }}>
            {activeScheduleCount > 0 ? activeScheduleCount : '—'}
          </p>
          <p className="text-[10px] mt-1 break-keep" style={{ color: '#6B7684' }}>활성 스케줄</p>
        </Link>
        <Link
          href="/app/browse?tab=history"
          className="rounded-2xl p-3 text-center active:opacity-80 transition-opacity"
          style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
        >
          <p className="text-[18px] font-bold leading-none" style={{ color: '#00C853' }}>
            {todaySuccessCount}
          </p>
          <p className="text-[10px] mt-1 break-keep" style={{ color: '#6B7684' }}>오늘 거래 성공</p>
        </Link>
      </div>
    </section>
  )
}

export function StatsCardsSkeleton() {
  return (
    <section className="px-4">
      <div className="grid grid-cols-3 gap-2.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-2xl p-3 animate-pulse"
            style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', minHeight: 64 }}
          >
            <div className="mx-auto h-[18px] w-8 rounded" style={{ background: '#E5E8EB' }} />
            <div className="mx-auto mt-2 h-[10px] w-12 rounded" style={{ background: '#E5E8EB' }} />
          </div>
        ))}
      </div>
    </section>
  )
}
