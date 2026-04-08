'use client'

import { useState, useEffect, useCallback } from 'react'
import { Trash2 } from 'lucide-react'
import Header from '@/components/Header'
import { EXCHANGE_LABELS, EXCHANGE_EMOJI } from '@/types/database'
import type { Exchange } from '@/types/database'


interface User {
  id: string
  user_id: string
}
interface Account {
  id: string
  user_id: string
  exchange: Exchange
  account_name: string
  created_at: string
}

const EXCHANGES = Object.keys(EXCHANGE_LABELS) as Exchange[]

export default function AdminDashboard({ loginId }: { loginId: string }) {
  const [users, setUsers] = useState<User[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])

  // 폼 상태
  const [targetUserId, setTargetUserId] = useState('')
  const [exchange, setExchange] = useState<Exchange | null>(null)
  const [exchangeTouched, setExchangeTouched] = useState(false)
  const [accountName, setAccountName] = useState('')
  const [accessKey, setAccessKey] = useState('')
  const [secretKey, setSecretKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const fetchAll = useCallback(async () => {
    const res = await fetch('/api/admin/accounts')
    if (res.ok) {
      const data = await res.json()
      setUsers(data.users)
      setAccounts(data.accounts)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // 사용자 ID → 로그인 ID 매핑
  const userMap = new Map(users.map((u) => [u.id, u.user_id]))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setSuccess('')

    if (!targetUserId) { setError('대상 사용자를 선택해주세요.'); return }
    if (!exchange) { setExchangeTouched(true); setError('거래소를 선택해주세요.'); return }
    if (!accountName.trim() || !accessKey.trim() || !secretKey.trim()) {
      setError('모든 항목을 입력해주세요.'); return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/admin/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId, exchange, accountName, accessKey, secretKey }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || '등록 실패'); return }

      setSuccess(`${userMap.get(targetUserId)} - ${EXCHANGE_LABELS[exchange]} - ${accountName} 등록 완료`)
      setExchange(null); setExchangeTouched(false); setAccountName(''); setAccessKey(''); setSecretKey('')
      fetchAll()
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string, userName: string, accountName: string) {
    if (!confirm(`'${userName} / ${accountName}' 계정을 삭제하시겠습니까?`)) return
    const res = await fetch(`/api/admin/accounts/${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) { alert(data.error || '삭제 실패'); return }
    fetchAll()
  }

  // 사용자별 그룹핑
  const grouped = new Map<string, Account[]>()
  for (const acc of accounts) {
    const list = grouped.get(acc.user_id) ?? []
    list.push(acc)
    grouped.set(acc.user_id, list)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header loginId={loginId} isAdmin showBackToHome />

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-4">
        <div className="rounded-xl border border-purple-200 bg-purple-50 p-3">
          <p className="text-sm text-purple-900">관리자 페이지 · 모든 사용자의 거래소 계정을 관리합니다.</p>
        </div>

        {/* 대리 등록 폼 */}
        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="mb-4 text-base font-semibold text-gray-900">거래소 계정 대리 등록</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 대상 사용자 */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">대상 사용자</label>
              <select
                value={targetUserId}
                onChange={(e) => setTargetUserId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">선택...</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.user_id}</option>
                ))}
              </select>
            </div>

            {/* 거래소 */}
            <div>
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
                    onClick={() => { setExchange(ex); setExchangeTouched(false) }}
                    className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-sm transition ${
                      exchange === ex ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <span>{EXCHANGE_EMOJI[ex]}</span>
                    {EXCHANGE_LABELS[ex]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">계정 이름</label>
              <input type="text" value={accountName} onChange={(e) => setAccountName(e.target.value)}
                placeholder="예: 홍길동"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">API Key</label>
              <input type="password" value={accessKey} onChange={(e) => setAccessKey(e.target.value)}
                autoComplete="off"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Secret Key</label>
              <input type="password" value={secretKey} onChange={(e) => setSecretKey(e.target.value)}
                autoComplete="off"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>

            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
            {success && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{success}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? '검증 중...' : '대리 등록'}
            </button>
          </form>
        </section>

        {/* 전체 계정 목록 */}
        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-base font-semibold text-gray-900">
            전체 거래소 계정 ({accounts.length}건)
          </h2>

          {accounts.length === 0 ? (
            <p className="text-sm text-gray-400">등록된 계정이 없습니다.</p>
          ) : (
            <div className="space-y-4">
              {Array.from(grouped.entries()).map(([uid, list]) => (
                <div key={uid}>
                  <div className="mb-2 border-b border-gray-100 pb-1 text-xs font-semibold text-gray-500">
                    {userMap.get(uid) ?? uid} ({list.length})
                  </div>
                  <ul className="divide-y divide-gray-100">
                    {list.map((acc) => (
                      <li key={acc.id} className="flex items-center justify-between py-2">
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                            {EXCHANGE_LABELS[acc.exchange] ?? acc.exchange}
                          </span>
                          <span className="text-sm font-medium">{acc.account_name}</span>
                        </div>
                        <button
                          onClick={() => handleDelete(acc.id, userMap.get(uid) ?? '', acc.account_name)}
                          className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 size={16} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
