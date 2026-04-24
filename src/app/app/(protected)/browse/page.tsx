'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  isPinSet, verifyPin, listKeys, decryptAllByIds,
  isBiometricRegistered, authenticateWithBiometric,
} from '@/lib/app/key-store'
import { EXCHANGE_LABELS, TRADE_TYPE_LABELS, type Exchange, type TradeType } from '@/types/database'

type Tab = 'assets' | 'history'
type SelectedEx = 'ALL' | Exchange

// ── 거래소 정보 ───────────────────────────────────────────────
const EXCHANGE_LIST: Exchange[] = ['BITHUMB', 'UPBIT', 'COINONE', 'KORBIT', 'GOPAX']

const EXCHANGE_META: Record<string, { short: string; bg: string; color: string; icon: string }> = {
  BITHUMB: { short: '빗썸',  bg: '#FFF0E6', color: '#C94B00', icon: '🟠' },
  UPBIT:   { short: '업비트', bg: '#E6F0FF', color: '#0050CC', icon: '🔵' },
  COINONE: { short: '코인원', bg: '#E6F9EE', color: '#007A30', icon: '🟢' },
  KORBIT:  { short: '코빗',  bg: '#F3EEFF', color: '#5B21B6', icon: '🟣' },
  GOPAX:   { short: '고팍스', bg: '#FFFBE6', color: '#946200', icon: '🟡' },
}

