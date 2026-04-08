'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'

const SAVED_ID_KEY = 'coinbot_saved_id'

// ─── 섹션 아이콘/색상 매핑 ──────────────────────────
const SECTION_STYLES: Record<string, { icon: string; color: string }> = {
  '에어드랍':   { icon: '🎁', color: 'text-pink-600' },
  'MyCoinBot': { icon: '🤖', color: 'text-blue-600' },
  '서비스 특징': { icon: '✨', color: 'text-purple-600' },
  '준비사항':   { icon: '📋', color: 'text-indigo-600' },
  '가입 혜택':  { icon: '🎉', color: 'text-amber-600' },
  '유의사항':   { icon: '⚠️', color: 'text-red-600' },
  '한계점':     { icon: '⚠️', color: 'text-red-600' },
  '거래소':     { icon: '🏦', color: 'text-teal-600' },
}

function getSectionStyle(title: string) {
  for (const [keyword, style] of Object.entries(SECTION_STYLES)) {
    if (title.includes(keyword)) return style
  }
  return { icon: '📌', color: 'text-gray-700' }
}

// ─── 거래소 뱃지 색상 ───────────────────────────────
const EXCHANGE_COLORS: Record<string, string> = {
  '빗썸': 'bg-orange-100 text-orange-700',
  '업비트': 'bg-yellow-100 text-yellow-700',
  '코인원': 'bg-blue-100 text-blue-700',
  '코빗': 'bg-purple-100 text-purple-700',
  '고팍스': 'bg-green-100 text-green-700',
}

// ─── 인라인 서식: **bold**, `code`, [text](url) ──────
function formatInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = []
  const regex = /(\*\*(.+?)\*\*|`(.+?)`|\[([^\]]+)\]\((https?:\/\/[^)]+)\))/g
  let lastIndex = 0
  let match
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index))
    if (match[2]) parts.push(<b key={match.index} className="font-semibold text-gray-900">{match[2]}</b>)
    else if (match[3]) parts.push(<code key={match.index} className="rounded bg-gray-100 px-1 py-0.5 text-xs font-mono text-pink-600">{match[3]}</code>)
    else if (match[4] && match[5]) parts.push(
      <a key={match.index} href={match[5]} target="_blank" rel="noopener noreferrer"
        className="font-medium text-blue-600 underline hover:text-blue-800">{match[4]}</a>
    )
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return parts.length === 1 ? parts[0] : parts
}

