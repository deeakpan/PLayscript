"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

const Web3Root = dynamic(
  () => import("@/components/web3/web3-root").then((m) => m.Web3Root),
  { ssr: false },
);

export function Web3LayoutBridge({ children }: { children: ReactNode }) {
  return <Web3Root>{children}</Web3Root>;
}