// ── 거래소 셀렉터 ─────────────────────────────────────────────
function ExchangeSelector({
  selected,
  onChange,
  registeredExchanges,
}: {
  selected: SelectedEx
  onChange: (ex: SelectedEx) => void
  registeredExchanges?: Exchange[]
}) {
  return (
    <div
      className="flex gap-2 px-4 py-3 overflow-x-auto"
      style={{ background: '#fff', borderBottom: '1px solid #F2F4F6', scrollbarWidth: 'none' }}
    >
      {/* 전체 */}
      <button
        type="button"
        onClick={() => onChange('ALL')}
        className="flex-shrink-0 flex flex-col items-center gap-1"
      >
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center text-[22px] transition-all"
          style={selected === 'ALL'
            ? { background: '#191F28', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }
            : { background: '#F2F4F6' }
          }
        >
          📊
        </div>
        <span
          className="text-[10px] font-semibold"
          style={{ color: selected === 'ALL' ? '#191F28' : '#B0B8C1' }}
        >
          전체
        </span>
      </button>

      {/* 거래소별 */}
      {EXCHANGE_LIST.map((ex) => {
        const meta = EXCHANGE_META[ex]
        const isSelected = selected === ex
        const hasKey = registeredExchanges ? registeredExchanges.includes(ex) : true
        return (
          <button
            key={ex}
            type="button"
            onClick={() => onChange(ex)}
            className="flex-shrink-0 flex flex-col items-center gap-1"
          >
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-[22px] transition-all relative"
              style={isSelected
                ? { background: meta.color, boxShadow: `0 2px 8px ${meta.color}40` }
                : { background: meta.bg }
              }
            >
              {meta.icon}
              {!hasKey && (
                <span
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold"
                  style={{ background: '#B0B8C1', color: '#fff' }}
                >
                  미
                </span>
              )}
            </div>
            <span
              className="text-[10px] font-semibold"
              style={{ color: isSelected ? meta.color : '#B0B8C1' }}
            >
              {meta.short}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ── 서브탭 ────────────────────────────────────────────────────
function SubTabs({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const tabs: { key: Tab; label: string }[] = [
    { key: 'assets',  label: '💰 자산현황' },
    { key: 'history', label: '📜 거래내역' },
  ]
  return (
    <div
      className="flex gap-1 px-4 py-2.5"
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

// ── Inner ─────────────────────────────────────────────────────
function BrowseInner() {
  const router = useRouter()
  const params = useSearchParams()
  const initialTab: Tab = (params.get('tab') as Tab) ?? 'assets'
  const [activeTab, setActiveTab] = useState<Tab>(initialTab)
  const [selectedEx, setSelectedEx] = useState<SelectedEx>('ALL')
  const [registeredExchanges, setRegisteredExchanges] = useState<Exchange[]>([])

  useEffect(() => {
    // 등록된 거래소 목록 가져오기 (PIN 없이 키 목록만)
    listKeys().then((keys) => {
      const exList = [...new Set(keys.map((k) => k.exchange as Exchange))]
      setRegisteredExchanges(exList)
    }).catch(() => {})
  }, [])

  function switchTab(t: Tab) {
    setActiveTab(t)
    router.replace(`/app/browse?tab=${t}`, { scroll: false })
  }

  return (
    <div style={{ background: '#F9FAFB', minHeight: '100%' }}>
      {/* 거래소 셀렉터 — 항상 최상단 */}
      <ExchangeSelector
        selected={selectedEx}
        onChange={setSelectedEx}
        registeredExchanges={activeTab === 'assets' ? registeredExchanges : undefined}
      />
      <SubTabs active={activeTab} onChange={switchTab} />
      {activeTab === 'assets'  && <AssetsView selectedEx={selectedEx} />}
      {activeTab === 'history' && <HistoryView selectedEx={selectedEx} />}
    </div>
  )
}

export default function BrowsePage() {
  return (
    <Suspense fallback={
      <div className="p-8 text-center text-[14px] break-keep" style={{ color: '#6B7684' }}>
        불러오는 중...
      </div>
    }>
      <BrowseInner />
    </Suspense>
  )
}

// ── 자산현황 ──────────────────────────────────────────────────
interface CoinRow { coin: string; amount: number; valueKrw: number }
interface BalanceRow {
  ok: boolean
  label: string | null
  exchange: string
  krw: number
  coins: CoinRow[]
  totalKrw: number
  error?: string
}

type AssetPhase = 'loading' | 'no_pin' | 'no_keys' | 'ready' | 'fetching' | 'result'

function AssetsView({ selectedEx }: { selectedEx: SelectedEx }) {
  const [phase, setPhase] = useState<AssetPhase>('loading')
  const [balances, setBalances] = useState<BalanceRow[]>([])
  const [grandTotal, setGrandTotal] = useState(0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // 핀 프롬프트 (bottom-sheet)
  const [showPinSheet, setShowPinSheet] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState<string | null>(null)
  const [pinSubmitting, setPinSubmitting] = useState(false)
  const [bioAvailable, setBioAvailable] = useState(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    ;(async () => {
      const hasPin = await isPinSet()
      if (!hasPin) { setPhase('no_pin'); return }
      const keys = await listKeys()
      if (keys.length === 0) { setPhase('no_keys'); return }
      const bioReg = await isBiometricRegistered()
      setBioAvailable(bioReg)
      setPhase('ready')
    })()
    return () => { mountedRef.current = false }
  }, [])

  async function fetchBalances(pin: string) {
    setPhase('fetching')
    setErrorMsg(null)
    try {
      const keys = await listKeys()
      const decrypted = await decryptAllByIds(pin, keys.map((k) => k.id))
      const res = await fetch('/api/app/proxy/balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accounts: decrypted.map((d) => ({
            exchange: d.exchange,
            accessKey: d.accessKey,
            secretKey: d.secretKey,
            label: d.label,
          })),
        }),
      })
      const json = await res.json()
      if (json.ok) {
        if (mountedRef.current) {
          setBalances(json.data.balances)
          setGrandTotal(json.data.grandTotalKrw ?? 0)
          setPhase('result')
        }
      } else {
        if (mountedRef.current) {
          setErrorMsg(json.error ?? '조회 실패')
          setPhase('ready')
        }
      }
    } catch (err) {
      if (mountedRef.current) {
        setErrorMsg(err instanceof Error ? err.message : '오류')
        setPhase('ready')
      }
    }
  }

  async function handleQueryButton() {
    if (bioAvailable) {
      // 생체 인증 자동 시도
      try {
        const pin = await authenticateWithBiometric()
        await fetchBalances(pin)
        return
      } catch {
        // 실패 시 PIN 바텀시트로 폴백
      }
    }
    setPinInput('')
    setPinError(null)
    setShowPinSheet(true)
  }

  async function handlePinSubmit() {
    if (pinInput.length < 4) { setPinError('PIN을 입력하세요.'); return }
    setPinSubmitting(true)
    setPinError(null)
    try {
      const v = await verifyPin(pinInput)
      if (!v.ok) {
        if (v.reason === 'locked') {
          const min = Math.ceil((v.retryAfterMs ?? 0) / 60000)
          setPinError(`잠금 상태: ${min}분 후 재시도`)
        } else {
          setPinError('PIN이 틀립니다.')
        }
        return
      }
      setShowPinSheet(false)
      await fetchBalances(pinInput)
    } finally {
      if (mountedRef.current) setPinSubmitting(false)
    }
  }

  if (phase === 'loading') {
    return <div className="p-8 text-center text-[14px] break-keep" style={{ color: '#6B7684' }}>불러오는 중...</div>
  }

  if (phase === 'no_pin' || phase === 'no_keys') {
    return (
      <div className="px-4 pt-6">
        <div
          className="rounded-2xl p-8 flex flex-col items-center text-center break-keep"
          style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
        >
          <p className="text-[32px] mb-3">{phase === 'no_pin' ? '🔒' : '🔑'}</p>
          <p className="text-[15px] font-semibold" style={{ color: '#191F28' }}>
            {phase === 'no_pin' ? 'API Key를 먼저 등록해주세요.' : '등록된 API Key가 없습니다.'}
          </p>
          <a
            href="/app/profile/api-keys"
            className="inline-block mt-4 px-5 py-3 rounded-2xl text-[14px] font-semibold"
            style={{ background: '#0064FF', color: '#fff' }}
          >
            API Key 등록하기
          </a>
        </div>
      </div>
    )
  }

  if (phase === 'fetching') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-12" style={{ minHeight: '50vh' }}>
        <p className="text-[32px]">⏳</p>
        <p className="text-[16px] font-semibold break-keep" style={{ color: '#191F28' }}>잔고 조회 중...</p>
        <p className="text-[13px] break-keep" style={{ color: '#6B7684' }}>거래소별 조회에 시간이 걸릴 수 있어요.</p>
      </div>
    )
  }

  // ready or result
  const filteredBalances = selectedEx === 'ALL'
    ? balances
    : balances.filter((b) => b.exchange === selectedEx)

  const filteredTotal = filteredBalances.reduce((s, b) => s + (b.ok ? b.totalKrw : 0), 0)

  return (
    <div className="flex flex-col gap-4 p-4 pb-6">
      {/* 조회 버튼 (ready 상태) 또는 합계 (result 상태) */}
      {phase === 'ready' && (
        <div className="flex flex-col items-center gap-3">
          {errorMsg && (
            <p className="text-[13px] text-center break-keep" style={{ color: '#FF4D4F' }}>{errorMsg}</p>
          )}
          <button
            type="button"
            onClick={handleQueryButton}
            className="w-full py-4 rounded-2xl text-[15px] font-bold"
            style={{ background: '#0064FF', color: '#fff' }}
          >
            {bioAvailable ? '🔒 지문으로 잔고 조회' : '🔑 PIN으로 잔고 조회'}
          </button>
        </div>
      )}

      {phase === 'result' && (
        <>
          {/* 합계 카드 */}
          <div
            className="rounded-2xl p-5 break-keep"
            style={{ background: '#191F28' }}
          >
            <p className="text-[12px]" style={{ color: '#B0B8C1' }}>
              {selectedEx === 'ALL' ? '전체 자산' : `${EXCHANGE_META[selectedEx]?.short ?? selectedEx} 자산`} (KRW + 코인 평가액)
            </p>
            <p className="text-[28px] font-bold mt-1.5" style={{ color: '#fff' }}>
              {Math.floor(filteredTotal).toLocaleString()}원
            </p>
          </div>

          {/* 계정별 잔고 */}
          <p className="text-[13px] font-semibold px-1" style={{ color: '#6B7684' }}>계정별 잔고</p>
          {filteredBalances.length === 0 ? (
            <div
              className="rounded-2xl p-6 text-center text-[13px] break-keep"
              style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', color: '#6B7684' }}
            >
              {selectedEx === 'ALL' ? '등록된 계정이 없습니다.' : `${EXCHANGE_META[selectedEx]?.short ?? selectedEx} 계정이 없습니다.`}
            </div>
          ) : filteredBalances.map((b, i) => {
            const meta = EXCHANGE_META[b.exchange] ?? { short: b.exchange, bg: '#F2F4F6', color: '#6B7684', icon: '🏦' }
            return (
              <div
                key={i}
                className="rounded-2xl p-4 break-keep"
                style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-[20px] shrink-0"
                      style={{ background: meta.bg }}
                    >
                      {meta.icon}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-bold" style={{ color: meta.color }}>{meta.short}</p>
                      <p className="text-[12px] truncate" style={{ color: '#6B7684' }}>{b.label ?? '-'}</p>
                    </div>
                  </div>
                  {b.ok ? (
                    <div className="text-right shrink-0">
                      <p className="text-[17px] font-bold" style={{ color: '#191F28' }}>
                        {Math.floor(b.totalKrw).toLocaleString()}원
                      </p>
                      <p className="text-[11px] mt-0.5" style={{ color: '#B0B8C1' }}>
                        KRW {Math.floor(b.krw).toLocaleString()}
                      </p>
                    </div>
                  ) : (
                    <span
                      className="text-[12px] font-semibold px-2 py-1 rounded-lg shrink-0"
                      style={{ background: '#FFF0F0', color: '#FF4D4F' }}
                    >
                      조회 실패
                    </span>
                  )}
                </div>

                {!b.ok && b.error && (
                  <p className="text-[12px] break-keep" style={{ color: '#FF4D4F' }}>{b.error}</p>
                )}

                {b.ok && b.coins.filter((c) => c.amount > 0).length > 0 && (
                  <div className="mt-2 pt-3" style={{ borderTop: '1px solid #F2F4F6' }}>
                    <p className="text-[11px] font-semibold mb-2" style={{ color: '#B0B8C1' }}>보유 코인</p>
                    <div className="flex flex-col gap-1.5">
                      {b.coins
                        .filter((c) => c.amount > 0)
                        .sort((x, y) => y.valueKrw - x.valueKrw)
                        .slice(0, 10)
                        .map((c) => (
                          <div key={c.coin} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-[13px] font-semibold" style={{ color: '#191F28' }}>{c.coin}</span>
                              <span className="text-[11px]" style={{ color: '#B0B8C1' }}>
                                {c.amount.toFixed(c.amount < 1 ? 6 : 2)}
                              </span>
                            </div>
                            <span className="text-[13px] font-medium" style={{ color: '#191F28' }}>
                              {c.valueKrw > 0 ? `${c.valueKrw.toLocaleString()}원` : '-'}
                            </span>
                          </div>
                        ))}
                      {b.coins.filter((c) => c.amount > 0).length > 10 && (
                        <p className="text-[11px]" style={{ color: '#B0B8C1' }}>
                          +{b.coins.filter((c) => c.amount > 0).length - 10}개 더
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          <button
            type="button"
            onClick={() => { setPhase('ready'); setBalances([]) }}
            className="text-[13px] font-semibold px-4 py-2 rounded-xl mx-auto"
            style={{ color: '#6B7684', background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
          >
            🔄 다시 조회
          </button>
        </>
      )}

      {/* PIN 바텀시트 */}
      {showPinSheet && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowPinSheet(false) }}
        >
          <div className="w-full max-w-sm bg-white rounded-t-3xl px-5 pt-5 pb-10 shadow-2xl">
            <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: '#E5E8EB' }} />
            <p className="text-[17px] font-bold mb-1 break-keep" style={{ color: '#191F28' }}>PIN 입력</p>
            <p className="text-[13px] mb-4 break-keep" style={{ color: '#6B7684' }}>잔고 조회를 위해 PIN을 입력해주세요.</p>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
              placeholder="6자리 숫자"
              autoFocus
              className="w-full px-4 py-3.5 rounded-2xl text-[16px] font-mono text-center tracking-widest outline-none mb-2"
              style={{
                border: `2px solid ${pinError ? '#FF4D4F' : '#E5E8EB'}`,
                color: '#191F28',
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') handlePinSubmit() }}
            />
            {pinError && (
              <p className="text-[12px] text-center mb-3 break-keep" style={{ color: '#FF4D4F' }}>{pinError}</p>
            )}
            <div className="flex gap-3 mt-3">
              <button
                type="button"
                onClick={() => setShowPinSheet(false)}
                className="flex-1 py-3.5 rounded-2xl text-[14px] font-semibold"
                style={{ background: '#F2F4F6', color: '#6B7684' }}
              >
                취소
              </button>
              <button
                type="button"
                onClick={handlePinSubmit}
                disabled={pinSubmitting || pinInput.length < 4}
                className="flex-[2] py-3.5 rounded-2xl text-[15px] font-semibold disabled:opacity-50"
                style={{ background: '#0064FF', color: '#fff' }}
              >
                {pinSubmitting ? '확인 중...' : '확인'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── 거래내역 ──────────────────────────────────────────────────
interface TradeItem {
  id: string
  exchange: string
  coin: string
  tradeType: string
  amountKrw: number
  accountName: string | null
  success: boolean
  reason: string | null
  balanceBefore: number | null
  balance: number | null
  executedAt: string
}

function formatKst(iso: string): string {
  const d = new Date(new Date(iso).toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function HistoryView({ selectedEx }: { selectedEx: SelectedEx }) {
  const [items, setItems] = useState<TradeItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/app/trade-history?limit=100')
      .then((r) => r.json())
      .then((j) => { if (j.ok) setItems(j.data.items) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = selectedEx === 'ALL' ? items : items.filter((t) => t.exchange === selectedEx)

  return (
    <div className="flex flex-col gap-4 p-4 pb-6">
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
          <p className="text-[28px] mb-3">📜</p>
          <p>
            {selectedEx === 'ALL'
              ? '아직 거래 내역이 없어요.'
              : `${EXCHANGE_META[selectedEx]?.short ?? selectedEx} 거래 내역이 없어요.`}
          </p>
        </div>
      ) : (
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
        >
          {filtered.map((t, idx, arr) => {
            const meta = EXCHANGE_META[t.exchange] ?? { short: t.exchange, bg: '#F2F4F6', color: '#6B7684', icon: '🏦' }
            return (
              <div
                key={t.id}
                className="flex items-start justify-between px-4 py-3.5 break-keep"
                style={idx < arr.length - 1 ? { borderBottom: '1px solid #F2F4F6' } : undefined}
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  {/* 거래소 아이콘 */}
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-[18px] shrink-0 mt-0.5"
                    style={{ background: meta.bg }}
                  >
                    {meta.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[11px] font-bold" style={{ color: meta.color }}>{meta.short}</span>
                      <span className="text-[11px]" style={{ color: '#B0B8C1' }}>
                        {t.accountName ?? ''}
                      </span>
                    </div>
                    <p className="text-[14px] font-bold" style={{ color: '#191F28' }}>
                      {t.coin}
                      <span className="ml-2 text-[12px] font-semibold" style={{ color: '#6B7684' }}>
                        {TRADE_TYPE_LABELS[t.tradeType as TradeType] ?? t.tradeType}
                      </span>
                    </p>
                    {t.tradeType !== 'SELL' && t.amountKrw > 0 && (
                      <p className="text-[11px] mt-0.5" style={{ color: '#6B7684' }}>
                        {t.amountKrw.toLocaleString()}원
                      </p>
                    )}
                    {!t.success && t.reason && (
                      <p className="text-[11px] mt-0.5 break-keep" style={{ color: '#FF4D4F' }}>{t.reason}</p>
                    )}
                    <p className="text-[10px] mt-1" style={{ color: '#B0B8C1' }}>
                      {formatKst(t.executedAt)}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <span
                    className="text-[13px] font-bold"
                    style={{ color: t.success ? '#00C853' : '#FF4D4F' }}
                  >
                    {t.success ? '성공' : '실패'}
                  </span>
                  {t.success && t.balance != null && (
                    <p className="text-[10px] mt-0.5" style={{ color: '#B0B8C1' }}>
                      {Math.floor(t.balance).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
