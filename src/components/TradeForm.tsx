'use client'

import { useState, useEffect } from 'react'
import { EXCHANGE_LABELS, TRADE_TYPE_LABELS } from '@/types/database'
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
  const [tradeType, setTradeType] = useState<TradeType>('BUY')
  const [amountKrw, setAmountKrw] = useState(5100)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [accountsLoading, setAccountsLoading] = useState(false)
  const [error, setError] = useState('')

  // 거래소 변경 시 계정 목록 조회
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
        setAccounts(Array.isArray(data) ? data : [])
        setSelectedIds([])
      })
      .catch(() => setAccounts([]))
      .finally(() => setAccountsLoading(false))
  }, [exchange])

  function toggleAccount(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function validate(): TradeInput | null {
    setError('')
    if (!exchange) { setError('거래소를 선택해주세요.'); return null }
    if (!coin.trim()) { setError('코인을 입력해주세요.'); return null }
    if (amountKrw < 5100) { setError('최소 거래 금액은 5,100원입니다.'); return null }
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
        <label className="mb-2 block text-sm font-medium text-gray-700">거래소</label>
        <div className="flex flex-wrap gap-2">
          {EXCHANGES.map((ex) => (
            <label key={ex} className="flex cursor-pointer items-center gap-1.5">
              <input
                type="radio"
                name="exchange"
                checked={exchange === ex}
                onChange={() => setExchange(ex)}
                className="accent-blue-600"
              />
              <span className="text-sm">{EXCHANGE_LABELS[ex]}</span>
            </label>
          ))}
        </div>
      </div>

      {/* 코인 입력 */}
      <div className="mb-4">
        <label className="mb-1 block text-sm font-medium text-gray-700">코인</label>
        <input
          type="text"
          value={coin}
          onChange={(e) => setCoin(e.target.value)}
          placeholder="예: BTC, ETH, USDT"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* 거래 방식 */}
      <div className="mb-4">
        <label className="mb-2 block text-sm font-medium text-gray-700">거래 방식</label>
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
        <p className="mt-1 text-xs text-gray-400">현재 서비스는 시장가 거래만 지원합니다.</p>
      </div>

      {/* 금액 */}
      <div className="mb-4">
        <label className="mb-1 block text-sm font-medium text-gray-700">거래 금액 (KRW)</label>
        <input
          type="number"
          value={amountKrw}
          onChange={(e) => setAmountKrw(Number(e.target.value))}
          min={5100}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <p className="mt-1 text-xs text-gray-400">최소 거래 금액: 5,100원</p>
      </div>

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
          className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? '실행 중...' : '지금 실행'}
        </button>
        <button
          onClick={handleSchedule}
          disabled={loading}
          className="flex-1 rounded-lg border border-blue-600 py-2.5 text-sm font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-50"
        >
          스케줄 등록
        </button>
      </div>
    </section>
  )
}
