'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  listKeys, decryptAllByDeviceKey,
} from '@/lib/app/key-store'
import { TRADE_TYPE_LABELS, type Exchange, type TradeType } from '@/types/database'

type Tab = 'assets' | 'history'
type SelectedEx = 'ALL' | Exchange

interface AccountMeta { id: string; exchange: Exchange; label: string }

// ── 거래소 브랜드 ─────────────────────────────────────────────
const EXCHANGE_META: Record<string, {
  short: string; bg: string; color: string; brandBg: string; brandFg: string; initial: string
}> = {
  BITHUMB: { short: '빗썸',  bg: '#FFF0E6', color: '#C94B00', brandBg: '#F05C22', brandFg: '#fff', initial: 'b' },
  UPBIT:   { short: '업비트', bg: '#E6F0FF', color: '#0050CC', brandBg: '#0A3DFF', brandFg: '#fff', initial: 'U' },
  COINONE: { short: '코인원', bg: '#E6F9EE', color: '#007A30', brandBg: '#00B77C', brandFg: '#fff', initial: '1' },
  KORBIT:  { short: '코빗',  bg: '#F3EEFF', color: '#5B21B6', brandBg: '#1B2B4A', brandFg: '#fff', initial: 'K' },
  GOPAX:   { short: '고팍스', bg: '#FFFBE6', color: '#946200', brandBg: '#FFB800', brandFg: '#1A1200', initial: 'G' },
}

