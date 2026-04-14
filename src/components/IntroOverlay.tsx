'use client'

/**
 * 서비스 소개 오버레이
 *
 * - 최초 접속 시 자동 표시
 * - "다시 보지 않기" 클릭 → localStorage에 플래그 저장 → 이후 방문 시 표시 안 함
 * - X / "확인" 클릭 → 이번 세션만 닫기 (다음 방문엔 다시 표시)
 */

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'

const STORAGE_KEY = 'coinbot_intro_seen'

export default function IntroOverlay() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // localStorage는 마운트 후(클라이언트)에서만 접근
    if (!localStorage.getItem(STORAGE_KEY)) {
      setVisible(true)
    }
  }, [])

  if (!visible) return null

  function close() {
    setVisible(false)
  }

  function neverShow() {
    localStorage.setItem(STORAGE_KEY, '1')
    setVisible(false)
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 px-4"
      onClick={close} // 배경 클릭 시 이번만 닫기
    >
      <div
        className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()} // 카드 클릭은 닫힘 방지
      >
        {/* X 버튼 — 이번만 닫기 */}
        <button
          onClick={close}
          aria-label="닫기"
          className="absolute right-3 top-3 z-10 rounded-full bg-black/30 p-1.5 text-white hover:bg-black/50 transition-colors"
        >
          <X size={18} />
        </button>

        {/* 소개 이미지 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/intro.png"
          alt="MyComBot 서비스 소개 — 불편함의 시작부터 봇 가동까지"
          className="w-full h-auto block"
        />

        {/* 하단 버튼 */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100 bg-white">
          <button
            onClick={neverShow}
            className="text-sm text-gray-500 hover:text-gray-700 underline underline-offset-2 transition-colors"
          >
            다시 보지 않기
          </button>
          <button
            onClick={close}
            className="rounded-lg bg-purple-600 px-5 py-2 text-sm font-medium text-white hover:bg-purple-700 transition-colors"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  )
}
