'use client'

import { useState, useEffect } from 'react'
import { EXCHANGE_LABELS, EXCHANGE_EMOJI, TRADE_TYPE_LABELS } from '@/types/database'

import type { Exchange, TradeType } from '@/types/database'

interface Account {
  id: string
  exchange: string
  account_name: string
}

interface TradeFormProps {
  onExecute: (data: TradeInput) => void
  onSchedule: (data: TradeInput) => void
  loading: boolean
}

export interface TradeInput {
  exchange: Exchange
  coin: string
  tradeType: TradeType
  amountKrw: number
  accountIds: string[]
}

const EXCHANGES = Object.keys(EXCHANGE_LABELS) as Exchange[]
const TRADE_TYPES = Object.keys(TRADE_TYPE_LABELS) as TradeType[]

export default function TradeForm({ onExecute, onSchedule, loading }: TradeFormProps) {
  const [exchange, setExchange] = useState<Exchange | null>(null)
  const [coin, setCoin] = useState('')
  const [coinSuggestions, setCoinSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [tradeType, setTradeType] = useState<TradeType>('CYCLE')
  const [amountKrw, setAmountKrw] = useState(5100)
  const [amountDisplay, setAmountDisplay] = useState('5,100')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [accountsLoading, setAccountsLoading] = useState(false)
  const [error, setError] = useState('')
  const [allCoins, setAllCoins] = useState<string[]>([])

  function handleSetExchange(ex: Exchange) {
    setExchange(ex)
    setCoin('')
    setCoinSuggestions([])
    setAllCoins([])
    // 거래소 변경 시 해당 거래소 코인 목록 비동기 로드
    fetch(`/api/markets?exchange=${ex}`)
      .then((r) => r.json())
      .then((data: string[]) => Array.isArray(data) ? setAllCoins(data) : null)
      .catch(() => null)
  }

  function handleCoinChange(value: string) {
    const upper = value.toUpperCase()
    setCoin(upper)
    if (upper.length >= 1 && allCoins.length > 0) {
      const filtered = allCoins.filter((c) => c.startsWith(upper)).slice(0, 8)
      setCoinSuggestions(filtered)
      setShowSuggestions(filtered.length > 0)
    } else {
      setShowSuggestions(false)
    }
  }

  function handleCoinSelect(selected: string) {
    setCoin(selected)
    setShowSuggestions(false)
  }

  // 거래소 변경 시 계정 목록 조회 → 전체 디폴트 체크
  useEffect(() => {
    if (!exchange) {
      setAccounts([])
      setSelectedIds([])
      return
    }
    setAccountsLoading(true)
    fetch(`/api/accounts?exchange=${exchange}`)
      .then((r) => r.json())
      .then((data) => {
        const list: Account[] = Array.isArray(data) ? data : []
        setAccounts(list)
        setSelectedIds(list.map((a) => a.id)) // 전체 디폴트 체크
      })
      .catch(() => setAccounts([]))
      .finally(() => setAccountsLoading(false))
  }, [exchange])

  function toggleAccount(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function validate(): TradeInput | null {
    setError('')
    if (!exchange) {
      setError('거래소를 선택해주세요.')
      return null
    }
    if (!coin.trim()) { setError('코인을 입력해주세요.'); return null }
    if (tradeType !== 'SELL' && amountKrw < 5100) { setError('최소 거래 금액은 5,100원입니다.'); return null }
    if (selectedIds.length === 0) { setError('계정을 1개 이상 선택해주세요.'); return null }
    return { exchange, coin: coin.trim().toUpperCase(), tradeType, amountKrw, accountIds: selectedIds }
  }

  function handleExecute() {
    const data = validate()
    if (data) onExecute(data)
  }

  function handleSchedule() {
    const data = validate()
    if (data) onSchedule(data)
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <h2 className="mb-4 text-base font-semibold text-gray-900">거래 입력</h2>

      {/* 거래소 선택 */}
      <div className="mb-4">
        <label className={`mb-2 block text-sm font-medium ${!exchange ? 'text-red-600' : 'text-gray-700'}`}>
          거래소 {!exchange && <span className="animate-bounce inline-block">👆 먼저 선택해주세요</span>}
        </label>
        <div className={`flex flex-wrap gap-2 rounded-lg p-1 transition-all ${
          !exchange ? 'animate-pulse bg-red-50 ring-2 ring-red-300' : ''
        }`}>
          {EXCHANGES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => handleSetExchange(ex)}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-sm transition ${
                exchange === ex
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span>{EXCHANGE_EMOJI[ex]}</span>
              {EXCHANGE_LABELS[ex]}
            </button>
          ))}
        </div>
      </div>

      {/* 코인 입력 */}
      <div className="relative mb-4">
        <label className="mb-1 block text-sm font-medium text-gray-700">코인</label>
        <input
          type="text"
          value={coin}
          onChange={(e) => handleCoinChange(e.target.value)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          onFocus={() => coin.length >= 1 && coinSuggestions.length > 0 && setShowSuggestions(true)}
          placeholder="예: BTC, ETH, USDT"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {showSuggestions && (
          <ul className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
            {coinSuggestions.map((c) => (
              <li
                key={c}
                onMouseDown={() => handleCoinSelect(c)}
                className="cursor-pointer px-3 py-2 text-sm hover:bg-blue-50"
              >
                {c}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 거래 방식 */}
      <div className="mb-4">
        <label className="mb-2 block text-sm font-medium text-gray-700">
          거래 방식 <span className="animate-pulse font-bold text-red-500 [animation-duration:1s]">(시장가)</span>
        </label>
        <div className="flex gap-4">
          {TRADE_TYPES.map((tt) => (
            <label key={tt} className="flex cursor-pointer items-center gap-1.5">
              <input
                type="radio"
                name="tradeType"
                checked={tradeType === tt}
                onChange={() => setTradeType(tt)}
                className="accent-blue-600"
              />
              <span className="text-sm">{TRADE_TYPE_LABELS[tt]}</span>
            </label>
          ))}
        </div>
      </div>

      {/* 금액 - 매도일 때 숨김 */}
      {tradeType === 'SELL' ? (
        <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
          <p className="text-sm text-amber-800">💰 보유 코인 전량을 시장가로 매도합니다</p>
          <p className="mt-0.5 text-xs text-amber-600">거래 금액 입력 없이 보유 수량 전체가 매도됩니다.</p>
        </div>
      ) : (
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-gray-700">거래 금액 (KRW)</label>
          <input
            type="text"
            inputMode="numeric"
            value={amountDisplay}
            onChange={(e) => {
              const raw = e.target.value.replace(/,/g, '')
              if (!/^\d*$/.test(raw)) return
              const num = Number(raw)
              setAmountKrw(num)
              setAmountDisplay(num === 0 ? '' : num.toLocaleString())
            }}
            onBlur={() => {
              if (amountKrw === 0) { setAmountDisplay(''); return }
              setAmountDisplay(amountKrw.toLocaleString())
            }}
            placeholder="5,100"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <p className="mt-1 text-xs text-gray-400">최소 거래 금액: 5,100원</p>
        </div>
      )}

      {/* 계정 선택 */}
      <div className="mb-4">
        <label className="mb-2 block text-sm font-medium text-gray-700">계정 선택</label>
        {!exchange && <p className="text-sm text-gray-400">거래소를 먼저 선택해주세요.</p>}
        {accountsLoading && <p className="text-sm text-gray-400">계정 로딩 중...</p>}
        {exchange && !accountsLoading && accounts.length === 0 && (
          <p className="text-sm text-gray-400">등록된 계정이 없습니다.</p>
        )}
        <div className="space-y-2">
          {accounts.map((acc) => (
            <label key={acc.id} className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={selectedIds.includes(acc.id)}
                onChange={() => toggleAccount(acc.id)}
                className="accent-blue-600"
              />
              <span className="text-sm">{acc.account_name}</span>
            </label>
          ))}
        </div>
      </div>

      {/* 에러 */}
      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {/* 실행 버튼 */}
      <div className="flex gap-3">
        <button
          onClick={handleExecute}
          disabled={loading}
          className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? '실행 중...' : '지금 실행'}
        </button>
      </div>
    </section>
  )
}
