'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'

export default function TopBar() {
  const [unread, setUnread] = useState(0)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    let cancelled = false
    function refresh() {
      fetch('/api/app/notifications?limit=1')
        .then((r) => r.json())
        .then((j) => { if (!cancelled && j.ok) setUnread(j.data.unreadCount ?? 0) })
        .catch(() => {})
    }
    refresh()

    // 알림함 페이지에서 읽음 처리/삭제 시 발행
    const onUpdate = () => refresh()
    // 탭 복귀 시 다시 동기화
    const onVisible = () => { if (document.visibilityState === 'visible') refresh() }
    window.addEventListener('notifications-updated', onUpdate)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onUpdate)

    return () => {
      cancelled = true
      window.removeEventListener('notifications-updated', onUpdate)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onUpdate)
    }
  }, [])

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

        {/* 좌측 여백 (대칭 맞춤) */}
        <div className="w-11" />

        {/* 중앙: 타이틀 */}
        <h1
          className="text-[17px] font-semibold select-none tracking-tight"
          style={{ color: '#191F28' }}
        >
          MyCoinBot
        </h1>

        {/* 우측: 알림 벨 */}
        <Link
          href="/app/notifications"
          aria-label="알림"
          className="relative flex items-center justify-center w-11 h-11 -mr-2 rounded-xl active:bg-gray-50 transition-colors"
        >
          <Bell size={24} style={{ color: '#191F28' }} strokeWidth={1.8} />
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
