'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import PinPad from '../../../_components/PinPad'
import {
  isPinSet,
  setupPin,
  verifyPin,
  saveKey,
  listKeys,
  deleteKey,
  resetAll,
  isBiometricAvailable,
  isBiometricRegistered,
  registerBiometric,
  authenticateWithBiometric,
  removeBiometric,
} from '@/lib/app/key-store'
import { EXCHANGE_LABELS, type Exchange } from '@/types/database'
import { SignupGuideModal, ApiKeyGuideModal } from '@/components/GuideModals'
import ExchangeIcon from '@/components/ExchangeIcon'

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

// 거래소별 뱃지 색상
const EXCHANGE_BADGE: Record<string, { bg: string; text: string }> = {
  BITHUMB: { bg: '#FFF0E6', text: '#C94B00' },
  UPBIT:   { bg: '#E6F0FF', text: '#0050CC' },
  COINONE: { bg: '#E6F9EE', text: '#007A30' },
  KORBIT:  { bg: '#F3EEFF', text: '#5B21B6' },
  GOPAX:   { bg: '#FFFBE6', text: '#946200' },
}

// ── 지문 아이콘 ──────────────────────────────────────────────
function FingerprintIcon({ size = 40, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
    >
      <path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4" />
      <path d="M14 13.12c0 2.38 0 6.38-1 8.88" />
      <path d="M17.29 21.02c.12-.6.43-2.3.5-3.02" />
      <path d="M2 12a10 10 0 0 1 18-6" />
      <path d="M2 16h.01" />
      <path d="M21.8 16c.2-2 .131-5.354 0-6" />
      <path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2" />
      <path d="M8.65 22c.21-.66.45-1.32.57-2" />
      <path d="M9 6.8a6 6 0 0 1 9 5.2v2" />
    </svg>
  )
}