function ExchangeLogo({ exchange, size = 48, selected = false }: { exchange: string; size?: number; selected?: boolean }) {
  const meta = EXCHANGE_META[exchange]
  if (!meta) return null
  // 공식 거래소 CI PNG (/exchanges/*.png) 사용
  // 선택 시 컬러 보더로 강조, 미선택 시 기본 보더
  const innerSize = Math.round(size * 0.72)
  return (
    <div style={{
      width: size, height: size, borderRadius: Math.round(size * 0.28),
      background: '#fff',
      border: `2px solid ${selected ? meta.brandBg : '#E5E8EB'}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'all 0.15s', flexShrink: 0,
      boxShadow: selected ? `0 3px 10px ${meta.brandBg}55` : '0 1px 4px rgba(0,0,0,0.06)',
      overflow: 'hidden',
    }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/exchanges/${exchange.toLowerCase()}.png`}
        alt={meta.short}
        width={innerSize}
        height={innerSize}
        style={{ width: innerSize, height: innerSize, objectFit: 'contain' }}
        onError={(e) => {
          // PNG 로드 실패 시 글자 fallback으로 회복
          const img = e.currentTarget
          const fallback = document.createElement('span')
          fallback.textContent = meta.initial
          fallback.style.cssText = `color: ${meta.brandBg}; font-size: ${size * 0.46}px; font-weight: 900; font-family: 'Arial Black','Arial',sans-serif; line-height: 1;`
          img.replaceWith(fallback)
        }}
      />
    </div>
  )
}

// ── 거래소 셀렉터 ─────────────────────────────────────────────
function ExchangeSelector({ selected, onChange, exchanges }: {
  selected: SelectedEx; onChange: (ex: SelectedEx) => void; exchanges: Exchange[]
}) {
  if (exchanges.length === 0) return null
  return (
    <div className="flex gap-3 px-4 py-3 overflow-x-auto"
      style={{ background: '#fff', borderBottom: '1px solid #F2F4F6', scrollbarWidth: 'none' }}>
      {exchanges.length > 1 && (
        <button type="button" onClick={() => onChange('ALL')} className="flex-shrink-0 flex flex-col items-center gap-1.5">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all"
            style={selected === 'ALL' ? { background: '#191F28', boxShadow: '0 3px 10px rgba(0,0,0,0.25)' } : { background: '#F2F4F6' }}>
            <span className="text-[20px]">📊</span>
          </div>
          <span className="text-[10px] font-semibold" style={{ color: selected === 'ALL' ? '#191F28' : '#B0B8C1' }}>전체</span>
        </button>
      )}
      {exchanges.map((ex) => {
        const meta = EXCHANGE_META[ex]
        const isSel = selected === ex
        return (
          <button key={ex} type="button" onClick={() => onChange(ex)} className="flex-shrink-0 flex flex-col items-center gap-1.5">
            <ExchangeLogo exchange={ex} size={48} selected={isSel} />
            <span className="text-[10px] font-semibold" style={{ color: isSel ? meta.color : '#B0B8C1' }}>{meta.short}</span>
          </button>
        )
      })}
    </div>
  )
}

// ── 계정 칩 (2개 이상일 때만 표시) ─────────────────────────────
function AccountChips({ accounts, selected, onChange }: {
  accounts: AccountMeta[]
  selected: string   // 'ALL' or account id
  onChange: (id: string) => void
}) {
  if (accounts.length <= 1) return null
  return (
    <div className="flex flex-wrap gap-2 px-4 py-2.5"
      style={{ background: '#fff', borderBottom: '1px solid #F2F4F6' }}>
      {accounts.map((acc) => {
        const isSel = selected === acc.id
        return (
          <button key={acc.id} type="button"
            onClick={() => onChange(isSel ? 'ALL' : acc.id)}
            className="px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all"
            style={isSel
              ? { background: '#191F28', color: '#fff' }
              : { background: '#F2F4F6', color: '#374151' }
            }>
            {acc.label}
          </button>
        )
      })}
    </div>
  )
}

// ── 서브탭 ─────────────────────────────────────────────────────
function SubTabs({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <div className="flex gap-1 px-4 py-2.5" style={{ background: '#fff', borderBottom: '1px solid #F2F4F6' }}>
      {([{ key: 'assets', label: '💰 자산현황' }, { key: 'history', label: '📜 거래내역' }] as { key: Tab; label: string }[]).map((t) => (
        <button key={t.key} type="button" onClick={() => onChange(t.key)}
          className="flex-1 py-2 rounded-xl text-[13px] font-semibold transition-all break-keep"
          style={active === t.key ? { background: '#EBF3FF', color: '#0064FF' } : { background: 'transparent', color: '#B0B8C1' }}>
          {t.label}
        </button>
      ))}
    </div>
  )
}

// ── BrowseInner ────────────────────────────────────────────────
function BrowseInner() {
  const router = useRouter()
  const params = useSearchParams()
  const initialTab: Tab = (params.get('tab') as Tab) ?? 'assets'
  const [activeTab, setActiveTab] = useState<Tab>(initialTab)
  const [selectedEx, setSelectedEx] = useState<SelectedEx>('ALL')
  const [registeredExchanges, setRegisteredExchanges] = useState<Exchange[]>([])
  const [registeredAccounts, setRegisteredAccounts] = useState<AccountMeta[]>([])

  useEffect(() => {
    listKeys().then((keys) => {
      const exList = [...new Set(keys.map((k) => k.exchange as Exchange))]
      setRegisteredExchanges(exList)
      setRegisteredAccounts(keys as AccountMeta[])
      if (exList.length === 1) setSelectedEx(exList[0])
    }).catch(() => {})
  }, [])

  // selectedEx 변경 시 accounts도 필터
  const visibleAccounts: AccountMeta[] = selectedEx === 'ALL'
    ? registeredAccounts
    : registeredAccounts.filter((a) => a.exchange === selectedEx)

  function switchTab(t: Tab) {
    setActiveTab(t)
    router.replace(`/app/browse?tab=${t}`, { scroll: false })
  }

  return (
    <div style={{ background: '#F9FAFB', minHeight: '100%' }}>
      <ExchangeSelector selected={selectedEx} onChange={setSelectedEx} exchanges={registeredExchanges} />
      <SubTabs active={activeTab} onChange={switchTab} />
      {activeTab === 'assets'  && <AssetsView selectedEx={selectedEx} visibleAccounts={visibleAccounts} />}
      {activeTab === 'history' && <HistoryView selectedEx={selectedEx} visibleAccounts={visibleAccounts} />}
    </div>
  )
}

export default function BrowsePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-[14px] break-keep" style={{ color: '#6B7684' }}>불러오는 중...</div>}>
      <BrowseInner />
    </Suspense>
  )
}

