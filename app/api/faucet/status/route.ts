import { NextResponse } from "next/server";
import { getAddress, isAddress } from "viem";

import { FAUCET_DAILY_PLAY } from "@/lib/faucet/constants";
import { readFaucetEligibility } from "@/lib/faucet/store";
import { getPlayTokenEnv } from "@/lib/playscript-public-env";
import { readPlayBalance } from "@/lib/playscript-read-onchain";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("address")?.trim() ?? "";
  if (!raw || !isAddress(raw)) {
    return NextResponse.json({ ok: false, error: "Missing or invalid `address`." }, { status: 400 });
  }
  const address = getAddress(raw);

  const playEnv = getPlayTokenEnv();
  if (!playEnv.ok) {
    return NextResponse.json({ ok: false, error: playEnv.reason }, { status: 503 });
  }

  try {
    const [elig, bal] = await Promise.all([
      readFaucetEligibility(address.toLowerCase()),
      readPlayBalance(playEnv.playToken, address),
    ]);

    return NextResponse.json({
      ok: true,
      address,
      dailyAmountPlay: FAUCET_DAILY_PLAY,
      canClaim: elig.canClaim,
      lastClaimDay: elig.lastClaimDay,
      nextClaimAt: elig.nextClaimAt,
      balance: bal.raw.toString(),
      decimals: bal.decimals,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Faucet status failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}
