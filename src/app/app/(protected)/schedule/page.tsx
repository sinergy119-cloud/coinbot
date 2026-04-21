'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import PinPad from '../../_components/PinPad'
import KeySelector from '../../_components/KeySelector'
import { verifyPin, decryptAllByIds } from '@/lib/app/key-store'
import { EXCHANGE_LABELS, TRADE_TYPE_LABELS, type Exchange, type TradeType } from '@/types/database'

type Mode = 'list' | 'instant' | 'new'

function ScheduleInner() {
  const router = useRouter()
  const params = useSearchParams()
  const mode = (params.get('mode') as Mode) ?? 'list'

  if (mode === 'instant') return <InstantForm onDone={() => router.push('/app/schedule')} />
  if (mode === 'new') return <ScheduleForm onDone={() => router.push('/app/schedule')} />
  return <ScheduleList />
}

export default function SchedulePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-gray-600">불러오는 중...</div>}>
      <ScheduleInner />
    </Suspense>
  )
}

// ────────────────────────────────────────
// 스케줄 목록
// ────────────────────────────────────────

interface JobItem {
  id: string
  exchange: Exchange
  coin: string
  tradeType: TradeType
  amountKrw: number
  scheduleFrom: string
  scheduleTo: string
  scheduleTime: string
  status: string
  lastExecutedAt: string | null
  isAppJob: boolean
}

