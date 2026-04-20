import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ErrorBoundary from "@/components/ErrorBoundary";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: '#111827',
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
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </body>
    </html>
  );
}
