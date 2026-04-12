"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { HIW_SCROLL_SPY_IDS } from "@/lib/how-it-works-toc-data";

type Ctx = { activeId: string };

const HowItWorksScrollContext = createContext<Ctx>({ activeId: "overview" });

export function HowItWorksScrollProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isHowItWorks = pathname === "/how-it-works";
  const [activeId, setActiveId] = useState("overview");

  const update = useCallback(() => {
    const headerPad = 96;
    const y = window.scrollY + headerPad;
    let current: string = HIW_SCROLL_SPY_IDS[0]!;
    for (const id of HIW_SCROLL_SPY_IDS) {
      const el = document.getElementById(id);
      if (!el) continue;
      if (el.offsetTop <= y) current = id;
    }
    setActiveId(current);
  }, []);

  useEffect(() => {
    if (!isHowItWorks) {
      setActiveId("overview");
      return;
    }
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [isHowItWorks, update]);

  const value = useMemo(() => ({ activeId }), [activeId]);

  return (
    <HowItWorksScrollContext.Provider value={value}>{children}</HowItWorksScrollContext.Provider>
  );
}

export function useHowItWorksScroll() {
  return useContext(HowItWorksScrollContext);
}
