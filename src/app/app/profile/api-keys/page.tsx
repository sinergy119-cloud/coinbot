'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import PinPad from '../../_components/PinPad'
import {
  isPinSet,
  setupPin,
  verifyPin,
  saveKey,
  listKeys,
  deleteKey,
  resetAll,
} from '@/lib/app/key-store'
import { EXCHANGE_LABELS, type Exchange } from '@/types/database'

type Phase =
  | 'loading'
  | 'no_pin'           // 최초 PIN 설정 필요
  | 'confirm_pin'      // 최초 PIN 재입력
  | 'locked'           // 본인 인증 필요
  | 'unlocked'         // 키 목록 표시 + 등록 가능
  | 'adding'           // 키 등록 폼

interface KeySummary {
  id: string
  exchange: Exchange
  label: string
  createdAt: string
}

const EXCHANGES: Exchange[] = ['BITHUMB', 'UPBIT', 'COINONE', 'KORBIT', 'GOPAX']

export default function ApiKeysPage() {
  const [phase, setPhase] = useState<Phase>('loading')
  const [firstPin, setFirstPin] = useState<string>('')
  const [verifiedPin, setVerifiedPin] = useState<string | null>(null)
  const [pinError, setPinError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [keys, setKeys] = useState<KeySummary[]>([])

  useEffect(() => {
    (async () => {
      const has = await isPinSet()
      setPhase(has ? 'locked' : 'no_pin')
    })()
  }, [])

  async function refreshKeys() {
    const list = await listKeys()
    setKeys(list)
  }

  async function handleFirstPin(pin: string) {
    setFirstPin(pin)
    setPinError(null)
    setPhase('confirm_pin')
  }

  async function handleConfirmPin(pin: string) {
    if (pin !== firstPin) {
      setPinError('PIN이 일치하지 않습니다. 다시 입력해주세요.')
      setPhase('no_pin')
      setFirstPin('')
      return
    }
    setSubmitting(true)
    try {
      await setupPin(pin)
      setVerifiedPin(pin)
      await refreshKeys()
      setPhase('unlocked')
    } catch (err) {
      setPinError(err instanceof Error ? err.message : '오류가 발생했습니다.')
      setPhase('no_pin')
      setFirstPin('')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleUnlock(pin: string) {
    setSubmitting(true)
    setPinError(null)
    try {
      const r = await verifyPin(pin)
      if (!r.ok) {
        if (r.reason === 'locked') {
          const min = Math.ceil((r.retryAfterMs ?? 0) / 60000)
          setPinError(`너무 많이 틀렸습니다. ${min}분 후 다시 시도하세요.`)
        } else {
          setPinError('PIN이 틀립니다.')
        }
        return
      }
      setVerifiedPin(pin)
      await refreshKeys()
      setPhase('unlocked')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleResetAll() {
    if (!confirm('정말 모든 API Key와 PIN을 초기화하시겠습니까?\n(분실 시에만 사용 — 되돌릴 수 없음)')) return
    await resetAll()
    setVerifiedPin(null)
    setFirstPin('')
    setPinError(null)
    setKeys([])
    setPhase('no_pin')
  }

  if (phase === 'loading') {
    return <div className="p-8 text-center text-sm text-gray-600">불러오는 중...</div>
  }

  return (
    <div className="flex flex-col">
      <header className="px-4 pt-6 pb-2 break-keep">
        <Link href="/app/profile" className="text-xs text-gray-600 font-semibold">← 내 정보</Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-3">API Key 관리</h1>
        <p className="text-sm text-gray-700 mt-1 leading-relaxed break-keep">
          거래소 API Key는 이 기기에만 저장되며 PIN으로 암호화됩니다.
          서버는 키를 절대 저장하지 않습니다.
        </p>
      </header>

      {phase === 'no_pin' && (
        <PinPad
          title="새 PIN 설정"
          description="6자리 숫자를 입력하세요. 이 PIN은 기기에만 저장되며 분실 시 복구 불가능합니다."
          onSubmit={handleFirstPin}
          submitting={submitting}
        />
      )}

      {phase === 'confirm_pin' && (
        <PinPad
          title="PIN 재확인"
          description="같은 PIN을 한 번 더 입력해주세요."
          errorMessage={pinError}
          onSubmit={handleConfirmPin}
          onCancel={() => { setFirstPin(''); setPhase('no_pin') }}
          submitting={submitting}
        />
      )}

      {phase === 'locked' && (
        <PinPad
          title="PIN 입력"
          description="API Key를 관리하려면 PIN을 입력해주세요."
          errorMessage={pinError}
          onSubmit={handleUnlock}
          submitting={submitting}
        />
      )}

      {phase === 'unlocked' && verifiedPin && (
        <KeysList
          pin={verifiedPin}
          keys={keys}
          onChange={refreshKeys}
          onReset={handleResetAll}
          onAdd={() => setPhase('adding')}
        />
      )}

      {phase === 'adding' && verifiedPin && (
        <AddKeyForm
          pin={verifiedPin}
          onDone={async () => { await refreshKeys(); setPhase('unlocked') }}
          onCancel={() => setPhase('unlocked')}
        />
      )}
    </div>
  )
}

function KeysList({ pin: _pin, keys, onChange, onReset, onAdd }: {
  pin: string
  keys: KeySummary[]
  onChange: () => Promise<void>
  onReset: () => void
  onAdd: () => void
}) {
  void _pin
  async function handleDelete(id: string, label: string) {
    if (!confirm(`"${label}" 키를 삭제하시겠습니까?`)) return
    await deleteKey(id)
    await onChange()
  }

  return (
    <>
      <section className="px-4 py-2">
        <button
          type="button"
          onClick={onAdd}
          className="w-full bg-gray-900 text-white py-3 rounded-2xl font-semibold text-sm active:scale-95 transition-transform"
        >
          + 새 API Key 등록
        </button>
      </section>

      <section className="px-4 flex flex-col gap-2 mt-2">
        {keys.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center text-sm text-gray-600 break-keep">
            등록된 API Key가 없습니다.
          </div>
        ) : (
          keys.map((k) => (
            <div key={k.id} className="bg-white rounded-2xl p-4 flex items-center justify-between break-keep">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-gray-600 font-semibold">{EXCHANGE_LABELS[k.exchange]}</p>
                <p className="text-sm font-semibold text-gray-900 mt-0.5 truncate">{k.label}</p>
                <p className="text-[10px] text-gray-600 mt-1">{k.createdAt.slice(0, 10)} 등록</p>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(k.id, k.label)}
                className="shrink-0 text-xs text-red-600 font-semibold px-3 py-1.5"
              >
                삭제
              </button>
            </div>
          ))
        )}
      </section>

      <section className="px-4 mt-6">
        <button
          type="button"
          onClick={onReset}
          className="w-full text-xs text-gray-600 py-3 underline"
        >
          PIN 분실 — 전체 초기화
        </button>
      </section>
    </>
  )
}

function AddKeyForm({ pin, onDone, onCancel }: { pin: string; onDone: () => void | Promise<void>; onCancel: () => void }) {
  const [exchange, setExchange] = useState<Exchange>('BITHUMB')
  const [label, setLabel] = useState('')
  const [accessKey, setAccessKey] = useState('')
  const [secretKey, setSecretKey] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!label.trim()) return setError('라벨을 입력하세요.')
    if (accessKey.trim().length < 5) return setError('유효한 Access Key를 입력하세요.')
    if (secretKey.trim().length < 5) return setError('유효한 Secret Key를 입력하세요.')
    setSubmitting(true)
    try {
      await saveKey(pin, exchange, label.trim(), accessKey.trim(), secretKey.trim())
      // 평문 변수 즉시 폐기
      setAccessKey('')
      setSecretKey('')
      await onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장 실패')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-4 px-4 py-2">
      <div>
        <label className="text-xs text-gray-700 font-semibold">거래소</label>
        <select
          value={exchange}
          onChange={(e) => setExchange(e.target.value as Exchange)}
          className="w-full mt-1 p-3 bg-white rounded-xl text-sm text-gray-900 font-medium"
        >
          {EXCHANGES.map((ex) => (
            <option key={ex} value={ex}>{EXCHANGE_LABELS[ex]}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-xs text-gray-700 font-semibold">라벨 (메모용)</label>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="예: 내 주계정"
          maxLength={50}
          className="w-full mt-1 p-3 bg-white rounded-xl text-sm text-gray-900 placeholder-gray-400"
        />
      </div>
      <div>
        <label className="text-xs text-gray-700 font-semibold">Access Key</label>
        <input
          type="text"
          value={accessKey}
          onChange={(e) => setAccessKey(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          className="w-full mt-1 p-3 bg-white rounded-xl text-sm text-gray-900 font-mono"
        />
      </div>
      <div>
        <label className="text-xs text-gray-700 font-semibold">Secret Key</label>
        <input
          type="password"
          value={secretKey}
          onChange={(e) => setSecretKey(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          className="w-full mt-1 p-3 bg-white rounded-xl text-sm text-gray-900 font-mono"
        />
      </div>

      <p className="text-[11px] text-gray-600 leading-relaxed break-keep">
        ⚠️ 거래소 API 등록 시 <b>입출금 권한은 반드시 제외</b>해주세요. 매수·매도·조회 권한만 허용됩니다.
      </p>

      {error && <p className="text-xs text-red-600 break-keep">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="flex-1 py-3 bg-white rounded-xl text-sm font-semibold text-gray-700"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="flex-[2] py-3 bg-gray-900 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
        >
          {submitting ? '저장 중...' : '저장'}
        </button>
      </div>
    </form>
  )
}
