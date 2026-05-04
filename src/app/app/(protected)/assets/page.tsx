'use client'

// 자산 요약 페이지
// PIN 입력 → 저장된 모든 키 복호화 → /api/app/proxy/balance 호출

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { isPinSet, listKeys, decryptAllByDeviceKey } from '@/lib/app/key-store'
import { EXCHANGE_LABELS, type Exchange } from '@/types/database'
import ExchangeIcon from '@/components/ExchangeIcon'

interface CoinRow {
  coin: string
  amount: number
  valueKrw: number
}

interface BalanceRow {
  ok: boolean
  label: string | null
  exchange: string
  krw: number
  coins: CoinRow[]
  totalKrw: number
  error?: string
}

type Phase = 'loading' | 'no_pin' | 'no_keys' | 'fetching' | 'result' | 'error'

// 거래소별 뱃지 색상
const EXCHANGE_BADGE: Record<string, { bg: string; text: string }> = {
  BITHUMB: { bg: '#FFF0E6', text: '#C94B00' },
  UPBIT:   { bg: '#E6F0FF', text: '#0050CC' },
  COINONE: { bg: '#E6F9EE', text: '#007A30' },
  KORBIT:  { bg: '#F3EEFF', text: '#5B21B6' },
  GOPAX:   { bg: '#FFFBE6', text: '#946200' },
}

export default function AssetsPage() {
  const [phase, setPhase] = useState<Phase>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [balances, setBalances] = useState<BalanceRow[]>([])
  const [grandTotal, setGrandTotal] = useState(0)

  useEffect(() => {
    (async () => {
      const hasPin = await isPinSet()
      if (!hasPin) { setPhase('no_pin'); return }
      const keys = await listKeys()
      if (keys.length === 0) { setPhase('no_keys'); return }
      void fetchBalances()
    })()
  }, [])

  async function fetchBalances() {
    setErrorMessage(null)
    setPhase('fetching')
    try {
      const decrypted = await decryptAllByDeviceKey()
      if (decrypted.length === 0) {
        setErrorMessage('자동 복호화에 실패했습니다. API Key를 다시 등록해주세요.')
        setPhase('error')
        return
      }

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
        setErrorMessage(json.error ?? '조회 실패')
        setPhase('error')
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : '오류')
      setPhase('error')
    }
  }

  if (phase === 'loading') {
    return (
      <div className="p-8 text-center text-[14px] break-keep" style={{ color: '#6B7684' }}>
        불러오는 중...
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5 pb-6" style={{ background: '#F9FAFB', minHeight: '100%' }}>

      {/* 헤더 */}
      <header className="px-4 pt-6 pb-0 break-keep">
        <Link
          href="/app"
          className="inline-flex items-center gap-1 text-[13px] font-semibold"
          style={{ color: '#6B7684' }}
        >
          ← 홈
        </Link>
        <h1 className="text-[22px] font-bold mt-3" style={{ color: '#191F28' }}>내 자산</h1>
      </header>

      {/* API 키 미등록 */}
      {(phase === 'no_pin' || phase === 'no_keys') && (
        <div className="px-4">
          <div
            className="rounded-2xl p-8 flex flex-col items-center text-center break-keep"
            style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
          >
            <p className="text-[32px] mb-3">{phase === 'no_pin' ? '🔒' : '🔑'}</p>
            <p className="text-[15px] font-semibold" style={{ color: '#191F28' }}>
              {phase === 'no_pin' ? '먼저 API Key를 등록해주세요.' : '등록된 API Key가 없습니다.'}
            </p>
            <Link
              href="/app/profile/api-keys"
              className="inline-block mt-4 px-5 py-3 rounded-2xl text-[14px] font-semibold"
              style={{ background: '#0064FF', color: '#fff' }}
            >
              API Key 등록하기
            </Link>
          </div>
        </div>
      )}

      {/* 오류 */}
      {phase === 'error' && (
        <div className="px-4">
          <div
            className="rounded-2xl p-6 text-center break-keep"
            style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
          >
            <p className="text-[14px]" style={{ color: '#FF4D4F' }}>
              {errorMessage ?? '조회에 실패했습니다.'}
            </p>
            <button
              type="button"
              onClick={fetchBalances}
              className="mt-3 px-4 py-2 rounded-xl text-[13px] font-semibold"
              style={{ background: '#0064FF', color: '#fff' }}
            >
              다시 시도
            </button>
          </div>
        </div>
      )}

      {/* 조회 중 */}
      {phase === 'fetching' && (
        <div className="flex flex-col items-center justify-center gap-3 p-12" style={{ minHeight: '50vh' }}>
          <p className="text-[32px]">⏳</p>
          <p className="text-[16px] font-semibold break-keep" style={{ color: '#191F28' }}>잔고 조회 중...</p>
          <p className="text-[13px] break-keep" style={{ color: '#6B7684' }}>거래소별 조회에 시간이 걸릴 수 있어요.</p>
        </div>
      )}

      {/* 결과 */}
      {phase === 'result' && (
        <>
          {/* 총합 카드 */}
          <section className="px-4">
            <div
              className="rounded-2xl p-5 break-keep"
              style={{ background: '#191F28' }}
            >
              <p className="text-[12px]" style={{ color: '#B0B8C1' }}>전체 자산 (KRW + 코인 평가액)</p>
              <p className="text-[30px] font-bold mt-1.5" style={{ color: '#fff' }}>
                {Math.floor(grandTotal).toLocaleString()}원
              </p>
            </div>
          </section>

          {/* 계정별 잔고 */}
          <section className="px-4">
            <p className="text-[13px] font-semibold mb-2 px-1" style={{ color: '#6B7684' }}>계정별 잔고</p>
            <div className="flex flex-col gap-3">
              {balances.map((b, i) => {
                const badge = EXCHANGE_BADGE[b.exchange] ?? { bg: '#F2F4F6', text: '#6B7684' }
                const exchangeLabel = EXCHANGE_LABELS[b.exchange as Exchange] ?? b.exchange
                return (
                  <div
                    key={i}
                    className="rounded-2xl p-5 break-keep"
                    style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
                  >
                    {/* 거래소 + 계정명 + 총액 */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="min-w-0 flex-1">
                        <span
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1"
                          style={{ background: badge.bg, color: badge.text }}
                        >
                          <ExchangeIcon exchange={b.exchange} size={13} />
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

                    {/* 오류 메시지 */}
                    {!b.ok && b.error && (
                      <p className="text-[12px] break-keep" style={{ color: '#FF4D4F' }}>{b.error}</p>
                    )}

                    {/* 코인 목록 */}
                    {b.ok && b.coins.filter((c) => c.amount > 0).length > 0 && (
                      <div
                        className="mt-3 pt-3"
                        style={{ borderTop: '1px solid #F2F4F6' }}
                      >
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
                          {b.coins.length > 10 && (
                            <p className="text-[11px]" style={{ color: '#B0B8C1' }}>+{b.coins.length - 10}개 더</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          {/* 재조회 */}
          <div className="px-4 text-center">
            <button
              type="button"
              onClick={() => setPhase('pin')}
              className="text-[13px] font-semibold px-4 py-2 rounded-xl"
              style={{ color: '#6B7684', background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
            >
              🔄 다시 조회
            </button>
          </div>
        </>
      )}
    </div>
  )
}
