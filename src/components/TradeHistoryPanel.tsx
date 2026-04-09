'use client'

import { useState, useEffect } from 'react'
import { EXCHANGE_LABELS, EXCHANGE_EMOJI } from '@/types/database'
import type { Exchange } from '@/types/database'
import type { TradeHistoryItem } from '@/lib/exchange'

const EXCHANGES = Object.keys(EXCHANGE_LABELS) as Exchange[]

type QuickFilter = '오늘' | '7일' | '30일'
const QUICK_FILTERS: QuickFilter[] = ['오늘', '7일', '30일']

interface Account { id: string; account_name: string }

function formatDatetime(dt: string) {
  try {
    return new Date(dt).toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul',
      month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
      hour12: false,
    })
  } catch { return dt.slice(0, 16) }
}

function toKSTDate(date: Date): string {
  return new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
    .toISOString().slice(0, 10)
}

function getQuickRange(filter: QuickFilter): { from: string; to: string } {
  const now = new Date()
  const to = toKSTDate(now)
  if (filter === '오늘') return { from: to, to }
  if (filter === '7일') {
    const d = new Date(now); d.setDate(d.getDate() - 6)
    return { from: toKSTDate(d), to }
  }
  if (filter === '30일') {
    const d = new Date(now); d.setDate(d.getDate() - 29)
    return { from: toKSTDate(d), to }
  }
  return { from: '', to: '' }
}

interface TradeHistoryPanelProps {
  defaultExchange?: string | null
  onExchangeChange?: (ex: string) => void
}

