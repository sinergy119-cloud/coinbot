import Link from 'next/link'
import { createServerClient } from '@/lib/supabase'
import { EXCHANGE_LABELS, type Exchange } from '@/types/database'

interface AnnouncementRow {
  id: string
  exchange: string
  coin: string
  amount: string | null
  require_apply: boolean
  start_date: string
  end_date: string
  reward_date: string | null
}

function kstToday() {
  const kst = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
  const y = kst.getFullYear()
  const m = String(kst.getMonth() + 1).padStart(2, '0')
  const d = String(kst.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// 거래소별 뱃지 색상
const EXCHANGE_BADGE: Record<string, { bg: string; text: string }> = {
  BITHUMB: { bg: '#FFF0E6', text: '#C94B00' },
  UPBIT:   { bg: '#E6F0FF', text: '#0050CC' },
  COINONE: { bg: '#E6F9EE', text: '#007A30' },
  KORBIT:  { bg: '#F3EEFF', text: '#5B21B6' },
  GOPAX:   { bg: '#FFFBE6', text: '#946200' },
}

export default async function EventsPage() {
  const db = createServerClient()
  const today = kstToday()
  const { data } = await db
    .from('announcements')
    .select('id, exchange, coin, amount, require_apply, start_date, end_date, reward_date')
    .lte('start_date', today)
    .gte('end_date', today)
    .order('created_at', { ascending: false })

  const items = (data as AnnouncementRow[]) ?? []

  return (
    <div className="min-h-full" style={{ background: '#F9FAFB' }}>

      {/* 헤더 */}
      <header className="px-4 pt-6 pb-4">
        <h1 className="text-[22px] font-bold break-keep" style={{ color: '#191F28' }}>
          진행 중인 이벤트
        </h1>
        <p className="text-[13px] mt-1" style={{ color: '#6B7684' }}>
          총 {items.length}건
        </p>
      </header>

      {/* 이벤트 목록 */}
      <section className="px-4 pb-6 flex flex-col gap-2">
        {items.length === 0 ? (
          <div
            className="rounded-2xl p-10 text-center text-[14px] break-keep"
            style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', color: '#6B7684' }}
          >
            현재 진행 중인 이벤트가 없습니다.
          </div>
        ) : (
          items.map((e) => {
            const exchangeLabel = EXCHANGE_LABELS[e.exchange as Exchange] ?? e.exchange
            const badge = EXCHANGE_BADGE[e.exchange] ?? { bg: '#F2F4F6', text: '#6B7684' }
            return (
              <Link
                key={e.id}
                href={`/app/events/${e.id}`}
                className="block rounded-2xl p-5 active:opacity-80 transition-opacity break-keep"
                style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
              >
                {/* 상단: 거래소 뱃지 + 종료일 */}
                <div className="flex items-center justify-between mb-2.5">
                  <span
                    className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: badge.bg, color: badge.text }}
                  >
                    {exchangeLabel}
                  </span>
                  <span className="text-[12px]" style={{ color: '#B0B8C1' }}>
                    ~ {e.end_date.slice(5).replace('-', '/')}
                  </span>
                </div>

                {/* 코인명 */}
                <p className="text-[16px] font-semibold" style={{ color: '#191F28' }}>
                  {e.coin}
                  {e.require_apply && (
                    <span
                      className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded"
                      style={{ background: '#FFF9C4', color: '#7A6000' }}
                    >
                      신청필요
                    </span>
                  )}
                </p>

                {/* 금액/내용 */}
                {e.amount && (
                  <p className="text-[13px] mt-1.5" style={{ color: '#6B7684' }}>
                    {e.amount}
                  </p>
                )}
              </Link>
            )
          })
        )}
      </section>

    </div>
  )
}
