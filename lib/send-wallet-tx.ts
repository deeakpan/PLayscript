import type {
  Address,
  Chain,
  Hash,
  Hex,
  PublicClient,
  WalletClient,
} from "viem";

/** Extra headroom — mobile wallets / Somnia RPC often under-estimate. */
const GAS_BUFFER_NUM = 140n;
const GAS_BUFFER_DEN = 100n;

const FALLBACK_GAS_APPROVE = 120_000n;
const FALLBACK_GAS_CONTRACT = 600_000n;

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
  return buffered < 21_000n ? 21_000n : buffered;
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

async function resolveFees(
  publicClient: PublicClient,
): Promise<
  | { maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }
  | { gasPrice: bigint }
  | Record<string, never>
> {
  try {
    const fees = await publicClient.estimateFeesPerGas();
    if (fees.maxFeePerGas != null) {
      const maxFeePerGas = (fees.maxFeePerGas * 125n) / 100n;
      const maxPriorityFeePerGas =
        fees.maxPriorityFeePerGas != null
          ? (fees.maxPriorityFeePerGas * 125n) / 100n
          : maxFeePerGas / 10n;
      return { maxFeePerGas, maxPriorityFeePerGas };
    }
    if (fees.gasPrice != null) {
      return { gasPrice: (fees.gasPrice * 125n) / 100n };
    }
  } catch {
    try {
      const gasPrice = await publicClient.getGasPrice();
      return { gasPrice: (gasPrice * 125n) / 100n };
    } catch {
      return {};
    }
  }
  return {};
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
  value = 0n,
  fallbackGas,
}: SendWalletTxParams): Promise<Hash> {
  const gas = await estimateGasLimit(
    publicClient,
    { account, to, data, value },
    fallbackGas,
  );
  const fees = await resolveFees(publicClient);

  return walletClient.sendTransaction({
    chain,
    account,
    to,
    data,
    value,
    gas,
    ...fees,
  });
}
