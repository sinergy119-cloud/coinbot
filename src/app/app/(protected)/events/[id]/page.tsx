import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase'
import { EXCHANGE_LABELS, type Exchange } from '@/types/database'
import ExchangeIcon from '@/components/ExchangeIcon'

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

// 거래소별 뱃지 색상
const EXCHANGE_BADGE: Record<string, { bg: string; text: string }> = {
  BITHUMB: { bg: '#FFF0E6', text: '#C94B00' },
  UPBIT:   { bg: '#E6F0FF', text: '#0050CC' },
  COINONE: { bg: '#E6F9EE', text: '#007A30' },
  KORBIT:  { bg: '#F3EEFF', text: '#5B21B6' },
  GOPAX:   { bg: '#FFFBE6', text: '#946200' },
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
  const badge = EXCHANGE_BADGE[e.exchange] ?? { bg: '#F2F4F6', text: '#6B7684' }

  return (
    <div className="flex flex-col gap-5 pb-6" style={{ background: '#F9FAFB', minHeight: '100%' }}>

      {/* 헤더 */}
      <header className="px-4 pt-6 pb-0 break-keep">
        <Link
          href="/app/events"
          className="inline-flex items-center gap-1 text-[13px] font-semibold"
          style={{ color: '#6B7684' }}
        >
          ← 이벤트 목록
        </Link>

        {/* 거래소 뱃지 */}
        <div className="flex items-center gap-2 mt-4">
          <span
            className="text-[11px] font-semibold px-2.5 py-1 rounded-full inline-flex items-center gap-1"
            style={{ background: badge.bg, color: badge.text }}
          >
            <ExchangeIcon exchange={e.exchange} size={14} />
            {exchangeLabel}
          </span>
          {e.require_apply && (
            <span
              className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
              style={{ background: '#FFF9C4', color: '#7A6000' }}
            >
              신청 필요
            </span>
          )}
        </div>

        {/* 코인명 */}
        <h1 className="text-[28px] font-bold mt-2" style={{ color: '#191F28' }}>
          {e.coin}
        </h1>

        {/* 종료일 */}
        <p className="text-[13px] mt-1" style={{ color: '#B0B8C1' }}>
          ~ {e.end_date}까지
        </p>
      </header>

      {/* 이벤트 정보 카드 */}
      <section className="px-4">
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
        >
          {e.amount && (
            <InfoRow
              label="보상"
              value={e.amount}
              highlight
              isLast={false}
            />
          )}
          <InfoRow
            label="이벤트 기간"
            value={`${e.start_date} ~ ${e.end_date}`}
            isLast={!e.reward_date}
          />
          {e.reward_date && (
            <InfoRow
              label="지급일"
              value={e.reward_date}
              isLast={true}
            />
          )}
          <div
            className="flex items-center justify-between px-5 py-4"
            style={{ borderTop: '1px solid #F2F4F6' }}
          >
            <span className="text-[13px]" style={{ color: '#6B7684' }}>API 자동 거래</span>
            <span
              className="text-[12px] font-semibold px-2.5 py-1 rounded-full"
              style={e.api_allowed
                ? { background: '#E6F9EE', color: '#007A30' }
                : { background: '#F2F4F6', color: '#6B7684' }
              }
            >
              {e.api_allowed ? '허용' : '불가'}
            </span>
          </div>
        </div>
      </section>

      {/* 상세 안내 */}
      {e.notes && (
        <section className="px-4">
          <p className="text-[13px] font-semibold mb-2 px-1" style={{ color: '#6B7684' }}>상세 안내</p>
          <div
            className="rounded-2xl p-5"
            style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
          >
            <p
              className="text-[14px] leading-relaxed whitespace-pre-wrap break-keep"
              style={{ color: '#191F28' }}
            >
              {e.notes}
            </p>
          </div>
        </section>
      )}

      {/* 거래소 공지 링크 */}
      {e.link && (
        <section className="px-4">
          <a
            href={e.link}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-2xl p-4 text-center text-[15px] font-semibold active:opacity-80 transition-opacity"
            style={{ background: '#0064FF', color: '#fff' }}
          >
            거래소 공지 보기 ↗
          </a>
        </section>
      )}

      {/* 즉시 거래 바로가기 */}
      {e.api_allowed && (
        <section className="px-4">
          <Link
            href={`/app/trade?tab=instant&coin=${e.coin}`}
            className="block rounded-2xl p-4 text-center text-[15px] font-semibold active:opacity-80 transition-opacity break-keep"
            style={{ background: '#191F28', color: '#fff' }}
          >
            ⚡ {e.coin} 즉시 거래하기
          </Link>
        </section>
      )}
    </div>
  )
}

function InfoRow({
  label, value, highlight, isLast,
}: {
  label: string
  value: string
  highlight?: boolean
  isLast: boolean
}) {
  return (
    <div
      className="flex items-start justify-between px-5 py-4 break-keep"
      style={!isLast ? { borderBottom: '1px solid #F2F4F6' } : undefined}
    >
      <span className="text-[13px] shrink-0 mr-4" style={{ color: '#6B7684' }}>{label}</span>
      <span
        className="text-[14px] font-semibold text-right"
        style={{ color: highlight ? '#0064FF' : '#191F28' }}
      >
        {value}
      </span>
    </div>
  )
}
