'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Menu, Bell } from 'lucide-react'

interface TopBarProps {
  onMenuClick: () => void
}

export default function TopBar({ onMenuClick }: TopBarProps) {
  const [unread, setUnread] = useState(0)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    fetch('/api/app/notifications?limit=1')
      .then((r) => r.json())
      .then((j) => { if (j.ok) setUnread(j.data.unreadCount ?? 0) })
      .catch(() => {})
  }, [])

  // 스크롤 시 하단 shadow 등장 (토스 스타일)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 0)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className="sticky top-0 z-40 bg-white transition-shadow duration-200"
      style={scrolled ? { boxShadow: '0 1px 8px rgba(0,0,0,0.06)' } : undefined}
    >
      <div className="max-w-lg mx-auto flex items-center justify-between px-4 h-14">

        {/* 좌측: 메뉴 버튼 */}
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="메뉴 열기"
          className="flex items-center justify-center w-11 h-11 -ml-2 rounded-xl active:bg-gray-50 transition-colors"
        >
          <Menu size={24} style={{ color: '#191F28' }} strokeWidth={1.8} />
        </button>

        {/* 중앙: 타이틀 */}
        <h1
          className="text-[17px] font-semibold select-none tracking-tight"
          style={{ color: '#191F28' }}
        >
          MyCoinBot
        </h1>

        {/* 우측: 알림 벨 — 토스 스타일 dot 뱃지 */}
        <Link
          href="/app/notifications"
          aria-label="알림"
          className="relative flex items-center justify-center w-11 h-11 -mr-2 rounded-xl active:bg-gray-50 transition-colors"
        >
          <Bell size={24} style={{ color: '#191F28' }} strokeWidth={1.8} />
          {/* 읽지 않은 알림 → 숫자 없이 dot만 표시 (토스 스타일) */}
          {unread > 0 && (
            <span
              className="absolute top-2 right-2 w-2 h-2 rounded-full"
              style={{ background: '#FF4D4F' }}
            />
          )}
        </Link>

      </div>
    </header>
  )
}
