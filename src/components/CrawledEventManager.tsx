'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  RefreshCw, CheckCircle, XCircle, ExternalLink, Loader2,
  ChevronDown, ChevronUp, Plus, Trash2, Tag, History,
  AlertCircle, Settings, Calendar,
} from 'lucide-react'

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

interface CrawlLog {
  id: string
  triggered_by: 'cron' | 'manual'
  started_at: string
  found_count: number
  inserted_count: number
  errors: Array<{ exchange: string; message: string }>
  telegram_sent: boolean | null
  telegram_error: string | null
}

// ───────── 상수 ─────────
const EXCHANGE_LABELS: Record<string, string> = {
  BITHUMB: '빗썸', UPBIT: '업비트', COINONE: '코인원', KORBIT: '코빗', GOPAX: '고팍스',
}

interface ApproveItem {
  id: string
  exchange: string
  url: string | null
  title: string
  coin?: string
  amount?: string
  startDate?: string
  endDate?: string
  rewardDate?: string
  requireApply?: boolean
  apiAllowed?: boolean
}

interface Props {
  onApproveNavigation: (item: ApproveItem) => void
}

const INTERVAL_PRESETS = [
  { hours: 6,  label: '6시간',  desc: '6시 · 12시 · 18시 · 24시 (KST)' },
  { hours: 12, label: '12시간', desc: '12시 · 24시 (KST)' },
  { hours: 24, label: '24시간', desc: '24시 (KST)' },
]

