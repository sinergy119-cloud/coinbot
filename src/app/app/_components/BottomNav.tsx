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
    // 신규 이벤트 (24시간 이내) 뱃지용
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
    <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 safe-area-bottom z-40">
      <ul className="grid grid-cols-4 max-w-lg mx-auto h-16">
        {TABS.map((tab) => {
          const isActive = pathname === tab.href || (tab.href !== '/app' && pathname.startsWith(tab.href))
          const badgeCount = tab.href === '/app/events' ? newEventCount : 0
          const Icon = tab.Icon

          return (
            <li key={tab.href} className="relative">
              <Link
                href={tab.href}
                aria-label={tab.label}
                className="flex flex-col items-center justify-end h-full pb-1.5"
              >
                <span
                  className={`relative flex items-center justify-center transition-all duration-200 ${
                    isActive
                      ? '-translate-y-4 w-12 h-12 rounded-full shadow-lg text-white'
                      : 'w-9 h-9 text-gray-500'
                  }`}
                  style={
                    isActive
                      ? { background: 'linear-gradient(180deg, #8B5CF6 0%, #6D28D9 100%)' }
                      : undefined
                  }
                >
                  <Icon size={isActive ? 22 : 20} strokeWidth={isActive ? 2.25 : 2} />
                  {tab.badge && badgeCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] leading-none rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center font-bold border-2 border-white">
                      {badgeCount > 99 ? '99+' : badgeCount}
                    </span>
                  )}
                </span>
                <span
                  className={`text-[11px] mt-0.5 ${
                    isActive ? 'font-bold text-purple-700' : 'text-gray-600'
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
