'use client'

import { useState, useEffect } from 'react'
import { Trash2 } from 'lucide-react'
import { EXCHANGE_LABELS, EXCHANGE_EMOJI } from '@/types/database'
import type { Exchange } from '@/types/database'

const EXCHANGES = Object.keys(EXCHANGE_LABELS) as Exchange[]

interface Announcement {
  id: string
  exchange: string
  coin: string
  title: string
  condition: string | null
  start_date: string
  end_date: string
}

export default function EventManager() {
  const [events, setEvents] = useState<Announcement[]>([])
  const [exchange, setExchange] = useState<Exchange | null>(null)
  const [coin, setCoin] = useState('')
  const [title, setTitle] = useState('')
  const [condition, setCondition] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    fetchEvents()
  }, [])

  async function fetchEvents() {
    const res = await fetch('/api/announcements')
    if (res.ok) setEvents(await res.json())
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setSuccess('')
    if (!exchange || !coin.trim() || !title.trim() || !startDate || !endDate) {
      setError('모든 필수 항목을 입력해주세요.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exchange, coin, title, condition, startDate, endDate }),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error || '등록 실패'); return }
      setSuccess('이벤트 등록 완료')
      setCoin(''); setTitle(''); setCondition(''); setStartDate(''); setEndDate('')
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
        <h2 className="mb-4 text-base font-semibold text-gray-900">이벤트 등록</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">거래소</label>
            <div className="flex flex-wrap gap-2">
              {EXCHANGES.map((ex) => (
                <button key={ex} type="button" onClick={() => setExchange(ex)}
                  className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    exchange === ex ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}>
                  {EXCHANGE_EMOJI[ex]} {EXCHANGE_LABELS[ex]}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">코인</label>
              <input type="text" value={coin} onChange={(e) => setCoin(e.target.value.toUpperCase())}
                placeholder="예: CROSS" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">조건</label>
              <input type="text" value={condition} onChange={(e) => setCondition(e.target.value)}
                placeholder="예: 일일 1만원 이상" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">제목</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="예: CROSS 에어드랍 이벤트" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">시작일</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">종료일</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
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
              <div key={ev.id} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2.5">
                <div>
                  <div className="flex items-center gap-2 text-sm">
                    <span>{EXCHANGE_EMOJI[ev.exchange as Exchange]} {EXCHANGE_LABELS[ev.exchange as Exchange]}</span>
                    <span className="font-bold">{ev.coin}</span>
                    <span className="text-gray-500">·</span>
                    <span className="text-gray-600">{ev.title}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-gray-400">
                    {ev.start_date} ~ {ev.end_date}
                    {ev.condition && <span className="ml-2 text-amber-600">{ev.condition}</span>}
                  </div>
                </div>
                <button onClick={() => handleDelete(ev.id)}
                  className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
