'use client'

import { useState, useEffect, useCallback } from 'react'
import { Trash2, ChevronDown, ChevronUp } from 'lucide-react'

interface Inquiry {
  id: string
  user_id: string
  user_login_id: string | null
  user_name: string | null
  category: 'bug' | 'feature' | 'general'
  title: string
  content: string
  status: 'pending' | 'answered'
  admin_reply: string | null
  created_at: string
  answered_at: string | null
}

const CATEGORY_LABEL: Record<string, { text: string; color: string }> = {
  bug: { text: '🐛 오류', color: 'bg-red-100 text-red-700 border-red-300' },
  feature: { text: '💡 기능', color: 'bg-amber-100 text-amber-700 border-amber-300' },
  general: { text: '❓ 일반', color: 'bg-blue-100 text-blue-700 border-blue-300' },
}

function toKST(s: string) {
  return new Date(s).toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

export default function InquiryManager() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [filter, setFilter] = useState<'all' | 'pending' | 'answered'>('all')

  const fetchList = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/inquiries')
      if (res.ok) {
        const data = await res.json()
        setInquiries(data.inquiries ?? [])
      }
    } catch { /* 무시 */ }
  }, [])

  useEffect(() => { fetchList() }, [fetchList])

  async function handleReply(id: string) {
    const reply = replyDraft[id]?.trim()
    if (!reply) { alert('답변을 입력해주세요.'); return }
    setLoading((l) => ({ ...l, [id]: true }))
    try {
      const res = await fetch(`/api/admin/inquiries/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminReply: reply }),
      })
      if (!res.ok) { const d = await res.json(); alert(d.error || '저장 실패'); return }
      setReplyDraft((d) => ({ ...d, [id]: '' }))
      fetchList()
    } catch { alert('네트워크 오류') }
    finally { setLoading((l) => ({ ...l, [id]: false })) }
  }

  async function handleDelete(id: string) {
    if (!confirm('이 문의를 삭제하시겠습니까?')) return
    try {
      const res = await fetch(`/api/admin/inquiries/${id}`, { method: 'DELETE' })
      if (!res.ok) { alert('삭제 실패'); return }
      fetchList()
    } catch { alert('네트워크 오류') }
  }

  const filtered = inquiries.filter((i) => {
    if (filter === 'all') return true
    return i.status === filter
  })
  const pendingCount = inquiries.filter((i) => i.status === 'pending').length

  return (
    <div className="space-y-4">
      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{inquiries.length}</p>
          <p className="text-xs text-gray-500">총 문의</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center">
          <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
          <p className="text-xs text-amber-700">답변 대기</p>
        </div>
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{inquiries.length - pendingCount}</p>
          <p className="text-xs text-green-700">답변 완료</p>
        </div>
      </div>

      {/* 필터 */}
      <div className="flex gap-2">
        {(['all', 'pending', 'answered'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              filter === f ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {f === 'all' ? '전체' : f === 'pending' ? '답변 대기' : '답변 완료'}
          </button>
        ))}
      </div>

      {/* 목록 */}
      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-base font-semibold text-gray-900">📬 문의 목록</h2>
        {filtered.length === 0 ? (
          <p className="text-sm text-gray-500">문의가 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {filtered.map((inq) => {
              const cat = CATEGORY_LABEL[inq.category]
              const expanded = expandedId === inq.id
              const answered = inq.status === 'answered'
              return (
                <div key={inq.id} className={`rounded-lg border p-3 ${answered ? 'border-green-200 bg-green-50/30' : 'border-amber-200 bg-amber-50/30'}`}>
                  {/* 헤더 */}
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : inq.id)}
                    className="w-full flex items-center gap-2 flex-wrap text-left"
                  >
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium border ${cat.color}`}>
                      {cat.text}
                    </span>
                    {answered ? (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                        ✅ 답변 완료
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 animate-pulse">
                        ⏳ 답변 대기
                      </span>
                    )}
                    <span className="text-sm font-semibold text-gray-900 flex-1 truncate">{inq.title}</span>
                    {expanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                  </button>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-gray-600">
                    <span>{inq.user_name ?? '-'} ({inq.user_login_id ?? '-'})</span>
                    <span>·</span>
                    <span>{toKST(inq.created_at)}</span>
                  </div>

                  {expanded && (
                    <div className="mt-3 space-y-3 border-t border-gray-100 pt-3">
                      {/* 문의 내용 */}
                      <div>
                        <p className="text-[10px] font-semibold text-gray-600 mb-1">문의 내용</p>
                        <p className="text-xs text-gray-700 whitespace-pre-wrap bg-white rounded p-2 border border-gray-100">{inq.content}</p>
                      </div>

                      {/* 답변 */}
                      {answered && inq.admin_reply ? (
                        <div>
                          <p className="text-[10px] font-semibold text-green-700 mb-1">관리자 답변</p>
                          <p className="text-xs text-gray-700 whitespace-pre-wrap bg-white rounded p-2 border border-green-100">{inq.admin_reply}</p>
                          {inq.answered_at && (
                            <p className="text-[10px] text-gray-600 mt-1">{toKST(inq.answered_at)}</p>
                          )}
                        </div>
                      ) : (
                        <div>
                          <p className="text-[10px] font-semibold text-gray-600 mb-1">답변 작성</p>
                          <textarea
                            value={replyDraft[inq.id] ?? ''}
                            onChange={(e) => setReplyDraft((d) => ({ ...d, [inq.id]: e.target.value }))}
                            maxLength={2000}
                            rows={4}
                            placeholder="답변을 입력하세요"
                            className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs text-gray-900 focus:border-blue-500 focus:outline-none resize-none"
                          />
                          <button
                            onClick={() => handleReply(inq.id)}
                            disabled={loading[inq.id]}
                            className="mt-2 w-full rounded-lg bg-blue-600 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                          >
                            {loading[inq.id] ? '저장 중...' : '답변 저장 및 알림'}
                          </button>
                        </div>
                      )}

                      {/* 삭제 */}
                      <button
                        onClick={() => handleDelete(inq.id)}
                        className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-red-600"
                      >
                        <Trash2 size={10} /> 삭제
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
