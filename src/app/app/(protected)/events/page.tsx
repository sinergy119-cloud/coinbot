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
    <div className="flex flex-col gap-3">
      <header className="px-4 pt-6 pb-2 break-keep">
        <h1 className="text-2xl font-bold text-gray-900">진행 중인 이벤트</h1>
        <p className="text-sm text-gray-600 mt-1">총 {items.length}건</p>
      </header>

      <section className="px-4 flex flex-col gap-2">
        {items.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center text-sm text-gray-600 break-keep">
            현재 진행 중인 이벤트가 없습니다.
          </div>
        ) : (
          items.map((e) => {
            const exchangeLabel = EXCHANGE_LABELS[e.exchange as Exchange] ?? e.exchange
            return (
              <Link
                key={e.id}
                href={`/app/events/${e.id}`}
                className="bg-white rounded-2xl p-4 active:bg-gray-100 transition-colors"
              >
                <div className="flex items-start justify-between gap-3 break-keep">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-600 font-semibold">{exchangeLabel}</p>
                    <p className="text-base font-bold text-gray-900 mt-0.5">
                      {e.coin}
                      {e.require_apply && (
                        <span className="ml-2 text-[10px] bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded font-semibold">신청필요</span>
                      )}
                    </p>
                    {e.amount && (
                      <p className="text-sm text-gray-700 mt-1 break-keep">{e.amount}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0 text-xs text-gray-600">
                    <p>{e.start_date.slice(5).replace('-', '/')}</p>
                    <p className="text-gray-400">~</p>
                    <p>{e.end_date.slice(5).replace('-', '/')}</p>
                  </div>
                </div>
              </Link>
            )
          })
        )}
      </section>
    </div>
  )
}
