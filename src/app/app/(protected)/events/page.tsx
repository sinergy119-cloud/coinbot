import { createServerClient } from '@/lib/supabase'
import EventsClient from './_components/EventsClient'

interface AnnouncementRow {
  id: string
  exchange: string
  coin: string
  amount: string | null
  require_apply: boolean
  api_allowed: boolean
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
  const db = createServerClient()
  const today = kstToday()
  const { data } = await db
    .from('announcements')
    .select('id, exchange, coin, amount, require_apply, api_allowed, start_date, end_date')
    .lte('start_date', today)
    .gte('end_date', today)
    .order('created_at', { ascending: false })

  const items = (data as AnnouncementRow[]) ?? []
  return <EventsClient items={items} />
}
