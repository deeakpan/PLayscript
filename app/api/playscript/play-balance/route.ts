import { NextResponse } from "next/server";
import { getAddress, isAddress } from "viem";

import { getPlayscriptClientEnv } from "@/lib/playscript-public-env";
import { readPlayBalance } from "@/lib/playscript-read-onchain";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("address")?.trim() ?? "";
  if (!raw || !isAddress(raw)) {
    return NextResponse.json({ ok: false, error: "Missing or invalid `address`." }, { status: 400 });
  }
  const owner = getAddress(raw) as `0x${string}`;

  const env = getPlayscriptClientEnv();
  if (!env.ok) {
    return NextResponse.json(
      { ok: false, error: "NEXT_PUBLIC_PLAY_TOKEN_ADDRESS not set." },
      { status: 503 },
    );
  }

  try {
    const { raw: balance, decimals } = await readPlayBalance(env.playToken, owner);
    return NextResponse.json({
      ok: true,
      balance: balance.toString(),
      decimals,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "RPC failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}
