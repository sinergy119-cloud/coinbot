'use client'

import { useEffect } from 'react'
import TopBar from './TopBar'
import BottomNav from './BottomNav'
import { installVisibilityListener } from '@/lib/app/auth-session'

export default function AppShell({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // 인증 세션 — 백그라운드 15분/24시간 만료 추적
    installVisibilityListener()
  }, [])

  return (
    <>
      <TopBar />
      <main
        className="flex-1 max-w-lg mx-auto w-full"
        style={{ paddingBottom: 'calc(60px + env(safe-area-inset-bottom) + 8px)' }}
      >{children}</main>
      <BottomNav />
    </>
  )
}
