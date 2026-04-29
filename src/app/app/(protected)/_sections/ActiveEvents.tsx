// 진행 중인 이벤트 미리보기 (최근 3건)
// async server component — 캐시된 announcements 사용 (60초 + tag invalidation)

import Link from 'next/link'
import { EXCHANGE_LABELS, type Exchange } from '@/types/database'
import ExchangeIcon from '@/components/ExchangeIcon'
import { getActiveAnnouncements } from '@/lib/data/announcements'

const EXCHANGE_BADGE: Record<string, { bg: string; text: string }> = {
  BITHUMB: { bg: '#FFF0E6', text: '#C94B00' },
  UPBIT:   { bg: '#E6F0FF', text: '#0050CC' },
  COINONE: { bg: '#E6F9EE', text: '#007A30' },
  KORBIT:  { bg: '#F3EEFF', text: '#5B21B6' },
  GOPAX:   { bg: '#FFFBE6', text: '#946200' },
}

function kstToday(): string {
  const kst = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
  const y = kst.getFullYear()
  const m = String(kst.getMonth() + 1).padStart(2, '0')
  const d = String(kst.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export default async function ActiveEvents() {
  const today = kstToday()
  const { preview: events } = await getActiveAnnouncements(today, 3)

  return (
    <section className="px-4">
      <div className="flex items-center justify-between mb-2.5">
        <h2 className="text-[15px] font-bold" style={{ color: '#191F28' }}>진행 중인 이벤트</h2>
        <Link href="/app/events" className="text-[12px] font-semibold" style={{ color: '#6B7684' }}>
          모두 보기 →
        </Link>
      </div>

      {events.length === 0 ? (
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
          {events.map((e, idx, arr) => {
            const badge = EXCHANGE_BADGE[e.exchange] ?? { bg: '#F2F4F6', text: '#6B7684' }
            const label = EXCHANGE_LABELS[e.exchange as Exchange] ?? e.exchange
            return (
              <Link
                key={e.id}
                href={`/app/events/${e.id}`}
                className="block px-4 py-3.5 active:bg-gray-50 transition-colors break-keep"
                style={idx < arr.length - 1 ? { borderBottom: '1px solid #F2F4F6' } : undefined}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1"
                      style={{ background: badge.bg, color: badge.text }}
                    >
                      <ExchangeIcon exchange={e.exchange} size={13} />
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
                </div>
                {(e.require_apply || !e.api_allowed) && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {e.require_apply && (
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full animate-pulse"
                        style={{ background: '#FFF9C4', color: '#7A6000' }}
                      >
                        🎟️ 이벤트 별도 신청
                      </span>
                    )}
                    {!e.api_allowed && (
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full animate-pulse"
                        style={{ background: '#FFE3E3', color: '#C92A2A' }}
                      >
                        ⛔ 거래소 직접 거래
                      </span>
                    )}
                  </div>
                )}
              </Link>
            )
          })}
        </div>
      )}
    </section>
  )
}

export function ActiveEventsSkeleton() {
  return (
    <section className="px-4">
      <div className="flex items-center justify-between mb-2.5">
        <h2 className="text-[15px] font-bold" style={{ color: '#191F28' }}>진행 중인 이벤트</h2>
      </div>
      <div
        className="rounded-2xl p-4 animate-pulse"
        style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
      >
        {[0, 1, 2].map((i) => (
          <div key={i} className={`flex items-center gap-3 ${i < 2 ? 'pb-3 mb-3 border-b border-gray-100' : ''}`}>
            <div className="h-5 w-12 rounded-full" style={{ background: '#E5E8EB' }} />
            <div className="flex-1">
              <div className="h-4 w-16 rounded" style={{ background: '#E5E8EB' }} />
              <div className="mt-1 h-3 w-24 rounded" style={{ background: '#E5E8EB' }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
