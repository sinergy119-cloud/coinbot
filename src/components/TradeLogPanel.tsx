'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { EXCHANGE_LABELS, EXCHANGE_EMOJI } from '@/types/database'
import type { Exchange } from '@/types/database'

interface TradeLog {
  id: string
  exchange: string
  coin: string
  trade_type: string
  amount_krw: number
  account_name: string
  success: boolean
  reason: string | null
  balance_before: number | null
  balance: number | null
  source: string
  executed_at: string
}

const TRADE_LABEL: Record<string, string> = { BUY: '매수', SELL: '매도', CYCLE: '매수&매도' }

function toKST(dt: string) {
  return new Date(dt).toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

export default function TradeLogPanel() {
  const [logs, setLogs] = useState<TradeLog[]>([])
  const [days, setDays] = useState(7)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/trade-logs?days=${days}`)
      .then((r) => r.json())
      .then((data) => { if (!cancelled) setLogs(Array.isArray(data) ? data : []) })
      .catch(() => { if (!cancelled) setLogs([]) })
    return () => { cancelled = true }
  }, [days])

  const totalCost = logs
    .filter((l) => l.success && l.balance_before && l.balance)
    .reduce((sum, l) => sum + Math.max(0, Number(l.balance_before) - Number(l.balance)), 0)

  return (
    <section className="rounded-xl border border-gray-200 bg-white">
      {/* 아코디언 헤더 */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between p-4 hover:bg-gray-50 transition"
      >
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-gray-900">📋 실행 로그</h2>
          {logs.length > 0 && (
            <span className="flex gap-2 text-xs">
              <span className="text-gray-500">총 {logs.length}건</span>
              <span className="text-green-600">성공 {logs.filter((l) => l.success).length}</span>
              <span className="text-red-600">실패 {logs.filter((l) => !l.success).length}</span>
            </span>
          )}
        </div>
        {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>

      {/* 아코디언 내용 */}
      {expanded && (
      <div className="px-4 pb-4">
        <div className="flex items-center justify-end mb-3">
          <div className="flex gap-1">
            {[7, 14, 30].map((d) => (
              <button key={d} onClick={(e) => { e.stopPropagation(); setDays(d) }}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                  days === d ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}>
                {d}일
              </button>
            ))}
          </div>
        </div>

        {/* 비용 요약 */}
        {logs.length > 0 && totalCost > 0 && (
          <div className="mb-3 text-xs text-amber-600">
            비용 {Math.round(totalCost).toLocaleString()}원
          </div>
        )}

      {logs.length === 0 ? (
        <p className="text-sm text-gray-400">실행 로그가 없습니다.</p>
      ) : (
        <>
          {/* PC 테이블 */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b text-gray-500">
                  <th className="pb-2 pr-2">시간</th>
                  <th className="pb-2 pr-2">거래소</th>
                  <th className="pb-2 pr-2">코인</th>
                  <th className="pb-2 pr-2">방식</th>
                  <th className="pb-2 pr-2">계정</th>
                  <th className="pb-2 pr-2">결과</th>
                  <th className="pb-2 pr-2">비용</th>
                  <th className="pb-2">구분</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const cost = log.success && log.balance_before && log.balance
                    ? Math.max(0, Number(log.balance_before) - Number(log.balance))
                    : 0
                  return (
                    <tr key={log.id} className="border-b border-gray-50">
                      <td className="py-1.5 pr-2 text-gray-500 whitespace-nowrap">{toKST(log.executed_at)}</td>
                      <td className="py-1.5 pr-2 whitespace-nowrap">{EXCHANGE_EMOJI[log.exchange as Exchange]} {EXCHANGE_LABELS[log.exchange as Exchange]}</td>
                      <td className="py-1.5 pr-2 font-medium">{log.coin}</td>
                      <td className="py-1.5 pr-2">{TRADE_LABEL[log.trade_type] ?? log.trade_type}</td>
                      <td className="py-1.5 pr-2 text-gray-500">{log.account_name}</td>
                      <td className="py-1.5 pr-2">
                        <span className={log.success ? 'text-green-600' : 'text-red-600'}>
                          {log.success ? '성공' : '실패'}
                        </span>
                      </td>
                      <td className="py-1.5 pr-2 text-amber-600">{cost > 0 ? `${Math.round(cost)}원` : '-'}</td>
                      <td className="py-1.5">
                        <span className={`rounded px-1.5 py-0.5 text-[10px] ${
                          log.source === 'schedule' ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {log.source === 'schedule' ? '스케줄' : '수동'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* 모바일 카드 */}
          <div className="sm:hidden space-y-2">
            {logs.map((log) => {
              const cost = log.success && log.balance_before && log.balance
                ? Math.max(0, Number(log.balance_before) - Number(log.balance))
                : 0
              return (
                <div key={log.id} className="rounded-lg border border-gray-100 px-3 py-2">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5 text-xs">
                      <span>{EXCHANGE_EMOJI[log.exchange as Exchange]}</span>
                      <span className="font-bold">{log.coin}</span>
                      <span className="text-gray-400">{TRADE_LABEL[log.trade_type]}</span>
                    </div>
                    <span className={`text-xs font-medium ${log.success ? 'text-green-600' : 'text-red-600'}`}>
                      {log.success ? '성공' : '실패'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-gray-400">
                    <span>{toKST(log.executed_at)} · {log.account_name}</span>
                    <span>{cost > 0 ? `${Math.round(cost)}원` : ''} {log.source === 'schedule' ? '스케줄' : '수동'}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
      </div>
      )}
    </section>
  )
}
