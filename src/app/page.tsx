import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import Dashboard from '@/components/Dashboard'

export default async function Home() {
  const session = await getSession()
  if (!session) redirect('/login')
  return (
    <Dashboard
      userId={session.userId}
      loginId={session.loginId}
      isAdmin={session.isAdmin}
    />
  )
}
