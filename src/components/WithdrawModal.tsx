'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, AlertTriangle, Loader2, CalendarClock } from 'lucide-react'

interface Props {
  onClose: () => void
  /** 탈퇴 완료 후 이동할 로그인 경로 (기본: /login) */
  loginPath?: string
  /** 스케줄이 있을 때 이동할 경로 (기본: /?tab=schedule) */
  schedulePath?: string
  /** 스케줄 목록 조회 API 경로 (기본: /api/trade-jobs) */
  tradeJobsApiPath?: string
}

export default function WithdrawModal({
  onClose,
  loginPath = '/login',
  schedulePath = '/?tab=schedule',
  tradeJobsApiPath = '/api/trade-jobs',
}: Props) {
  const router = useRouter()
  const [step, setStep] = useState<'warning' | 'confirm'>('warning')
  const [inputText, setInputText] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')
  const [showScheduleAlert, setShowScheduleAlert] = useState(false)

  const CONFIRM_KEYWORD = '회원탈퇴'
  const canSubmit = inputText === CONFIRM_KEYWORD && !loading

  async function handleContinue() {
    setChecking(true)
    setError('')
    try {
      const res = await fetch(tradeJobsApiPath)
      if (res.ok) {
        const jobs = await res.json()
        if (Array.isArray(jobs) && jobs.length > 0) {
          setShowScheduleAlert(true)
          return
        }
      }
      setStep('confirm')
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setChecking(false)
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
