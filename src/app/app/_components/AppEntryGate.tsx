'use client'

// 앱 진입 게이트 — 사용자 설정에 따라 PIN/생체 인증 강제
// 인증 통과 또는 설정 OFF면 children 렌더
// 5회 실패 또는 취소 시 로그아웃

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import PinPad from './PinPad'
import {
  isPinSet,
  verifyPin,
  isBiometricAvailable,
  isBiometricRegistered,
  authenticateWithBiometric,
} from '@/lib/app/key-store'
import {
  isAppEntryAuthEnabled,
  isEntryAuthValid,
  markEntryAuthed,
  clearEntryAuth,
  installVisibilityListener,
} from '@/lib/app/auth-session'

const MAX_PIN_FAILS = 5

export default function AppEntryGate({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [needAuth, setNeedAuth] = useState(false)
  const [pinError, setPinError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [failCount, setFailCount] = useState(0)
  const [bioTried, setBioTried] = useState(false)

  // 초기 판정
  useEffect(() => {
    installVisibilityListener()
    ;(async () => {
      const enabled = isAppEntryAuthEnabled()
      const pinExists = await isPinSet()
      // 설정 OFF거나 아직 PIN을 만든 적 없으면 통과
      if (!enabled || !pinExists) {
        setReady(true)
        return
      }
      if (isEntryAuthValid()) {
        setReady(true)
        return
      }
      setNeedAuth(true)
      setReady(true)
    })()
  }, [])

  // 생체 인증 자동 시도 (등록되어 있을 때 우선)
  useEffect(() => {
    if (!needAuth || bioTried) return
    setBioTried(true)
    ;(async () => {
      try {
        if (!(await isBiometricAvailable())) return
        if (!(await isBiometricRegistered())) return
        // PIN 문자열을 반환하지만 게이트는 통과 표시만 필요
        await authenticateWithBiometric()
        markEntryAuthed()
        setNeedAuth(false)
      } catch {
        /* 사용자가 거부하거나 실패 → PIN 폴백 */
      }
    })()
  }, [needAuth, bioTried])

  async function handlePin(pin: string) {
    setSubmitting(true)
    setPinError(null)
    try {
      const v = await verifyPin(pin)
      if (!v.ok) {
        const next = failCount + 1
        setFailCount(next)
        if (next >= MAX_PIN_FAILS) {
          await doLogout('인증 실패가 반복되어 로그아웃합니다.')
          return
        }
        setPinError(v.reason === 'locked' ? '잠금 상태입니다. 잠시 후 재시도하세요.' : `PIN이 틀립니다. (${next}/${MAX_PIN_FAILS})`)
        return
      }
      markEntryAuthed()
      setNeedAuth(false)
    } finally {
      setSubmitting(false)
    }
  }

  async function doLogout(_msg: string) {
    clearEntryAuth()
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch { /* 무시 */ }
    router.replace('/app/login')
  }

  if (!ready) return null
  if (needAuth) {
    return (
      <PinPad
        title="앱 잠금 해제"
        description="PIN을 입력하거나 지문/얼굴 인증으로 잠금을 해제하세요."
        errorMessage={pinError}
        onSubmit={handlePin}
        onCancel={() => doLogout('인증을 취소하여 로그아웃합니다.')}
        submitting={submitting}
      />
    )
  }
  return <>{children}</>
}
