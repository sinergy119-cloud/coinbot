'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const ONBOARDING_KEY = 'mcb_onboarding_v1'

// ── 거래소 데이터 ─────────────────────────────────────────────
const EXCHANGES = [
  {
    key: 'BITHUMB',
    name: '빗썸',
    color: '#C94B00',
    bg: '#FFF0E6',
    bank: '국민은행',
    url: 'https://m.bithumb.com/react/referral/guide?referral=XRFYNXZA48',
    code: 'XRFYNXZA48',
    desc: '국내 최대 거래량',
  },
  {
    key: 'UPBIT',
    name: '업비트',
    color: '#0050CC',
    bg: '#E6F0FF',
    bank: '케이뱅크',
    url: null,
    code: null,
    desc: '카카오 연동 간편 가입',
  },
  {
    key: 'COINONE',
    name: '코인원',
    color: '#007A30',
    bg: '#E6F9EE',
    bank: '카카오뱅크',
    url: 'https://coinone.co.kr/user/signup?ref=I6T0K0RB',
    code: 'I6T0K0RB',
    desc: '카카오뱅크 연동',
  },
  {
    key: 'KORBIT',
    name: '코빗',
    color: '#5B21B6',
    bg: '#F3EEFF',
    bank: '신한은행',
    url: 'https://exchange.korbit.co.kr/sign-up/?referral_code=624912',
    code: '624912',
    desc: '신한은행 연동',
  },
  {
    key: 'GOPAX',
    name: '고팍스',
    color: '#946200',
    bg: '#FFFBE6',
    bank: '전북은행',
    url: 'https://gopax.page.link/NBr3KXjjhirrQEUP9',
    code: 'C5Y944',
    desc: '전북은행 연동',
  },
]

// ── 서비스 특징 ───────────────────────────────────────────────
const FEATURES = [
  { icon: '📡', title: '이벤트 자동 수집', desc: '5개 거래소 에어드랍·N빵 공지를\n자동으로 모아 한눈에 보여줘요' },
  { icon: '⚡', title: '즉시 자동 매수', desc: '이벤트 코인을 한 번의 탭으로\n자동 매수할 수 있어요' },
  { icon: '📅', title: '스케줄 등록', desc: '원하는 코인을 정해진 시간에\n자동으로 매수하도록 예약해요' },
  { icon: '🔒', title: '기기 내 보안 저장', desc: 'API Key는 이 기기에만 저장되고\n서버에는 절대 보내지 않아요' },
]

// ── 단계 인디케이터 ───────────────────────────────────────────
function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="rounded-full transition-all duration-300"
          style={{
            width: i === current ? 20 : 6,
            height: 6,
            background: i === current ? '#0064FF' : '#E5E8EB',
          }}
        />
      ))}
    </div>
  )
}

