'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import WithdrawModal from '@/components/WithdrawModal'

interface Profile {
  userId: string
  name: string | null
  email: string | null
  phone: string | null
}

interface Settings {
  masterEnabled: boolean
  eventEnabled: boolean
  tradeResultEnabled: boolean
  scheduleEnabled: boolean
  systemEnabled: boolean
  announcementEnabled: boolean
}

/* ── 소셜 제공자 파싱 ── */
type Provider = 'kakao' | 'naver' | 'google' | 'unknown'

function getProvider(userId: string): Provider {
  if (userId.startsWith('kakao_')) return 'kakao'
  if (userId.startsWith('naver_')) return 'naver'
  if (userId.startsWith('google_')) return 'google'
  return 'unknown'
}

/* ── 로고 컴포넌트 ── */
function KakaoLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect width="20" height="20" rx="5" fill="#FEE500"/>
      <path
        d="M10 4C6.686 4 4 6.09 4 8.667c0 1.62 1.02 3.046 2.567 3.872l-.656 2.44a.2.2 0 0 0 .306.216l2.85-1.895A7.4 7.4 0 0 0 10 13.333c3.314 0 6-2.09 6-4.666C16 6.09 13.314 4 10 4z"
        fill="#3C1E1E"
      />
    </svg>
  )
}

function NaverLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect width="20" height="20" rx="5" fill="#03C75A"/>
      <path
        d="M11.386 10.22L8.46 5.5H5.5v9h3.114V9.78L11.54 14.5H14.5V5.5h-3.114v4.72z"
        fill="white"
      />
    </svg>
  )
}

function GoogleLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect width="20" height="20" rx="5" fill="white" stroke="#E5E7EB"/>
      <path d="M17.6 10.2c0-.57-.05-1.12-.14-1.64H10v3.1h4.26a3.65 3.65 0 0 1-1.58 2.4v2h2.55c1.5-1.38 2.37-3.4 2.37-5.86z" fill="#4285F4"/>
      <path d="M10 18c2.14 0 3.93-.71 5.24-1.92l-2.55-2a5.4 5.4 0 0 1-2.69.74c-2.07 0-3.82-1.4-4.45-3.27H2.9v2.06A7.99 7.99 0 0 0 10 18z" fill="#34A853"/>
      <path d="M5.55 11.55A4.8 4.8 0 0 1 5.3 10c0-.54.09-1.07.25-1.55V6.39H2.9A7.99 7.99 0 0 0 2 10c0 1.29.31 2.51.9 3.61l2.65-2.06z" fill="#FBBC05"/>
      <path d="M10 5.18c1.17 0 2.22.4 3.04 1.2l2.28-2.28A7.94 7.94 0 0 0 10 2 7.99 7.99 0 0 0 2.9 6.39l2.65 2.06C6.18 6.58 7.93 5.18 10 5.18z" fill="#EA4335"/>
    </svg>
  )
}

