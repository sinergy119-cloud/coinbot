'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { X, KeyRound, Wallet, Shield, LogOut, Send, CheckCircle2, AlertCircle } from 'lucide-react'
import { clearSession } from '@/lib/app/auth-session'

interface DrawerProps {
  open: boolean
  onClose: () => void
}

interface ProfileData {
  user_id: string
  telegramChatId: string
}

function maskId(id: string): string {
  if (!id) return '—'
  if (id.startsWith('kakao_')) return '카카오 로그인'
  if (id.startsWith('naver_')) return '네이버 로그인'
  if (id.startsWith('google_')) return '구글 로그인'
  if (id.includes('@')) {
    const [head, domain] = id.split('@')
    const headMask = head.length <= 2 ? head : `${head.slice(0, 2)}${'*'.repeat(Math.min(head.length - 2, 3))}`
    return `${headMask}@${domain}`
  }
  if (id.length <= 4) return id
  return `${id.slice(0, 2)}${'*'.repeat(3)}${id.slice(-1)}`
}

export default function DrawerMenu({ open, onClose }: DrawerProps) {
  const [profile, setProfile] = useState<ProfileData | null>(null)

  useEffect(() => {
    if (!open) return
    fetch('/api/user/profile')
      .then((r) => r.json())
      .then((j) => setProfile(j))
      .catch(() => {})
  }, [open])

  async function handleLogout() {
    if (!confirm('로그아웃 하시겠습니까?')) return
    await fetch('/api/auth/logout', { method: 'POST' })
    clearSession()  // 인증 세션(in-memory PIN) 폐기
    window.location.href = '/app/login'
  }

  const items: { icon: typeof KeyRound; label: string; href: string }[] = [
    { icon: KeyRound, label: '거래소 API Key', href: '/app/profile/api-keys' },
    { icon: Wallet,   label: '자산 현황',       href: '/app/assets' },
    { icon: Shield,   label: '개인정보처리방침', href: '/privacy' },
  ]

  const telegramConnected = !!profile?.telegramChatId

  return (
    <>
      {/* backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-50 bg-black transition-opacity duration-200 ${
          open ? 'opacity-50 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* drawer panel */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-[82%] max-w-[320px] bg-white shadow-2xl transform transition-transform duration-250 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* close button */}
          <div className="flex justify-end p-3">
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className="p-2 -m-2 active:bg-gray-50 rounded"
            >
              <X size={22} className="text-gray-700" />
            </button>
          </div>

          {/* user card */}
          <div
            className="mx-4 mb-4 rounded-2xl p-4 text-white break-keep"
            style={{ background: 'linear-gradient(135deg, #6B4EFF 0%, #4B2BD1 100%)' }}
          >
            <div className="text-[11px] opacity-80">ID</div>
            <div className="text-sm font-bold mt-0.5 break-all">
              {profile ? maskId(profile.user_id) : '—'}
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-xs">
              <Send size={12} />
              {telegramConnected ? (
                <>
                  <span>텔레그램 연결됨</span>
                  <CheckCircle2 size={12} className="ml-0.5" />
                </>
              ) : (
                <>
                  <span>텔레그램 미연결</span>
                  <AlertCircle size={12} className="ml-0.5 opacity-80" />
                </>
              )}
            </div>
          </div>

          {/* menu list */}
          <nav className="flex-1 overflow-y-auto pb-4">
            {items.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className="flex items-center gap-3 px-5 py-3.5 active:bg-gray-50"
                >
                  <span className="w-9 h-9 rounded-full bg-purple-50 flex items-center justify-center shrink-0">
                    <Icon size={18} className="text-purple-600" />
                  </span>
                  <span className="text-sm font-semibold text-gray-900 break-keep">{item.label}</span>
                  <span className="ml-auto text-gray-400 text-sm">›</span>
                </Link>
              )
            })}

            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-5 py-3.5 active:bg-gray-50 text-left"
            >
              <span className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                <LogOut size={18} className="text-red-500" />
              </span>
              <span className="text-sm font-semibold text-red-500">로그아웃</span>
            </button>
          </nav>

          {/* footer */}
          <div className="border-t border-gray-100 p-4 text-[10px] text-gray-600 leading-relaxed break-keep">
            MyCoinBot — 한국 5개 거래소 이벤트 자동 참여 서비스
            <br />
            © 2026 MyCoinBot. All rights reserved.
          </div>
        </div>
      </aside>
    </>
  )
}
