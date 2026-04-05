import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import Dashboard from '@/components/Dashboard'
import { isAdmin } from '@/lib/admin'

export default async function Home() {
  const session = await getSession()
  if (!session) redirect('/login')
  return (
    <Dashboard
      userId={session.userId}
      loginId={session.loginId}
      isAdmin={isAdmin(session.loginId)}
    />
  )
}
