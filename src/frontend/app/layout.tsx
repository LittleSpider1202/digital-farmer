import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "数字农人 — AI 农作物病害诊断",
  description: "上传农作物病害图片，AI 为你诊断并推荐解决方案",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="dark">
      <body className="bg-[#212121] text-[#ececec]">{children}</body>
    </html>
  );
}
