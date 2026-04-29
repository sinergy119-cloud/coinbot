'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, AlertTriangle, Loader2, CalendarClock, KeyRound } from 'lucide-react'
import { listKeys, resetAll } from '@/lib/app/key-store'
import { EXCHANGE_LABELS, EXCHANGE_EMOJI, type Exchange } from '@/types/database'

interface Props {
  onClose: () => void
  /** 탈퇴 완료 후 이동할 로그인 경로 (기본: /login) */
  loginPath?: string
  /** 스케줄이 있을 때 이동할 경로 (기본: /?tab=schedule) */
  schedulePath?: string
  /** 스케줄 목록 조회 API 경로 (기본: /api/trade-jobs) */
  tradeJobsApiPath?: string
}

interface LocalKey {
  id: string
  exchange: Exchange
  label: string
}

type Step = 'warning' | 'apikey-list' | 'apikey-confirm' | 'confirm'

export default function WithdrawModal({
  onClose,
  loginPath = '/login',
  schedulePath = '/?tab=schedule',
  tradeJobsApiPath = '/api/trade-jobs',
}: Props) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('warning')
  const [inputText, setInputText] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')
  const [showScheduleAlert, setShowScheduleAlert] = useState(false)
  const [localKeys, setLocalKeys] = useState<LocalKey[]>([])
  const [clearing, setClearing] = useState(false)

  const CONFIRM_KEYWORD = '회원탈퇴'
  const canSubmit = inputText === CONFIRM_KEYWORD && !loading

  // IndexedDB의 거래소 API Key 목록 조회 (앱 사용자 전용)
  // 웹 사용자는 IndexedDB가 비어 있어 빈 배열 반환
  async function fetchLocalKeys(): Promise<LocalKey[]> {
    try {
      const keys = await listKeys()
      return keys.map((k) => ({ id: k.id, exchange: k.exchange, label: k.label }))
    } catch {
      // IndexedDB 미지원 / DB 미초기화 → 키 없음으로 간주
      return []
    }
  }

  async function handleContinue() {
    setChecking(true)
    setError('')
    try {
      // 1단계: 활성 스케줄 검사
      const res = await fetch(tradeJobsApiPath)
      if (res.ok) {
        const jobs = await res.json()
        if (Array.isArray(jobs) && jobs.length > 0) {
          setShowScheduleAlert(true)
          return
        }
      }

      // 2단계: 로컬(IndexedDB) API Key 검사
      const keys = await fetchLocalKeys()
      if (keys.length > 0) {
        setLocalKeys(keys)
        setStep('apikey-list')
        return
      }

      // 키 없음 → 바로 텍스트 확인 단계
      setStep('confirm')
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setChecking(false)
    }
  }

  async function handleClearLocalData() {
    setClearing(true)
    setError('')
    try {
      // IndexedDB 거래소 키 + meta + auto_keys 전체 삭제
      await resetAll()
      // localStorage / sessionStorage 정리
      try { localStorage.clear() } catch { /* 무시 */ }
      try { sessionStorage.clear() } catch { /* 무시 */ }
      setStep('confirm')
    } catch {
      setError('API Key 삭제 중 오류가 발생했습니다. 다시 시도해주세요.')
    } finally {
      setClearing(false)
    }
  }

  async function handleWithdraw() {
    if (!canSubmit) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/user/withdraw', { method: 'DELETE' })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? '탈퇴 처리 중 오류가 발생했습니다.')
        return
      }

      // 탈퇴 완료 → 로그인 페이지로
      router.push(`${loginPath}?withdrawn=1`)
      router.refresh()
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4">
        <div className="w-full max-w-sm rounded-xl bg-white shadow-2xl">

          {/* 헤더 */}
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-red-500" />
              <h2 className="text-sm font-semibold text-gray-900">회원 탈퇴</h2>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          </div>

          {/* 1단계: 경고 */}
          {step === 'warning' && (
            <div className="px-5 py-5 space-y-4">
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
                <p className="text-xs font-semibold text-red-700 mb-2">⚠️ 탈퇴 시 아래 정보가 즉시 삭제됩니다</p>
                <ul className="space-y-1 text-xs text-red-600 break-keep">
                  <li>• 등록된 거래소 API 키 전체</li>
                  <li>• 로그인 이력</li>
                  <li>• 문의 내역</li>
                  <li>• 계정 정보 (닉네임, 이메일 등)</li>
                </ul>
              </div>
              <p className="text-xs font-bold text-red-600 text-center break-keep">
                탈퇴 후 데이터는 복구가 불가능합니다.
              </p>
              <p className="text-xs text-gray-600 text-center break-keep">
                스케줄이 등록되어 있다면 먼저 삭제 후 탈퇴해주세요.
              </p>
              {error && (
                <p className="text-xs text-red-600 break-keep">{error}</p>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={onClose}
                  className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  onClick={handleContinue}
                  disabled={checking}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {checking
                    ? <><Loader2 size={14} className="animate-spin" /> 확인 중...</>
                    : '계속하기'}
                </button>
              </div>
            </div>
          )}

          {/* 1.5단계: API Key 목록 + 명시적 삭제 동의 */}
          {step === 'apikey-list' && (
            <div className="px-5 py-5 space-y-4">
              <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5">
                <KeyRound size={16} className="text-amber-700 shrink-0" />
                <p className="text-xs font-semibold text-amber-800 break-keep">
                  이 폰에 거래소 API Key {localKeys.length}건이 저장되어 있어요
                </p>
              </div>

              <div className="rounded-lg border border-gray-200 max-h-48 overflow-y-auto">
                {localKeys.map((k, i) => (
                  <div
                    key={k.id}
                    className={`flex items-center gap-2 px-3 py-2.5 ${i < localKeys.length - 1 ? 'border-b border-gray-100' : ''}`}
                  >
                    <span className="text-base shrink-0">{EXCHANGE_EMOJI[k.exchange] ?? '🔑'}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-gray-900 truncate">
                        {EXCHANGE_LABELS[k.exchange] ?? k.exchange}
                      </p>
                      <p className="text-[11px] text-gray-600 truncate">{k.label}</p>
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-xs text-gray-700 break-keep leading-relaxed">
                회원 탈퇴를 진행하려면 이 폰에 저장된{' '}
                <b className="text-red-600">모든 API Key를 먼저 삭제</b>해야 합니다.
                삭제는 취소할 수 없으며, 자동 매수가 즉시 중단됩니다.
              </p>

              {error && <p className="text-xs text-red-600 break-keep">{error}</p>}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => { setStep('warning'); setError('') }}
                  className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  onClick={() => setStep('apikey-confirm')}
                  className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-700"
                >
                  지금 모두 삭제
                </button>
              </div>
            </div>
          )}

          {/* 1.6단계: 최종 삭제 확인 */}
          {step === 'apikey-confirm' && (
            <div className="px-5 py-5 space-y-4">
              <div className="rounded-lg bg-red-50 border-2 border-red-300 px-4 py-4">
                <div className="flex items-start gap-2 mb-2">
                  <AlertTriangle size={18} className="text-red-600 shrink-0 mt-0.5" />
                  <p className="text-sm font-bold text-red-700 break-keep">
                    {localKeys.length}건의 API Key를 정말 삭제할까요?
                  </p>
                </div>
                <ul className="text-xs text-red-600 space-y-1 ml-6 break-keep">
                  <li>• 이 폰에서 거래소 자동 매수가 <b>즉시 중단</b>됩니다</li>
                  <li>• 삭제 후 <b>복구할 수 없습니다</b></li>
                  <li>• 거래소 사이트에서 <b>API Key 폐기 처리</b>도 권장됩니다</li>
                </ul>
              </div>

              {error && <p className="text-xs text-red-600 break-keep">{error}</p>}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => { setStep('apikey-list'); setError('') }}
                  disabled={clearing}
                  className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  이전
                </button>
                <button
                  onClick={handleClearLocalData}
                  disabled={clearing}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {clearing
                    ? <><Loader2 size={14} className="animate-spin" /> 삭제 중...</>
                    : `${localKeys.length}건 모두 삭제`}
                </button>
              </div>
            </div>
          )}

          {/* 2단계: 텍스트 확인 */}
          {step === 'confirm' && (
            <div className="px-5 py-5 space-y-4">
              <p className="text-xs text-gray-700 break-keep leading-relaxed">
                탈퇴를 확인하려면 아래 입력란에{' '}
                <span className="font-bold text-red-600">{CONFIRM_KEYWORD}</span>
                를 정확히 입력해주세요.
              </p>
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={CONFIRM_KEYWORD}
                autoFocus
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-300 placeholder-gray-400"
              />
              {error && (
                <p className="text-xs text-red-600 break-keep">{error}</p>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => { setStep('warning'); setInputText(''); setError('') }}
                  disabled={loading}
                  className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  이전
                </button>
                <button
                  onClick={handleWithdraw}
                  disabled={!canSubmit}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {loading
                    ? <><Loader2 size={14} className="animate-spin" /> 처리 중...</>
                    : '탈퇴하기'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 활성 스케줄 알림 모달 */}
      {showScheduleAlert && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-xs rounded-xl bg-white shadow-2xl overflow-hidden">
            <div className="flex flex-col items-center px-6 py-6 gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
                <CalendarClock size={24} className="text-amber-600" />
              </div>
              <div className="text-center space-y-1.5">
                <p className="text-sm font-semibold text-gray-900">활성 스케줄이 있습니다</p>
                <p className="text-xs text-gray-600 break-keep leading-relaxed">
                  스케줄 탭에서 모든 스케줄을 삭제한 후<br />다시 탈퇴를 진행해주세요.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowScheduleAlert(false)
                  onClose()
                  router.push(schedulePath)
                }}
                className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                스케줄 관리로 이동
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
