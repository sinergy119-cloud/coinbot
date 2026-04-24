'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import PinPad from '../../_components/PinPad'
import KeySelector from '../../_components/KeySelector'
import { verifyPin, decryptAllByIds } from '@/lib/app/key-store'
import { EXCHANGE_LABELS, TRADE_TYPE_LABELS, type Exchange, type TradeType } from '@/types/database'

type Mode = 'list' | 'instant' | 'new'

// 거래소별 뱃지 색상
const EXCHANGE_BADGE: Record<string, { bg: string; text: string }> = {
  BITHUMB: { bg: '#FFF0E6', text: '#C94B00' },
  UPBIT:   { bg: '#E6F0FF', text: '#0050CC' },
  COINONE: { bg: '#E6F9EE', text: '#007A30' },
  KORBIT:  { bg: '#F3EEFF', text: '#5B21B6' },
  GOPAX:   { bg: '#FFFBE6', text: '#946200' },
}

const TRADE_TYPE_COLOR: Record<string, string> = {
  BUY:   '#0064FF',
  SELL:  '#FF4D4F',
  CYCLE: '#6B7684',
}

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
    <Suspense fallback={
      <div className="p-8 text-center text-[14px] break-keep" style={{ color: '#6B7684' }}>
        불러오는 중...
      </div>
    }>
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

