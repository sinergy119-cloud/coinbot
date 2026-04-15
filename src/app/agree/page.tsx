'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronUp, CheckCircle2, Circle, Loader2 } from 'lucide-react'

interface PendingInfo {
  provider: 'naver' | 'google'
  name: string
  email: string | null
}

const PROVIDER_LABEL: Record<string, string> = { naver: '네이버', google: '구글' }
const PROVIDER_COLOR: Record<string, string> = {
  naver: 'bg-green-500',
  google: 'bg-blue-500',
}

const TERMS = [
  {
    id: 'service',
    title: '서비스 이용약관',
    required: true,
    content: `제1조 (목적)
본 약관은 MyCoinBot(이하 "서비스")이 제공하는 암호화폐 거래 자동화 서비스의 이용 조건을 규정합니다.

제2조 (서비스 이용)
• 서비스는 만 19세 이상 성인만 이용 가능합니다.
• 사용자는 본인의 거래소 API 키를 직접 등록하여 자동 매수 기능을 이용합니다.
• 서비스는 거래 결과에 대한 투자 손실 책임을 지지 않습니다.

제3조 (금지 행위)
• 타인의 계정 또는 API 키 도용
• 비정상적 이용 (자동화 공격, 과도한 요청 등)
• 법령 위반 행위

제4조 (서비스 변경 및 중단)
운영상 필요 시 사전 고지 후 서비스를 변경하거나 중단할 수 있습니다.

제5조 (면책)
암호화폐 투자 손실, 거래소 장애, API 오류로 인한 손해에 대해 서비스는 책임을 지지 않습니다.`,
  },
  {
    id: 'privacy',
    title: '개인정보 수집 및 이용 동의',
    required: true,
    content: `■ 수집 항목
• 소셜 로그인 정보: 닉네임, 이메일 (소셜 제공자로부터 제공)
• 거래소 API 키 (사용자 직접 입력, 암호화 저장)
• 접속 로그 (IP 주소, 브라우저 정보)

■ 이용 목적
• 회원 식별 및 서비스 제공
• 거래 자동화 실행
• 서비스 개선 및 문의 응대

■ 보유 기간
• 회원 탈퇴 시 즉시 삭제
• 단, 관련 법령에 따른 보존 의무가 있는 경우 해당 기간 보유

■ 제3자 제공
이용자의 동의 없이 개인정보를 제3자에게 제공하지 않습니다.
(단, 법령에 의한 경우 예외)`,
  },
]

export default function AgreePage() {
  const router = useRouter()
  const [pending, setPending] = useState<PendingInfo | null>(null)
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [checked, setChecked] = useState<Record<string, boolean>>({})

  const allChecked = TERMS.every((t) => checked[t.id])
  const allRequired = TERMS.filter((t) => t.required).every((t) => checked[t.id])

  useEffect(() => {
    fetch('/api/auth/pending-info')
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((d) => setPending(d))
      .catch(() => setLoadError('가입 정보가 없거나 만료되었습니다. 다시 로그인해주세요.'))
      .finally(() => setLoading(false))
  }, [])

  function toggleAll() {
    const next = !allChecked
    const newChecked: Record<string, boolean> = {}
    TERMS.forEach((t) => { newChecked[t.id] = next })
    setChecked(newChecked)
  }

  function toggleOne(id: string) {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  async function handleSubmit() {
    if (!allRequired || submitting) return
    setSubmitting(true)
    setSubmitError('')
    try {
      const res = await fetch('/api/auth/complete-signup', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setSubmitError(data.error ?? '가입 처리 중 오류가 발생했습니다.')
        return
      }
      router.push(`/?welcome=${data.provider}`)
    } catch {
      setSubmitError('네트워크 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── 로딩 ──
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Loader2 size={32} className="animate-spin text-gray-400" />
      </div>
    )
  }

  // ── 오류 (정보 없음/만료) ──
  if (loadError || !pending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="text-center space-y-3">
          <p className="text-sm text-red-600 break-keep">{loadError}</p>
          <button
            onClick={() => router.push('/login')}
            className="text-sm text-blue-600 underline"
          >
            로그인 페이지로 이동
          </button>
        </div>
      </div>
    )
  }

  // ── 메인 ──
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-10 px-4">
      <div className="w-full max-w-md space-y-4">

        {/* 헤더 */}
        <div className="text-center space-y-2">
          <h1 className="text-xl font-bold text-gray-900">서비스 이용 동의</h1>
          <p className="text-sm text-gray-600 break-keep">
            <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-semibold text-white ${PROVIDER_COLOR[pending.provider] ?? 'bg-gray-500'}`}>
              {PROVIDER_LABEL[pending.provider] ?? pending.provider}
            </span>
            &nbsp;
            <span className="font-medium text-gray-900">{pending.name}</span>
            {pending.email && (
              <span className="text-gray-500"> ({pending.email})</span>
            )}
            <br />
            아래 약관에 동의하시면 가입이 완료됩니다.
          </p>
        </div>

        {/* 전체 동의 */}
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3.5">
          <button onClick={toggleAll} className="flex items-center gap-2.5 w-full">
            {allChecked
              ? <CheckCircle2 size={20} className="text-blue-600 shrink-0" />
              : <Circle size={20} className="text-gray-300 shrink-0" />
            }
            <span className="text-sm font-semibold text-gray-900">전체 동의</span>
          </button>
        </div>

        {/* 개별 약관 */}
        <div className="space-y-2">
          {TERMS.map((term) => (
            <div key={term.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* 체크 + 제목 행 */}
              <div className="px-4 py-3.5 flex items-center gap-2.5">
                <button onClick={() => toggleOne(term.id)} className="shrink-0">
                  {checked[term.id]
                    ? <CheckCircle2 size={20} className="text-blue-600" />
                    : <Circle size={20} className="text-gray-300" />
                  }
                </button>
                <span className="flex-1 text-sm font-medium text-gray-900">
                  {term.title}
                  {term.required && (
                    <span className="ml-1 text-xs font-normal text-red-500">(필수)</span>
                  )}
                </span>
                <button
                  onClick={() => toggleExpand(term.id)}
                  className="shrink-0 text-gray-400 hover:text-gray-600 flex items-center gap-0.5 text-xs"
                >
                  {expanded[term.id] ? (
                    <><span>접기</span><ChevronUp size={14} /></>
                  ) : (
                    <><span>전문</span><ChevronDown size={14} /></>
                  )}
                </button>
              </div>
              {/* 전문 펼침 */}
              {expanded[term.id] && (
                <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 max-h-52 overflow-y-auto">
                  <pre className="text-xs text-gray-600 whitespace-pre-wrap break-keep leading-relaxed font-sans">
                    {term.content}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 가입 버튼 */}
        <button
          onClick={handleSubmit}
          disabled={!allRequired || submitting}
          className="w-full rounded-xl bg-blue-600 py-3.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
        >
          {submitting
            ? <><Loader2 size={16} className="animate-spin" /> 처리 중...</>
            : '동의하고 가입하기'
          }
        </button>

        {submitError && (
          <p className="text-xs text-red-600 text-center break-keep">{submitError}</p>
        )}

        <p className="text-center text-xs text-gray-500">
          <button onClick={() => router.push('/login')} className="underline hover:text-gray-700">
            로그인으로 돌아가기
          </button>
        </p>
      </div>
    </div>
  )
}
