'use client'

import { useState, useEffect, useCallback } from 'react'
import { Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import Header from '@/components/Header'
import { EXCHANGE_LABELS, EXCHANGE_EMOJI } from '@/types/database'
import type { Exchange } from '@/types/database'

interface User {
  id: string
  user_id: string
  delegated?: boolean
}
interface Account {
  id: string
  user_id: string
  exchange: Exchange
  account_name: string
  created_at: string
}

const EXCHANGES = Object.keys(EXCHANGE_LABELS) as Exchange[]

function toKST(utcString: string): string {
  const date = new Date(utcString)
  return date.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

// ─── 거래소별 아코디언 ──────────────────────────────
function ExchangeAccordion({
  ex, accounts, onDelete, getUserName,
}: {
  ex: Exchange
  accounts: Account[]
  onDelete: (id: string, userName: string, accountName: string) => void
  getUserName: (uid: string) => string
}) {
  const [open, setOpen] = useState(false)
  if (accounts.length === 0) return null

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between bg-gray-50 px-4 py-2.5 hover:bg-gray-100"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">{EXCHANGE_EMOJI[ex]}</span>
          <span className="text-sm font-semibold text-gray-800">{EXCHANGE_LABELS[ex]}</span>
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
            {accounts.length}명
          </span>
        </div>
        {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>
      {open && (
        <ul className="divide-y divide-gray-100">
          {accounts
            .sort((a, b) => a.account_name.localeCompare(b.account_name, 'ko'))
            .map((acc) => (
            <li key={acc.id} className="flex items-center justify-between px-4 py-2.5">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-gray-900">{acc.account_name}</span>
                <span className="text-xs text-gray-400">등록: {toKST(acc.created_at)}</span>
              </div>
              <button
                onClick={() => onDelete(acc.id, getUserName(acc.user_id), acc.account_name)}
                className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
              >
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── 메인 AdminDashboard ────────────────────────────
export default function AdminDashboard({ loginId, embedded }: { loginId: string; embedded?: boolean }) {
  const [users, setUsers] = useState<User[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])

  // 폼 상태
  const [targetUserId, setTargetUserId] = useState('')
  const [exchange, setExchange] = useState<Exchange | null>(null)
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

  const userMap = new Map(users.map((u) => [u.id, u.user_id]))
  const getUserName = (uid: string) => userMap.get(uid) ?? uid

  // 현재 관리자의 user UUID 찾기
  const adminUser = users.find((u) => u.user_id === loginId)
  const adminUid = adminUser?.id ?? ''

  // 내 계정 / 위임받은 계정 분리
  const myAccounts = accounts.filter((a) => a.user_id === adminUid)
  const delegatedUsers = users.filter((u) => u.delegated && u.id !== adminUid)
  const delegatedUids = new Set(delegatedUsers.map((u) => u.id))
  const delegatedAccounts = accounts.filter((a) => delegatedUids.has(a.user_id))
  const otherAccounts = accounts.filter((a) => a.user_id !== adminUid && !delegatedUids.has(a.user_id))

  // 거래소별 그룹핑 헬퍼
  function groupByExchange(accs: Account[]) {
    return EXCHANGES.map((ex) => ({
      ex,
      accounts: accs.filter((a) => a.exchange === ex),
    })).filter((g) => g.accounts.length > 0)
  }

  // 위임 계정 → 사용자별 → 거래소별
  function groupByUserThenExchange(accs: Account[]) {
    const byUser = new Map<string, Account[]>()
    for (const acc of accs) {
      const list = byUser.get(acc.user_id) ?? []
      list.push(acc)
      byUser.set(acc.user_id, list)
    }
    return Array.from(byUser.entries()).map(([uid, userAccs]) => ({
      uid,
      loginId: getUserName(uid),
      exchanges: groupByExchange(userAccs),
      total: userAccs.length,
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setSuccess('')
    if (!targetUserId) { setError('대상 사용자를 선택해주세요.'); return }
    if (!exchange) { setError('거래소를 선택해주세요.'); return }
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
      setSuccess(`${getUserName(targetUserId)} - ${EXCHANGE_LABELS[exchange]} - ${accountName} 등록 완료`)
      setExchange(null); setAccountName(''); setAccessKey(''); setSecretKey('')
      fetchAll()
    } catch { setError('네트워크 오류가 발생했습니다.') }
    finally { setLoading(false) }
  }

  async function handleDelete(id: string, userName: string, accName: string) {
    if (!confirm(`'${userName} / ${accName}' 계정을 삭제하시겠습니까?`)) return
    const res = await fetch(`/api/admin/accounts/${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) { alert(data.error || '삭제 실패'); return }
    fetchAll()
  }

  const content = (
    <div className="space-y-4">

        {/* ── 대리 등록 폼 ── */}
        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="mb-4 text-base font-semibold text-gray-900">거래소 계정 대리 등록</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">대상 사용자</label>
              <select value={targetUserId} onChange={(e) => setTargetUserId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
                <option value="">선택...</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.user_id}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={`mb-2 block text-sm font-medium ${!exchange ? 'text-red-600' : 'text-gray-700'}`}>
                거래소 {!exchange && <span className="animate-bounce inline-block text-blue-600">👇 먼저 선택해 주세요</span>}
              </label>
              <div className={`flex flex-wrap gap-2 rounded-lg p-1 transition-all ${!exchange ? 'animate-pulse bg-red-50 ring-2 ring-red-300' : ''}`}>
                {EXCHANGES.map((ex) => (
                  <button key={ex} type="button" onClick={() => setExchange(ex)}
                    className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-sm transition ${
                      exchange === ex ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}>
                    <span>{EXCHANGE_EMOJI[ex]}</span>{EXCHANGE_LABELS[ex]}
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
              <input type="password" value={accessKey} onChange={(e) => setAccessKey(e.target.value)} autoComplete="off"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Secret Key</label>
              <input type="password" value={secretKey} onChange={(e) => setSecretKey(e.target.value)} autoComplete="off"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
            {success && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{success}</p>}
            <button type="submit" disabled={loading}
              className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {loading ? '검증 중...' : '대리 등록'}
            </button>
          </form>
        </section>

        {/* ── 내 계정 ── */}
        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-base font-semibold text-gray-900">
            📁 내 계정 ({loginId})
            <span className="ml-2 text-sm font-normal text-gray-400">{myAccounts.length}건</span>
          </h2>
          {myAccounts.length === 0 ? (
            <p className="text-sm text-gray-400">등록된 계정이 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {groupByExchange(myAccounts).map(({ ex, accounts: exAccs }) => (
                <ExchangeAccordion key={ex} ex={ex} accounts={exAccs} onDelete={handleDelete} getUserName={getUserName} />
              ))}
            </div>
          )}
        </section>

        {/* ── 위임받은 계정 ── */}
        {delegatedAccounts.length > 0 && (
          <section className="rounded-xl border border-purple-200 bg-purple-50/30 p-4">
            <h2 className="mb-3 text-base font-semibold text-purple-900">
              📁 위임받은 계정
              <span className="ml-2 text-sm font-normal text-purple-400">{delegatedAccounts.length}건</span>
            </h2>
            <div className="space-y-4">
              {groupByUserThenExchange(delegatedAccounts).map(({ uid, loginId: uLoginId, exchanges, total }) => (
                <div key={uid}>
                  <div className="mb-2 flex items-center gap-2 border-b border-purple-100 pb-1">
                    <span className="text-xs font-semibold text-purple-700">👤 {uLoginId}</span>
                    <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-600">{total}건</span>
                  </div>
                  <div className="space-y-2">
                    {exchanges.map(({ ex, accounts: exAccs }) => (
                      <ExchangeAccordion key={ex} ex={ex} accounts={exAccs} onDelete={handleDelete} getUserName={getUserName} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── 기타 사용자 계정 ── */}
        {otherAccounts.length > 0 && (
          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="mb-3 text-base font-semibold text-gray-900">
              📁 기타 사용자 계정
              <span className="ml-2 text-sm font-normal text-gray-400">{otherAccounts.length}건</span>
            </h2>
            <div className="space-y-4">
              {groupByUserThenExchange(otherAccounts).map(({ uid, loginId: uLoginId, exchanges, total }) => (
                <div key={uid}>
                  <div className="mb-2 flex items-center gap-2 border-b border-gray-100 pb-1">
                    <span className="text-xs font-semibold text-gray-500">👤 {uLoginId}</span>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">{total}건</span>
                  </div>
                  <div className="space-y-2">
                    {exchanges.map(({ ex, accounts: exAccs }) => (
                      <ExchangeAccordion key={ex} ex={ex} accounts={exAccs} onDelete={handleDelete} getUserName={getUserName} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
    </div>
  )

  if (embedded) return content

  return (
    <div className="min-h-screen bg-gray-50">
      <Header loginId={loginId} isAdmin showBackToHome />
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-4">
        {content}
      </main>
    </div>
  )
}
