'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { isPinSet, listKeys } from '@/lib/app/key-store'

type Step = 'loading' | 'no_pin' | 'no_keys' | 'done'

export default function OnboardingBanner() {
  const [step, setStep] = useState<Step>('loading')

  useEffect(() => {
    ;(async () => {
      try {
        const hasPin = await isPinSet()
        if (!hasPin) { setStep('no_pin'); return }
        const keys = await listKeys()
        if (keys.length === 0) { setStep('no_keys'); return }
        setStep('done')
      } catch {
        setStep('done') // 오류 시 배너 숨김
      }
    })()
  }, [])

  if (step === 'loading' || step === 'done') return null

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
      <Link
        href={content.href}
        className="block rounded-2xl p-5 active:opacity-90 transition-opacity break-keep"
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
      </Link>
    </section>
  )
}
