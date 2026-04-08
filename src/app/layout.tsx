import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("http://mycoinbot.duckdns.org"),
  title: "MyCoinBot",
  description: "코인 에어드랍 이벤트 자동 참여 서비스 — 빗썸, 업비트, 코인원, 코빗, 고팍스 5대 거래소 지원",
  openGraph: {
    title: "MyCoinBot",
    description: "코인 에어드랍 이벤트 자동 참여 서비스 — 5대 거래소 자동 사팔 실행",
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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
