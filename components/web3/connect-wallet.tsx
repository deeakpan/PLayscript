"use client";

import { SignIn, Wallet } from "@phosphor-icons/react";
import { useWeb3Modal } from "@web3modal/wagmi/react";
import { useEffect, useState } from "react";
import { useConnection } from "wagmi";

function shortAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

const signInClassName =
  "inline-flex h-9 items-center gap-2 rounded-full border border-[var(--accent)] bg-[var(--surface-elevated)] px-4 text-sm font-semibold text-[var(--foreground)] transition-all duration-200 hover:-translate-y-px hover:border-[var(--dream-yellow)] hover:bg-[var(--surface-hover)] hover:text-[var(--dream-yellow)] hover:shadow-[0_0_20px_-6px_var(--dream-glow)] active:translate-y-0";

function ConnectWalletPlaceholder() {
  return (
    <span className={`${signInClassName} pointer-events-none opacity-90`} aria-hidden>
      <SignIn className="h-4 w-4 text-[var(--accent)]" weight="regular" />
      Sign in
    </span>
  );
}

function ConnectWalletInner() {
  const { open } = useWeb3Modal();
  const { address, status } = useConnection();
  const connected = status === "connected";

  if (connected && address) {
    return (
      <button
        type="button"
        onClick={() => open({ view: "Account" })}
        className="group inline-flex h-9 items-center gap-2 rounded-full border border-[var(--accent)] bg-[var(--surface-elevated)] px-4 text-sm font-medium text-[var(--foreground)] transition-all duration-200 hover:bg-[var(--surface-hover)] hover:shadow-[0_0_16px_-4px_var(--accent-glow)]"
      >
        <Wallet
          className="h-4 w-4 text-[var(--accent)] transition-colors group-hover:text-[var(--accent)]"
          weight="regular"
        />
        <span className="transition-colors group-hover:text-[var(--foreground)]">
          {shortAddress(address)}
        </span>
      </button>
    );
  }

  return (
    <button type="button" onClick={() => open()} className={signInClassName}>
      <SignIn className="h-4 w-4 text-[var(--accent)]" weight="regular" />
      Sign in
    </button>
  );
}

export function ConnectWallet() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return <ConnectWalletPlaceholder />;
  return <ConnectWalletInner />;
}
