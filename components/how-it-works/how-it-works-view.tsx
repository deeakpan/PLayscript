"use client";

import type { ReactNode } from "react";

import {
  difficultyLabel,
  selectV2MarketLegs,
  V2_LEG_COUNT,
  V2_PICK_COUNT,
} from "@/lib/playscript-v2-legs";
import { SCRIPT_SLOT_PACKS_ORDER, SCRIPT_SPORT_TITLES } from "@/lib/script-slots";

import { useHowItWorksScroll } from "@/components/how-it-works/how-it-works-scroll-context";
import { HowItWorksTocPanel } from "@/components/how-it-works/how-it-works-toc-panel";

const SPORT_KEYS = SCRIPT_SLOT_PACKS_ORDER;

function Prose({ children }: { children: ReactNode }) {
  return (
    <div className="max-w-2xl space-y-3 text-sm leading-relaxed text-[var(--muted)] [&_strong]:font-semibold [&_strong]:text-[var(--foreground)] [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
      {children}
    </div>
  );
}

function SectionBreak() {
  return (
    <div
      className="my-14 w-full border-t-2 border-[var(--border)] opacity-90 sm:my-16"
      aria-hidden
    />
  );
}

function MajorSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 space-y-3">
      <h2 className="font-[family-name:var(--font-syne),ui-sans-serif,sans-serif] text-xl font-semibold tracking-tight text-[var(--foreground)] sm:text-2xl">
        {title}
      </h2>
      {children}
    </section>
  );
}

function ExampleCard({ children }: { children: ReactNode }) {
  return (
    <div className="max-w-2xl rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
        Example
      </p>
      <div className="mt-3 space-y-3 text-sm text-[var(--foreground)]">{children}</div>
    </div>
  );
}

function ExampleRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-[var(--border)]/60 pb-2 last:border-0 last:pb-0">
      <span className="text-[var(--muted)]">{label}</span>
      <span
        className={`font-mono text-sm font-semibold tabular-nums ${highlight ? "text-emerald-300/95" : "text-[var(--foreground)]"}`}
      >
        {value}
      </span>
    </div>
  );
}

