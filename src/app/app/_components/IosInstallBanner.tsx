'use client'

import { useEffect, useState } from 'react'

// iOS Safari에서만 표시되는 PWA 설치 안내 배너
// - PWA로 설치되어 standalone 모드면 숨김
// - 안드로이드/PC면 숨김
export default function IosInstallBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // iOS 기기 감지 (iPad는 데스크톱 모드 사용 시 Macintosh로 잡히므로 보조 검사)
    const ua = navigator.userAgent
    const isIOS =
      /iPad|iPhone|iPod/.test(ua) ||
      (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)

    if (!isIOS) return

    // 이미 PWA로 설치되어 standalone 모드로 실행 중이면 숨김
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // iOS Safari 전용 속성
      (navigator as Navigator & { standalone?: boolean }).standalone === true

    if (isStandalone) return

    setVisible(true)
  }, [])

  if (!visible) return null

  return (
    <div
      className="rounded-2xl border p-4 break-keep"
      style={{
        background: '#FFFBEB',
        borderColor: '#FCD34D',
      }}
    >
      <div className="flex items-start gap-3">
        <span className="text-[22px] shrink-0 leading-none mt-0.5">🍎</span>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold mb-1.5" style={{ color: '#78350F' }}>
            iPhone 사용자는 홈 화면에 추가가 필요해요
          </p>
          <p className="text-[12px] leading-relaxed mb-3" style={{ color: '#92400E' }}>
            자동 매수와 알림을 받으려면 Safari로 접속한 뒤
            홈 화면에 추가해 PWA로 설치해 주세요.
          </p>
          <ol className="text-[12px] space-y-1.5" style={{ color: '#78350F' }}>
            <li className="flex items-start gap-1.5">
              <span className="font-bold shrink-0">1.</span>
              <span>
                Safari 하단 가운데 <b>공유 버튼</b>{' '}
                <span
                  className="inline-flex items-center justify-center rounded-md align-middle mx-0.5"
                  style={{
                    width: 18,
                    height: 18,
                    background: '#fff',
                    border: '1px solid #FCD34D',
                    fontSize: 11,
                  }}
                  aria-hidden
                >
                  ↑
                </span>{' '}
                탭
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="font-bold shrink-0">2.</span>
              <span><b>&quot;홈 화면에 추가&quot;</b> 선택</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="font-bold shrink-0">3.</span>
              <span>홈 화면의 <b>MyCoinBot 아이콘</b>으로 다시 접속</span>
            </li>
          </ol>
          <p className="text-[11px] mt-3 leading-relaxed" style={{ color: '#A16207' }}>
            ※ Chrome/네이버 앱에서는 설치되지 않습니다. 반드시 <b>Safari</b>를 사용하세요.
          </p>
        </div>
      </div>
    </div>
  )
}
