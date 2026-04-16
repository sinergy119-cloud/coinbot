'use client'

import { useState, useEffect, useCallback } from 'react'
import { Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { EXCHANGE_LABELS, EXCHANGE_EMOJI } from '@/types/database'
import type { Exchange } from '@/types/database'

interface Account {
  id: string
  exchange: Exchange
  account_name: string
  created_at: string
}

const EXCHANGES = Object.keys(EXCHANGE_LABELS) as Exchange[]

// 거래소별 이모지

// created_at → KST 표시 (YYYY-MM-DD HH:MM)
function toKST(utcString: string): string {
  const date = new Date(utcString)
  return date.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export default function AccountRegister() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [exchange, setExchange] = useState<Exchange | null>(null)
  const [accountName, setAccountName] = useState('')
  const [accessKey, setAccessKey] = useState('')
  const [secretKey, setSecretKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // 위임 상태
  const [delegated, setDelegated] = useState(false)
  const [delegatePending, setDelegatePending] = useState(false)
  const [delegateLoading, setDelegateLoading] = useState(false)
  const [showDelegateModal, setShowDelegateModal] = useState(false)
  const [chatCopied, setChatCopied] = useState(false)

  // 아코디언: 기본 전체 펼침
  const [openGroups, setOpenGroups] = useState<Record<Exchange, boolean>>(
    () => Object.fromEntries(EXCHANGES.map((ex) => [ex, false])) as Record<Exchange, boolean>
  )

  const fetchAccounts = useCallback(async () => {
    const res = await fetch('/api/exchange-accounts')
    if (res.ok) setAccounts(await res.json())
  }, [])

  const fetchProfile = useCallback(async () => {
    const res = await fetch('/api/user/profile')
    if (res.ok) {
      const data = await res.json()
      setDelegated(data.delegated ?? false)
      setDelegatePending(data.delegatePending ?? false)
    }
  }, [])

  useEffect(() => { fetchAccounts(); fetchProfile() }, [fetchAccounts, fetchProfile])

  // 토글 클릭: ON이면 모달, OFF이면 위임 해제 확인
  function handleToggleDelegate() {
    if (delegated) {
      if (!confirm('위임을 해제합니다. 관리자가 더 이상 내 계정으로 거래할 수 없습니다.')) return
      void revokeDelegate()
    } else {
      setShowDelegateModal(true)
    }
  }

  // 위임 해제
  async function revokeDelegate() {
    setDelegateLoading(true)
    try {
      await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delegated: false }),
      })
      setDelegated(false)
    } catch { /* 무시 */ }
    finally { setDelegateLoading(false) }
  }

  // 오픈 채팅방 연결 + 메시지 복사 + 신청 상태 저장
  async function handleOpenChat() {
    const message = '안녕하세요. 관리자 위임 신청에 대해 문의드립니다.'
    // 팝업 차단 방지: window.open은 동기 실행 (사용자 클릭 직후)
    window.open('https://open.kakao.com/o/sUAoiJpi', '_blank', 'noopener,noreferrer')
    // 클립보드 복사
    try { await navigator.clipboard.writeText(message) } catch { /* 무시 */ }
    // 신청 상태 DB 저장
    try {
      await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delegate_pending: true }),
      })
      setDelegatePending(true)
    } catch { /* 무시 */ }
    setChatCopied(true)
    setShowDelegateModal(false)
  }

  // 신청 취소
  async function handleCancelPending() {
    if (!confirm('위임 신청을 취소하시겠습니까?')) return
    try {
      await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delegate_pending: false }),
      })
      setDelegatePending(false)
      setChatCopied(false)
    } catch { /* 무시 */ }
  }

  function toggleGroup(ex: Exchange) {
    setOpenGroups((prev) => ({ ...prev, [ex]: !prev[ex] }))
  }

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
      if (!res.ok) { setError(data.error || '등록 실패'); return }

      setSuccess(`${EXCHANGE_EMOJI[exchange]} ${EXCHANGE_LABELS[exchange]} - ${accountName} 등록 완료`)
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
    if (!res.ok) { alert(data.error || '삭제 실패'); return }
    fetchAccounts()
  }

  // 거래소별 그룹핑 + 이름 오름차순
  const grouped = EXCHANGES.reduce<Record<Exchange, Account[]>>(
    (acc, ex) => {
      acc[ex] = accounts
        .filter((a) => a.exchange === ex)
        .sort((a, b) => a.account_name.localeCompare(b.account_name, 'ko'))
      return acc
    },
    {} as Record<Exchange, Account[]>
  )

  // 계정이 하나라도 있는 거래소만 표시
  const activeExchanges = EXCHANGES.filter((ex) => grouped[ex].length > 0)

  return (
    <div className="space-y-4">

      {/* ── 위임 신청 모달 ── */}
      {showDelegateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5 text-center">
              <div className="mb-2 text-3xl">💬</div>
              <h3 className="text-base font-semibold text-gray-900">관리자 위임 신청</h3>
              <p className="mt-2 text-sm text-gray-600 break-keep leading-relaxed">
                관리자에게 오픈 채팅으로 문의해주세요.<br />
                승인 후 위임이 활성화됩니다.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleOpenChat}
                className="w-full rounded-xl bg-yellow-400 py-3 text-sm font-semibold text-yellow-900 hover:bg-yellow-500 active:bg-yellow-600"
              >
                💬 오픈 채팅방 연결
              </button>
              <p className="text-center text-xs text-gray-500 break-keep">
                채팅방이 열리면 메시지를 붙여넣기 해주세요.
              </p>
              <button
                onClick={() => setShowDelegateModal(false)}
                className="w-full rounded-xl bg-gray-100 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-200"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 관리자 위임 ── */}
      <section className={`rounded-xl border p-4 transition-colors ${
        delegated
          ? 'border-blue-300 bg-blue-50'
          : delegatePending
          ? 'border-amber-300 bg-amber-50/40'
          : 'border-gray-200 bg-white'
      }`}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-gray-900">관리자 위임</h2>
            <p className="mt-0.5 text-xs text-gray-600 break-keep">
              {delegated
                ? '관리자가 내 모든 계정으로 거래 실행 가능'
                : delegatePending
                ? '관리자 승인을 기다리고 있습니다.'
                : 'ON 하면 관리자가 대신 거래를 실행할 수 있습니다.'}
            </p>
          </div>

          {/* 신청 중 상태 */}
          {delegatePending ? (
            <div className="flex shrink-0 items-center gap-2">
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                신청 중
              </span>
              <button
                onClick={handleCancelPending}
                className="text-xs text-gray-600 hover:text-red-500 underline"
              >
                취소
              </button>
            </div>
          ) : (
            /* 토글 버튼 */
            <button
              onClick={handleToggleDelegate}
              disabled={delegateLoading}
              className={`relative h-8 w-14 shrink-0 rounded-full transition-all duration-300 ${
                delegated ? 'bg-blue-600 shadow-lg shadow-blue-200' : 'bg-gray-300'
              } ${delegateLoading ? 'opacity-50' : ''}`}
            >
              <span className={`absolute top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-md transition-all duration-300 ${
                delegated ? 'translate-x-7' : 'translate-x-1'
              }`}>
                {delegated && <span className="text-blue-600 text-xs font-bold">✓</span>}
              </span>
            </button>
          )}
        </div>

        {delegated && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-blue-700">
            <span>📌</span> 위임 상태 — 관리자가 거래 실행/스케줄 등록 가능
          </div>
        )}
        {delegatePending && (
          <div className="mt-2 flex items-center justify-between text-xs text-amber-700">
            <span className="break-keep">
              ⏳ 오픈 채팅방에서 메시지를 붙여넣기 해주세요.
            </span>
            <button
              onClick={handleOpenChat}
              className="ml-2 shrink-0 underline hover:text-amber-900"
            >
              채팅방 열기
            </button>
          </div>
        )}
        {chatCopied && !delegatePending && (
          <p className="mt-1 text-xs text-green-600">✓ 메시지가 클립보드에 복사되었습니다.</p>
        )}
      </section>

      {/* ── 등록 폼 ── */}
      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="mb-4 text-base font-semibold text-gray-900">거래소 계정 등록</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 거래소 선택 */}
          <div>
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
                  onClick={() => setExchange(ex)}
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

          {/* 계정 이름 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">계정 이름</label>
            <input
              type="text"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="예: 홍길동"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-600">
              ※ API는 &apos;입출금 권한 제외&apos; 상태로 발급하세요. 저장 시 AES 암호화됩니다.
            </p>
          </div>

          {error   && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
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

      {/* ── 등록된 계정 — 거래소별 아코디언 ── */}
      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-base font-semibold text-gray-900">
          등록된 계정
          <span className="ml-2 text-sm font-normal text-gray-500">({accounts.length}개)</span>
        </h2>

        {activeExchanges.length === 0 ? (
          <p className="text-sm text-gray-500">등록된 계정이 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {activeExchanges.map((ex) => {
              const group = grouped[ex]
              const isOpen = openGroups[ex]
              return (
                <div key={ex} className="overflow-hidden rounded-lg border border-gray-200">
                  {/* 아코디언 헤더 */}
                  <button
                    type="button"
                    onClick={() => toggleGroup(ex)}
                    className="flex w-full items-center justify-between bg-gray-50 px-4 py-2.5 hover:bg-gray-100"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">{EXCHANGE_EMOJI[ex]}</span>
                      <span className="text-sm font-semibold text-gray-800">
                        {EXCHANGE_LABELS[ex]}
                      </span>
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                        {group.length}명
                      </span>
                    </div>
                    {isOpen
                      ? <ChevronUp size={16} className="text-gray-400" />
                      : <ChevronDown size={16} className="text-gray-400" />
                    }
                  </button>

                  {/* 아코디언 바디 */}
                  {isOpen && (
                    <ul className="divide-y divide-gray-100">
                      {group.map((acc) => (
                        <li key={acc.id} className="flex items-center justify-between px-4 py-2.5">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm font-medium text-gray-900">
                              {acc.account_name}
                            </span>
                            <span className="text-xs text-gray-600">
                              등록: {toKST(acc.created_at)}
                            </span>
                          </div>
                          <button
                            onClick={() => handleDelete(acc.id, acc.account_name)}
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
            })}
          </div>
        )}
      </section>
    </div>
  )
}
