'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  RefreshCw, CheckCircle, XCircle, ExternalLink, Loader2,
  ChevronDown, ChevronUp, Plus, Trash2, Tag,
} from 'lucide-react'
import type { Exchange } from '@/types/database'

// ───────── 타입 ─────────
interface CrawledEvent {
  id: string
  exchange: string
  source_id: string
  title: string
  url: string | null
  crawled_at: string
  status: 'pending' | 'approved' | 'rejected'
}

interface Keyword {
  id: string
  keyword: string
  type: 'include' | 'exclude'
}

interface ApproveForm {
  exchange: Exchange
  coin: string
  amount: string
  requireApply: boolean
  apiAllowed: boolean
  link: string
  notes: string
  startDate: string
  endDate: string
}

// ───────── 상수 ─────────
const EXCHANGE_LABELS: Record<string, string> = {
  BITHUMB: '빗썸',
  UPBIT: '업비트',
  COINONE: '코인원',
  KORBIT: '코빗',
  GOPAX: '고팍스',
}

// ═══════════════════════════════════════════════════════
export default function CrawledEventManager() {
  // 탭·상태
  const [tab, setTab] = useState<'pending' | 'approved' | 'rejected'>('pending')
  const [items, setItems] = useState<CrawledEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [crawling, setCrawling] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // 승인 모달
  const [approveTarget, setApproveTarget] = useState<CrawledEvent | null>(null)
  const [form, setForm] = useState<ApproveForm | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // 키워드 패널
  const [kwOpen, setKwOpen] = useState(false)
  const [keywords, setKeywords] = useState<Keyword[]>([])
  const [kwLoading, setKwLoading] = useState(false)
  const [newKw, setNewKw] = useState('')
  const [newKwType, setNewKwType] = useState<'include' | 'exclude'>('include')
  const [kwSubmitting, setKwSubmitting] = useState(false)

  // ── 이벤트 목록 로드
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/crawled-events?status=${tab}`)
      const data = await res.json()
      setItems(Array.isArray(data) ? data : [])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => { load() }, [load])

  // ── 키워드 로드
  const loadKeywords = useCallback(async () => {
    setKwLoading(true)
    try {
      const res = await fetch('/api/admin/crawler-keywords')
      const data = await res.json()
      setKeywords(Array.isArray(data) ? data : [])
    } catch {
      setKeywords([])
    } finally {
      setKwLoading(false)
    }
  }, [])

  useEffect(() => {
    if (kwOpen) loadKeywords()
  }, [kwOpen, loadKeywords])

  // ── 즉시 수집
  async function runCrawl() {
    setCrawling(true)
    setMessage(null)
    try {
      const res = await fetch('/api/cron/crawl-events', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET ?? ''}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '오류')
      setMessage({
        type: 'success',
        text: `크롤링 완료 — 수집 ${data.found ?? 0}건, 신규 등록 ${data.inserted ?? 0}건`,
      })
      if (tab === 'pending') load()
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : '크롤링 실패' })
    } finally {
      setCrawling(false)
    }
  }

  // ── 승인 모달 열기
  function openApprove(item: CrawledEvent) {
    const today = new Date().toISOString().slice(0, 10)
    const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    setApproveTarget(item)
    setForm({
      exchange: item.exchange as Exchange,
      coin: '',
      amount: '',
      requireApply: false,
      apiAllowed: true,
      link: item.url ?? '',
      notes: item.title,
      startDate: today,
      endDate: nextMonth,
    })
  }

  // ── 승인 제출
  async function submitApprove() {
    if (!approveTarget || !form) return
    setSubmitting(true)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/crawled-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          id: approveTarget.id,
          eventData: { ...form, amount: form.amount ? Number(form.amount) : null },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '오류')
      setMessage({ type: 'success', text: '이벤트가 등록되었습니다.' })
      setApproveTarget(null)
      setForm(null)
      load()
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : '등록 실패' })
    } finally {
      setSubmitting(false)
    }
  }

  // ── 거절
  async function reject(id: string) {
    if (!confirm('이 항목을 거절하시겠습니까?')) return
    setMessage(null)
    try {
      const res = await fetch('/api/admin/crawled-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', id }),
      })
      if (!res.ok) throw new Error('거절 처리 실패')
      load()
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : '오류' })
    }
  }

  // ── 키워드 추가
  async function addKeyword() {
    const kw = newKw.trim()
    if (!kw) return
    setKwSubmitting(true)
    try {
      const res = await fetch('/api/admin/crawler-keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: kw, type: newKwType }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '오류')
      setNewKw('')
      loadKeywords()
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : '키워드 추가 실패' })
    } finally {
      setKwSubmitting(false)
    }
  }

  // ── 키워드 삭제
  async function deleteKeyword(id: string) {
    try {
      await fetch('/api/admin/crawler-keywords', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      loadKeywords()
    } catch {
      setMessage({ type: 'error', text: '키워드 삭제 실패' })
    }
  }

  const includeKws = keywords.filter((k) => k.type === 'include')
  const excludeKws = keywords.filter((k) => k.type === 'exclude')

  // ═══ 렌더링 ═══
  return (
    <div className="space-y-4">

      {/* ── 상단 액션 ── */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {(['pending', 'approved', 'rejected'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setTab(s)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                tab === s ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s === 'pending' ? '검토 대기' : s === 'approved' ? '승인' : '거절'}
            </button>
          ))}
        </div>
        <button
          onClick={runCrawl}
          disabled={crawling}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {crawling ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          지금 수집
        </button>
      </div>

      {/* ── 메시지 ── */}
      {message && (
        <p className={`rounded-lg px-3 py-2 text-sm break-keep ${
          message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
        }`}>
          {message.text}
        </p>
      )}

      {/* ══════════════════════════════
          키워드 설정 서브패널
      ══════════════════════════════ */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <button
          onClick={() => setKwOpen((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3"
        >
          <div className="flex items-center gap-2">
            <Tag size={15} className="text-purple-600" />
            <span className="text-sm font-medium text-gray-900">키워드 설정</span>
            <span className="text-xs text-gray-600">
              포함 {includeKws.length}개 · 제외 {excludeKws.length}개
            </span>
          </div>
          {kwOpen ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
        </button>

        {kwOpen && (
          <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-4">

            {/* 키워드 추가 입력 */}
            <div className="flex gap-2">
              <input
                value={newKw}
                onChange={(e) => setNewKw(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
                placeholder="새 키워드 입력"
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400"
              />
              <select
                value={newKwType}
                onChange={(e) => setNewKwType(e.target.value as 'include' | 'exclude')}
                className="rounded-lg border border-gray-200 px-2 py-2 text-sm text-gray-900"
              >
                <option value="include">포함</option>
                <option value="exclude">제외</option>
              </select>
              <button
                onClick={addKeyword}
                disabled={kwSubmitting || !newKw.trim()}
                className="flex items-center gap-1 rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-40"
              >
                <Plus size={14} /> 추가
              </button>
            </div>

            {kwLoading ? (
              <p className="text-center text-xs text-gray-500 py-2">불러오는 중...</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {/* 포함 키워드 */}
                <div>
                  <p className="mb-2 text-xs font-medium text-green-700">
                    ✅ 포함 키워드 ({includeKws.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {includeKws.length === 0 && (
                      <span className="text-xs text-gray-500">없음 (기본값 사용)</span>
                    )}
                    {includeKws.map((kw) => (
                      <span
                        key={kw.id}
                        className="flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-xs text-green-700"
                      >
                        {kw.keyword}
                        <button onClick={() => deleteKeyword(kw.id)} className="ml-0.5 hover:text-red-500">
                          <Trash2 size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* 제외 키워드 */}
                <div>
                  <p className="mb-2 text-xs font-medium text-red-600">
                    ❌ 제외 키워드 ({excludeKws.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {excludeKws.length === 0 && (
                      <span className="text-xs text-gray-500">없음 (기본값 사용)</span>
                    )}
                    {excludeKws.map((kw) => (
                      <span
                        key={kw.id}
                        className="flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs text-red-600"
                      >
                        {kw.keyword}
                        <button onClick={() => deleteKeyword(kw.id)} className="ml-0.5 hover:text-red-700">
                          <Trash2 size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <p className="text-[11px] text-gray-600 break-keep leading-relaxed">
              💡 DB에 키워드가 없으면 코드 기본값이 사용됩니다. 추가하면 즉시 반영됩니다.
            </p>
          </div>
        )}
      </div>

      {/* ══════════════════════════════
          이벤트 목록
      ══════════════════════════════ */}
      {loading ? (
        <div className="py-8 text-center text-sm text-gray-500">불러오는 중...</div>
      ) : items.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-500">
          {tab === 'pending' ? '검토 대기 항목이 없습니다.' : '항목이 없습니다.'}
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="rounded bg-purple-50 px-1.5 py-0.5 text-xs font-medium text-purple-700">
                      {EXCHANGE_LABELS[item.exchange] ?? item.exchange}
                    </span>
                    <span className="text-[11px] text-gray-600">
                      {new Date(item.crawled_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-900 break-keep leading-snug">{item.title}</p>
                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                    >
                      <ExternalLink size={11} /> 원문 보기
                    </a>
                  )}
                </div>

                {tab === 'pending' && (
                  <div className="flex shrink-0 flex-col gap-1.5">
                    <button
                      onClick={() => openApprove(item)}
                      className="flex items-center gap-1 rounded-lg bg-green-50 px-2.5 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100"
                    >
                      <CheckCircle size={13} /> 승인
                    </button>
                    <button
                      onClick={() => reject(item.id)}
                      className="flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100"
                    >
                      <XCircle size={13} /> 거절
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ══════════════════════════════
          승인 모달
      ══════════════════════════════ */}
      {approveTarget && form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="mb-4 text-base font-semibold text-gray-900">이벤트 등록</h3>
            <p className="mb-4 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-700 break-keep leading-relaxed">
              {approveTarget.title}
            </p>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">거래소</label>
                <select
                  value={form.exchange}
                  onChange={(e) => setForm({ ...form, exchange: e.target.value as Exchange })}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900"
                >
                  {Object.entries(EXCHANGE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  코인 <span className="text-red-500">*</span>
                </label>
                <input
                  value={form.coin}
                  onChange={(e) => setForm({ ...form, coin: e.target.value.toUpperCase() })}
                  placeholder="예: BTC"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">에어드랍 금액 (원, 선택)</label>
                <input
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="예: 5000"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400"
                />
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium text-gray-700">
                    시작일 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900"
                  />
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium text-gray-700">
                    종료일 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">원문 링크</label>
                <input
                  value={form.link}
                  onChange={(e) => setForm({ ...form, link: e.target.value })}
                  placeholder="https://..."
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">비고</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 resize-none"
                />
              </div>

              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.requireApply}
                    onChange={(e) => setForm({ ...form, requireApply: e.target.checked })}
                    className="rounded"
                  />
                  신청 필요
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.apiAllowed}
                    onChange={(e) => setForm({ ...form, apiAllowed: e.target.checked })}
                    className="rounded"
                  />
                  API 거래 허용
                </label>
              </div>
            </div>

            <div className="mt-5 flex gap-3">
              <button
                onClick={submitApprove}
                disabled={submitting || !form.coin}
                className="flex-1 rounded-lg bg-green-600 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {submitting ? '등록 중...' : '이벤트 등록'}
              </button>
              <button
                onClick={() => { setApproveTarget(null); setForm(null) }}
                disabled={submitting}
                className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
