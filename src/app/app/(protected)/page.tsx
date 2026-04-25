import Link from 'next/link'
import { getSession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase'
import { EXCHANGE_LABELS, TRADE_TYPE_LABELS, type Exchange, type TradeType } from '@/types/database'
import OnboardingBanner from '../_components/OnboardingBanner'

interface EventItem {
  id: string
  exchange: string
  coin: string
  amount: string | null
  start_date: string
  end_date: string
}

interface ScheduleItem {
  id: string
  exchange: string
  coin: string
  trade_type: string
  amount_krw: number
  schedule_from: string
  schedule_to: string
  schedule_time: string
  status: string
}

function kstToday(): string {
  const kst = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
  const y = kst.getFullYear()
  const m = String(kst.getMonth() + 1).padStart(2, '0')
  const d = String(kst.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// KST 오늘 00:00 ISO string
function kstTodayStart(): string {
  const kst = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
  kst.setHours(0, 0, 0, 0)
  return new Date(kst.getTime() - 9 * 60 * 60 * 1000).toISOString() // UTC로 변환
}

const EXCHANGE_BADGE: Record<string, { bg: string; text: string }> = {
  BITHUMB: { bg: '#FFF0E6', text: '#C94B00' },
  UPBIT:   { bg: '#E6F0FF', text: '#0050CC' },
  COINONE: { bg: '#E6F9EE', text: '#007A30' },
  KORBIT:  { bg: '#F3EEFF', text: '#5B21B6' },
  GOPAX:   { bg: '#FFFBE6', text: '#946200' },
}

const STATUS_LABEL: Record<string, string> = {
  active:    '진행 중',
  paused:    '일시정지',
  completed: '완료',
  cancelled: '취소됨',
}

export default async function AppHomePage() {
  const session = await getSession()
  const db = createServerClient()
  const today = kstToday()
  const todayStartUtc = kstTodayStart()

  const [
    { data: events },
    { data: schedules },
    { data: todayTrades },
    { data: user },
  ] = await Promise.all([
    db.from('announcements')
      .select('id, exchange, coin, amount, start_date, end_date')
      .gte('end_date', today)
      .order('created_at', { ascending: false })
      .limit(3),

    db.from('trade_jobs')
      .select('id, exchange, coin, trade_type, amount_krw, schedule_from, schedule_to, schedule_time, status')
      .eq('user_id', session!.userId)
      .in('status', ['active', 'paused'])
      .order('created_at', { ascending: false })
      .limit(3),

    db.from('trade_logs')
      .select('id, success')
      .eq('user_id', session!.userId)
      .eq('success', true)
      .gte('executed_at', todayStartUtc),

    db.from('users')
      .select('name, user_id')
      .eq('id', session!.userId)
      .single(),
  ])

  const rawId = user?.user_id ?? ''
  const fallbackName = rawId.startsWith('kakao_') || rawId.startsWith('naver_') || rawId.startsWith('google_')
    ? '회원'
    : rawId
  const displayName = user?.name || fallbackName || '회원'

  const activeScheduleCount = schedules?.length ?? 0
  const todaySuccessCount = todayTrades?.length ?? 0

  return (
    <div className="flex flex-col gap-4 pb-2" style={{ background: '#F9FAFB', minHeight: '100%' }}>

      {/* 인사 */}
      <header className="px-4 pt-5 pb-0 break-keep">
        <p className="text-[13px]" style={{ color: '#6B7684' }}>안녕하세요</p>
        <h1 className="text-[22px] font-bold mt-0.5" style={{ color: '#191F28' }}>
          {displayName}님 👋
        </h1>
      </header>

      {/* 온보딩 배너 */}
      <OnboardingBanner />

      {/* 현황 요약 카드 — 높이 축소 */}
      <section className="px-4">
        <div className="grid grid-cols-3 gap-2.5">
          <Link
            href="/app/events"
            className="rounded-2xl p-3 text-center active:opacity-80 transition-opacity"
            style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
          >
            <p className="text-[18px] font-bold leading-none" style={{ color: '#0064FF' }}>
              {(events ?? []).length}
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

      {/* 빠른 거래 — 높이 축소 */}
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

      {/* 진행 중인 이벤트 */}
      <section className="px-4">
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-[15px] font-bold" style={{ color: '#191F28' }}>진행 중인 이벤트</h2>
          <Link href="/app/events" className="text-[12px] font-semibold" style={{ color: '#6B7684' }}>
            모두 보기 →
          </Link>
        </div>

        {(events ?? []).length === 0 ? (
          <div
            className="rounded-2xl p-4 text-center text-[13px] break-keep"
            style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', color: '#6B7684' }}
          >
            진행 중인 이벤트가 없습니다.
          </div>
        ) : (
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
          >
            {((events as EventItem[]) ?? []).map((e, idx, arr) => {
              const badge = EXCHANGE_BADGE[e.exchange] ?? { bg: '#F2F4F6', text: '#6B7684' }
              const label = EXCHANGE_LABELS[e.exchange as Exchange] ?? e.exchange
              return (
                <Link
                  key={e.id}
                  href={`/app/events/${e.id}`}
                  className="flex items-center justify-between px-4 py-3.5 active:bg-gray-50 transition-colors break-keep"
                  style={idx < arr.length - 1 ? { borderBottom: '1px solid #F2F4F6' } : undefined}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: badge.bg, color: badge.text }}
                    >
                      {label}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold truncate" style={{ color: '#191F28' }}>
                        {e.coin}
                      </p>
                      {e.amount && (
                        <p className="text-[11px] mt-0.5" style={{ color: '#6B7684' }}>{e.amount}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-[11px] shrink-0 ml-3" style={{ color: '#B0B8C1' }}>
                    ~ {e.end_date.slice(5).replace('-', '/')}
                  </span>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {/* 등록된 스케줄 */}
      <section className="px-4 pb-2">
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-[15px] font-bold" style={{ color: '#191F28' }}>등록된 스케줄</h2>
          <Link href="/app/trade?tab=list" className="text-[12px] font-semibold" style={{ color: '#6B7684' }}>
            전체 보기 →
          </Link>
        </div>

        {(schedules ?? []).length === 0 ? (
          <div
            className="rounded-2xl p-4 text-center text-[13px] break-keep"
            style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', color: '#6B7684' }}
          >
            <p>등록된 스케줄이 없어요.</p>
            <Link
              href="/app/trade?tab=schedule"
              className="inline-block mt-2 text-[12px] font-semibold"
              style={{ color: '#0064FF' }}
            >
              스케줄 등록하기 →
            </Link>
          </div>
        ) : (
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
          >
            {((schedules as ScheduleItem[]) ?? []).map((s, idx, arr) => {
              const badge = EXCHANGE_BADGE[s.exchange] ?? { bg: '#F2F4F6', text: '#6B7684' }
              const label = EXCHANGE_LABELS[s.exchange as Exchange] ?? s.exchange
              const statusLabel = STATUS_LABEL[s.status] ?? s.status
              const isActive = s.status === 'active'
              return (
                <Link
                  key={s.id}
                  href="/app/trade?tab=list"
                  className="flex items-center justify-between px-4 py-3.5 active:bg-gray-50 transition-colors break-keep"
                  style={idx < arr.length - 1 ? { borderBottom: '1px solid #F2F4F6' } : undefined}
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <span
                      className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full mt-0.5"
                      style={{ background: badge.bg, color: badge.text }}
                    >
                      {label}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-[14px] font-semibold" style={{ color: '#191F28' }}>{s.coin}</p>
                        <span className="text-[11px]" style={{ color: '#6B7684' }}>
                          {TRADE_TYPE_LABELS[s.trade_type as TradeType] ?? s.trade_type}
                        </span>
                      </div>
                      {s.trade_type !== 'SELL' && (
                        <p className="text-[11px] mt-0.5" style={{ color: '#6B7684' }}>
                          {s.amount_krw.toLocaleString()}원
                        </p>
                      )}
                      <p className="text-[10px] mt-0.5" style={{ color: '#B0B8C1' }}>
                        {s.schedule_from.slice(5)} ~ {s.schedule_to.slice(5)} · {s.schedule_time}
                      </p>
                    </div>
                  </div>
                  <span
                    className="text-[11px] font-semibold shrink-0 ml-2"
                    style={{ color: isActive ? '#00C853' : '#FF9500' }}
                  >
                    {statusLabel}
                  </span>
                </Link>
              )
            })}
          </div>
        )}
      </section>

    </div>
  )
}
