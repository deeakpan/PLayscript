"use client";

import { createWeb3Modal, defaultWagmiConfig } from "@web3modal/wagmi/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { http } from "viem";
import { WagmiProvider } from "wagmi";

import { somniaTestnet } from "@/lib/chains/somnia";

const somniaRpc =
  process.env.NEXT_PUBLIC_SOMNIA_TESTNET_RPC_URL?.trim() ||
  process.env.NEXT_PUBLIC_SOMNIA_RPC_TESTNET?.trim() ||
  "https://api.infra.testnet.somnia.network";

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
  transports: {
    [somniaTestnet.id]: http(somniaRpc, { timeout: 60_000, retryCount: 2 }),
  },
  ssr: true,
});

let web3ModalCreated = false;

function ensureWeb3Modal() {
  if (web3ModalCreated) return;
  web3ModalCreated = true;
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
  const [childrenReady, setChildrenReady] = useState(false);

  useEffect(() => {
    ensureWeb3Modal();
    const id = requestAnimationFrame(() => setChildrenReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <WagmiProvider config={wagmiConfig} reconnectOnMount>
      <QueryClientProvider client={queryClient}>
        {childrenReady ? children : null}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
