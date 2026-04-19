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

  return (
    <div className="flex flex-col gap-2">
      {keys.map((k) => {
        const selected = value.includes(k.id)
        return (
          <button
            key={k.id}
            type="button"
            onClick={() => toggle(k.id)}
            className={`flex items-center justify-between p-3 rounded-xl border text-left break-keep ${
              selected ? 'bg-gray-900 border-gray-900 text-white' : 'bg-white border-gray-200 text-gray-900'
            }`}
          >
            <span className="text-sm font-semibold">{k.label}</span>
            {selected && <span className="text-xs">✓</span>}
          </button>
        )
      })}
    </div>
  )
}
