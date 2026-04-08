'use client'

import { useState } from 'react'
import Header from '@/components/Header'
import AdminDashboard from '@/components/AdminDashboard'
import MemberStatus from '@/components/MemberStatus'

type TabType = 'accounts' | 'members'
const TABS: { id: TabType; label: string }[] = [
  { id: 'accounts', label: '계정 관리' },
  { id: 'members', label: '회원 현황' },
]

export default function AdminTabs({ loginId }: { loginId: string }) {
  const [activeTab, setActiveTab] = useState<TabType>('accounts')

  return (
    <div className="min-h-screen bg-gray-50">
      <Header loginId={loginId} isAdmin showBackToHome />

      <main className="mx-auto max-w-3xl px-4 py-4">
        {/* 탭 메뉴 */}
        <div className="mb-4 flex border-b border-gray-200">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-b-2 border-purple-600 text-purple-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'accounts' && <AdminDashboard loginId={loginId} embedded />}
        {activeTab === 'members' && <MemberStatus />}
      </main>
    </div>
  )
}
