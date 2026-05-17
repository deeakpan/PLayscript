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
  title: {
    default: "Playscript | Agentic Sports Prediction Markets",
    template: "%s | Playscript",
  },
  description:
    "Agentic sports prediction markets — decentralized scenario plays settled with onchain agents.",
  icons: {
    icon: [{ url: "/playscript_logo.png", type: "image/png" }],
    apple: [{ url: "/playscript_logo.png", type: "image/png" }],
    shortcut: "/playscript_logo.png",
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