// ─── 리치 Markdown → JSX 렌더러 ─────────────────────
function renderMarkdown(md: string) {
  const lines = md.split('\n')
  const elements: React.ReactNode[] = []
  let tableRows: string[][] = []
  let inTable = false
  let inCodeBlock = false
  let codeLines: string[] = []
  let listItems: { key: number; text: string }[] = []
  let stepCounter = 0

  // 거래소 테이블을 뱃지로 변환할지 판단
  function isExchangeTable(rows: string[][]) {
    return rows.some((r) => r.some((c) => c.includes('빗썸') || c.includes('업비트')))
  }

  function flushList() {
    if (listItems.length === 0) return
    elements.push(
      <ul key={`list-${elements.length}`} className="my-2 space-y-1.5">
        {listItems.map((item) => (
          <li key={item.key} className="flex items-start gap-2 text-sm text-gray-600">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400" />
            <span>{formatInline(item.text)}</span>
          </li>
        ))}
      </ul>
    )
    listItems = []
  }

  function flushTable() {
    if (tableRows.length === 0) return
    const header = tableRows[0]
    const body = tableRows.slice(2)

    // 거래소 목록 테이블 → 뱃지로 변환
    if (isExchangeTable(body)) {
      elements.push(
        <div key={`tbl-${elements.length}`} className="my-3 flex flex-wrap gap-2">
          {body.map((row, ri) => {
            const name = row[0]?.trim() ?? ''
            const note = row[1]?.trim() ?? ''
            const colorCls = EXCHANGE_COLORS[name] ?? 'bg-gray-100 text-gray-700'
            return (
              <span key={ri} className={`rounded-full px-3 py-1.5 text-xs font-medium ${colorCls}`}>
                {name} {note && note !== '✅' ? `· ${note.replace('✅ ', '')}` : ''}
              </span>
            )
          })}
        </div>
      )
      tableRows = []
      return
    }

    // 일반 테이블 → 카드형 테이블
    elements.push(
      <div key={`tbl-${elements.length}`} className="my-3 overflow-hidden rounded-lg border border-gray-200">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-50">
              {header.map((cell, i) => (
                <th key={i} className="px-3 py-2 text-left font-semibold text-gray-700">{formatInline(cell.trim())}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((row, ri) => (
              <tr key={ri} className="border-t border-gray-100">
                {row.map((cell, ci) => (
                  <td key={ci} className="px-3 py-2 text-gray-600">{formatInline(cell.trim())}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
    tableRows = []
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/\r$/, '')

    // 코드 블록 → 플로우 다이어그램 스타일
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        // 화살표(→, ↓)가 포함된 코드블록은 플로우 다이어그램으로 렌더링
        const content = codeLines.join('\n')
        const isFlow = content.includes('↓') || content.includes('→')
        if (isFlow) {
          const steps = codeLines.filter((l) => l.trim())
          elements.push(
            <div key={`code-${i}`} className="my-3 rounded-lg border border-blue-100 bg-blue-50 p-3 space-y-1">
              {steps.map((step, si) => {
                const trimmed = step.trim()
                if (trimmed === '↓') return <p key={si} className="text-blue-400 pl-4 text-xs">↓</p>
                // ⚠ 또는 "반드시" 포함 → 빨간색 강조
                const isAlert = trimmed.includes('⚠') || trimmed.includes('반드시')
                if (isAlert) {
                  return <p key={si} className="text-xs font-semibold text-red-600">🚨 {trimmed.replace(/^→\s*/, '').replace(/^⚠\s*/, '')}</p>
                }
                // 번호 매기기
                const num = trimmed.match(/^\[(.+?)\]/) || trimmed.match(/^[①②③④⑤]/)
                return (
                  <p key={si} className={`text-xs ${num ? 'font-medium text-blue-800' : 'text-blue-700'}`}>{trimmed}</p>
                )
              })}
            </div>
          )
        } else {
          elements.push(
            <pre key={`code-${i}`} className="my-3 rounded-lg bg-gray-800 p-3 text-xs text-green-300 overflow-x-auto whitespace-pre-wrap">
              {content}
            </pre>
          )
        }
        codeLines = []
        inCodeBlock = false
      } else {
        flushList()
        if (inTable) { flushTable(); inTable = false }
        inCodeBlock = true
      }
      continue
    }
    if (inCodeBlock) { codeLines.push(line); continue }

    // 테이블
    if (line.includes('|') && line.trim().startsWith('|')) {
      flushList()
      const cells = line.split('|').slice(1, -1)
      if (!inTable) inTable = true
      tableRows.push(cells)
      continue
    } else if (inTable) {
      flushTable()
      inTable = false
    }

    // 빈 줄
    if (line.trim() === '') { flushList(); continue }

    // # 대제목
    if (line.startsWith('# ')) {
      flushList()
      elements.push(
        <h2 key={i} className="mb-1 text-xl font-bold text-gray-900">{line.slice(2).trim()}</h2>
      )
      continue
    }

    // ## 섹션 제목 → 아이콘 + 컬러
    if (line.startsWith('## ')) {
      flushList()
      stepCounter = 0
      const title = line.slice(3).trim()
      const style = getSectionStyle(title)
      elements.push(
        <h3 key={i} className="mt-6 mb-2 flex items-center gap-2 text-sm font-bold text-gray-800">
          <span className="text-lg">{style.icon}</span>
          <span>{title}</span>
        </h3>
      )
      continue
    }

    // ### 소제목
    if (line.startsWith('### ')) {
      flushList()
      const title = line.slice(4).trim()
      elements.push(
        <h4 key={i} className="mt-3 mb-1.5 text-xs font-bold text-gray-700">{title}</h4>
      )
      continue
    }

    // > 블록쿼트 → 강조 배너 (⚠ 시작이면 빨간색, 아니면 파란색)
    if (line.startsWith('> ')) {
      flushList()
      const text = line.slice(2).trim()
      const isWarningBanner = text.startsWith('⚠')
      elements.push(
        <p key={i} className={`my-2 rounded-lg border-l-4 px-3 py-2.5 text-sm font-medium ${
          isWarningBanner
            ? 'border-red-400 bg-red-50 text-red-700'
            : 'border-blue-400 bg-blue-50 text-blue-700'
        }`}>
          {formatInline(text)}
        </p>
      )
      continue
    }

    // --- 수평선
    if (line.trim().match(/^---+$/)) {
      flushList()
      elements.push(<hr key={i} className="my-4 border-gray-100" />)
      continue
    }

    // - 리스트 아이템 (모아서 한번에 렌더링)
    if (line.match(/^- /)) {
      listItems.push({ key: i, text: line.slice(2) })
      continue
    }

    // 번호+화살표 패턴 (①, ②, ③) → 스텝 카드
    if (line.match(/^[①②③④⑤⑥⑦⑧⑨⑩]/)) {
      flushList()
      stepCounter++
      const text = line.replace(/^[①②③④⑤⑥⑦⑧⑨⑩]\s*/, '')
      elements.push(
        <div key={i} className="flex items-start gap-2.5 rounded-lg bg-gray-50 p-2.5 my-1">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
            {stepCounter}
          </span>
          <p className="text-xs text-gray-700">{formatInline(text)}</p>
        </div>
      )
      continue
    }

    // → 하위 설명 (화살표 들여쓰기)
    if (line.match(/^\s+→/)) {
      flushList()
      const text = line.replace(/^\s+→\s*/, '')
      const isWarning = text.includes('반드시') || text.includes('제외')
      elements.push(
        <p key={i} className={`ml-8 text-xs ${isWarning ? 'font-semibold text-red-500' : 'text-gray-500'}`}>
          {isWarning ? '⚠ ' : '→ '}{formatInline(text)}
        </p>
      )
      continue
    }

    // *이탤릭 텍스트* → 푸터
    if (line.startsWith('*') && line.endsWith('*') && !line.startsWith('**')) {
      flushList()
      elements.push(
        <div key={i} className="mt-4 border-t border-gray-100 pt-3 text-center">
          <p className="text-xs text-gray-400 italic">{line.slice(1, -1)}</p>
        </div>
      )
      continue
    }

    // 일반 텍스트
    flushList()
    elements.push(<p key={i} className="text-sm text-gray-600 leading-relaxed">{formatInline(line)}</p>)
  }
  flushList()
  if (inTable) flushTable()

  return elements
}

// ─── 범용 가이드 모달 ───────────────────────────────
function GuideModal({ apiUrl, onClose }: { apiUrl: string; onClose: () => void }) {
  const [content, setContent] = useState<string | null>(null)

  useEffect(() => {
    fetch(apiUrl)
      .then((r) => r.json())
      .then((d) => setContent(d.content ?? ''))
      .catch(() => setContent('내용을 불러올 수 없습니다.'))
  }, [apiUrl])

  function handleBackdrop(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={handleBackdrop}
    >
      <div className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          aria-label="닫기"
        >
          <X size={20} />
        </button>

        {content === null ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-gray-400 animate-pulse">로딩 중...</p>
          </div>
        ) : (
          <>
            <div>{renderMarkdown(content)}</div>
            <div className="mt-5 border-t border-gray-100 pt-4">
              <button
                onClick={onClose}
                className="w-full rounded-lg bg-gray-800 py-2.5 text-sm font-medium text-white hover:bg-gray-900 transition"
              >
                닫기
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [userId, setUserId] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [saveId, setSaveId] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeModal, setActiveModal] = useState<'service' | 'exchange' | null>(null)

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
        <p className="mb-3 text-center text-sm text-gray-500">
          {mode === 'login' ? '로그인' : '회원 생성'}
        </p>

        {/* 가이드 버튼 */}
        <div className="mb-5 flex gap-2">
          <button
            type="button"
            onClick={() => setActiveModal('service')}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm font-medium text-blue-700 transition hover:bg-blue-100"
          >
            📢 서비스 소개
          </button>
          <button
            type="button"
            onClick={() => setActiveModal('exchange')}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-sm font-medium text-green-700 transition hover:bg-green-100"
          >
            🏦 거래소 가이드
          </button>
        </div>

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

      {/* 서비스 소개 모달 */}
      {activeModal === 'service' && <GuideModal apiUrl="/api/guide" onClose={() => setActiveModal(null)} />}
      {activeModal === 'exchange' && <GuideModal apiUrl="/api/guide-exchange" onClose={() => setActiveModal(null)} />}
    </div>
  )
}
