'use client'

import { useEffect, useState } from 'react'
import { listKeys } from '@/lib/app/key-store'
import { EXCHANGE_LABELS, type Exchange } from '@/types/database'

export interface KeyOption {
  id: string
  exchange: Exchange
  label: string
}

interface Props {
  exchange: Exchange
  multi?: boolean              // true면 복수 선택, false면 단일
  value: string[]
  onChange: (ids: string[]) => void
}

export default function KeySelector({ exchange, multi = false, value, onChange }: Props) {
  const [keys, setKeys] = useState<KeyOption[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      setLoading(true)
      try {
        const all = await listKeys()
        setKeys(all.filter((k) => k.exchange === exchange))
      } finally {
        setLoading(false)
      }
    })()
  }, [exchange])

  function toggle(id: string) {
    if (multi) {
      onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])
    } else {
      onChange(value.includes(id) ? [] : [id])
    }
  }

  function selectAll() {
    onChange(keys.map((k) => k.id))
  }

  function deselectAll() {
    onChange([])
  }

  if (loading) return <p className="text-xs text-gray-600">불러오는 중...</p>
  if (keys.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 break-keep">
        <p className="text-sm text-gray-900 font-semibold">{EXCHANGE_LABELS[exchange]} API Key가 없습니다.</p>
        <a href="/app/profile/api-keys" className="text-xs text-blue-600 font-semibold underline mt-1 inline-block">
          → API Key 등록하기
        </a>
      </div>
    )
  }

  const allSelected = keys.every((k) => value.includes(k.id))

  return (
    <div className="flex flex-col gap-2">
      {/* 멀티 선택 헤더 */}
      {multi && (
        <div className="flex items-center justify-between px-0.5 mb-0.5">
          <span className="text-[12px] font-semibold" style={{ color: '#6B7684' }}>
            {value.length > 0 ? `${value.length}개 선택됨` : '계정 선택'}
          </span>
          <button
            type="button"
            onClick={allSelected ? deselectAll : selectAll}
            className="text-[12px] font-semibold"
            style={{ color: '#0064FF' }}
          >
            {allSelected ? '전체 해제' : '전체 선택'}
          </button>
        </div>
      )}

      {/* 계정 목록 */}
      {keys.map((k) => {
        const selected = value.includes(k.id)
        return (
          <button
            key={k.id}
            type="button"
            onClick={() => toggle(k.id)}
            className="flex items-center gap-3 p-3 rounded-xl text-left transition-all break-keep"
            style={
              selected
                ? { background: '#EBF3FF', border: '1.5px solid #0064FF' }
                : { background: '#F2F4F6', border: '1.5px solid transparent' }
            }
          >
            {/* 체크박스 아이콘 */}
            <span
              className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold"
              style={
                selected
                  ? { background: '#0064FF', color: '#fff' }
                  : { background: '#fff', border: '1.5px solid #D1D5DB', color: 'transparent' }
              }
            >
              ✓
            </span>
            {/* 라벨 */}
            <span
              className="text-sm font-semibold"
              style={{ color: selected ? '#0064FF' : '#374151' }}
            >
              {k.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
