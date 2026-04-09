'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'

const SAVED_ID_KEY = 'coinbot_saved_id'

// ─── 비밀번호 강도 체크 ─────────────────────────────
const PW_RULES = [
  { label: '8자 이상', test: (pw: string) => pw.length >= 8 },
  { label: '영문 포함', test: (pw: string) => /[a-zA-Z]/.test(pw) },
  { label: '숫자 포함', test: (pw: string) => /\d/.test(pw) },
  { label: '특수문자 포함', test: (pw: string) => /[!@#$%^&*()_+\-=[\]{};':"|,.<>/?~`]/.test(pw) },
]

function PasswordStrength({ password }: { password: string }) {
  if (!password) return null
  const passed = PW_RULES.filter((r) => r.test(password)).length
  const ratio = passed / PW_RULES.length
  const barColor = ratio <= 0.25 ? 'bg-red-500' : ratio <= 0.5 ? 'bg-orange-500' : ratio <= 0.75 ? 'bg-yellow-500' : 'bg-green-500'

  return (
    <div className="mt-2 space-y-1.5">
      {/* 강도 바 */}
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 rounded-full bg-gray-200">
          <div className={`h-1.5 rounded-full transition-all duration-300 ${barColor}`} style={{ width: `${ratio * 100}%` }} />
        </div>
        <span className={`text-xs font-medium ${ratio === 1 ? 'text-green-600' : 'text-gray-400'}`}>
          {ratio === 1 ? '안전' : ratio >= 0.75 ? '보통' : '약함'}
        </span>
      </div>
      {/* 요건 목록 */}
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {PW_RULES.map((rule) => {
          const ok = rule.test(password)
          return (
            <span key={rule.label} className={`text-xs ${ok ? 'text-green-600' : 'text-gray-400'}`}>
              {ok ? '✅' : '⬜'} {rule.label}
            </span>
          )
        })}
      </div>
    </div>
  )
}

function isPasswordValid(pw: string) {
  return PW_RULES.every((r) => r.test(pw))
}

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

// ─── 아이디 찾기 모달 ───────────────────────────────
function FindIdModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [result, setResult] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setResult('')
    if (!name.trim() || !email.trim()) { setError('이름과 이메일을 입력해주세요.'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/find-id', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      setResult(data.userId)
    } catch { setError('네트워크 오류') }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <h2 className="mb-4 text-lg font-bold text-gray-900">아이디 찾기</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="이름"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="이메일"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          {error && <p className="text-sm text-red-600">{error}</p>}
          {result && (
            <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-3 text-center">
              <p className="text-xs text-gray-500 mb-1">회원님의 아이디</p>
              <p className="text-lg font-bold text-blue-700">{result}</p>
            </div>
          )}
          <div className="flex gap-2">
            {!result && (
              <button type="submit" disabled={loading}
                className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                {loading ? '조회 중...' : '아이디 찾기'}
              </button>
            )}
            <button type="button" onClick={onClose}
              className="flex-1 rounded-lg bg-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-300">
              닫기
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── 비밀번호 찾기 모달 ─────────────────────────────
function FindPwModal({ onClose }: { onClose: () => void }) {
  const [userId, setUserId] = useState('')
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setSent(false)
    if (!userId.trim() || !email.trim()) { setError('아이디와 이메일을 입력해주세요.'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/find-pw', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userId.trim(), email: email.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      setSent(true)
    } catch { setError('네트워크 오류') }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <h2 className="mb-4 text-lg font-bold text-gray-900">비밀번호 찾기</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input type="text" value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="아이디"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="가입 시 등록한 이메일"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          {error && <p className="text-sm text-red-600">{error}</p>}
          {sent && (
            <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-3 text-center">
              <p className="text-sm font-medium text-green-700">✅ 임시 비밀번호를 이메일로 보냈습니다.</p>
              <p className="text-xs text-green-600 mt-1">로그인 후 반드시 비밀번호를 변경해주세요.</p>
            </div>
          )}
          <div className="flex gap-2">
            {!sent && (
              <button type="submit" disabled={loading}
                className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                {loading ? '발송 중...' : '임시 비밀번호 발급'}
              </button>
            )}
            <button type="button" onClick={onClose}
              className="flex-1 rounded-lg bg-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-300">
              닫기
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── 개인정보처리방침 모달 ───────────────────────────
function PrivacyModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <button onClick={onClose} className="absolute right-3 top-3 rounded-full p-1 text-gray-400 hover:bg-gray-100" aria-label="닫기">
          <X size={20} />
        </button>
        <h2 className="mb-4 text-lg font-bold text-gray-900">개인정보처리방침</h2>
        <div className="space-y-4 text-sm text-gray-600 leading-relaxed">
          <section>
            <h3 className="font-semibold text-gray-800 mb-1">1. 수집하는 개인정보</h3>
            <p>회원가입 시 아이디, 비밀번호(해시), 이름, 전화번호, 이메일을 수집합니다.</p>
          </section>
          <section>
            <h3 className="font-semibold text-gray-800 mb-1">2. 수집 목적</h3>
            <p>서비스 제공, 본인 확인, 고객 연락, 거래 실행을 위해 사용됩니다.</p>
          </section>
          <section>
            <h3 className="font-semibold text-gray-800 mb-1">3. 보유 기간</h3>
            <p>회원 탈퇴 시까지 보유하며, 탈퇴 시 즉시 파기합니다.</p>
          </section>
          <section>
            <h3 className="font-semibold text-gray-800 mb-1">4. 제3자 제공</h3>
            <p>수집된 개인정보는 제3자에게 제공하지 않습니다.</p>
          </section>
          <section>
            <h3 className="font-semibold text-gray-800 mb-1">5. 보안 조치</h3>
            <p>비밀번호는 bcrypt 해싱, API Key는 AES-256-GCM 암호화하여 저장합니다. 접속 이력(IP)은 보안 목적으로 기록됩니다.</p>
          </section>
          <section>
            <h3 className="font-semibold text-gray-800 mb-1">6. 문의</h3>
            <p>개인정보 관련 문의는 관리자에게 연락해주세요.</p>
          </section>
        </div>
        <div className="mt-5 border-t border-gray-100 pt-4">
          <button onClick={onClose} className="w-full rounded-lg bg-gray-800 py-2.5 text-sm font-medium text-white hover:bg-gray-900">닫기</button>
        </div>
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
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [autoLogin, setAutoLogin] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('coinbot_auto_login') === 'true'
    return false
  })
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeModal, setActiveModal] = useState<'service' | 'exchange' | 'find-id' | 'find-pw' | 'privacy' | null>(null)
  const [guideFolded, setGuideFolded] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('coinbot_guide_folded') === 'true'
    return false
  })

  // 자동 로그인: 저장된 아이디 불러오기
  useEffect(() => {
    if (autoLogin) {
      const saved = localStorage.getItem(SAVED_ID_KEY)
      if (saved) setUserId(saved)
    }
  }, [autoLogin])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccessMsg('')

    if (!userId.trim() || !password) {
      setError('사용자 ID와 비밀번호를 입력해주세요.')
      return
    }

    if (mode === 'signup') {
      if (!isPasswordValid(password)) { setError('비밀번호 요건을 모두 충족해주세요. (8자 이상, 영문, 숫자, 특수문자)'); return }
      if (password !== passwordConfirm) { setError('비밀번호가 일치하지 않습니다.'); return }
      if (!name.trim()) { setError('이름을 입력해주세요.'); return }
      if (!phone.trim()) { setError('전화번호를 입력해주세요.'); return }
      if (!email.trim()) { setError('이메일을 입력해주세요.'); return }
    }

    setLoading(true)
    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/signup'
      const body = mode === 'login'
        ? { userId: userId.trim(), password, autoLogin }
        : { userId: userId.trim(), password, name: name.trim(), phone: phone.trim(), email: email.trim() }
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || '오류가 발생했습니다.')
        return
      }

      // 회원가입 → 이메일 인증 안내
      if (data.needVerification) {
        setSuccessMsg(data.message)
        return
      }

      // 자동 로그인: 아이디 저장
      if (autoLogin) {
        localStorage.setItem(SAVED_ID_KEY, userId.trim())
        localStorage.setItem('coinbot_auto_login', 'true')
      } else {
        localStorage.removeItem(SAVED_ID_KEY)
        localStorage.removeItem('coinbot_auto_login')
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
          {mode === 'login' ? '로그인' : '회원 가입'}
        </p>

        {/* 처음이신가요? 접이식 배너 */}
        <div className="mb-5 rounded-lg border border-gray-200 bg-gray-50 overflow-hidden">
          <button
            type="button"
            onClick={() => {
              const next = !guideFolded
              setGuideFolded(next)
              localStorage.setItem('coinbot_guide_folded', String(next))
            }}
            className="flex w-full items-center justify-between px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
          >
            <span>{guideFolded ? '📌 처음이신가요?' : '📌 처음이신가요?'}</span>
            <span className="text-xs text-gray-400">{guideFolded ? '펼치기 ▼' : '접기 ▲'}</span>
          </button>
          {!guideFolded && (
            <div className="border-t border-gray-200 px-4 pb-3 pt-2 space-y-2">
              <button
                type="button"
                onClick={() => setActiveModal('service')}
                className="flex w-full items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm font-medium text-blue-700 transition hover:bg-blue-100"
              >
                <span>📢</span>
                <div className="text-left">
                  <p className="font-semibold">서비스 소개</p>
                  <p className="text-xs font-normal text-blue-500">에어드랍 이벤트란? MyCoinBot 작동 원리</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setActiveModal('exchange')}
                className="flex w-full items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-sm font-medium text-green-700 transition hover:bg-green-100"
              >
                <span>🏦</span>
                <div className="text-left">
                  <p className="font-semibold">거래소 가이드</p>
                  <p className="text-xs font-normal text-green-500">친구 추천 가입 · API Key 발급 방법</p>
                </div>
              </button>
            </div>
          )}
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
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="비밀번호를 입력하세요"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                aria-label={showPw ? '비밀번호 숨기기' : '비밀번호 보기'}
              >
                {showPw ? '🙈' : '👁'}
              </button>
            </div>
            {mode === 'signup' && <PasswordStrength password={password} />}
          </div>

          {mode === 'signup' && (
            <>
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
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">이름</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="실명을 입력하세요"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">전화번호</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="010-1234-5678"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">이메일</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="example@gmail.com"
                />
                <p className="mt-1.5 rounded bg-amber-50 border border-amber-200 px-2.5 py-1.5 text-xs font-medium text-amber-700">📩 회원 가입 시 인증 메일이 발송됩니다.</p>
              </div>
            </>
          )}

          {/* 자동 로그인 + 아이디/비밀번호 찾기 (로그인 모드만) */}
          {mode === 'login' && (
            <div className="flex items-center justify-between">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={autoLogin}
                  onChange={(e) => {
                    setAutoLogin(e.target.checked)
                    if (!e.target.checked) {
                      localStorage.removeItem('coinbot_auto_login')
                      localStorage.removeItem(SAVED_ID_KEY)
                    }
                  }}
                  className="accent-blue-600"
                />
                <span className="text-sm text-gray-600">자동 로그인</span>
              </label>
              <div className="flex gap-2 text-xs text-gray-400">
                <button type="button" onClick={() => setActiveModal('find-id')} className="hover:text-gray-600 hover:underline">아이디 찾기</button>
                <span>|</span>
                <button type="button" onClick={() => setActiveModal('find-pw')} className="hover:text-gray-600 hover:underline">비밀번호 찾기</button>
              </div>
            </div>
          )}

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}
          {successMsg && (
            <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-3 text-center">
              <p className="text-sm font-medium text-green-700">✅ {successMsg}</p>
            </div>
          )}

          {!successMsg && (
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? '처리 중...' : mode === 'login' ? '로그인' : '회원 가입'}
            </button>
          )}
        </form>

        {/* 소셜 로그인 (로그인 모드만) */}
        {mode === 'login' && (
          <div className="mt-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-px flex-1 bg-gray-200" />
              <span className="text-xs text-gray-400">간편 로그인</span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => alert('카카오 로그인은 준비 중입니다.')}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#FEE500] py-2.5 text-sm font-medium text-[#3C1E1E] hover:brightness-95 transition"
              >
                💬 카카오
              </button>
              <button
                type="button"
                onClick={() => alert('네이버 로그인은 준비 중입니다.')}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#03C75A] py-2.5 text-sm font-medium text-white hover:brightness-95 transition"
              >
                N 네이버
              </button>
            </div>
          </div>
        )}

        <button
          onClick={() => {
            setMode(mode === 'login' ? 'signup' : 'login')
            setError('')
            setSuccessMsg('')
          }}
          className="mt-4 w-full text-center text-sm text-blue-600 hover:underline"
        >
          {mode === 'login' ? '계정이 없으신가요? 회원 가입' : '이미 계정이 있으신가요? 로그인'}
        </button>

      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
        <button type="button" onClick={() => setActiveModal('privacy')} className="hover:text-gray-600 hover:underline">
          개인정보처리방침
        </button>
        <span>Last updated: {process.env.NEXT_PUBLIC_BUILD_TIME}</span>
      </div>
      </div>

      {/* 모달 */}
      {activeModal === 'service' && <GuideModal apiUrl="/api/guide" onClose={() => setActiveModal(null)} />}
      {activeModal === 'exchange' && <GuideModal apiUrl="/api/guide-exchange" onClose={() => setActiveModal(null)} />}
      {activeModal === 'find-id' && <FindIdModal onClose={() => setActiveModal(null)} />}
      {activeModal === 'find-pw' && <FindPwModal onClose={() => setActiveModal(null)} />}
      {activeModal === 'privacy' && <PrivacyModal onClose={() => setActiveModal(null)} />}
    </div>
  )
}
