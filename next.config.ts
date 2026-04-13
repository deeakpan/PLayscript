import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    // Browsers and crawlers request /favicon.ico; serve our PNG so we avoid
    // platform defaults and invalid “.ico” files (PNG renamed to .ico).
    return [{ source: "/favicon.ico", destination: "/logo.png" }];
  },
  transpilePackages: [
    "@web3modal/wagmi",
    "@web3modal/base",
    "@web3modal/ui",
    "@web3modal/core",
    "@walletconnect/ethereum-provider",
  ],
};

export default nextConfig;
