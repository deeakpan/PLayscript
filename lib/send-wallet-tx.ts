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

/**
 * Send a contract call with an explicit `gas` limit from our RPC (buffered), but **no** gasPrice /
 * maxFeePerGas overrides. Mobile wallets (WalletConnect / MM) often show a red “review” banner and
 * disable Confirm when our fee fields disagree with their chain config or simulation path.
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

  return walletClient.sendTransaction({
    chain,
    account,
    to,
    data,
    value,
    gas,
  });
}
