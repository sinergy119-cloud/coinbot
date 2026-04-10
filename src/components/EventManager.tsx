'use client'

import { useState, useEffect, useMemo } from 'react'
import { Trash2 } from 'lucide-react'
import { EXCHANGE_LABELS, EXCHANGE_EMOJI } from '@/types/database'
import type { Exchange } from '@/types/database'

const EXCHANGES = Object.keys(EXCHANGE_LABELS) as Exchange[]

interface Announcement {
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
}

interface CoinInfo { code: string; name: string }

export default function EventManager() {
  const [events, setEvents] = useState<Announcement[]>([])

  // 폼 상태
  const [exchange, setExchange] = useState<Exchange | null>(null)
  const [coin, setCoin] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [amount, setAmount] = useState('')
  const [requireApply, setRequireApply] = useState(false)
  const [apiAllowed, setApiAllowed] = useState(true)
  const [link, setLink] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // 코인 자동완성
  const [allCoins, setAllCoins] = useState<CoinInfo[]>([])
  const [coinsLoading, setCoinsLoading] = useState(false)
  const [coinFocused, setCoinFocused] = useState(false)

  useEffect(() => {
    fetchEvents()
  }, [])

  async function fetchEvents() {
    const res = await fetch('/api/announcements')
    if (res.ok) setEvents(await res.json())
  }

  function handleSetExchange(ex: Exchange) {
    setExchange(ex)
    setCoin('')
    setAllCoins([])
    setCoinsLoading(true)
    fetch(`/api/markets?exchange=${ex}`)
      .then((r) => r.json())
      .then((data: CoinInfo[]) => Array.isArray(data) ? setAllCoins(data) : null)
      .catch(() => null)
      .finally(() => setCoinsLoading(false))
  }

  const coinSuggestions = useMemo(() => {
    if (coin.length < 1 || allCoins.length === 0) return []
    const upper = coin.toUpperCase()
    return allCoins.filter((c) => c.code.startsWith(upper) || c.name.includes(coin)).slice(0, 8)
  }, [coin, allCoins])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setSuccess('')
    if (!exchange || !coin.trim() || !startDate || !endDate) {
      setError('거래소, 코인, 기간은 필수입니다.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exchange, coin, amount, requireApply, apiAllowed, link, notes, startDate, endDate,
        }),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error || '등록 실패'); return }
      setSuccess('이벤트 등록 완료')
      setCoin(''); setAmount(''); setRequireApply(false); setApiAllowed(true)
      setLink(''); setNotes(''); setStartDate(''); setEndDate('')
      fetchEvents()
      setTimeout(() => setSuccess(''), 2000)
    } catch { setError('네트워크 오류') }
    finally { setLoading(false) }
  }

  async function handleDelete(id: string) {
    if (!confirm('이벤트를 삭제하시겠습니까?')) return
    await fetch(`/api/announcements/${id}`, { method: 'DELETE' })
    fetchEvents()
  }

  return (
    <div className="space-y-4">
      {/* 등록 폼 */}
      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="mb-4 text-base font-semibold text-gray-900">📅 이벤트 등록</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          {/* 거래소 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">거래소</label>
            <div className="flex flex-wrap gap-2">
              {EXCHANGES.map((ex) => (
                <button key={ex} type="button" onClick={() => handleSetExchange(ex)}
                  className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    exchange === ex ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}>
                  {EXCHANGE_EMOJI[ex]} {EXCHANGE_LABELS[ex]}
                </button>
              ))}
            </div>
          </div>

          {/* 코인 자동완성 */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              코인 <span className="text-gray-400 font-normal">(코드 또는 이름 입력)</span>
            </label>
            <div className="relative">
              <input type="text" value={coin}
                onChange={(e) => setCoin(e.target.value.toUpperCase())}
                onFocus={() => setCoinFocused(true)}
                onBlur={() => setTimeout(() => setCoinFocused(false), 150)}
                placeholder={!exchange ? '거래소를 먼저 선택' : coinsLoading ? '코인 목록 로딩 중...' : '예: BTC 또는 비트코인'}
                disabled={!exchange || coinsLoading}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none disabled:bg-gray-50" />
              {coinFocused && coinSuggestions.length > 0 && (
                <ul className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-48 overflow-y-auto">
                  {coinSuggestions.map((c) => (
                    <li key={c.code}
                      onMouseDown={() => { setCoin(c.code); setCoinFocused(false) }}
                      className="flex items-center gap-2 cursor-pointer px-3 py-2 text-sm hover:bg-blue-50">
                      <span className="font-semibold text-gray-900 w-16 shrink-0">{c.code}</span>
                      <span className="text-gray-400 text-xs">{c.name}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* 기간 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">시작일</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">종료일</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900" />
            </div>
          </div>

          {/* 금액 */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">금액</label>
            <input type="text" value={amount} onChange={(e) => setAmount(e.target.value)}
              placeholder="예: 일일 1만원"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900" />
          </div>

          {/* 이벤트 신청 */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">이벤트 신청 (사전 신청 여부)</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="radio" name="apply" checked={!requireApply} onChange={() => setRequireApply(false)} className="accent-blue-600" />
                <span className="text-sm text-gray-700">불필요</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="radio" name="apply" checked={requireApply} onChange={() => setRequireApply(true)} className="accent-amber-500" />
                <span className="text-sm text-gray-700">필요 ⚠️</span>
              </label>
            </div>
          </div>

          {/* API 허용 */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">API 허용 (거래소 API로 참여 가능)</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="radio" name="api" checked={apiAllowed} onChange={() => setApiAllowed(true)} className="accent-blue-600" />
                <span className="text-sm text-gray-700">Yes</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="radio" name="api" checked={!apiAllowed} onChange={() => setApiAllowed(false)} className="accent-red-500" />
                <span className="text-sm text-gray-700">No ⛔</span>
              </label>
            </div>
          </div>

          {/* 링크 */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">이벤트 링크</label>
            <input type="url" value={link} onChange={(e) => setLink(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900" />
          </div>

          {/* 특이사항 */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">특이사항</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900" />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}
          {success && <p className="text-xs text-green-600">{success}</p>}
          <button type="submit" disabled={loading}
            className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {loading ? '등록 중...' : '이벤트 등록'}
          </button>
        </form>
      </section>

      {/* 이벤트 목록 */}
      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-base font-semibold text-gray-900">
          진행 중인 이벤트 <span className="text-sm font-normal text-gray-400">({events.length}건)</span>
        </h2>
        {events.length === 0 ? (
          <p className="text-sm text-gray-400">등록된 이벤트가 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {events.map((ev) => (
              <div key={ev.id} className="rounded-lg border border-gray-100 p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">
                      {EXCHANGE_EMOJI[ev.exchange as Exchange]} {EXCHANGE_LABELS[ev.exchange as Exchange]}
                    </span>
                    <span className="font-bold text-sm">{ev.coin}</span>
                    {ev.require_apply && (
                      <span className="rounded-full bg-amber-100 border border-amber-400 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                        🎟️ 신청 필요
                      </span>
                    )}
                    {!ev.api_allowed && (
                      <span className="rounded-full bg-red-100 border border-red-400 px-2 py-0.5 text-[10px] font-semibold text-red-800">
                        ⛔ API 불가
                      </span>
                    )}
                  </div>
                  <button onClick={() => handleDelete(ev.id)}
                    className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600">
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="text-xs text-gray-500 space-y-0.5">
                  <div>📅 {ev.start_date} ~ {ev.end_date}</div>
                  {ev.amount && <div>💰 {ev.amount}</div>}
                  {ev.link && (
                    <div>🔗 <a href={ev.link} target="_blank" rel="noopener noreferrer"
                      className="text-blue-600 underline">{ev.link.length > 40 ? ev.link.slice(0, 40) + '...' : ev.link}</a></div>
                  )}
                  {ev.notes && <div className="text-gray-600">📝 {ev.notes}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
