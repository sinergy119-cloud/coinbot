import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase'
import { EXCHANGE_LABELS, type Exchange } from '@/types/database'

interface AnnouncementRow {
  id: string
  exchange: string
  coin: string
  amount: string | null
  require_apply: boolean
  api_allowed: boolean
  link: string | null
  notes: string | null
  start_date: string
  end_date: string
  reward_date: string | null
}

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = createServerClient()
  const { data } = await db
    .from('announcements')
    .select('id, exchange, coin, amount, require_apply, api_allowed, link, notes, start_date, end_date, reward_date')
    .eq('id', id)
    .maybeSingle()

  if (!data) notFound()
  const e = data as AnnouncementRow
  const exchangeLabel = EXCHANGE_LABELS[e.exchange as Exchange] ?? e.exchange

  return (
    <div className="flex flex-col gap-4">
      <header className="px-4 pt-6 pb-2 break-keep">
        <Link href="/app/events" className="text-xs text-gray-600 font-semibold">← 이벤트 목록</Link>
        <p className="text-sm text-gray-600 mt-3">{exchangeLabel}</p>
        <h1 className="text-2xl font-bold text-gray-900 mt-0.5">
          {e.coin}
          {e.require_apply && (
            <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded font-semibold align-middle">신청 필요</span>
          )}
        </h1>
      </header>

      <section className="px-4 break-keep">
        <div className="bg-white rounded-2xl p-5 flex flex-col gap-3">
          {e.amount && (
            <InfoRow label="보상" value={e.amount} />
          )}
          <InfoRow label="기간" value={`${e.start_date} ~ ${e.end_date}`} />
          {e.reward_date && <InfoRow label="지급일" value={e.reward_date} />}
          <InfoRow label="API 거래" value={e.api_allowed ? '허용' : '불가'} />
        </div>
      </section>

      {e.notes && (
        <section className="px-4 break-keep">
          <h2 className="text-base font-bold text-gray-900 mb-2">상세 안내</h2>
          <div className="bg-white rounded-2xl p-5">
            <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed break-keep">{e.notes}</p>
          </div>
        </section>
      )}

      {e.link && (
        <section className="px-4">
          <a
            href={e.link}
            target="_blank"
            rel="noopener noreferrer"
            className="block bg-gray-900 text-white rounded-2xl p-4 text-center text-sm font-semibold active:scale-95 transition-transform"
          >
            거래소 공지 보기 ↗
          </a>
        </section>
      )}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-xs text-gray-600 w-16 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-gray-900 font-medium break-keep">{value}</span>
    </div>
  )
}