// ═══════════════════════════════════════════════════════
export default function CrawledEventManager({ onApproveNavigation }: Props) {
  // 탭·상태
  const [tab, setTab] = useState<'pending' | 'approved' | 'rejected'>('pending')
  const [items, setItems] = useState<CrawledEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [crawling, setCrawling] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'warn'; text: string } | null>(null)

  // 지금 수집 패널
  const [crawlPanelOpen, setCrawlPanelOpen] = useState(false)
  const getTodayKST = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
  const [sinceDate, setSinceDate] = useState(getTodayKST)

  // 키워드 패널
  const [kwOpen, setKwOpen] = useState(false)
  const [keywords, setKeywords] = useState<Keyword[]>([])
  const [kwLoading, setKwLoading] = useState(false)
  const [newKw, setNewKw] = useState('')
  const [newKwType, setNewKwType] = useState<'include' | 'exclude'>('include')
  const [kwSubmitting, setKwSubmitting] = useState(false)

  // 수집 설정 패널
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [intervalHours, setIntervalHours] = useState(12)
  const [nextCrawlAt, setNextCrawlAt] = useState<string | null>(null)
  const [settingsSaving, setSettingsSaving] = useState(false)

  // 수집 이력 패널
  const [logOpen, setLogOpen] = useState(false)
  const [logs, setLogs] = useState<CrawlLog[]>([])
  const [logLoading, setLogLoading] = useState(false)

  // 승인 처리 중인 항목 ID
  const [approvingId, setApprovingId] = useState<string | null>(null)

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

  useEffect(() => { loadKeywords() }, [loadKeywords])
  useEffect(() => {
    if (kwOpen) loadKeywords()
  }, [kwOpen, loadKeywords])

  // ── 수집 설정 로드
  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/crawler-settings')
      const data = await res.json()
      if (data.crawl_interval_hours) setIntervalHours(data.crawl_interval_hours)
      setNextCrawlAt(data.next_crawl_at ?? null)
    } catch {
      // 조회 실패 시 기본값 유지
    }
  }, [])

  useEffect(() => { loadSettings() }, [loadSettings])

  // ── 수집 설정 저장
  async function saveSettings() {
    setSettingsSaving(true)
    try {
      const res = await fetch('/api/admin/crawler-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          crawl_interval_hours: intervalHours,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '저장 실패')
      setNextCrawlAt(data.next_crawl_at)
      setMessage({
        type: 'success',
        text: `자동 수집 설정이 저장되었습니다 (매 ${intervalHours}시간마다 · 기간: 어제~오늘 고정).`,
      })
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : '설정 저장 실패' })
    } finally {
      setSettingsSaving(false)
    }
  }

  // ── 수집 이력 로드
  const loadLogs = useCallback(async () => {
    setLogLoading(true)
    try {
      const res = await fetch('/api/admin/crawl-logs')
      const data = await res.json()
      setLogs(Array.isArray(data) ? data : [])
    } catch {
      setLogs([])
    } finally {
      setLogLoading(false)
    }
  }, [])

  useEffect(() => { loadLogs() }, [loadLogs])
  useEffect(() => {
    if (logOpen) loadLogs()
  }, [logOpen, loadLogs])

  // ── 즉시 수집
  async function runCrawl() {
    setCrawling(true)
    setMessage(null)
    try {
      const body: Record<string, string> = {}
      if (sinceDate) body.sinceDate = sinceDate

      const res = await fetch('/api/admin/run-crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error ?? '오류')

      const dateLabel = sinceDate ? ` (${sinceDate} 이후)` : ''
      const found = data.found ?? 0
      const inserted = data.inserted ?? 0
      const alreadyExists = found - inserted
      const alreadyLabel = alreadyExists > 0 ? ` (기존 처리 항목 ${alreadyExists}건 제외)` : ''
      const errorLabel = data.errors?.length ? ` · 오류 ${data.errors.length}개 거래소` : ''
      setMessage({
        type: 'success',
        text: `크롤링 완료${dateLabel} — 신규 등록 ${inserted}건${alreadyLabel}${errorLabel}`,
      })
      setCrawlPanelOpen(false)
      setSinceDate(getTodayKST())
      loadLogs()
      if (tab === 'pending') load()
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : '크롤링 실패' })
    } finally {
      setCrawling(false)
    }
  }

  // ── 승인: preview API로 코인·금액·기간 추출 후 이벤트 관리 탭으로 이동
  async function handleApprove(item: CrawledEvent) {
    setApprovingId(item.id)
    setMessage(null)
    try {
      let extra: Partial<ApproveItem> = {}
      if (item.url) {
        const params = new URLSearchParams({ url: item.url, title: item.title })
        const res = await fetch(`/api/admin/crawl-preview?${params.toString()}`)
        if (res.ok) {
          const data = await res.json()
          extra = {
            coin: data.coin ?? undefined,
            amount: data.amount ?? undefined,
            startDate: data.startDate ?? undefined,
            endDate: data.endDate ?? undefined,
            rewardDate: data.rewardDate ?? undefined,
            requireApply: data.requireApply,
            apiAllowed: data.apiAllowed,
          }
        }
      }
      onApproveNavigation({ id: item.id, exchange: item.exchange, url: item.url, title: item.title, ...extra })
    } catch {
      // 추출 실패해도 기본 정보로 이동
      onApproveNavigation({ id: item.id, exchange: item.exchange, url: item.url, title: item.title })
    } finally {
      setApprovingId(null)
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

  // ── 이력 메시지 색상 헬퍼
  function logRowColor(log: CrawlLog) {
    const nonUpbitErrors = log.errors?.filter((e) => e.exchange !== 'UPBIT') ?? []
    if (nonUpbitErrors.length > 0 && log.inserted_count === 0) return 'bg-red-50'
    if (log.inserted_count > 0) return 'bg-green-50'
    return ''
  }

  // ── 오류 표시 헬퍼: UPBIT는 알려진 이슈로 분리
  function renderErrors(errors: CrawlLog['errors']) {
    if (!errors?.length) return <span className="text-gray-400">—</span>
    const upbitErrors = errors.filter((e) => e.exchange === 'UPBIT')
    const otherErrors = errors.filter((e) => e.exchange !== 'UPBIT')
    const tooltip = [
      ...otherErrors.map((e) => `${e.exchange}: ${e.message}`),
      ...upbitErrors.map((e) => `${e.exchange}: [알려진 이슈] ${e.message}`),
    ].join('\n')
    return (
      <span className="cursor-help" title={tooltip}>
        {otherErrors.length > 0 && (
          <span className="text-red-600 font-medium">{otherErrors.length}건 ⚠</span>
        )}
        {upbitErrors.length > 0 && (
          <span className={`${otherErrors.length > 0 ? ' ml-1' : ''}text-gray-400`} title={tooltip}>
            업비트↗
          </span>
        )}
        {otherErrors.length === 0 && upbitErrors.length === 0 && (
          <span className="text-gray-400">—</span>
        )}
      </span>
    )
  }

  // ─────────────────────────────────────────────
  // 다음 수집 예정 시각 포맷
  function formatNextCrawl(iso: string | null) {
    if (!iso) return '—'
    return new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
  }

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
        <div className="flex gap-2">
          <button
            onClick={() => { setCrawlPanelOpen((v) => !v); setMessage(null) }}
            disabled={crawling}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 ${
              crawlPanelOpen ? 'bg-blue-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            <RefreshCw size={14} />
            지금 수집
          </button>
        </div>
      </div>

      {/* ── 지금 수집 인라인 패널 ── */}
      {crawlPanelOpen && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 space-y-3">
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-blue-600 shrink-0" />
            <span className="text-sm font-medium text-gray-900">수집 시작일 지정</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <input
              type="date"
              value={sinceDate}
              onChange={(e) => setSinceDate(e.target.value)}
              max={getTodayKST()}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900"
            />
            <p className="text-xs text-gray-600 break-keep">
              {sinceDate} 00:00 KST 이후 24시간 내 게시된 공지를 수집합니다.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setCrawlPanelOpen(false); setSinceDate(getTodayKST()) }}
              disabled={crawling}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              취소
            </button>
            <button
              onClick={runCrawl}
              disabled={crawling}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {crawling ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              {crawling ? '수집 중...' : '수집 시작'}
            </button>
          </div>
        </div>
      )}

      {/* ── 메시지 ── */}
      {message && (
        <p className={`rounded-lg px-3 py-2 text-sm break-keep flex items-start gap-2 ${
          message.type === 'success'
            ? 'bg-green-50 text-green-700'
            : message.type === 'warn'
            ? 'bg-yellow-50 text-yellow-700'
            : 'bg-red-50 text-red-600'
        }`}>
          {message.type === 'warn' && <AlertCircle size={15} className="mt-0.5 shrink-0" />}
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
          자동 수집 설정 서브패널
      ══════════════════════════════ */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <button
          onClick={() => setSettingsOpen((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3"
        >
          <div className="flex items-center gap-2">
            <Settings size={15} className="text-blue-500" />
            <span className="text-sm font-medium text-gray-900">자동 수집 설정</span>
            <span className="text-xs text-gray-600">
              매 {intervalHours}시간 · 어제~오늘
            </span>
          </div>
          {settingsOpen ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
        </button>

        {settingsOpen && (
          <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-4">

            {/* 수집 기간 — 고정 안내 */}
            <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2.5">
              <p className="text-xs font-medium text-blue-700 mb-0.5">수집 기간 (고정)</p>
              <p className="text-sm text-blue-900 font-medium">어제 ~ 오늘</p>
              <p className="mt-1 text-[11px] text-blue-700 break-keep">
                매 실행 시 어제·오늘 2일치를 재스캔합니다. 이벤트 누락을 방지하기 위해 고정됩니다.
              </p>
            </div>

            {/* 수집 주기 — 라디오 */}
            <div>
              <p className="mb-2 text-xs font-medium text-gray-700">수집 주기</p>
              <div className="space-y-2">
                {INTERVAL_PRESETS.map((preset) => (
                  <label
                    key={preset.hours}
                    className={`flex items-center justify-between rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${
                      intervalHours === preset.hours
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="radio"
                        name="intervalPreset"
                        checked={intervalHours === preset.hours}
                        onChange={() => setIntervalHours(preset.hours)}
                        className="accent-blue-600"
                      />
                      <span className={`text-sm font-medium ${intervalHours === preset.hours ? 'text-blue-900' : 'text-gray-900'}`}>
                        {preset.label}
                      </span>
                      {preset.hours === 12 && (
                        <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">권장</span>
                      )}
                    </div>
                    <span className={`text-[11px] ${intervalHours === preset.hours ? 'text-blue-700' : 'text-gray-500'}`}>
                      {preset.desc}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* 다음 수집 예정 */}
            <div className="rounded-lg bg-gray-50 px-3 py-2.5">
              <p className="text-xs text-gray-600 break-keep">
                <span className="font-medium text-gray-700">다음 수집 예정</span>
                {' '}
                {formatNextCrawl(nextCrawlAt)}
              </p>
              <p className="mt-1 text-[11px] text-gray-600 break-keep">
                저장 시 지금으로부터 {intervalHours}시간 후로 재설정됩니다.
              </p>
            </div>

            <div className="flex justify-end">
              <button
                onClick={saveSettings}
                disabled={settingsSaving}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {settingsSaving ? <Loader2 size={14} className="animate-spin" /> : null}
                {settingsSaving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════
          수집 이력 서브패널
      ══════════════════════════════ */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <button
          onClick={() => setLogOpen((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3"
        >
          <div className="flex items-center gap-2">
            <History size={15} className="text-blue-500" />
            <span className="text-sm font-medium text-gray-900">수집 이력</span>
            {logs.length > 0 && (
              <span className="text-xs text-gray-600">최근 {logs.length}건</span>
            )}
          </div>
          {logOpen ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
        </button>

        {logOpen && (
          <div className="border-t border-gray-100">
            {logLoading ? (
              <p className="py-4 text-center text-xs text-gray-500">불러오는 중...</p>
            ) : logs.length === 0 ? (
              <p className="py-4 text-center text-xs text-gray-500">수집 이력이 없습니다.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50 text-gray-500">
                      <th className="px-4 py-2 text-left font-medium">실행 시각</th>
                      <th className="px-3 py-2 text-center font-medium">구분</th>
                      <th className="px-3 py-2 text-center font-medium">수집</th>
                      <th className="px-3 py-2 text-center font-medium">신규</th>
                      <th className="px-3 py-2 text-center font-medium">오류</th>
                      <th className="px-3 py-2 text-center font-medium">알림</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr
                        key={log.id}
                        className={`border-b border-gray-50 last:border-0 ${logRowColor(log)}`}
                      >
                        <td className="px-4 py-2 text-gray-700 whitespace-nowrap">
                          {new Date(log.started_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            log.triggered_by === 'manual'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {log.triggered_by === 'manual' ? '수동' : '자동'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center text-gray-700">{log.found_count}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={log.inserted_count > 0 ? 'font-semibold text-green-700' : 'text-gray-500'}>
                            {log.inserted_count}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center text-xs">
                          {renderErrors(log.errors)}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {log.inserted_count === 0 ? (
                            <span className="text-gray-400">—</span>
                          ) : log.telegram_sent === true ? (
                            <span title="발송 완료" className="text-green-600">✓</span>
                          ) : log.telegram_error ? (
                            <span
                              className="cursor-help text-red-500"
                              title={`발송 실패: ${log.telegram_error}`}
                            >
                              ✗
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
                      onClick={() => handleApprove(item)}
                      disabled={approvingId === item.id}
                      className="flex items-center gap-1 rounded-lg bg-green-50 px-2.5 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-60"
                    >
                      {approvingId === item.id
                        ? <Loader2 size={13} className="animate-spin" />
                        : <CheckCircle size={13} />}
                      {approvingId === item.id ? '분석 중...' : '승인'}
                    </button>
                    <button
                      onClick={() => reject(item.id)}
                      disabled={approvingId === item.id}
                      className="flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 disabled:opacity-40"
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

    </div>
  )
}
