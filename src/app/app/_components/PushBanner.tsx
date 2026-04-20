'use client'

import { useEffect, useState } from 'react'
import { registerPushSubscription } from '@/lib/firebase-client'

type Status = 'hidden' | 'idle' | 'denied' | 'registering' | 'success' | 'error'

export default function PushBanner() {
  const [status, setStatus] = useState<Status>('hidden')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('Notification' in window)) return

    // PWA standalone 모드 또는 모바일에서만 배너 표시
    // 노트북 웹 브라우저에서는 숨김
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    if (!isStandalone && !isMobile) return

    const permission = Notification.permission
    if (permission === 'granted') {
      setStatus('hidden')
      // 이미 허용됨 — 토큰 재등록 (토큰 변경·만료 대응)
      // 하루 1회만 재등록 (localStorage 플래그)
      const lastKey = 'coinbot_push_last_register'
      const last = Number(localStorage.getItem(lastKey) ?? 0)
      const now = Date.now()
      if (now - last > 24 * 60 * 60 * 1000) {
        registerPushSubscription('web').then((r) => {
          if (r.ok) localStorage.setItem(lastKey, String(now))
        }).catch(() => {})
      }
    } else if (permission === 'denied') {
      setStatus('denied')
    } else {
      setStatus('idle')
    }
  }, [])

  async function handleEnable() {
    setStatus('registering')
    setErrorMsg(null)
    const result = await registerPushSubscription('web')
    if (result.ok) {
      setStatus('success')
      setTimeout(() => setStatus('hidden'), 2000)
    } else {
      setStatus('error')
      setErrorMsg(result.reason ?? '알 수 없는 오류')
    }
  }

  if (status === 'hidden') return null

  return (
    <div className="sticky top-0 z-40 bg-yellow-50 border-b border-yellow-200 px-4 py-3 break-keep">
      {status === 'idle' && (
        <div className="flex items-center justify-between gap-3 max-w-lg mx-auto">
          <div>
            <p className="text-sm font-semibold text-gray-900">알림을 켜면 거래 결과와 이벤트를 받아볼 수 있어요.</p>
            <p className="text-xs text-gray-700 mt-0.5">설정을 허용해주세요.</p>
          </div>
          <button
            type="button"
            onClick={handleEnable}
            className="shrink-0 bg-gray-900 text-white text-sm font-semibold px-4 py-2 rounded-lg"
          >
            켜기
          </button>
        </div>
      )}
      {status === 'registering' && (
        <p className="text-sm text-gray-900 text-center">알림 등록 중...</p>
      )}
      {status === 'success' && (
        <p className="text-sm text-green-700 text-center">✓ 알림이 켜졌습니다.</p>
      )}
      {status === 'denied' && (
        <div className="max-w-lg mx-auto">
          <p className="text-sm font-semibold text-gray-900">알림이 차단된 상태예요.</p>
          <p className="text-xs text-gray-700 mt-0.5">브라우저 주소창 왼쪽 자물쇠 아이콘 → 사이트 설정 → 알림 허용으로 변경해주세요.</p>
        </div>
      )}
      {status === 'error' && (
        <div className="max-w-lg mx-auto">
          <p className="text-sm font-semibold text-red-700">알림 등록에 실패했어요.</p>
          {errorMsg && <p className="text-xs text-red-600 mt-0.5 break-all">{errorMsg}</p>}
          <button type="button" onClick={handleEnable} className="text-xs underline text-gray-700 mt-1">
            다시 시도
          </button>
        </div>
      )}
    </div>
  )
}
