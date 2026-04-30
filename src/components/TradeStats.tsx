'use client'

import { useEffect, useState } from 'react'
import { EXCHANGE_LABELS } from '@/types/database'
import type { Exchange } from '@/types/database'

type Period = 'today' | '7d' | '30d' | 'all'

interface ExchangeStat {
  exchange: string
  total: number
  success: number
  fail: number
  successRate: number
}

interface SourceStat {
  source: string
  total: number
  success: number
  fail: number
  successRate: number
}

interface FailReason {
  reason: string
  count: number
}

interface StatsResponse {
  period: Period
  summary: { total: number; success: number; fail: number; successRate: number; totalAmountKrw: number }
  exchangeStats: ExchangeStat[]
  sourceStats: SourceStat[]
  topFailReasons: FailReason[]
}

const PERIOD_OPTIONS: { id: Period; label: string }[] = [
  { id: 'today', label: '오늘' },
  { id: '7d', label: '7일' },
  { id: '30d', label: '30일' },
  { id: 'all', label: '전체' },
]

const SOURCE_LABELS: Record<string, string> = {
  immediate: '웹 즉시',
  manual: '웹 수동',
  app_manual: '앱 수동',
  app_schedule: '앱 스케줄',
  schedule: '서버 크론',
  unknown: '미상',
}

function formatKRW(n: number): string {
  return n.toLocaleString('ko-KR')
}

export default function TradeStats() {
  const [period, setPeriod] = useState<Period>('7d')
  const [data, setData] = useState<StatsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/api/admin/trade-stats?period=${period}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((d: StatsResponse) => {
        if (!cancelled) setData(d)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : '조회 실패')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [period])

  return (
    <div className="space-y-4">
      {/* 기간 선택 */}
      <div className="flex gap-2">
        {PERIOD_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            onClick={() => setPeriod(opt.id)}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
              period === opt.id
                ? 'border-purple-600 bg-purple-50 text-purple-700'
                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
          불러오는 중…
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 break-keep">
          조회 실패: {error}
        </div>
      )}

      {data && !loading && (
        <>
          {/* 요약 */}
          <section className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-bold text-gray-900">전체 요약</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded border border-gray-100 bg-gray-50 p-3">
                <div className="text-xs text-gray-600">총 거래</div>
                <div className="mt-1 text-lg font-bold text-gray-900">{formatKRW(data.summary.total)}건</div>
              </div>
              <div className="rounded border border-gray-100 bg-gray-50 p-3">
                <div className="text-xs text-gray-600">성공률</div>
                <div className="mt-1 text-lg font-bold text-gray-900">{data.summary.successRate}%</div>
              </div>
              <div className="rounded border border-gray-100 bg-gray-50 p-3">
                <div className="text-xs text-gray-600">성공 / 실패</div>
                <div className="mt-1 text-sm font-bold text-gray-900">
                  <span className="text-blue-600">{formatKRW(data.summary.success)}</span>
                  <span className="mx-1 text-gray-400">/</span>
                  <span className="text-red-600">{formatKRW(data.summary.fail)}</span>
                </div>
              </div>
              <div className="rounded border border-gray-100 bg-gray-50 p-3">
                <div className="text-xs text-gray-600">성공 거래액</div>
                <div className="mt-1 text-lg font-bold text-gray-900">{formatKRW(data.summary.totalAmountKrw)}원</div>
              </div>
            </div>
          </section>

          {/* 거래소별 */}
          <section className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-bold text-gray-900">거래소별</h3>
            {data.exchangeStats.length === 0 ? (
              <div className="text-sm text-gray-500">데이터 없음</div>
            ) : (
              <div className="space-y-2">
                {data.exchangeStats
                  .sort((a, b) => b.total - a.total)
                  .map((s) => {
                    const label = EXCHANGE_LABELS[s.exchange as Exchange] ?? s.exchange
                    return (
                      <div key={s.exchange} className="flex items-center justify-between rounded border border-gray-100 bg-gray-50 p-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">{label}</span>
                          <span className="text-xs text-gray-600">{formatKRW(s.total)}건</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-blue-600">성공 {s.success}</span>
                          <span className="text-red-600">실패 {s.fail}</span>
                          <span className="font-bold text-gray-900">{s.successRate}%</span>
                        </div>
                      </div>
                    )
                  })}
              </div>
            )}
          </section>

          {/* 소스별 */}
          <section className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-bold text-gray-900">실행 소스별</h3>
            {data.sourceStats.length === 0 ? (
              <div className="text-sm text-gray-500">데이터 없음</div>
            ) : (
              <div className="space-y-2">
                {data.sourceStats
                  .sort((a, b) => b.total - a.total)
                  .map((s) => (
                    <div key={s.source} className="flex items-center justify-between rounded border border-gray-100 bg-gray-50 p-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">
                          {SOURCE_LABELS[s.source] ?? s.source}
                        </span>
                        <span className="text-xs text-gray-600">{formatKRW(s.total)}건</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-blue-600">성공 {s.success}</span>
                        <span className="text-red-600">실패 {s.fail}</span>
                        <span className="font-bold text-gray-900">{s.successRate}%</span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </section>

          {/* 실패 사유 TOP 5 */}
          <section className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-bold text-gray-900">실패 사유 TOP 5</h3>
            {data.topFailReasons.length === 0 ? (
              <div className="text-sm text-gray-500">실패 없음</div>
            ) : (
              <div className="space-y-2">
                {data.topFailReasons.map((r, i) => (
                  <div key={i} className="flex items-start justify-between gap-3 rounded border border-gray-100 bg-gray-50 p-3">
                    <span className="flex-1 text-xs text-gray-700 break-keep" style={{ wordBreak: 'keep-all', overflowWrap: 'break-word' }}>
                      {r.reason}
                    </span>
                    <span className="shrink-0 text-xs font-bold text-red-600">{r.count}회</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
