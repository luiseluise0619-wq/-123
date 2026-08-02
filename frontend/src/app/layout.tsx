import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/Navbar";

export const metadata: Metadata = {
  title: "AI Local Intelligence - AI 상권 분석 & 창업 의사결정 플랫폼",
  description: "수십 가지 상권 데이터를 기반으로 창업 성공 가능성과 매출을 예측하는 AI 상권 인텔리전스 SaaS 플랫폼입니다.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="dark">
      <body className="min-h-screen bg-[#080c16] text-slate-100 antialiased selection:bg-cyan-500 selection:text-white">
        <Navbar />
        <main className="min-h-[calc(100vh-65px)]">{children}</main>
      </body>
    </html>
  );
}