const STATUS_LABEL: Record<string, string> = {
  active:    '진행 중',
  paused:    '일시정지',
  completed: '완료',
  cancelled: '취소됨',
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
    <div className="flex flex-col gap-5 pb-6" style={{ background: '#F9FAFB', minHeight: '100%' }}>

      {/* 헤더 */}
      <header className="px-4 pt-6 pb-0 break-keep">
        <h1 className="text-[22px] font-bold" style={{ color: '#191F28' }}>스케줄</h1>
        <p className="text-[13px] mt-1" style={{ color: '#6B7684' }}>즉시 매수 또는 예약 거래</p>
      </header>

      {/* 빠른 실행 버튼 */}
      <section className="px-4">
        <div className="grid grid-cols-2 gap-3">
          <a
            href="/app/schedule?mode=instant"
            className="rounded-2xl p-4 flex flex-col items-center gap-1.5 active:opacity-80 transition-opacity"
            style={{ background: '#191F28' }}
          >
            <span className="text-[26px]">⚡</span>
            <span className="text-[14px] font-semibold" style={{ color: '#fff' }}>즉시 매수</span>
          </a>
          <a
            href="/app/schedule?mode=new"
            className="rounded-2xl p-4 flex flex-col items-center gap-1.5 active:opacity-80 transition-opacity"
            style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
          >
            <span className="text-[26px]">📅</span>
            <span className="text-[14px] font-semibold" style={{ color: '#191F28' }}>스케줄 등록</span>
          </a>
        </div>
      </section>

      {/* 내 스케줄 */}
      <section className="px-4">
        <p className="text-[13px] font-semibold mb-2 px-1" style={{ color: '#6B7684' }}>내 스케줄</p>
        {loading ? (
          <div
            className="rounded-2xl p-6 text-center text-[14px] break-keep"
            style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', color: '#6B7684' }}
          >
            불러오는 중...
          </div>
        ) : items.length === 0 ? (
          <div
            className="rounded-2xl p-6 text-center text-[14px] break-keep"
            style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', color: '#6B7684' }}
          >
            등록된 스케줄이 없습니다.
          </div>
        ) : (
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
          >
            {items.map((j, idx, arr) => {
              const badge = EXCHANGE_BADGE[j.exchange] ?? { bg: '#F2F4F6', text: '#6B7684' }
              const exchangeLabel = EXCHANGE_LABELS[j.exchange] ?? j.exchange
              const tradeColor = TRADE_TYPE_COLOR[j.tradeType] ?? '#6B7684'
              const statusLabel = STATUS_LABEL[j.status] ?? j.status
              return (
                <div
                  key={j.id}
                  className="flex items-start justify-between px-5 py-4 break-keep"
                  style={idx < arr.length - 1 ? { borderBottom: '1px solid #F2F4F6' } : undefined}
                >
                  <div className="min-w-0 flex-1">
                    {/* 거래소 뱃지 + 거래 유형 */}
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                        style={{ background: badge.bg, color: badge.text }}
                      >
                        {exchangeLabel}
                      </span>
                      <span
                        className="text-[11px] font-semibold shrink-0"
                        style={{ color: tradeColor }}
                      >
                        {TRADE_TYPE_LABELS[j.tradeType]}
                      </span>
                    </div>

                    {/* 코인명 */}
                    <p className="text-[16px] font-bold" style={{ color: '#191F28' }}>{j.coin}</p>

                    {/* 금액 */}
                    {j.tradeType !== 'SELL' && (
                      <p className="text-[13px] mt-0.5" style={{ color: '#6B7684' }}>
                        {j.amountKrw.toLocaleString()}원
                      </p>
                    )}

                    {/* 기간 · 시간 */}
                    <p className="text-[12px] mt-1" style={{ color: '#B0B8C1' }}>
                      {j.scheduleFrom} ~ {j.scheduleTo} · {j.scheduleTime}
                    </p>

                    {/* 상태 */}
                    <p className="text-[11px] mt-0.5" style={{ color: '#B0B8C1' }}>
                      {j.isAppJob ? '📱 앱 실행' : '🌐 서버 실행'} · {statusLabel}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => cancel(j.id)}
                    className="shrink-0 ml-3 text-[12px] font-semibold px-3 py-1.5 rounded-lg active:opacity-70 transition-opacity"
                    style={{ color: '#FF4D4F', background: '#FFF0F0' }}
                  >
                    취소
                  </button>
                </div>
              )
            })}
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
      <div
        className="flex flex-col items-center justify-center gap-3 p-12"
        style={{ minHeight: '60vh' }}
      >
        <p className="text-[32px]">⏳</p>
        <p className="text-[16px] font-semibold break-keep" style={{ color: '#191F28' }}>거래 실행 중...</p>
        <p className="text-[13px] break-keep" style={{ color: '#6B7684' }}>잠시만 기다려주세요.</p>
      </div>
    )
  }

  if (phase === 'result' && result) {
    const successCount = result.filter((r) => r.ok).length
    const failCount = result.length - successCount
    return (
      <div className="flex flex-col gap-5 px-4 py-6" style={{ background: '#F9FAFB', minHeight: '100%' }}>
        <header className="break-keep">
          <h1 className="text-[22px] font-bold" style={{ color: '#191F28' }}>거래 결과</h1>
          <p className="text-[13px] mt-1" style={{ color: '#6B7684' }}>
            {successCount}건 성공
            {failCount > 0 && ` · ${failCount}건 실패`}
          </p>
        </header>

        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
        >
          {result.map((r, i) => (
            <div
              key={i}
              className="px-5 py-4 break-keep"
              style={i < result.length - 1 ? { borderBottom: '1px solid #F2F4F6' } : undefined}
            >
              <div className="flex items-center gap-2">
                <span className="text-[15px]">{r.ok ? '✅' : '❌'}</span>
                <p className="text-[15px] font-semibold" style={{ color: '#191F28' }}>
                  {r.label ?? '계정'}
                </p>
              </div>
              {r.ok ? (
                <p className="text-[12px] mt-1" style={{ color: '#6B7684' }}>
                  잔액 {Math.floor(r.balanceBefore).toLocaleString()}원 → {Math.floor(r.balance).toLocaleString()}원
                </p>
              ) : (
                <p className="text-[12px] mt-1" style={{ color: '#FF4D4F' }}>{r.error}</p>
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onDone}
          className="w-full py-4 rounded-2xl text-[15px] font-semibold break-keep"
          style={{ background: '#191F28', color: '#fff' }}
        >
          스케줄 목록으로
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5 px-4 py-2" style={{ background: '#F9FAFB', minHeight: '100%' }}>
      <header className="pt-4 break-keep">
        <h1 className="text-[22px] font-bold" style={{ color: '#191F28' }}>즉시 매수</h1>
        <p className="text-[13px] mt-1" style={{ color: '#6B7684' }}>지금 바로 거래를 실행합니다.</p>
      </header>

      <FormFields
        exchange={exchange} setExchange={setExchange}
        coin={coin} setCoin={setCoin}
        tradeType={tradeType} setTradeType={setTradeType}
        amountKrw={amountKrw} setAmountKrw={setAmountKrw}
      />

      <div>
        <p className="text-[13px] font-semibold mb-2" style={{ color: '#6B7684' }}>계정 선택 (복수)</p>
        <KeySelector exchange={exchange} multi={true} value={selectedKeyIds} onChange={setSelectedKeyIds} />
      </div>

      <div className="flex gap-3 pb-4">
        <button
          type="button"
          onClick={onDone}
          className="flex-1 py-4 rounded-2xl text-[14px] font-semibold"
          style={{ background: '#fff', color: '#6B7684', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
        >
          취소
        </button>
        <button
          type="button"
          onClick={handleStart}
          className="flex-[2] py-4 rounded-2xl text-[15px] font-semibold"
          style={{ background: '#0064FF', color: '#fff' }}
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
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-5 px-4 py-2"
      style={{ background: '#F9FAFB', minHeight: '100%' }}
    >
      <header className="pt-4 break-keep">
        <h1 className="text-[22px] font-bold" style={{ color: '#191F28' }}>스케줄 등록</h1>
        <p className="text-[13px] mt-1 leading-relaxed" style={{ color: '#6B7684' }}>
          예약 시간에 앱으로 푸시를 받아 거래가 실행됩니다.
          실행 시점에 앱이 켜져있고 알림이 허용되어 있어야 합니다.
        </p>
      </header>

      <FormFields
        exchange={exchange} setExchange={setExchange}
        coin={coin} setCoin={setCoin}
        tradeType={tradeType} setTradeType={setTradeType}
        amountKrw={amountKrw} setAmountKrw={setAmountKrw}
      />

      {/* 기간 설정 */}
      <div>
        <p className="text-[13px] font-semibold mb-2" style={{ color: '#6B7684' }}>실행 기간</p>
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
        >
          <div
            className="flex items-center justify-between px-4 py-3.5"
            style={{ borderBottom: '1px solid #F2F4F6' }}
          >
            <span className="text-[14px] font-semibold" style={{ color: '#191F28' }}>시작일</span>
            <input
              type="date"
              value={scheduleFrom}
              onChange={(e) => setScheduleFrom(e.target.value)}
              className="text-[14px] font-medium bg-transparent outline-none"
              style={{ color: '#6B7684' }}
            />
          </div>
          <div className="flex items-center justify-between px-4 py-3.5">
            <span className="text-[14px] font-semibold" style={{ color: '#191F28' }}>종료일</span>
            <input
              type="date"
              value={scheduleTo}
              onChange={(e) => setScheduleTo(e.target.value)}
              className="text-[14px] font-medium bg-transparent outline-none"
              style={{ color: '#6B7684' }}
            />
          </div>
        </div>
      </div>

      {/* 실행 시간 */}
      <div>
        <p className="text-[13px] font-semibold mb-2" style={{ color: '#6B7684' }}>실행 시간 (KST)</p>
        <div
          className="rounded-2xl"
          style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
        >
          <div className="flex items-center justify-between px-4 py-3.5">
            <span className="text-[14px] font-semibold" style={{ color: '#191F28' }}>시간</span>
            <input
              type="time"
              value={scheduleTime}
              onChange={(e) => setScheduleTime(e.target.value)}
              className="text-[14px] font-medium bg-transparent outline-none"
              style={{ color: '#6B7684' }}
            />
          </div>
        </div>
      </div>

      {error && (
        <p className="text-[13px] break-keep" style={{ color: '#FF4D4F' }}>{error}</p>
      )}

      <div className="flex gap-3 pb-4">
        <button
          type="button"
          onClick={onDone}
          className="flex-1 py-4 rounded-2xl text-[14px] font-semibold"
          style={{ background: '#fff', color: '#6B7684', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
        >
          취소
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="flex-[2] py-4 rounded-2xl text-[15px] font-semibold disabled:opacity-50"
          style={{ background: '#0064FF', color: '#fff' }}
        >
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
      {/* 거래소 */}
      <div>
        <p className="text-[13px] font-semibold mb-2" style={{ color: '#6B7684' }}>거래소</p>
        <div
          className="rounded-2xl"
          style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
        >
          <select
            value={exchange}
            onChange={(e) => setExchange(e.target.value as Exchange)}
            className="w-full px-4 py-3.5 rounded-2xl text-[15px] font-semibold bg-transparent outline-none appearance-none"
            style={{ color: '#191F28' }}
          >
            {EXCHANGES.map((ex) => (
              <option key={ex} value={ex}>{EXCHANGE_LABELS[ex]}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 코인 */}
      <div>
        <p className="text-[13px] font-semibold mb-2" style={{ color: '#6B7684' }}>코인</p>
        <div
          className="rounded-2xl"
          style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
        >
          <input
            type="text"
            value={coin}
            onChange={(e) => setCoin(e.target.value.toUpperCase())}
            placeholder="예: BTC"
            maxLength={20}
            className="w-full px-4 py-3.5 rounded-2xl text-[15px] font-semibold bg-transparent outline-none uppercase placeholder-gray-400"
            style={{ color: '#191F28' }}
          />
        </div>
      </div>

      {/* 거래 방식 */}
      <div>
        <p className="text-[13px] font-semibold mb-2" style={{ color: '#6B7684' }}>거래 방식</p>
        <div className="grid grid-cols-3 gap-2">
          {TRADE_TYPES.map((tt) => {
            const isActive = tradeType === tt
            const activeColor = TRADE_TYPE_COLOR[tt] ?? '#191F28'
            return (
              <button
                key={tt}
                type="button"
                onClick={() => setTradeType(tt)}
                className="py-3.5 rounded-2xl text-[14px] font-semibold transition-all"
                style={isActive
                  ? { background: activeColor, color: '#fff', boxShadow: `0 2px 8px ${activeColor}40` }
                  : { background: '#fff', color: '#6B7684', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }
                }
              >
                {TRADE_TYPE_LABELS[tt]}
              </button>
            )
          })}
        </div>
      </div>

      {/* 금액 */}
      {tradeType !== 'SELL' && (
        <div>
          <p className="text-[13px] font-semibold mb-2" style={{ color: '#6B7684' }}>
            금액 (KRW · 최소 5,100원)
          </p>
          <div
            className="rounded-2xl"
            style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
          >
            <input
              type="number"
              value={amountKrw}
              onChange={(e) => setAmountKrw(e.target.value)}
              placeholder="10000"
              min={5100}
              step={100}
              className="w-full px-4 py-3.5 rounded-2xl text-[15px] font-semibold bg-transparent outline-none placeholder-gray-400"
              style={{ color: '#191F28' }}
            />
          </div>
        </div>
      )}
    </>
  )
}
