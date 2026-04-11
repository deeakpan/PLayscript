import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@web3modal/wagmi",
    "@web3modal/base",
    "@web3modal/ui",
    "@web3modal/core",
    "@walletconnect/ethereum-provider",
  ],
};

export default nextConfig;
