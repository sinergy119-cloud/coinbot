import type { MetadataRoute } from 'next'

// Next.js Metadata Route — /manifest.webmanifest 경로로 자동 서빙
// public/manifest.json 대신 Next.js 공식 방식 사용 (세션 체크와 독립적)

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'MyCoinBot',
    short_name: 'MyCoinBot',
    description: '한국 5개 거래소 에어드랍·N빵 자동 수집 및 자동 매수',
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
