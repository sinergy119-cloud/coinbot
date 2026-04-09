'use client'

import { useState, useEffect, useCallback } from 'react'
import Header from '@/components/Header'
import TradeForm from '@/components/TradeForm'
import type { TradeInput } from '@/components/TradeForm'
import ScheduleList from '@/components/ScheduleList'
import ValidationModal from '@/components/ValidationModal'

import ResultPanel from '@/components/ResultPanel'
import AssetPanel from '@/components/AssetPanel'
import TradeHistoryPanel from '@/components/TradeHistoryPanel'
import TradeLogPanel from '@/components/TradeLogPanel'
import ScheduleTab from '@/components/ScheduleTab'
import type { TradeJobRow, Exchange } from '@/types/database'
import { EXCHANGE_EMOJI, EXCHANGE_LABELS } from '@/types/database'
import type { ValidationItem } from '@/app/api/validate/route'
import type { ExecutionResultItem } from '@/app/api/execute/route'

type TabType = 'trade' | 'schedule' | 'assets' | 'history'
const TABS: { id: TabType; label: string }[] = [
  { id: 'trade',    label: '거래 실행' },
  { id: 'schedule', label: '스케줄' },
  { id: 'assets',   label: '나의 자산' },
  { id: 'history',  label: '거래 내역' },
]

interface DashboardProps {
  userId: string
  loginId: string
  isAdmin: boolean
}

