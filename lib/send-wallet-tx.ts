import type {
  Address,
  Chain,
  Hash,
  Hex,
  PublicClient,
  WalletClient,
} from "viem";

/** Extra headroom — mobile wallets / Somnia RPC often under-estimate. */
const GAS_BUFFER_NUM = BigInt(140);
const GAS_BUFFER_DEN = BigInt(100);

export const FALLBACK_GAS_APPROVE = BigInt(120_000);
export const FALLBACK_GAS_CONTRACT = BigInt(600_000);

export type SendWalletTxParams = {
  walletClient: WalletClient;
  publicClient: PublicClient;
  account: Address;
  chain: Chain;
  to: Address;
  data: Hex;
  value?: bigint;
  /** Used when RPC simulation fails (e.g. approve while already max). */
  fallbackGas?: bigint;
};

function bufferGas(gas: bigint): bigint {
  const buffered = (gas * GAS_BUFFER_NUM) / GAS_BUFFER_DEN;
  return buffered < BigInt(21_000) ? BigInt(21_000) : buffered;
}

function isApproveCalldata(data: Hex): boolean {
  return data.startsWith("0x095ea7b3");
}

async function estimateGasLimit(
  publicClient: PublicClient,
  request: {
    account: Address;
    to: Address;
    data: Hex;
    value: bigint;
  },
  fallbackGas?: bigint,
): Promise<bigint> {
  try {
    const gas = await publicClient.estimateGas(request);
    return bufferGas(gas);
  } catch {
    if (fallbackGas != null) return bufferGas(fallbackGas);
    if (isApproveCalldata(request.data)) return bufferGas(FALLBACK_GAS_APPROVE);
    return bufferGas(FALLBACK_GAS_CONTRACT);
  }
}

type FeeFields =
  | { maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }
  | { gasPrice: bigint }
  | null;

async function resolveFees(publicClient: PublicClient): Promise<FeeFields> {
  try {
    const fees = await publicClient.estimateFeesPerGas();
    if (fees.maxFeePerGas != null) {
      const maxFeePerGas = (fees.maxFeePerGas * BigInt(125)) / BigInt(100);
      const maxPriorityFeePerGas =
        fees.maxPriorityFeePerGas != null
          ? (fees.maxPriorityFeePerGas * BigInt(125)) / BigInt(100)
          : maxFeePerGas / BigInt(10);
      return { maxFeePerGas, maxPriorityFeePerGas };
    }
    if (fees.gasPrice != null) {
      return { gasPrice: (fees.gasPrice * BigInt(125)) / BigInt(100) };
    }
  } catch {
    try {
      const gasPrice = await publicClient.getGasPrice();
      return { gasPrice: (gasPrice * BigInt(125)) / BigInt(100) };
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Send a contract call with gas + fees estimated on our public RPC (not the wallet’s).
 * Fixes “cannot estimate gas” on mobile WalletConnect / in-app browsers.
 */
export async function sendWalletTx({
  walletClient,
  publicClient,
  account,
  chain,
  to,
  data,
  value = BigInt(0),
  fallbackGas,
}: SendWalletTxParams): Promise<Hash> {
  const gas = await estimateGasLimit(
    publicClient,
    { account, to, data, value },
    fallbackGas,
  );
  const fees = await resolveFees(publicClient);
  const base = { chain, account, to, data, value, gas };

  if (fees && "maxFeePerGas" in fees) {
    return walletClient.sendTransaction({
      ...base,
      maxFeePerGas: fees.maxFeePerGas,
      maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
    });
  }
  if (fees && "gasPrice" in fees) {
    return walletClient.sendTransaction({
      ...base,
      gasPrice: fees.gasPrice,
    });
  }
  return walletClient.sendTransaction(base);
}
