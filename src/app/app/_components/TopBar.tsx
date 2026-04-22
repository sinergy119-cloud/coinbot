'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Menu, Bell } from 'lucide-react'

interface TopBarProps {
  onMenuClick: () => void
}

export default function TopBar({ onMenuClick }: TopBarProps) {
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    fetch('/api/app/notifications?limit=1')
      .then((r) => r.json())
      .then((j) => { if (j.ok) setUnread(j.data.unreadCount ?? 0) })
      .catch(() => {})
  }, [])

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-100">
      <div className="max-w-lg mx-auto flex items-center justify-between px-4 h-14">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="메뉴 열기"
          className="p-2 -ml-2 active:bg-gray-50 rounded"
        >
          <Menu size={24} className="text-gray-900" />
        </button>

        <h1 className="text-base font-bold text-gray-900 tracking-tight select-none">
          MyCoinBot
        </h1>

        <Link
          href="/app/notifications"
          aria-label="알림"
          className="relative p-2 -mr-2 active:bg-gray-50 rounded"
        >
          <Bell size={22} className="text-gray-900" />
          {unread > 0 && (
            <span className="absolute top-1 right-1 bg-red-500 text-white text-[10px] leading-none rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center font-bold">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </Link>
      </div>
    </header>
  )
}
