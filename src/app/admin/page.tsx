import { getSession } from '@/lib/session'
import { isAdmin } from '@/lib/admin'
import { redirect } from 'next/navigation'
import AdminDashboard from '@/components/AdminDashboard'

export default async function AdminPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!isAdmin(session.loginId)) redirect('/')
  return <AdminDashboard loginId={session.loginId} />
}
