import EventsClient from './_components/EventsClient'
import { getAnnouncementsList } from '@/lib/data/announcements'

interface AnnouncementRow {
  id: string
  exchange: string
  coin: string
  amount: string | null
  require_apply: boolean
  api_allowed: boolean
  link: string | null
  start_date: string
  end_date: string
}

function kstToday() {
  const kst = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
  const y = kst.getFullYear()
  const m = String(kst.getMonth() + 1).padStart(2, '0')
  const d = String(kst.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export default async function EventsPage() {
  const today = kstToday()
  const fullList = await getAnnouncementsList(today, { status: 'active', limit: 500 })
  // EventsClient가 사용하는 필드만 추려서 클라이언트 페이로드 절감
  const items: AnnouncementRow[] = fullList.map((r) => ({
    id: r.id,
    exchange: r.exchange,
    coin: r.coin,
    amount: r.amount,
    require_apply: r.require_apply,
    api_allowed: r.api_allowed,
    link: r.link,
    start_date: r.start_date,
    end_date: r.end_date,
  }))
  return <EventsClient items={items} />
}
