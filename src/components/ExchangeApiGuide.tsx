'use client'

import { useState } from 'react'
import { X, ChevronLeft, ChevronRight, Copy, Check } from 'lucide-react'
import { EXCHANGE_GUIDES } from './exchange-guide-data'
import type { ExchangeGuideData, GuideStep } from './exchange-guide-data'

const SERVER_IP = '43.203.100.239'

// ─── 화면 목업 렌더러 ──────────────────────────────
function StepMockup({ step, guide }: { step: GuideStep; guide: ExchangeGuideData }) {
  const brandColor = guide.color

  if (step.mockup === 'login') {
    return (
      <div className="rounded-lg border-2 border-gray-200 bg-white overflow-hidden">
        {/* 브라우저 바 */}
        <div className="flex items-center gap-2 bg-gray-100 px-3 py-2 border-b">
          <div className="flex gap-1">
            <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
            <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
            <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
          </div>
          <div className="flex-1 rounded bg-white px-3 py-1 text-xs text-gray-500">{guide.url}</div>
        </div>
        {/* 화면 */}
        <div className="p-6 text-center">
          <div className="mb-4 text-2xl font-bold" style={{ color: brandColor }}>{guide.name}</div>
          <div className="mx-auto max-w-48 space-y-3">
            <div className="rounded border border-gray-300 px-3 py-2 text-xs text-gray-500 text-left">아이디 / 이메일</div>
            <div className="rounded border border-gray-300 px-3 py-2 text-xs text-gray-500 text-left">비밀번호</div>
            <div className="rounded py-2 text-xs font-bold text-white" style={{ backgroundColor: brandColor }}>
              로그인
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (step.mockup === 'menu') {
    return (
      <div className="rounded-lg border-2 border-gray-200 bg-white overflow-hidden">
        <div className="flex items-center gap-2 bg-gray-100 px-3 py-2 border-b">
          <div className="flex gap-1">
            <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
            <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
            <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
          </div>
          <div className="flex-1 rounded bg-white px-3 py-1 text-xs text-gray-500">{guide.url}</div>
        </div>
        <div className="p-4">
          {/* 상단 바 */}
          <div className="flex items-center justify-between mb-4 pb-2 border-b">
            <span className="font-bold" style={{ color: brandColor }}>{guide.name}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">홍길동님</span>
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white">1</span>
            </div>
          </div>
          {/* 드롭다운 메뉴 */}
          <div className="ml-auto w-40 rounded-lg border border-gray-200 shadow-lg">
            <div className="px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 cursor-pointer">내 정보</div>
            <div className="px-3 py-2 text-xs font-bold text-blue-600 bg-blue-50 rounded cursor-pointer flex items-center gap-1">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[8px] text-white">2</span>
              계정관리
            </div>
            <div className="px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 cursor-pointer">로그아웃</div>
          </div>
          {/* 좌측 메뉴 */}
          <div className="mt-4 flex gap-4">
            <div className="w-32 space-y-1">
              <div className="px-2 py-1.5 text-xs text-gray-500 rounded">보안 설정</div>
              <div className="px-2 py-1.5 text-xs font-bold bg-blue-50 text-blue-600 rounded flex items-center gap-1">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[8px] text-white">3</span>
                API 관리
              </div>
              <div className="px-2 py-1.5 text-xs text-gray-500 rounded">알림 설정</div>
            </div>
            <div className="flex-1 rounded bg-gray-50 p-3 text-xs text-gray-500 text-center">
              API 관리 화면이 여기에 표시됩니다
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (step.mockup === 'permissions' && step.permissions) {
    return (
      <div className="rounded-lg border-2 border-gray-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ backgroundColor: brandColor + '10' }}>
          <span className="text-sm font-bold" style={{ color: brandColor }}>API 권한 설정</span>
          <span className="text-xs text-gray-500">API 2.0</span>
        </div>
        <div className="p-4 space-y-2">
          {step.permissions.map((p) => (
            <label key={p.label} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 ${
              p.danger ? 'bg-red-50 border-2 border-red-300' : p.checked ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'
            }`}>
              <div className={`flex h-5 w-5 items-center justify-center rounded border-2 ${
                p.danger ? 'border-red-400 bg-white' : p.checked ? 'border-green-500 bg-green-500' : 'border-gray-300 bg-white'
              }`}>
                {p.checked && <Check size={12} className="text-white" />}
                {p.danger && <X size={12} className="text-red-500" />}
              </div>
              <span className={`text-sm ${p.danger ? 'font-bold text-red-600' : p.checked ? 'text-gray-800' : 'text-gray-500'}`}>
                {p.label}
              </span>
              {p.danger && <span className="ml-auto text-xs font-bold text-red-500">❌ 절대 금지</span>}
              {p.checked && !p.danger && <span className="ml-auto text-xs text-green-600">✅</span>}
            </label>
          ))}
        </div>
      </div>
    )
  }

  if (step.mockup === 'ip') {
    return (
      <div className="rounded-lg border-2 border-gray-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b" style={{ backgroundColor: brandColor + '10' }}>
          <span className="text-sm font-bold" style={{ color: brandColor }}>IP 주소 등록</span>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">허용 IP 주소</label>
            <div className="flex gap-2">
              <div className="flex-1 rounded-lg border-2 border-blue-400 bg-blue-50 px-3 py-2.5 text-sm font-mono font-bold text-blue-700">
                {SERVER_IP}
              </div>
              <IpCopyButton />
            </div>
            <p className="mt-1 text-xs text-gray-500">이 IP에서만 API 호출이 허용됩니다</p>
          </div>
          <button className="w-full rounded-lg py-2.5 text-sm font-bold text-white" style={{ backgroundColor: brandColor }}>
            API Key 발급
          </button>
        </div>
      </div>
    )
  }

  if (step.mockup === 'result') {
    return (
      <div className="rounded-lg border-2 border-gray-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b bg-green-50">
          <span className="text-sm font-bold text-green-700">✅ API Key 발급 완료</span>
        </div>
        <div className="p-4 space-y-3">
          {(step.keyNames ?? ['API Key', 'Secret Key']).map((keyName, i) => (
            <div key={keyName}>
              <label className="mb-1 block text-xs font-medium text-gray-600">{keyName}</label>
              <div className="flex gap-2">
                <div className={`flex-1 rounded-lg border px-3 py-2.5 font-mono text-xs ${
                  i === 1 ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-gray-300 bg-gray-50 text-gray-600'
                }`}>
                  {i === 0 ? 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' : '••••••••••••••••••••••••••••••••'}
                </div>
                <button className="rounded-lg border border-gray-300 px-3 py-2 text-xs text-gray-500 hover:bg-gray-50">
                  복사
                </button>
              </div>
              {i === 1 && (
                <p className="mt-1 text-xs font-bold text-red-500">⚠ 이 창을 닫으면 다시 확인할 수 없습니다!</p>
              )}
            </div>
          ))}
        </div>
        <div className="mx-4 mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
          <p className="text-xs font-bold text-red-600">🔴 Secret Key를 반드시 복사한 후 안전한 곳에 보관하세요</p>
        </div>
      </div>
    )
  }

  return null
}

// ─── IP 복사 버튼 ────────────────────────────────
function IpCopyButton() {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(SERVER_IP)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
      const el = document.createElement('textarea')
      el.value = SERVER_IP
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <button
      onClick={handleCopy}
      className={`flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-medium transition ${
        copied ? 'bg-green-500 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'
      }`}
    >
      {copied ? <><Check size={14} /> 복사됨</> : <><Copy size={14} /> 복사</>}
    </button>
  )
}

// ─── 거래소 탭 목록 ─────────────────────────────
const EXCHANGE_KEYS = Object.keys(EXCHANGE_GUIDES)

// ─── 메인 컴포넌트 ──────────────────────────────
export default function ExchangeApiGuide({ exchange, onClose }: { exchange: string; onClose: () => void }) {
  const [selectedExchange, setSelectedExchange] = useState(exchange)
  const [currentStep, setCurrentStep] = useState(0)
  const guide = EXCHANGE_GUIDES[selectedExchange]
  if (!guide) return null

  const step = guide.steps[currentStep]
  const totalSteps = guide.steps.length

  function handleTabChange(key: string) {
    setSelectedExchange(key)
    setCurrentStep(0)
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="relative w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl">
        {/* 고정 헤더: 거래소 탭 + 단계 인디케이터 */}
        <div className="shrink-0 rounded-t-2xl bg-white border-b">
          {/* 거래소 탭 */}
          <div className="flex overflow-x-auto px-2 pt-2 gap-1">
            {EXCHANGE_KEYS.map((key) => {
              const g = EXCHANGE_GUIDES[key]
              const isActive = key === selectedExchange
              return (
                <button
                  key={key}
                  onClick={() => handleTabChange(key)}
                  className={`flex items-center gap-1 whitespace-nowrap rounded-t-lg px-3 py-2 text-xs font-medium transition ${
                    isActive ? 'text-white' : 'text-gray-500 hover:bg-gray-100'
                  }`}
                  style={isActive ? { backgroundColor: g.color } : undefined}
                >
                  {g.emoji} {g.name}
                </button>
              )
            })}
          </div>
          {/* 헤더 */}
          <div className="flex items-center justify-between px-5 py-2" style={{ backgroundColor: guide.color + '10' }}>
            <h2 className="text-sm font-bold" style={{ color: guide.color }}>{guide.name} API Key 발급 가이드</h2>
            <button onClick={onClose} className="rounded-full p-1 text-gray-400 hover:bg-gray-200" aria-label="닫기">
              <X size={18} />
            </button>
          </div>
          {/* 단계 인디케이터 + 네비게이션 */}
          <div className="flex items-center justify-center gap-1.5 py-2.5">
            <button
              onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
              disabled={currentStep === 0}
              className="flex items-center gap-0.5 rounded-full bg-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-300 disabled:opacity-20 transition"
            >
              <ChevronLeft size={14} /> 이전
            </button>
            {guide.steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentStep(i)}
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition ${
                  i === currentStep
                    ? 'text-white shadow-md'
                    : i < currentStep
                    ? 'bg-green-100 text-green-600'
                    : 'bg-gray-100 text-gray-400'
                }`}
                style={i === currentStep ? { backgroundColor: guide.color } : undefined}
              >
                {i < currentStep ? '✓' : i + 1}
              </button>
            ))}
            {currentStep < totalSteps - 1 ? (
              <button
                onClick={() => setCurrentStep(currentStep + 1)}
                className="flex items-center gap-0.5 rounded-full bg-gray-900 px-2.5 py-1 text-xs font-bold text-white animate-pulse hover:bg-black transition"
              >
                다음 <ChevronRight size={14} />
              </button>
            ) : (
              <button
                onClick={onClose}
                className="flex items-center gap-0.5 rounded-full bg-gray-900 px-2.5 py-1 text-xs font-bold text-white animate-pulse hover:bg-black transition"
              >
                완료
              </button>
            )}
          </div>
        </div>

        {/* 단계 내용 (스크롤 영역) */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* 제목 + 행동 */}
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-1">
              Step {currentStep + 1}. {step.title}
            </h3>
            <p className="text-sm text-gray-600">{step.action}</p>
          </div>

          {/* 초심자 힌트 */}
          <div className={`rounded-lg border-l-4 px-3 py-2.5 text-xs ${
            step.hint.includes('절대') || step.hint.includes('⚠')
              ? 'border-red-400 bg-red-50 text-red-700'
              : 'border-blue-400 bg-blue-50 text-blue-700'
          }`}>
            💡 {step.hint}
          </div>

          {/* 화면 목업 */}
          <StepMockup step={step} guide={guide} />
        </div>

        {/* 하단 여백 */}
        <div className="h-4" />
      </div>
    </div>
  )
}
