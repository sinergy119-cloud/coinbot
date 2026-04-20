import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

// 런타임에 환경변수를 읽음 (빌드 시점에 secret이 없어도 에러 안 남)
function getSecret() {
  const raw = process.env.SESSION_SECRET
  if (!raw) throw new Error('SESSION_SECRET 환경변수가 설정되지 않았습니다.')
  return new TextEncoder().encode(raw)
}

const PUBLIC_PATHS = [
  '/login',
  '/agree',
  '/api/auth/',
  '/api/cron',
  '/api/markets',
  '/api/guide',
  '/api/debug/', // 임시: SW 디버그 로깅
  // PWA 필수 파일 — 브라우저가 설치 확인 시 로그인 전 fetch 가능해야 함
  '/manifest.webmanifest',
  '/firebase-messaging-sw.js',
  '/.well-known/', // Google Play Digital Asset Links (assetlinks.json)
]

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 공개 경로는 통과
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // 정적 파일 및 OG 이미지는 통과
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('opengraph-image') ||
    /\.(png|jpe?g|gif|svg|webp|ico|woff2?|ttf|otf)$/i.test(pathname)
  ) {
    return NextResponse.next()
  }

  // 세션 쿠키 확인
  const token = request.cookies.get('session')?.value
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  try {
    await jwtVerify(token, getSecret())
    return NextResponse.next()
  } catch {
    return NextResponse.redirect(new URL('/login', request.url))
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
