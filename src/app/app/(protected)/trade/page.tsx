'use client'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import PinPad from '../../_components/PinPad'
import KeySelector from '../../_components/KeySelector'
import { verifyPin, decryptAllByIds } from '@/lib/app/key-store'
import { EXCHANGE_LABELS, TRADE_TYPE_LABELS, type Exchange, type TradeType } from '@/types/database'

type Tab = 'instant' | 'schedule' | 'list'

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

const STATUS_LABEL: Record<string, string> = {
  active:    '진행 중',
  paused:    '일시정지',
  completed: '완료',
  cancelled: '취소됨',
}

const EXCHANGES: Exchange[] = ['BITHUMB', 'UPBIT', 'COINONE', 'KORBIT', 'GOPAX']
const TRADE_TYPES: TradeType[] = ['CYCLE', 'BUY', 'SELL']

// ────────────────────────────────────────
// 서브탭 헤더
// ────────────────────────────────────────

function SubTabs({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const tabs: { key: Tab; label: string }[] = [
    { key: 'instant',  label: '⚡ 즉시거래' },
    { key: 'schedule', label: '📅 스케줄' },
    { key: 'list',     label: '📋 내스케줄' },
  ]
  return (
    <div
      className="flex gap-1 px-4 py-3"
      style={{ background: '#fff', borderBottom: '1px solid #F2F4F6' }}
    >
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onChange(t.key)}
          className="flex-1 py-2 rounded-xl text-[13px] font-semibold transition-all break-keep"
          style={active === t.key
            ? { background: '#EBF3FF', color: '#0064FF' }
            : { background: 'transparent', color: '#B0B8C1' }
          }
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

// ────────────────────────────────────────
// 내부 (Suspense 필요)
// ────────────────────────────────────────

function TradeInner() {
  const router = useRouter()
  const params = useSearchParams()
  const rawTab = params.get('tab') as Tab | null

  // 구 schedule?mode= 파라미터 하위 호환
  const legacyMode = params.get('mode')
  const initialTab: Tab =
    rawTab ?? (legacyMode === 'instant' ? 'instant' : legacyMode === 'new' ? 'schedule' : 'instant')

  const [activeTab, setActiveTab] = useState<Tab>(initialTab)

  // 이벤트 페이지 등에서 넘어온 파라미터 읽기
  const initCoin = params.get('coin') ?? ''
  const initExchange = (params.get('exchange') as Exchange) ?? 'BITHUMB'

  function switchTab(t: Tab) {
    setActiveTab(t)
    router.replace(`/app/trade?tab=${t}`, { scroll: false })
  }

  return (
    <div style={{ background: '#F9FAFB', minHeight: '100%' }}>
      <SubTabs active={activeTab} onChange={switchTab} />
      {activeTab === 'instant'  && <InstantForm  key={`instant-${initExchange}-${initCoin}`}  initCoin={initCoin} initExchange={initExchange} onDone={() => switchTab('list')} />}
      {activeTab === 'schedule' && <ScheduleForm key={`schedule-${initExchange}-${initCoin}`} initCoin={initCoin} initExchange={initExchange} onDone={() => switchTab('list')} />}
      {activeTab === 'list'     && <ScheduleList />}
    </div>
  )
}

export default function TradePage() {
  return (
    <Suspense fallback={
      <div className="p-8 text-center text-[14px] break-keep" style={{ color: '#6B7684' }}>
        불러오는 중...
      </div>
    }>
      <TradeInner />
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

// 이벤트 매칭용 타입
interface EventMeta {
  id: string
  exchange: string
  coin: string
  requireApply: boolean
  apiAllowed: boolean
}

// 필터 탭: 진행(active/paused) | 완료(completed/cancelled) | 전체
type ListFilter = 'active' | 'done' | 'all'

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  active:    { bg: '#E6FBF0', color: '#007A30', label: '진행 중' },
  paused:    { bg: '#FFF3E0', color: '#E65100', label: '일시정지' },
  completed: { bg: '#F2F4F6', color: '#6B7684', label: '완료' },
  cancelled: { bg: '#FFE8E8', color: '#C0392B', label: '취소됨' },
}

// 좌측 컬러바 색상 (안 C)
const STATUS_BAR_COLOR: Record<string, string> = {
  active:    '#007A30',
  paused:    '#E65100',
  completed: '#B0B8C1',
  cancelled: '#B0B8C1',
}

// 깜빡이는 뱃지 CSS (Tailwind 없이 인라인 keyframe 불가 → style tag 삽입)
const BLINK_STYLE = `
@keyframes _blink {
  0%,100%{ opacity:1 }
  50%{ opacity:0.25 }
}
._blink { animation: _blink 1.1s ease-in-out infinite; }
`

function ScheduleList() {
  const [items, setItems]     = useState<JobItem[]>([])
  const [events, setEvents]   = useState<EventMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState<ListFilter>('active')

  async function load() {
    setLoading(true)
    try {
      const [jobsRes, eventsRes] = await Promise.all([
        fetch('/api/app/trade-jobs'),
        fetch('/api/app/events?status=active&limit=100'),
      ])
      const [jobsJson, eventsJson] = await Promise.all([jobsRes.json(), eventsRes.json()])
      if (jobsJson.ok)   setItems(jobsJson.data.items)
      if (eventsJson.ok) setEvents(
        eventsJson.data.items.map((e: { id: string; exchange: string; coin: string; requireApply: boolean; apiAllowed: boolean }) => ({
          id: e.id, exchange: e.exchange, coin: e.coin,
          requireApply: e.requireApply, apiAllowed: e.apiAllowed,
        }))
      )
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  // exchange+coin → event 빠른 조회
  const eventMap = useMemo(() => {
    const m = new Map<string, EventMeta>()
    events.forEach((e) => m.set(`${e.exchange}:${e.coin.toUpperCase()}`, e))
    return m
  }, [events])

  async function cancel(id: string) {
    if (!confirm('이 스케줄을 취소하시겠습니까?')) return
    await fetch(`/api/app/trade-jobs/${id}`, { method: 'DELETE' })
    await load()
  }

  // 필터 적용
  const filtered = items.filter((j) => {
    if (filter === 'active') return j.status === 'active' || j.status === 'paused'
    if (filter === 'done')   return j.status === 'completed' || j.status === 'cancelled'
    return true
  })

  const activeCnt = items.filter((j) => j.status === 'active' || j.status === 'paused').length
  const doneCnt   = items.filter((j) => j.status === 'completed' || j.status === 'cancelled').length

  const filterTabs: { key: ListFilter; label: string; count: number }[] = [
    { key: 'active', label: '진행', count: activeCnt },
    { key: 'done',   label: '완료', count: doneCnt },
    { key: 'all',    label: '전체', count: items.length },
  ]

  return (
    <div className="flex flex-col gap-0 pb-6" style={{ background: '#F9FAFB' }}>
      {/* 깜빡임 애니메이션 CSS 주입 */}
      <style dangerouslySetInnerHTML={{ __html: BLINK_STYLE }} />

      {/* 필터 칩 */}
      <div className="flex gap-2 px-4 pt-3 pb-2">
        {filterTabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setFilter(t.key)}
            className="px-4 py-1.5 rounded-full text-[12px] font-semibold transition-all break-keep"
            style={filter === t.key
              ? { background: '#191F28', color: '#fff' }
              : { background: '#fff', color: '#6B7684', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }
            }
          >
            {t.label} {t.count}
          </button>
        ))}
      </div>

      {/* 카드 목록 */}
      <div className="px-4 flex flex-col gap-3">
        {loading ? (
          <div
            className="rounded-2xl p-6 text-center text-[14px] break-keep"
            style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', color: '#6B7684' }}
          >
            불러오는 중...
          </div>
        ) : filtered.length === 0 ? (
          <div
            className="rounded-2xl p-8 text-center text-[14px] break-keep"
            style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', color: '#6B7684' }}
          >
            <p className="text-[28px] mb-3">📋</p>
            <p>
              {filter === 'active' ? '진행 중인 스케줄이 없습니다.'
               : filter === 'done'  ? '완료된 스케줄이 없습니다.'
               : '등록된 스케줄이 없습니다.'}
            </p>
            {filter === 'active' && (
              <p className="text-[12px] mt-1" style={{ color: '#B0B8C1' }}>위 탭에서 스케줄을 등록해보세요.</p>
            )}
          </div>
        ) : (
          filtered.map((j) => {
            const exBadge      = EXCHANGE_BADGE[j.exchange] ?? { bg: '#F2F4F6', text: '#6B7684' }
            const exchangeLabel = EXCHANGE_LABELS[j.exchange] ?? j.exchange
            const statusBadge  = STATUS_BADGE[j.status]
            const barColor     = STATUS_BAR_COLOR[j.status] ?? '#B0B8C1'
            const isDone       = j.status === 'completed' || j.status === 'cancelled'
            const matchedEvent = eventMap.get(`${j.exchange}:${j.coin.toUpperCase()}`)

            // 메타 정보 1줄 압축: 금액 · MM/DD ~ MM/DD · HH:MM
            const metaParts: string[] = []
            if (j.tradeType !== 'SELL') metaParts.push(`${j.amountKrw.toLocaleString()}원`)
            metaParts.push(`${j.scheduleFrom.slice(5)} ~ ${j.scheduleTo.slice(5)}`)
            metaParts.push(j.scheduleTime.slice(0, 5))
            const metaLine = metaParts.join(' · ')

            return (
              <div
                key={j.id}
                className="break-keep"
                style={{
                  display: 'flex',
                  background: '#fff',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  opacity: isDone ? 0.75 : 1,
                }}
              >
                {/* 좌측 컬러바 */}
                <div style={{ width: '4px', flexShrink: 0, background: barColor }} />

                {/* 카드 내용 */}
                <div style={{ flex: 1, padding: '12px 13px' }}>
                  {/* 1행: 거래소 뱃지 + 상태 뱃지 + 취소 버튼 */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, flexWrap: 'wrap' }}>
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                        style={{ background: exBadge.bg, color: exBadge.text }}
                      >
                        {exchangeLabel}
                      </span>
                      {statusBadge && (
                        <span
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0"
                          style={{ background: statusBadge.bg, color: statusBadge.color }}
                        >
                          {statusBadge.label}
                        </span>
                      )}
                    </div>
                    {!isDone && (
                      <button
                        type="button"
                        onClick={() => cancel(j.id)}
                        className="shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-lg active:opacity-70 transition-opacity"
                        style={{ color: '#FF4D4F', background: '#FFF0F0' }}
                      >
                        취소
                      </button>
                    )}
                  </div>

                  {/* 코인명 */}
                  <p className="text-[17px] font-extrabold" style={{ color: '#191F28' }}>{j.coin}</p>

                  {/* 메타 정보 (금액 · 기간 · 시간) */}
                  <p className="text-[11px] mt-1" style={{ color: '#B0B8C1' }}>{metaLine}</p>

                  {/* 이벤트 연계 뱃지 행 */}
                  {matchedEvent && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                      {/* 이벤트 등록 필요 (깜빡임) */}
                      {matchedEvent.requireApply && (
                        <span
                          className="_blink text-[11px] font-extrabold px-2.5 py-1 rounded-lg"
                          style={{ background: '#FFF9C4', color: '#7A6000' }}
                        >
                          ⚠️ 이벤트 등록
                        </span>
                      )}

                      {/* API 미허용 → 거래소 직접 거래 (깜빡임) */}
                      {!matchedEvent.apiAllowed && (
                        <span
                          className="_blink text-[11px] font-extrabold px-2.5 py-1 rounded-lg"
                          style={{ background: '#FFE8E8', color: '#C0392B' }}
                        >
                          ⚠️ 거래소 거래
                        </span>
                      )}

                      {/* 원문 보기 */}
                      <a
                        href={`/app/events/${matchedEvent.id}`}
                        className="text-[11px] font-semibold px-2.5 py-1 rounded-lg"
                        style={{ background: '#F2F4F6', color: '#4B5563' }}
                      >
                        원문 보기 ↗
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

// ────────────────────────────────────────
// 즉시 매수 폼
// ────────────────────────────────────────

function InstantForm({ initCoin, initExchange, onDone }: { initCoin: string; initExchange: Exchange; onDone: () => void }) {
  const [exchange, setExchange] = useState<Exchange>(initExchange)
  const [coin, setCoin] = useState(initCoin)
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
      <div className="flex flex-col items-center justify-center gap-3 p-12" style={{ minHeight: '60vh' }}>
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
      <div className="flex flex-col gap-5 px-4 py-6">
        <header className="break-keep">
          <h1 className="text-[22px] font-bold" style={{ color: '#191F28' }}>거래 결과</h1>
          <p className="text-[13px] mt-1" style={{ color: '#6B7684' }}>
            {successCount}건 성공{failCount > 0 && ` · ${failCount}건 실패`}
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
                <p className="text-[15px] font-semibold" style={{ color: '#191F28' }}>{r.label ?? '계정'}</p>
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
          내 스케줄로
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5 px-4 py-4">
      <FormFields
        exchange={exchange} setExchange={setExchange}
        coin={coin} setCoin={setCoin}
        tradeType={tradeType} setTradeType={setTradeType}
        amountKrw={amountKrw} setAmountKrw={setAmountKrw}
      />
      <div>
        <p className="text-[13px] font-semibold mb-2" style={{ color: '#6B7684' }}>계정 선택 (복수 가능)</p>
        <KeySelector exchange={exchange} multi={true} value={selectedKeyIds} onChange={setSelectedKeyIds} />
      </div>
      <button
        type="button"
        onClick={handleStart}
        className="w-full py-4 rounded-2xl text-[15px] font-semibold pb-4"
        style={{ background: '#0064FF', color: '#fff' }}
      >
        ⚡ 즉시 실행
      </button>
    </div>
  )
}

// ────────────────────────────────────────
// 스케줄 등록 폼
// ────────────────────────────────────────

function ScheduleForm({ initCoin, initExchange, onDone }: { initCoin: string; initExchange: Exchange; onDone: () => void }) {
  const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const [exchange, setExchange] = useState<Exchange>(initExchange)
  const [coin, setCoin] = useState(initCoin)
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
          accountIds: [],
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 px-4 py-4">
      <p className="text-[13px] leading-relaxed break-keep" style={{ color: '#6B7684' }}>
        예약 시간에 앱으로 푸시를 받아 거래가 실행됩니다.
        실행 시점에 앱이 켜져있고 알림이 허용되어 있어야 합니다.
      </p>

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

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-4 rounded-2xl text-[15px] font-semibold disabled:opacity-50 pb-4"
        style={{ background: '#0064FF', color: '#fff' }}
      >
        {submitting ? '등록 중...' : '📅 스케줄 등록'}
      </button>
    </form>
  )
}

// ────────────────────────────────────────
// 코인 자동완성 훅
// ────────────────────────────────────────

function useCoinAutocomplete(exchange: Exchange, coin: string) {
  const [allCoins, setAllCoins] = useState<{ code: string; name: string }[]>([])
  const [coinsLoading, setCoinsLoading] = useState(false)
  const [coinFocused, setCoinFocused] = useState(false)

  useEffect(() => {
    setAllCoins([])
    setCoinsLoading(true)
    fetch(`/api/markets?exchange=${exchange}`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setAllCoins(data) })
      .catch(() => null)
      .finally(() => setCoinsLoading(false))
  }, [exchange])

  const suggestions = useMemo(() => {
    if (coin.length < 1 || allCoins.length === 0) return []
    const upper = coin.toUpperCase()
    return allCoins
      .filter((c) => c.code.startsWith(upper) || c.name.includes(coin))
      .slice(0, 8)
  }, [coin, allCoins])

  return { allCoins, coinsLoading, coinFocused, setCoinFocused, suggestions }
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
  const { coinsLoading, coinFocused, setCoinFocused, suggestions } =
    useCoinAutocomplete(exchange, coin)
  const listRef = useRef<HTMLUListElement>(null)

  return (
    <>
      {/* 거래소 */}
      <div>
        <p className="text-[13px] font-semibold mb-2" style={{ color: '#6B7684' }}>거래소</p>
        <div className="rounded-2xl" style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <select
            value={exchange}
            onChange={(e) => { setExchange(e.target.value as Exchange); setCoin('') }}
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
      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[13px] font-semibold" style={{ color: '#6B7684' }}>코인</p>
          {coinsLoading && (
            <p className="text-[11px] animate-pulse" style={{ color: '#B0B8C1' }}>목록 로딩 중...</p>
          )}
        </div>
        <div className="rounded-2xl" style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <input
            type="text"
            value={coin}
            onChange={(e) => setCoin(e.target.value.toUpperCase())}
            onFocus={() => setCoinFocused(true)}
            onBlur={() => setTimeout(() => setCoinFocused(false), 150)}
            placeholder={coinsLoading ? '코인 목록 로딩 중...' : '코드(BTC) 또는 이름(비트코인)'}
            maxLength={20}
            disabled={coinsLoading}
            className="w-full px-4 py-3.5 rounded-2xl text-[15px] font-semibold bg-transparent outline-none uppercase placeholder-gray-400 disabled:opacity-50"
            style={{ color: '#191F28' }}
          />
        </div>

        {/* 자동완성 드롭다운 */}
        {coinFocused && suggestions.length > 0 && (
          <ul
            ref={listRef}
            className="absolute z-50 left-0 right-0 rounded-2xl overflow-hidden mt-1"
            style={{ background: '#fff', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', border: '1px solid #F2F4F6' }}
          >
            {suggestions.map((c) => (
              <li
                key={c.code}
                onMouseDown={(e) => { e.preventDefault(); setCoin(c.code); setCoinFocused(false) }}
                className="flex items-center gap-3 px-4 py-3 active:bg-blue-50 cursor-pointer break-keep"
                style={{ borderBottom: '1px solid #F9FAFB' }}
              >
                <span className="text-[15px] font-bold w-16 shrink-0" style={{ color: '#191F28' }}>{c.code}</span>
                <span className="text-[13px]" style={{ color: '#6B7684' }}>{c.name}</span>
              </li>
            ))}
          </ul>
        )}
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
          <div className="rounded-2xl" style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
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
