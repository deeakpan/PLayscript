import { NextResponse } from "next/server";

import { resolvePlayscriptMatchIdByUrl } from "@/lib/playscript-read-onchain";
import { getPlayscriptClientEnv } from "@/lib/playscript-public-env";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rawUrl = searchParams.get("url")?.trim() ?? "";
  if (!rawUrl || rawUrl.length > 4096) {
    return NextResponse.json({ ok: false, error: "Missing or invalid `url` query param." }, { status: 400 });
  }

  const env = getPlayscriptClientEnv();
  if (!env.ok) {
    return NextResponse.json(
      { ok: false, error: "Playscript contracts not configured (NEXT_PUBLIC_* addresses)." },
      { status: 503 },
    );
  }

  try {
    const matchId = await resolvePlayscriptMatchIdByUrl(env.playscriptCore, rawUrl);
    return NextResponse.json({
      ok: true,
      matchId: matchId === null ? null : matchId.toString(),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "RPC or decode failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}
