"use client";

import { ArrowUpRight, Gear, House, List, ListBullets, Wallet, X } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";

import { BrandLogo } from "@/components/layout/brand-logo";
import { HowItWorksTocPanel } from "@/components/how-it-works/how-it-works-toc-panel";
import { useHowItWorksScroll } from "@/components/how-it-works/how-it-works-scroll-context";
import { ConnectWallet } from "@/components/web3/connect-wallet";
import { PlayBalance } from "@/components/web3/play-balance";
import { PlayFaucet } from "@/components/web3/play-faucet";

const nav = [
  { href: "/", label: "Matches", icon: House },
  { href: "/vaults", label: "Vaults", icon: Wallet },
  { href: "/scripts", label: "My scripts", icon: ListBullets },
  { href: "/how-it-works", label: "How it works", icon: ArrowUpRight },
  { href: "/settings", label: "Settings", icon: Gear },
] as const;

function navItemActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (href === "/vaults" && pathname.startsWith("/vaults")) return true;
  return false;
}

function headerTitle(pathname: string): string {
  if (pathname === "/" || pathname === "") return "Match center";
  if (pathname === "/scripts") return "My scripts";
  if (pathname === "/vaults" || pathname.startsWith("/vaults/")) return "Vaults";
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
  const [headerScrolled, setHeaderScrolled] = useState(false);
  const { activeId: hiwActiveId } = useHowItWorksScroll();
  const mobileHowItWorksToc = pathname === "/how-it-works";

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onScroll = () => setHeaderScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
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
        className={`fixed inset-0 z-[55] bg-black/50 backdrop-blur-sm transition-opacity duration-200 md:hidden ${
          mobileNavOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setMobileNavOpen(false)}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-[60] flex min-h-0 w-[min(17rem,88vw)] flex-col border-r border-[var(--border)] bg-[var(--shell-sidebar-fill)] backdrop-blur-lg transition-transform duration-200 ease-out md:z-40 md:h-screen md:w-52 md:translate-x-0 ${
          mobileNavOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-[var(--border)] px-3 md:px-4">
          <Link
            href="/"
            onClick={() => setMobileNavOpen(false)}
            className="flex min-h-0 min-w-0 flex-1 items-center rounded-md transition-opacity hover:opacity-90 md:flex-none"
            aria-label="Playscript home"
          >
            <BrandLogo
              className="h-12 w-auto max-w-[12.5rem] object-contain object-left md:max-w-[13rem]"
              priority
            />
          </Link>
          <button
            type="button"
            onClick={() => setMobileNavOpen(false)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[var(--muted)] transition-colors hover:bg-[var(--surface-highlight-hover)] hover:text-[var(--dream-yellow)] md:hidden"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" weight="regular" />
          </button>
        </div>

        {mobileHowItWorksToc ? (
          <>
            <div className="flex min-h-0 flex-1 flex-col md:hidden">
              <HowItWorksTocPanel
                activeId={hiwActiveId}
                onNavigate={() => setMobileNavOpen(false)}
              />
            </div>
            <nav className="hidden min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-2 md:flex">
              {nav.map(({ href, label, icon: Icon }) => {
                const active = navItemActive(pathname, href);
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
          </>
        ) : (
          <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-2">
            {nav.map(({ href, label, icon: Icon }) => {
              const active = navItemActive(pathname, href);
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
        )}

        <footer
          className={`mt-auto shrink-0 border-t border-[var(--border)] px-3 py-3 md:py-4 ${
            mobileHowItWorksToc ? "hidden md:block" : ""
          }`}
        >
          <p className="text-center text-[10px] leading-relaxed text-[var(--muted)]">
            © {new Date().getFullYear()} Playscript
          </p>
        </footer>
      </aside>

      <div className="flex min-h-screen w-full min-w-0 flex-1 flex-col md:pl-52">
        <header
          className={`sticky top-0 z-50 flex h-14 shrink-0 items-center justify-between gap-2 border-b px-3 transition-[background-color,backdrop-filter,border-color] duration-200 sm:gap-3 sm:px-5 ${
            headerScrolled
              ? "border-[var(--border)] bg-[var(--shell-header-scrolled-fill)] backdrop-blur-md"
              : "border-[var(--shell-header-border)] bg-transparent"
          }`}
        >
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[var(--foreground)] transition-colors hover:bg-[var(--surface-highlight-hover)] hover:text-[var(--dream-yellow)] md:hidden"
              aria-label="Open menu"
            >
              <List className="h-5 w-5" weight="regular" />
            </button>
            <Link
              href="/"
              className="flex min-h-0 min-w-0 flex-1 items-center md:hidden"
              aria-label="Playscript home"
            >
              <BrandLogo className="h-11 w-auto max-w-[11rem] object-contain object-left" />
            </Link>
            <h1 className="hidden min-w-0 truncate text-sm font-semibold tracking-tight text-[var(--foreground)] md:block">
              {headerTitle(pathname)}
            </h1>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <PlayFaucet />
            <div className="hidden sm:block">
              <PlayBalance />
            </div>
            <Link
              href="/how-it-works"
              className="group hidden items-center gap-0.5 text-xs font-medium text-[var(--muted)] transition-colors hover:text-[var(--dream-yellow)] md:inline-flex"
            >
              How it works
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
