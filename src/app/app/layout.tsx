import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import BottomNav from './_components/BottomNav'
import PushBanner from './_components/PushBanner'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login?next=/app')

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <PushBanner />
      <main className="flex-1 pb-20 max-w-lg mx-auto w-full">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}
