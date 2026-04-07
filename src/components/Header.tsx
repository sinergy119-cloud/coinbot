'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LogOut, Shield, Settings, KeyRound, X } from 'lucide-react'

interface HeaderProps {
  loginId: string
  isAdmin?: boolean
  showBackToHome?: boolean
}

export default function Header({ loginId, isAdmin = false, showBackToHome = false }: HeaderProps) {
  const router = useRouter()
  const [showPwModal, setShowPwModal] = useState(false)
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwError, setPwError] = useState('')
  const [pwLoading, setPwLoading] = useState(false)

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  function openPwModal() {
    setCurrentPw(''); setNewPw(''); setConfirmPw(''); setPwError('')
    setShowPwModal(true)
  }

  async function handlePwChange(e: React.FormEvent) {
    e.preventDefault()
    setPwError('')
    if (newPw !== confirmPw) { setPwError('새 비밀번호가 일치하지 않습니다.'); return }
    if (newPw.length < 6) { setPwError('새 비밀번호는 6자 이상이어야 합니다.'); return }
    setPwLoading(true)
    try {
      const res = await fetch('/api/auth/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      })
      const data = await res.json()
      if (!res.ok) { setPwError(data.error || '변경 실패'); return }
      setShowPwModal(false)
      alert('비밀번호가 변경되었습니다.')
    } catch {
      setPwError('네트워크 오류가 발생했습니다.')
    } finally {
      setPwLoading(false)
    }
  }

  return (
    <>
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-gray-900">MyCoinBot</h1>
          {showBackToHome && (
            <Link href="/" className="text-sm text-blue-600 hover:underline">
              ← 메인으로
            </Link>
          )}
          {isAdmin && !showBackToHome && (
            <Link
              href="/admin"
              className="flex items-center gap-1 rounded-lg bg-purple-100 px-2 py-1 text-xs font-medium text-purple-700 hover:bg-purple-200"
            >
              <Shield size={12} />
              관리자
            </Link>
          )}
        </div>

        <div className="flex items-center gap-1 sm:gap-3">
          <span className="hidden text-sm text-gray-500 sm:inline">{loginId}</span>

          {/* 비밀번호 변경 */}
          <button
            onClick={openPwModal}
            className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-gray-500 hover:bg-gray-100"
            title="비밀번호 변경"
          >
            <KeyRound size={15} />
          </button>

          {/* 거래소 등록 */}
          {!showBackToHome && (
            <Link
              href="/register"
              className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-gray-500 hover:bg-gray-100"
              title="거래소 등록"
            >
              <Settings size={15} />
              <span className="hidden sm:inline">거래소 등록</span>
            </Link>
          )}

          <button
            onClick={handleLogout}
            className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-gray-500 hover:bg-gray-100"
            title="로그아웃"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">로그아웃</span>
          </button>
        </div>
      </header>

      {/* 비밀번호 변경 모달 */}
      {showPwModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">비밀번호 변경</h2>
              <button onClick={() => setShowPwModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handlePwChange} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">현재 비밀번호</label>
                <input
                  type="password"
                  value={currentPw}
                  onChange={e => setCurrentPw(e.target.value)}
                  required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">새 비밀번호</label>
                <input
                  type="password"
                  value={newPw}
                  onChange={e => setNewPw(e.target.value)}
                  required
                  placeholder="6자 이상"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">새 비밀번호 확인</label>
                <input
                  type="password"
                  value={confirmPw}
                  onChange={e => setConfirmPw(e.target.value)}
                  required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              {pwError && <p className="text-xs text-red-500">{pwError}</p>}
              <button
                type="submit"
                disabled={pwLoading}
                className="w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {pwLoading ? '변경 중...' : '변경하기'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
