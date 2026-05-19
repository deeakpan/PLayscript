import { NextResponse } from "next/server";
import { getAddress, isAddress } from "viem";

import { FAUCET_DAILY_PLAY } from "@/lib/faucet/constants";
import { alreadyClaimedMessage } from "@/lib/faucet/format-retry";
import { mintFaucetPlay } from "@/lib/faucet/mint-play";
import { runFaucetClaim } from "@/lib/faucet/store";
import { getPlayTokenEnv } from "@/lib/playscript-public-env";
import { createSomniaPublicClient, readPlayBalance } from "@/lib/playscript-read-onchain";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  let body: { address?: string };
  try {
    body = (await req.json()) as { address?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const raw = body.address?.trim() ?? "";
  if (!raw || !isAddress(raw)) {
    return NextResponse.json({ ok: false, error: "Missing or invalid `address`." }, { status: 400 });
  }
  const address = getAddress(raw) as `0x${string}`;

  const playEnv = getPlayTokenEnv();
  if (!playEnv.ok) {
    return NextResponse.json({ ok: false, error: playEnv.reason }, { status: 503 });
  }

  try {
    const result = await runFaucetClaim(address.toLowerCase(), async () => {
      const { txHash } = await mintFaucetPlay(address);
      const client = createSomniaPublicClient();
      await client.waitForTransactionReceipt({ hash: txHash as `0x${string}` });
      return { txHash };
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: alreadyClaimedMessage(result.nextClaimAt),
          code: result.code,
          nextClaimAt: result.nextClaimAt,
        },
        { status: 429 },
      );
    }

    const { raw: balance, decimals } = await readPlayBalance(playEnv.playToken, address);

    return NextResponse.json({
      ok: true,
      txHash: result.txHash,
      amountPlay: FAUCET_DAILY_PLAY,
      lastClaimDay: result.lastClaimDay,
      balance: balance.toString(),
      decimals,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Claim failed";
    const status = msg.includes("PRIVATE_KEY") ? 503 : 502;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