export default function Dashboard({ userId, loginId, isAdmin }: DashboardProps) {
  // 스케줄 목록
  const [tradeJobs, setTradeJobs] = useState<TradeJobRow[]>([])
  const [accountMap, setAccountMap] = useState<Record<string, string>>({})

  // 모달 / 결과
  const [validationItems, setValidationItems] = useState<ValidationItem[]>([])
  const [executionResults, setExecutionResults] = useState<ExecutionResultItem[]>([])
  const [pendingTrade, setPendingTrade] = useState<TradeInput | null>(null)

  // UI 상태
  const [activeTab, setActiveTab] = useState<TabType>('trade')
  const [selectedExchange, setSelectedExchange] = useState<string | null>(null)
  const [showValidation, setShowValidation] = useState(false)
  const [loading, setLoading] = useState(false)

  // 대시보드 요약
  const [summary, setSummary] = useState({ activeSchedules: 0, todayTotal: 0, todaySuccess: 0, todayFail: 0, monthlyCost: 0, monthlyTrades: 0 })
  // 최근 실행 (빠른 실행용)
  const [lastTrade, setLastTrade] = useState<TradeInput | null>(null)
  // 스케줄 수정
  const [editJob, setEditJob] = useState<TradeJobRow | null>(null)
  const [editFrom, setEditFrom] = useState('')
  const [editTo, setEditTo] = useState('')
  const [editTime, setEditTime] = useState('')
  const [editLoading, setEditLoading] = useState(false)

  // 이벤트 배너
  const [events, setEvents] = useState<{ id: string; exchange: string; coin: string; title: string; condition: string | null; start_date: string; end_date: string }[]>([])

  void userId

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard')
      if (res.ok) setSummary(await res.json())
    } catch { /* 무시 */ }
  }, [])

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch('/api/announcements')
      if (res.ok) setEvents(await res.json())
    } catch { /* 무시 */ }
  }, [])

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/trade-jobs')
      if (res.ok) setTradeJobs(await res.json())
    } catch { /* 무시 */ }
  }, [])

  const fetchAllAccounts = useCallback(async () => {
    try {
      const res = await fetch('/api/accounts')
      if (res.ok) {
        const data: { id: string; account_name: string }[] = await res.json()
        const map: Record<string, string> = {}
        data.forEach((a) => { map[a.id] = a.account_name })
        setAccountMap(map)
      }
    } catch { /* 무시 */ }
  }, [])

  useEffect(() => { fetchJobs(); fetchAllAccounts(); fetchSummary(); fetchEvents() }, [fetchJobs, fetchAllAccounts, fetchSummary, fetchEvents])

  // ── 지금 실행: 1단계 - 검증 ──
  async function handleExecute(data: TradeInput, skipSave?: boolean) {
    if (!skipSave) setLastTrade(data)
    setLoading(true)
    try {
      const res = await fetch('/api/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exchange: data.exchange,
          coin: data.coin,
          tradeType: data.tradeType,
          amountKrw: data.amountKrw,
          accountIds: data.accountIds,
        }),
      })
      const result = await res.json()
      if (!res.ok) {
        alert(result.error || '검증 실패')
        return
      }
      setValidationItems(result)
      setPendingTrade(data)
      setShowValidation(true)
    } catch {
      alert('네트워크 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // ── 지금 실행: 2단계 - 실제 실행 ──
  async function handleConfirmExecute() {
    if (!pendingTrade) return
    setLoading(true)
    try {
      // feasible=false 계정 자동 제외
      const feasibleIds = validationItems
        .filter((v) => v.feasible)
        .map((v) => v.accountId)
      if (feasibleIds.length === 0) {
        alert('실행 가능한 계정이 없습니다.')
        setLoading(false)
        return
      }
      const res = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exchange: pendingTrade.exchange,
          coin: pendingTrade.coin,
          tradeType: pendingTrade.tradeType,
          amountKrw: pendingTrade.amountKrw,
          accountIds: feasibleIds,
        }),
      })
      const results = await res.json()
      if (!res.ok) {
        alert(results.error || '실행 실패')
        return
      }
      setExecutionResults(results)
      setShowValidation(false)
      setPendingTrade(null)
      fetchSummary()
    } catch {
      alert('네트워크 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // ── 스케줄 수정 ──
  function handleEditJob(job: TradeJobRow) {
    setEditJob(job)
    setEditFrom(job.schedule_from)
    setEditTo(job.schedule_to)
    setEditTime(job.schedule_time.slice(0, 5))
  }

  async function handleSaveEdit() {
    if (!editJob) return
    setEditLoading(true)
    try {
      const res = await fetch(`/api/trade-jobs/${editJob.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduleFrom: editFrom, scheduleTo: editTo, scheduleTime: editTime }),
      })
      if (res.ok) { setEditJob(null); fetchJobs() }
      else alert('수정 실패')
    } catch { alert('네트워크 오류') }
    finally { setEditLoading(false) }
  }

  // ── 스케줄 삭제 ──
  async function handleDeleteJob(id: string) {
    if (!confirm('이 스케줄을 삭제하시겠습니까?')) return
    const res = await fetch(`/api/trade-jobs/${id}`, { method: 'DELETE' })
    if (res.ok) fetchJobs()
    else alert('삭제 실패')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header loginId={loginId} isAdmin={isAdmin} />

      <main className="mx-auto max-w-2xl px-4 py-4">
        {/* 대시보드 요약 */}
        <div className="mb-4 grid grid-cols-3 gap-2">
          <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-center">
            <p className="text-lg font-bold text-blue-600">{summary.activeSchedules}</p>
            <p className="text-[10px] text-gray-500">활성 스케줄</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-center">
            <p className="text-lg font-bold text-green-600">{summary.todaySuccess}<span className="text-xs font-normal text-gray-400">/{summary.todayTotal}</span></p>
            <p className="text-[10px] text-gray-500">오늘 성공</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-center">
            <p className="text-lg font-bold text-amber-600">{summary.monthlyCost.toLocaleString()}<span className="text-xs font-normal">원</span></p>
            <p className="text-[10px] text-gray-500">이번 달 비용</p>
          </div>
        </div>

        {/* 이벤트 배너 */}
        {events.length > 0 && (
          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
            <p className="mb-1.5 text-xs font-bold text-amber-800">🎁 진행 중인 이벤트</p>
            <div className="space-y-1">
              {events.map((ev) => (
                <div key={ev.id} className="flex items-center gap-2 text-xs">
                  <span>{EXCHANGE_EMOJI[ev.exchange as Exchange]} {EXCHANGE_LABELS[ev.exchange as Exchange]}</span>
                  <span className="font-bold text-gray-800">{ev.coin}</span>
                  <span className="text-gray-400">{ev.start_date}~{ev.end_date}</span>
                  {ev.condition && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700">{ev.condition}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 탭 메뉴 */}
        <div className="mb-4 flex border-b border-gray-200">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); if (tab.id === 'trade') fetchJobs() }}
              className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 탭 콘텐츠 */}
        {activeTab === 'trade' && (
          <div className="space-y-4">
            {lastTrade && (
              <button
                onClick={() => handleExecute(lastTrade, true)}
                disabled={loading}
                className="w-full rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50 transition flex items-center justify-center gap-2"
              >
                🔄 최근 실행 다시 실행 ({lastTrade.exchange} · {lastTrade.coin} · {lastTrade.amountKrw?.toLocaleString()}원)
              </button>
            )}
            <TradeForm onExecute={handleExecute} loading={loading} />
            <section className="rounded-xl border border-gray-200 bg-white p-4">
              <h2 className="mb-3 text-base font-semibold text-gray-900">
                등록된 스케줄 <span className="text-sm font-normal text-gray-400">({tradeJobs.length}개)</span>
              </h2>
              <ScheduleList jobs={tradeJobs} accountMap={accountMap} onDelete={handleDeleteJob} onEdit={handleEditJob} />
            </section>
            {executionResults.length > 0 && (
              <ResultPanel results={executionResults} onClose={() => setExecutionResults([])} />
            )}
          </div>
        )}
        {activeTab === 'schedule' && <ScheduleTab defaultExchange={selectedExchange} onExchangeChange={setSelectedExchange} />}
        {activeTab === 'assets' && <AssetPanel defaultExchange={selectedExchange} onExchangeChange={setSelectedExchange} />}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <TradeLogPanel />
            <TradeHistoryPanel defaultExchange={selectedExchange} onExchangeChange={setSelectedExchange} />
          </div>
        )}
      </main>

      {/* 검증 모달 */}
      {showValidation && (
        <ValidationModal
          items={validationItems}
          onConfirm={handleConfirmExecute}
          onCancel={() => { setShowValidation(false); setPendingTrade(null) }}
          loading={loading}
        />
      )}

      {/* 스케줄 수정 모달 */}
      {editJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-base font-semibold text-gray-900">스케줄 수정</h2>
            <div className="mb-3 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
              <span className="font-medium">{EXCHANGE_EMOJI[editJob.exchange as Exchange]} {EXCHANGE_LABELS[editJob.exchange as Exchange]}</span>
              <span className="mx-1">·</span>
              <span className="font-bold">{editJob.coin}</span>
              <span className="mx-1">·</span>
              <span>{editJob.trade_type === 'SELL' ? '전량 매도' : `${Number(editJob.amount_krw).toLocaleString()}원`}</span>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">실행 기간</label>
                <div className="flex items-center gap-2">
                  <input type="date" value={editFrom} onChange={(e) => setEditFrom(e.target.value)}
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900" />
                  <span className="text-gray-400">~</span>
                  <input type="date" value={editTo} onChange={(e) => setEditTo(e.target.value)}
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">실행 시간 (KST)</label>
                <input type="time" value={editTime} onChange={(e) => setEditTime(e.target.value)}
                  className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900" />
              </div>
              <div className="flex gap-2">
                <button onClick={handleSaveEdit} disabled={editLoading}
                  className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                  {editLoading ? '저장 중...' : '수정'}
                </button>
                <button onClick={() => setEditJob(null)}
                  className="flex-1 rounded-lg bg-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-300">
                  취소
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
