'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

interface Tab {
  href: string
  label: string
  icon: string
  badge?: boolean
}

const TABS: Tab[] = [
  { href: '/app', label: '홈', icon: '🏠' },
  { href: '/app/events', label: '이벤트', icon: '📢', badge: true },
  { href: '/app/schedule', label: '스케줄', icon: '📅' },
  { href: '/app/notifications', label: '알림', icon: '🔔', badge: true },
  { href: '/app/profile', label: '내 정보', icon: '👤' },
]

export default function BottomNav() {
  const pathname = usePathname()
  const [unreadCount, setUnreadCount] = useState(0)
  const [newEventCount, setNewEventCount] = useState(0)

  useEffect(() => {
    // 미읽음 알림 개수
    fetch('/api/app/notifications?limit=1')
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setUnreadCount(j.data.unreadCount ?? 0)
      })
      .catch(() => {})

    // 신규 이벤트 (24시간 이내)
    fetch('/api/app/events?status=active&limit=50')
      .then((r) => r.json())
      .then((j) => {
        if (j.ok && Array.isArray(j.data.items)) {
          const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000
          const recent = j.data.items.filter((e: { createdAt: string }) => new Date(e.createdAt).getTime() > oneDayAgo)
          setNewEventCount(recent.length)
        }
      })
      .catch(() => {})
  }, [pathname])

  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 safe-area-bottom z-50">
      <ul className="grid grid-cols-5 max-w-lg mx-auto">
        {TABS.map((tab) => {
          const isActive = pathname === tab.href || (tab.href !== '/app' && pathname.startsWith(tab.href))
          const badgeCount = tab.href === '/app/notifications' ? unreadCount : tab.href === '/app/events' ? newEventCount : 0
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                className={`flex flex-col items-center justify-center py-2 transition-colors ${
                  isActive ? 'text-gray-900' : 'text-gray-500'
                }`}
              >
                <span className="relative text-2xl leading-none">
                  {tab.icon}
                  {tab.badge && badgeCount > 0 && (
                    <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[10px] leading-none rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center font-bold">
                      {badgeCount > 99 ? '99+' : badgeCount}
                    </span>
                  )}
                </span>
                <span className={`text-[11px] mt-1 ${isActive ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
                  {tab.label}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