// ── 생체 인증 잠금 해제 화면 ────────────────────────────────
function BiometricUnlockScreen({
  onSuccess, onUsePinInstead, submitting,
}: {
  onSuccess: (pin: string) => Promise<void>
  onUsePinInstead: () => void
  submitting: boolean
}) {
  const [trying, setTrying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [failCount, setFailCount] = useState(0)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    ;(async () => {
      try {
        const pin = await authenticateWithBiometric()
        if (mountedRef.current) await onSuccess(pin)
      } catch { /* 자동 시도 실패는 조용히 무시 */ }
    })()
    return () => { mountedRef.current = false }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleTap() {
    if (trying || submitting) return
    setTrying(true)
    setError(null)
    try {
      const pin = await authenticateWithBiometric()
      await onSuccess(pin)
    } catch {
      const next = failCount + 1
      setFailCount(next)
      if (next >= 3) { onUsePinInstead(); return }
      setError('인증에 실패했습니다. 다시 시도해주세요.')
    } finally {
      if (mountedRef.current) setTrying(false)
    }
  }

  return (
    <div className="flex flex-col items-center px-4 py-10 gap-6 break-keep">
      <div className="text-center">
        <h2 className="text-[18px] font-bold" style={{ color: '#191F28' }}>지문 인증</h2>
        <p className="text-[14px] mt-1" style={{ color: '#6B7684' }}>지문을 인식하여 잠금을 해제하세요</p>
      </div>

      <button
        type="button"
        onClick={handleTap}
        disabled={trying || submitting}
        className="w-24 h-24 rounded-full flex items-center justify-center active:scale-95 transition-transform disabled:opacity-60"
        style={{ background: '#0064FF', boxShadow: '0 8px 24px rgba(0,100,255,0.35)' }}
      >
        {trying ? (
          <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <FingerprintIcon size={44} color="white" />
        )}
      </button>

      {error && (
        <p className="text-[13px] text-center break-keep" style={{ color: '#FF4D4F' }}>{error}</p>
      )}

      <button
        type="button"
        onClick={onUsePinInstead}
        disabled={submitting}
        className="text-[13px] font-semibold"
        style={{ color: '#6B7684' }}
      >
        PIN으로 인증하기
      </button>
    </div>
  )
}

// ── 생체 인증 등록 권유 모달 (PIN 설정 직후) ─────────────────
function BiometricSetupModal({ pin, onDone }: { pin: string; onDone: (registered: boolean) => void }) {
  const [registering, setRegistering] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleRegister() {
    setRegistering(true)
    setError(null)
    try {
      await registerBiometric(pin)
      onDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : '등록에 실패했습니다.')
      setRegistering(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.55)' }}
    >
      <div className="w-full max-w-sm bg-white rounded-t-3xl px-5 pt-6 pb-10 shadow-2xl">
        <div className="flex flex-col items-center mb-5">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mb-3"
            style={{ background: '#0064FF', boxShadow: '0 8px 24px rgba(0,100,255,0.35)' }}
          >
            <FingerprintIcon size={40} color="white" />
          </div>
          <h2 className="text-[18px] font-bold" style={{ color: '#191F28' }}>지문 인증 등록</h2>
          <p className="text-[13px] mt-1 text-center break-keep" style={{ color: '#6B7684' }}>
            다음부터 지문만으로 빠르게 잠금을 해제할 수 있습니다
          </p>
        </div>

        {error && (
          <p className="text-[12px] text-center mb-4 break-keep" style={{ color: '#FF4D4F' }}>{error}</p>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => onDone(false)}
            disabled={registering}
            className="flex-1 py-4 rounded-2xl text-[14px] font-semibold"
            style={{ background: '#F2F4F6', color: '#6B7684' }}
          >
            나중에
          </button>
          <button
            type="button"
            onClick={handleRegister}
            disabled={registering}
            className="flex-[2] py-4 rounded-2xl text-[15px] font-semibold disabled:opacity-50"
            style={{ background: '#0064FF', color: '#fff' }}
          >
            {registering ? '등록 중...' : '지문 등록하기'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 메인 컴포넌트 ────────────────────────────────────────────
export default function ApiKeysPage() {
  const [phase, setPhase] = useState<Phase>('loading')
  const [firstPin, setFirstPin] = useState<string>('')
  const [verifiedPin, setVerifiedPin] = useState<string | null>(null)
  const [pinError, setPinError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [keys, setKeys] = useState<KeySummary[]>([])
  const [showResetModal, setShowResetModal] = useState(false)
  const [resetConfirmText, setResetConfirmText] = useState('')
  const [bioAvailable, setBioAvailable] = useState(false)
  const [bioRegistered, setBioRegistered] = useState(false)
  const [showBioSetup, setShowBioSetup] = useState(false)
  const [usePinInstead, setUsePinInstead] = useState(false)

  useEffect(() => {
    (async () => {
      const [has, bioAvail] = await Promise.all([isPinSet(), isBiometricAvailable()])
      const bioReg = has ? await isBiometricRegistered() : false
      setBioAvailable(bioAvail)
      setBioRegistered(bioReg)
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
      if (bioAvailable) setShowBioSetup(true)
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

  async function handleBiometricSuccess(pin: string) {
    setSubmitting(true)
    try {
      const r = await verifyPin(pin)
      if (!r.ok) { setUsePinInstead(true); return }
      setVerifiedPin(pin)
      await refreshKeys()
      setPhase('unlocked')
    } finally {
      setSubmitting(false)
    }
  }

  async function doResetAll() {
    await resetAll()
    setShowResetModal(false)
    setResetConfirmText('')
    setVerifiedPin(null)
    setFirstPin('')
    setPinError(null)
    setKeys([])
    setBioRegistered(false)
    setUsePinInstead(false)
    setPhase('no_pin')
  }

  if (phase === 'loading') {
    return (
      <div className="p-8 text-center text-[14px] break-keep" style={{ color: '#6B7684' }}>
        불러오는 중...
      </div>
    )
  }

  const showBioUnlock = phase === 'locked' && bioRegistered && !usePinInstead

  return (
    <div className="flex flex-col gap-0 pb-6" style={{ background: '#F9FAFB', minHeight: '100%' }}>

      {/* 헤더 */}
      <header className="px-4 pt-6 pb-4 break-keep">
        <Link
          href="/app/profile"
          className="inline-flex items-center gap-1 text-[13px] font-semibold"
          style={{ color: '#6B7684' }}
        >
          ← 내 정보
        </Link>
        <h1 className="text-[22px] font-bold mt-3" style={{ color: '#191F28' }}>API Key 관리</h1>
        <p className="text-[13px] mt-1 leading-relaxed" style={{ color: '#6B7684' }}>
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

      {showBioUnlock && (
        <BiometricUnlockScreen
          onSuccess={handleBiometricSuccess}
          onUsePinInstead={() => setUsePinInstead(true)}
          submitting={submitting}
        />
      )}

      {phase === 'locked' && !showBioUnlock && (
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
          bioAvailable={bioAvailable}
          bioRegistered={bioRegistered}
          onBioRegistered={() => setBioRegistered(true)}
          onBioRemoved={() => setBioRegistered(false)}
          onChange={refreshKeys}
          onReset={() => { setResetConfirmText(''); setShowResetModal(true) }}
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

      {showBioSetup && verifiedPin && (
        <BiometricSetupModal
          pin={verifiedPin}
          onDone={(registered) => {
            if (registered) setBioRegistered(true)
            setShowBioSetup(false)
          }}
        />
      )}

      {showResetModal && (
        <ResetConfirmModal
          confirmText={resetConfirmText}
          onChangeText={setResetConfirmText}
          onCancel={() => { setShowResetModal(false); setResetConfirmText('') }}
          onConfirm={doResetAll}
        />
      )}
    </div>
  )
}

// ── 키 목록 ──────────────────────────────────────────────────
function KeysList({ pin: _pin, keys, bioAvailable, bioRegistered, onBioRegistered, onBioRemoved, onChange, onReset, onAdd }: {
  pin: string
  keys: KeySummary[]
  bioAvailable: boolean
  bioRegistered: boolean
  onBioRegistered: () => void
  onBioRemoved: () => void
  onChange: () => Promise<void>
  onReset: () => void
  onAdd: () => void
}) {
  void _pin
  const [bioSubmitting, setBioSubmitting] = useState(false)

  async function handleDelete(id: string, label: string, exchange: string) {
    if (!confirm(`"${label}" 키를 삭제하시겠습니까?`)) return
    await deleteKey(id)
    // 보안 알림 발송 (다른 기기 포함 본인 모든 디바이스로 system 카테고리 푸시)
    fetch('/api/app/notify/key-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', exchange, label }),
    }).catch(() => { /* 알림 실패는 삭제 성공에 영향 없음 */ })
    await onChange()
  }

  async function handleToggleBio() {
    if (bioRegistered) {
      if (!confirm('지문 인증을 해제하시겠습니까?')) return
      await removeBiometric()
      onBioRemoved()
    } else {
      setBioSubmitting(true)
      try {
        await registerBiometric(_pin)
        onBioRegistered()
      } catch (err) {
        alert(err instanceof Error ? err.message : '지문 등록에 실패했습니다.')
      } finally {
        setBioSubmitting(false)
      }
    }
  }

  return (
    <div className="flex flex-col gap-4 px-4">
      {/* 키 추가 버튼 */}
      <button
        type="button"
        onClick={onAdd}
        className="w-full py-4 rounded-2xl text-[15px] font-semibold"
        style={{ background: '#0064FF', color: '#fff' }}
      >
        + 새 API Key 등록
      </button>

      {/* 생체 인증 */}
      {bioAvailable && (
        <div>
          <p className="text-[13px] font-semibold mb-2 px-1" style={{ color: '#6B7684' }}>보안</p>
          <div
            className="rounded-2xl"
            style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
          >
            <div className="flex items-center justify-between px-4 py-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: bioRegistered ? '#0064FF' : '#F2F4F6' }}
                >
                  <FingerprintIcon size={18} color={bioRegistered ? 'white' : '#B0B8C1'} />
                </div>
                <div className="break-keep">
                  <p className="text-[14px] font-semibold" style={{ color: '#191F28' }}>지문 인증</p>
                  <p className="text-[12px] mt-0.5" style={{ color: '#6B7684' }}>
                    {bioRegistered ? '등록됨 — 잠금 해제 시 지문 사용' : 'PIN 대신 지문으로 잠금 해제'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={bioSubmitting}
                onClick={handleToggleBio}
                className="shrink-0 w-12 h-7 rounded-full transition-colors duration-200 disabled:opacity-50"
                style={{ background: bioRegistered ? '#0064FF' : '#E5E8EB' }}
              >
                <span
                  className="block w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform duration-200"
                  style={{ transform: bioRegistered ? 'translateX(22px)' : 'translateX(4px)' }}
                />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 키 목록 */}
      <div>
        <p className="text-[13px] font-semibold mb-2 px-1" style={{ color: '#6B7684' }}>
          등록된 API Key {keys.length > 0 ? `(${keys.length}개)` : ''}
        </p>
        {keys.length === 0 ? (
          <div
            className="rounded-2xl p-6 text-center text-[14px] break-keep"
            style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', color: '#6B7684' }}
          >
            등록된 API Key가 없습니다.
          </div>
        ) : (
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
          >
            {keys.map((k, idx, arr) => {
              const badge = EXCHANGE_BADGE[k.exchange] ?? { bg: '#F2F4F6', text: '#6B7684' }
              return (
                <div
                  key={k.id}
                  className="flex items-center justify-between px-4 py-4 break-keep"
                  style={idx < arr.length - 1 ? { borderBottom: '1px solid #F2F4F6' } : undefined}
                >
                  <div className="min-w-0 flex-1">
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1"
                      style={{ background: badge.bg, color: badge.text }}
                    >
                      <ExchangeIcon exchange={k.exchange} size={13} />
                      {EXCHANGE_LABELS[k.exchange]}
                    </span>
                    <p className="text-[14px] font-semibold mt-1.5 truncate" style={{ color: '#191F28' }}>
                      {k.label}
                    </p>
                    <p className="text-[11px] mt-0.5" style={{ color: '#B0B8C1' }}>
                      {k.createdAt.slice(0, 10)} 등록
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(k.id, k.label, k.exchange)}
                    className="shrink-0 ml-3 text-[12px] font-semibold px-3 py-1.5 rounded-lg"
                    style={{ color: '#FF4D4F', background: '#FFF0F0' }}
                  >
                    삭제
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 초기화 */}
      <div className="text-center pb-2">
        <button
          type="button"
          onClick={onReset}
          className="text-[12px]"
          style={{ color: '#B0B8C1' }}
        >
          PIN 분실 — 전체 초기화
        </button>
      </div>
    </div>
  )
}

// ── 초기화 확인 모달 ─────────────────────────────────────────
const RESET_CONFIRM_WORD = '전체 초기화'

function ResetConfirmModal({ confirmText, onChangeText, onCancel, onConfirm }: {
  confirmText: string
  onChangeText: (v: string) => void
  onCancel: () => void
  onConfirm: () => void
}) {
  const matched = confirmText === RESET_CONFIRM_WORD
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 120)
    return () => clearTimeout(t)
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="w-full max-w-sm bg-white rounded-t-3xl px-5 pt-6 pb-10 shadow-2xl">
        <div className="flex flex-col items-center mb-5">
          <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mb-3">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              />
            </svg>
          </div>
          <h2 className="text-[18px] font-bold" style={{ color: '#191F28' }}>전체 초기화</h2>
          <p className="text-[12px] mt-0.5" style={{ color: '#6B7684' }}>PIN 분실 시에만 사용하세요</p>
        </div>

        <div
          className="rounded-2xl p-4 mb-5"
          style={{ background: '#FFF5F5', border: '1px solid #FFCDD2' }}
        >
          <ul className="space-y-2">
            {[
              <>등록된 <strong>모든 API Key</strong>가 삭제됩니다.</>,
              <><strong>PIN 및 지문 인증</strong>이 초기화됩니다.</>,
              <strong>이 작업은 되돌릴 수 없습니다.</strong>,
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-[13px] break-keep" style={{ color: '#DC2626' }}>
                <span className="shrink-0 mt-0.5">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mb-5">
          <p className="text-[13px] mb-2 break-keep" style={{ color: '#6B7684' }}>
            계속하려면 아래에{' '}
            <strong style={{ color: '#191F28' }}>&ldquo;전체 초기화&rdquo;</strong>를 입력하세요.
          </p>
          <input
            ref={inputRef}
            type="text"
            value={confirmText}
            onChange={(e) => onChangeText(e.target.value)}
            placeholder="전체 초기화"
            className="w-full rounded-2xl px-4 py-3.5 text-[14px] font-medium outline-none transition-colors"
            style={{
              border: `2px solid ${matched ? '#FF4D4F' : '#E5E8EB'}`,
              color: '#191F28',
            }}
          />
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-4 rounded-2xl text-[14px] font-semibold"
            style={{ background: '#F2F4F6', color: '#6B7684' }}
          >
            취소
          </button>
          <button
            type="button"
            disabled={!matched}
            onClick={onConfirm}
            className="flex-1 py-4 rounded-2xl text-[14px] font-semibold disabled:opacity-40"
            style={{ background: '#FF4D4F', color: '#fff' }}
          >
            초기화 진행
          </button>
        </div>
      </div>
    </div>
  )
}

// ── API Key 등록 폼 ──────────────────────────────────────────
function AddKeyForm({ pin, onDone, onCancel }: { pin: string; onDone: () => void | Promise<void>; onCancel: () => void }) {
  const [exchange, setExchange] = useState<Exchange>('BITHUMB')
  const [label, setLabel] = useState('')
  const [accessKey, setAccessKey] = useState('')
  const [secretKey, setSecretKey] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [guideOpen, setGuideOpen] = useState(false)
  const [guideModal, setGuideModal] = useState<'signup' | 'apikey' | null>(null)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!label.trim()) return setError('라벨을 입력하세요.')
    if (accessKey.trim().length < 5) return setError('유효한 Access Key를 입력하세요.')
    if (secretKey.trim().length < 5) return setError('유효한 Secret Key를 입력하세요.')
    setSubmitting(true)
    try {
      await saveKey(pin, exchange, label.trim(), accessKey.trim(), secretKey.trim())
      // 보안 알림 발송 (system 카테고리 — 다른 기기 포함 본인 모든 디바이스에 알림)
      fetch('/api/app/notify/key-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', exchange, label: label.trim() }),
      }).catch(() => { /* 알림 실패는 저장 성공에 영향 없음 */ })
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
    <form
      onSubmit={handleSave}
      className="flex flex-col gap-5 px-4 py-2"
      style={{ background: '#F9FAFB' }}
    >
      {/* 처음 등록 가이드 */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
      >
        <button
          type="button"
          onClick={() => setGuideOpen((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3.5"
        >
          <span className="text-[13px] font-semibold" style={{ color: '#191F28' }}>📌 처음 등록하시나요?</span>
          <span className="text-[12px]" style={{ color: '#B0B8C1' }}>{guideOpen ? '접기 ▲' : '펼치기 ▼'}</span>
        </button>
        {guideOpen && (
          <div
            className="px-3 pb-3 flex flex-col gap-2"
            style={{ borderTop: '1px solid #F2F4F6' }}
          >
            <button
              type="button"
              onClick={() => setGuideModal('signup')}
              className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-left"
              style={{ background: '#E6F9EE', border: '1px solid #C8F0D8' }}
            >
              <span className="text-[18px]">🏦</span>
              <div>
                <p className="text-[13px] font-semibold" style={{ color: '#007A30' }}>거래소 가입</p>
                <p className="text-[11px] break-keep" style={{ color: '#007A30' }}>친구 추천 가입 링크 확인</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setGuideModal('apikey')}
              className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-left"
              style={{ background: '#FFFBE6', border: '1px solid #FFF0A8' }}
            >
              <span className="text-[18px]">🔑</span>
              <div>
                <p className="text-[13px] font-semibold" style={{ color: '#946200' }}>API Key 발급 가이드</p>
                <p className="text-[11px] break-keep" style={{ color: '#946200' }}>거래소별 발급 방법 확인</p>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* 거래소 */}
      <div>
        <p className="text-[13px] font-semibold mb-2" style={{ color: '#6B7684' }}>거래소</p>
        <div
          className="rounded-2xl"
          style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
        >
          <select
            value={exchange}
            onChange={(e) => setExchange(e.target.value as Exchange)}
            className="w-full px-4 py-3.5 rounded-2xl text-[15px] font-semibold bg-transparent outline-none appearance-none"
            style={{ color: '#191F28' }}
          >
            {EXCHANGES.map((ex) => (
              <option key={ex} value={ex}>{EXCHANGE_LABELS[ex]}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 라벨 */}
      <div>
        <p className="text-[13px] font-semibold mb-2" style={{ color: '#6B7684' }}>라벨 (메모용)</p>
        <div
          className="rounded-2xl"
          style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
        >
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="예: 내 주계정"
            maxLength={50}
            className="w-full px-4 py-3.5 rounded-2xl text-[15px] font-semibold bg-transparent outline-none placeholder-gray-400"
            style={{ color: '#191F28' }}
          />
        </div>
      </div>

      {/* Access Key */}
      <div>
        <p className="text-[13px] font-semibold mb-2" style={{ color: '#6B7684' }}>Access Key</p>
        <div
          className="rounded-2xl"
          style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
        >
          <input
            type="text"
            value={accessKey}
            onChange={(e) => setAccessKey(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            className="w-full px-4 py-3.5 rounded-2xl text-[14px] font-mono bg-transparent outline-none"
            style={{ color: '#191F28' }}
          />
        </div>
      </div>

      {/* Secret Key */}
      <div>
        <p className="text-[13px] font-semibold mb-2" style={{ color: '#6B7684' }}>Secret Key</p>
        <div
          className="rounded-2xl"
          style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
        >
          <input
            type="password"
            value={secretKey}
            onChange={(e) => setSecretKey(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            className="w-full px-4 py-3.5 rounded-2xl text-[14px] font-mono bg-transparent outline-none"
            style={{ color: '#191F28' }}
          />
        </div>
      </div>

      {/* 주의 문구 */}
      <p className="text-[12px] leading-relaxed break-keep px-1" style={{ color: '#6B7684' }}>
        ⚠️ 거래소 API 등록 시 <strong style={{ color: '#191F28' }}>입출금 권한은 반드시 제외</strong>해주세요.
        매수·매도·조회 권한만 허용됩니다.
      </p>

      {error && (
        <p className="text-[13px] break-keep" style={{ color: '#FF4D4F' }}>{error}</p>
      )}

      <div className="flex gap-3 pb-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="flex-1 py-4 rounded-2xl text-[14px] font-semibold"
          style={{ background: '#fff', color: '#6B7684', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
        >
          취소
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="flex-[2] py-4 rounded-2xl text-[15px] font-semibold disabled:opacity-50"
          style={{ background: '#0064FF', color: '#fff' }}
        >
          {submitting ? '저장 중...' : '저장'}
        </button>
      </div>

      {guideModal === 'signup' && <SignupGuideModal onClose={() => setGuideModal(null)} />}
      {guideModal === 'apikey' && <ApiKeyGuideModal onClose={() => setGuideModal(null)} />}
    </form>
  )
}
