'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Home, Megaphone, Calendar, User, type LucideIcon } from 'lucide-react'

interface Tab {
  href: string
  label: string
  Icon: LucideIcon
  badge?: boolean
}

const TABS: Tab[] = [
  { href: '/app',          label: '홈',      Icon: Home },
  { href: '/app/events',   label: '이벤트',  Icon: Megaphone, badge: true },
  { href: '/app/schedule', label: '스케줄',  Icon: Calendar },
  { href: '/app/profile',  label: '내 정보', Icon: User },
]

export default function BottomNav() {
  const pathname = usePathname()
  const [newEventCount, setNewEventCount] = useState(0)

  useEffect(() => {
    fetch('/api/app/events?status=active&limit=50')
      .then((r) => r.json())
      .then((j) => {
        if (j.ok && Array.isArray(j.data.items)) {
          const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000
          const recent = j.data.items.filter((e: { createdAt: string }) =>
            new Date(e.createdAt).getTime() > oneDayAgo,
          )
          setNewEventCount(recent.length)
        }
      })
      .catch(() => {})
  }, [pathname])

  return (
    <nav
      className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-100 z-40 shadow-[0_-1px_8px_rgba(0,0,0,0.06)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="grid grid-cols-4 max-w-lg mx-auto h-[60px]">
        {TABS.map((tab) => {
          const isActive =
            pathname === tab.href ||
            (tab.href !== '/app' && pathname.startsWith(tab.href))
          const badgeCount = tab.href === '/app/events' ? newEventCount : 0
          const Icon = tab.Icon

          return (
            <li key={tab.href} className="relative overflow-visible">
              <Link
                href={tab.href}
                aria-label={tab.label}
                className="flex flex-col items-center justify-center h-full gap-0.5"
              >
                {/* 아이콘 영역 — 활성 탭은 위로 띄워서 강조 */}
                <span
                  className={`relative flex items-center justify-center transition-all duration-200 ${
                    isActive
                      ? '-translate-y-4 w-12 h-12 rounded-full shadow-md text-white'
                      : 'w-8 h-8 text-gray-400'
                  }`}
                  style={
                    isActive
                      ? { background: 'linear-gradient(160deg, #9333ea 0%, #6d28d9 100%)' }
                      : undefined
                  }
                >
                  <Icon size={isActive ? 22 : 20} strokeWidth={isActive ? 2.2 : 1.8} />
                  {tab.badge && badgeCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] leading-none rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center font-bold border-2 border-white">
                      {badgeCount > 99 ? '99+' : badgeCount}
                    </span>
                  )}
                </span>

                {/* 탭 레이블 */}
                <span
                  className={`text-[11px] leading-tight transition-colors duration-200 ${
                    isActive ? 'font-semibold text-purple-700' : 'text-gray-400'
                  }`}
                >
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
