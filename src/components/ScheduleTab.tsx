'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronDown, ChevronUp, Bell } from 'lucide-react'
import { EXCHANGE_LABELS, EXCHANGE_EMOJI, TRADE_TYPE_LABELS } from '@/types/database'
import type { Exchange, TradeType, TradeJobRow } from '@/types/database'
import ScheduleList from '@/components/ScheduleList'

const EXCHANGES = Object.keys(EXCHANGE_LABELS) as Exchange[]
const TRADE_TYPES = Object.keys(TRADE_TYPE_LABELS) as TradeType[]

interface Account { id: string; account_name: string; exchange: string }

function getTodayKST() {
  const now = new Date()
  const kst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
  return `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, '0')}-${String(kst.getDate()).padStart(2, '0')}`
}

// ─── 알림 설정 섹션 ───────────────────────────────────────
function TelegramSettings() {
  const [chatId, setChatId] = useState('')
  const [savedId, setSavedId] = useState('')
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/user/profile')
      .then((r) => r.json())
      .then((d) => {
        const id = d.telegramChatId ?? ''
        setChatId(id)
        setSavedId(id)
        setOpen(!id)
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [])

  async function handleSave() {
    setSaving(true)
    await fetch('/api/user/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramChatId: chatId }),
    })
    setSaving(false)
    setSavedId(chatId)
    setSaved(true)
    if (chatId) setOpen(false)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleDelete() {
    setSaving(true)
    await fetch('/api/user/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramChatId: '' }),
    })
    setSaving(false)
    setChatId('')
    setSavedId('')
    setOpen(true)
  }

  if (!loaded) return null

  const isOn = !!savedId

  return (
    <div className="mb-4 rounded-lg border border-gray-200 bg-white">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-gray-700"
      >
        <span className="flex items-center gap-2">
          <Bell size={15} /> 텔레그램 알림 설정
          {isOn && <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">알림 ON</span>}
        </span>
        {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
      </button>
      {open && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-3">
          <p className="mb-2 text-xs text-gray-500">
            거래 실행 후 텔레그램으로 결과를 받으려면 Chat ID를 입력하세요.
          </p>
          <div className="mb-2 rounded bg-gray-50 p-2 text-xs text-gray-600">
            <p className="font-medium">Chat ID 확인 방법</p>
            <p>1. 텔레그램에서 <b>@userinfobot</b> 검색 → 시작</p>
            <p>2. 표시되는 숫자(ID)를 아래에 입력</p>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder="예: 123456789"
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
            <button
              onClick={handleSave}
              disabled={saving || !chatId.trim()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saved ? '저장됨 ✓' : saving ? '저장 중...' : '저장'}
            </button>
            {isOn && (
              <button
                onClick={handleDelete}
                disabled={saving}
                className="rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                삭제
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── 메인 ScheduleTab ─────────────────────────────────────
interface ScheduleTabProps {
  defaultExchange?: string | null
  onExchangeChange?: (ex: string) => void
}

export default function ScheduleTab({ defaultExchange, onExchangeChange }: ScheduleTabProps) {
  const today = getTodayKST()

  // 폼 상태
  const [exchange, setExchange] = useState<Exchange | null>((defaultExchange as Exchange) ?? null)
  const [exchangeTouched, setExchangeTouched] = useState(false)
  const [coin, setCoin] = useState('')
  const [tradeType, setTradeType] = useState<TradeType>('CYCLE')
  const [amountKrw, setAmountKrw] = useState(5100)
  const [amountDisplay, setAmountDisplay] = useState('5,100')
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [scheduleFrom, setScheduleFrom] = useState(today)
  const [scheduleTo, setScheduleTo] = useState(today)
  const [scheduleTime, setScheduleTime] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // 스케줄 목록
  const [jobs, setJobs] = useState<TradeJobRow[]>([])

  // 전체 계정 맵 (id → account_name)
  const [accountMap, setAccountMap] = useState<Record<string, string>>({})

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/trade-jobs')
      if (res.ok) setJobs(await res.json())
    } catch { /* 무시 */ }
  }, [])

  // 전체 계정 로드 (계정명 표시용)
  const fetchAllAccounts = useCallback(async () => {
    try {
      const res = await fetch('/api/accounts')
      if (res.ok) {
        const data: Account[] = await res.json()
        const map: Record<string, string> = {}
        data.forEach((a) => { map[a.id] = a.account_name })
        setAccountMap(map)
      }
    } catch { /* 무시 */ }
  }, [])

  useEffect(() => {
    fetchJobs()
    fetchAllAccounts()
  }, [fetchJobs, fetchAllAccounts])

  // 거래소 변경 → 계정 로드 (전체 디폴트 선택)
  useEffect(() => {
    if (!exchange) { setAccounts([]); setSelectedIds([]); return }
    fetch(`/api/accounts?exchange=${exchange}`)
      .then((r) => r.json())
      .then((data: Account[]) => {
        const list = Array.isArray(data) ? data : []
        setAccounts(list)
        setSelectedIds(list.map((a) => a.id))
      })
      .catch(() => setAccounts([]))
  }, [exchange])

  function toggleAccount(id: string) {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!exchange) { setExchangeTouched(true); setError('거래소를 선택해주세요.'); return }

    // cron 실행 여부 확인
    try {
      const cronRes = await fetch('/api/cron')
      const cronData = await cronRes.json()
      if (!cronData.running) {
        setError('⚠️ 스케줄러가 실행 중이 아닙니다. 터미널에서 node cron-local.js를 먼저 실행해주세요.')
        return
      }
    } catch {
      setError('⚠️ 스케줄러 상태를 확인할 수 없습니다. node cron-local.js가 실행 중인지 확인해주세요.')
      return
    }
    if (!coin.trim()) { setError('코인을 입력해주세요.'); return }
    if (tradeType !== 'SELL' && amountKrw < 5100) { setError('최소 거래 금액은 5,100원입니다.'); return }
    if (selectedIds.length === 0) { setError('계정을 1개 이상 선택해주세요.'); return }
    if (!scheduleFrom || !scheduleTo) { setError('실행 기간을 입력해주세요.'); return }
    if (!scheduleTime) { setError('실행 시간을 입력해주세요.'); return }
    if (scheduleFrom > scheduleTo) { setError('종료일이 시작일보다 앞설 수 없습니다.'); return }

    setSubmitting(true)
    try {
      const res = await fetch('/api/trade-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exchange,
          coin: coin.trim().toUpperCase(),
          tradeType,
          amountKrw: tradeType === 'SELL' ? 0 : amountKrw,
          accountIds: selectedIds,
          scheduleFrom,
          scheduleTo,
          scheduleTime,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || '등록 실패'); return }
      fetchJobs()
      // 폼 초기화
      setCoin('')
      setScheduleFrom(today)
      setScheduleTo(today)
      setScheduleTime('')
    } catch { setError('네트워크 오류가 발생했습니다.') }
    finally { setSubmitting(false) }
  }

  async function handleUpdate(id: string, data: { scheduleFrom: string; scheduleTo: string; scheduleTime: string }) {
    const res = await fetch(`/api/trade-jobs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (res.ok) fetchJobs()
    else alert('수정 실패')
  }

  async function handleDelete(id: string) {
    if (!confirm('이 스케줄을 삭제하시겠습니까?')) return
    const res = await fetch(`/api/trade-jobs/${id}`, { method: 'DELETE' })
    if (res.ok) fetchJobs()
    else alert('삭제 실패')
  }

  return (
    <div className="space-y-4">
      {/* 텔레그램 알림 설정 */}
      <TelegramSettings />

      {/* 스케줄 등록 폼 */}
      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="mb-4 text-base font-semibold text-gray-900">스케줄 등록</h2>
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* 거래소 */}
          <div>
            <label className={`mb-2 block text-sm font-medium ${!exchange ? 'text-red-600' : 'text-gray-700'}`}>
              거래소 {!exchange && <span className="animate-bounce inline-block">👆 먼저 선택해주세요</span>}
            </label>
            <div className={`flex flex-wrap gap-2 rounded-lg p-1 transition-all ${
              !exchange ? 'animate-pulse bg-red-50 ring-2 ring-red-300' : ''
            }`}>
              {EXCHANGES.map((ex) => (
                <button key={ex} type="button" onClick={() => { setExchange(ex); setExchangeTouched(false); onExchangeChange?.(ex) }}
                  className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-sm transition ${
                    exchange === ex ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {EXCHANGE_EMOJI[ex]} {EXCHANGE_LABELS[ex]}
                </button>
              ))}
            </div>
          </div>

          {/* 코인 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">코인</label>
            <input type="text" value={coin} onChange={(e) => setCoin(e.target.value.toUpperCase())}
              placeholder="예: BTC, ETH, USDT"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>

          {/* 거래 방식 */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              거래 방식 <span className="animate-pulse font-bold text-red-500 [animation-duration:1s]">(시장가)</span>
            </label>
            <div className="flex gap-4">
              {TRADE_TYPES.map((tt) => (
                <label key={tt} className="flex cursor-pointer items-center gap-1.5">
                  <input type="radio" name="tradeType" checked={tradeType === tt}
                    onChange={() => setTradeType(tt)} className="accent-blue-600" />
                  <span className="text-sm">{TRADE_TYPE_LABELS[tt]}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 거래 금액 (매도일 때 숨김) */}
          {tradeType === 'SELL' ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-sm text-amber-800">💰 보유 코인 전량을 시장가로 매도합니다</p>
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">거래 금액 (KRW)</label>
              <input type="text" inputMode="numeric" value={amountDisplay}
                onChange={(e) => {
                  const raw = e.target.value.replace(/,/g, '')
                  if (!/^\d*$/.test(raw)) return
                  const num = Number(raw)
                  setAmountKrw(num)
                  setAmountDisplay(num === 0 ? '' : num.toLocaleString())
                }}
                placeholder="5,100"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              <p className="mt-1 text-xs text-gray-400">최소 거래 금액: 5,100원</p>
            </div>
          )}

          {/* 계정 선택 */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">계정 선택</label>
            {!exchange && <p className="text-sm text-gray-400">거래소를 먼저 선택해주세요.</p>}
            {exchange && accounts.length === 0 && <p className="text-sm text-gray-400">등록된 계정이 없습니다.</p>}
            <div className="flex flex-wrap gap-2">
              {accounts.map((acc) => (
                <label key={acc.id} className="flex cursor-pointer items-center gap-1.5">
                  <input type="checkbox" checked={selectedIds.includes(acc.id)}
                    onChange={() => toggleAccount(acc.id)} className="accent-blue-600" />
                  <span className="text-sm">{acc.account_name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 실행 기간 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">실행 기간</label>
            <div className="flex items-center gap-2">
              <input type="date" value={scheduleFrom} onChange={(e) => setScheduleFrom(e.target.value)}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
              <span className="text-gray-400">~</span>
              <input type="date" value={scheduleTo} onChange={(e) => setScheduleTo(e.target.value)}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
            </div>
          </div>

          {/* 실행 시간 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">실행 시간 (KST)</label>
            <input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)}
              className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
          </div>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

          <button type="submit" disabled={submitting}
            className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {submitting ? '등록 중...' : '스케줄 등록'}
          </button>
        </form>
      </section>

      {/* 등록된 스케줄 목록 */}
      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-base font-semibold text-gray-900">
          등록된 스케줄 <span className="text-sm font-normal text-gray-400">({jobs.length}개)</span>
        </h2>
        <ScheduleList jobs={jobs} accountMap={accountMap} onDelete={handleDelete} />
      </section>
    </div>
  )
}
