"use client";

import { useEffect, useState } from "react";
import { useConnection } from "wagmi";

import { PlayFaucetModal } from "@/components/web3/play-faucet-modal";

export function PlayFaucet() {
  const { address, status } = useConnection();
  const connected = status === "connected";
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (connected && address) setOpen(true);
        }}
        disabled={!connected}
        className="text-xs font-medium text-[var(--muted)] transition-colors hover:text-[var(--dream-yellow)] disabled:cursor-not-allowed disabled:opacity-45 sm:text-sm"
        title={connected ? "Claim testnet PLAY" : "Connect wallet to use the faucet"}
      >
        Faucet
      </button>
      {connected && address ? (
        <PlayFaucetModal open={open} onClose={() => setOpen(false)} address={address} />
      ) : null}
    </>
  );
}
