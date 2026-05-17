import { NextResponse } from "next/server";

import { isScriptSportKey, type ScriptSportKey } from "@/lib/fixtures-shared";
import {
  buildV2EspnRegisterUrls,
  preflightEspnBeforeRegister,
} from "@/lib/playscript-v2-register-args";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const leagueSlug = searchParams.get("leagueSlug")?.trim() ?? "";
  const eventId = searchParams.get("eventId")?.trim() ?? "";
  const sportRaw = searchParams.get("sport")?.trim() ?? "";

  if (!leagueSlug || !eventId || eventId.length > 32) {
    return NextResponse.json(
      { ok: false, error: "Missing or invalid `leagueSlug` / `eventId`." },
      { status: 400 },
    );
  }
  if (!isScriptSportKey(sportRaw)) {
    return NextResponse.json({ ok: false, error: "Missing or invalid `sport`." }, { status: 400 });
  }
  const sportKey = sportRaw as ScriptSportKey;

  try {
    const urls = buildV2EspnRegisterUrls(leagueSlug, eventId, sportKey);
    await preflightEspnBeforeRegister(urls, sportKey);
    return NextResponse.json({
      ok: true,
      scoreboardUrl: urls.scoreboardUrl,
      summaryUrl: urls.summaryUrl,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Preflight failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 422 });
  }
}
