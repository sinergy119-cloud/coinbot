'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import ExchangeApiGuide from '@/components/ExchangeApiGuide'
import { setOAuthStateCookieOnClient } from '@/lib/oauthState'

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

const EXCHANGE_COLORS: Record<string, string> = {
  '빗썸': 'bg-orange-100 text-orange-700',
  '업비트': 'bg-yellow-100 text-yellow-700',
  '코인원': 'bg-blue-100 text-blue-700',
  '코빗': 'bg-purple-100 text-purple-700',
  '고팍스': 'bg-green-100 text-green-700',
}
const EXCHANGE_ICON_BG: Record<string, string> = {
  '빗썸': 'bg-orange-50',
  '업비트': 'bg-yellow-50',
  '코인원': 'bg-green-50',
  '코빗': 'bg-pink-50',
  '고팍스': 'bg-purple-50',
}
const EXCHANGE_ICON_EMOJI: Record<string, string> = {
  '빗썸': '🟠',
  '업비트': '🟡',
  '코인원': '🟢',
  '코빗': '🔵',
  '고팍스': '🟣',
}

function formatInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = []
  const regex = /(\*\*(.+?)\*\*|`(.+?)`|\[([^\]]+)\]\((https?:\/\/[^)]+)\))/g
  let lastIndex = 0
  let match
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index))
    if (match[2]) parts.push(<b key={match.index} className="font-semibold text-gray-900">{formatInline(match[2])}</b>)
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

