'use client'

import { useState } from 'react'
import TopBar from './TopBar'
import BottomNav from './BottomNav'
import DrawerMenu from './DrawerMenu'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <>
      <TopBar onMenuClick={() => setDrawerOpen(true)} />
      <DrawerMenu open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <main className="flex-1 pb-20 max-w-lg mx-auto w-full">{children}</main>
      <BottomNav />
    </>
  )
}
