'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  listKeys, decryptAllByDeviceKey,
} from '@/lib/app/key-store'
import { EXCHANGE_LABELS, TRADE_TYPE_LABELS, type Exchange, type TradeType } from '@/types/database'

type Tab = 'assets' | 'history'
type SelectedEx = 'ALL' | Exchange

// ── 거래소 브랜드 정보 ────────────────────────────────────────
const EXCHANGE_META: Record<string, {
  short: string
  bg: string        // 아이콘 배경
  color: string     // 텍스트/강조색
  brandBg: string   // 로고 배경색 (공식 CI)
  brandFg: string   // 로고 전경색
  initial: string   // 로고 문자
}> = {
  BITHUMB: { short: '빗썸',  bg: '#FFF0E6', color: '#C94B00', brandBg: '#F05C22', brandFg: '#fff', initial: 'b' },
  UPBIT:   { short: '업비트', bg: '#E6F0FF', color: '#0050CC', brandBg: '#0A3DFF', brandFg: '#fff', initial: 'U' },
  COINONE: { short: '코인원', bg: '#E6F9EE', color: '#007A30', brandBg: '#00B77C', brandFg: '#fff', initial: '1' },
  KORBIT:  { short: '코빗',  bg: '#F3EEFF', color: '#5B21B6', brandBg: '#1B2B4A', brandFg: '#fff', initial: 'K' },
  GOPAX:   { short: '고팍스', bg: '#FFFBE6', color: '#946200', brandBg: '#FFB800', brandFg: '#1A1200', initial: 'G' },
}

// ── 공식 CI 로고 아이콘 ────────────────────────────────────────
function ExchangeLogo({
  exchange,
  size = 48,
  selected = false,
}: {
  exchange: string
  size?: number
  selected?: boolean
}) {
  const meta = EXCHANGE_META[exchange]
  if (!meta) return null
  const r = Math.round(size * 0.28)
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: r,
        background: selected ? meta.brandBg : '#fff',
        border: selected ? `2px solid ${meta.brandBg}` : `2px solid ${meta.brandBg}22`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.15s',
        boxShadow: selected ? `0 3px 10px ${meta.brandBg}55` : '0 1px 4px rgba(0,0,0,0.06)',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          color: selected ? meta.brandFg : meta.brandBg,
          fontSize: size * 0.46,
          fontWeight: 900,
          fontFamily: "'Arial Black', 'Arial', sans-serif",
          lineHeight: 1,
          letterSpacing: '-0.02em',
        }}
      >
        {meta.initial}
      </span>
    </div>
  )
}

