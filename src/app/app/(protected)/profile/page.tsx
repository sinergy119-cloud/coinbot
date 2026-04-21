'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

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

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [notifOpen, setNotifOpen] = useState(false)

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
    setSettings(next) // optimistic
    try {
      const res = await fetch('/api/app/notification-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: next[key] }),
      })
      const json = await res.json()
      if (json.ok) setSettings(json.data)
    } catch {
      // 롤백
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
        <div className="bg-white rounded-2xl p-5 break-keep">
          <p className="text-xs text-gray-600">아이디</p>
          <p className="text-base font-semibold text-gray-900 mt-0.5">{profile?.userId ?? '-'}</p>
          {profile?.name && (
            <>
              <p className="text-xs text-gray-600 mt-3">이름</p>
              <p className="text-sm text-gray-900 mt-0.5">{profile.name}</p>
            </>
          )}
          {profile?.email && (
            <>
              <p className="text-xs text-gray-600 mt-3">이메일</p>
              <p className="text-sm text-gray-900 mt-0.5">{profile.email}</p>
            </>
          )}
        </div>
      </section>

      {/* 알림 설정 */}
      <section className="px-4">
        <h2 className="text-base font-bold text-gray-900 mb-2">알림 설정</h2>
        <div className="bg-white rounded-2xl overflow-hidden">

          {/* 전체 알림 — 항상 표시 */}
          <SettingRow
            label="전체 알림"
            description="꺼짐 시 모든 알림이 오지 않습니다"
            value={settings?.masterEnabled}
            onChange={() => toggleSetting('masterEnabled')}
          />

          {/* 세부 설정 아코디언 헤더 */}
          <Divider />
          <NotifAccordionHeader
            open={notifOpen}
            disabled={!settings?.masterEnabled}
            settings={settings}
            onClick={() => setNotifOpen((v) => !v)}
          />

          {/* 세부 항목 — 펼쳐질 때만 표시 */}
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
        </div>
      </section>

      <div className="px-4 py-4 text-center">
        <p className="text-[10px] text-gray-600">MyCoinBot v1.0.0</p>
      </div>
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
