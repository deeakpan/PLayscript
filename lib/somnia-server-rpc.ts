/**
 * RPC used by Next.js route handlers (server). Not exposed to the browser.
 * Order: private env → public env → Somnia infra default → dream-rpc fallback.
 */
export function getServerSomniaRpcUrl(): string {
  return (
    process.env.SOMNIA_TESTNET_RPC_URL?.trim() ||
    process.env.SOMNIA_RPC_TESTNET?.trim() ||
    process.env.NEXT_PUBLIC_SOMNIA_TESTNET_RPC_URL?.trim() ||
    process.env.NEXT_PUBLIC_SOMNIA_RPC_TESTNET?.trim() ||
    "https://api.infra.testnet.somnia.network"
  );
}
