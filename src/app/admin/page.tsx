import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import AdminTabs from '@/components/AdminTabs'

export default async function AdminPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!session.isAdmin) redirect('/')
  return <AdminTabs loginId={session.loginId} />
}
