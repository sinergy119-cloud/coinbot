'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import WithdrawModal from '@/components/WithdrawModal'
import PinPad from '../../_components/PinPad'
import {
  isPinSet,
  verifyPin,
  isBiometricAvailable,
  isBiometricRegistered,
  registerBiometric,
  removeBiometric,
} from '@/lib/app/key-store'

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

type Provider = 'kakao' | 'naver' | 'google' | 'unknown'

function getProvider(userId: string): Provider {
  if (userId.startsWith('kakao_')) return 'kakao'
  if (userId.startsWith('naver_')) return 'naver'
  if (userId.startsWith('google_')) return 'google'
  return 'unknown'
}

function ProviderIcon({ provider }: { provider: Provider }) {
  if (provider === 'kakao') return (
    <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
      style={{ background: '#FEE500', boxShadow: '0 4px 12px rgba(254,229,0,0.45)' }}>
      <svg width="24" height="24" viewBox="0 0 20 20" fill="none">
        <path d="M10 4C6.686 4 4 6.09 4 8.667c0 1.62 1.02 3.046 2.567 3.872l-.656 2.44a.2.2 0 0 0 .306.216l2.85-1.895A7.4 7.4 0 0 0 10 13.333c3.314 0 6-2.09 6-4.666C16 6.09 13.314 4 10 4z" fill="#3C1E1E"/>
      </svg>
    </div>
  )
  if (provider === 'naver') return (
    <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
      style={{ background: '#03C75A', boxShadow: '0 4px 12px rgba(3,199,90,0.40)' }}>
      <svg width="22" height="22" viewBox="0 0 20 20" fill="none">
        <path d="M11.386 10.22L8.46 5.5H5.5v9h3.114V9.78L11.54 14.5H14.5V5.5h-3.114v4.72z" fill="white"/>
      </svg>
    </div>
  )
  if (provider === 'google') return (
    <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 bg-white"
      style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }}>
      <svg width="22" height="22" viewBox="0 0 20 20" fill="none">
        <path d="M17.6 10.2c0-.57-.05-1.12-.14-1.64H10v3.1h4.26a3.65 3.65 0 0 1-1.58 2.4v2h2.55c1.5-1.38 2.37-3.4 2.37-5.86z" fill="#4285F4"/>
        <path d="M10 18c2.14 0 3.93-.71 5.24-1.92l-2.55-2a5.4 5.4 0 0 1-2.69.74c-2.07 0-3.82-1.4-4.45-3.27H2.9v2.06A7.99 7.99 0 0 0 10 18z" fill="#34A853"/>
        <path d="M5.55 11.55A4.8 4.8 0 0 1 5.3 10c0-.54.09-1.07.25-1.55V6.39H2.9A7.99 7.99 0 0 0 2 10c0 1.29.31 2.51.9 3.61l2.65-2.06z" fill="#FBBC05"/>
        <path d="M10 5.18c1.17 0 2.22.4 3.04 1.2l2.28-2.28A7.94 7.94 0 0 0 10 2 7.99 7.99 0 0 0 2.9 6.39l2.65 2.06C6.18 6.58 7.93 5.18 10 5.18z" fill="#EA4335"/>
      </svg>
    </div>
  )
  return (
    <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
      style={{ background: '#F2F4F6' }}>
      <span className="text-lg font-bold" style={{ color: '#B0B8C1' }}>?</span>
    </div>
  )
}

const PROVIDER_LABEL: Record<Provider, string> = {
  kakao: '카카오', naver: '네이버', google: '구글', unknown: '소셜',
}

const PROVIDER_BADGE: Record<Provider, { bg: string; text: string }> = {
  kakao:   { bg: '#FFF9C4', text: '#7A6000' },
  naver:   { bg: '#E6FBF0', text: '#0A7A3C' },
  google:  { bg: '#EBF3FF', text: '#0050CC' },
  unknown: { bg: '#F2F4F6', text: '#6B7684' },
}

