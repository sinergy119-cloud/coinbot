'use client'

import { CheckCircle, XCircle } from 'lucide-react'
import type { ExecutionResultItem } from '@/app/api/execute/route'

interface ResultPanelProps {
  results: ExecutionResultItem[]
  onClose: () => void
}

export default function ResultPanel({ results, onClose }: ResultPanelProps) {
  if (results.length === 0) return null

  const successCount = results.filter((r) => r.success).length
  const failCount = results.length - successCount

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">실행 결과</h2>
        <button onClick={onClose} className="text-sm text-gray-400 hover:text-gray-600">닫기</button>
      </div>

      <div className="mb-3 flex gap-4 text-sm">
        <span className="text-green-600">성공: {successCount}건</span>
        <span className="text-red-600">실패: {failCount}건</span>
      </div>

      {/* 처리 결과 */}
      <div className="mb-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-xs text-gray-500">
              <th className="pb-2 pr-3">거래소</th>
              <th className="pb-2 pr-3">이름</th>
              <th className="pb-2 pr-3">주문 내용</th>
              <th className="pb-2 pr-3">잔고</th>
              <th className="pb-2">결과</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.accountId} className="border-b border-gray-100">
                <td className="py-2 pr-3">{r.exchange}</td>
                <td className="py-2 pr-3">{r.accountName}</td>
                <td className="py-2 pr-3 text-xs">{r.orderSummary}</td>
                <td className="py-2 pr-3">{Math.floor(r.balance).toLocaleString()}원</td>
                <td className="py-2">
                  {r.success ? (
                    <span className="flex items-center gap-1 text-green-600">
                      <CheckCircle size={14} /> SUCCESS
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-red-600">
                      <XCircle size={14} /> {r.reason}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 잔고 현황 */}
      <h3 className="mb-2 text-sm font-semibold text-gray-700">잔고 현황</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-xs text-gray-500">
              <th className="pb-2 pr-3">거래소</th>
              <th className="pb-2 pr-3">이름</th>
              <th className="pb-2">자산 현황 (KRW)</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={`bal-${r.accountId}`} className="border-b border-gray-100">
                <td className="py-2 pr-3">{r.exchange}</td>
                <td className="py-2 pr-3">{r.accountName}</td>
                <td className="py-2 font-medium">{Math.floor(r.balance).toLocaleString()}원</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
