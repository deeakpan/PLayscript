import { defineChain } from "viem";

/** Override with `NEXT_PUBLIC_SOMNIA_TESTNET_RPC_URL` if the default is blocked (e.g. browser CORS). */
const somniaHttp =
  process.env.NEXT_PUBLIC_SOMNIA_TESTNET_RPC_URL?.trim() ||
  process.env.NEXT_PUBLIC_SOMNIA_RPC_TESTNET?.trim() ||
  "https://api.infra.testnet.somnia.network";

export const somniaTestnet = defineChain({
  id: 50312,
  name: "Somnia Testnet",
  nativeCurrency: {
    decimals: 18,
    name: "Somnia Test Token",
    symbol: "STT",
  },
  rpcUrls: {
    default: {
      http: [somniaHttp],
    },
  },
  blockExplorers: {
    default: {
      name: "Somnia Shannon Explorer",
      url: "https://shannon-explorer.somnia.network",
    },
  },
});
