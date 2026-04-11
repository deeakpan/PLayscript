"use client";

import type { ReactNode } from "react";

import { Web3Provider } from "@/components/web3/web3-provider";

export function Web3Root({ children }: { children: ReactNode }) {
  return <Web3Provider>{children}</Web3Provider>;
}
