'use client'

import TopBar from './TopBar'
import BottomNav from './BottomNav'

export default function AppShell({ children }: { children: React.ReactNode }) {
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
