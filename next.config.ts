import type { NextConfig } from "next";
import { execSync } from "child_process";

const buildTime = (() => {
  try {
    return execSync("TZ=Asia/Seoul git log -1 --format=%cd --date=format:'%Y-%m-%d %H:%M'").toString().trim().replace(/'/g, "") + " KST"
  } catch {
    return new Date().toISOString().slice(0, 16).replace('T', ' ') + " KST"
  }
})()

const nextConfig: NextConfig = {
  // EC2 1GB 환경에서 TypeScript 검사가 OOM을 유발하므로 빌드 시 검사 생략
  // (타입 오류는 로컬 개발 중 IDE에서 확인)
  typescript: { ignoreBuildErrors: true },
  serverExternalPackages: ['ccxt', 'nodemailer', 'firebase-admin'],
  env: {
    NEXT_PUBLIC_BUILD_TIME: buildTime,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          // CSP: 기존 페이지에 영향 있을 수 있으므로 일단 Report-Only
          {
            key: 'Content-Security-Policy-Report-Only',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: https:",
              "connect-src 'self' https://api.telegram.org https://kauth.kakao.com https://kapi.kakao.com https://*.supabase.co https://api.bithumb.com https://api.upbit.com https://api.coinone.co.kr https://api.korbit.co.kr https://api.gopax.co.kr",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ]
  },
};

export default nextConfig;