export default function TradeHistoryPanel({ defaultExchange, onExchangeChange }: TradeHistoryPanelProps) {
  const [exchange, setExchange] = useState<Exchange | null>((defaultExchange as Exchange) ?? null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [history, setHistory] = useState<TradeHistoryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // 날짜 필터
  const [quickFilter, setQuickFilter] = useState<QuickFilter | null>(null)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // 거래소 변경 → 계정 목록 로드
  useEffect(() => {
    if (!exchange) { setAccounts([]); setSelectedAccountId(null); setHistory([]); return }
    fetch(`/api/accounts?exchange=${exchange}`)
      .then((r) => r.json())
      .then((data) => setAccounts(Array.isArray(data) ? data : []))
      .catch(() => setAccounts([]))
    setSelectedAccountId(null)
    setHistory([])
    setError('')
  }, [exchange])

  async function fetchHistory(accountId: string, coin?: string) {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ exchange: exchange!, accountId })
      if (coin) params.set('coin', coin)
      const res = await fetch(`/api/trade-history?${params}`)
      const data = await res.json()
      if (!res.ok) { setError(data.error || '조회 실패'); return }
      setHistory(Array.isArray(data) ? data : [])
    } catch { setError('네트워크 오류가 발생했습니다.') }
    finally { setLoading(false) }
  }

  function handleAccountSelect(id: string) {
    setSelectedAccountId(id)
    // 계정 선택 시 [오늘] 기본 적용
    const { from, to } = getQuickRange('오늘')
    setQuickFilter('오늘')
    setDateFrom(from)
    setDateTo(to)
    fetchHistory(id)
  }

  function handleQuickFilter(f: QuickFilter) {
    setQuickFilter(f)
    const { from, to } = getQuickRange(f)
    setDateFrom(from)
    setDateTo(to)
  }

  function handleDateChange(from: string, to: string) {
    setDateFrom(from)
    setDateTo(to)
    setQuickFilter(null) // 직접 입력 시 빠른선택 해제
  }

  // 날짜 필터 적용
  const filteredHistory = history.filter((item) => {
    if (!dateFrom && !dateTo) return true
    try {
      const itemDate = toKSTDate(new Date(item.datetime))
      if (dateFrom && itemDate < dateFrom) return false
      if (dateTo && itemDate > dateTo) return false
    } catch { return true }
    return true
  })

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <h2 className="mb-4 text-base font-semibold text-gray-900">거래 내역</h2>

      {/* 거래소 선택 */}
      <div className="mb-3 flex flex-wrap gap-2">
        {EXCHANGES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => { setExchange(ex); onExchangeChange?.(ex) }}
            className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-sm transition ${
              exchange === ex ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <span>{EXCHANGE_EMOJI[ex]}</span>
            {EXCHANGE_LABELS[ex]}
          </button>
        ))}
      </div>


      {/* 계정 선택 */}
      {exchange && accounts.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {accounts.map((acc) => (
            <button
              key={acc.id}
              type="button"
              onClick={() => handleAccountSelect(acc.id)}
              className={`rounded-full px-3 py-1 text-sm transition ${
                selectedAccountId === acc.id
                  ? 'bg-gray-800 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {acc.account_name}
            </button>
          ))}
        </div>
      )}
      {exchange && accounts.length === 0 && (
        <p className="mb-3 text-sm text-gray-400">등록된 계정이 없습니다.</p>
      )}

      {/* 날짜 필터 — 계정 선택 후 표시 */}
      {selectedAccountId && (
        <div className="mb-4 rounded-lg bg-gray-50 p-3">
          {/* 빠른 선택 */}
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            {QUICK_FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => handleQuickFilter(f)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  quickFilter === f ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                }`}
              >
                {f}
              </button>
            ))}
            <span className="text-xs text-gray-400">* 조회구간은 30일까지 설정 가능합니다.</span>
          </div>
          {/* 기간 직접 입력 */}
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => handleDateChange(e.target.value, dateTo)}
              className="rounded border border-gray-200 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
            />
            <span>~</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => handleDateChange(dateFrom, e.target.value)}
              className="rounded border border-gray-200 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
            />
            {(dateFrom || dateTo) && (
              <button
                onClick={() => { setDateFrom(''); setDateTo(''); setQuickFilter(null) }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      )}

      {/* 안내 메시지 */}
      {!exchange && <p className="text-sm text-gray-400">거래소를 선택해주세요.</p>}
      {exchange && !selectedAccountId && accounts.length > 0 && (
        <p className="text-sm text-gray-400">계정을 선택해주세요.</p>
      )}

      {/* 로딩 */}
      {loading && (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-8 animate-pulse rounded bg-gray-100" />
          ))}
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      {/* 거래 내역 테이블 */}
      {!loading && filteredHistory.length > 0 && (
        <>
          <div className="mb-1 text-right text-xs text-gray-400">{filteredHistory.length}건</div>
          {/* PC 테이블 */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-xs text-gray-500">
                  <th className="pb-2 pr-3">거래일시</th>
                  <th className="pb-2 pr-3">자산</th>
                  <th className="pb-2 pr-3">구분</th>
                  <th className="pb-2 pr-3 text-right">수량</th>
                  <th className="pb-2 text-right">금액</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map((item) => (
                  <tr key={item.id} className="border-b border-gray-50">
                    <td className="py-2 pr-3 text-xs text-gray-500">{formatDatetime(item.datetime)}</td>
                    <td className="py-2 pr-3 font-medium">{item.coin}/KRW</td>
                    <td className="py-2 pr-3">
                      <span className={`font-medium ${item.side === 'buy' ? 'text-red-500' : 'text-blue-500'}`}>
                        {item.side === 'buy' ? '매수' : '매도'}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-right text-xs">
                      {item.quantity.toFixed(8).replace(/\.?0+$/, '') || '0'}
                    </td>
                    <td className="py-2 text-right text-xs">
                      {item.total > 0 ? `${Math.floor(item.total).toLocaleString()}원` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* 모바일 카드 */}
          <div className="sm:hidden space-y-2">
            {filteredHistory.map((item) => (
              <div key={item.id} className="rounded-lg border border-gray-100 px-3 py-2">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="font-bold">{item.coin}/KRW</span>
                    <span className={`font-medium ${item.side === 'buy' ? 'text-red-500' : 'text-blue-500'}`}>
                      {item.side === 'buy' ? '매수' : '매도'}
                    </span>
                  </div>
                  <span className="text-xs text-gray-600">
                    {item.total > 0 ? `${Math.floor(item.total).toLocaleString()}원` : '-'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-gray-400">
                  <span>{formatDatetime(item.datetime)}</span>
                  <span>{item.quantity.toFixed(8).replace(/\.?0+$/, '') || '0'}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {!loading && selectedAccountId && filteredHistory.length === 0 && !error && history.length > 0 && (
        <p className="text-sm text-gray-400">선택한 기간에 거래 내역이 없습니다.</p>
      )}
      {!loading && selectedAccountId && history.length === 0 && !error && (
        <p className="text-sm text-gray-400">거래 내역이 없습니다.</p>
      )}
    </section>
  )
}
