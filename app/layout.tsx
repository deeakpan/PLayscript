import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

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

export const metadata: Metadata = {
  title: "Playscript",
  description:
    "Decentralized sports scenario markets settled with on-chain agents.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <Web3LayoutBridge>{children}</Web3LayoutBridge>
      </body>
    </html>
  );
}
