import { NextResponse } from "next/server";

import { getPlayscriptV2KernelEnv } from "@/lib/playscript-public-env";
import { resolvePlayscriptV2MatchIdByUrl } from "@/lib/playscript-read-onchain";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rawUrl = searchParams.get("url")?.trim() ?? "";
  if (!rawUrl || rawUrl.length > 4096) {
    return NextResponse.json({ ok: false, error: "Missing or invalid `url` query param." }, { status: 400 });
  }

  const env = getPlayscriptV2KernelEnv();
  if (!env.ok) {
    return NextResponse.json(
      { ok: false, error: "Playscript v2 kernel not configured (NEXT_PUBLIC_PLAYSCRIPT_V2_KERNEL_ADDRESS)." },
      { status: 503 },
    );
  }

  try {
    const matchId = await resolvePlayscriptV2MatchIdByUrl(env.kernel, rawUrl);
    return NextResponse.json({
      ok: true,
      matchId: matchId === null ? null : matchId.toString(),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "RPC or decode failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}
