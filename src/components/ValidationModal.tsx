'use client'

import { X, CheckCircle, XCircle } from 'lucide-react'
import type { ValidationItem } from '@/app/api/validate/route'

interface ValidationModalProps {
  items: ValidationItem[]
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
}

export default function ValidationModal({ items, onConfirm, onCancel, loading }: ValidationModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">실행 전 확인</h3>
          <button onClick={onCancel} className="rounded p-1 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <div className="mb-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-xs text-gray-500">
                <th className="pb-2 pr-3">거래소</th>
                <th className="pb-2 pr-3">이름</th>
                <th className="pb-2 pr-3">주문 내용</th>
                <th className="pb-2 pr-3">잔고</th>
                <th className="pb-2">가능 여부</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.accountId} className="border-b border-gray-100">
                  <td className="py-2 pr-3">{item.exchange}</td>
                  <td className="py-2 pr-3">{item.accountName}</td>
                  <td className="py-2 pr-3 text-xs">{item.orderSummary}</td>
                  <td className="py-2 pr-3 text-xs">
                    {item.coinQty !== undefined
                      ? (
                        <span>
                          {item.coinQty.toFixed(8).replace(/\.?0+$/, '') || '0'}
                          <br />
                          <span className="text-gray-400">{item.coin} → 전량 매도</span>
                        </span>
                      )
                      : `${Math.floor(item.balance).toLocaleString()}원`}
                  </td>
                  <td className="py-2">
                    {item.feasible ? (
                      <span className="flex items-center gap-1 text-green-600">
                        <CheckCircle size={14} /> 가능
                      </span>
                    ) : (
                      <span className="flex items-start gap-1 text-red-600 text-xs">
                        <XCircle size={14} className="mt-0.5 shrink-0" /> {item.reason}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? '실행 중...' : '실행'}
          </button>
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            취소
          </button>
        </div>
      </div>
    </div>
  )
}