// ── 금액 포맷 ──────────────────────────────────────────────────
function fmtAmount(n: number): string {
  if (n <= 0) return '0'
  if (n < 1) return n.toFixed(6)
  const rounded = Math.round(n * 100) / 100
  if (Number.isInteger(rounded)) return rounded.toLocaleString()
  return rounded.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

// ── 자산현황 ──────────────────────────────────────────────────
interface CoinRow { coin: string; amount: number; valueKrw: number }
interface BalanceRow {
  ok: boolean; label: string | null; exchange: string
  krw: number; coins: CoinRow[]; totalKrw: number; error?: string
}

function AssetsView({ selectedEx, visibleAccounts }: { selectedEx: SelectedEx; visibleAccounts: AccountMeta[] }) {
  const [phase, setPhase] = useState<'loading' | 'no_keys' | 'fetching' | 'result'>('loading')
  const [balances, setBalances] = useState<BalanceRow[]>([])
  const [grandTotal, setGrandTotal] = useState(0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [selectedAccId, setSelectedAccId] = useState<string>('ALL')

  // visibleAccounts 1개면 자동 선택
  useEffect(() => {
    if (visibleAccounts.length === 1) setSelectedAccId(visibleAccounts[0].id)
    else setSelectedAccId('ALL')
  }, [visibleAccounts])

  useEffect(() => {
    ;(async () => {
      const keys = await listKeys()
      if (keys.length === 0) { setPhase('no_keys'); return }
      const decrypted = await decryptAllByDeviceKey()
      if (decrypted.length === 0) { setPhase('no_keys'); return }
      await fetchBalances(decrypted)
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchBalances(decrypted: { exchange: string; accessKey: string; secretKey: string; label: string }[]) {
    setPhase('fetching')
    setErrorMsg(null)
    try {
      const res = await fetch('/api/app/proxy/balance', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accounts: decrypted.map((d) => ({ exchange: d.exchange, accessKey: d.accessKey, secretKey: d.secretKey, label: d.label })) }),
      })
      const json = await res.json()
      if (json.ok) {
        setBalances(json.data.balances)
        setGrandTotal(json.data.grandTotalKrw ?? 0)
        setPhase('result')
      } else {
        setErrorMsg(json.error ?? '조회 실패')
        setPhase('result')
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '오류')
      setPhase('result')
    }
  }

  async function reload() {
    const decrypted = await decryptAllByDeviceKey()
    if (decrypted.length > 0) await fetchBalances(decrypted)
  }

  if (phase === 'loading' || phase === 'fetching') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-12" style={{ minHeight: '40vh' }}>
        <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
        <p className="text-[14px] font-semibold break-keep" style={{ color: '#191F28' }}>
          {phase === 'loading' ? '준비 중...' : '잔고 조회 중...'}
        </p>
        {phase === 'fetching' && <p className="text-[12px] break-keep" style={{ color: '#6B7684' }}>거래소별 조회에 시간이 걸릴 수 있어요.</p>}
      </div>
    )
  }

  if (phase === 'no_keys') {
    return (
      <div className="px-4 pt-6">
        <div className="rounded-2xl p-8 flex flex-col items-center text-center break-keep"
          style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <p className="text-[32px] mb-3">🔑</p>
          <p className="text-[15px] font-semibold" style={{ color: '#191F28' }}>등록된 API Key가 없습니다.</p>
          <a href="/app/profile/api-keys" className="inline-block mt-4 px-5 py-3 rounded-2xl text-[14px] font-semibold" style={{ background: '#0064FF', color: '#fff' }}>API Key 등록하기</a>
        </div>
      </div>
    )
  }

  // exchange 필터
  let filtered = selectedEx === 'ALL' ? balances : balances.filter((b) => b.exchange === selectedEx)
  // 계정 필터 (2개 이상일 때)
  if (selectedAccId !== 'ALL') {
    const selAcc = visibleAccounts.find((a) => a.id === selectedAccId)
    if (selAcc) filtered = filtered.filter((b) => b.label === selAcc.label)
  }
  const filteredTotal = filtered.reduce((s, b) => s + (b.ok ? b.totalKrw : 0), 0)

  return (
    <>
      {/* 계정 칩 (2개 이상일 때만) */}
      <AccountChips accounts={visibleAccounts} selected={selectedAccId} onChange={setSelectedAccId} />

      <div className="flex flex-col gap-3 p-4 pb-6">
        {errorMsg && <p className="text-[13px] text-center break-keep" style={{ color: '#FF4D4F' }}>{errorMsg}</p>}

        {/* 합계 카드 */}
        <div className="rounded-2xl px-5 py-4 break-keep" style={{ background: '#191F28' }}>
          <p className="text-[11px]" style={{ color: '#B0B8C1' }}>
            {selectedEx === 'ALL' ? '전체 자산' : `${EXCHANGE_META[selectedEx]?.short ?? selectedEx} 자산`} (KRW + 코인 평가액)
          </p>
          <p className="text-[26px] font-bold mt-1" style={{ color: '#fff' }}>{Math.floor(filteredTotal).toLocaleString()}원</p>
        </div>

        {/* 계정별 잔고 */}
        {filtered.length === 0 ? (
          <div className="rounded-2xl p-6 text-center text-[13px] break-keep"
            style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', color: '#6B7684' }}>
            등록된 계정이 없습니다.
          </div>
        ) : filtered.map((b, i) => {
          const meta = EXCHANGE_META[b.exchange] ?? { short: b.exchange, color: '#6B7684', brandBg: '#6B7684', brandFg: '#fff', initial: '?' }
          const activeCoinCount = b.ok ? b.coins.filter((c) => c.amount > 0).length : 0
          return (
            <div key={i} className="rounded-2xl break-keep" style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <ExchangeLogo exchange={b.exchange} size={36} />
                  <div className="min-w-0">
                    <p className="text-[12px] font-bold" style={{ color: meta.color }}>{meta.short}</p>
                    <p className="text-[11px] truncate" style={{ color: '#B0B8C1' }}>{b.label ?? '-'}</p>
                  </div>
                </div>
                {b.ok ? (
                  <div className="text-right shrink-0">
                    <p className="text-[16px] font-bold" style={{ color: '#191F28' }}>{Math.floor(b.totalKrw).toLocaleString()}원</p>
                    <p className="text-[10px] mt-0.5" style={{ color: '#B0B8C1' }}>KRW {Math.floor(b.krw).toLocaleString()}</p>
                  </div>
                ) : (
                  <span className="text-[11px] font-semibold px-2 py-1 rounded-lg shrink-0" style={{ background: '#FFF0F0', color: '#FF4D4F' }}>조회 실패</span>
                )}
              </div>
              {!b.ok && b.error && <p className="px-4 pb-3 text-[11px] break-keep" style={{ color: '#FF4D4F' }}>{b.error}</p>}
              {b.ok && activeCoinCount > 0 && (
                <div className="px-4 pb-3" style={{ borderTop: '1px solid #F2F4F6' }}>
                  <div className="flex flex-col gap-1 pt-2.5">
                    {b.coins.filter((c) => c.amount > 0).sort((x, y) => y.valueKrw - x.valueKrw).slice(0, 10).map((c) => (
                      <div key={c.coin} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] font-semibold" style={{ color: '#191F28' }}>{c.coin}</span>
                          <span className="text-[10px]" style={{ color: '#B0B8C1' }}>{fmtAmount(c.amount)}</span>
                        </div>
                        <span className="text-[12px] font-medium" style={{ color: '#191F28' }}>
                          {c.valueKrw > 0 ? `${c.valueKrw.toLocaleString()}원` : '-'}
                        </span>
                      </div>
                    ))}
                    {activeCoinCount > 10 && <p className="text-[10px]" style={{ color: '#B0B8C1' }}>+{activeCoinCount - 10}개 더</p>}
                  </div>
                </div>
              )}
            </div>
          )
        })}

        <button type="button" onClick={reload}
          className="text-[13px] font-semibold px-4 py-2 rounded-xl mx-auto"
          style={{ color: '#6B7684', background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          🔄 새로고침
        </button>
      </div>
    </>
  )
}

// ── 거래내역 ──────────────────────────────────────────────────
// 거래소 API 직접 호출 (체결 완료 주문) — Phase 1
//   /api/app/proxy/trade-history 에 IndexedDB 키를 보내 거래소별 체결 내역 조회

interface ExchangeHistoryItem {
  type: 'order_filled'
  exchange: string
  accountLabel: string | null
  id: string
  datetime: string
  coin: string
  side: 'buy' | 'sell'
  quantity: number
  total: number
}

type QuickFilter = '오늘' | '7일' | '30일'

function kstToday(): string {
  const kst = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
  return `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, '0')}-${String(kst.getDate()).padStart(2, '0')}`
}
function kstDaysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n + 1)
  const kst = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
  return `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, '0')}-${String(kst.getDate()).padStart(2, '0')}`
}

