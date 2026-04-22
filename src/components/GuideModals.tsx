'use client'

import { useState } from 'react'
import { X, Copy, Check } from 'lucide-react'
import ExchangeApiGuide from '@/components/ExchangeApiGuide'

const SERVER_IP = '43.203.100.239'

// ── IP 복사 버튼 ──────────────────────────────────────────
function IpCopyBtn() {
  const [copied, setCopied] = useState(false)
  async function handleCopy() {
    try { await navigator.clipboard.writeText(SERVER_IP) } catch {
      const el = document.createElement('textarea'); el.value = SERVER_IP
      document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el)
    }
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={handleCopy} type="button"
      className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition shrink-0 ${
        copied ? 'bg-green-500 text-white' : 'bg-amber-500 text-white hover:bg-amber-600'
      }`}>
      {copied ? <><Check size={12} /> 복사됨</> : <><Copy size={12} /> IP 복사</>}
    </button>
  )
}

// ── 거래소 가입 가이드 모달 ───────────────────────────────
const SIGNUP_EXCHANGES = [
  { key: 'BITHUMB', name: '빗썸',  emoji: '🟠', color: '#E06B00', bank: '국민은행',
    url: 'https://m.bithumb.com/react/referral/guide?referral=XRFYNXZA48', code: 'XRFYNXZA48' },
  { key: 'UPBIT',   name: '업비트', emoji: '🔵', color: '#0D2562', bank: '케이뱅크', url: null, code: null },
  { key: 'COINONE', name: '코인원', emoji: '🟢', color: '#0046FF', bank: '카카오뱅크',
    url: 'https://coinone.co.kr/user/signup?ref=I6T0K0RB', code: 'I6T0K0RB' },
  { key: 'KORBIT',  name: '코빗',  emoji: '🟣', color: '#111111', bank: '신한은행',
    url: 'https://exchange.korbit.co.kr/sign-up/?referral_code=624912', code: '624912' },
  { key: 'GOPAX',   name: '고팍스', emoji: '🟡', color: '#F5A623', bank: '전북은행',
    url: 'https://gopax.onelink.me/Vs7Z/wvekgu0d', code: 'C5Y944' },
]

export function SignupGuideModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-2xl">
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-gray-900">거래소 가입 가이드</h2>
            <p className="mt-0.5 text-xs text-gray-600 break-keep">추천 링크로 가입하면 가입자·추천인 모두 혜택이 있어요</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100"><X size={18} /></button>
        </div>

        {/* 스크롤 영역 */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {/* 안내 */}
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 space-y-1.5">
            <p className="text-xs font-semibold text-amber-800">📋 가입 전 알아두세요</p>
            <p className="text-xs text-amber-700 break-keep">• 거래소는 본인 명의 은행 계좌 연계가 필요합니다. 아래 연계 은행을 확인하세요.</p>
            <p className="text-xs text-amber-700 break-keep">• 이벤트 혜택을 받으려면 마케팅 수신 동의가 필요합니다.</p>
          </div>

          {/* 거래소 카드 */}
          {SIGNUP_EXCHANGES.map((ex) => (
            <div key={ex.key} className="rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center gap-2.5 px-4 py-2.5" style={{ backgroundColor: ex.color + '12' }}>
                <span>{ex.emoji}</span>
                <span className="text-sm font-bold" style={{ color: ex.color }}>{ex.name}</span>
                <span className="ml-auto flex items-center gap-1 text-xs text-gray-600">
                  <span>🏦</span>{ex.bank}
                </span>
              </div>
              {ex.url ? (
                <a href={ex.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition">
                  <div>
                    <p className="text-sm font-semibold text-blue-600">가입 추천 링크로 이동 ↗</p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      추천코드: <span className="font-mono font-bold text-gray-700">{ex.code}</span>
                    </p>
                  </div>
                  <span className="text-gray-400">›</span>
                </a>
              ) : (
                <div className="px-4 py-3">
                  <p className="text-xs text-gray-500">현재 추천 링크 없음 (직접 가입)</p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 하단 버튼 */}
        <div className="border-t px-5 py-4">
          <button onClick={onClose} className="w-full rounded-xl bg-gray-900 py-3 text-sm font-semibold text-white">
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}

// ── API Key 발급 가이드 모달 ─────────────────────────────
const GUIDE_EXCHANGES = [
  { key: 'BITHUMB', label: '빗썸',  emoji: '🟠', color: '#E06B00' },
  { key: 'UPBIT',   label: '업비트', emoji: '🔵', color: '#0D2562' },
  { key: 'COINONE', label: '코인원', emoji: '🟢', color: '#0046FF' },
  { key: 'KORBIT',  label: '코빗',  emoji: '🟣', color: '#555555' },
  { key: 'GOPAX',   label: '고팍스', emoji: '🟡', color: '#D97706' },
]

export function ApiKeyGuideModal({ onClose }: { onClose: () => void }) {
  const [detailExchange, setDetailExchange] = useState<string | null>(null)

  if (detailExchange) {
    return <ExchangeApiGuide exchange={detailExchange} onClose={() => setDetailExchange(null)} />
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-2xl">
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-gray-900">API Key 발급 가이드</h2>
            <p className="mt-0.5 text-xs text-gray-600">거래소 API Key 발급 방법을 안내합니다</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100"><X size={18} /></button>
        </div>

        {/* 스크롤 영역 */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* API Key란? */}
          <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-3.5 space-y-1.5">
            <p className="text-sm font-bold text-blue-800">💡 API Key란?</p>
            <p className="text-xs text-blue-700 leading-relaxed break-keep">
              거래소에서 발급하는 <strong>인증 키</strong>로, MyCoinBot이 내 계정을 대신해 코인을 자동 매수할 수 있게 해줍니다.
            </p>
            <p className="text-xs text-blue-700 break-keep">
              아이디·비밀번호 없이도 거래소 기능을 안전하게 사용할 수 있어요.
            </p>
          </div>

          {/* 공통 주의사항 */}
          <div>
            <p className="mb-2.5 text-sm font-bold text-gray-900">🚨 공통 주의사항</p>
            <div className="space-y-2">
              {/* PC 전용 */}
              <div className="flex items-start gap-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
                <span className="text-base shrink-0">🖥️</span>
                <div>
                  <p className="text-xs font-bold text-red-700">PC 웹에서만 발급 가능</p>
                  <p className="text-xs text-red-600">모바일 앱에서는 발급 불가합니다</p>
                </div>
              </div>
              {/* IP 등록 */}
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-amber-800">⚠️ IP 주소 등록 필수</p>
                    <p className="mt-0.5 font-mono text-sm font-bold text-amber-900">{SERVER_IP}</p>
                  </div>
                  <IpCopyBtn />
                </div>
                <p className="text-xs text-amber-700 break-keep">
                  API Key 발급 시 위 IP를 허용 IP로 등록해야 거래 실행이 가능합니다
                </p>
              </div>
              {/* 입출금 권한 */}
              <div className="flex items-start gap-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
                <span className="text-base shrink-0">🚫</span>
                <div>
                  <p className="text-xs font-bold text-red-700">입출금 권한은 OFF 필수</p>
                  <p className="text-xs text-red-600 break-keep">
                    API Key 유출 시 자산 출금을 막기 위해 입출금 권한은 절대 부여하지 마세요
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 거래소별 상세 가이드 */}
          <div>
            <p className="mb-2.5 text-sm font-bold text-gray-900">📖 거래소별 상세 발급 가이드</p>
            <div className="grid grid-cols-5 gap-2">
              {GUIDE_EXCHANGES.map((ex) => (
                <button key={ex.key} type="button"
                  onClick={() => setDetailExchange(ex.key)}
                  className="flex flex-col items-center gap-1 rounded-xl py-3 text-xs font-bold text-white transition hover:opacity-90 active:scale-95"
                  style={{ backgroundColor: ex.color }}>
                  <span className="text-lg">{ex.emoji}</span>
                  {ex.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 하단 버튼 */}
        <div className="border-t px-5 py-4">
          <button onClick={onClose} className="w-full rounded-xl bg-gray-900 py-3 text-sm font-semibold text-white">
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}
