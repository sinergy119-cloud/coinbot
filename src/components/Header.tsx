'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LogOut, Shield, Building2, X, User, MessageCircle, HelpCircle } from 'lucide-react'
import InquiryModal from '@/components/InquiryModal'
import UserGuideModal from '@/components/UserGuideModal'


interface HeaderProps {
  loginId: string
  isAdmin?: boolean
  showBackToHome?: boolean
}

export default function Header({ loginId, isAdmin = false, showBackToHome = false }: HeaderProps) {
  const router = useRouter()
  const [showAccountModal, setShowAccountModal] = useState(false)
  const [showInquiryModal, setShowInquiryModal] = useState(false)
  const [showGuideModal, setShowGuideModal] = useState(false)
  const [profileName, setProfileName] = useState('')
  const [profileEmail, setProfileEmail] = useState('')
  const [originalEmail, setOriginalEmail] = useState('')
  const [pendingEmail, setPendingEmail] = useState('')
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [profileSuccess, setProfileSuccess] = useState('')

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  async function openAccountModal() {
    setProfileError(''); setProfileSuccess('')
    setShowAccountModal(true)
    try {
      const res = await fetch('/api/user/profile')
      if (res.ok) {
        const d = await res.json()
        setProfileName(d.name ?? '')
        setProfileEmail(d.email ?? '')
        setOriginalEmail(d.email ?? '')
        setPendingEmail(d.pendingEmail ?? '')
      }
    } catch { /* 무시 */ }
  }

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault()
    setProfileError(''); setProfileSuccess('')
    setProfileLoading(true)
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: profileName, email: profileEmail }),
      })
      const data = await res.json()
      if (!res.ok) { setProfileError(data.error || '저장 실패'); return }
      if (data.emailVerification) {
        setProfileSuccess(data.message)
        setPendingEmail(profileEmail)
        setProfileEmail(originalEmail) // 원래 이메일로 복원 (인증 전까지)
      } else {
        setProfileSuccess('저장되었습니다.')
        setTimeout(() => setProfileSuccess(''), 2000)
      }
    } catch { setProfileError('네트워크 오류') }
    finally { setProfileLoading(false) }
  }

  return (
    <>
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-lg font-bold text-gray-900 hover:text-blue-600 transition">
            MyCoinBot
          </Link>
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

          {/* 계정 설정 (내 정보 + 비밀번호) */}
          <button
            onClick={openAccountModal}
            className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-gray-500 hover:bg-gray-100"
            title="계정 설정"
          >
            <User size={15} />
          </button>

          {/* 사용 가이드 */}
          <button
            onClick={() => setShowGuideModal(true)}
            className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-gray-500 hover:bg-gray-100"
            title="사용 가이드"
          >
            <HelpCircle size={15} />
          </button>

          {/* 문의하기 */}
          <button
            onClick={() => setShowInquiryModal(true)}
            className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-bold text-gray-700 hover:bg-gray-100"
            title="문의하기"
          >
            <MessageCircle size={15} />
            <span className="hidden sm:inline">문의</span>
          </button>

          {/* 거래소 등록 */}
          {!showBackToHome && (
            <Link
              href="/register"
              className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-bold text-gray-700 hover:bg-gray-100"
              title="거래소 등록"
            >
              <Building2 size={15} />
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

      {/* 계정 설정 모달 */}
      {showAccountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">⚙ 계정 설정</h2>
              <button onClick={() => setShowAccountModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleProfileSave} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">이름</label>
                <input type="text" value={profileName} onChange={e => setProfileName(e.target.value)}
                  placeholder="실명을 입력하세요"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">이메일</label>
                <input type="email" value={profileEmail} onChange={e => setProfileEmail(e.target.value)}
                  placeholder="example@gmail.com"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none" />
                {profileEmail !== originalEmail && originalEmail && (
                  <p className="mt-1 text-[10px] text-amber-600">📩 이메일 변경 시 인증 메일이 발송됩니다.</p>
                )}
                {pendingEmail && (
                  <p className="mt-1 text-[10px] text-blue-600">⏳ {pendingEmail} 인증 대기 중</p>
                )}
              </div>
              {profileError && <p className="text-xs text-red-500">{profileError}</p>}
              {profileSuccess && <p className="text-xs text-green-600">{profileSuccess}</p>}
              <button type="submit" disabled={profileLoading}
                className="w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                {profileLoading ? '저장 중...' : '저장'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 문의하기 모달 */}
      {showInquiryModal && <InquiryModal onClose={() => setShowInquiryModal(false)} />}

      {/* 사용 가이드 모달 */}
      {showGuideModal && <UserGuideModal onClose={() => setShowGuideModal(false)} />}
    </>
  )
}