function ProfileCard({ profile }: { profile: Profile }) {
  const provider = getProvider(profile.userId)
  const badge = PROVIDER_BADGE[provider]

  return (
    <div
      className="rounded-2xl p-4 flex items-center gap-3"
      style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
    >
      <ProviderIcon provider={provider} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[16px] font-bold truncate" style={{ color: '#191F28' }}>
            {profile.name ?? '(이름 없음)'}
          </p>
          <span
            className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: badge.bg, color: badge.text }}
          >
            {PROVIDER_LABEL[provider]}
          </span>
        </div>
        {profile.email ? (
          <p className="text-[12px] mt-0.5 truncate" style={{ color: '#6B7684' }}>{profile.email}</p>
        ) : provider === 'kakao' ? null : (
          <p className="text-[12px] mt-0.5" style={{ color: '#B0B8C1' }}>이메일 미등록</p>
        )}
      </div>
    </div>
  )
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [notifOpen, setNotifOpen] = useState(false)
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [pinSet, setPinSet] = useState(false)
  const [bioAvailable, setBioAvailable] = useState(false)
  const [bioRegistered, setBioRegistered] = useState(false)
  const [showBioPinModal, setShowBioPinModal] = useState(false)
  const [bioPinError, setBioPinError] = useState<string | null>(null)
  const [bioSubmitting, setBioSubmitting] = useState(false)

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
            name: pJson.name || null,
            email: pJson.email || null,
            phone: pJson.phone || null,
          })
        }
        if (sJson.ok) setSettings(sJson.data)
      } finally {
        setLoading(false)
      }
    })()
    ;(async () => {
      const [bioAvail, pinIsSet] = await Promise.all([isBiometricAvailable(), isPinSet()])
      setBioAvailable(bioAvail)
      setPinSet(pinIsSet)
      if (bioAvail && pinIsSet) {
        const bioReg = await isBiometricRegistered()
        setBioRegistered(bioReg)
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

  async function handleBioToggle() {
    if (bioRegistered) {
      if (!confirm('지문 인증을 해제하시겠습니까?')) return
      await removeBiometric()
      setBioRegistered(false)
    } else {
      setBioPinError(null)
      setShowBioPinModal(true)
    }
  }

  async function handleBioRegisterPin(pin: string) {
    setBioSubmitting(true)
    setBioPinError(null)
    try {
      const r = await verifyPin(pin)
      if (!r.ok) { setBioPinError('PIN이 틀립니다.'); return }
      await registerBiometric(pin)
      setBioRegistered(true)
      setShowBioPinModal(false)
    } catch (err) {
      setBioPinError(err instanceof Error ? err.message : '등록 실패')
    } finally {
      setBioSubmitting(false)
    }
  }

  async function logout() {
    if (!confirm('로그아웃 하시겠습니까?')) return
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/app/login'
  }

  if (loading) {
    return (
      <div className="p-8 text-center text-[14px]" style={{ color: '#6B7684' }}>
        불러오는 중...
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5 pb-6" style={{ background: '#F9FAFB', minHeight: '100%' }}>

      <header className="px-4 pt-6 pb-0">
        <h1 className="text-[22px] font-bold" style={{ color: '#191F28' }}>내 정보</h1>
      </header>

      {/* 프로필 카드 */}
      {profile && (
        <section className="px-4">
          <ProfileCard profile={profile} />
        </section>
      )}

      {/* 알림 설정 */}
      <section className="px-4">
        <p className="text-[13px] font-semibold mb-2 px-1" style={{ color: '#6B7684' }}>알림 설정</p>
        <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
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
        <p className="text-[13px] font-semibold mb-2 px-1" style={{ color: '#6B7684' }}>보안</p>
        <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <a
            href="/app/profile/api-keys"
            className="flex items-center justify-between p-4 active:bg-gray-50 transition-colors"
          >
            <div className="break-keep pr-3">
              <p className="text-[15px] font-semibold" style={{ color: '#191F28' }}>거래소 API Key</p>
              <p className="text-[12px] mt-0.5" style={{ color: '#6B7684' }}>기기에만 저장 · PIN 잠금</p>
            </div>
            <span className="text-[14px]" style={{ color: '#B0B8C1' }}>›</span>
          </a>
          {bioAvailable && pinSet && (
            <>
              <Divider />
              <div className="flex items-center justify-between px-4 py-4">
                <div className="break-keep pr-3">
                  <p className="text-[15px] font-semibold" style={{ color: '#191F28' }}>지문 인증</p>
                  <p className="text-[12px] mt-0.5" style={{ color: '#6B7684' }}>
                    {bioRegistered ? 'PIN 대신 지문으로 잠금 해제' : 'API Key 잠금 해제 시 지문 사용'}
                  </p>
                </div>
                <TossToggle checked={bioRegistered} onChange={handleBioToggle} />
              </div>
            </>
          )}
        </div>
      </section>

      {/* 기타 */}
      <section className="px-4">
        <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <button type="button" onClick={logout}
            className="w-full flex items-center justify-between p-4 active:bg-gray-50 text-left transition-colors">
            <span className="text-[15px] font-semibold" style={{ color: '#FF4D4F' }}>로그아웃</span>
            <span className="text-[14px]" style={{ color: '#B0B8C1' }}>›</span>
          </button>
          <Divider />
          <button type="button" onClick={() => setWithdrawOpen(true)}
            className="w-full flex items-center justify-between p-4 active:bg-gray-50 text-left transition-colors">
            <span className="text-[14px]" style={{ color: '#B0B8C1' }}>회원탈퇴</span>
            <span className="text-[14px]" style={{ color: '#B0B8C1' }}>›</span>
          </button>
        </div>
      </section>

      <div className="px-4 text-center">
        <p className="text-[11px]" style={{ color: '#B0B8C1' }}>MyCoinBot v1.0.0</p>
      </div>

      {withdrawOpen && (
        <WithdrawModal
          onClose={() => setWithdrawOpen(false)}
          loginPath="/app/login"
          schedulePath="/app/schedule"
          tradeJobsApiPath="/api/app/trade-jobs"
        />
      )}

      {showBioPinModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: 'rgba(0,0,0,0.55)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowBioPinModal(false) }}
        >
          <div className="w-full max-w-sm bg-white rounded-t-3xl pt-6 pb-4 shadow-2xl">
            <PinPad
              title="PIN 입력"
              description="지문 인증을 등록하려면 PIN을 입력해주세요."
              errorMessage={bioPinError}
              onSubmit={handleBioRegisterPin}
              onCancel={() => { setShowBioPinModal(false); setBioPinError(null) }}
              submitting={bioSubmitting}
            />
          </div>
        </div>
      )}
    </div>
  )
}

/* ── 토스 스타일 토글 스위치 ── */
function TossToggle({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      className="shrink-0 w-12 h-7 rounded-full transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40"
      style={{ background: checked ? '#0064FF' : '#E5E8EB' }}
    >
      <span
        className="block w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform duration-200"
        style={{ transform: checked ? 'translateX(22px)' : 'translateX(4px)' }}
      />
    </button>
  )
}

function NotifAccordionHeader({ open, disabled, settings, onClick }: {
  open: boolean; disabled: boolean | undefined; settings: Settings | null; onClick: () => void
}) {
  const subKeys: (keyof Settings)[] = ['tradeResultEnabled', 'eventEnabled', 'scheduleEnabled', 'systemEnabled', 'announcementEnabled']
  const enabledCount = settings ? subKeys.filter((k) => settings[k]).length : 0
  const label = open ? '세부 설정 접기' : enabledCount > 0 ? `세부 설정 (${enabledCount}개 켜짐)` : '세부 설정'

  return (
    <button type="button" onClick={onClick}
      className={`w-full flex items-center justify-between px-4 py-4 active:bg-gray-50 transition-colors ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <div className="break-keep">
        <p className="text-[15px] font-semibold text-left" style={{ color: '#191F28' }}>{label}</p>
        {!open && <p className="text-[12px] mt-0.5 text-left" style={{ color: '#6B7684' }}>거래 결과, 이벤트 등 개별 설정</p>}
      </div>
      {open
        ? <ChevronUp size={18} className="shrink-0" style={{ color: '#B0B8C1' }} />
        : <ChevronDown size={18} className="shrink-0" style={{ color: '#B0B8C1' }} />
      }
    </button>
  )
}

function SettingRow({ label, description, value, onChange, disabled, indent }: {
  label: string; description: string; value: boolean | undefined
  onChange: () => void; disabled?: boolean; indent?: boolean
}) {
  return (
    <div className={`flex items-center justify-between px-4 py-4 ${indent ? 'pl-7' : ''} ${disabled ? 'opacity-40' : ''}`}
      style={indent ? { background: '#FAFAFA' } : undefined}>
      <div className="break-keep pr-3">
        <p className="text-[15px] font-semibold" style={{ color: '#191F28' }}>{label}</p>
        <p className="text-[12px] mt-0.5" style={{ color: '#6B7684' }}>{description}</p>
      </div>
      <TossToggle checked={!!value} onChange={onChange} disabled={disabled} />
    </div>
  )
}

function Divider() {
  return <div className="mx-4" style={{ height: '1px', background: '#F2F4F6' }} />
}
