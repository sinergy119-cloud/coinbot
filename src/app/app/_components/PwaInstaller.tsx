'use client'
import { useEffect } from 'react'

export default function PwaInstaller() {
  useEffect(() => {
    // 1. 서비스 워커 무조건 등록 (알림 허용 여부와 무관하게)
    //    Chrome PWA 독립 앱 설치 조건: 등록된 SW + fetch 핸들러 필요
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/firebase-messaging-sw.js', { scope: '/' })
        .catch((err) => console.warn('[SW] 등록 실패:', err))
    }

    // 2. ChunkLoadError 자동 새로고침
    //    배포 후 구 JS 청크가 캐시에 남아 404 나는 경우 한 번만 강제 새로고침
    const handleError = (event: ErrorEvent) => {
      const msg = event.message || ''
      if (msg.includes('Failed to load chunk') || msg.includes('ChunkLoadError') || msg.includes('Loading chunk')) {
        const key = 'chunk_reload_ts'
        const last = Number(sessionStorage.getItem(key) || 0)
        if (Date.now() - last > 30_000) {
          sessionStorage.setItem(key, String(Date.now()))
          window.location.reload()
        }
      }
    }
    window.addEventListener('error', handleError)

    // 3. PWA 설치 완료 시 토스트 알림 표시
    const handleInstalled = () => {
      const toast = document.createElement('div')
      toast.textContent = '✅ MyCoinBot 설치 완료! 홈 화면에서 실행하세요.'
      toast.style.cssText = [
        'position:fixed',
        'bottom:88px',
        'left:50%',
        'transform:translateX(-50%)',
        'background:#111827',
        'color:#fff',
        'padding:12px 20px',
        'border-radius:10px',
        'font-size:14px',
        'font-weight:500',
        'z-index:9999',
        'white-space:nowrap',
        'box-shadow:0 4px 16px rgba(0,0,0,0.35)',
        'pointer-events:none',
      ].join(';')
      document.body.appendChild(toast)
      setTimeout(() => {
        toast.style.transition = 'opacity 0.4s'
        toast.style.opacity = '0'
        setTimeout(() => toast.remove(), 400)
      }, 5000)
    }

    window.addEventListener('appinstalled', handleInstalled)

    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  return null
}
