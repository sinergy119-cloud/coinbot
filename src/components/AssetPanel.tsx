'use client'

import { useState } from 'react'
import { EXCHANGE_LABELS, EXCHANGE_EMOJI } from '@/types/database'
import type { Exchange } from '@/types/database'
import type { AccountAsset } from '@/app/api/assets/route'

const EXCHANGES = Object.keys(EXCHANGE_LABELS) as Exchange[]

interface AssetPanelProps {
  defaultExchange?: string | null
  onExchangeChange?: (ex: string) => void
}

export default function AssetPanel({ defaultExchange, onExchangeChange }: AssetPanelProps) {
  const [exchange, setExchange] = useState<Exchange | null>((defaultExchange as Exchange) ?? null)
  const [assets, setAssets] = useState<AccountAsset[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function fetchAssets(ex: Exchange) {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/assets?exchange=${ex}`)
      const data = await res.json()
      if (!res.ok) { setError(data.error || '조회 실패'); return }
      setAssets(Array.isArray(data) ? data : [])
    } catch { setError('네트워크 오류가 발생했습니다.') }
    finally { setLoading(false) }
  }

  function handleSelect(ex: Exchange) {
    setExchange(ex)
    onExchangeChange?.(ex)
    fetchAssets(ex)
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">나의 자산</h2>
        {exchange && (
          <button
            onClick={() => fetchAssets(exchange)}
            disabled={loading}
            className="text-sm text-blue-600 hover:underline disabled:opacity-50"
          >
            새로고침
          </button>
        )}
      </div>

      {/* 거래소 선택 */}
      <div className="mb-4 flex flex-wrap gap-2">
        {EXCHANGES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => handleSelect(ex)}
            className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-sm transition ${
              exchange === ex ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <span>{EXCHANGE_EMOJI[ex]}</span>
            {EXCHANGE_LABELS[ex]}
          </button>
        ))}
      </div>

      {/* 상태 메시지 */}
      {!exchange && <p className="text-sm text-gray-500">거래소를 선택해주세요.</p>}
      {loading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-gray-100" />
          ))}
        </div>
      )}
      {error && <p className="text-sm text-red-500">{error}</p>}

      {/* 총평가 합계 */}
      {!loading && assets.length > 0 && (() => {
        const totalKrw = assets.reduce((s, a) => s + a.krw + a.coins.reduce((cs, c) => cs + c.value, 0), 0)
        return (
          <div className="mb-3 flex items-center justify-between rounded-lg bg-blue-50 px-3 py-2">
            <span className="text-sm font-medium text-blue-700">총평가</span>
            <span className="text-base font-bold text-blue-700">{Math.floor(totalKrw).toLocaleString()}원</span>
          </div>
        )
      })()}

      {/* 계정별 자산 */}
      {!loading && assets.length > 0 && (
        <div className="space-y-3">
          {assets.map((acc) => (
            <div key={acc.accountId} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <p className="mb-2 text-sm font-semibold text-gray-800">
                {EXCHANGE_EMOJI[exchange!]} {acc.accountName}
              </p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">KRW</span>
                  <span className="font-medium">{Math.floor(acc.krw).toLocaleString()}원</span>
                </div>
                {acc.coins.map((c) => (
                  <div key={c.coin} className="flex justify-between">
                    <span className="text-gray-500">{c.coin}</span>
                    <span className="text-right">
                      <span className="text-gray-700">
                        {c.qty.toFixed(8).replace(/\.?0+$/, '') || '0'}
                      </span>
                      {c.value > 0 && (
                        <span className="ml-2 text-gray-500 text-xs">
                          ≈ {Math.floor(c.value).toLocaleString()}원
                        </span>
                      )}
                    </span>
                  </div>
                ))}
                {acc.coins.length === 0 && (
                  <p className="text-xs text-gray-500">보유 코인 없음</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && exchange && assets.length === 0 && !error && (
        <p className="text-sm text-gray-500">등록된 계정이 없습니다.</p>
      )}
    </section>
  )
}
