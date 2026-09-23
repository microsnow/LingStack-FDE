import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./v2.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers(), host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost", protocol = requestHeaders.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https"), image = `${protocol}://${host}/og.png`;
  return {
    title: "灵栈 FDE · 开发者工作台",
    description: "78 个隐私优先、离线优先的开发者工具。",
    icons: { icon: "/favicon.svg" },
    openGraph: { title: "灵栈 FDE · 开发者工作台", description: "78 个本地开发工具，数据不外传。", images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title: "灵栈 FDE · 开发者工作台", description: "78 个本地开发工具，数据不外传。", images: [{ url: image, width: 1200, height: 630 }] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN" data-theme="dark"><body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body></html>;
}
