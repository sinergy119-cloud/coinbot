'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LogOut, Shield } from 'lucide-react'

interface HeaderProps {
  loginId: string
  isAdmin?: boolean
  showBackToHome?: boolean
}

export default function Header({ loginId, isAdmin = false, showBackToHome = false }: HeaderProps) {
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-bold text-gray-900">CoinBot</h1>
        {showBackToHome && (
          <Link href="/" className="text-sm text-blue-600 hover:underline">
            ← 메인으로
          </Link>
        )}
        {isAdmin && !showBackToHome && (
          <Link
            href="/admin"
            className="flex items-center gap-1 rounded-lg bg-purple-100 px-2 py-1 text-xs font-medium text-purple-700 hover:bg-purple-200"
          >
            <Shield size={12} />
            관리자
          </Link>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-500">{loginId}</span>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-gray-500 hover:bg-gray-100"
        >
          <LogOut size={16} />
          로그아웃
        </button>
      </div>
    </header>
  )
}
