"use client";

import { ArrowUpRight, Gear, House, List, ListBullets, SoccerBall, X } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";

import { ConnectWallet } from "@/components/web3/connect-wallet";
import { PlayBalance } from "@/components/web3/play-balance";

const nav = [
  { href: "/", label: "Matches", icon: House },
  { href: "/scripts", label: "My scripts", icon: ListBullets },
  { href: "/settings", label: "Settings", icon: Gear },
] as const;

function headerTitle(pathname: string): string {
  if (pathname === "/" || pathname === "") return "Match center";
  if (pathname === "/scripts") return "My scripts";
  if (pathname === "/settings") return "Settings";
  if (pathname === "/how-it-works") return "How it works";
  if (pathname === "/docs" || pathname.startsWith("/docs/")) return "Docs";
  if (pathname.startsWith("/fixtures/")) return "Fixture";
  if (pathname === "/markets") return "Markets";
  return "Match center";
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileNavOpen]);

  return (
    <div className="flex min-h-full bg-transparent">
      {/* Mobile: tap outside drawer */}
      <button
        type="button"
        aria-label="Close navigation"
        className={`fixed inset-0 top-14 z-40 bg-[var(--shell-header-fill)] backdrop-blur-md transition-opacity duration-200 md:hidden ${
          mobileNavOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setMobileNavOpen(false)}
      />

      <aside
        className={`fixed bottom-0 left-0 top-14 z-50 flex w-[min(17rem,88vw)] flex-col border-r border-[var(--border)] bg-[var(--shell-sidebar-fill)] backdrop-blur-lg transition-transform duration-200 ease-out md:top-0 md:z-40 md:h-screen md:w-52 md:translate-x-0 ${
          mobileNavOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="flex h-14 shrink-0 items-center justify-end gap-2 border-b border-[var(--border)] px-4 md:justify-between">
          <div className="hidden min-w-0 items-center gap-2 md:flex">
            <SoccerBall
              className="h-7 w-7 shrink-0 text-[var(--accent)]"
              weight="regular"
            />
            <p className="truncate text-sm font-semibold tracking-tight text-[var(--accent)]">
              Playscript
            </p>
          </div>
          <button
            type="button"
            onClick={() => setMobileNavOpen(false)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[var(--muted)] transition-colors hover:bg-[var(--surface-highlight-hover)] hover:text-[var(--dream-yellow)] md:hidden"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" weight="regular" />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileNavOpen(false)}
                className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-[var(--surface-active)] text-[var(--foreground)] shadow-[inset_2px_0_0_0_var(--accent)]"
                    : "text-[var(--muted)] hover:bg-[var(--surface-highlight-hover)] hover:text-[var(--dream-yellow)]"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" weight="regular" />
                {label}
              </Link>
            );
          })}
        </nav>

        <footer className="mt-auto border-t border-[var(--border)] px-3 py-4">
          <p className="text-center text-[10px] leading-relaxed text-[var(--muted)]">
            © {new Date().getFullYear()} Playscript
          </p>
        </footer>
      </aside>

      <div className="flex min-h-screen w-full min-w-0 flex-1 flex-col md:pl-52">
        <header className="sticky top-0 z-50 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--shell-header-fill)] px-3 backdrop-blur-md sm:gap-3 sm:px-5">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[var(--foreground)] transition-colors hover:bg-[var(--surface-highlight-hover)] hover:text-[var(--dream-yellow)] md:hidden"
              aria-label="Open menu"
            >
              <List className="h-5 w-5" weight="regular" />
            </button>
            <div className="flex min-w-0 items-center gap-2 md:hidden">
              <SoccerBall
                className="h-6 w-6 shrink-0 text-[var(--accent)]"
                weight="regular"
              />
              <span className="truncate text-sm font-semibold tracking-tight text-[var(--accent)]">
                Playscript
              </span>
            </div>
            <h1 className="hidden min-w-0 truncate text-sm font-semibold tracking-tight text-[var(--foreground)] md:block">
              {headerTitle(pathname)}
            </h1>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            <div className="hidden md:block">
              <PlayBalance />
            </div>
            <Link
              href="/how-it-works"
              className="hidden text-xs font-medium text-[var(--muted)] transition-colors hover:text-[var(--dream-yellow)] md:inline"
            >
              How it works
            </Link>
            <Link
              href="/docs"
              className="group inline-flex items-center gap-0.5 text-xs font-medium text-[var(--muted)] transition-colors hover:text-[var(--dream-yellow)]"
            >
              Docs
              <ArrowUpRight
                className="h-3.5 w-3.5 opacity-80 transition-transform group-hover:-translate-y-px group-hover:translate-x-px group-hover:text-[var(--dream-yellow)]"
                weight="regular"
              />
            </Link>
            <div className="ml-2 border-l border-[var(--border)] pl-3 sm:ml-4 sm:pl-5">
              <ConnectWallet />
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
