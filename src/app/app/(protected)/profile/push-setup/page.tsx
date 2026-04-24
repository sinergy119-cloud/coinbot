'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { registerPushSubscription, getMessagingInstance } from '@/lib/firebase-client'

type StepStatus = 'pending' | 'checking' | 'ok' | 'error' | 'warn'

interface Step {
  id: string
  label: string
  status: StepStatus
  detail?: string
}

const INITIAL_STEPS: Step[] = [
  { id: 'device',    label: '기기 설정 확인',       status: 'pending' },
  { id: 'app',       label: 'MyCoinBot 설정 확인',  status: 'pending' },
  { id: 'firebase',  label: 'Firebase 서비스 확인', status: 'pending' },
  { id: 'token',     label: '푸시 토큰 등록',        status: 'pending' },
]

function StepIcon({ status }: { status: StepStatus }) {
  if (status === 'pending')  return <span className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: '#E5E8EB' }}><span className="w-2 h-2 rounded-full" style={{ background: '#B0B8C1' }} /></span>
  if (status === 'checking') return (
    <span className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: '#EBF3FF' }}>
      <span className="w-3 h-3 rounded-full border-2 border-blue-500 border-t-transparent animate-spin block" />
    </span>
  )
  if (status === 'ok')    return <span className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[13px]" style={{ background: '#E6FBF0', color: '#007A30' }}>✓</span>
  if (status === 'warn')  return <span className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[12px]" style={{ background: '#FFF9C4', color: '#7A6000' }}>!</span>
  if (status === 'error') return <span className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[12px]" style={{ background: '#FFE8E8', color: '#C0392B' }}>✕</span>
  return null
}

