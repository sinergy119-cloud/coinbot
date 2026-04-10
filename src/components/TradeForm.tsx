'use client'

import { useState, useMemo } from 'react'
import { EXCHANGE_LABELS, EXCHANGE_EMOJI, TRADE_TYPE_LABELS } from '@/types/database'

import type { Exchange, TradeType } from '@/types/database'

interface Account {
  id: string
  exchange: string
  account_name: string
  _delegated?: boolean
}

interface TradeFormProps {
  onExecute: (data: TradeInput) => void
  loading: boolean
}

export interface TradeInput {
  exchange: Exchange
  coin: string
  tradeType: TradeType
  amountKrw: number
  accountIds: string[]
}

interface CoinInfo { code: string; name: string }

const EXCHANGES = Object.keys(EXCHANGE_LABELS) as Exchange[]
const TRADE_TYPES = Object.keys(TRADE_TYPE_LABELS) as TradeType[]

export default function TradeForm({ onExecute, loading }: TradeFormProps) {
  const [exchange, setExchange] = useState<Exchange | null>(null)
  const [coin, setCoin] = useState('')
  const [tradeType, setTradeType] = useState<TradeType>('CYCLE')
  const [amountKrw, setAmountKrw] = useState(5100)
  const [amountDisplay, setAmountDisplay] = useState('5,100')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [accountsLoading, setAccountsLoading] = useState(false)
  const [error, setError] = useState('')
  const [allCoins, setAllCoins] = useState<CoinInfo[]>([])
  const [coinsLoading, setCoinsLoading] = useState(false)
  const [coinFocused, setCoinFocused] = useState(false)

  function handleSetExchange(ex: Exchange) {
    setExchange(ex)
    setCoin('')
    setAllCoins([])
    setAccounts([])
    setSelectedIds([])

    // 코인 목록 로드
    setCoinsLoading(true)
    fetch(`/api/markets?exchange=${ex}`)
      .then((r) => r.json())
      .then((data: CoinInfo[]) => Array.isArray(data) ? setAllCoins(data) : null)
      .catch(() => null)
      .finally(() => setCoinsLoading(false))

    // 계정 목록 로드 → 전체 디폴트 선택
    setAccountsLoading(true)
    fetch(`/api/accounts?exchange=${ex}`)
      .then((r) => r.json())
      .then((data) => {
        const list: Account[] = Array.isArray(data) ? data : []
        setAccounts(list)
        setSelectedIds(list.filter((a: Account & { _delegated?: boolean }) => !a._delegated).map((a) => a.id))
      })
      .catch(() => setAccounts([]))
      .finally(() => setAccountsLoading(false))
  }

  // coin + allCoins 에서 파생되는 자동완성 목록 (useMemo로 불필요한 state 제거)
  const coinSuggestions = useMemo(() => {
    if (coin.length < 1 || allCoins.length === 0) return []
    const upper = coin.toUpperCase()
    return allCoins.filter((c) => c.code.startsWith(upper) || c.name.includes(coin)).slice(0, 8)
  }, [coin, allCoins])

  function handleCoinChange(value: string) {
    setCoin(value.toUpperCase())
  }

  function handleCoinSelect(selected: CoinInfo) {
    setCoin(selected.code)
    setCoinFocused(false)
  }

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

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <h2 className="mb-4 text-base font-semibold text-gray-900">거래 입력</h2>

      {/* 거래소 선택 */}
      <div className="mb-4">
        <label className={`mb-2 block text-sm font-medium ${!exchange ? 'text-red-600' : 'text-gray-700'}`}>
          거래소 {!exchange && <span className="animate-bounce inline-block text-blue-600">👇 먼저 선택해 주세요</span>}
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
        <label className="mb-1 block text-sm font-medium text-gray-700">
          코인
          {coinsLoading && <span className="ml-2 text-xs text-blue-500 animate-pulse">목록 로딩 중...</span>}
          {!coinsLoading && allCoins.length > 0 && <span className="ml-2 text-xs text-gray-400">{allCoins.length}종</span>}
        </label>
        <input
          type="text"
          value={coin}
          onChange={(e) => handleCoinChange(e.target.value)}
          onFocus={() => setCoinFocused(true)}
          onBlur={() => setTimeout(() => setCoinFocused(false), 150)}
          placeholder={coinsLoading ? '코인 목록 로딩 중...' : '코드(BTC) 또는 이름(비트코인) 입력'}
          disabled={coinsLoading}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
        />
        {coinFocused && coinSuggestions.length > 0 && (
          <ul className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
            {coinSuggestions.map((c) => (
              <li
                key={c.code}
                onMouseDown={() => handleCoinSelect(c)}
                className="flex items-center gap-2 cursor-pointer px-3 py-2 text-sm hover:bg-blue-50"
              >
                <span className="font-semibold text-gray-900 w-16 shrink-0">{c.code}</span>
                <span className="text-gray-400 text-xs">{c.name}</span>
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
          <label className="mb-1 block text-sm font-medium text-gray-700">
            거래 금액 (KRW)
            {tradeType === 'CYCLE' && <span className="ml-1 text-xs font-normal text-red-500">※ 매수 후 전량 매도 (기존 보유 포함)</span>}
          </label>
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
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
        <div className="space-y-1.5">
          {accounts.filter((a) => !a._delegated).map((acc) => (
            <label key={acc.id} className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={selectedIds.includes(acc.id)}
                onChange={() => toggleAccount(acc.id)} className="accent-blue-600" />
              <span className="text-sm">{acc.account_name}</span>
            </label>
          ))}
          {accounts.some((a) => a._delegated) && (
            <>
              <p className="mt-2 mb-1 text-xs font-semibold text-purple-600">📁 위임받은 계정</p>
              {accounts.filter((a) => a._delegated).map((acc) => (
                <label key={acc.id} className="flex cursor-pointer items-center gap-2 rounded bg-purple-50 px-2 py-1">
                  <input type="checkbox" checked={selectedIds.includes(acc.id)}
                    onChange={() => toggleAccount(acc.id)} className="accent-purple-600" />
                  <span className="text-sm text-purple-800">{acc.account_name}</span>
                </label>
              ))}
            </>
          )}
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
