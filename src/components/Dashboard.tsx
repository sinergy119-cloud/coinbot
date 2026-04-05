'use client'

import { useState, useEffect, useCallback } from 'react'
import Header from '@/components/Header'
import TradeForm from '@/components/TradeForm'
import type { TradeInput } from '@/components/TradeForm'
import TradeList from '@/components/TradeList'
import ValidationModal from '@/components/ValidationModal'
import ScheduleModal from '@/components/ScheduleModal'
import ResultPanel from '@/components/ResultPanel'
import AccountRegister from '@/components/AccountRegister'
import Tabs from '@/components/Tabs'
import type { TradeJobRow } from '@/types/database'
import type { ValidationItem } from '@/app/api/validate/route'
import type { ExecutionResultItem } from '@/app/api/execute/route'

interface DashboardProps {
  userId: string
  loginId: string
  isAdmin: boolean
}

export default function Dashboard({ userId, loginId, isAdmin }: DashboardProps) {
  // 탭 상태
  const [activeTab, setActiveTab] = useState<'trade' | 'register'>('trade')

  // 거래 목록
  const [tradeJobs, setTradeJobs] = useState<TradeJobRow[]>([])

  // 모달 / 결과
  const [validationItems, setValidationItems] = useState<ValidationItem[]>([])
  const [executionResults, setExecutionResults] = useState<ExecutionResultItem[]>([])
  const [pendingTrade, setPendingTrade] = useState<TradeInput | null>(null)

  // UI 상태
  const [showValidation, setShowValidation] = useState(false)
  const [showSchedule, setShowSchedule] = useState(false)
  const [loading, setLoading] = useState(false)
  const [scheduleTradeData, setScheduleTradeData] = useState<TradeInput | null>(null)

  void userId // used for future features

  // 거래 목록 조회
  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/trade-jobs')
      if (res.ok) {
        const data = await res.json()
        setTradeJobs(data)
      }
    } catch { /* 무시 */ }
  }, [])

  useEffect(() => { fetchJobs() }, [fetchJobs])

  // ── 지금 실행: 1단계 - 검증 ──
  async function handleExecute(data: TradeInput) {
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
      const res = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exchange: pendingTrade.exchange,
          coin: pendingTrade.coin,
          tradeType: pendingTrade.tradeType,
          amountKrw: pendingTrade.amountKrw,
          accountIds: pendingTrade.accountIds,
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
    } catch {
      alert('네트워크 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // ── 스케줄 등록 ──
  function handleScheduleClick(data: TradeInput) {
    setScheduleTradeData(data)
    setShowSchedule(true)
  }

  async function handleScheduleConfirm(from: string, to: string, time: string) {
    if (!scheduleTradeData) return
    setLoading(true)
    try {
      const res = await fetch('/api/trade-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exchange: scheduleTradeData.exchange,
          coin: scheduleTradeData.coin,
          tradeType: scheduleTradeData.tradeType,
          amountKrw: scheduleTradeData.amountKrw,
          accountIds: scheduleTradeData.accountIds,
          scheduleFrom: from,
          scheduleTo: to,
          scheduleTime: time,
        }),
      })
      const result = await res.json()
      if (!res.ok) {
        alert(result.error || '등록 실패')
        return
      }
      setShowSchedule(false)
      setScheduleTradeData(null)
      fetchJobs()
    } catch {
      alert('네트워크 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // ── 거래 수정 / 삭제 ──
  async function handleUpdateJob(id: string, data: { scheduleFrom: string; scheduleTo: string; scheduleTime: string }) {
    const res = await fetch(`/api/trade-jobs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (res.ok) fetchJobs()
    else alert('수정 실패')
  }

  async function handleDeleteJob(id: string) {
    if (!confirm('이 스케줄을 삭제하시겠습니까?')) return
    const res = await fetch(`/api/trade-jobs/${id}`, { method: 'DELETE' })
    if (res.ok) fetchJobs()
    else alert('삭제 실패')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header loginId={loginId} isAdmin={isAdmin} />

      <Tabs
        tabs={[
          { key: 'trade', label: '코인 거래' },
          { key: 'register', label: '거래소 등록' },
        ]}
        active={activeTab}
        onChange={(k) => setActiveTab(k as 'trade' | 'register')}
      />

      <main className="mx-auto max-w-2xl space-y-4 px-4 py-4">
        {activeTab === 'trade' ? (
          <>
            <TradeForm onExecute={handleExecute} onSchedule={handleScheduleClick} loading={loading} />
            <TradeList jobs={tradeJobs} onUpdate={handleUpdateJob} onDelete={handleDeleteJob} />
            {executionResults.length > 0 && (
              <ResultPanel results={executionResults} onClose={() => setExecutionResults([])} />
            )}
          </>
        ) : (
          <AccountRegister />
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

      {/* 스케줄 모달 */}
      {showSchedule && (
        <ScheduleModal
          onConfirm={handleScheduleConfirm}
          onCancel={() => { setShowSchedule(false); setScheduleTradeData(null) }}
          loading={loading}
        />
      )}
    </div>
  )
}
