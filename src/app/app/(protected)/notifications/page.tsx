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

  useEffect(() => { load(category) }, [category])

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
    <div className="flex flex-col gap-4 pb-6" style={{ background: '#F9FAFB', minHeight: '100%' }}>

      {/* 헤더 */}
      <header className="px-4 pt-6 pb-0 break-keep">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[22px] font-bold" style={{ color: '#191F28' }}>알림함</h1>
            <p className="text-[13px] mt-1" style={{ color: '#6B7684' }}>
              {unreadCount > 0 ? `미읽음 ${unreadCount}건` : '모두 읽었습니다'}
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={readAll}
              className="text-[12px] font-semibold px-3 py-1.5 rounded-xl active:opacity-70 transition-opacity"
              style={{ background: '#EBF3FF', color: '#0064FF' }}
            >
              전체 읽음
            </button>
          )}
        </div>
      </header>

      {/* 카테고리 필터 */}
      <div className="px-4 overflow-x-auto">
        <div className="flex gap-2 whitespace-nowrap pb-0.5">
          {Object.entries(CATEGORY_LABEL).map(([key, label]) => {
            const isActive = category === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => setCategory(key)}
                className="px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all"
                style={isActive
                  ? { background: '#0064FF', color: '#fff' }
                  : { background: '#fff', color: '#6B7684', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }
                }
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* 알림 목록 */}
      <section className="px-4">
        {loading ? (
          <div
            className="rounded-2xl p-8 text-center text-[14px] break-keep"
            style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', color: '#6B7684' }}
          >
            불러오는 중...
          </div>
        ) : items.length === 0 ? (
          <div
            className="rounded-2xl p-8 text-center text-[14px] break-keep"
            style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', color: '#6B7684' }}
          >
            알림이 없습니다.
          </div>
        ) : (
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
          >
            {items.map((n, idx, arr) => (
              <div
                key={n.id}
                onClick={() => !n.readAt && readOne(n.id)}
                className="px-5 py-4 break-keep cursor-pointer active:bg-gray-50 transition-colors"
                style={{
                  borderBottom: idx < arr.length - 1 ? '1px solid #F2F4F6' : undefined,
                  borderLeft: n.readAt ? undefined : '3px solid #0064FF',
                  opacity: n.readAt ? 0.65 : 1,
                }}
              >
                <div className="flex items-start gap-3">
                  {/* 아이콘 */}
                  <span className="text-[20px] shrink-0 mt-0.5">
                    {CATEGORY_ICON[n.category] ?? '🔔'}
                  </span>

                  <div className="min-w-0 flex-1">
                    {/* 제목 + 시간 */}
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[14px] font-semibold leading-snug" style={{ color: '#191F28' }}>
                        {n.title}
                      </p>
                      <span className="text-[11px] shrink-0" style={{ color: '#B0B8C1' }}>
                        {formatRelative(n.createdAt)}
                      </span>
                    </div>

                    {/* 본문 */}
                    <p
                      className="text-[12px] mt-0.5 leading-relaxed line-clamp-2"
                      style={{ color: '#6B7684' }}
                    >
                      {n.body}
                    </p>

                    {/* 액션 */}
                    {(n.deepLink) && (
                      <div className="flex items-center gap-3 mt-2">
                        {n.deepLink && (
                          <a
                            href={n.deepLink}
                            className="text-[12px] font-semibold"
                            style={{ color: '#0064FF' }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            이동 →
                          </a>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 삭제 버튼 */}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); remove(n.id) }}
                    className="shrink-0 text-[12px] px-2 py-1 rounded-lg active:opacity-70 transition-opacity"
                    style={{ color: '#B0B8C1' }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
