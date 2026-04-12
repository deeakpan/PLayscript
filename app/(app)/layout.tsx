import { AppShell } from "@/components/layout/app-shell";
import { HowItWorksScrollProvider } from "@/components/how-it-works/how-it-works-scroll-context";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <HowItWorksScrollProvider>
      <AppShell>{children}</AppShell>
    </HowItWorksScrollProvider>
  );
}