function renderMarkdown(md: string) {
  const lines = md.split('\n')
  const elements: React.ReactNode[] = []
  let tableRows: string[][] = []
  let inTable = false
  let inCodeBlock = false
  let codeLines: string[] = []
  let listItems: { key: number; text: string }[] = []
  let stepCounter = 0

  function isExchangeTable(rows: string[][]) {
    return rows.some((r) => r.some((c) => c.includes('빗썸') || c.includes('업비트')))
  }

  function flushList() {
    if (listItems.length === 0) return
    const exchangeNames = ['빗썸', '업비트', '코인원', '코빗', '고팍스']
    const isReferralList = listItems.length >= 3 && listItems.every(
      (item) => exchangeNames.some((name) => item.text.includes(`**${name}**`) || item.text.includes(`[${name}]`))
    )
    if (isReferralList) {
      const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/
      elements.push(
        <div key={`cards-${elements.length}`} className="my-3 grid grid-cols-2 gap-2.5">
          {listItems.map((item) => {
            const linkMatch = item.text.match(linkRegex)
            const boldMatch = item.text.match(/\*\*([^[*]+)\*\*/)
            const name = linkMatch?.[1] ?? boldMatch?.[1] ?? ''
            const url = linkMatch?.[2] ?? ''
            const hasLink = !!url
            const codeMatch = item.text.match(/추천코드:\s*(\S+)/)
            const referralCode = codeMatch?.[1] ?? ''
            const desc = item.text.includes('추천 없음') ? '추천 없음' : referralCode ? `추천코드: ${referralCode}` : '추천 가입'
            const iconBg = EXCHANGE_ICON_BG[name] ?? 'bg-gray-50'
            const emoji = EXCHANGE_ICON_EMOJI[name] ?? '⚪'
            if (!hasLink) {
              return (
                <div key={item.key} className="flex items-center gap-2.5 rounded-xl border border-gray-100 bg-white px-3 py-3 opacity-40">
                  <span className={`flex h-9 w-9 items-center justify-center rounded-lg text-lg ${iconBg}`}>{emoji}</span>
                  <span className="flex-1"><span className="block text-xs font-bold text-gray-900">{name}</span><span className="block text-[10px] text-gray-600">{desc}</span></span>
                </div>
              )
            }
            return (
              <a key={item.key} href={url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2.5 rounded-xl border border-gray-200 bg-white px-3 py-3 transition hover:border-blue-300 hover:bg-blue-50 hover:shadow-sm">
                <span className={`flex h-9 w-9 items-center justify-center rounded-lg text-lg ${iconBg}`}>{emoji}</span>
                <span className="flex-1">
                  <span className="block text-xs font-bold text-gray-900">{name}</span>
                  {referralCode
                    ? <span className="block text-[10px] text-amber-600">추천코드: <b>{referralCode}</b></span>
                    : <span className="block text-[10px] text-gray-600">{desc}</span>}
                </span>
                <span className="text-sm text-gray-300">›</span>
              </a>
            )
          })}
        </div>
      )
      listItems = []
      return
    }
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
    elements.push(
      <div key={`tbl-${elements.length}`} className="my-3 overflow-hidden rounded-lg border border-gray-200">
        <table className="w-full text-xs border-collapse">
          <thead><tr className="bg-gray-50">{header.map((cell, i) => <th key={i} className="px-3 py-2 text-left font-semibold text-gray-700">{formatInline(cell.trim())}</th>)}</tr></thead>
          <tbody>{body.map((row, ri) => <tr key={ri} className="border-t border-gray-100">{row.map((cell, ci) => <td key={ci} className="px-3 py-2 text-gray-600">{formatInline(cell.trim())}</td>)}</tr>)}</tbody>
        </table>
      </div>
    )
    tableRows = []
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/\r$/, '')
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        const content = codeLines.join('\n')
        const isFlow = content.includes('↓') || content.includes('→')
        if (isFlow) {
          const steps = codeLines.filter((l) => l.trim())
          elements.push(
            <div key={`code-${i}`} className="my-3 rounded-lg border border-blue-100 bg-blue-50 p-3 space-y-1">
              {steps.map((step, si) => {
                const trimmed = step.trim()
                if (trimmed === '↓') return <p key={si} className="text-blue-400 pl-4 text-xs">↓</p>
                const isAlert = trimmed.includes('⚠') || trimmed.includes('반드시')
                if (isAlert) return <p key={si} className="text-xs font-semibold text-red-600">🚨 {trimmed.replace(/^→\s*/, '').replace(/^⚠\s*/, '')}</p>
                const num = trimmed.match(/^\[(.+?)\]/) || trimmed.match(/^[①②③④⑤]/)
                return <p key={si} className={`text-xs ${num ? 'font-medium text-blue-800' : 'text-blue-700'}`}>{trimmed}</p>
              })}
            </div>
          )
        } else {
          elements.push(<pre key={`code-${i}`} className="my-3 rounded-lg bg-gray-800 p-3 text-xs text-green-300 overflow-x-auto whitespace-pre-wrap">{content}</pre>)
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
    if (line.includes('|') && line.trim().startsWith('|')) {
      flushList()
      const cells = line.split('|').slice(1, -1)
      if (!inTable) inTable = true
      tableRows.push(cells)
      continue
    } else if (inTable) { flushTable(); inTable = false }
    if (line.trim() === '') { flushList(); continue }
    if (line.startsWith('# ')) { flushList(); elements.push(<h2 key={i} className="mb-1 text-xl font-bold text-gray-900">{line.slice(2).trim()}</h2>); continue }
    if (line.startsWith('## ')) {
      flushList(); stepCounter = 0
      const title = line.slice(3).trim()
      const style = getSectionStyle(title)
      elements.push(<h3 key={i} className="mt-6 mb-2 flex items-center gap-2 text-sm font-bold text-gray-800"><span className="text-lg">{style.icon}</span><span>{title}</span></h3>)
      continue
    }
    if (line.startsWith('### ')) { flushList(); elements.push(<h4 key={i} className="mt-3 mb-1.5 text-xs font-bold text-gray-700">{line.slice(4).trim()}</h4>); continue }
    if (line.startsWith('> ')) {
      flushList()
      const text = line.slice(2).trim()
      const isWarn = text.startsWith('⚠')
      elements.push(<p key={i} className={`my-2 rounded-lg border-l-4 px-3 py-2.5 text-sm font-medium ${isWarn ? 'border-red-400 bg-red-50 text-red-700' : 'border-blue-400 bg-blue-50 text-blue-700'}`}>{formatInline(text)}</p>)
      continue
    }
    if (line.trim().match(/^---+$/)) { flushList(); elements.push(<hr key={i} className="my-4 border-gray-100" />); continue }
    if (line.match(/^- /)) { listItems.push({ key: i, text: line.slice(2) }); continue }
    if (line.match(/^[①②③④⑤⑥⑦⑧⑨⑩]/)) {
      flushList(); stepCounter++
      const text = line.replace(/^[①②③④⑤⑥⑦⑧⑨⑩]\s*/, '')
      elements.push(
        <div key={i} className="flex items-start gap-2.5 rounded-lg bg-gray-50 p-2.5 my-1">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">{stepCounter}</span>
          <p className="text-xs text-gray-700">{formatInline(text)}</p>
        </div>
      )
      continue
    }
    if (line.match(/^\s+→/)) {
      flushList()
      const text = line.replace(/^\s+→\s*/, '')
      const isWarning = text.includes('반드시') || text.includes('제외')
      elements.push(<p key={i} className={`ml-8 text-xs ${isWarning ? 'font-semibold text-red-500' : 'text-gray-500'}`}>{isWarning ? '⚠ ' : '→ '}{formatInline(text)}</p>)
      continue
    }
    if (line.startsWith('*') && line.endsWith('*') && !line.startsWith('**')) {
      flushList()
      elements.push(<div key={i} className="mt-4 border-t border-gray-100 pt-3 text-center"><p className="text-xs text-gray-600 italic">{line.slice(1, -1)}</p></div>)
      continue
    }
    flushList()
    elements.push(<p key={i} className="text-sm text-gray-600 leading-relaxed break-keep">{formatInline(line)}</p>)
  }
  flushList()
  if (inTable) flushTable()
  return elements
}

function GuideModal({ apiUrl, onClose, footer }: { apiUrl: string; onClose: () => void; footer?: React.ReactNode }) {
  const [content, setContent] = useState<string | null>(null)
  useEffect(() => {
    fetch(apiUrl).then((r) => r.json()).then((d) => setContent(d.content ?? '')).catch(() => setContent('내용을 불러올 수 없습니다.'))
  }, [apiUrl])
  function handleBackdrop(e: React.MouseEvent) { if (e.target === e.currentTarget) onClose() }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={handleBackdrop}>
      <div className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <button onClick={onClose} className="absolute right-3 top-3 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600" aria-label="닫기"><X size={20} /></button>
        {content === null ? (
          <div className="flex items-center justify-center py-12"><p className="text-sm text-gray-500 animate-pulse">로딩 중...</p></div>
        ) : (
          <>
            <div>{renderMarkdown(content)}</div>
            {footer}
            <div className="mt-5 border-t border-gray-100 pt-4">
              <button onClick={onClose} className="w-full rounded-lg bg-gray-800 py-2.5 text-sm font-medium text-white hover:bg-gray-900 transition">닫기</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function PrivacyModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <button onClick={onClose} className="absolute right-3 top-3 rounded-full p-1 text-gray-400 hover:bg-gray-100" aria-label="닫기"><X size={20} /></button>
        <h2 className="mb-4 text-lg font-bold text-gray-900">개인정보처리방침</h2>
        <div className="space-y-4 text-sm text-gray-600 leading-relaxed">
          <section><h3 className="font-semibold text-gray-800 mb-1">1. 수집하는 개인정보</h3><p>소셜 로그인(카카오·네이버·구글) 시 해당 플랫폼이 제공하는 닉네임, 이메일을 수집합니다.</p></section>
          <section><h3 className="font-semibold text-gray-800 mb-1">2. 수집 목적</h3><p>서비스 제공, 본인 확인, 고객 연락, 거래 실행을 위해 사용됩니다.</p></section>
          <section><h3 className="font-semibold text-gray-800 mb-1">3. 보유 기간</h3><p>회원 탈퇴 시까지 보유하며, 탈퇴 시 즉시 파기합니다.</p></section>
          <section><h3 className="font-semibold text-gray-800 mb-1">4. 제3자 제공</h3><p>수집된 개인정보는 제3자에게 제공하지 않습니다.</p></section>
          <section><h3 className="font-semibold text-gray-800 mb-1">5. 보안 조치</h3><p>거래소 API Key는 AES-256-GCM 암호화하여 저장합니다.</p></section>
          <section><h3 className="font-semibold text-gray-800 mb-1">6. 문의</h3><p>개인정보 관련 문의는 관리자에게 연락해주세요.</p></section>
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
  const [checking, setChecking] = useState(true)
  const [showAdminLogin, setShowAdminLogin] = useState(false)
  const [oauthError, setOauthError] = useState('')
  const [activeModal, setActiveModal] = useState<'service' | 'signup' | 'apikey' | 'apikey-detail' | 'privacy' | null>(null)
  const [guideExchange, setGuideExchange] = useState('BITHUMB')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const err = params.get('error')
      if (err) {
        const errorMessages: Record<string, string> = {
          kakao_disabled: '카카오 로그인은 현재 준비 중입니다.',
          suspended: '이용이 정지된 계정입니다. 관리자에게 문의하세요.',
          not_admin: '관리자 계정이 아닙니다. 일반 사용자는 앱을 이용해주세요.',
          oauth_state_mismatch: '로그인 요청이 만료되었거나 변조되었습니다. 다시 시도해주세요.',
        }
        setOauthError(errorMessages[err] ?? `로그인 오류: ${err}`)
        window.history.replaceState({}, '', '/login')
        setShowAdminLogin(true)
      }
    }
  }, [])

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => {
        if (d.loginId) { router.push('/'); router.refresh(); return }
        setChecking(false)
      })
      .catch(() => setChecking(false))
  }, [router])

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-400 animate-pulse">로딩 중...</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-gray-50 px-4 py-10">
      <div className="w-full max-w-sm flex flex-col gap-4">

        {/* ── 헤더 ── */}
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-192.png" alt="MyCoinBot" className="mx-auto mb-3 h-16 w-16 rounded-2xl shadow-md" />
          <h1 className="text-2xl font-bold text-gray-900">MyCoinBot</h1>
          <p className="mt-1 text-sm text-gray-600 break-keep">코인 에어드랍 이벤트 관리</p>
        </div>

        {/* ── 서비스 안내 ── */}
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="mb-3 text-xs font-semibold text-gray-700">📌 서비스 안내</p>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setActiveModal('service')}
              className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm font-medium text-blue-700 transition hover:bg-blue-100"
            >
              <span>📢</span>
              <div className="text-left">
                <p className="font-semibold text-sm">서비스 소개</p>
                <p className="text-xs font-normal text-blue-500 break-keep">에어드랍 이벤트란? MyCoinBot 작동 원리</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setActiveModal('signup')}
              className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-3 py-2.5 text-sm font-medium text-green-700 transition hover:bg-green-100"
            >
              <span>🏦</span>
              <div className="text-left">
                <p className="font-semibold text-sm">거래소 가입</p>
                <p className="text-xs font-normal text-green-500">친구 추천 가입 링크</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setActiveModal('apikey')}
              className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm font-medium text-amber-700 transition hover:bg-amber-100"
            >
              <span>🔑</span>
              <div className="text-left">
                <p className="font-semibold text-sm">API Key 발급</p>
                <p className="text-xs font-normal text-amber-500">거래소별 API Key 발급 방법</p>
              </div>
            </button>
          </div>
        </div>

        {/* ── 앱 열기 ── */}
        <a
          href="/app"
          className="flex items-center justify-center gap-2 rounded-2xl bg-gray-900 py-3.5 text-sm font-semibold text-white transition active:scale-95"
        >
          앱 열기 →
        </a>

        {/* ── 카카오톡 문의 ── */}
        <a
          href="https://open.kakao.com/o/sUAoiJpi"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white py-2 text-xs font-medium text-gray-600 hover:border-yellow-400 hover:bg-yellow-50 transition"
        >
          <span>💬</span>
          <span>궁금한 점이 있으신가요? <span className="text-yellow-700 font-semibold">카카오톡 1:1 문의</span></span>
        </a>

        {/* ── 관리자 로그인 (숨겨진) ── */}
        {!showAdminLogin ? (
          <div className="text-center">
            <button
              type="button"
              onClick={() => setShowAdminLogin(true)}
              className="text-xs text-gray-400 hover:text-gray-600 transition underline-offset-2 hover:underline"
            >
              관리자 로그인
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="mb-3 text-center text-xs font-semibold text-gray-700">🔐 관리자 로그인</p>
            {oauthError && (
              <p className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600 text-center break-keep">{oauthError}</p>
            )}
            <button
              type="button"
              onClick={() => {
                const clientId = process.env.NEXT_PUBLIC_KAKAO_REST_API_KEY
                const redirectUri = `${window.location.origin}/api/auth/kakao/callback`
                const state = Math.random().toString(36).slice(2)
                setOAuthStateCookieOnClient(state)
                window.location.href = `https://kauth.kakao.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&state=${state}`
              }}
              className="relative flex w-full items-center justify-center rounded-xl bg-[#FEE500] py-3 text-sm font-semibold text-[#3C1E1E] hover:brightness-95 transition"
            >
              <span className="absolute left-3.5 flex items-center justify-center">
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
            <button
              type="button"
              onClick={() => { setShowAdminLogin(false); setOauthError('') }}
              className="mt-2 w-full text-center text-xs text-gray-400 hover:text-gray-600"
            >
              닫기
            </button>
          </div>
        )}

        {/* ── 푸터 ── */}
        <div className="flex items-center justify-between text-xs text-gray-500 pb-4">
          <button type="button" onClick={() => setActiveModal('privacy')} className="hover:text-gray-700 hover:underline">
            개인정보처리방침
          </button>
          <span>{process.env.NEXT_PUBLIC_BUILD_TIME}</span>
        </div>
      </div>

      {/* ── 모달 ── */}
      {activeModal === 'service' && <GuideModal apiUrl="/api/guide" onClose={() => setActiveModal(null)} />}
      {activeModal === 'signup' && <GuideModal apiUrl="/api/guide-signup" onClose={() => setActiveModal(null)} />}
      {activeModal === 'apikey' && (
        <GuideModal apiUrl="/api/guide-apikey" onClose={() => setActiveModal(null)} footer={
          <div className="mt-4 rounded-lg border border-purple-200 bg-purple-50 p-3">
            <p className="mb-2 text-xs font-bold text-purple-800">📖 거래소별 상세 발급 가이드</p>
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'BITHUMB', label: '🟠 빗썸' },
                { key: 'UPBIT', label: '🔵 업비트' },
                { key: 'COINONE', label: '🟢 코인원' },
                { key: 'KORBIT', label: '🟣 코빗' },
                { key: 'GOPAX', label: '🟡 고팍스' },
              ].map((ex) => (
                <button
                  key={ex.key}
                  onClick={() => { setGuideExchange(ex.key); setActiveModal('apikey-detail') }}
                  className="rounded-full bg-purple-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-purple-700"
                >
                  {ex.label}
                </button>
              ))}
            </div>
          </div>
        } />
      )}
      {activeModal === 'apikey-detail' && (
        <ExchangeApiGuide exchange={guideExchange} onClose={() => setActiveModal('apikey')} />
      )}
      {activeModal === 'privacy' && <PrivacyModal onClose={() => setActiveModal(null)} />}
    </div>
  )
}
