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

interface NotificationItem {
  id: string
  category: string
  title: string
  body: string
  read_at: string | null
  created_at: string
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

// 거래소별 뱃지 색상
const EXCHANGE_BADGE: Record<string, { bg: string; text: string }> = {
  BITHUMB: { bg: '#FFF0E6', text: '#C94B00' },
  UPBIT:   { bg: '#E6F0FF', text: '#0050CC' },
  COINONE: { bg: '#E6F9EE', text: '#007A30' },
  KORBIT:  { bg: '#F3EEFF', text: '#5B21B6' },
  GOPAX:   { bg: '#FFFBE6', text: '#946200' },
}

export default async function AppHomePage() {
  const session = await getSession()
  const db = createServerClient()
  const today = kstToday()

  const { data: events } = await db
    .from('announcements')
    .select('id, exchange, coin, amount, start_date, end_date')
    .lte('start_date', today)
    .gte('end_date', today)
    .order('created_at', { ascending: false })
    .limit(3)

  const { data: notifs } = await db
    .from('notifications')
    .select('id, category, title, body, read_at, created_at')
    .eq('user_id', session!.userId)
    .order('created_at', { ascending: false })
    .limit(3)

  const { data: trades } = await db
    .from('trade_logs')
    .select('id, exchange, coin, trade_type, amount_krw, success, executed_at')
    .eq('user_id', session!.userId)
    .order('executed_at', { ascending: false })
    .limit(3)

  const { data: user } = await db
    .from('users')
    .select('name, user_id')
    .eq('id', session!.userId)
    .single()

  const displayName = user?.name || user?.user_id || '회원'

  return (
    <div className="flex flex-col gap-5 pb-2" style={{ background: '#F9FAFB', minHeight: '100%' }}>

      {/* 인사 */}
      <header className="px-4 pt-6 pb-0 break-keep">
        <p className="text-[14px]" style={{ color: '#6B7684' }}>안녕하세요</p>
        <h1 className="text-[24px] font-bold mt-0.5" style={{ color: '#191F28' }}>
          {displayName}님
        </h1>
      </header>

      {/* 내 자산 */}
      <section className="px-4">
        <Link
          href="/app/assets"
          className="block rounded-2xl p-5 active:opacity-90 transition-opacity break-keep"
          style={{ background: '#191F28' }}
        >
          <p className="text-[12px]" style={{ color: '#B0B8C1' }}>내 자산</p>
          <p className="text-[18px] font-bold mt-1.5" style={{ color: '#fff' }}>조회하기 →</p>
          <p className="text-[11px] mt-2" style={{ color: '#6B7684' }}>PIN 입력 후 거래소별 잔고 조회</p>
        </Link>
      </section>

      {/* 빠른 거래 */}
      <section className="px-4">
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/app/schedule?mode=instant"
            className="rounded-2xl p-4 flex flex-col items-center gap-1.5 active:opacity-80 transition-opacity"
            style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
          >
            <span className="text-[26px]">⚡</span>
            <span className="text-[14px] font-semibold" style={{ color: '#191F28' }}>즉시 매수</span>
          </Link>
          <Link
            href="/app/schedule?mode=new"
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
          <Link
            href="/app/events"
            className="text-[13px] font-semibold"
            style={{ color: '#6B7684' }}
          >
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
      <section className="px-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[16px] font-bold" style={{ color: '#191F28' }}>최근 거래</h2>
          <Link
            href="/app/schedule"
            className="text-[13px] font-semibold"
            style={{ color: '#6B7684' }}
          >
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

      {/* 최근 알림 */}
      {(notifs ?? []).length > 0 && (
        <section className="px-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[16px] font-bold" style={{ color: '#191F28' }}>최근 알림</h2>
            <Link
              href="/app/notifications"
              className="text-[13px] font-semibold"
              style={{ color: '#6B7684' }}
            >
              전체 보기 →
            </Link>
          </div>
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
          >
            {((notifs as NotificationItem[]) ?? []).map((n, idx, arr) => (
              <div
                key={n.id}
                className="px-5 py-4 break-keep"
                style={{
                  borderBottom: idx < arr.length - 1 ? '1px solid #F2F4F6' : undefined,
                  borderLeft: n.read_at ? undefined : '3px solid #0064FF',
                }}
              >
                <p className="text-[14px] font-semibold" style={{ color: '#191F28' }}>{n.title}</p>
                <p className="text-[12px] mt-0.5 line-clamp-2" style={{ color: '#6B7684' }}>{n.body}</p>
              </div>
            ))}
          </div>
        </section>
      )}

    </div>
  )
}
