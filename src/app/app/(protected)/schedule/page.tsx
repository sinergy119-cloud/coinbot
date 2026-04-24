// /app/schedule → /app/trade 로 리다이렉트
import { redirect } from 'next/navigation'

export default async function ScheduleRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>
}) {
  const { mode } = await searchParams
  const tab = mode === 'instant' ? 'instant' : mode === 'new' ? 'schedule' : 'list'
  redirect(`/app/trade?tab=${tab}`)
}
