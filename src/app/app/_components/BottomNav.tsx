'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Home, Megaphone, Zap, BarChart2, User, type LucideIcon } from 'lucide-react'

interface Tab {
  href: string
  label: string
  Icon: LucideIcon
  badge?: boolean
  matchPrefixes?: string[]
}

const TABS: Tab[] = [
  { href: '/app',         label: '홈',    Icon: Home },
  { href: '/app/events',  label: '이벤트', Icon: Megaphone, badge: true },
  { href: '/app/trade',   label: '거래',   Icon: Zap,        matchPrefixes: ['/app/trade', '/app/schedule'] },
  { href: '/app/browse',  label: '조회',   Icon: BarChart2,  matchPrefixes: ['/app/browse', '/app/assets'] },
  { href: '/app/profile', label: '내정보', Icon: User },
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
      className="fixed bottom-0 inset-x-0 bg-white z-40"
      style={{
        borderTop: '1px solid #E5E8EB',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <ul className="grid grid-cols-5 max-w-lg mx-auto h-[60px]">
        {TABS.map((tab) => {
          const prefixes = tab.matchPrefixes ?? [tab.href]
          const isActive =
            pathname === tab.href ||
            (tab.href !== '/app' && prefixes.some((p) => pathname.startsWith(p)))
          const badgeCount = tab.badge && tab.href === '/app/events' ? newEventCount : 0
          const Icon = tab.Icon

          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-label={tab.label}
                className="flex flex-col items-center justify-center h-full gap-[3px]"
              >
                <span className="relative flex items-center justify-center w-7 h-7">
                  <Icon
                    size={22}
                    strokeWidth={isActive ? 2.2 : 1.6}
                    style={{ color: isActive ? '#0064FF' : '#B0B8C1' }}
                  />
                  {badgeCount > 0 && (
                    <span
                      className="absolute -top-1 -right-1.5 text-white text-[9px] leading-none rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center font-bold"
                      style={{ background: '#FF4D4F' }}
                    >
                      {badgeCount > 99 ? '99+' : badgeCount}
                    </span>
                  )}
                </span>
                <span
                  className="text-[10px] leading-none font-medium"
                  style={{ color: isActive ? '#0064FF' : '#B0B8C1' }}
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
