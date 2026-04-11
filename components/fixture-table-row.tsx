"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

type Props = {
  href: string;
  children: ReactNode;
};

export function FixtureTableRow({ href, children }: Props) {
  const router = useRouter();

  return (
    <tr
      role="link"
      tabIndex={0}
      aria-label="Open match and script slots"
      className="group cursor-pointer transition-colors hover:bg-[var(--surface-highlight-hover)] focus-visible:bg-[var(--surface-highlight-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)]"
      onClick={() => {
        router.push(href);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(href);
        }
      }}
    >
      {children}
    </tr>
  );
}
