import { getSession } from '@/lib/session'
import { isAdmin } from '@/lib/admin'
import { redirect } from 'next/navigation'
import AdminTabs from '@/components/AdminTabs'

export default async function AdminPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!isAdmin(session.loginId)) redirect('/')
  return <AdminTabs loginId={session.loginId} />
}
