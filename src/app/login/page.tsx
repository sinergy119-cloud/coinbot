'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const SAVED_ID_KEY = 'coinbot_saved_id'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [userId, setUserId] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [saveId, setSaveId] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // 저장된 아이디 불러오기
  useEffect(() => {
    const saved = localStorage.getItem(SAVED_ID_KEY)
    if (saved) {
      setUserId(saved)
      setSaveId(true)
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!userId.trim() || !password) {
      setError('사용자 ID와 비밀번호를 입력해주세요.')
      return
    }

    if (mode === 'signup' && password !== passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }

    setLoading(true)
    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/signup'
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userId.trim(), password }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || '오류가 발생했습니다.')
        return
      }

      // 아이디 저장 처리
      if (saveId) {
        localStorage.setItem(SAVED_ID_KEY, userId.trim())
      } else {
        localStorage.removeItem(SAVED_ID_KEY)
      }

      router.push('/')
      router.refresh()
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="flex w-full max-w-sm flex-col">
      <div className="rounded-xl bg-white p-8 shadow-lg">
        <h1 className="mb-1 text-center text-2xl font-bold text-gray-900">MyCoinBot</h1>
        <p className="mb-6 text-center text-sm text-gray-500">
          {mode === 'login' ? '로그인' : '회원 생성'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">사용자 ID</label>
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="ID를 입력하세요"
              autoComplete="username"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="비밀번호를 입력하세요"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>

          {mode === 'signup' && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">비밀번호 확인</label>
              <input
                type="password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="비밀번호를 다시 입력하세요"
                autoComplete="new-password"
              />
            </div>
          )}

          {/* 아이디 저장 (로그인 모드만) */}
          {mode === 'login' && (
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={saveId}
                onChange={(e) => setSaveId(e.target.checked)}
                className="accent-blue-600"
              />
              <span className="text-sm text-gray-600">아이디 저장</span>
            </label>
          )}

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? '처리 중...' : mode === 'login' ? '로그인' : '회원 생성'}
          </button>
        </form>

        <button
          onClick={() => {
            setMode(mode === 'login' ? 'signup' : 'login')
            setError('')
          }}
          className="mt-4 w-full text-center text-sm text-blue-600 hover:underline"
        >
          {mode === 'login' ? '계정이 없으신가요? 회원 생성' : '이미 계정이 있으신가요? 로그인'}
        </button>

      </div>

      <p className="mt-2 text-right text-xs text-gray-400">
        Last updated: {process.env.NEXT_PUBLIC_BUILD_TIME}
      </p>
      </div>
    </div>
  )
}
