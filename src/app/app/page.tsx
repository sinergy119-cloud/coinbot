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

export default async function AppHomePage() {
  const session = await getSession()
  const db = createServerClient()

  const today = kstToday()

  // 활성 이벤트 (최신 3건)
  const { data: events } = await db
    .from('announcements')
    .select('id, exchange, coin, amount, start_date, end_date')
    .lte('start_date', today)
    .gte('end_date', today)
    .order('created_at', { ascending: false })
    .limit(3)

  // 최근 알림 3건
  const { data: notifs } = await db
    .from('notifications')
    .select('id, category, title, body, read_at, created_at')
    .eq('user_id', session!.userId)
    .order('created_at', { ascending: false })
    .limit(3)

  // 최근 거래 3건
  const { data: trades } = await db
    .from('trade_logs')
    .select('id, exchange, coin, trade_type, amount_krw, success, executed_at')
    .eq('user_id', session!.userId)
    .order('executed_at', { ascending: false })
    .limit(3)

  // 사용자 이름
  const { data: user } = await db
    .from('users')
    .select('name, user_id')
    .eq('id', session!.userId)
    .single()

  const displayName = user?.name || user?.user_id || '회원'

  return (
    <div className="flex flex-col gap-4">
      {/* 인사 */}
      <header className="px-4 pt-6 pb-2 break-keep">
        <p className="text-sm text-gray-600">안녕하세요</p>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">{displayName}님</h1>
      </header>

      {/* 자산 요약 */}
      <section className="px-4">
        <Link
          href="/app/assets"
          className="block bg-gray-900 text-white rounded-2xl p-5 active:scale-95 transition-transform break-keep"
        >
          <p className="text-xs text-gray-300">내 자산</p>
          <p className="text-xl font-bold mt-1">조회하기 →</p>
          <p className="text-[11px] text-gray-300 mt-2">PIN 입력 후 거래소별 잔고 조회</p>
        </Link>
      </section>

      {/* 빠른 거래 */}
      <section className="px-4">
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/app/schedule?mode=instant"
            className="bg-white border border-gray-200 rounded-2xl p-4 flex flex-col items-center active:scale-95 transition-transform"
          >
            <span className="text-2xl">⚡</span>
            <span className="text-sm font-semibold text-gray-900 mt-1">즉시 매수</span>
          </Link>
          <Link
            href="/app/schedule?mode=new"
            className="bg-white border border-gray-200 rounded-2xl p-4 flex flex-col items-center active:scale-95 transition-transform"
          >
            <span className="text-2xl">📅</span>
            <span className="text-sm font-semibold text-gray-900 mt-1">스케줄 등록</span>
          </Link>
        </div>
      </section>

      {/* 진행 중인 이벤트 */}
      <section className="px-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-bold text-gray-900">진행 중인 이벤트</h2>
          <Link href="/app/events" className="text-xs text-gray-600 font-semibold">
            모두 보기 →
          </Link>
        </div>
        {(events ?? []).length === 0 ? (
          <div className="bg-white rounded-2xl p-5 text-center text-sm text-gray-600 break-keep">
            진행 중인 이벤트가 없습니다.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {((events as EventItem[]) ?? []).map((e) => (
              <Link
                key={e.id}
                href={`/app/events/${e.id}`}
                className="bg-white rounded-2xl p-4 flex items-center justify-between active:bg-gray-100 transition-colors"
              >
                <div className="min-w-0 break-keep">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {e.exchange} · {e.coin}
                  </p>
                  {e.amount && (
                    <p className="text-xs text-gray-600 mt-0.5">{e.amount}</p>
                  )}
                </div>
                <span className="text-xs text-gray-600 shrink-0 ml-2">
                  ~ {e.end_date.slice(5).replace('-', '/')}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* 최근 거래 */}
      <section className="px-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-bold text-gray-900">최근 거래</h2>
          <Link href="/app/schedule" className="text-xs text-gray-600 font-semibold">
            전체 보기 →
          </Link>
        </div>
        {(trades ?? []).length === 0 ? (
          <div className="bg-white rounded-2xl p-5 text-center text-sm text-gray-600 break-keep">
            아직 거래 내역이 없어요.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {((trades as TradeLog[]) ?? []).map((t) => (
              <div key={t.id} className="bg-white rounded-2xl p-4 flex items-center justify-between break-keep">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-600 font-semibold">
                    {EXCHANGE_LABELS[t.exchange as Exchange] ?? t.exchange} · {TRADE_TYPE_LABELS[t.trade_type as TradeType] ?? t.trade_type}
                  </p>
                  <p className="text-sm font-bold text-gray-900 mt-0.5">{t.coin}</p>
                  {t.trade_type !== 'SELL' && (
                    <p className="text-xs text-gray-700 mt-0.5">{t.amount_krw.toLocaleString()}원</p>
                  )}
                </div>
                <span className={`text-xs font-semibold shrink-0 ${t.success ? 'text-green-700' : 'text-red-600'}`}>
                  {t.success ? '성공' : '실패'}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 최근 알림 */}
      <section className="px-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-bold text-gray-900">최근 알림</h2>
          <Link href="/app/notifications" className="text-xs text-gray-600 font-semibold">
            전체 보기 →
          </Link>
        </div>
        {(notifs ?? []).length === 0 ? (
          <div className="bg-white rounded-2xl p-5 text-center text-sm text-gray-600 break-keep">
            아직 알림이 없어요.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {((notifs as NotificationItem[]) ?? []).map((n) => (
              <div
                key={n.id}
                className={`bg-white rounded-2xl p-4 ${n.read_at ? '' : 'border-l-4 border-blue-500'}`}
              >
                <p className="text-sm font-semibold text-gray-900 break-keep">{n.title}</p>
                <p className="text-xs text-gray-700 mt-0.5 break-keep line-clamp-2">{n.body}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
