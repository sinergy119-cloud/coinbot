'use client'

import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import type { TradeJobRow } from '@/types/database'
import { EXCHANGE_LABELS, TRADE_TYPE_LABELS } from '@/types/database'
import type { Exchange, TradeType } from '@/types/database'

interface TradeListProps {
  jobs: TradeJobRow[]
  onUpdate: (id: string, data: { scheduleFrom: string; scheduleTo: string; scheduleTime: string }) => void
  onDelete: (id: string) => void
}

export default function TradeList({ jobs, onUpdate, onDelete }: TradeListProps) {
  const [editId, setEditId] = useState<string | null>(null)
  const [editFrom, setEditFrom] = useState('')
  const [editTo, setEditTo] = useState('')
  const [editTime, setEditTime] = useState('')

  function startEdit(job: TradeJobRow) {
    setEditId(job.id)
    setEditFrom(job.schedule_from)
    setEditTo(job.schedule_to)
    setEditTime(job.schedule_time)
  }

  function saveEdit() {
    if (!editId) return
    onUpdate(editId, { scheduleFrom: editFrom, scheduleTo: editTo, scheduleTime: editTime })
    setEditId(null)
  }

  if (jobs.length === 0) {
    return (
      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-base font-semibold text-gray-900">거래 목록</h2>
        <p className="text-sm text-gray-400">등록된 스케줄이 없습니다.</p>
      </section>
    )
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <h2 className="mb-3 text-base font-semibold text-gray-900">거래 목록</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-xs text-gray-500">
              <th className="pb-2 pr-3">거래소</th>
              <th className="pb-2 pr-3">코인</th>
              <th className="pb-2 pr-3">구분</th>
              <th className="pb-2 pr-3">금액</th>
              <th className="pb-2 pr-3">기간</th>
              <th className="pb-2 pr-3">시간</th>
              <th className="pb-2"></th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id} className="border-b border-gray-100">
                <td className="py-2 pr-3">{EXCHANGE_LABELS[job.exchange as Exchange] ?? job.exchange}</td>
                <td className="py-2 pr-3 font-medium">{job.coin}</td>
                <td className="py-2 pr-3">
                  <span className={job.trade_type === 'BUY' ? 'text-red-600' : 'text-blue-600'}>
                    {TRADE_TYPE_LABELS[job.trade_type as TradeType] ?? job.trade_type}
                  </span>
                </td>
                <td className="py-2 pr-3">{Number(job.amount_krw).toLocaleString()}원</td>

                {editId === job.id ? (
                  <>
                    <td className="py-2 pr-3">
                      <input type="date" value={editFrom} onChange={(e) => setEditFrom(e.target.value)}
                        className="w-28 rounded border px-1 py-0.5 text-xs" />
                      ~
                      <input type="date" value={editTo} onChange={(e) => setEditTo(e.target.value)}
                        className="w-28 rounded border px-1 py-0.5 text-xs" />
                    </td>
                    <td className="py-2 pr-3">
                      <input type="time" value={editTime} onChange={(e) => setEditTime(e.target.value)}
                        className="w-20 rounded border px-1 py-0.5 text-xs" />
                    </td>
                    <td className="py-2">
                      <button onClick={saveEdit}
                        className="mr-1 rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700">저장</button>
                      <button onClick={() => setEditId(null)}
                        className="rounded bg-gray-200 px-2 py-1 text-xs hover:bg-gray-300">취소</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="py-2 pr-3 text-xs text-gray-500">
                      {job.schedule_from} ~ {job.schedule_to}
                    </td>
                    <td className="py-2 pr-3 text-xs text-gray-500">{job.schedule_time}</td>
                    <td className="py-2">
                      <button onClick={() => startEdit(job)}
                        className="mr-1 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-blue-600">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => onDelete(job.id)}
                        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
