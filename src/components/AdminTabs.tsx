'use client'

import { useState, useEffect } from 'react'
import Header from '@/components/Header'
import AdminDashboard from '@/components/AdminDashboard'
import MemberStatus from '@/components/MemberStatus'
import EventManager from '@/components/EventManager'
import InquiryManager from '@/components/InquiryManager'
import CrawledEventManager from '@/components/CrawledEventManager'

type TabType = 'accounts' | 'members' | 'events' | 'crawled' | 'inquiries'
const TABS: { id: TabType; label: string }[] = [
  { id: 'accounts', label: '계정 관리' },
  { id: 'members', label: '회원 현황' },
  { id: 'events', label: '이벤트 관리' },
  { id: 'crawled', label: '수집 이벤트' },
  { id: 'inquiries', label: '문의 관리' },
]

export interface CrawledPrefill {
  crawledEventId: string
  exchange: string
  link: string | null
  notes: string        // 배너 표시용 제목 (폼 특이사항 필드에는 미입력)
  coin?: string        // 크롤링 추출 코인 코드
  amount?: string      // 크롤링 추출 금액
  startDate?: string   // 크롤링 추출 시작일 (YYYY-MM-DD)
  endDate?: string     // 크롤링 추출 종료일 (YYYY-MM-DD)
  rewardDate?: string  // 크롤링 추출 리워드 지급일 (YYYY-MM-DD)
}

export default function AdminTabs({ loginId }: { loginId: string }) {
  const [activeTab, setActiveTab] = useState<TabType>('accounts')
  const [pendingCount, setPendingCount] = useState(0)
  const [crawledPendingCount, setCrawledPendingCount] = useState(0)
  const [prefillFromCrawled, setPrefillFromCrawled] = useState<CrawledPrefill | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/admin/inquiries')
      .then((r) => r.ok ? r.json() : { pendingCount: 0 })
      .then((d) => { if (!cancelled) setPendingCount(d.pendingCount ?? 0) })
      .catch(() => {})
    fetch('/api/admin/crawled-events?status=pending')
      .then((r) => r.ok ? r.json() : [])
      .then((d) => { if (!cancelled) setCrawledPendingCount(Array.isArray(d) ? d.length : 0) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [activeTab])

  // 수집 이벤트 승인 → 이벤트 관리 탭으로 이동 + 기본정보 주입
  function handleApproveNavigation(item: {
    id: string; exchange: string; url: string | null; title: string
    coin?: string; amount?: string; startDate?: string; endDate?: string; rewardDate?: string
  }) {
    setPrefillFromCrawled({
      crawledEventId: item.id,
      exchange: item.exchange,
      link: item.url,
      notes: item.title,
      coin: item.coin,
      amount: item.amount,
      startDate: item.startDate,
      endDate: item.endDate,
      rewardDate: item.rewardDate,
    })
    setActiveTab('events')
  }

  function handleClearPrefill() {
    setPrefillFromCrawled(null)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header loginId={loginId} isAdmin showBackToHome />

      <main className="mx-auto max-w-3xl px-4 py-4">
        {/* 탭 메뉴 */}
        <div className="mb-4 flex border-b border-gray-200 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-b-2 border-purple-600 text-purple-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              {tab.id === 'inquiries' && pendingCount > 0 && (
                <span className="ml-1 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {pendingCount}
                </span>
              )}
              {tab.id === 'crawled' && crawledPendingCount > 0 && (
                <span className="ml-1 rounded-full bg-blue-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {crawledPendingCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {activeTab === 'accounts' && <AdminDashboard loginId={loginId} embedded />}
        {activeTab === 'members' && <MemberStatus />}
        {activeTab === 'events' && (
          <EventManager
            prefill={prefillFromCrawled}
            onClearPrefill={handleClearPrefill}
          />
        )}
        {activeTab === 'crawled' && (
          <CrawledEventManager onApproveNavigation={handleApproveNavigation} />
        )}
        {activeTab === 'inquiries' && <InquiryManager />}
      </main>
    </div>
  )
}
