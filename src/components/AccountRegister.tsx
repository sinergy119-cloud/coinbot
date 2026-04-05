'use client'

import { useState, useEffect, useCallback } from 'react'
import { Trash2 } from 'lucide-react'
import { EXCHANGE_LABELS } from '@/types/database'
import type { Exchange } from '@/types/database'

interface Account {
  id: string
  exchange: Exchange
  account_name: string
  created_at: string
}

const EXCHANGES = Object.keys(EXCHANGE_LABELS) as Exchange[]

export default function AccountRegister() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [exchange, setExchange] = useState<Exchange | null>(null)
  const [accountName, setAccountName] = useState('')
  const [accessKey, setAccessKey] = useState('')
  const [secretKey, setSecretKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const fetchAccounts = useCallback(async () => {
    const res = await fetch('/api/exchange-accounts')
    if (res.ok) setAccounts(await res.json())
  }, [])

  useEffect(() => { fetchAccounts() }, [fetchAccounts])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!exchange) { setError('거래소를 선택해주세요.'); return }
    if (!accountName.trim()) { setError('계정 이름을 입력해주세요.'); return }
    if (!accessKey.trim() || !secretKey.trim()) { setError('API Key를 입력해주세요.'); return }

    setLoading(true)
    try {
      const res = await fetch('/api/exchange-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exchange, accountName, accessKey, secretKey }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || '등록 실패')
        return
      }
      setSuccess(`${EXCHANGE_LABELS[exchange]} - ${accountName} 계정이 등록되었습니다.`)
      setExchange(null)
      setAccountName('')
      setAccessKey('')
      setSecretKey('')
      fetchAccounts()
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`'${name}' 계정을 삭제하시겠습니까?`)) return
    const res = await fetch(`/api/exchange-accounts/${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) {
      alert(data.error || '삭제 실패')
      return
    }
    fetchAccounts()
  }

  return (
    <div className="space-y-4">
      {/* 등록 폼 */}
      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="mb-4 text-base font-semibold text-gray-900">거래소 계정 등록</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 거래소 선택 */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">거래소</label>
            <div className="flex flex-wrap gap-2">
              {EXCHANGES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => setExchange(ex)}
                  className={`rounded-full px-3 py-1.5 text-sm transition ${
                    exchange === ex
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {EXCHANGE_LABELS[ex]}
                </button>
              ))}
            </div>
          </div>

          {/* 계정 이름 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">계정 이름</label>
            <input
              type="text"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="예: 홍길동"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* API Key */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">API Key</label>
            <input
              type="password"
              value={accessKey}
              onChange={(e) => setAccessKey(e.target.value)}
              placeholder="거래소에서 발급받은 Access Key"
              autoComplete="off"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Secret Key */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Secret Key</label>
            <input
              type="password"
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
              placeholder="거래소에서 발급받은 Secret Key"
              autoComplete="off"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-400">
              ※ API는 &apos;입출금 권한 제외&apos; 상태로 발급하세요. 저장 시 AES 암호화됩니다.
            </p>
          </div>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          {success && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{success}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? '검증 중... (잔고 조회)' : '계정 저장'}
          </button>
        </form>
      </section>

      {/* 등록된 계정 목록 */}
      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-base font-semibold text-gray-900">등록된 계정</h2>

        {accounts.length === 0 ? (
          <p className="text-sm text-gray-400">등록된 계정이 없습니다.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {accounts.map((acc) => (
              <li key={acc.id} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                    {EXCHANGE_LABELS[acc.exchange] ?? acc.exchange}
                  </span>
                  <span className="text-sm font-medium">{acc.account_name}</span>
                </div>
                <button
                  onClick={() => handleDelete(acc.id, acc.account_name)}
                  className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
