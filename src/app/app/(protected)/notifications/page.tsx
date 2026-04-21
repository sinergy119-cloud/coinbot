'use client'

import { useEffect, useState } from 'react'

interface NotificationItem {
  id: string
  category: string
  title: string
  body: string
  deepLink: string | null
  readAt: string | null
  createdAt: string
}

const CATEGORY_LABEL: Record<string, string> = {
  all: '전체',
  trade_result: '거래',
  event: '이벤트',
  schedule: '스케줄',
  system: '시스템',
  announcement: '공지',
}

const CATEGORY_ICON: Record<string, string> = {
  trade_result: '💰',
  event: '🎁',
  schedule: '📅',
  system: '⚙️',
  announcement: '📢',
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return '방금'
  if (m < 60) return `${m}분 전`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}시간 전`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}일 전`
  const dt = new Date(new Date(iso).toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
  return `${dt.getMonth() + 1}/${dt.getDate()}`
}

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([])
  const [category, setCategory] = useState<string>('all')
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)

  async function load(cat: string) {
    setLoading(true)
    try {
      const res = await fetch(`/api/app/notifications?category=${cat}&limit=50`)
      const json = await res.json()
      if (json.ok) {
        setItems(json.data.items)
        setUnreadCount(json.data.unreadCount ?? 0)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(category)
  }, [category])

  async function readAll() {
    const res = await fetch('/api/app/notifications/read-all', { method: 'PATCH' })
    const json = await res.json()
    if (json.ok) {
      setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })))
      setUnreadCount(0)
    }
  }

  async function readOne(id: string) {
    await fetch(`/api/app/notifications/${id}/read`, { method: 'PATCH' })
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: n.readAt ?? new Date().toISOString() } : n)))
    setUnreadCount((c) => Math.max(0, c - 1))
  }

  async function remove(id: string) {
    await fetch(`/api/app/notifications/${id}`, { method: 'DELETE' })
    setItems((prev) => prev.filter((n) => n.id !== id))
  }

  return (
    <div className="flex flex-col gap-3">
      <header className="px-4 pt-6 pb-2 break-keep">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">알림함</h1>
            <p className="text-sm text-gray-600 mt-1">미읽음 {unreadCount}건</p>
          </div>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={readAll}
              className="text-xs font-semibold text-gray-700 bg-white border border-gray-200 px-3 py-1.5 rounded-lg"
            >
              전체 읽음
            </button>
          )}
        </div>
      </header>

      {/* 카테고리 필터 */}
      <div className="px-4 overflow-x-auto">
        <div className="flex gap-2 whitespace-nowrap">
          {Object.entries(CATEGORY_LABEL).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setCategory(key)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                category === key ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 border border-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <section className="px-4 flex flex-col gap-2">
        {loading ? (
          <div className="bg-white rounded-2xl p-8 text-center text-sm text-gray-600">불러오는 중...</div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center text-sm text-gray-600 break-keep">알림이 없습니다.</div>
        ) : (
          items.map((n) => (
            <div
              key={n.id}
              onClick={() => !n.readAt && readOne(n.id)}
              className={`bg-white rounded-2xl p-4 cursor-pointer ${n.readAt ? 'opacity-70' : 'border-l-4 border-blue-500'}`}
            >
              <div className="flex items-start gap-3 break-keep">
                <span className="text-xl shrink-0">{CATEGORY_ICON[n.category] ?? '🔔'}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-900 break-keep">{n.title}</p>
                    <span className="text-[10px] text-gray-600 shrink-0">{formatRelative(n.createdAt)}</span>
                  </div>
                  <p className="text-xs text-gray-700 mt-1 break-keep">{n.body}</p>
                  <div className="flex items-center gap-3 mt-2">
                    {n.deepLink && (
                      <a
                        href={n.deepLink}
                        className="text-xs font-semibold text-blue-600"
                        onClick={(e) => e.stopPropagation()}
                      >
                        이동 →
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        remove(n.id)
                      }}
                      className="text-xs text-gray-600 ml-auto"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  )
}