function ScheduleList() {
  const [items, setItems] = useState<JobItem[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/app/trade-jobs')
      const json = await res.json()
      if (json.ok) setItems(json.data.items)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  async function cancel(id: string) {
    if (!confirm('이 스케줄을 취소하시겠습니까?')) return
    await fetch(`/api/app/trade-jobs/${id}`, { method: 'DELETE' })
    await load()
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="px-4 pt-6 pb-2 break-keep">
        <h1 className="text-2xl font-bold text-gray-900">스케줄</h1>
        <p className="text-sm text-gray-600 mt-1">즉시 매수 또는 예약 거래</p>
      </header>

      <section className="px-4">
        <div className="grid grid-cols-2 gap-3">
          <a href="/app/schedule?mode=instant" className="bg-gray-900 text-white rounded-2xl p-4 flex flex-col items-center">
            <span className="text-2xl">⚡</span>
            <span className="text-sm font-semibold mt-1">즉시 매수</span>
          </a>
          <a href="/app/schedule?mode=new" className="bg-white border border-gray-200 rounded-2xl p-4 flex flex-col items-center">
            <span className="text-2xl">📅</span>
            <span className="text-sm font-semibold text-gray-900 mt-1">스케줄 등록</span>
          </a>
        </div>
      </section>

      <section className="px-4">
        <h2 className="text-base font-bold text-gray-900 mb-2">내 스케줄</h2>
        {loading ? (
          <div className="bg-white rounded-2xl p-6 text-center text-sm text-gray-600">불러오는 중...</div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center text-sm text-gray-600 break-keep">등록된 스케줄이 없습니다.</div>
        ) : (
          <div className="flex flex-col gap-2">
            {items.map((j) => (
              <div key={j.id} className="bg-white rounded-2xl p-4 flex items-start justify-between gap-3 break-keep">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-600 font-semibold">
                    {EXCHANGE_LABELS[j.exchange] ?? j.exchange} · {TRADE_TYPE_LABELS[j.tradeType]}
                  </p>
                  <p className="text-base font-bold text-gray-900 mt-0.5">{j.coin}</p>
                  {j.tradeType !== 'SELL' && (
                    <p className="text-sm text-gray-700 mt-0.5">{j.amountKrw.toLocaleString()}원</p>
                  )}
                  <p className="text-xs text-gray-600 mt-1">
                    {j.scheduleFrom} ~ {j.scheduleTo} · {j.scheduleTime}
                  </p>
                  <p className="text-[10px] text-gray-600 mt-1">
                    {j.isAppJob ? '📱 앱 실행' : '🌐 서버 실행'} · {j.status}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => cancel(j.id)}
                  className="shrink-0 text-xs text-red-600 font-semibold px-3 py-1.5"
                >
                  취소
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

// ────────────────────────────────────────
// 즉시 매수 폼
// ────────────────────────────────────────

const EXCHANGES: Exchange[] = ['BITHUMB', 'UPBIT', 'COINONE', 'KORBIT', 'GOPAX']
const TRADE_TYPES: TradeType[] = ['BUY', 'SELL', 'CYCLE']

function InstantForm({ onDone }: { onDone: () => void }) {
  const [exchange, setExchange] = useState<Exchange>('BITHUMB')
  const [coin, setCoin] = useState('')
  const [tradeType, setTradeType] = useState<TradeType>('BUY')
  const [amountKrw, setAmountKrw] = useState('')
  const [selectedKeyIds, setSelectedKeyIds] = useState<string[]>([])
  const [phase, setPhase] = useState<'form' | 'pin' | 'executing' | 'result'>('form')
  const [pinError, setPinError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  interface BatchResult { label: string | null; ok: boolean; balanceBefore: number; balance: number; error?: string }
  const [result, setResult] = useState<BatchResult[] | null>(null)

  function validate(): string | null {
    if (!coin.trim()) return '코인을 입력하세요.'
    if (selectedKeyIds.length === 0) return '계정을 선택하세요.'
    if (tradeType !== 'SELL') {
      const n = Number(amountKrw)
      if (!Number.isFinite(n) || n < 5100) return '최소 금액은 5,100원입니다.'
    }
    return null
  }

  async function handleStart() {
    const err = validate()
    if (err) { alert(err); return }
    setPinError(null)
    setPhase('pin')
  }

  async function handlePin(pin: string) {
    setSubmitting(true)
    setPinError(null)
    try {
      const v = await verifyPin(pin)
      if (!v.ok) {
        if (v.reason === 'locked') {
          const min = Math.ceil((v.retryAfterMs ?? 0) / 60000)
          setPinError(`잠금 상태입니다. ${min}분 후 재시도.`)
        } else {
          setPinError('PIN이 틀립니다.')
        }
        return
      }
      // 키 복호화
      const decrypted = await decryptAllByIds(pin, selectedKeyIds)
      setPhase('executing')

      const res = await fetch('/api/app/proxy/execute-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exchange,
          coin: coin.trim().toUpperCase(),
          tradeType,
          amountKrw: tradeType === 'SELL' ? 0 : Number(amountKrw),
          accounts: decrypted.map((d) => ({ label: d.label, accessKey: d.accessKey, secretKey: d.secretKey })),
        }),
      })
      const json = await res.json()
      if (json.ok) {
        setResult(json.data.results)
        setPhase('result')
      } else {
        setPinError(json.error ?? '실행 실패')
        setPhase('pin')
      }
    } catch (err) {
      setPinError(err instanceof Error ? err.message : '오류')
      setPhase('pin')
    } finally {
      setSubmitting(false)
    }
  }

  if (phase === 'pin') {
    return (
      <PinPad
        title="PIN 입력"
        description="거래 실행을 위해 PIN을 입력해주세요."
        errorMessage={pinError}
        onSubmit={handlePin}
        onCancel={() => setPhase('form')}
        submitting={submitting}
      />
    )
  }

  if (phase === 'executing') {
    return (
      <div className="p-8 text-center">
        <p className="text-2xl">⏳</p>
        <p className="text-sm text-gray-900 font-semibold mt-3">거래 실행 중...</p>
      </div>
    )
  }

  if (phase === 'result' && result) {
    const successCount = result.filter((r) => r.ok).length
    return (
      <div className="flex flex-col gap-4 px-4 py-4">
        <h2 className="text-xl font-bold text-gray-900 break-keep">거래 결과</h2>
        <p className="text-sm text-gray-700">{successCount}건 성공 / {result.length - successCount}건 실패</p>
        <div className="flex flex-col gap-2">
          {result.map((r, i) => (
            <div key={i} className={`p-4 rounded-2xl ${r.ok ? 'bg-green-50' : 'bg-red-50'} break-keep`}>
              <p className="text-sm font-semibold text-gray-900">{r.ok ? '✅' : '❌'} {r.label ?? '계정'}</p>
              {!r.ok && <p className="text-xs text-red-700 mt-1">{r.error}</p>}
              {r.ok && (
                <p className="text-xs text-gray-700 mt-1">
                  잔액 {Math.floor(r.balanceBefore).toLocaleString()}원 → {Math.floor(r.balance).toLocaleString()}원
                </p>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={onDone}
          className="bg-gray-900 text-white py-3 rounded-2xl text-sm font-semibold mt-2"
        >
          스케줄 목록으로
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-2">
      <header className="pt-4 break-keep">
        <h1 className="text-2xl font-bold text-gray-900">즉시 매수</h1>
        <p className="text-sm text-gray-700 mt-1">지금 바로 거래를 실행합니다.</p>
      </header>

      <FormFields
        exchange={exchange} setExchange={setExchange}
        coin={coin} setCoin={setCoin}
        tradeType={tradeType} setTradeType={setTradeType}
        amountKrw={amountKrw} setAmountKrw={setAmountKrw}
      />

      <div>
        <label className="text-xs text-gray-700 font-semibold">계정 선택 (복수)</label>
        <div className="mt-1">
          <KeySelector exchange={exchange} multi={true} value={selectedKeyIds} onChange={setSelectedKeyIds} />
        </div>
      </div>

      <div className="flex gap-2 mt-2">
        <button
          type="button"
          onClick={onDone}
          className="flex-1 py-3 bg-white rounded-xl text-sm font-semibold text-gray-700"
        >
          취소
        </button>
        <button
          type="button"
          onClick={handleStart}
          className="flex-[2] py-3 bg-gray-900 rounded-xl text-sm font-semibold text-white"
        >
          실행
        </button>
      </div>
    </div>
  )
}

// ────────────────────────────────────────
// 스케줄 등록 폼
// ────────────────────────────────────────

function ScheduleForm({ onDone }: { onDone: () => void }) {
  const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const [exchange, setExchange] = useState<Exchange>('BITHUMB')
  const [coin, setCoin] = useState('')
  const [tradeType, setTradeType] = useState<TradeType>('BUY')
  const [amountKrw, setAmountKrw] = useState('')
  const [scheduleFrom, setScheduleFrom] = useState(todayStr)
  const [scheduleTo, setScheduleTo] = useState(todayStr)
  const [scheduleTime, setScheduleTime] = useState('09:00')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!coin.trim()) return setError('코인을 입력하세요.')
    if (tradeType !== 'SELL' && Number(amountKrw) < 5100) return setError('최소 금액은 5,100원입니다.')

    setSubmitting(true)
    try {
      const res = await fetch('/api/app/trade-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exchange,
          coin: coin.trim().toUpperCase(),
          tradeType,
          amountKrw: tradeType === 'SELL' ? 0 : Number(amountKrw),
          accountIds: [], // 앱 사용자 — 실행 시점에 FCM으로 트리거
          scheduleFrom,
          scheduleTo,
          scheduleTime,
        }),
      })
      const json = await res.json()
      if (json.ok) {
        alert('스케줄 등록 완료. 예약 시간에 푸시 알림을 받아 거래가 실행됩니다.')
        onDone()
      } else {
        setError(json.error ?? '등록 실패')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4 py-2">
      <header className="pt-4 break-keep">
        <h1 className="text-2xl font-bold text-gray-900">스케줄 등록</h1>
        <p className="text-sm text-gray-700 mt-1">
          예약 시간에 앱으로 푸시를 받아 거래가 실행됩니다.<br />
          실행 시점에 앱이 켜져있고 알림이 허용되어 있어야 합니다.
        </p>
      </header>

      <FormFields
        exchange={exchange} setExchange={setExchange}
        coin={coin} setCoin={setCoin}
        tradeType={tradeType} setTradeType={setTradeType}
        amountKrw={amountKrw} setAmountKrw={setAmountKrw}
      />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-700 font-semibold">시작일</label>
          <input
            type="date"
            value={scheduleFrom}
            onChange={(e) => setScheduleFrom(e.target.value)}
            className="w-full mt-1 p-3 bg-white rounded-xl text-sm text-gray-900"
          />
        </div>
        <div>
          <label className="text-xs text-gray-700 font-semibold">종료일</label>
          <input
            type="date"
            value={scheduleTo}
            onChange={(e) => setScheduleTo(e.target.value)}
            className="w-full mt-1 p-3 bg-white rounded-xl text-sm text-gray-900"
          />
        </div>
      </div>
      <div>
        <label className="text-xs text-gray-700 font-semibold">실행 시간 (KST)</label>
        <input
          type="time"
          value={scheduleTime}
          onChange={(e) => setScheduleTime(e.target.value)}
          className="w-full mt-1 p-3 bg-white rounded-xl text-sm text-gray-900"
        />
      </div>

      {error && <p className="text-xs text-red-600 break-keep">{error}</p>}

      <div className="flex gap-2 mt-2">
        <button type="button" onClick={onDone} className="flex-1 py-3 bg-white rounded-xl text-sm font-semibold text-gray-700">
          취소
        </button>
        <button type="submit" disabled={submitting} className="flex-[2] py-3 bg-gray-900 rounded-xl text-sm font-semibold text-white disabled:opacity-50">
          {submitting ? '등록 중...' : '스케줄 등록'}
        </button>
      </div>
    </form>
  )
}

// ────────────────────────────────────────
// 공통 폼 필드
// ────────────────────────────────────────

function FormFields({ exchange, setExchange, coin, setCoin, tradeType, setTradeType, amountKrw, setAmountKrw }: {
  exchange: Exchange
  setExchange: (v: Exchange) => void
  coin: string
  setCoin: (v: string) => void
  tradeType: TradeType
  setTradeType: (v: TradeType) => void
  amountKrw: string
  setAmountKrw: (v: string) => void
}) {
  return (
    <>
      <div>
        <label className="text-xs text-gray-700 font-semibold">거래소</label>
        <select
          value={exchange}
          onChange={(e) => setExchange(e.target.value as Exchange)}
          className="w-full mt-1 p-3 bg-white rounded-xl text-sm text-gray-900 font-medium"
        >
          {EXCHANGES.map((ex) => (
            <option key={ex} value={ex}>{EXCHANGE_LABELS[ex]}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs text-gray-700 font-semibold">코인</label>
        <input
          type="text"
          value={coin}
          onChange={(e) => setCoin(e.target.value.toUpperCase())}
          placeholder="예: BTC"
          maxLength={20}
          className="w-full mt-1 p-3 bg-white rounded-xl text-sm text-gray-900 placeholder-gray-400 uppercase"
        />
      </div>

      <div>
        <label className="text-xs text-gray-700 font-semibold">거래 방식</label>
        <div className="grid grid-cols-3 gap-2 mt-1">
          {TRADE_TYPES.map((tt) => (
            <button
              key={tt}
              type="button"
              onClick={() => setTradeType(tt)}
              className={`py-3 rounded-xl text-sm font-semibold ${
                tradeType === tt ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 border border-gray-200'
              }`}
            >
              {TRADE_TYPE_LABELS[tt]}
            </button>
          ))}
        </div>
      </div>

      {tradeType !== 'SELL' && (
        <div>
          <label className="text-xs text-gray-700 font-semibold">금액 (KRW, 최소 5,100)</label>
          <input
            type="number"
            value={amountKrw}
            onChange={(e) => setAmountKrw(e.target.value)}
            placeholder="10000"
            min={5100}
            step={100}
            className="w-full mt-1 p-3 bg-white rounded-xl text-sm text-gray-900 placeholder-gray-400"
          />
        </div>
      )}
    </>
  )
}
