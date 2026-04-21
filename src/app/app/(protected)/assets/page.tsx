'use client'

// 자산 요약 페이지
// PIN 입력 → 저장된 모든 키 복호화 → /api/app/proxy/balance 호출

import Link from 'next/link'
import { useEffect, useState } from 'react'
import PinPad from '../../_components/PinPad'
import { isPinSet, verifyPin, listKeys, decryptAllByIds } from '@/lib/app/key-store'
import { EXCHANGE_LABELS, type Exchange } from '@/types/database'

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

type Phase = 'loading' | 'no_pin' | 'no_keys' | 'pin' | 'fetching' | 'result'

export default function AssetsPage() {
  const [phase, setPhase] = useState<Phase>('loading')
  const [pinError, setPinError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [balances, setBalances] = useState<BalanceRow[]>([])
  const [grandTotal, setGrandTotal] = useState(0)

  useEffect(() => {
    (async () => {
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
    return <div className="p-8 text-center text-sm text-gray-600">불러오는 중...</div>
  }

  return (
    <div className="flex flex-col">
      <header className="px-4 pt-6 pb-2 break-keep">
        <Link href="/app" className="text-xs text-gray-600 font-semibold">← 홈</Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-3">내 자산</h1>
      </header>

      {phase === 'no_pin' && (
        <div className="p-8 text-center break-keep">
          <p className="text-3xl mb-3">🔒</p>
          <p className="text-base font-semibold text-gray-900">먼저 API Key를 등록해주세요.</p>
          <Link
            href="/app/profile/api-keys"
            className="inline-block mt-4 bg-gray-900 text-white px-5 py-2.5 rounded-lg text-sm font-semibold"
          >
            API Key 등록하기
          </Link>
        </div>
      )}

      {phase === 'no_keys' && (
        <div className="p-8 text-center break-keep">
          <p className="text-3xl mb-3">🔑</p>
          <p className="text-base font-semibold text-gray-900">등록된 API Key가 없습니다.</p>
          <Link
            href="/app/profile/api-keys"
            className="inline-block mt-4 bg-gray-900 text-white px-5 py-2.5 rounded-lg text-sm font-semibold"
          >
            API Key 등록하기
          </Link>
        </div>
      )}

      {phase === 'pin' && (
        <PinPad
          title="PIN 입력"
          description="자산을 조회하려면 PIN을 입력해주세요."
          errorMessage={pinError}
          onSubmit={handlePin}
          submitting={submitting}
        />
      )}

      {phase === 'fetching' && (
        <div className="p-8 text-center">
          <p className="text-3xl">⏳</p>
          <p className="text-sm text-gray-900 font-semibold mt-3">잔고 조회 중...</p>
          <p className="text-xs text-gray-600 mt-1">거래소별 조회에 시간이 걸릴 수 있어요.</p>
        </div>
      )}

      {phase === 'result' && (
        <div className="flex flex-col gap-4 px-4 pb-4">
          {/* 총합 카드 */}
          <div className="bg-gray-900 text-white rounded-2xl p-5">
            <p className="text-xs text-gray-300">전체 자산 (KRW + 코인 평가액)</p>
            <p className="text-3xl font-bold mt-1">{Math.floor(grandTotal).toLocaleString()}원</p>
          </div>

          {/* 계정별 */}
          {balances.map((b, i) => (
            <div key={i} className="bg-white rounded-2xl p-4 break-keep">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-600 font-semibold">{EXCHANGE_LABELS[b.exchange as Exchange] ?? b.exchange}</p>
                  <p className="text-sm font-bold text-gray-900 mt-0.5 truncate">{b.label ?? '-'}</p>
                </div>
                {b.ok ? (
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-gray-900">{Math.floor(b.totalKrw).toLocaleString()}원</p>
                    <p className="text-[10px] text-gray-600 mt-0.5">KRW {Math.floor(b.krw).toLocaleString()}</p>
                  </div>
                ) : (
                  <p className="text-xs text-red-600">실패</p>
                )}
              </div>
              {!b.ok && b.error && (
                <p className="text-xs text-red-700 mt-2 break-keep">{b.error}</p>
              )}
              {b.ok && b.coins.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-[10px] text-gray-600 font-semibold mb-2">보유 코인</p>
                  <div className="flex flex-col gap-1">
                    {b.coins
                      .filter((c) => c.amount > 0)
                      .sort((x, y) => y.valueKrw - x.valueKrw)
                      .slice(0, 10)
                      .map((c) => (
                        <div key={c.coin} className="flex items-center justify-between">
                          <div>
                            <span className="text-xs font-semibold text-gray-900">{c.coin}</span>
                            <span className="text-[10px] text-gray-600 ml-2">
                              {c.amount.toFixed(c.amount < 1 ? 6 : 2)}
                            </span>
                          </div>
                          <span className="text-xs text-gray-900 font-medium">
                            {c.valueKrw > 0 ? `${c.valueKrw.toLocaleString()}원` : '-'}
                          </span>
                        </div>
                      ))}
                    {b.coins.length > 10 && (
                      <span className="text-[10px] text-gray-600">+{b.coins.length - 10}개 더</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={() => setPhase('pin')}
            className="text-xs text-gray-700 py-3 underline"
          >
            다시 조회
          </button>
        </div>
      )}
    </div>
  )
}
