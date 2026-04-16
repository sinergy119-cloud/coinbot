'use client'

import { useState, useEffect, useMemo } from 'react'
import { Trash2, Pencil, X } from 'lucide-react'
import { EXCHANGE_LABELS, EXCHANGE_EMOJI } from '@/types/database'
import type { Exchange } from '@/types/database'
import type { CrawledPrefill } from '@/components/AdminTabs'

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
  reward_date: string | null
}

interface CoinInfo { code: string; name: string }

interface Props {
  prefill?: CrawledPrefill | null
  onClearPrefill?: () => void
}

export default function EventManager({ prefill, onClearPrefill }: Props) {
  const [events, setEvents] = useState<Announcement[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)

  // 폼 상태
  const [exchange, setExchange] = useState<Exchange | null>(null)
  const [coin, setCoin] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [rewardDate, setRewardDate] = useState('')
  const [amount, setAmount] = useState('1만원(일일)')
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

  function resetForm(keepPrefill = false) {
    setEditingId(null)
    setExchange(null); setCoin(''); setAmount('1만원(일일)'); setRequireApply(false); setApiAllowed(true)
    setLink(''); setNotes(''); setStartDate(''); setEndDate(''); setRewardDate(''); setAllCoins([])
    if (!keepPrefill) onClearPrefill?.()
  }

  // ── prefill 주입: 수집 이벤트 승인 시 기본값 채움
  useEffect(() => {
    if (!prefill) return
    // 거래소 세팅
    const ex = prefill.exchange as Exchange
    setExchange(ex)
    // 코인 — preview API가 추출한 코드가 있으면 사용, 없으면 빈 값
    setCoin(prefill.coin ?? '')
    // 이벤트 링크
    setLink(prefill.link ?? '')
    // 특이사항 — 비워두기 (직접 입력)
    setNotes('')
    // 금액 — 추출 값 우선, 없으면 기본값
    setAmount(prefill.amount ?? '1만원(일일)')
    setRequireApply(prefill.requireApply ?? false)
    setApiAllowed(prefill.apiAllowed ?? true)
    // 기간 — 추출 값 우선
    setStartDate(prefill.startDate ?? '')
    setEndDate(prefill.endDate ?? '')
    setRewardDate(prefill.rewardDate ?? '')
    setEditingId(null)
    // 코인 자동완성용 목록 로드
    setCoinsLoading(true)
    fetch(`/api/markets?exchange=${ex}`)
      .then((r) => r.json())
      .then((data: CoinInfo[]) => Array.isArray(data) ? setAllCoins(data) : null)
      .catch(() => null)
      .finally(() => setCoinsLoading(false))
    // 폼 최상단으로 스크롤
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [prefill])

  function startEdit(ev: Announcement) {
    setEditingId(ev.id)
    setExchange(ev.exchange as Exchange)
    setCoin(ev.coin)
    setStartDate(ev.start_date)
    setEndDate(ev.end_date)
    setAmount(ev.amount ?? '')
    setRewardDate(ev.reward_date ?? '')
    setRequireApply(ev.require_apply)
    setApiAllowed(ev.api_allowed)
    setLink(ev.link ?? '')
    setNotes(ev.notes ?? '')
    onClearPrefill?.()
    setCoinsLoading(true)
    fetch(`/api/markets?exchange=${ev.exchange}`)
      .then((r) => r.json())
      .then((data: CoinInfo[]) => Array.isArray(data) ? setAllCoins(data) : null)
      .catch(() => null)
      .finally(() => setCoinsLoading(false))
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  useEffect(() => {
    fetchEvents()
  }, [])

  async function fetchEvents() {
    const res = await fetch('/api/announcements?all=true')
    if (res.ok) setEvents(await res.json())
  }

  function getTodayKST() {
    const kst = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
    return `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, '0')}-${String(kst.getDate()).padStart(2, '0')}`
  }

  function handleSetExchange(ex: Exchange) {
    setExchange(ex)
    if (!editingId) setCoin('')
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
      const url = editingId ? `/api/announcements/${editingId}` : '/api/announcements'
      const method = editingId ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exchange, coin, amount, requireApply, apiAllowed, link, notes, startDate, endDate, rewardDate,
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error || (editingId ? '수정 실패' : '등록 실패'))
        return
      }

      const responseData = await res.json()

      // prefill 모드: 수집 이벤트를 approved로 연결
      if (!editingId && prefill?.crawledEventId) {
        await fetch('/api/admin/crawled-events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'mark-approved',
            id: prefill.crawledEventId,
            announcementId: responseData?.id ?? null,
          }),
        })
        onClearPrefill?.()
      }

      setSuccess(editingId ? '이벤트 수정 완료' : '이벤트 등록 완료')
      resetForm(false)
      fetchEvents()
      setTimeout(() => setSuccess(''), 2000)
    } catch {
      setError('네트워크 오류')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('이벤트를 삭제하시겠습니까?')) return
    await fetch(`/api/announcements/${id}`, { method: 'DELETE' })
    fetchEvents()
  }

  const isPrefillMode = !!prefill && !editingId

  return (
    <div className="space-y-4">
      {/* 등록/수정 폼 */}
      <section className={`rounded-xl border p-4 ${
        isPrefillMode
          ? 'border-green-300 bg-green-50/30'
          : editingId
          ? 'border-blue-300 bg-blue-50/30'
          : 'border-gray-200 bg-white'
      }`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">
            {editingId ? '✏️ 이벤트 수정' : '📅 이벤트 등록'}
          </h2>
          {(editingId || isPrefillMode) && (
            <button type="button" onClick={() => resetForm(false)}
              className="flex items-center gap-1 rounded-lg bg-gray-200 px-3 py-1 text-xs text-gray-700 hover:bg-gray-300">
              <X size={12} /> 취소
            </button>
          )}
        </div>

        {/* 수집 이벤트 기반 배너 */}
        {isPrefillMode && (
          <div className="mb-3 rounded-lg bg-green-100 border border-green-200 px-3 py-2">
            <p className="text-xs font-medium text-green-800 break-keep">
              📌 수집 이벤트 기반 — 거래소·링크·특이사항이 자동 입력되었습니다.
            </p>
            <p className="mt-0.5 text-[11px] text-green-700 break-keep leading-relaxed line-clamp-2">
              {prefill.notes}
            </p>
          </div>
        )}

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
              코인 <span className="text-gray-500 font-normal">(코드 또는 이름 입력)</span>
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
                      <span className="text-gray-500 text-xs">{c.name}</span>
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

          {/* 리워드 지급일 */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              리워드 지급일 <span className="font-normal text-gray-500">(선택)</span>
            </label>
            <input type="date" value={rewardDate} onChange={(e) => setRewardDate(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900" />
          </div>

          {/* 금액 */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">금액</label>
            <input type="text" value={amount} onChange={(e) => setAmount(e.target.value)}
              placeholder="1만원(일일)"
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
            {loading
              ? (editingId ? '수정 중...' : '등록 중...')
              : (editingId ? '이벤트 수정' : '이벤트 등록')}
          </button>
        </form>
      </section>

      {/* 이벤트 리스트 */}
      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-base font-semibold text-gray-900">
          이벤트 리스트 <span className="text-sm font-normal text-gray-500">({events.length}건)</span>
        </h2>
        {events.length === 0 ? (
          <p className="text-sm text-gray-500">등록된 이벤트가 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {events.map((ev) => {
              const today = getTodayKST()
              const isCompleted = ev.end_date < today
              return (
                <div key={ev.id} className={`rounded-lg border border-gray-100 p-3 ${isCompleted ? 'opacity-60' : ''}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                        isCompleted ? 'bg-gray-200 text-gray-500' : 'bg-green-100 text-green-700'
                      }`}>
                        {isCompleted ? '완료' : '진행중'}
                      </span>
                      <span className="text-sm font-medium text-gray-900">
                        {EXCHANGE_EMOJI[ev.exchange as Exchange]} {EXCHANGE_LABELS[ev.exchange as Exchange]}
                      </span>
                      <span className="font-bold text-sm text-gray-900">{ev.coin}</span>
                      {ev.require_apply && (
                        <span className="rounded-full bg-amber-100 border border-amber-400 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                          🎟️ 이벤트 신청 필요
                        </span>
                      )}
                      {!ev.api_allowed && (
                        <span className="rounded-full bg-red-100 border border-red-400 px-2 py-0.5 text-[10px] font-semibold text-red-800">
                          ⛔ [API 거래 미허용] 거래소에서 거래
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => startEdit(ev)}
                        className="rounded p-1 text-gray-400 hover:bg-blue-50 hover:text-blue-600">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleDelete(ev.id)}
                        className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="text-xs text-gray-600 space-y-0.5">
                    <div>
                      📅 {ev.start_date} ~ {ev.end_date}
                      {ev.amount && <span className="ml-2">💰 <b>{ev.amount}</b></span>}
                    </div>
                    {ev.reward_date && (
                      <div>🎁 리워드 지급일: <b>{ev.reward_date}</b></div>
                    )}
                    {ev.link && (
                      <div>🔗 <a href={ev.link} target="_blank" rel="noopener noreferrer"
                        className="text-blue-600 underline">{ev.link.length > 40 ? ev.link.slice(0, 40) + '...' : ev.link}</a></div>
                    )}
                    {ev.notes && <div className="font-semibold text-red-600 animate-pulse">📝 {ev.notes}</div>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
