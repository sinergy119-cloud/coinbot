'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isPinSet, listKeys } from '@/lib/app/key-store'

const ONBOARDING_KEY = 'mcb_onboarding_v1'

type Step = 'loading' | 'onboarding' | 'no_pin' | 'no_keys' | 'done'

export default function OnboardingBanner() {
  const [step, setStep] = useState<Step>('loading')
  const router = useRouter()

  useEffect(() => {
    ;(async () => {
      try {
        // 1) 온보딩 위저드를 아직 완료하지 않은 경우
        const onboardingDone = localStorage.getItem(ONBOARDING_KEY)
        if (!onboardingDone) { setStep('onboarding'); return }

        // 2) PIN 미설정
        const hasPin = await isPinSet()
        if (!hasPin) { setStep('no_pin'); return }

        // 3) API Key 미등록
        const keys = await listKeys()
        if (keys.length === 0) { setStep('no_keys'); return }

        setStep('done')
      } catch {
        setStep('done') // 오류 시 배너 숨김
      }
    })()
  }, [])

  if (step === 'loading' || step === 'done') return null

  // ── 온보딩 위저드 배너 (최초 사용자) ──────────────────────────
  if (step === 'onboarding') {
    return (
      <section className="px-4">
        <button
          type="button"
          onClick={() => router.push('/app/onboarding')}
          className="w-full block rounded-2xl p-5 text-left active:opacity-90 transition-opacity break-keep"
          style={{
            background: 'linear-gradient(135deg, #0064FF 0%, #003EAD 100%)',
            boxShadow: '0 4px 20px rgba(0,100,255,0.3)',
          }}
        >
          <div className="flex items-start gap-4">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(255,255,255,0.2)' }}
            >
              <span className="text-[26px]">🚀</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.75)' }}>
                시작 가이드 · 2단계
              </p>
              <p className="text-[17px] font-bold leading-snug" style={{ color: '#fff' }}>
                MyCoinBot 시작하기
              </p>
              <p className="text-[12px] mt-1.5 leading-relaxed" style={{ color: 'rgba(255,255,255,0.8)' }}>
                거래소 가입부터 API Key 등록까지{'\n'}단계별로 안내해드려요
              </p>
              <p className="text-[13px] font-semibold mt-3" style={{ color: '#fff' }}>
                시작 가이드 보기 →
              </p>
            </div>
          </div>
        </button>
      </section>
    )
  }

  // ── PIN / API Key 설정 배너 ────────────────────────────────
  const content = step === 'no_pin'
    ? {
        progress: 0,
        total: 2,
        title: 'PIN을 먼저 설정해주세요',
        desc: 'API Key를 안전하게 보관하려면 PIN이 필요해요',
        cta: 'PIN 설정하기 →',
        href: '/app/profile/api-keys',
      }
    : {
        progress: 1,
        total: 2,
        title: '거래소 API Key를 등록하면\n자동 매수를 시작할 수 있어요',
        desc: '빗썸·업비트 등 거래소 API Key를 등록하세요',
        cta: 'API Key 등록하기 →',
        href: '/app/profile/api-keys',
      }

  return (
    <section className="px-4">
      <button
        type="button"
        onClick={() => router.push(content.href)}
        className="w-full block rounded-2xl p-5 text-left active:opacity-90 transition-opacity break-keep"
        style={{ background: '#0064FF' }}
      >
        {/* 진행 단계 텍스트 */}
        <p className="text-[11px] font-semibold mb-2" style={{ color: 'rgba(255,255,255,0.7)' }}>
          시작 설정 {content.progress}/{content.total} 완료
        </p>

        {/* 진행 바 */}
        <div className="w-full h-1 rounded-full mb-3" style={{ background: 'rgba(255,255,255,0.25)' }}>
          <div
            className="h-full rounded-full"
            style={{ width: `${(content.progress / content.total) * 100}%`, background: '#fff' }}
          />
        </div>

        {/* 타이틀 */}
        <p className="text-[17px] font-bold leading-snug whitespace-pre-line" style={{ color: '#fff' }}>
          {content.title}
        </p>

        {/* 설명 */}
        <p className="text-[12px] mt-1.5 leading-relaxed" style={{ color: 'rgba(255,255,255,0.75)' }}>
          {content.desc}
        </p>

        {/* CTA */}
        <p className="text-[13px] font-semibold mt-3" style={{ color: '#fff' }}>
          {content.cta}
        </p>
      </button>
    </section>
  )
}
