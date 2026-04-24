'use client'

import Link from 'next/link'
import { useState } from 'react'
import { EXCHANGE_LABELS, type Exchange } from '@/types/database'

interface AnnouncementRow {
  id: string
  exchange: string
  coin: string
  amount: string | null
  require_apply: boolean
  api_allowed: boolean
  start_date: string
  end_date: string
}

const EXCHANGE_BADGE: Record<string, { bg: string; text: string }> = {
  BITHUMB: { bg: '#FFF0E6', text: '#C94B00' },
  UPBIT:   { bg: '#E6F0FF', text: '#0050CC' },
  COINONE: { bg: '#E6F9EE', text: '#007A30' },
  KORBIT:  { bg: '#F3EEFF', text: '#5B21B6' },
  GOPAX:   { bg: '#FFFBE6', text: '#946200' },
}

const EXCHANGE_ORDER: Exchange[] = ['BITHUMB', 'UPBIT', 'COINONE', 'KORBIT', 'GOPAX']

export default function EventsClient({ items }: { items: AnnouncementRow[] }) {
  const [filter, setFilter] = useState<string>('all')

  // 필터 칩 목록 (존재하는 거래소만)
  const existingExchanges = EXCHANGE_ORDER.filter((ex) => items.some((e) => e.exchange === ex))

  const filtered = filter === 'all' ? items : items.filter((e) => e.exchange === filter)

  return (
    <div className="min-h-full" style={{ background: '#F9FAFB' }}>

      {/* 헤더 */}
      <header className="px-4 pt-6 pb-3">
        <h1 className="text-[22px] font-bold break-keep" style={{ color: '#191F28' }}>
          진행 중인 이벤트
        </h1>
        <p className="text-[13px] mt-1" style={{ color: '#6B7684' }}>
          총 {items.length}건
        </p>
      </header>

      {/* 거래소 필터 칩 */}
      {existingExchanges.length > 0 && (
        <div className="px-4 pb-3 overflow-x-auto">
          <div className="flex gap-2 whitespace-nowrap pb-0.5">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className="px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all"
              style={filter === 'all'
                ? { background: '#0064FF', color: '#fff' }
                : { background: '#fff', color: '#6B7684', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }
              }
            >
              전체 {items.length}
            </button>
            {existingExchanges.map((ex) => {
              const count = items.filter((e) => e.exchange === ex).length
              const badge = EXCHANGE_BADGE[ex]
              const isActive = filter === ex
              return (
                <button
                  key={ex}
                  type="button"
                  onClick={() => setFilter(ex)}
                  className="px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all"
                  style={isActive
                    ? { background: badge.text, color: '#fff' }
                    : { background: '#fff', color: '#6B7684', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }
                  }
                >
                  {EXCHANGE_LABELS[ex]} {count}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* 이벤트 목록 */}
      <section className="px-4 pb-6 flex flex-col gap-3">
        {filtered.length === 0 ? (
          <div
            className="rounded-2xl p-10 text-center text-[14px] break-keep"
            style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', color: '#6B7684' }}
          >
            현재 진행 중인 이벤트가 없습니다.
          </div>
        ) : (
          filtered.map((e) => {
            const exchangeLabel = EXCHANGE_LABELS[e.exchange as Exchange] ?? e.exchange
            const badge = EXCHANGE_BADGE[e.exchange] ?? { bg: '#F2F4F6', text: '#6B7684' }
            const tradeParams = `exchange=${e.exchange}&coin=${encodeURIComponent(e.coin)}`
            return (
              <div
                key={e.id}
                className="rounded-2xl p-5 break-keep"
                style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
              >
                {/* 상단: 거래소 뱃지 + 종료일 */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: badge.bg, color: badge.text }}
                    >
                      {exchangeLabel}
                    </span>
                    {e.require_apply && (
                      <span
                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                        style={{ background: '#FFF9C4', color: '#7A6000' }}
                      >
                        신청필요
                      </span>
                    )}
                  </div>
                  <span className="text-[12px]" style={{ color: '#B0B8C1' }}>
                    ~ {e.end_date.slice(5).replace('-', '/')}
                  </span>
                </div>

                {/* 코인명 */}
                <Link href={`/app/events/${e.id}`} className="block">
                  <p className="text-[18px] font-bold" style={{ color: '#191F28' }}>{e.coin}</p>
                  {e.amount && (
                    <p className="text-[13px] mt-1" style={{ color: '#6B7684' }}>{e.amount}</p>
                  )}
                </Link>

                {/* CTA 버튼 */}
                <div className="flex gap-2 mt-3">
                  {e.api_allowed ? (
                    <Link
                      href={`/app/trade?tab=instant&${tradeParams}`}
                      className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-center active:opacity-80 transition-opacity"
                      style={{ background: '#0064FF', color: '#fff' }}
                    >
                      ⚡ 즉시 거래
                    </Link>
                  ) : (
                    <Link
                      href={`/app/events/${e.id}`}
                      className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-center active:opacity-80 transition-opacity"
                      style={{ background: '#F2F4F6', color: '#6B7684' }}
                    >
                      거래소 공지 보기
                    </Link>
                  )}
                  <Link
                    href={`/app/trade?tab=schedule&${tradeParams}`}
                    className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-center active:opacity-80 transition-opacity"
                    style={{ background: '#F2F4F6', color: '#191F28' }}
                  >
                    📅 스케줄 등록
                  </Link>
                </div>
              </div>
            )
          })
        )}
      </section>

    </div>
  )
}
