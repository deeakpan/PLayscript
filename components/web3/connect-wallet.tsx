"use client";

import { SignIn, Wallet } from "@phosphor-icons/react";
import { useWeb3Modal } from "@web3modal/wagmi/react";
import { useConnection } from "wagmi";

function shortAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function ConnectWallet() {
  const { open } = useWeb3Modal();
  const { address, status } = useConnection();
  const connected = status === "connected";

  if (connected && address) {
    return (
      <button
        type="button"
        onClick={() => open({ view: "Account" })}
        className="group inline-flex h-9 items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] px-3 text-sm font-medium text-[var(--foreground)] transition-all duration-200 hover:border-[var(--dream-yellow)]/50 hover:bg-[var(--surface-hover)] hover:shadow-[0_0_0_1px_var(--dream-glow)]"
      >
        <Wallet
          className="h-4 w-4 text-[var(--muted)] transition-colors group-hover:text-[var(--dream-yellow)]"
          weight="regular"
        />
        <span className="transition-colors group-hover:text-[var(--dream-yellow)]">
          {shortAddress(address)}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => open()}
      className="inline-flex h-9 items-center gap-2 rounded-full border border-[var(--accent)] bg-[var(--surface-elevated)] px-4 text-sm font-semibold text-[var(--foreground)] transition-all duration-200 hover:-translate-y-px hover:border-[var(--dream-yellow)] hover:bg-[var(--surface-hover)] hover:text-[var(--dream-yellow)] hover:shadow-[0_0_20px_-6px_var(--dream-glow)] active:translate-y-0"
    >
      <SignIn className="h-4 w-4 text-[var(--accent)]" weight="regular" />
      Sign in
    </button>
  );
}
