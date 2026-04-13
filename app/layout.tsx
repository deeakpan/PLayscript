import type { Metadata } from "next";
import { Geist, Geist_Mono, Syne } from "next/font/google";

import { Web3LayoutBridge } from "@/components/web3/web3-layout-bridge";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** Display / headings — distinct from body (Geist). */
const fontSyne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
const metadataBase: URL | undefined =
  siteUrl && siteUrl.length > 0
    ? new URL(siteUrl)
    : process.env.VERCEL_URL
      ? new URL(`https://${process.env.VERCEL_URL}`)
      : undefined;

export const metadata: Metadata = {
  ...(metadataBase ? { metadataBase } : {}),
  title: "Playscript",
  description:
    "Decentralized sports scenario markets settled with on-chain agents.",
  icons: {
    icon: [{ url: "/logo.png?v=3", type: "image/png", sizes: "32x32" }],
    apple: [{ url: "/logo.png?v=3", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${fontSyne.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <Web3LayoutBridge>{children}</Web3LayoutBridge>
      </body>
    </html>
  );
}
