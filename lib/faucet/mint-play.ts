import { createWalletClient, http, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { somniaTestnet } from "@/lib/chains/somnia";
import { FAUCET_DAILY_PLAY } from "@/lib/faucet/constants";
import { getPlayTokenEnv } from "@/lib/playscript-public-env";
import { playTokenMintAbi } from "@/lib/play-token-mint-abi";
import { getServerSomniaRpcUrl } from "@/lib/somnia-server-rpc";

function loadFaucetMinterKey(): `0x${string}` {
  const raw = process.env.PRIVATE_KEY?.trim().replace(/^0x/i, "") ?? "";
  if (!raw || !/^[0-9a-fA-F]{64}$/.test(raw)) {
    throw new Error("Faucet unavailable: PRIVATE_KEY is not set for server minting.");
  }
  return `0x${raw}` as `0x${string}`;
}

export async function mintFaucetPlay(to: `0x${string}`): Promise<{ txHash: string; amountWei: bigint }> {
  const playEnv = getPlayTokenEnv();
  if (!playEnv.ok) throw new Error(playEnv.reason);

  const account = privateKeyToAccount(loadFaucetMinterKey());
  const rpc = getServerSomniaRpcUrl();
  const wallet = createWalletClient({
    account,
    chain: somniaTestnet,
    transport: http(rpc, { timeout: 60_000 }),
  });

  const decimals = 18;
  const amountWei = parseUnits(FAUCET_DAILY_PLAY, decimals);

  const txHash = await wallet.writeContract({
    address: playEnv.playToken,
    abi: playTokenMintAbi,
    functionName: "mint",
    args: [to, amountWei],
  });

  return { txHash, amountWei };
}
