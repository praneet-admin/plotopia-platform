import type { Metadata, Viewport } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { getSettings } from "@/lib/settings";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const { brand } = await getSettings();
  return {
    title: { default: `${brand.siteName} · ${brand.tagline}`, template: `%s · ${brand.siteName}` },
    description: brand.description,
    icons: { icon: brand.faviconUrl || "/favicon.png", apple: brand.faviconUrl || "/apple-touch-icon.png" },
  };
}
export const viewport: Viewport = { themeColor: "#121214", width: "device-width", initialScale: 1, viewportFit: "cover" };

/** Accent colour and brand images come from /admin/settings → Brand; everything else is in globals.css. */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { brand } = await getSettings();
  const accent = /^#[0-9a-f]{6}$/i.test(brand.accent) ? brand.accent : "#ffc20e";
  return (
    <html lang="en" className={`${inter.variable} ${geistMono.variable} h-full antialiased`} style={{ "--brand": accent } as React.CSSProperties}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
