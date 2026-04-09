'use client'

import { Trash2 } from 'lucide-react'
import { EXCHANGE_LABELS, EXCHANGE_EMOJI, TRADE_TYPE_LABELS } from '@/types/database'
import type { Exchange, TradeType, TradeJobRow } from '@/types/database'


export interface ScheduleListProps {
  jobs: TradeJobRow[]
  accountMap: Record<string, string>
  onDelete: (id: string) => void
}

export default function ScheduleList({ jobs, accountMap, onDelete }: ScheduleListProps) {
  if (jobs.length === 0) {
    return <p className="text-sm text-gray-400">등록된 스케줄이 없습니다.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b text-gray-500">
            <th className="pb-2 pr-3 whitespace-nowrap">거래소</th>
            <th className="pb-2 pr-3">계정</th>
            <th className="pb-2 pr-3 whitespace-nowrap">코인 / 방식 / 금액</th>
            <th className="pb-2 pr-3 whitespace-nowrap">기간</th>
            <th className="pb-2 pr-3 whitespace-nowrap">시간</th>
            <th className="pb-2"></th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => {
            const isCompleted = (job as TradeJobRow & { status?: string }).status === 'completed'
            return (
            <tr key={job.id} className={`border-b border-gray-100 ${isCompleted ? 'opacity-50' : ''}`}>
              <td className="py-2 pr-3 whitespace-nowrap">
                {isCompleted
                  ? <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">완료</span>
                  : <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700">진행</span>
                }
                <span className="ml-1">{EXCHANGE_EMOJI[job.exchange as Exchange]} {EXCHANGE_LABELS[job.exchange as Exchange] ?? job.exchange}</span>
              </td>
              <td className="py-2 pr-3 text-gray-600">
                {(job.account_ids as string[]).map((id) => accountMap[id] ?? id).join(', ')}
              </td>
              <td className="py-2 pr-3 whitespace-nowrap">
                <span className="font-medium">{job.coin}</span>
                <span className="mx-1 text-gray-300">/</span>
                <span className={job.trade_type === 'BUY' ? 'text-red-600' : job.trade_type === 'SELL' ? 'text-blue-600' : 'text-purple-600'}>
                  {TRADE_TYPE_LABELS[job.trade_type as TradeType] ?? job.trade_type}
                </span>
                <span className="mx-1 text-gray-300">/</span>
                <span className="text-gray-700">
                  {job.trade_type === 'SELL' ? '전량' : `${Number(job.amount_krw).toLocaleString()}원`}
                </span>
              </td>
              <td className="py-2 pr-3 whitespace-nowrap text-gray-500">
                <div>{job.schedule_from}</div>
                <div>~ {job.schedule_to}</div>
              </td>
              <td className="py-2 pr-3 whitespace-nowrap text-gray-500">
                {job.schedule_time.slice(0, 5)}
              </td>
              <td className="py-2">
                <button onClick={() => onDelete(job.id)}
                  className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600">
                  <Trash2 size={14} />
                </button>
              </td>
            </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
