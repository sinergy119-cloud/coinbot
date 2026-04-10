'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronDown, ChevronUp, Eye } from 'lucide-react'
import { EXCHANGE_LABELS, EXCHANGE_EMOJI, TRADE_TYPE_LABELS } from '@/types/database'
import type { Exchange, TradeType, TradeJobRow } from '@/types/database'

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

  const [viewUserId, setViewUserId] = useState<string | null>(null)
  const [viewData, setViewData] = useState<{
    user: User | null
    accounts: { id: string; exchange: Exchange; account_name: string }[]
    accountMap: Record<string, string>
    tradeJobs: TradeJobRow[]
    tradeLogs: { id: string; exchange: string; coin: string; trade_type: string; amount_krw: number; account_name: string; success: boolean; reason?: string; source: string; executed_at: string }[]
  } | null>(null)
  const [viewLoading, setViewLoading] = useState(false)
  const [viewTab, setViewTab] = useState<'schedule' | 'assets' | 'logs'>('schedule')
  const [assetExchange, setAssetExchange] = useState<Exchange | null>(null)
  const [assetData, setAssetData] = useState<{ accountName: string; krw: number; coins: { coin: string; qty: number; value: number }[] }[]>([])
  const [assetLoading, setAssetLoading] = useState(false)

  const fetchUserDashboard = useCallback(async (uid: string) => {
    setViewLoading(true)
    try {
      const res = await fetch(`/api/admin/user-dashboard?userId=${uid}`)
      if (res.ok) setViewData(await res.json())
    } catch { /* 무시 */ }
    finally { setViewLoading(false) }
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

                {/* 마지막 로그인 + 이력/대시보드 토글 */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">
                    마지막 로그인: {toKST(user.last_login_at)}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        if (viewUserId === user.id) { setViewUserId(null); setViewData(null) }
                        else { setViewUserId(user.id); fetchUserDashboard(user.id) }
                      }}
                      className={`flex items-center gap-1 text-xs ${viewUserId === user.id ? 'text-purple-600 font-semibold' : 'text-purple-500 hover:text-purple-700'}`}
                    >
                      <Eye size={12} />
                      대시보드
                    </button>
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

                {/* 대시보드 미리보기 */}
                {viewUserId === user.id && (
                  <div className="mt-3 rounded-lg border border-purple-200 bg-purple-50/30 p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="text-xs font-semibold text-purple-700">👁️ {user.name ?? user.user_id} 대시보드</span>
                      <span className="text-[10px] text-purple-400">읽기 전용</span>
                    </div>
                    {viewLoading ? (
                      <p className="text-xs text-gray-400 animate-pulse">로딩 중...</p>
                    ) : viewData ? (
                      <>
                        {/* 탭 */}
                        <div className="flex gap-0 mb-3 border-b border-purple-200">
                          {([['schedule', '스케줄'], ['assets', '나의 자산'], ['logs', '거래 내역']] as const).map(([id, label]) => (
                            <button key={id} onClick={() => { setViewTab(id); if (id === 'assets') { setAssetExchange(null); setAssetData([]) } }}
                              className={`px-3 py-1.5 text-xs border-b-2 -mb-px ${viewTab === id ? 'border-purple-600 text-purple-600 font-semibold' : 'border-transparent text-gray-400'}`}>
                              {label}
                            </button>
                          ))}
                        </div>

                        {/* 거래소 계정 뱃지 */}
                        <div className="flex flex-wrap gap-1 mb-3">
                          {viewData.accounts.map((acc) => (
                            <span key={acc.id} className="rounded-full bg-white border border-gray-200 px-2 py-0.5 text-[10px] text-gray-600">
                              {EXCHANGE_EMOJI[acc.exchange]} {acc.account_name}
                            </span>
                          ))}
                          {viewData.accounts.length === 0 && <span className="text-[10px] text-gray-400">등록된 계정 없음</span>}
                        </div>

                        {/* 스케줄 탭 */}
                        {viewTab === 'schedule' && (
                          <div className="space-y-2">
                            {viewData.tradeJobs.length === 0 && <p className="text-xs text-gray-400">등록된 스케줄 없음</p>}
                            {viewData.tradeJobs.map((job) => {
                              const isCompleted = job.status === 'completed'
                              const isOwner = job.user_id === user.id
                              return (
                                <div key={job.id} className={`rounded-lg border border-gray-200 bg-white p-2.5 ${isCompleted ? 'opacity-50' : ''}`}>
                                  <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-1.5">
                                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${isCompleted ? 'bg-gray-200 text-gray-500' : 'bg-green-100 text-green-700'}`}>
                                        {isCompleted ? '완료' : '진행'}
                                      </span>
                                      <span className="text-xs">{EXCHANGE_EMOJI[job.exchange as Exchange]} {EXCHANGE_LABELS[job.exchange as Exchange]}</span>
                                    </div>
                                    {!isOwner && <span className="text-[10px] text-gray-400">위임</span>}
                                  </div>
                                  <div className="text-xs text-gray-600">
                                    <b>{job.coin}</b> · {TRADE_TYPE_LABELS[job.trade_type as TradeType] ?? job.trade_type} · {job.trade_type === 'SELL' ? '전량' : `${Number(job.amount_krw).toLocaleString()}원`}
                                  </div>
                                  <div className="text-[10px] text-gray-400 mt-1">
                                    {job.schedule_from} ~ {job.schedule_to} · {(job.schedule_time as string).slice(0, 5)}
                                  </div>
                                  <div className="text-[10px] text-gray-400 mt-0.5">
                                    계정: {(job.account_ids as string[]).map((id) => viewData.accountMap[id] ?? id).join(', ')}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {/* 나의 자산 탭 */}
                        {viewTab === 'assets' && (
                          <div>
                            <div className="flex flex-wrap gap-1.5 mb-3">
                              {(Object.keys(EXCHANGE_LABELS) as Exchange[]).map((ex) => {
                                const hasAccount = viewData.accounts.some((a) => a.exchange === ex)
                                if (!hasAccount) return null
                                return (
                                  <button key={ex} onClick={async () => {
                                    setAssetExchange(ex); setAssetLoading(true); setAssetData([])
                                    try {
                                      const res = await fetch(`/api/admin/user-assets?userId=${user.id}&exchange=${ex}`)
                                      if (res.ok) setAssetData(await res.json())
                                    } catch { /* 무시 */ }
                                    finally { setAssetLoading(false) }
                                  }}
                                    className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs transition ${assetExchange === ex ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                                    {EXCHANGE_EMOJI[ex]} {EXCHANGE_LABELS[ex]}
                                  </button>
                                )
                              })}
                            </div>
                            {!assetExchange && <p className="text-xs text-gray-400">거래소를 선택해주세요.</p>}
                            {assetLoading && <p className="text-xs text-gray-400 animate-pulse">자산 조회 중...</p>}
                            {assetExchange && !assetLoading && assetData.length === 0 && <p className="text-xs text-gray-400">자산 정보 없음</p>}
                            {assetData.map((acc) => (
                              <div key={acc.accountName} className="mb-2 rounded-lg border border-gray-200 bg-white p-2.5">
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className="text-xs font-semibold text-gray-900">{EXCHANGE_EMOJI[assetExchange!]} {acc.accountName}</span>
                                  <span className="text-xs text-gray-500">KRW {Math.floor(acc.krw).toLocaleString()}원</span>
                                </div>
                                {acc.coins.length === 0 ? (
                                  <p className="text-[10px] text-gray-400">보유 코인 없음</p>
                                ) : (
                                  <div className="space-y-1">
                                    {acc.coins.map((c) => (
                                      <div key={c.coin} className="flex items-center justify-between text-xs">
                                        <span className="font-medium text-gray-700">{c.coin}</span>
                                        <span className="text-gray-500">{c.qty.toFixed(4)} · <b>{Math.floor(c.value).toLocaleString()}원</b></span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* 거래 내역 탭 */}
                        {viewTab === 'logs' && (
                          <div className="space-y-1.5">
                            {viewData.tradeLogs.length === 0 && <p className="text-xs text-gray-400">거래 내역 없음</p>}
                            {viewData.tradeLogs.slice(0, 20).map((log) => (
                              <div key={log.id} className="flex items-center gap-2 rounded border border-gray-100 bg-white px-2.5 py-1.5 text-xs">
                                <span>{log.success ? '✅' : '❌'}</span>
                                <span className="font-medium">{EXCHANGE_EMOJI[log.exchange as Exchange]} {log.coin}</span>
                                <span className="text-gray-500">{TRADE_TYPE_LABELS[log.trade_type as TradeType] ?? log.trade_type}</span>
                                <span className="text-gray-400">{log.account_name}</span>
                                <span className="ml-auto text-[10px] text-gray-400">{toKST(log.executed_at)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    ) : null}
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