// ── 거래소 셀렉터 (등록된 거래소만) ──────────────────────────
function ExchangeSelector({
  selected,
  onChange,
  exchanges,
}: {
  selected: SelectedEx
  onChange: (ex: SelectedEx) => void
  exchanges: Exchange[]
}) {
  if (exchanges.length === 0) return null

  return (
    <div
      className="flex gap-3 px-4 py-3 overflow-x-auto"
      style={{ background: '#fff', borderBottom: '1px solid #F2F4F6', scrollbarWidth: 'none' }}
    >
      {/* 전체 (2개 이상일 때만) */}
      {exchanges.length > 1 && (
        <button type="button" onClick={() => onChange('ALL')} className="flex-shrink-0 flex flex-col items-center gap-1.5">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all"
            style={selected === 'ALL'
              ? { background: '#191F28', boxShadow: '0 3px 10px rgba(0,0,0,0.25)' }
              : { background: '#F2F4F6' }
            }
          >
            <span className="text-[20px]">📊</span>
          </div>
          <span className="text-[10px] font-semibold" style={{ color: selected === 'ALL' ? '#191F28' : '#B0B8C1' }}>전체</span>
        </button>
      )}

      {/* 거래소별 */}
      {exchanges.map((ex) => {
        const meta = EXCHANGE_META[ex]
        const isSelected = selected === ex
        return (
          <button key={ex} type="button" onClick={() => onChange(ex)} className="flex-shrink-0 flex flex-col items-center gap-1.5">
            <ExchangeLogo exchange={ex} size={48} selected={isSelected} />
            <span className="text-[10px] font-semibold" style={{ color: isSelected ? meta.color : '#B0B8C1' }}>
              {meta.short}
            </span>
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
      {([
        { key: 'assets',  label: '💰 자산현황' },
        { key: 'history', label: '📜 거래내역' },
      ] as { key: Tab; label: string }[]).map((t) => (
        <button key={t.key} type="button" onClick={() => onChange(t.key)}
          className="flex-1 py-2 rounded-xl text-[13px] font-semibold transition-all break-keep"
          style={active === t.key ? { background: '#EBF3FF', color: '#0064FF' } : { background: 'transparent', color: '#B0B8C1' }}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

// ── Inner ──────────────────────────────────────────────────────
function BrowseInner() {
  const router = useRouter()
  const params = useSearchParams()
  const initialTab: Tab = (params.get('tab') as Tab) ?? 'assets'
  const [activeTab, setActiveTab] = useState<Tab>(initialTab)
  const [selectedEx, setSelectedEx] = useState<SelectedEx>('ALL')
  const [registeredExchanges, setRegisteredExchanges] = useState<Exchange[]>([])

  useEffect(() => {
    listKeys().then((keys) => {
      const exList = [...new Set(keys.map((k) => k.exchange as Exchange))]
      setRegisteredExchanges(exList)
      if (exList.length === 1) setSelectedEx(exList[0])
    }).catch(() => {})
  }, [])

  function switchTab(t: Tab) {
    setActiveTab(t)
    router.replace(`/app/browse?tab=${t}`, { scroll: false })
  }

  return (
    <div style={{ background: '#F9FAFB', minHeight: '100%' }}>
      <ExchangeSelector
        selected={selectedEx}
        onChange={setSelectedEx}
        exchanges={registeredExchanges}
      />
      <SubTabs active={activeTab} onChange={switchTab} />
      {activeTab === 'assets'  && <AssetsView selectedEx={selectedEx} registeredExchanges={registeredExchanges} />}
      {activeTab === 'history' && <HistoryView selectedEx={selectedEx} />}
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
  ok: boolean
  label: string | null
  exchange: string
  krw: number
  coins: CoinRow[]
  totalKrw: number
  error?: string
}

type AssetPhase = 'loading' | 'no_keys' | 'fetching' | 'result'

function AssetsView({ selectedEx, registeredExchanges }: { selectedEx: SelectedEx; registeredExchanges: Exchange[] }) {
  const [phase, setPhase] = useState<AssetPhase>('loading')
  const [balances, setBalances] = useState<BalanceRow[]>([])
  const [grandTotal, setGrandTotal] = useState(0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      const keys = await listKeys()
      if (keys.length === 0) { setPhase('no_keys'); return }

      // device key로 PIN 없이 복호화
      const decrypted = await decryptAllByDeviceKey()
      if (decrypted.length === 0) {
        // auto_keys 미등록 (최초 or 마이그레이션 전) → 조회 버튼 표시
        setPhase('no_keys')
        return
      }
      await fetchBalances(decrypted)
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchBalances(decrypted: { exchange: string; accessKey: string; secretKey: string; label: string }[]) {
    setPhase('fetching')
    setErrorMsg(null)
    try {
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

  // ── 로딩 ──
  if (phase === 'loading' || phase === 'fetching') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-12" style={{ minHeight: '40vh' }}>
        <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
        <p className="text-[14px] font-semibold break-keep" style={{ color: '#191F28' }}>
          {phase === 'loading' ? '준비 중...' : '잔고 조회 중...'}
        </p>
        {phase === 'fetching' && (
          <p className="text-[12px] break-keep" style={{ color: '#6B7684' }}>거래소별 조회에 시간이 걸릴 수 있어요.</p>
        )}
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
          <a href="/app/profile/api-keys"
            className="inline-block mt-4 px-5 py-3 rounded-2xl text-[14px] font-semibold"
            style={{ background: '#0064FF', color: '#fff' }}>
            API Key 등록하기
          </a>
        </div>
      </div>
    )
  }

  // result
  const filteredBalances = selectedEx === 'ALL'
    ? balances
    : balances.filter((b) => b.exchange === selectedEx)
  const filteredTotal = filteredBalances.reduce((s, b) => s + (b.ok ? b.totalKrw : 0), 0)

  return (
    <div className="flex flex-col gap-3 p-4 pb-6">
      {errorMsg && (
        <p className="text-[13px] text-center break-keep" style={{ color: '#FF4D4F' }}>{errorMsg}</p>
      )}

      {/* 합계 카드 */}
      <div className="rounded-2xl px-5 py-4 break-keep" style={{ background: '#191F28' }}>
        <p className="text-[11px]" style={{ color: '#B0B8C1' }}>
          {selectedEx === 'ALL' ? '전체 자산' : `${EXCHANGE_META[selectedEx]?.short ?? selectedEx} 자산`} (KRW + 코인 평가액)
        </p>
        <p className="text-[26px] font-bold mt-1" style={{ color: '#fff' }}>
          {Math.floor(filteredTotal).toLocaleString()}원
        </p>
      </div>

      {/* 계정별 잔고 */}
      {filteredBalances.length === 0 ? (
        <div className="rounded-2xl p-6 text-center text-[13px] break-keep"
          style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', color: '#6B7684' }}>
          {selectedEx === 'ALL' ? '등록된 계정이 없습니다.' : `${EXCHANGE_META[selectedEx]?.short ?? selectedEx} 계정이 없습니다.`}
        </div>
      ) : (
        filteredBalances.map((b, i) => {
          const meta = EXCHANGE_META[b.exchange] ?? { short: b.exchange, bg: '#F2F4F6', color: '#6B7684', brandBg: '#6B7684', brandFg: '#fff', initial: '?' }
          const activeCoinCount = b.ok ? b.coins.filter((c) => c.amount > 0).length : 0
          return (
            <div key={i} className="rounded-2xl break-keep" style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              {/* 계정 헤더 */}
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
                    <p className="text-[16px] font-bold" style={{ color: '#191F28' }}>
                      {Math.floor(b.totalKrw).toLocaleString()}원
                    </p>
                    <p className="text-[10px] mt-0.5" style={{ color: '#B0B8C1' }}>
                      KRW {Math.floor(b.krw).toLocaleString()}
                    </p>
                  </div>
                ) : (
                  <span className="text-[11px] font-semibold px-2 py-1 rounded-lg shrink-0"
                    style={{ background: '#FFF0F0', color: '#FF4D4F' }}>조회 실패</span>
                )}
              </div>

              {!b.ok && b.error && (
                <p className="px-4 pb-3 text-[11px] break-keep" style={{ color: '#FF4D4F' }}>{b.error}</p>
              )}

              {/* 보유 코인 목록 */}
              {b.ok && activeCoinCount > 0 && (
                <div className="px-4 pb-3" style={{ borderTop: '1px solid #F2F4F6' }}>
                  <div className="flex flex-col gap-1 pt-2.5">
                    {b.coins
                      .filter((c) => c.amount > 0)
                      .sort((x, y) => y.valueKrw - x.valueKrw)
                      .slice(0, 10)
                      .map((c) => (
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
                    {activeCoinCount > 10 && (
                      <p className="text-[10px]" style={{ color: '#B0B8C1' }}>+{activeCoinCount - 10}개 더</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })
      )}

      <button type="button" onClick={reload}
        className="text-[13px] font-semibold px-4 py-2 rounded-xl mx-auto"
        style={{ color: '#6B7684', background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        🔄 새로고침
      </button>
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
        <div className="rounded-2xl p-6 text-center text-[14px] break-keep"
          style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', color: '#6B7684' }}>
          불러오는 중...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl p-8 text-center text-[14px] break-keep"
          style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', color: '#6B7684' }}>
          <p className="text-[28px] mb-3">📜</p>
          <p>{selectedEx === 'ALL' ? '아직 거래 내역이 없어요.' : `${EXCHANGE_META[selectedEx]?.short ?? selectedEx} 거래 내역이 없어요.`}</p>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          {filtered.map((t, idx, arr) => {
            const meta = EXCHANGE_META[t.exchange] ?? { short: t.exchange, bg: '#F2F4F6', color: '#6B7684', brandBg: '#6B7684', brandFg: '#fff', initial: '?' }
            return (
              <div key={t.id}
                className="flex items-start justify-between px-4 py-3 break-keep"
                style={idx < arr.length - 1 ? { borderBottom: '1px solid #F2F4F6' } : undefined}>
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <ExchangeLogo exchange={t.exchange} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[11px] font-bold" style={{ color: meta.color }}>{meta.short}</span>
                      <span className="text-[11px]" style={{ color: '#B0B8C1' }}>{t.accountName ?? ''}</span>
                    </div>
                    <p className="text-[13px] font-bold" style={{ color: '#191F28' }}>
                      {t.coin}
                      <span className="ml-1.5 text-[11px] font-semibold" style={{ color: '#6B7684' }}>
                        {TRADE_TYPE_LABELS[t.tradeType as TradeType] ?? t.tradeType}
                      </span>
                    </p>
                    {t.tradeType !== 'SELL' && t.amountKrw > 0 && (
                      <p className="text-[11px] mt-0.5" style={{ color: '#6B7684' }}>{t.amountKrw.toLocaleString()}원</p>
                    )}
                    {!t.success && t.reason && (
                      <p className="text-[11px] mt-0.5 break-keep" style={{ color: '#FF4D4F' }}>{t.reason}</p>
                    )}
                    <p className="text-[10px] mt-0.5" style={{ color: '#B0B8C1' }}>{formatKst(t.executedAt)}</p>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <span className="text-[13px] font-bold" style={{ color: t.success ? '#00C853' : '#FF4D4F' }}>
                    {t.success ? '성공' : '실패'}
                  </span>
                  {t.success && t.balance != null && (
                    <p className="text-[10px] mt-0.5" style={{ color: '#B0B8C1' }}>{Math.floor(t.balance).toLocaleString()}</p>
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
