import type { MetadataRoute } from 'next'

// Next.js Metadata Route — /manifest.webmanifest 경로로 자동 서빙
// public/manifest.json 대신 Next.js 공식 방식 사용 (세션 체크와 독립적)

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'MyCoinBot',
    short_name: 'MyCoinBot',
    description: '빗썸·업비트·코인원·코빗·고팍스 코인 이벤트 자동 알림 & 자동매매 서비스',
    start_url: '/app',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#111827',
    scope: '/',
    lang: 'ko',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