function formatKst(iso: string): string {
  const d = new Date(new Date(iso).toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function HistoryView({ selectedEx, visibleAccounts }: { selectedEx: SelectedEx; visibleAccounts: AccountMeta[] }) {
  const [phase, setPhase] = useState<'loading' | 'no_keys' | 'fetching' | 'result' | 'error'>('loading')
  const [items, setItems] = useState<ExchangeHistoryItem[]>([])
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [perAccountErrors, setPerAccountErrors] = useState<Array<{ exchange: string | null; label: string | null; error: string }>>([])
  const [selectedAccId, setSelectedAccId] = useState<string>('ALL')
  const [quickFilter, setQuickFilter] = useState<QuickFilter | null>(null)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // visibleAccounts 1개면 자동 선택
  useEffect(() => {
    if (visibleAccounts.length === 1) setSelectedAccId(visibleAccounts[0].id)
    else if (visibleAccounts.length === 0) setSelectedAccId('ALL')
  }, [visibleAccounts])

  // 초기 로드
  useEffect(() => {
    ;(async () => {
      const keys = await listKeys()
      if (keys.length === 0) { setPhase('no_keys'); return }
      const decrypted = await decryptAllByDeviceKey()
      if (decrypted.length === 0) { setPhase('no_keys'); return }
      await fetchHistory(decrypted)
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchHistory(decrypted: { exchange: string; accessKey: string; secretKey: string; label: string }[]) {
    setPhase('fetching')
    setErrorMsg(null)
    try {
      const res = await fetch('/api/app/proxy/trade-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accounts: decrypted.map((d) => ({ exchange: d.exchange, accessKey: d.accessKey, secretKey: d.secretKey, label: d.label })),
          limit: 100,
        }),
      })
      const json = await res.json()
      if (json.ok) {
        setItems(json.data.items)
        const errs = (json.data.perAccount ?? []).filter((p: { ok: boolean }) => !p.ok)
        setPerAccountErrors(errs.map((p: { exchange: string | null; label: string | null; error: string }) => ({ exchange: p.exchange, label: p.label, error: p.error })))
        setPhase('result')
      } else {
        setErrorMsg(json.error ?? '조회 실패')
        setPhase('error')
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '오류')
      setPhase('error')
    }
  }

  async function reload() {
    const decrypted = await decryptAllByDeviceKey()
    if (decrypted.length > 0) await fetchHistory(decrypted)
  }

  // 빠른 필터 — 클라이언트 측에서 datetime으로 필터 (서버는 거래소별로 limit만 적용)
  function handleQuickFilter(f: QuickFilter) {
    setQuickFilter(f)
    const today = kstToday()
    let from = today
    if (f === '7일')  from = kstDaysAgo(7)
    if (f === '30일') from = kstDaysAgo(30)
    setDateFrom(from)
    setDateTo(today)
  }

  function handleDateChange(from: string, to: string) {
    setQuickFilter(null)
    setDateFrom(from)
    setDateTo(to)
  }

  function clearFilter() {
    setQuickFilter(null)
    setDateFrom('')
    setDateTo('')
  }

  // 클라이언트 사이드 필터: exchange + 계정 + 날짜
  const filtered = items.filter((t) => {
    if (selectedEx !== 'ALL' && t.exchange !== selectedEx) return false
    if (selectedAccId !== 'ALL') {
      const selAcc = visibleAccounts.find((a) => a.id === selectedAccId)
      if (selAcc && t.accountLabel !== selAcc.label) return false
    }
    if (dateFrom || dateTo) {
      // datetime은 ISO. KST 날짜로 비교
      const kst = new Date(new Date(t.datetime).toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
      const kstYmd = `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, '0')}-${String(kst.getDate()).padStart(2, '0')}`
      if (dateFrom && kstYmd < dateFrom) return false
      if (dateTo && kstYmd > dateTo) return false
    }
    return true
  })

  if (phase === 'no_keys') {
    return (
      <div className="px-4 pt-6">
        <div className="rounded-2xl p-8 flex flex-col items-center text-center break-keep"
          style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <p className="text-[32px] mb-3">🔑</p>
          <p className="text-[15px] font-semibold" style={{ color: '#191F28' }}>등록된 API Key가 없습니다.</p>
          <p className="text-[12px] mt-1" style={{ color: '#6B7684' }}>거래소 API Key를 등록하시면 거래소의 체결 내역을 보실 수 있어요.</p>
          <a href="/app/profile/api-keys" className="inline-block mt-4 px-5 py-3 rounded-2xl text-[14px] font-semibold" style={{ background: '#0064FF', color: '#fff' }}>API Key 등록하기</a>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* 계정 칩 (2개 이상일 때만) */}
      <AccountChips accounts={visibleAccounts} selected={selectedAccId} onChange={setSelectedAccId} />

      {/* 날짜 필터 */}
      <div className="px-4 py-3" style={{ background: '#fff', borderBottom: '1px solid #F2F4F6' }}>
        <div className="flex items-center gap-2 mb-2.5 flex-wrap">
          {(['오늘', '7일', '30일'] as QuickFilter[]).map((f) => (
            <button key={f} type="button" onClick={() => handleQuickFilter(f)}
              className="px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all"
              style={quickFilter === f
                ? { background: '#0064FF', color: '#fff' }
                : { background: '#F2F4F6', color: '#374151' }
              }>
              {f}
            </button>
          ))}
          <span className="text-[11px] break-keep" style={{ color: '#B0B8C1' }}>
            * 거래소별 최근 100건 기준
          </span>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={dateFrom}
            onChange={(e) => handleDateChange(e.target.value, dateTo)}
            className="flex-1 min-w-0 rounded-xl px-3 py-2 text-[12px] outline-none"
            style={{ border: '1.5px solid #E5E8EB', color: '#191F28', background: '#fff' }}
          />
          <span className="text-[13px] shrink-0" style={{ color: '#B0B8C1' }}>~</span>
          <input type="date" value={dateTo}
            onChange={(e) => handleDateChange(dateFrom, e.target.value)}
            className="flex-1 min-w-0 rounded-xl px-3 py-2 text-[12px] outline-none"
            style={{ border: '1.5px solid #E5E8EB', color: '#191F28', background: '#fff' }}
          />
          {(dateFrom || dateTo) && (
            <button type="button" onClick={clearFilter}
              className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
              style={{ background: '#F2F4F6', color: '#6B7684', fontSize: 13 }}>
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4 p-4 pb-6">
        {phase === 'fetching' && (
          <div className="flex flex-col items-center justify-center gap-3 py-8">
            <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
            <p className="text-[13px] break-keep" style={{ color: '#6B7684' }}>거래소별 체결 내역 조회 중...</p>
          </div>
        )}

        {phase === 'error' && errorMsg && (
          <div className="rounded-2xl p-4 text-center text-[13px] break-keep"
            style={{ background: '#FFF0F0', color: '#FF4D4F' }}>
            {errorMsg}
            <button type="button" onClick={reload}
              className="ml-2 px-3 py-1 rounded-lg text-[12px] font-semibold"
              style={{ background: '#fff', color: '#FF4D4F' }}>
              재시도
            </button>
          </div>
        )}

        {phase === 'result' && (
          <>
            {/* 일부 계정 조회 실패 안내 */}
            {perAccountErrors.length > 0 && (
              <div className="rounded-xl px-3 py-2 text-[11px] break-keep"
                style={{ background: '#FFF7E6', color: '#946200', border: '1px solid #FFD89C' }}>
                ⚠️ 일부 계정 조회 실패: {perAccountErrors.map((e) => `${e.exchange ?? ''}${e.label ? ' '+e.label : ''}`).filter(Boolean).join(', ')}
              </div>
            )}

            {/* 요약 + 새로고침 */}
            <div className="flex items-center justify-between gap-2 px-1">
              <span className="text-[13px] font-semibold" style={{ color: '#191F28' }}>총 {filtered.length}건</span>
              <button type="button" onClick={reload}
                className="text-[12px] font-semibold px-3 py-1 rounded-lg"
                style={{ background: '#fff', color: '#0064FF', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                🔄 새로고침
              </button>
            </div>

            {filtered.length === 0 ? (
              <div className="rounded-2xl p-8 text-center text-[14px] break-keep"
                style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', color: '#6B7684' }}>
                <p className="text-[28px] mb-3">📜</p>
                <p>{dateFrom || dateTo ? '선택한 기간에 거래 내역이 없습니다.' : '체결된 거래가 없어요.'}</p>
              </div>
            ) : (
              <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                {filtered.map((t, idx, arr) => {
                  const meta = EXCHANGE_META[t.exchange] ?? { short: t.exchange, color: '#6B7684', brandBg: '#6B7684', brandFg: '#fff', initial: '?' }
                  const sideLabel = t.side === 'buy' ? '매수' : '매도'
                  const sideColor = t.side === 'buy' ? '#FF4D4F' : '#0064FF'
                  return (
                    <div key={`${t.exchange}-${t.id}`}
                      className="flex items-start justify-between px-4 py-3 break-keep"
                      style={idx < arr.length - 1 ? { borderBottom: '1px solid #F2F4F6' } : undefined}>
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <ExchangeLogo exchange={t.exchange} size={36} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-[11px] font-bold" style={{ color: meta.color }}>{meta.short}</span>
                            {t.accountLabel && <span className="text-[11px]" style={{ color: '#B0B8C1' }}>{t.accountLabel}</span>}
                          </div>
                          <p className="text-[13px] font-bold" style={{ color: '#191F28' }}>
                            {t.coin}
                            <span className="ml-1.5 text-[11px] font-semibold" style={{ color: sideColor }}>
                              {sideLabel}
                            </span>
                          </p>
                          <p className="text-[11px] mt-0.5" style={{ color: '#6B7684' }}>
                            {fmtAmount(t.quantity)} {t.coin} · {Math.floor(t.total).toLocaleString()}원
                          </p>
                          <p className="text-[10px] mt-0.5" style={{ color: '#B0B8C1' }}>{formatKst(t.datetime)}</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