export default function PushSetupPage() {
  const router = useRouter()
  const [steps, setSteps] = useState<Step[]>(INITIAL_STEPS)
  const [allDone, setAllDone] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'idle' | 'sent' | 'error'>('idle')
  const [testError, setTestError] = useState('')

  function updateStep(id: string, patch: Partial<Step>) {
    setSteps((prev) => prev.map((s) => s.id === id ? { ...s, ...patch } : s))
  }

  useEffect(() => {
    runDiagnostic()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function runDiagnostic() {
    setAllDone(false)
    setTestResult('idle')

    // ── Step 1: 기기 알림 권한 ────────────────────────────────────
    updateStep('device', { status: 'checking', detail: undefined })
    await delay(400)

    if (!('Notification' in window)) {
      updateStep('device', { status: 'error', detail: '이 브라우저는 알림을 지원하지 않습니다.' })
      return
    }

    let permission = Notification.permission
    if (permission === 'default') {
      try { permission = await Notification.requestPermission() } catch { /* ignore */ }
    }

    if (permission === 'denied') {
      updateStep('device', { status: 'error', detail: '브라우저 설정에서 알림을 허용해주세요.' })
      return
    }
    if (permission !== 'granted') {
      updateStep('device', { status: 'warn', detail: '알림 권한이 허용되지 않았습니다.' })
      return
    }
    updateStep('device', { status: 'ok' })

    // ── Step 2: MyCoinBot 알림 설정 ──────────────────────────────
    updateStep('app', { status: 'checking', detail: undefined })
    await delay(400)

    try {
      const res = await fetch('/api/app/notification-settings')
      const json = await res.json()
      if (!json.ok || !json.data?.masterEnabled) {
        updateStep('app', {
          status: 'warn',
          detail: '프로필 > 알림 설정에서 전체 알림을 켜주세요.',
        })
        // 경고이지만 계속 진행
      } else {
        updateStep('app', { status: 'ok' })
      }
    } catch {
      updateStep('app', { status: 'warn', detail: '설정 확인 중 오류가 발생했습니다.' })
    }

    // ── Step 3: Firebase 서비스 확인 ─────────────────────────────
    updateStep('firebase', { status: 'checking', detail: undefined })
    await delay(400)

    try {
      const messaging = await getMessagingInstance()
      if (!messaging) {
        updateStep('firebase', { status: 'error', detail: 'Firebase 메시징을 초기화할 수 없습니다.' })
        return
      }
      updateStep('firebase', { status: 'ok' })
    } catch (e) {
      updateStep('firebase', {
        status: 'error',
        detail: `Firebase 초기화 오류: ${e instanceof Error ? e.message : String(e)}`,
      })
      return
    }

    // ── Step 4: 푸시 토큰 등록 ───────────────────────────────────
    updateStep('token', { status: 'checking', detail: undefined })

    const result = await registerPushSubscription('web')
    if (!result.ok) {
      const msg = result.reason ?? '알 수 없는 오류'
      if (msg === 'permission_denied') {
        updateStep('token', { status: 'error', detail: '알림 권한이 거부되었습니다. 브라우저 주소창 자물쇠를 클릭해 권한을 허용해주세요.' })
      } else if (msg.startsWith('sw_register')) {
        updateStep('token', { status: 'error', detail: 'Service Worker 등록에 실패했습니다. 페이지를 새로고침 후 다시 시도해주세요.' })
      } else if (msg.startsWith('token_failed')) {
        updateStep('token', { status: 'error', detail: 'FCM 토큰 발급 실패. Firebase VAPID Key를 확인해주세요.' })
      } else {
        updateStep('token', { status: 'error', detail: msg })
      }
      return
    }
    updateStep('token', { status: 'ok' })
    setAllDone(true)
  }

  async function sendTestNotification() {
    setTesting(true)
    setTestResult('idle')
    try {
      const res = await fetch('/api/app/push/test', { method: 'POST' })
      const json = await res.json()
      if (json.ok) {
        setTestResult('sent')
      } else {
        setTestResult('error')
        setTestError(json.error ?? '발송 실패')
      }
    } catch (e) {
      setTestResult('error')
      setTestError(e instanceof Error ? e.message : '네트워크 오류')
    } finally {
      setTesting(false)
    }
  }

  const hasError = steps.some((s) => s.status === 'error')
  const isRunning = steps.some((s) => s.status === 'checking')

  return (
    <div className="flex flex-col" style={{ background: '#F9FAFB', minHeight: '100%' }}>

      {/* 헤더 */}
      <header className="flex items-center gap-3 px-4 pt-6 pb-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="w-8 h-8 flex items-center justify-center rounded-full active:opacity-60 transition-opacity"
          style={{ background: '#F2F4F6' }}
        >
          <span className="text-[16px]" style={{ color: '#191F28' }}>‹</span>
        </button>
        <h1 className="text-[18px] font-bold" style={{ color: '#191F28' }}>PUSH 알림설정 확인</h1>
      </header>

      {/* 단계 목록 */}
      <section className="px-4 pb-4">
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
        >
          {steps.map((step, idx, arr) => (
            <div
              key={step.id}
              className="flex items-start gap-3 px-5 py-4 break-keep"
              style={idx < arr.length - 1 ? { borderBottom: '1px solid #F2F4F6' } : undefined}
            >
              <StepIcon status={step.status} />
              <div className="min-w-0 flex-1">
                <p
                  className="text-[14px] font-semibold"
                  style={{ color: step.status === 'pending' ? '#B0B8C1' : '#191F28' }}
                >
                  {step.label}
                </p>
                {step.detail && (
                  <p
                    className="text-[12px] mt-0.5 leading-relaxed"
                    style={{
                      color: step.status === 'error' ? '#C0392B'
                           : step.status === 'warn'  ? '#7A6000'
                           : '#6B7684',
                    }}
                  >
                    {step.detail}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 테스트 알림 발송 — 모든 단계 완료 후 표시 */}
      {allDone && (
        <section className="px-4 pb-4">
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
          >
            <div className="flex items-start gap-3 px-5 py-4 break-keep">
              {testResult === 'idle'  && <span className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[12px]" style={{ background: '#FFF9C4', color: '#7A6000' }}>!</span>}
              {testResult === 'sent'  && <span className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[13px]" style={{ background: '#E6FBF0', color: '#007A30' }}>✓</span>}
              {testResult === 'error' && <span className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[12px]" style={{ background: '#FFE8E8', color: '#C0392B' }}>✕</span>}

              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold" style={{ color: '#191F28' }}>테스트 문구 발송</p>
                {testResult === 'idle' && (
                  <p className="text-[12px] mt-0.5" style={{ color: '#6B7684' }}>
                    실제 PUSH 알림을 발송하여 수신 여부를 확인합니다.
                  </p>
                )}
                {testResult === 'sent' && (
                  <p className="text-[12px] mt-0.5" style={{ color: '#007A30' }}>
                    알림이 발송되었습니다. 잠시 후 기기에 알림이 도착합니다.
                  </p>
                )}
                {testResult === 'error' && (
                  <p className="text-[12px] mt-0.5" style={{ color: '#C0392B' }}>
                    {testError || '발송에 실패했습니다. 다시 시도해주세요.'}
                  </p>
                )}
              </div>
            </div>

            {testResult !== 'sent' && (
              <div className="px-5 pb-4">
                <button
                  type="button"
                  onClick={sendTestNotification}
                  disabled={testing}
                  className="w-full py-3 rounded-xl text-[14px] font-semibold transition-all active:opacity-80 disabled:opacity-50 break-keep"
                  style={{ background: '#0064FF', color: '#fff' }}
                >
                  {testing ? '발송 중...' : '테스트 알림 발송'}
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 오류 시 다시 시도 버튼 */}
      {hasError && !isRunning && (
        <section className="px-4 pb-4">
          <button
            type="button"
            onClick={runDiagnostic}
            className="w-full py-3 rounded-xl text-[14px] font-semibold transition-all active:opacity-80 break-keep"
            style={{ background: '#F2F4F6', color: '#191F28' }}
          >
            다시 시도
          </button>
        </section>
      )}

      {/* 안내 문구 */}
      <section className="px-4 pb-6">
        <div
          className="rounded-2xl p-4 break-keep"
          style={{ background: '#EBF3FF' }}
        >
          <p className="text-[12px] leading-relaxed" style={{ color: '#0050CC' }}>
            💡 알림이 도착하지 않는 경우<br />
            • 기기 설정 &gt; 앱 &gt; MyCoinBot &gt; 알림 허용 확인<br />
            • 절전 모드에서 백그라운드 앱 제한 해제<br />
            • PWA(홈 화면 추가) 상태로 사용 권장
          </p>
        </div>
      </section>

    </div>
  )
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}
