'use client'

import { useEffect, useState } from 'react'

interface Props {
  length?: number              // 기본 6자리
  title?: string
  description?: string
  errorMessage?: string | null
  onSubmit: (pin: string) => void | Promise<void>
  onCancel?: () => void
  submitting?: boolean
}

export default function PinPad({
  length = 6,
  title = 'PIN 입력',
  description,
  errorMessage,
  onSubmit,
  onCancel,
  submitting = false,
}: Props) {
  const [pin, setPin] = useState('')
  const [shake, setShake] = useState(false)

  useEffect(() => {
    if (errorMessage) {
      setShake(true)
      const t = setTimeout(() => {
        setShake(false)
        setPin('')
      }, 500)
      return () => clearTimeout(t)
    }
  }, [errorMessage])

  const append = (d: string) => {
    if (pin.length >= length || submitting) return
    const next = pin + d
    setPin(next)
    if (next.length === length) {
      // 약간 지연 — UI 업데이트 후 제출
      setTimeout(() => onSubmit(next), 100)
    }
  }
  const backspace = () => {
    if (submitting) return
    setPin((p) => p.slice(0, -1))
  }

  return (
    <div className="flex flex-col items-center px-4 py-6 break-keep">
      <h2 className="text-lg font-bold text-gray-900 text-center">{title}</h2>
      {description && <p className="text-sm text-gray-700 mt-1 text-center">{description}</p>}

      {/* PIN 도트 표시 */}
      <div className={`flex gap-3 mt-6 ${shake ? 'animate-shake' : ''}`}>
        {Array.from({ length }).map((_, i) => (
          <span
            key={i}
            className={`w-3.5 h-3.5 rounded-full ${i < pin.length ? 'bg-gray-900' : 'bg-gray-300'}`}
          />
        ))}
      </div>

      {errorMessage && (
        <p className="text-xs text-red-600 mt-3 text-center break-keep">{errorMessage}</p>
      )}

      {/* 숫자 키패드 */}
      <div className="grid grid-cols-3 gap-3 mt-8 w-full max-w-xs">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => append(d)}
            disabled={submitting}
            className="py-4 rounded-2xl bg-white text-2xl font-semibold text-gray-900 active:bg-gray-100 disabled:opacity-50"
          >
            {d}
          </button>
        ))}
        <div />
        <button
          type="button"
          onClick={() => append('0')}
          disabled={submitting}
          className="py-4 rounded-2xl bg-white text-2xl font-semibold text-gray-900 active:bg-gray-100 disabled:opacity-50"
        >
          0
        </button>
        <button
          type="button"
          onClick={backspace}
          disabled={submitting || pin.length === 0}
          className="py-4 rounded-2xl bg-transparent text-xl font-semibold text-gray-700 active:bg-gray-100 disabled:opacity-30"
        >
          ⌫
        </button>
      </div>

      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="mt-6 text-sm text-gray-600 font-semibold underline"
        >
          취소
        </button>
      )}

      <style jsx>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-6px); }
          40%, 80% { transform: translateX(6px); }
        }
        .animate-shake {
          animation: shake 0.4s ease-in-out;
        }
      `}</style>
    </div>
  )
}
