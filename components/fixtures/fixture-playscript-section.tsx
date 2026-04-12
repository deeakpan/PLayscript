"use client";

import { useConnection } from "wagmi";

import type { ScriptSportKey } from "@/lib/fixtures-shared";
import { getPlayscriptClientEnv } from "@/lib/playscript-public-env";
import { usePlayscriptMatchByUrl } from "@/hooks/use-playscript-match-by-url";
import { usePlayscriptUserScript } from "@/hooks/use-playscript-user-script";

import { FixtureExistingScriptCard } from "@/components/fixtures/fixture-existing-script-card";
import { FixturePlayscriptInlineSpinner } from "@/components/fixtures/fixture-playscript-inline-spinner";
import { ScriptSlotForm } from "@/components/script-slot-form";

type Props = {
  lookupeventUrl: string;
  homeTeam: string;
  awayTeam: string;
  canEdit: boolean;
  sportKey: ScriptSportKey;
};

export function FixturePlayscriptSection({
  lookupeventUrl,
  homeTeam,
  awayTeam,
  canEdit,
  sportKey,
}: Props) {
  const env = getPlayscriptClientEnv();
  const q = usePlayscriptMatchByUrl(lookupeventUrl);
  const { address, status } = useConnection();
  const connected = status === "connected";

  const matchId = q.data?.matchId ?? null;
  const numericMatchId = matchId !== null ? Number(matchId) : null;
  const userScriptQ = usePlayscriptUserScript(numericMatchId);

  const checkingUserScript =
    connected &&
    !!address &&
    numericMatchId !== null &&
    env.ok &&
    (userScriptQ.isPending || userScriptQ.isFetching);

  if (!env.ok) {
    return (
      <section className="border-t border-[var(--border)] pt-8">
        <p className="max-w-xl text-sm text-[var(--muted)]">
          On-chain script builder needs{" "}
          <code className="rounded bg-[var(--surface)] px-1 text-xs text-[var(--foreground)]">
            NEXT_PUBLIC_PLAY_TOKEN_ADDRESS
          </code>{" "}
          and{" "}
          <code className="rounded bg-[var(--surface)] px-1 text-xs text-[var(--foreground)]">
            NEXT_PUBLIC_PLAYSCRIPT_CORE_ADDRESS
          </code>{" "}
          (Somnia deployment). {env.reason}
        </p>
      </section>
    );
  }

  if (q.isPending || q.isFetching) {
    return (
      <section className="border-t border-[var(--border)] pt-8">
        <FixturePlayscriptInlineSpinner label="Checking on-chain match for this fixture…" />
      </section>
    );
  }

  if (q.isError) {
    return (
      <section className="border-t border-[var(--border)] pt-8">
        <p className="text-sm text-rose-300/90">
          Could not resolve on-chain match via server RPC. Set{" "}
          <code className="rounded bg-[var(--surface)] px-1 text-xs">SOMNIA_TESTNET_RPC_URL</code> in
          <code className="ml-1 rounded bg-[var(--surface)] px-1 text-xs">.env</code> if the default RPC
          fails.
        </p>
        <p className="mt-2 font-mono text-xs text-[var(--muted)]">{q.error.message}</p>
      </section>
    );
  }

  if (matchId === null) {
    return (
      <section className="border-t border-[var(--border)] pt-8">
        <p className="max-w-xl text-sm text-[var(--muted)]">
          No on-chain match uses this exact TheSportsDB URL yet. After the owner registers this
          event on PlayscriptCore (same <code className="text-xs">lookupevent.php?id=…</code> URL),
          script slots appear here.
        </p>
      </section>
    );
  }

  return (
    <section className="border-t border-[var(--border)] pt-8">
      <p className="mb-4 text-xs font-medium text-[var(--muted)]">
        On-chain match{" "}
        <span className="font-mono text-[var(--foreground)]">#{matchId.toString()}</span>
      </p>

      {checkingUserScript ? (
        <FixturePlayscriptInlineSpinner label="Loading your on-chain script for this match…" />
      ) : userScriptQ.data?.hasScript === true ? (
        <FixtureExistingScriptCard
          matchIdDisplay={matchId.toString()}
          payload={userScriptQ.data}
        />
      ) : (
        <>
          {userScriptQ.isError ? (
            <p className="mb-4 text-sm text-rose-300/90">
              Could not verify whether you already locked a script ({userScriptQ.error.message}).
              You can still use the builder; refresh if a lock already exists.
            </p>
          ) : null}
          <ScriptSlotForm
            homeTeam={homeTeam}
            awayTeam={awayTeam}
            canEdit={canEdit}
            sportKey={sportKey}
            matchId={numericMatchId!}
          />
        </>
      )}
    </section>
  );
}