// ── 화면 1: 서비스 소개 ───────────────────────────────────────
function Step1({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  return (
    <div className="flex flex-col min-h-full">
      {/* 상단 */}
      <div className="flex justify-end px-4 pt-4">
        <button
          type="button"
          onClick={onSkip}
          className="text-[13px] font-semibold"
          style={{ color: '#B0B8C1' }}
        >
          건너뛰기
        </button>
      </div>

      {/* 로고 + 타이틀 */}
      <div className="flex flex-col items-center px-6 pt-6 pb-8">
        <div
          className="w-20 h-20 rounded-3xl flex items-center justify-center mb-5"
          style={{ background: '#0064FF', boxShadow: '0 12px 32px rgba(0,100,255,0.35)' }}
        >
          <span className="text-[40px]">🪙</span>
        </div>
        <h1 className="text-[26px] font-bold text-center break-keep" style={{ color: '#191F28' }}>
          MyCoinBot
        </h1>
        <p className="text-[15px] mt-2 text-center break-keep leading-relaxed" style={{ color: '#6B7684' }}>
          거래소 이벤트를 자동으로 잡아드리는{'\n'}스마트 코인 봇
        </p>
      </div>

      {/* 특징 리스트 */}
      <div className="flex-1 px-4 space-y-3">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="flex items-start gap-4 rounded-2xl px-4 py-4"
            style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
          >
            <span className="text-[28px] shrink-0 mt-0.5">{f.icon}</span>
            <div className="break-keep">
              <p className="text-[15px] font-semibold" style={{ color: '#191F28' }}>{f.title}</p>
              <p className="text-[13px] mt-0.5 leading-relaxed whitespace-pre-line" style={{ color: '#6B7684' }}>{f.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* 하단 */}
      <div className="px-4 pt-6 pb-8 space-y-3">
        <StepDots current={0} total={3} />
        <button
          type="button"
          onClick={onNext}
          className="w-full py-4 rounded-2xl text-[16px] font-bold"
          style={{ background: '#0064FF', color: '#fff' }}
        >
          시작하기 →
        </button>
      </div>
    </div>
  )
}

// ── 화면 2: 거래소 가입 ───────────────────────────────────────
function Step2({ onNext, onBack, onSkip }: { onNext: () => void; onBack: () => void; onSkip: () => void }) {
  return (
    <div className="flex flex-col min-h-full">
      {/* 상단 */}
      <div className="flex items-center justify-between px-4 pt-4">
        <button type="button" onClick={onBack} className="text-[22px] leading-none" style={{ color: '#B0B8C1' }}>←</button>
        <button type="button" onClick={onSkip} className="text-[13px] font-semibold" style={{ color: '#B0B8C1' }}>건너뛰기</button>
      </div>

      <div className="px-4 pt-4 pb-5 break-keep">
        <p className="text-[13px] font-semibold mb-1" style={{ color: '#0064FF' }}>STEP 1</p>
        <h2 className="text-[22px] font-bold" style={{ color: '#191F28' }}>거래소 계정 준비</h2>
        <p className="text-[14px] mt-1.5 leading-relaxed" style={{ color: '#6B7684' }}>
          아직 거래소 계정이 없다면 추천 링크로 가입하세요.
          가입자·추천인 모두 혜택을 받을 수 있어요!
        </p>
      </div>

      {/* 주의사항 */}
      <div
        className="mx-4 rounded-2xl px-4 py-3 mb-4 break-keep"
        style={{ background: '#FFFBE6', border: '1px solid #FFF0A8' }}
      >
        <p className="text-[12px] font-semibold mb-1" style={{ color: '#946200' }}>📋 가입 전 알아두세요</p>
        <p className="text-[12px] leading-relaxed" style={{ color: '#946200' }}>
          거래소 가입은 <strong>본인 명의 은행 계좌</strong> 연계가 필요합니다.
          아래 연계 은행을 미리 확인해주세요.
        </p>
      </div>

      {/* 거래소 카드 목록 */}
      <div className="flex-1 px-4 space-y-2.5 overflow-y-auto">
        {EXCHANGES.map((ex) => (
          <div
            key={ex.key}
            className="rounded-2xl overflow-hidden"
            style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
          >
            {/* 거래소 헤더 */}
            <div className="flex items-center justify-between px-4 py-3" style={{ background: ex.bg }}>
              <div>
                <span className="text-[15px] font-bold" style={{ color: ex.color }}>{ex.name}</span>
                <span className="ml-2 text-[11px]" style={{ color: ex.color }}>{ex.desc}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[11px]" style={{ color: ex.color }}>🏦 {ex.bank}</span>
              </div>
            </div>
            {/* 가입 링크 */}
            {ex.url ? (
              <a
                href={ex.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between px-4 py-3 active:bg-gray-50 transition-colors"
              >
                <div className="break-keep">
                  <p className="text-[13px] font-semibold" style={{ color: '#0064FF' }}>친구 추천 링크로 가입하기 ↗</p>
                  <p className="text-[11px] mt-0.5" style={{ color: '#B0B8C1' }}>
                    추천코드: <span className="font-mono font-bold" style={{ color: '#6B7684' }}>{ex.code}</span>
                  </p>
                </div>
                <span style={{ color: '#B0B8C1' }}>›</span>
              </a>
            ) : (
              <div className="px-4 py-3">
                <p className="text-[12px] break-keep" style={{ color: '#6B7684' }}>직접 가입 (추천 링크 없음)</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 하단 */}
      <div className="px-4 pt-5 pb-8 space-y-3">
        <StepDots current={1} total={3} />
        <button
          type="button"
          onClick={onNext}
          className="w-full py-4 rounded-2xl text-[16px] font-bold"
          style={{ background: '#0064FF', color: '#fff' }}
        >
          계정 준비 완료 →
        </button>
        <p className="text-center text-[12px] break-keep" style={{ color: '#B0B8C1' }}>
          이미 계정이 있으면 바로 다음으로 넘어가세요
        </p>
      </div>
    </div>
  )
}

// ── 화면 3: API Key 안내 ──────────────────────────────────────
function Step3({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const router = useRouter()

  function handleGoApiKeys() {
    markDone()
    router.replace('/app/profile/api-keys')
  }

  return (
    <div className="flex flex-col min-h-full">
      {/* 상단 */}
      <div className="flex items-center px-4 pt-4">
        <button type="button" onClick={onBack} className="text-[22px] leading-none" style={{ color: '#B0B8C1' }}>←</button>
      </div>

      <div className="px-4 pt-4 pb-5 break-keep">
        <p className="text-[13px] font-semibold mb-1" style={{ color: '#0064FF' }}>STEP 2</p>
        <h2 className="text-[22px] font-bold" style={{ color: '#191F28' }}>API Key 등록</h2>
        <p className="text-[14px] mt-1.5 leading-relaxed" style={{ color: '#6B7684' }}>
          거래소 API Key를 등록하면 자동 매수를 바로 시작할 수 있어요.
        </p>
      </div>

      {/* API Key 설명 카드 */}
      <div className="flex-1 px-4 space-y-3">
        {/* API Key란? */}
        <div
          className="rounded-2xl px-4 py-4 break-keep"
          style={{ background: '#E6F0FF', border: '1px solid #BFDBFE' }}
        >
          <p className="text-[14px] font-bold mb-2" style={{ color: '#0050CC' }}>💡 API Key란?</p>
          <p className="text-[13px] leading-relaxed" style={{ color: '#0050CC' }}>
            거래소에서 발급하는 <strong>인증 키</strong>로, MyCoinBot이 내 계정을 대신해 코인을 자동 매수할 수 있게 해줘요.
            아이디·비밀번호 없이도 안전하게 사용할 수 있습니다.
          </p>
        </div>

        {/* 필수 사항 */}
        <div
          className="rounded-2xl px-4 py-4"
          style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
        >
          <p className="text-[14px] font-bold mb-3" style={{ color: '#191F28' }}>📋 발급 전 체크리스트</p>
          <div className="space-y-2.5">
            {[
              { icon: '🖥️', text: 'PC 웹에서만 발급 가능 (모바일 앱 불가)', color: '#FF4D4F', bg: '#FFF0F0' },
              { icon: '🌐', text: 'IP 주소 43.203.100.239 를 허용 IP로 등록', color: '#946200', bg: '#FFFBE6' },
              { icon: '🚫', text: '입출금 권한은 절대 부여 금지', color: '#FF4D4F', bg: '#FFF0F0' },
              { icon: '🔒', text: 'API Key는 이 기기에만 저장 (서버 미전송)', color: '#007A30', bg: '#E6F9EE' },
            ].map((item) => (
              <div
                key={item.icon}
                className="flex items-start gap-3 rounded-xl px-3 py-2.5 break-keep"
                style={{ background: item.bg }}
              >
                <span className="text-[16px] shrink-0 mt-0.5">{item.icon}</span>
                <p className="text-[12px] font-medium leading-relaxed" style={{ color: item.color }}>{item.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 진행 순서 */}
        <div
          className="rounded-2xl px-4 py-4 break-keep"
          style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
        >
          <p className="text-[14px] font-bold mb-3" style={{ color: '#191F28' }}>🚀 API Key 등록 순서</p>
          <div className="space-y-2">
            {[
              'PIN 6자리 설정 (기기에서 키를 암호화)',
              'PC에서 거래소 API Key 발급',
              '앱에서 Access Key + Secret Key 입력',
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[12px] font-bold"
                  style={{ background: '#0064FF', color: '#fff' }}
                >
                  {i + 1}
                </div>
                <p className="text-[13px] pt-0.5" style={{ color: '#374151' }}>{step}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 하단 버튼 */}
      <div className="px-4 pt-5 pb-8 space-y-3">
        <StepDots current={2} total={3} />
        <button
          type="button"
          onClick={handleGoApiKeys}
          className="w-full py-4 rounded-2xl text-[16px] font-bold"
          style={{ background: '#0064FF', color: '#fff' }}
        >
          🔑 API Key 등록하러 가기
        </button>
        <button
          type="button"
          onClick={onDone}
          className="w-full py-3 rounded-2xl text-[14px] font-semibold"
          style={{ background: '#F2F4F6', color: '#6B7684' }}
        >
          나중에 등록하기
        </button>
      </div>
    </div>
  )
}

// ── localStorage 유틸 ─────────────────────────────────────────
function markDone() {
  try { localStorage.setItem(ONBOARDING_KEY, '1') } catch { /* ignore */ }
}

// ── 메인 페이지 ───────────────────────────────────────────────
export default function OnboardingPage() {
  const [step, setStep] = useState(0)
  const router = useRouter()

  // 이미 완료한 경우 홈으로 리다이렉트 (뒤로가기로 돌아왔을 때)
  useEffect(() => {
    try {
      const done = localStorage.getItem(ONBOARDING_KEY)
      if (done) router.replace('/app')
    } catch { /* ignore */ }
  }, [router])

  function handleSkip() {
    markDone()
    router.replace('/app')
  }

  function handleDone() {
    markDone()
    router.replace('/app')
  }

  return (
    <div
      className="flex flex-col"
      style={{ background: '#F9FAFB', minHeight: '100dvh' }}
    >
      {step === 0 && <Step1 onNext={() => setStep(1)} onSkip={handleSkip} />}
      {step === 1 && <Step2 onNext={() => setStep(2)} onBack={() => setStep(0)} onSkip={handleSkip} />}
      {step === 2 && <Step3 onDone={handleDone} onBack={() => setStep(1)} />}
    </div>
  )
}
