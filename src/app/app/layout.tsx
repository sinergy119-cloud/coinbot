// /app/* 전체 래퍼 레이아웃 (세션 체크 없음)
// 세션 보호는 src/app/app/(protected)/layout.tsx 에서 담당

// 모든 /app/* 페이지를 동적 렌더링으로 강제 — prerender 캐시(s-maxage=1년) 회피
// (배포 후 stale 청크 참조로 Failed to load chunk 오류, 변경사항 미반영 방지)
export const dynamic = 'force-dynamic'

export default function AppRootLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