function ProviderBadge({ userId }: { userId: string }) {
  const provider = getProvider(userId)
  const map: Record<Provider, { logo: React.ReactNode; label: string; bg: string; text: string }> = {
    kakao:   { logo: <KakaoLogo />,  label: '카카오',  bg: 'bg-yellow-50',  text: 'text-yellow-800' },
    naver:   { logo: <NaverLogo />,  label: '네이버',  bg: 'bg-green-50',   text: 'text-green-800'  },
    google:  { logo: <GoogleLogo />, label: '구글',    bg: 'bg-blue-50',    text: 'text-blue-800'   },
    unknown: { logo: null,           label: '소셜',    bg: 'bg-gray-100',   text: 'text-gray-700'   },
  }
  const { logo, label, bg, text } = map[provider]
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${bg} ${text}`}>
      {logo}
      {label} 로그인
    </span>
  )
}

/* ── 메인 페이지 ── */
export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [notifOpen, setNotifOpen] = useState(false)
  const [withdrawOpen, setWithdrawOpen] = useState(false)

  useEffect(() => {
    (async () => {
      try {
        const [pRes, sRes] = await Promise.all([
          fetch('/api/user/profile'),
          fetch('/api/app/notification-settings'),
        ])
        const pJson = await pRes.json()
        const sJson = await sRes.json()
        if (pJson && (pJson.user_id || pJson.userId)) {
          setProfile({
            userId: pJson.user_id ?? pJson.userId,
            name: pJson.name ?? null,
            email: pJson.email ?? null,
            phone: pJson.phone ?? null,
          })
        }
        if (sJson.ok) setSettings(sJson.data)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  async function toggleSetting(key: keyof Settings) {
    if (!settings) return
    const next = { ...settings, [key]: !settings[key] }
    setSettings(next)
    try {
      const res = await fetch('/api/app/notification-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: next[key] }),
      })
      const json = await res.json()
      if (json.ok) setSettings(json.data)
    } catch {
      setSettings(settings)
    }
  }

  async function logout() {
    if (!confirm('로그아웃 하시겠습니까?')) return
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/app/login'
  }

  if (loading) {
    return <div className="p-8 text-center text-sm text-gray-600">불러오는 중...</div>
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="px-4 pt-6 pb-2 break-keep">
        <h1 className="text-2xl font-bold text-gray-900">내 정보</h1>
      </header>

      {/* 프로필 카드 */}
      <section className="px-4">
        <div className="bg-white rounded-2xl p-5 break-keep space-y-3">

          {/* 로그인 방식 */}
          {profile?.userId && (
            <div>
              <p className="text-xs text-gray-600 mb-1">로그인 방식</p>
              <ProviderBadge userId={profile.userId} />
            </div>
          )}

          {/* 닉네임 */}
          {profile?.name && (
            <div>
              <p className="text-xs text-gray-600">닉네임</p>
              <p className="text-sm font-semibold text-gray-900 mt-0.5">{profile.name}</p>
            </div>
          )}

          {/* 이메일 */}
          {profile?.email && (
            <div>
              <p className="text-xs text-gray-600">이메일</p>
              <p className="text-sm text-gray-900 mt-0.5">{profile.email}</p>
            </div>
          )}

        </div>
      </section>

      {/* 알림 설정 */}
      <section className="px-4">
        <h2 className="text-base font-bold text-gray-900 mb-2">알림 설정</h2>
        <div className="bg-white rounded-2xl overflow-hidden">

          <SettingRow
            label="전체 알림"
            description="꺼짐 시 모든 알림이 오지 않습니다"
            value={settings?.masterEnabled}
            onChange={() => toggleSetting('masterEnabled')}
          />

          <Divider />
          <NotifAccordionHeader
            open={notifOpen}
            disabled={!settings?.masterEnabled}
            settings={settings}
            onClick={() => setNotifOpen((v) => !v)}
          />

          {notifOpen && (
            <>
              <Divider />
              <SettingRow label="거래 결과" description="스케줄·즉시 거래 체결 결과" value={settings?.tradeResultEnabled} onChange={() => toggleSetting('tradeResultEnabled')} disabled={!settings?.masterEnabled} indent />
              <Divider />
              <SettingRow label="신규 이벤트" description="새 에어드랍·N빵 공지" value={settings?.eventEnabled} onChange={() => toggleSetting('eventEnabled')} disabled={!settings?.masterEnabled} indent />
              <Divider />
              <SettingRow label="스케줄 변경" description="스케줄 등록·실행 알림" value={settings?.scheduleEnabled} onChange={() => toggleSetting('scheduleEnabled')} disabled={!settings?.masterEnabled} indent />
              <Divider />
              <SettingRow label="시스템 경고" description="연속 실패 등 중요 경고" value={settings?.systemEnabled} onChange={() => toggleSetting('systemEnabled')} disabled={!settings?.masterEnabled} indent />
              <Divider />
              <SettingRow label="공지·프로모션" description="운영 공지사항 (기본 꺼짐)" value={settings?.announcementEnabled} onChange={() => toggleSetting('announcementEnabled')} disabled={!settings?.masterEnabled} indent />
            </>
          )}
        </div>
      </section>

      {/* 보안 */}
      <section className="px-4">
        <h2 className="text-base font-bold text-gray-900 mb-2">보안</h2>
        <div className="bg-white rounded-2xl overflow-hidden">
          <a href="/app/profile/api-keys" className="flex items-center justify-between p-4 active:bg-gray-100">
            <div className="break-keep pr-3">
              <p className="text-sm font-semibold text-gray-900">거래소 API Key</p>
              <p className="text-xs text-gray-600 mt-0.5">기기에만 저장 · PIN 잠금</p>
            </div>
            <span className="text-gray-400">→</span>
          </a>
        </div>
      </section>

      {/* 기타 */}
      <section className="px-4">
        <div className="bg-white rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={logout}
            className="w-full flex items-center justify-between p-4 active:bg-gray-100 text-left"
          >
            <span className="text-sm text-red-600 font-semibold">로그아웃</span>
            <span className="text-gray-400">→</span>
          </button>
          <div className="h-px bg-gray-100 mx-4" />
          <button
            type="button"
            onClick={() => setWithdrawOpen(true)}
            className="w-full flex items-center justify-between p-4 active:bg-gray-100 text-left"
          >
            <span className="text-sm text-gray-600">회원탈퇴</span>
            <span className="text-gray-400">→</span>
          </button>
        </div>
      </section>

      <div className="px-4 py-4 text-center">
        <p className="text-[10px] text-gray-600">MyCoinBot v1.0.0</p>
      </div>

      {withdrawOpen && (
        <WithdrawModal
          onClose={() => setWithdrawOpen(false)}
          loginPath="/app/login"
          schedulePath="/app/schedule"
          tradeJobsApiPath="/api/app/trade-jobs"
        />
      )}
    </div>
  )
}

function NotifAccordionHeader({ open, disabled, settings, onClick }: {
  open: boolean
  disabled: boolean | undefined
  settings: Settings | null
  onClick: () => void
}) {
  const subKeys: (keyof Settings)[] = ['tradeResultEnabled', 'eventEnabled', 'scheduleEnabled', 'systemEnabled', 'announcementEnabled']
  const enabledCount = settings ? subKeys.filter((k) => settings[k]).length : 0
  const label = open
    ? '세부 설정 접기'
    : enabledCount > 0
      ? `세부 설정 (${enabledCount}개 켜짐)`
      : '세부 설정'

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center justify-between px-4 py-3.5 transition-colors active:bg-gray-50 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
    >
      <div className="break-keep">
        <p className="text-sm font-semibold text-gray-900 text-left">{label}</p>
        {!open && (
          <p className="text-xs text-gray-600 mt-0.5 text-left">거래 결과, 이벤트 등 개별 설정</p>
        )}
      </div>
      {open
        ? <ChevronUp size={18} className="shrink-0 text-gray-500" />
        : <ChevronDown size={18} className="shrink-0 text-gray-500" />
      }
    </button>
  )
}

function SettingRow({ label, description, value, onChange, disabled, indent }: {
  label: string
  description: string
  value: boolean | undefined
  onChange: () => void
  disabled?: boolean
  indent?: boolean
}) {
  const on = !!value
  return (
    <div className={`flex items-center justify-between px-4 py-3.5 ${indent ? 'pl-7 bg-gray-50/60' : ''} ${disabled ? 'opacity-40' : ''}`}>
      <div className="break-keep pr-3">
        <p className="text-sm font-semibold text-gray-900">{label}</p>
        <p className="text-xs text-gray-600 mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        onClick={onChange}
        disabled={disabled}
        className={`shrink-0 w-12 h-7 rounded-full transition-colors ${on ? 'bg-gray-900' : 'bg-gray-300'} disabled:cursor-not-allowed`}
      >
        <span
          className={`block w-5 h-5 bg-white rounded-full shadow transform transition-transform ${on ? 'translate-x-6' : 'translate-x-1'}`}
        />
      </button>
    </div>
  )
}

function Divider() {
  return <div className="h-px bg-gray-100 mx-4" />
}
