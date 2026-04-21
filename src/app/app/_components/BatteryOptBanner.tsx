'use client'

/**
 * BatteryOptBanner
 * Android 기기에서 알림 권한이 있지만 배터리 최적화로 인해
 * 푸시 알림이 차단될 수 있을 때 안내 배너 + 모달을 표시합니다.
 *
 * 표시 조건:
 *  1) Android 기기
 *  2) 알림 권한 granted
 *  3) localStorage 'batt_opt_ok' 플래그 없음
 */

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'batt_opt_ok'

// Android intent URL — 배터리 최적화 설정 화면 직접 오픈 (TWA/Chrome 지원)
const BATTERY_INTENT_URL =
  'intent:#Intent;action=android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS;end'

export default function BatteryOptBanner() {
  const [show, setShow] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [settingsDone, setSettingsDone] = useState(false)

  useEffect(() => {
    // SSR 방지
    if (typeof window === 'undefined') return

    // ① Android 기기 확인
    if (!/android/i.test(navigator.userAgent)) return

    // ② 알림 권한 확인
    if (typeof Notification === 'undefined') return
    if (Notification.permission !== 'granted') return

    // ③ 이미 설정 완료 확인
    if (localStorage.getItem(STORAGE_KEY)) return

    setShow(true)
  }, [])

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1')
    setShow(false)
    setModalOpen(false)
  }

  function openSettings() {
    // Android intent URL 시도 (TWA/WebView 환경에서 동작)
    window.location.href = BATTERY_INTENT_URL
    // 설정 완료 버튼 표시 (사용자가 돌아왔을 때)
    setTimeout(() => setSettingsDone(true), 1500)
  }

  if (!show) return null

  return (
    <>
      {/* ── 하단 배너 (BottomNav 위에 표시) ── */}
      <div className="fixed bottom-16 left-0 right-0 z-40 px-3">
        <div className="max-w-lg mx-auto flex items-center justify-between gap-3 rounded-xl bg-gray-900 px-4 py-3 shadow-lg">
          <p className="flex-1 text-xs text-white break-keep leading-relaxed">
            알림 수신을 위해 배터리 최적화를 해제해주세요.
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-gray-900 transition hover:bg-gray-100"
            >
              설정
            </button>
            <button
              type="button"
              onClick={dismiss}
              aria-label="닫기"
              className="text-gray-400 hover:text-white transition text-lg leading-none"
            >
              ×
            </button>
          </div>
        </div>
      </div>

      {/* ── 모달 ── */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6"
          onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false) }}
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="mb-3 text-base font-bold text-gray-900">배터리 최적화 제외</h2>
            <p className="mb-4 text-sm text-gray-600 leading-relaxed break-keep">
              알림을 항상 받아볼 수 있도록 배터리 최적화하지 않은 앱으로 등록해주세요.
            </p>

            {/* 설정 경로 안내 */}
            <div className="mb-5 rounded-xl bg-gray-50 px-4 py-3 space-y-1.5">
              <p className="text-xs font-semibold text-gray-700">설정 경로</p>
              <div className="flex items-start gap-1.5 text-xs text-gray-600 break-keep">
                <span className="mt-0.5 shrink-0 text-blue-500">①</span>
                <span>아래 [설정하러 가기] 버튼 탭</span>
              </div>
              <div className="flex items-start gap-1.5 text-xs text-gray-600 break-keep">
                <span className="mt-0.5 shrink-0 text-blue-500">②</span>
                <span>목록에서 <b className="text-gray-800">MyCoinBot</b> 선택</span>
              </div>
              <div className="flex items-start gap-1.5 text-xs text-gray-600 break-keep">
                <span className="mt-0.5 shrink-0 text-blue-500">③</span>
                <span><b className="text-gray-800">배터리</b> → <b className="text-gray-800">제한 없음</b>으로 설정</span>
              </div>
              <p className="pt-1 text-[11px] text-gray-500 break-keep">
                * 버튼이 동작하지 않으면: 설정 → 앱 → MyCoinBot → 배터리 → 제한 없음
              </p>
            </div>

            {/* 버튼 영역 */}
            {settingsDone ? (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={dismiss}
                  className="w-full rounded-xl bg-gray-900 py-3 text-sm font-semibold text-white transition hover:bg-gray-700"
                >
                  설정 완료했어요 ✓
                </button>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="w-full rounded-xl border border-gray-200 py-2.5 text-sm text-gray-600 transition hover:bg-gray-50"
                >
                  나중에 하기
                </button>
              </div>
            ) : (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm text-gray-600 transition hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={openSettings}
                  className="flex-1 rounded-xl bg-gray-900 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-700"
                >
                  설정하러 가기
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
