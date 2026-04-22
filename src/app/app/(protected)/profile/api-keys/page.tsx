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
} from '@/lib/app/key-store'
import { EXCHANGE_LABELS, type Exchange } from '@/types/database'
import ExchangeApiGuide from '@/components/ExchangeApiGuide'
import { X, Copy, Check } from 'lucide-react'

const SERVER_IP = '43.203.100.239'

// ── IP 복사 버튼 (가이드 모달용) ──────────────────────────────
function IpCopyBtn() {
  const [copied, setCopied] = useState(false)
  async function handleCopy() {
    try { await navigator.clipboard.writeText(SERVER_IP) } catch {
      const el = document.createElement('textarea'); el.value = SERVER_IP
      document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el)
    }
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={handleCopy} type="button"
      className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition shrink-0 ${copied ? 'bg-green-500 text-white' : 'bg-amber-500 text-white hover:bg-amber-600'}`}>
      {copied ? <><Check size={12} /> 복사됨</> : <><Copy size={12} /> IP 복사</>}
    </button>
  )
}

// ── 거래소 가입 가이드 모달 ─────────────────────────────────
const SIGNUP_EXCHANGES = [
  { key: 'BITHUMB', name: '빗썸', emoji: '🟠', color: '#E06B00', bank: '국민은행',
    url: 'https://m.bithumb.com/react/referral/guide?referral=XRFYNXZA48', code: 'XRFYNXZA48' },
  { key: 'UPBIT', name: '업비트', emoji: '🔵', color: '#0D2562', bank: '케이뱅크', url: null, code: null },
  { key: 'COINONE', name: '코인원', emoji: '🟢', color: '#0046FF', bank: '카카오뱅크',
    url: 'https://coinone.co.kr/user/signup?ref=I6T0K0RB', code: 'I6T0K0RB' },
  { key: 'KORBIT', name: '코빗', emoji: '🟣', color: '#111111', bank: '신한은행',
    url: 'https://exchange.korbit.co.kr/sign-up/?referral_code=624912', code: '624912' },
  { key: 'GOPAX', name: '고팍스', emoji: '🟡', color: '#F5A623', bank: '전북은행',
    url: 'https://gopax.onelink.me/Vs7Z/wvekgu0d', code: 'C5Y944' },
]

function SignupGuideModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-2xl">
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-gray-900">거래소 가입 가이드</h2>
            <p className="mt-0.5 text-xs text-gray-600 break-keep">추천 링크로 가입하면 가입자·추천인 모두 혜택이 있어요</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100"><X size={18} /></button>
        </div>
        {/* 스크롤 영역 */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {/* 안내 */}
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 space-y-1.5">
            <p className="text-xs font-semibold text-amber-800">📋 가입 전 알아두세요</p>
            <p className="text-xs text-amber-700 break-keep">• 거래소는 본인 명의 은행 계좌 연계가 필요합니다. 아래 연계 은행을 확인하세요.</p>
            <p className="text-xs text-amber-700 break-keep">• 이벤트 혜택을 받으려면 마케팅 수신 동의가 필요합니다.</p>
          </div>
          {/* 거래소 카드 */}
          {SIGNUP_EXCHANGES.map((ex) => (
            <div key={ex.key} className="rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center gap-2.5 px-4 py-2.5" style={{ backgroundColor: ex.color + '12' }}>
                <span>{ex.emoji}</span>
                <span className="text-sm font-bold" style={{ color: ex.color }}>{ex.name}</span>
                <span className="ml-auto flex items-center gap-1 text-xs text-gray-600">
                  <span>🏦</span>{ex.bank}
                </span>
              </div>
              {ex.url ? (
                <a href={ex.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition">
                  <div>
                    <p className="text-sm font-semibold text-blue-600">가입 추천 링크로 이동 ↗</p>
                    <p className="mt-0.5 text-xs text-gray-500">추천코드: <span className="font-mono font-bold text-gray-700">{ex.code}</span></p>
                  </div>
                  <span className="text-gray-400">›</span>
                </a>
              ) : (
                <div className="px-4 py-3">
                  <p className="text-xs text-gray-500">현재 추천 링크 없음 (직접 가입)</p>
                </div>
              )}
            </div>
          ))}
        </div>
        {/* 하단 버튼 */}
        <div className="border-t px-5 py-4">
          <button onClick={onClose} className="w-full rounded-xl bg-gray-900 py-3 text-sm font-semibold text-white">닫기</button>
        </div>
      </div>
    </div>
  )
}

// ── API Key 발급 가이드 모달 ────────────────────────────────
function ApiKeyGuideModal({ onClose, onOpenExchangeGuide }: { onClose: () => void; onOpenExchangeGuide: (key: string) => void }) {
  const exchanges = [
    { key: 'BITHUMB', label: '빗썸', emoji: '🟠', color: '#E06B00' },
    { key: 'UPBIT',   label: '업비트', emoji: '🔵', color: '#0D2562' },
    { key: 'COINONE', label: '코인원', emoji: '🟢', color: '#0046FF' },
    { key: 'KORBIT',  label: '코빗', emoji: '🟣', color: '#555555' },
    { key: 'GOPAX',   label: '고팍스', emoji: '🟡', color: '#D97706' },
  ]
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-2xl">
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-gray-900">API Key 발급 가이드</h2>
            <p className="mt-0.5 text-xs text-gray-600">거래소 API Key 발급 방법을 안내합니다</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100"><X size={18} /></button>
        </div>
        {/* 스크롤 영역 */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* API Key란? */}
          <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-3.5 space-y-1.5">
            <p className="text-sm font-bold text-blue-800">💡 API Key란?</p>
            <p className="text-xs text-blue-700 leading-relaxed break-keep">
              거래소에서 발급하는 <strong>인증 키</strong>로, MyCoinBot이 내 계정을 대신해 코인을 자동 매수할 수 있게 해줍니다.
            </p>
            <p className="text-xs text-blue-700 break-keep">
              아이디·비밀번호 없이도 거래소 기능을 안전하게 사용할 수 있어요.
            </p>
          </div>

          {/* 공통 주의사항 */}
          <div>
            <p className="mb-2.5 text-sm font-bold text-gray-900">🚨 공통 주의사항</p>
            <div className="space-y-2">
              {/* PC 전용 */}
              <div className="flex items-start gap-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
                <span className="text-base shrink-0">🖥️</span>
                <div>
                  <p className="text-xs font-bold text-red-700">PC 웹에서만 발급 가능</p>
                  <p className="text-xs text-red-600">모바일 앱에서는 발급 불가합니다</p>
                </div>
              </div>
              {/* IP 등록 */}
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-amber-800">⚠️ IP 주소 등록 필수</p>
                    <p className="mt-0.5 font-mono text-sm font-bold text-amber-900">{SERVER_IP}</p>
                  </div>
                  <IpCopyBtn />
                </div>
                <p className="text-xs text-amber-700 break-keep">API Key 발급 시 위 IP를 허용 IP로 등록해야 거래 실행이 가능합니다</p>
              </div>
              {/* 입출금 권한 */}
              <div className="flex items-start gap-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
                <span className="text-base shrink-0">🚫</span>
                <div>
                  <p className="text-xs font-bold text-red-700">입출금 권한은 OFF 필수</p>
                  <p className="text-xs text-red-600 break-keep">API Key 유출 시 자산 출금을 막기 위해 입출금 권한은 절대 부여하지 마세요</p>
                </div>
              </div>
            </div>
          </div>

          {/* 거래소별 상세 가이드 */}
          <div>
            <p className="mb-2.5 text-sm font-bold text-gray-900">📖 거래소별 상세 발급 가이드</p>
            <div className="grid grid-cols-5 gap-2">
              {exchanges.map((ex) => (
                <button key={ex.key} type="button"
                  onClick={() => onOpenExchangeGuide(ex.key)}
                  className="flex flex-col items-center gap-1 rounded-xl py-3 text-xs font-bold text-white transition hover:opacity-90 active:scale-95"
                  style={{ backgroundColor: ex.color }}>
                  <span className="text-lg">{ex.emoji}</span>
                  {ex.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        {/* 하단 버튼 */}
        <div className="border-t px-5 py-4">
          <button onClick={onClose} className="w-full rounded-xl bg-gray-900 py-3 text-sm font-semibold text-white">닫기</button>
        </div>
      </div>
    </div>
  )
}

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
  const [showResetModal, setShowResetModal] = useState(false)
  const [resetConfirmText, setResetConfirmText] = useState('')

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

  function handleResetAll() {
    setResetConfirmText('')
    setShowResetModal(true)
  }

  async function doResetAll() {
    await resetAll()
    setShowResetModal(false)
    setResetConfirmText('')
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
    // 모달 열릴 때 키보드 자동 포커스
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

        {/* 경고 아이콘 + 제목 */}
        <div className="flex flex-col items-center mb-5">
          <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mb-3">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-gray-900">전체 초기화</h2>
          <p className="text-xs text-gray-600 mt-0.5">PIN 분실 시에만 사용하세요</p>
        </div>

        {/* 경고 내용 */}
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-5">
          <ul className="space-y-1.5">
            <li className="flex items-start gap-2 text-sm text-red-700">
              <span className="mt-0.5 text-red-500 shrink-0">•</span>
              <span className="break-keep">등록된 <strong>모든 API Key</strong>가 삭제됩니다.</span>
            </li>
            <li className="flex items-start gap-2 text-sm text-red-700">
              <span className="mt-0.5 text-red-500 shrink-0">•</span>
              <span className="break-keep"><strong>PIN</strong>이 초기화되어 재설정이 필요합니다.</span>
            </li>
            <li className="flex items-start gap-2 text-sm text-red-700">
              <span className="mt-0.5 text-red-500 shrink-0">•</span>
              <span className="break-keep font-semibold">이 작업은 되돌릴 수 없습니다.</span>
            </li>
          </ul>
        </div>

        {/* 인증 텍스트 입력 */}
        <div className="mb-5">
          <p className="text-sm text-gray-700 mb-2 break-keep">
            계속하려면 아래에 <strong className="text-gray-900">&ldquo;전체 초기화&rdquo;</strong>를 입력하세요.
          </p>
          <input
            ref={inputRef}
            type="text"
            value={confirmText}
            onChange={(e) => onChangeText(e.target.value)}
            placeholder="전체 초기화"
            className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-900 placeholder-gray-400 focus:outline-none focus:border-red-400 transition-colors"
          />
        </div>

        {/* 버튼 */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3.5 rounded-2xl border border-gray-200 text-sm font-semibold text-gray-700 bg-white active:scale-95 transition-transform"
          >
            취소
          </button>
          <button
            type="button"
            disabled={!matched}
            onClick={onConfirm}
            className="flex-1 py-3.5 rounded-2xl text-sm font-semibold text-white active:scale-95 transition-all"
            style={{ background: matched ? '#DC2626' : '#d1d5db', cursor: matched ? 'pointer' : 'not-allowed' }}
          >
            초기화 진행
          </button>
        </div>
      </div>
    </div>
  )
}

function AddKeyForm({ pin, onDone, onCancel }: { pin: string; onDone: () => void | Promise<void>; onCancel: () => void }) {
  const [exchange, setExchange] = useState<Exchange>('BITHUMB')
  const [label, setLabel] = useState('')
  const [accessKey, setAccessKey] = useState('')
  const [secretKey, setSecretKey] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [guideOpen, setGuideOpen] = useState(false)
  const [guideModal, setGuideModal] = useState<'signup' | 'apikey' | 'apikey-detail' | null>(null)
  const [guideExchange, setGuideExchange] = useState('BITHUMB')

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

      {/* 거래소 가입 / API Key 가이드 */}
      <div className="rounded-xl border border-gray-200 bg-gray-50 overflow-hidden">
        <button
          type="button"
          onClick={() => setGuideOpen((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-2.5 text-xs font-semibold text-gray-700"
        >
          <span>📌 처음 등록하시나요?</span>
          <span className="text-gray-500">{guideOpen ? '접기 ▲' : '펼치기 ▼'}</span>
        </button>
        {guideOpen && (
          <div className="border-t border-gray-200 px-3 py-3 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setGuideModal('signup')}
              className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-medium text-green-700 text-left"
            >
              <span>🏦</span>
              <div>
                <p className="font-semibold">거래소 가입</p>
                <p className="font-normal text-green-600 break-keep">친구 추천 가입 링크 확인</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setGuideModal('apikey')}
              className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 text-left"
            >
              <span>🔑</span>
              <div>
                <p className="font-semibold">API Key 발급 가이드</p>
                <p className="font-normal text-amber-600 break-keep">거래소별 발급 방법 확인</p>
              </div>
            </button>
          </div>
        )}
      </div>

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

      {/* 가이드 모달 */}
      {guideModal === 'signup' && (
        <SignupGuideModal onClose={() => setGuideModal(null)} />
      )}
      {guideModal === 'apikey' && (
        <ApiKeyGuideModal
          onClose={() => setGuideModal(null)}
          onOpenExchangeGuide={(key) => { setGuideExchange(key); setGuideModal('apikey-detail') }}
        />
      )}
      {guideModal === 'apikey-detail' && (
        <ExchangeApiGuide exchange={guideExchange} onClose={() => setGuideModal('apikey')} />
      )}
    </form>
  )
}
