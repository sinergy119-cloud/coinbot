import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import Header from '@/components/Header'
import AccountRegister from '@/components/AccountRegister'
import { isAdmin } from '@/lib/admin'

export default async function RegisterPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        loginId={session.loginId}
        isAdmin={isAdmin(session.loginId)}
        showBackToHome={true}
      />
      <main className="mx-auto max-w-2xl px-4 py-4">
        <AccountRegister />
      </main>
    </div>
  )
}
