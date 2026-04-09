'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { EXCHANGE_LABELS, EXCHANGE_EMOJI } from '@/types/database'
import type { Exchange } from '@/types/database'

interface User {
  id: string
  user_id: string
  name?: string
  phone?: string
  email?: string
  status?: string
  delegated?: boolean
  created_at: string
  last_login_at: string | null
}
interface Account {
  id: string
  user_id: string
  exchange: Exchange
}
interface LoginLog {
  user_id: string
  login_at: string
  ip_address: string
}

const EXCHANGES = Object.keys(EXCHANGE_LABELS) as Exchange[]

function toKST(utcString: string | null): string {
  if (!utcString) return '-'
  return new Date(utcString).toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

function toDateKST(utcString: string): string {
  return new Date(utcString).toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric', month: '2-digit', day: '2-digit',
  })
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  approved: { label: '정상', cls: 'bg-green-100 text-green-700' },
  pending: { label: '인증대기', cls: 'bg-yellow-100 text-yellow-700' },
  suspended: { label: '정지', cls: 'bg-red-100 text-red-700' },
}

export default function MemberStatus() {
  const [users, setUsers] = useState<User[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loginHistory, setLoginHistory] = useState<LoginLog[]>([])
  const [expandedUser, setExpandedUser] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/admin/accounts')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        setUsers(data.users ?? [])
        setAccounts(data.accounts ?? [])
        setLoginHistory(data.loginHistory ?? [])
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const adminId = process.env.NEXT_PUBLIC_ADMIN_USER_ID
  const approvedCount = users.filter((u) => u.status === 'approved').length
  const delegatedCount = users.filter((u) => u.delegated).length

  function getExchangeGroups(userId: string) {
    const userAccounts = accounts.filter((a) => a.user_id === userId)
    return EXCHANGES
      .map((ex) => ({ ex, count: userAccounts.filter((a) => a.exchange === ex).length }))
      .filter((g) => g.count > 0)
  }

  function getUserAccountCount(userId: string) {
    return accounts.filter((a) => a.user_id === userId).length
  }

  function getUserLoginHistory(userId: string) {
    return loginHistory.filter((l) => l.user_id === userId).slice(0, 5)
  }

  return (
    <div className="space-y-4">
      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{users.length}</p>
          <p className="text-xs text-gray-500">총 회원</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{accounts.length}</p>
          <p className="text-xs text-gray-500">총 계정</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
          <p className="text-2xl font-bold text-purple-600">{delegatedCount}</p>
          <p className="text-xs text-gray-500">위임 회원</p>
        </div>
      </div>

      {/* 상태별 소계 */}
      <div className="flex gap-2 text-xs">
        <span className="rounded-full bg-green-100 px-2.5 py-1 text-green-700">정상 {approvedCount}</span>
        <span className="rounded-full bg-yellow-100 px-2.5 py-1 text-yellow-700">인증대기 {users.filter((u) => u.status === 'pending').length}</span>
      </div>

      {/* 회원 목록 */}
      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-base font-semibold text-gray-900">👥 회원 목록</h2>

        <div className="space-y-3">
          {users.map((user) => {
            const isAdminUser = user.user_id === adminId
            const exchangeGroups = getExchangeGroups(user.id)
            const totalCount = getUserAccountCount(user.id)
            const statusInfo = STATUS_BADGE[user.status ?? 'approved'] ?? STATUS_BADGE.approved
            const isExpanded = expandedUser === user.id
            const logs = getUserLoginHistory(user.id)

            return (
              <div key={user.id} className={`rounded-lg border p-3 ${
                user.delegated ? 'border-purple-200 bg-purple-50/30' : 'border-gray-200'
              }`}>
                {/* 헤더 */}
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-900">{user.user_id}</span>
                    {isAdminUser && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">관리자</span>
                    )}
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusInfo.cls}`}>{statusInfo.label}</span>
                    {user.delegated && (
                      <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">위임</span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">가입 {toDateKST(user.created_at)}</span>
                </div>

                {/* 개인정보 */}
                {user.name && (
                  <p className="text-xs text-gray-500 mb-1.5">
                    {user.name}
                    {user.phone && <span className="ml-2">{user.phone}</span>}
                    {user.email && <span className="ml-2 text-gray-400">{user.email}</span>}
                  </p>
                )}

                {/* 거래소별 뱃지 */}
                <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                  {exchangeGroups.length > 0 ? (
                    exchangeGroups.map(({ ex, count }) => (
                      <span key={ex} className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                        {EXCHANGE_EMOJI[ex]} {EXCHANGE_LABELS[ex]} {count}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-gray-400">(등록된 계정 없음)</span>
                  )}
                  {totalCount > 0 && <span className="text-xs text-gray-400">총 {totalCount}건</span>}
                </div>

                {/* 마지막 로그인 + 이력 토글 */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">
                    마지막 로그인: {toKST(user.last_login_at)}
                  </span>
                  {logs.length > 0 && (
                    <button
                      onClick={() => setExpandedUser(isExpanded ? null : user.id)}
                      className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700"
                    >
                      접속 이력
                      {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                  )}
                </div>

                {/* 접속 이력 (아코디언) */}
                {isExpanded && logs.length > 0 && (
                  <div className="mt-2 rounded-lg bg-gray-50 p-2">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-500">
                          <th className="text-left pb-1 font-medium">시간</th>
                          <th className="text-left pb-1 font-medium">IP</th>
                        </tr>
                      </thead>
                      <tbody className="text-gray-600">
                        {logs.map((log, i) => (
                          <tr key={i}>
                            <td className="py-0.5">{toKST(log.login_at)}</td>
                            <td className="py-0.5">{log.ip_address}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
