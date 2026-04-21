'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AppLoginPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState('')

  // 이미 로그인된 경우 /app으로 이동
  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => {
        if (d.loginId) { router.replace('/app'); return }
        setChecking(false)
      })
      .catch(() => setChecking(false))
  }, [router])

  // OAuth 에러 파라미터 처리
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const err = params.get('error')
    if (err) {
      const messages: Record<string, string> = {
        kakao_failed:   '카카오 로그인에 실패했습니다. 다시 시도해주세요.',
        kakao_token:    '카카오 인증에 실패했습니다. 다시 시도해주세요.',
        kakao_config:   '카카오 로그인 설정 오류입니다.',
        kakao_signup:   '가입 처리 중 오류가 발생했습니다.',
        suspended:      '이용이 정지된 계정입니다. 관리자에게 문의하세요.',
        naver_failed:   '네이버 로그인에 실패했습니다. 다시 시도해주세요.',
        naver_token:    '네이버 인증에 실패했습니다. 다시 시도해주세요.',
        naver_user:     '네이버 사용자 정보를 가져올 수 없습니다.',
        naver_signup:   '가입 처리 중 오류가 발생했습니다.',
        naver_config:   '네이버 로그인 설정 오류입니다.',
        google_failed:  '구글 로그인에 실패했습니다. 다시 시도해주세요.',
        google_token:   '구글 인증에 실패했습니다. 다시 시도해주세요.',
        google_user:    '구글 사용자 정보를 가져올 수 없습니다.',
        google_signup:  '가입 처리 중 오류가 발생했습니다.',
        google_config:  '구글 로그인 설정 오류입니다.',
      }
      setError(messages[err] ?? `로그인 오류: ${err}`)
      window.history.replaceState({}, '', '/app/login')
    }
  }, [])

  function handleKakao() {
    const clientId = process.env.NEXT_PUBLIC_KAKAO_REST_API_KEY
    if (!clientId) { setError('카카오 로그인 설정이 누락되었습니다.'); return }
    const redirectUri = `${window.location.origin}/api/auth/kakao/callback`
    const state = Math.random().toString(36).slice(2)
    sessionStorage.setItem('oauth_state', state)
    window.location.href = `https://kauth.kakao.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&state=${state}`
  }

  function handleNaver() {
    const clientId = process.env.NEXT_PUBLIC_NAVER_CLIENT_ID
    if (!clientId) { setError('네이버 로그인 설정이 누락되었습니다.'); return }
    const state = Math.random().toString(36).slice(2)
    const redirectUri = `${window.location.origin}/api/auth/naver/callback`
    window.location.href = `https://nid.naver.com/oauth2.0/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&state=${state}`
  }

  function handleGoogle() {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
    if (!clientId) { setError('구글 로그인 설정이 누락되었습니다.'); return }
    const redirectUri = `${window.location.origin}/api/auth/google/callback`
    const state = Math.random().toString(36).slice(2)
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=openid email profile&state=${state}`
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500 animate-pulse">로딩 중...</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-10">
      <div className="w-full max-w-sm flex flex-col gap-4">

        {/* 헤더 */}
        <div className="text-center mb-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-192.png" alt="MyCoinBot" className="mx-auto mb-3 h-16 w-16 rounded-2xl shadow-md" />
          <h1 className="text-2xl font-bold text-gray-900">MyCoinBot</h1>
          <p className="mt-1 text-sm text-gray-600 break-keep">코인 에어드랍 이벤트 자동 참여</p>
        </div>

        {/* 오류 메시지 */}
        {error && (
          <p className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600 text-center break-keep">{error}</p>
        )}

        {/* 소셜 로그인 */}
        <div className="rounded-2xl bg-white p-5 shadow-sm flex flex-col gap-3">
          <p className="text-center text-xs font-semibold text-gray-500 tracking-wider mb-1">간편 로그인</p>

          {/* 카카오 */}
          <button
            type="button"
            onClick={handleKakao}
            className="relative flex w-full items-center justify-center rounded-xl bg-[#FEE500] py-3.5 text-sm font-semibold text-[#3C1E1E] hover:brightness-95 transition active:scale-[0.98]"
          >
            <span className="absolute left-4">
              <svg width="22" height="22" viewBox="0 0 40 40">
                <ellipse cx="20" cy="19" rx="17" ry="15" fill="#3C1E1E"/>
                <circle cx="13" cy="19" r="2.5" fill="#FEE500"/>
                <circle cx="20" cy="19" r="2.5" fill="#FEE500"/>
                <circle cx="27" cy="19" r="2.5" fill="#FEE500"/>
                <polygon points="14,26 17,32 23,26" fill="#FEE500"/>
              </svg>
            </span>
            카카오로 시작하기
          </button>

          {/* 네이버 */}
          <button
            type="button"
            onClick={handleNaver}
            className="relative flex w-full items-center justify-center rounded-xl bg-[#03C75A] py-3.5 text-sm font-semibold text-white hover:brightness-95 transition active:scale-[0.98]"
          >
            <span className="absolute left-4">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M13.547 12.836L10.204 8H8v8h2.453V12.164L13.796 17H16V9h-2.453z" fill="white"/>
              </svg>
            </span>
            네이버로 시작하기
          </button>

          {/* 구글 */}
          <button
            type="button"
            onClick={handleGoogle}
            className="relative flex w-full items-center justify-center rounded-xl border border-gray-200 bg-white py-3.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition active:scale-[0.98]"
          >
            <span className="absolute left-4">
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            </span>
            구글로 시작하기
          </button>
        </div>

        <p className="text-center text-xs text-gray-500 break-keep px-2">
          로그인 시 <button type="button" className="underline hover:text-gray-700">개인정보처리방침</button>에 동의하게 됩니다.
        </p>
      </div>
    </div>
  )
}
