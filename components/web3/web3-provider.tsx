"use client";

import { createWeb3Modal, defaultWagmiConfig } from "@web3modal/wagmi/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";

import { somniaTestnet } from "@/lib/chains/somnia";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";

const metadata = {
  name: "Playscript",
  description: "Decentralized sports scenario markets",
  url:
    typeof window !== "undefined"
      ? window.location.origin
      : "http://localhost:3000",
  icons: ["https://walletconnect.com/walletconnect.svg"],
};

const chains = [somniaTestnet] as const;

const wagmiConfig = defaultWagmiConfig({
  chains,
  projectId: projectId || "00000000000000000000000000000000",
  metadata,
  auth: {
    email: false,
    socials: [],
  },
});

if (typeof window !== "undefined") {
  if (!projectId) {
    console.warn(
      "[Playscript] Set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID in .env for WalletConnect (get a free key at https://cloud.reown.com)",
    );
  }
  createWeb3Modal({
    wagmiConfig,
    projectId: projectId || "00000000000000000000000000000000",
    defaultChain: somniaTestnet,
    themeMode: "dark",
    themeVariables: {
      "--w3m-accent": "#3d8b6e",
      "--w3m-border-radius-master": "8px",
    },
  });
}

export function Web3Provider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
