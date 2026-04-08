'use client'

import { useState, useEffect } from 'react'
import { EXCHANGE_LABELS, EXCHANGE_EMOJI } from '@/types/database'
import type { Exchange } from '@/types/database'

interface User {
  id: string
  user_id: string
  delegated?: boolean
  created_at: string
  last_login_at: string | null
}
interface Account {
  id: string
  user_id: string
  exchange: Exchange
}

const EXCHANGES = Object.keys(EXCHANGE_LABELS) as Exchange[]

function toKST(utcString: string | null): string {
  if (!utcString) return '-'
  const date = new Date(utcString)
  return date.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

function toDateKST(utcString: string): string {
  const date = new Date(utcString)
  return date.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric', month: '2-digit', day: '2-digit',
  })
}

export default function MemberStatus() {
  const [users, setUsers] = useState<User[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])

  useEffect(() => {
    let cancelled = false
    fetch('/api/admin/accounts')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        setUsers(data.users ?? [])
        setAccounts(data.accounts ?? [])
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const adminId = process.env.NEXT_PUBLIC_ADMIN_USER_ID
  const totalAccounts = accounts.length
  const delegatedCount = users.filter((u) => u.delegated).length

  // 사용자별 계정 수 계산
  function getAccountsByExchange(userId: string) {
    const userAccounts = accounts.filter((a) => a.user_id === userId)
    return EXCHANGES
      .map((ex) => ({ ex, count: userAccounts.filter((a) => a.exchange === ex).length }))
      .filter((g) => g.count > 0)
  }

  function getUserAccountCount(userId: string) {
    return accounts.filter((a) => a.user_id === userId).length
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
          <p className="text-2xl font-bold text-blue-600">{totalAccounts}</p>
          <p className="text-xs text-gray-500">총 계정</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
          <p className="text-2xl font-bold text-purple-600">{delegatedCount}</p>
          <p className="text-xs text-gray-500">위임 회원</p>
        </div>
      </div>

      {/* 회원 목록 */}
      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-base font-semibold text-gray-900">👥 회원 목록</h2>

        <div className="space-y-3">
          {users.map((user) => {
            const isAdminUser = user.user_id === adminId
            const exchangeGroups = getAccountsByExchange(user.id)
            const totalCount = getUserAccountCount(user.id)

            return (
              <div key={user.id} className={`rounded-lg border p-3 ${
                user.delegated ? 'border-purple-200 bg-purple-50/30' : 'border-gray-200'
              }`}>
                {/* 헤더: ID + 배지 + 날짜 */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">{user.user_id}</span>
                    {isAdminUser && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">관리자</span>
                    )}
                    {user.delegated && (
                      <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">위임 ✅</span>
                    )}
                    {!user.delegated && !isAdminUser && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-400">위임 ❌</span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400">가입 {toDateKST(user.created_at)}</span>
                </div>

                {/* 거래소별 뱃지 */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {exchangeGroups.length > 0 ? (
                    exchangeGroups.map(({ ex, count }) => (
                      <span key={ex} className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                        {EXCHANGE_EMOJI[ex]} {EXCHANGE_LABELS[ex]} {count}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-gray-400">(등록된 계정 없음)</span>
                  )}
                  <span className="text-xs text-gray-400 ml-1">총 {totalCount}건</span>
                </div>

                {/* 마지막 로그인 */}
                <div className="mt-1.5 text-xs text-gray-400">
                  마지막 로그인: {toKST(user.last_login_at)}
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
