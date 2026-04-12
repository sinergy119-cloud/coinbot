'use client'

import { useState, useEffect, useCallback } from 'react'
import { X } from 'lucide-react'

interface Inquiry {
  id: string
  category: 'bug' | 'feature' | 'general'
  title: string
  content: string
  status: 'pending' | 'answered'
  admin_reply: string | null
  created_at: string
  answered_at: string | null
}

const CATEGORIES: { id: 'bug' | 'feature' | 'general'; label: string; color: string }[] = [
  { id: 'bug', label: '🐛 오류 신고', color: 'bg-red-50 border-red-300 text-red-700' },
  { id: 'feature', label: '💡 기능 개선', color: 'bg-amber-50 border-amber-300 text-amber-700' },
  { id: 'general', label: '❓ 일반 문의', color: 'bg-blue-50 border-blue-300 text-blue-700' },
]

function toKST(s: string) {
  return new Date(s).toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

export default function InquiryModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'new' | 'list'>('new')
  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  const [category, setCategory] = useState<'bug' | 'feature' | 'general'>('general')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const fetchList = useCallback(async () => {
    try {
      const res = await fetch('/api/inquiries')
      if (res.ok) setInquiries(await res.json())
    } catch { /* 무시 */ }
  }, [])

  useEffect(() => { fetchList() }, [fetchList])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setSuccess('')
    if (!title.trim() || !content.trim()) {
      setError('제목과 내용을 입력해주세요.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, title, content }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error || '등록 실패')
        return
      }
      setSuccess('문의가 등록되었습니다. 관리자가 확인 후 답변드립니다.')
      setTitle(''); setContent(''); setCategory('general')
      fetchList()
      setTimeout(() => { setSuccess(''); setTab('list') }, 1500)
    } catch { setError('네트워크 오류') }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl max-h-[90vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">💬 문의하기</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        {/* 탭 */}
        <div className="flex border-b border-gray-200">
          <button
            type="button"
            onClick={() => setTab('new')}
            className={`flex-1 px-3 py-2.5 text-sm font-medium transition-colors ${
              tab === 'new' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            새 문의 작성
          </button>
          <button
            type="button"
            onClick={() => setTab('list')}
            className={`flex-1 px-3 py-2.5 text-sm font-medium transition-colors ${
              tab === 'list' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            내 문의 목록
            {inquiries.filter((i) => i.status === 'answered' && i.admin_reply).length > 0 && (
              <span className="ml-1 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] text-green-700">
                {inquiries.filter((i) => i.status === 'answered').length}
              </span>
            )}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {/* 새 문의 작성 */}
          {tab === 'new' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* 친근한 안내 배너 */}
              <div className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-3">
                <div className="flex items-start gap-2">
                  <span className="text-lg">💌</span>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-blue-900">답변은 텔레그램으로 바로 알려드려요!</p>
                    <p className="mt-0.5 text-[11px] text-blue-700 leading-relaxed">
                      궁금하신 내용이나 불편하신 점을 편하게 남겨주세요. 관리자가 확인 후 답변을 등록하면 <b>등록하신 텔레그램으로 즉시 알림</b>을 보내드립니다. 😊
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium text-gray-600">카테고리</label>
                <div className="grid grid-cols-3 gap-2">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCategory(c.id)}
                      className={`rounded-lg border-2 px-2 py-2 text-xs font-medium transition ${
                        category === c.id ? c.color : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">제목 <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={100}
                  placeholder="예: 스케줄 실행 오류"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                />
                <p className="mt-1 text-[10px] text-gray-500 text-right">{title.length}/100</p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">내용 <span className="text-red-500">*</span></label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  maxLength={2000}
                  rows={6}
                  placeholder="발생 상황, 재현 방법, 스크린샷 설명 등을 자세히 적어주세요."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none resize-none"
                />
                <p className="mt-1 text-[10px] text-gray-500 text-right">{content.length}/2000</p>
              </div>

              {error && <p className="text-xs text-red-600">{error}</p>}
              {success && <p className="text-xs text-green-600">{success}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? '등록 중...' : '문의 등록'}
              </button>
            </form>
          )}

          {/* 내 문의 목록 */}
          {tab === 'list' && (
            <div className="space-y-2">
              {inquiries.length === 0 && (
                <p className="text-center text-sm text-gray-500 py-8">등록한 문의가 없습니다.</p>
              )}
              {inquiries.map((inq) => {
                const cat = CATEGORIES.find((c) => c.id === inq.category)
                const answered = inq.status === 'answered'
                return (
                  <div key={inq.id} className={`rounded-lg border p-3 ${answered ? 'border-green-200 bg-green-50/30' : 'border-gray-200 bg-white'}`}>
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${cat?.color ?? ''}`}>
                        {cat?.label}
                      </span>
                      {answered ? (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                          ✅ 답변 완료
                        </span>
                      ) : (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">
                          ⏳ 답변 대기
                        </span>
                      )}
                      <span className="ml-auto text-[10px] text-gray-500">{toKST(inq.created_at)}</span>
                    </div>
                    <p className="text-sm font-semibold text-gray-900 mb-1">{inq.title}</p>
                    <p className="text-xs text-gray-600 whitespace-pre-wrap">{inq.content}</p>
                    {answered && inq.admin_reply && (
                      <div className="mt-2 rounded-lg bg-white border border-green-200 p-2.5">
                        <p className="text-[10px] font-semibold text-green-700 mb-1">👨‍💼 관리자 답변</p>
                        <p className="text-xs text-gray-700 whitespace-pre-wrap">{inq.admin_reply}</p>
                        {inq.answered_at && (
                          <p className="mt-1 text-[10px] text-gray-500">{toKST(inq.answered_at)}</p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
