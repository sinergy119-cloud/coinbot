// /app/* 전체 래퍼 레이아웃 (세션 체크 없음)
// 세션 보호는 src/app/app/(protected)/layout.tsx 에서 담당
export default function AppRootLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
