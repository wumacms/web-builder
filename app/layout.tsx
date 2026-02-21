import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI 建站平台",
  description: "通过聊天即可创建静态网站",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased min-h-screen bg-gray-50">
        {children}
      </body>
    </html>
  );
}
