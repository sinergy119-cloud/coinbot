import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import BottomNav from '../_components/BottomNav'
import PushBanner from '../_components/PushBanner'
import PwaInstaller from '../_components/PwaInstaller'
import BatteryOptBanner from '../_components/BatteryOptBanner'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/app/login')

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* PWA 서비스 워커 등록 + 설치 완료 토스트 */}
      <PwaInstaller />
      <PushBanner />
      {/* Android 배터리 최적화 해제 안내 */}
      <BatteryOptBanner />
      <main className="flex-1 pb-20 max-w-lg mx-auto w-full">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}
