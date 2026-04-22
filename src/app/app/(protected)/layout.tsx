import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import AppShell from '../_components/AppShell'
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
      {/* 상단 바 + 좌측 드로어 + 하단 탭 (클라이언트 상태 관리) */}
      <AppShell>{children}</AppShell>
    </div>
  )
}
