import Link from 'next/link'
import { getSession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase'
import { EXCHANGE_LABELS, TRADE_TYPE_LABELS, type Exchange, type TradeType } from '@/types/database'

interface EventItem {
  id: string
  exchange: string
  coin: string
  amount: string | null
  start_date: string
  end_date: string
}

interface TradeLog {
  id: string
  exchange: string
  coin: string
  trade_type: string
  amount_krw: number
  success: boolean
  executed_at: string
}

function kstToday(): string {
  const kst = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
  const y = kst.getFullYear()
  const m = String(kst.getMonth() + 1).padStart(2, '0')
  const d = String(kst.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const EXCHANGE_BADGE: Record<string, { bg: string; text: string }> = {
  BITHUMB: { bg: '#FFF0E6', text: '#C94B00' },
  UPBIT:   { bg: '#E6F0FF', text: '#0050CC' },
  COINONE: { bg: '#E6F9EE', text: '#007A30' },
  KORBIT:  { bg: '#F3EEFF', text: '#5B21B6' },
  GOPAX:   { bg: '#FFFBE6', text: '#946200' },
}

// 온보딩 단계: PIN 미설정(0) → API Key 없음(1) → 완료(2)
function getOnboardingStep(hasPinSetup: boolean, keyCount: number): number {
  if (!hasPinSetup) return 0
  if (keyCount === 0) return 1
  return 2
}

export default async function AppHomePage() {
  const session = await getSession()
  const db = createServerClient()
  const today = kstToday()

  const [
    { data: events },
    { data: trades },
    { data: user },
    { data: keys },
  ] = await Promise.all([
    db.from('announcements')
      .select('id, exchange, coin, amount, start_date, end_date')
      .lte('start_date', today)
      .gte('end_date', today)
      .order('created_at', { ascending: false })
      .limit(3),

    db.from('trade_logs')
      .select('id, exchange, coin, trade_type, amount_krw, success, executed_at')
      .eq('user_id', session!.userId)
      .order('executed_at', { ascending: false })
      .limit(3),

    db.from('users')
      .select('name, user_id, pin_hash')
      .eq('id', session!.userId)
      .single(),

    db.from('exchange_accounts')
      .select('id')
      .eq('user_id', session!.userId),
  ])

  const displayName = user?.name || user?.user_id || '회원'
  const keyCount = keys?.length ?? 0
  const hasPinSetup = !!user?.pin_hash
  const onboardingStep = getOnboardingStep(hasPinSetup, keyCount)
  const showOnboarding = onboardingStep < 2

  const onboardingContent = [
    {
      step: 1,
      title: 'PIN을 먼저 설정해주세요',
      desc: 'API Key를 안전하게 보관하려면 PIN이 필요해요',
      cta: 'PIN 설정하기 →',
      href: '/app/profile/api-keys',
    },
    {
      step: 2,
      title: '거래소 API Key를 등록하면\n자동 매수를 시작할 수 있어요',
      desc: 'API Key를 등록하면 이벤트 자동 참여가 가능해요',
      cta: 'API Key 등록하기 →',
      href: '/app/profile/api-keys',
    },
  ]
  const ob = onboardingContent[onboardingStep]

  return (
    <div className="flex flex-col gap-5 pb-2" style={{ background: '#F9FAFB', minHeight: '100%' }}>

      {/* 인사 */}
      <header className="px-4 pt-6 pb-0 break-keep">
        <p className="text-[14px]" style={{ color: '#6B7684' }}>안녕하세요</p>
        <h1 className="text-[24px] font-bold mt-0.5" style={{ color: '#191F28' }}>
          {displayName}님 👋
        </h1>
      </header>

      {/* 온보딩 배너 (API Key 미등록 상태) */}
      {showOnboarding && ob && (
        <section className="px-4">
          <Link
            href={ob.href}
            className="block rounded-2xl p-5 active:opacity-90 transition-opacity break-keep"
            style={{ background: '#0064FF' }}
          >
            {/* 진행 단계 */}
            <p className="text-[11px] font-semibold mb-2" style={{ color: 'rgba(255,255,255,0.7)' }}>
              시작 설정 {ob.step}/2 완료
            </p>

            {/* 진행 바 */}
            <div className="w-full h-1 rounded-full mb-3" style={{ background: 'rgba(255,255,255,0.25)' }}>
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${(ob.step / 2) * 100}%`, background: '#fff' }}
              />
            </div>

            <p className="text-[17px] font-bold leading-snug whitespace-pre-line" style={{ color: '#fff' }}>
              {ob.title}
            </p>
            <p className="text-[12px] mt-1.5 leading-relaxed" style={{ color: 'rgba(255,255,255,0.75)' }}>
              {ob.desc}
            </p>
            <p className="text-[13px] font-semibold mt-3" style={{ color: '#fff' }}>
              {ob.cta}
            </p>
          </Link>
        </section>
      )}

      {/* 현황 요약 (API Key 등록 후) */}
      {!showOnboarding && (
        <section className="px-4">
          <div className="grid grid-cols-3 gap-3">
            <Link
              href="/app/events"
              className="rounded-2xl p-4 text-center active:opacity-80 transition-opacity"
              style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
            >
              <p className="text-[22px] font-bold" style={{ color: '#0064FF' }}>
                {(events ?? []).length}
              </p>
              <p className="text-[11px] mt-0.5 break-keep" style={{ color: '#6B7684' }}>진행 이벤트</p>
            </Link>
            <Link
              href="/app/trade?tab=list"
              className="rounded-2xl p-4 text-center active:opacity-80 transition-opacity"
              style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
            >
              <p className="text-[22px] font-bold" style={{ color: '#FF9500' }}>
                —
              </p>
              <p className="text-[11px] mt-0.5 break-keep" style={{ color: '#6B7684' }}>활성 스케줄</p>
            </Link>
            <Link
              href="/app/browse?tab=history"
              className="rounded-2xl p-4 text-center active:opacity-80 transition-opacity"
              style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
            >
              <p className="text-[22px] font-bold" style={{ color: '#00C853' }}>
                {(trades ?? []).filter((t) => (t as TradeLog).success).length}
              </p>
              <p className="text-[11px] mt-0.5 break-keep" style={{ color: '#6B7684' }}>오늘 거래 성공</p>
            </Link>
          </div>
        </section>
      )}

      {/* 빠른 거래 */}
      <section className="px-4">
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/app/trade?tab=instant"
            className="rounded-2xl p-4 flex flex-col items-center gap-1.5 active:opacity-80 transition-opacity"
            style={{ background: '#191F28' }}
          >
            <span className="text-[26px]">⚡</span>
            <span className="text-[14px] font-semibold" style={{ color: '#fff' }}>즉시 매수</span>
          </Link>
          <Link
            href="/app/trade?tab=schedule"
            className="rounded-2xl p-4 flex flex-col items-center gap-1.5 active:opacity-80 transition-opacity"
            style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
          >
            <span className="text-[26px]">📅</span>
            <span className="text-[14px] font-semibold" style={{ color: '#191F28' }}>스케줄 등록</span>
          </Link>
        </div>
      </section>

      {/* 진행 중인 이벤트 */}
      <section className="px-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[16px] font-bold" style={{ color: '#191F28' }}>진행 중인 이벤트</h2>
          <Link href="/app/events" className="text-[13px] font-semibold" style={{ color: '#6B7684' }}>
            모두 보기 →
          </Link>
        </div>

        {(events ?? []).length === 0 ? (
          <div
            className="rounded-2xl p-5 text-center text-[14px] break-keep"
            style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', color: '#6B7684' }}
          >
            진행 중인 이벤트가 없습니다.
          </div>
        ) : (
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
          >
            {((events as EventItem[]) ?? []).map((e, idx, arr) => {
              const badge = EXCHANGE_BADGE[e.exchange] ?? { bg: '#F2F4F6', text: '#6B7684' }
              const label = EXCHANGE_LABELS[e.exchange as Exchange] ?? e.exchange
              return (
                <Link
                  key={e.id}
                  href={`/app/events/${e.id}`}
                  className="flex items-center justify-between px-5 py-4 active:bg-gray-50 transition-colors break-keep"
                  style={idx < arr.length - 1 ? { borderBottom: '1px solid #F2F4F6' } : undefined}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: badge.bg, color: badge.text }}
                    >
                      {label}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold truncate" style={{ color: '#191F28' }}>
                        {e.coin}
                      </p>
                      {e.amount && (
                        <p className="text-[12px] mt-0.5" style={{ color: '#6B7684' }}>{e.amount}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-[12px] shrink-0 ml-3" style={{ color: '#B0B8C1' }}>
                    ~ {e.end_date.slice(5).replace('-', '/')}
                  </span>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {/* 최근 거래 */}
      <section className="px-4 pb-2">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[16px] font-bold" style={{ color: '#191F28' }}>최근 거래</h2>
          <Link href="/app/browse?tab=history" className="text-[13px] font-semibold" style={{ color: '#6B7684' }}>
            전체 보기 →
          </Link>
        </div>

        {(trades ?? []).length === 0 ? (
          <div
            className="rounded-2xl p-5 text-center text-[14px] break-keep"
            style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', color: '#6B7684' }}
          >
            아직 거래 내역이 없어요.
          </div>
        ) : (
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
          >
            {((trades as TradeLog[]) ?? []).map((t, idx, arr) => (
              <div
                key={t.id}
                className="flex items-center justify-between px-5 py-4 break-keep"
                style={idx < arr.length - 1 ? { borderBottom: '1px solid #F2F4F6' } : undefined}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-medium" style={{ color: '#B0B8C1' }}>
                    {EXCHANGE_LABELS[t.exchange as Exchange] ?? t.exchange}
                    {' · '}
                    {TRADE_TYPE_LABELS[t.trade_type as TradeType] ?? t.trade_type}
                  </p>
                  <p className="text-[15px] font-semibold mt-0.5" style={{ color: '#191F28' }}>
                    {t.coin}
                  </p>
                  {t.trade_type !== 'SELL' && (
                    <p className="text-[12px] mt-0.5" style={{ color: '#6B7684' }}>
                      {t.amount_krw.toLocaleString()}원
                    </p>
                  )}
                </div>
                <span
                  className="text-[13px] font-semibold shrink-0"
                  style={{ color: t.success ? '#00C853' : '#FF4D4F' }}
                >
                  {t.success ? '성공' : '실패'}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

    </div>
  )
}