export function HowItWorksView() {
  const { activeId } = useHowItWorksScroll();

  return (
    <div className="flex flex-col gap-8 md:grid md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] md:gap-8 lg:gap-10">
      <div className="hidden md:block lg:sticky lg:top-24 lg:max-h-[calc(100vh-8rem)] lg:self-start lg:overflow-y-auto">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <HowItWorksTocPanel activeId={activeId} />
        </div>
      </div>

      <article className="min-w-0">
        <header className="space-y-4">
          <h1
            id="overview"
            className="font-[family-name:var(--font-syne),ui-sans-serif,sans-serif] scroll-mt-24 text-3xl font-semibold tracking-tight text-[var(--foreground)] sm:text-4xl"
          >
            How it works
          </h1>
          <Prose>
            <p>
              <strong>Playscript</strong> lets you build a short prediction script on a real match:
              choose <strong>five outcomes</strong> from the board, stake <strong>$PLAY</strong>, and
              win if <strong>all five</strong> are right when the game is over.
            </p>
            <p>
              Harder picks raise your <strong>payout multiplier</strong>. Easier picks lower it. You
              see the multiplier before you lock in.
            </p>
          </Prose>
        </header>

        <SectionBreak />

        <MajorSection id="play" title="$PLAY & locking">
          <Prose>
            <p>
              Stakes use the <strong>PLAY</strong> token (shown as $PLAY in the app). Use the{" "}
              <strong>Faucet</strong> on testnet if you need tokens to try a script.
            </p>
            <p>
              When you lock a script, your PLAY goes into the shared pool that pays winners. A small{" "}
              <strong>0.5% lock fee</strong> is taken from the amount that actually locks (you see the
              net stake on screen).
            </p>
            <p>
              You need PLAY in your wallet and permission for the app to use it for that lock — the
              wallet will ask you to confirm once.
            </p>
          </Prose>
        </MajorSection>

        <SectionBreak />

        <MajorSection id="build" title="Pick your five">
          <Prose>
            <p>
              Each match has a board of <strong>{V2_LEG_COUNT} markets</strong> (winner, goals, cards,
              and more depending on the sport). You must pick <strong>exactly {V2_PICK_COUNT}</strong>{" "}
              before you can lock.
            </p>
            <p>Each line is tagged <strong>Easy</strong>, <strong>Medium</strong>, or <strong>Hard</strong>:</p>
            <ul>
              <li>
                <strong>Easy</strong> — more likely outcomes (e.g. a favourite to win).
              </li>
              <li>
                <strong>Medium</strong> — balanced props (e.g. both teams score).
              </li>
              <li>
                <strong>Hard</strong> — tougher calls (e.g. exact-margin or low-scoring lines).
              </li>
            </ul>
            <p>
              Your five choices are combined into one <strong>difficulty score</strong>. That score sets
              your <strong>multiplier</strong> — from about <strong>1.8×</strong> up to about{" "}
              <strong>20×</strong>. More hard picks in the mix → higher multiplier (and you must hit all
              five to get paid).
            </p>
            <p>
              Open any fixture to see the live board, build your script, and lock before kickoff. Tap a
              row in <strong>My Scripts</strong> to reopen that match and see your picks.
            </p>
          </Prose>
        </MajorSection>

        <SectionBreak />

        <MajorSection id="stake-example" title="Stake & multiplier">
          <Prose>
            <p>
              The app shows your <strong>stake</strong> and <strong>potential payout</strong> when you
              lock. Payout means: if every pick is correct, you receive stake × multiplier (from your
              net stake after the lock fee).
            </p>
          </Prose>
          <div className="mt-4 space-y-4">
            <ExampleCard>
              <p className="text-[var(--muted)]">
                You lock <strong className="text-[var(--foreground)]">100 PLAY</strong> on a script
                whose picks add up to a <strong className="text-[var(--foreground)]">7×</strong>{" "}
                multiplier (a fairly mixed easy / medium / hard set).
              </p>
              <ExampleRow label="Amount you lock" value="100 PLAY" />
              <ExampleRow label="Lock fee (0.5%)" value="0.5 PLAY" />
              <ExampleRow label="Net stake (what counts)" value="99.5 PLAY" />
              <ExampleRow label="Multiplier" value="7×" />
              <ExampleRow label="Potential payout if you win" value="696.5 PLAY" highlight />
            </ExampleCard>
            <Prose>
              <p>
                The multiplier updates as you change picks. If the pool is nearly full, your lock might
                use slightly less than you typed — any leftover PLAY is returned to your wallet.
              </p>
              <p>
                This is not a bookmaker &quot;odds&quot; screen. It is the payout tied to{" "}
                <strong>your</strong> five picks and the rules of the game: win only if{" "}
                <strong>all five</strong> are correct.
              </p>
            </Prose>
          </div>
        </MajorSection>

        <SectionBreak />

        <MajorSection id="before-kickoff" title="Before kickoff">
          <Prose>
            <p>
              Lock your script while the match is still <strong>open</strong> (before kickoff). After
              that, your picks are fixed for that match.
            </p>
            <p>
              Changed your mind? Use <strong>Withdraw stake</strong> on the fixture page while the match
              is still open. You get your PLAY back (minus the small lock fee you already paid). Your
              picks are cleared for that match.
            </p>
            <p>
              One active script per wallet per match — pick your five, lock once, or withdraw and try
              again before kickoff.
            </p>
          </Prose>
        </MajorSection>

        <SectionBreak />

        <MajorSection id="after-match" title="After the match">
          <Prose>
            <p>
              When the game finishes, the result is checked against your five picks. The app grades each
              line as right or wrong.
            </p>
            <ul>
              <li>
                <strong>All five correct</strong> — you can <strong>Claim payout</strong>. PLAY is sent
                to your wallet (stake × multiplier on your net stake).
              </li>
              <li>
                <strong>Any pick wrong</strong> — no payout for that script. Your stake stays in the
                pool.
              </li>
            </ul>
            <p>
              Settlement can take a short while after the final whistle. The fixture page will show when
              your script is ready to claim.
            </p>
            <p>
              Winnings are paid from the shared <strong>PLAY vault</strong> — see{" "}
              <a href="#vault-lp" className="font-medium text-[var(--accent)] underline-offset-2 hover:underline">
                Vault &amp; LP
              </a>{" "}
              if you want to supply liquidity instead of playing scripts.
            </p>
          </Prose>
        </MajorSection>

        <SectionBreak />

        <MajorSection id="vault-lp" title="Vault & liquidity (LP)">
          <Prose>
            <p>
              The <strong>Play vault</strong> is the PLAY pool behind every match. When you lock a script,
              your stake goes into this vault. When you win, the vault pays you (stake × multiplier on your
              net stake). When you lose, that PLAY stays in the vault.
            </p>
            <p>
              <strong>Liquidity providers (LPs)</strong> are people who deposit PLAY into the vault up
              front. They take the other side of the game: they earn when players lose, and they fund
              payouts when players win. You do not need to be an LP to play a script — it is a separate
              role. Open <strong>Vaults</strong> in the app menu to deposit or withdraw.
            </p>
          </Prose>

          <div className="mt-4 space-y-4">
            <ExampleCard>
              <p className="text-[var(--muted)]">
                Think of the vault as one shared wallet. Player stakes flow in; winner payouts flow out.
                LPs own a <strong className="text-[var(--foreground)]">share</strong> of whatever is left.
              </p>
              <ExampleRow label="You lock 100 PLAY" value="→ vault" />
              <ExampleRow label="You win at 7× (net stake)" value="← vault pays" highlight />
              <ExampleRow label="You lose" value="PLAY stays in vault" />
              <ExampleRow label="LPs" value="share rises / falls with pool" />
            </ExampleCard>
          </div>

          <Prose>
            <p className="mt-4">
              <strong>Depositing as an LP.</strong> You send PLAY to the vault and receive{" "}
              <strong>vault shares</strong>. Your share of the pool is your shares ÷ total shares. If the
              vault grows because losing stakes stayed inside (and from the small{" "}
              <strong>0.5% lock fee</strong> on each script lock), each share is worth more PLAY. If many
              players win, the vault pays out and shares are worth less.
            </p>
            <p>
              <strong>Match liability (why withdrawal is capped).</strong> When a match is registered on
              chain, the system <strong>reserves up to 9.8%</strong> of the vault&apos;s PLAY balance for
              that match — headroom for possible winner payouts. As players lock scripts, real liability
              fills that bucket (based on stake × multiplier). While matches are open, that reserved PLAY
              is not available for LP withdrawals.
            </p>
            <p>
              The vault also keeps a <strong>2% hard floor</strong> — a safety buffer that is never treated
              as free cash. What LPs can withdraw today is called <strong>free float</strong>: vault balance
              minus outstanding match liability minus that floor. The vault page shows a pie chart: liability,
              floor, and free float.
            </p>
            <p>
              <strong>Withdrawing as an LP.</strong> You burn some of your shares and receive PLAY back.
              You only get paid up to the current <strong>free float</strong> — if most of the vault is
              reserved for live matches, you may receive a <strong>partial</strong> withdrawal now and can
              withdraw more after those matches settle and liability is released. There is no fixed lock-up
              period; it depends on how many matches are active.
            </p>
            <p>
              <strong>After a match settles.</strong> Liability for that match is cleared on chain. Unused
              reserved capacity is freed, free float goes up, and LPs can withdraw more. Winning players
              claim from the vault; losing stakes remain with LPs.
            </p>
            <ul>
              <li>
                <strong>Players</strong> — pick five, lock PLAY, claim if you win.
              </li>
              <li>
                <strong>LPs</strong> — deposit PLAY, hold shares, withdraw when free float allows.
              </li>
            </ul>
          </Prose>

          <div className="mt-4 space-y-4">
            <ExampleCard>
              <p className="text-[var(--muted)]">
                Simplified vault with <strong className="text-[var(--foreground)]">1,000,000 PLAY</strong>{" "}
                and one new match registered (9.8% reserved).
              </p>
              <ExampleRow label="Vault balance" value="1,000,000 PLAY" />
              <ExampleRow label="Reserved for that match (max)" value="98,000 PLAY" />
              <ExampleRow label="2% hard floor" value="20,000 PLAY" />
              <ExampleRow label="Free float (approx.)" value="882,000 PLAY" highlight />
              <p className="pt-2 text-xs leading-relaxed text-[var(--muted)]">
                Each additional registered match reserves another 9.8% of the vault total until the safety
                checks block new matches. As matches finish, reserved amounts drop and free float grows.
              </p>
            </ExampleCard>
          </div>
        </MajorSection>

        {SPORT_KEYS.map((sportKey) => {
          const legs = selectV2MarketLegs("how-it-works", "Home", "Away", sportKey);
          const title = SCRIPT_SPORT_TITLES[sportKey];
          return (
            <div key={sportKey}>
              <SectionBreak />
              <section id={`sport-${sportKey}`} className="scroll-mt-24 space-y-6">
                <h2 className="font-[family-name:var(--font-syne),ui-sans-serif,sans-serif] text-xl font-semibold tracking-tight text-[var(--foreground)] sm:text-2xl">
                  {title} markets
                </h2>
                <p className="max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
                  Example board for this sport — team names on a real fixture will match that game. Pick{" "}
                  {V2_PICK_COUNT} from {V2_LEG_COUNT} on the match page.
                </p>
                <div className="max-w-2xl divide-y divide-[var(--border)]/90">
                  {legs.map((leg) => (
                    <div key={leg.id} className="flex items-start justify-between gap-3 py-3 first:pt-0">
                      <p className="min-w-0 flex-1 text-sm leading-snug text-[var(--foreground)]">
                        <span className="mr-2 font-mono text-xs tabular-nums text-[var(--accent)]">
                          {leg.id}.
                        </span>
                        {leg.description}
                      </p>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${
                          leg.difficulty === "easy"
                            ? "bg-emerald-500/15 text-emerald-200/95 ring-emerald-500/25"
                            : leg.difficulty === "medium"
                              ? "bg-amber-500/12 text-amber-100/90 ring-amber-500/22"
                              : "bg-rose-500/12 text-rose-100/90 ring-rose-500/22"
                        }`}
                      >
                        {difficultyLabel(leg.difficulty)}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          );
        })}
      </article>
    </div>
  );
}
