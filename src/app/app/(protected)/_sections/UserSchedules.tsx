// 등록된 스케줄 미리보기 (최근 3건)
// async server component — 사용자별 데이터라 캐시 안 함

import Link from 'next/link'
import { createServerClient } from '@/lib/supabase'
import { EXCHANGE_LABELS, TRADE_TYPE_LABELS, type Exchange, type TradeType } from '@/types/database'
import ExchangeIcon from '@/components/ExchangeIcon'

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

export default async function UserSchedules({ userId }: { userId: string }) {
  const db = createServerClient()
  const { data } = await db
    .from('trade_jobs')
    .select('id, exchange, coin, trade_type, amount_krw, schedule_from, schedule_to, schedule_time, status')
    .eq('user_id', userId)
    .in('status', ['active', 'paused'])
    .order('created_at', { ascending: false })
    .limit(3)

  const schedules = (data as ScheduleItem[] | null) ?? []

  return (
    <section className="px-4 pb-2">
      <div className="flex items-center justify-between mb-2.5">
        <h2 className="text-[15px] font-bold" style={{ color: '#191F28' }}>등록된 스케줄</h2>
        <Link href="/app/trade?tab=list" className="text-[12px] font-semibold" style={{ color: '#6B7684' }}>
          전체 보기 →
        </Link>
      </div>

      {schedules.length === 0 ? (
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
          {schedules.map((s, idx, arr) => {
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
                    className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full mt-0.5 inline-flex items-center gap-1"
                    style={{ background: badge.bg, color: badge.text }}
                  >
                    <ExchangeIcon exchange={s.exchange} size={13} />
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
  )
}

export function UserSchedulesSkeleton() {
  return (
    <section className="px-4 pb-2">
      <div className="flex items-center justify-between mb-2.5">
        <h2 className="text-[15px] font-bold" style={{ color: '#191F28' }}>등록된 스케줄</h2>
      </div>
      <div
        className="rounded-2xl p-4 animate-pulse"
        style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
      >
        {[0, 1].map((i) => (
          <div key={i} className={`flex items-center gap-3 ${i === 0 ? 'pb-3 mb-3 border-b border-gray-100' : ''}`}>
            <div className="h-5 w-12 rounded-full" style={{ background: '#E5E8EB' }} />
            <div className="flex-1">
              <div className="h-4 w-20 rounded" style={{ background: '#E5E8EB' }} />
              <div className="mt-1 h-3 w-32 rounded" style={{ background: '#E5E8EB' }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
