import type { Metadata, Viewport } from "next";
import "./globals.css";
import ErrorBoundary from "@/components/ErrorBoundary";

export const viewport: Viewport = {
  themeColor: '#ffffff',
}

export const metadata: Metadata = {
  metadataBase: new URL("https://mycoinbot.duckdns.org"),
  title: "MyCoinBot",
  description: "코인 에어드랍 이벤트용 · 스케줄 등록으로 자동 실행",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "MyCoinBot",
  },
  openGraph: {
    title: "MyCoinBot",
    description: "코인 에어드랍 이벤트용 · 스케줄 등록으로 자동 실행",
    siteName: "MyCoinBot",
    locale: "ko_KR",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <head>
        {/* Pretendard — 토스 스타일 한국어 폰트 */}
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css"
        />
      </head>
      <body className="min-h-full flex flex-col">
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </body>
    </html>
  );
}
