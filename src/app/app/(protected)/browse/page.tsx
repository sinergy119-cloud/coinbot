'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import PinPad from '../../_components/PinPad'
import { isPinSet, verifyPin, listKeys, decryptAllByIds } from '@/lib/app/key-store'
import { EXCHANGE_LABELS, TRADE_TYPE_LABELS, type Exchange, type TradeType } from '@/types/database'

type Tab = 'assets' | 'history'

const EXCHANGE_BADGE: Record<string, { bg: string; text: string }> = {
  BITHUMB: { bg: '#FFF0E6', text: '#C94B00' },
  UPBIT:   { bg: '#E6F0FF', text: '#0050CC' },
  COINONE: { bg: '#E6F9EE', text: '#007A30' },
  KORBIT:  { bg: '#F3EEFF', text: '#5B21B6' },
  GOPAX:   { bg: '#FFFBE6', text: '#946200' },
}

// ────────────────────────────────────────
// 서브탭 헤더
// ────────────────────────────────────────

function SubTabs({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const tabs: { key: Tab; label: string }[] = [
    { key: 'assets',  label: '💰 자산현황' },
    { key: 'history', label: '📜 거래내역' },
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

function BrowseInner() {
  const router = useRouter()
  const params = useSearchParams()
  const initialTab: Tab = (params.get('tab') as Tab) ?? 'assets'
  const [activeTab, setActiveTab] = useState<Tab>(initialTab)

  function switchTab(t: Tab) {
    setActiveTab(t)
    router.replace(`/app/browse?tab=${t}`, { scroll: false })
  }

  return (
    <div style={{ background: '#F9FAFB', minHeight: '100%' }}>
      <SubTabs active={activeTab} onChange={switchTab} />
      {activeTab === 'assets'  && <AssetsView />}
      {activeTab === 'history' && <HistoryView />}
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

// ────────────────────────────────────────
// 자산현황 탭
// ────────────────────────────────────────

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

type AssetPhase = 'loading' | 'no_pin' | 'no_keys' | 'pin' | 'fetching' | 'result'

function AssetsView() {
  const [phase, setPhase] = useState<AssetPhase>('loading')
  const [pinError, setPinError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [balances, setBalances] = useState<BalanceRow[]>([])
  const [grandTotal, setGrandTotal] = useState(0)

  useEffect(() => {
    ;(async () => {
      const hasPin = await isPinSet()
      if (!hasPin) { setPhase('no_pin'); return }
      const keys = await listKeys()
      if (keys.length === 0) { setPhase('no_keys'); return }
      setPhase('pin')
    })()
  }, [])

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
      const keys = await listKeys()
      const decrypted = await decryptAllByIds(pin, keys.map((k) => k.id))
      setPhase('fetching')

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
        setPinError(json.error ?? '조회 실패')
        setPhase('pin')
      }
    } catch (err) {
      setPinError(err instanceof Error ? err.message : '오류')
      setPhase('pin')
    } finally {
      setSubmitting(false)
    }
  }

  if (phase === 'loading') {
    return (
      <div className="p-8 text-center text-[14px] break-keep" style={{ color: '#6B7684' }}>
        불러오는 중...
      </div>
    )
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
            {phase === 'no_pin' ? '먼저 API Key를 등록해주세요.' : '등록된 API Key가 없습니다.'}
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

  if (phase === 'pin') {
    return (
      <PinPad
        title="PIN 입력"
        description="자산을 조회하려면 PIN을 입력해주세요."
        errorMessage={pinError}
        onSubmit={handlePin}
        submitting={submitting}
      />
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

  // result
  return (
    <div className="flex flex-col gap-4 p-4 pb-6">
      {/* 전체 합산 */}
      <div
        className="rounded-2xl p-5 break-keep"
        style={{ background: '#191F28' }}
      >
        <p className="text-[12px]" style={{ color: '#B0B8C1' }}>전체 자산 (KRW + 코인 평가액)</p>
        <p className="text-[30px] font-bold mt-1.5" style={{ color: '#fff' }}>
          {Math.floor(grandTotal).toLocaleString()}원
        </p>
      </div>

      {/* 계정별 */}
      <p className="text-[13px] font-semibold px-1" style={{ color: '#6B7684' }}>계정별 잔고</p>
      {balances.map((b, i) => {
        const badge = EXCHANGE_BADGE[b.exchange] ?? { bg: '#F2F4F6', text: '#6B7684' }
        const exchangeLabel = EXCHANGE_LABELS[b.exchange as Exchange] ?? b.exchange
        return (
          <div
            key={i}
            className="rounded-2xl p-5 break-keep"
            style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0 flex-1">
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: badge.bg, color: badge.text }}
                >
                  {exchangeLabel}
                </span>
                <p className="text-[15px] font-bold mt-1.5 truncate" style={{ color: '#191F28' }}>
                  {b.label ?? '-'}
                </p>
              </div>
              {b.ok ? (
                <div className="text-right shrink-0">
                  <p className="text-[18px] font-bold" style={{ color: '#191F28' }}>
                    {Math.floor(b.totalKrw).toLocaleString()}원
                  </p>
                  <p className="text-[11px] mt-0.5" style={{ color: '#B0B8C1' }}>
                    KRW {Math.floor(b.krw).toLocaleString()}
                  </p>
                </div>
              ) : (
                <span
                  className="text-[12px] font-semibold px-2 py-1 rounded-lg"
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
              <div className="mt-3 pt-3" style={{ borderTop: '1px solid #F2F4F6' }}>
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
        onClick={() => setPhase('pin')}
        className="text-[13px] font-semibold px-4 py-2 rounded-xl mx-auto"
        style={{ color: '#6B7684', background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
      >
        🔄 다시 조회
      </button>
    </div>
  )
}

// ────────────────────────────────────────
// 거래내역 탭
// ────────────────────────────────────────

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

function HistoryView() {
  const [items, setItems] = useState<TradeItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/app/trade-history?limit=50')
      .then((r) => r.json())
      .then((j) => { if (j.ok) setItems(j.data.items) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="flex flex-col gap-4 p-4 pb-6">
      {loading ? (
        <div
          className="rounded-2xl p-6 text-center text-[14px] break-keep"
          style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', color: '#6B7684' }}
        >
          불러오는 중...
        </div>
      ) : items.length === 0 ? (
        <div
          className="rounded-2xl p-8 text-center text-[14px] break-keep"
          style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', color: '#6B7684' }}
        >
          <p className="text-[28px] mb-3">📜</p>
          <p>아직 거래 내역이 없어요.</p>
        </div>
      ) : (
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
        >
          {items.map((t, idx, arr) => {
            const badge = EXCHANGE_BADGE[t.exchange] ?? { bg: '#F2F4F6', text: '#6B7684' }
            const exchangeLabel = EXCHANGE_LABELS[t.exchange as Exchange] ?? t.exchange
            return (
              <div
                key={t.id}
                className="flex items-start justify-between px-5 py-4 break-keep"
                style={idx < arr.length - 1 ? { borderBottom: '1px solid #F2F4F6' } : undefined}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                      style={{ background: badge.bg, color: badge.text }}
                    >
                      {exchangeLabel}
                    </span>
                    <span className="text-[11px]" style={{ color: '#B0B8C1' }}>
                      {t.accountName ?? '-'}
                    </span>
                  </div>
                  <p className="text-[15px] font-bold" style={{ color: '#191F28' }}>
                    {t.coin}
                    <span className="ml-2 text-[12px] font-semibold" style={{ color: '#6B7684' }}>
                      {TRADE_TYPE_LABELS[t.tradeType as TradeType] ?? t.tradeType}
                    </span>
                  </p>
                  {t.tradeType !== 'SELL' && t.amountKrw > 0 && (
                    <p className="text-[12px] mt-0.5" style={{ color: '#6B7684' }}>
                      {t.amountKrw.toLocaleString()}원
                    </p>
                  )}
                  {!t.success && t.reason && (
                    <p className="text-[11px] mt-0.5 break-keep" style={{ color: '#FF4D4F' }}>{t.reason}</p>
                  )}
                  <p className="text-[11px] mt-1" style={{ color: '#B0B8C1' }}>
                    {formatKst(t.executedAt)}
                  </p>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <span
                    className="text-[13px] font-bold"
                    style={{ color: t.success ? '#00C853' : '#FF4D4F' }}
                  >
                    {t.success ? '성공' : '실패'}
                  </span>
                  {t.success && t.balance != null && (
                    <p className="text-[11px] mt-0.5" style={{ color: '#B0B8C1' }}>
                      잔액 {Math.floor(t.balance).toLocaleString()}
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
