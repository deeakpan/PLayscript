import type { ScriptSportKey } from "@/lib/fixtures-shared";

export type ScriptSlotDef = {
  index: number;
  title: string;
  outcomes: string;
  anchor: string;
};

const SOCCER_SLOTS: readonly ScriptSlotDef[] = [
  {
    index: 1,
    title: "Match winner",
    outcomes: "Home / Draw / Away",
    anchor: "match-winner",
  },
  {
    index: 2,
    title: "Total goals",
    outcomes: "Over 2.5 / Under 2.5",
    anchor: "total-goals",
  },
  {
    index: 3,
    title: "Both teams score",
    outcomes: "Yes / No",
    anchor: "both-teams-score",
  },
  {
    index: 4,
    title: "Clean sheet",
    outcomes: "Yes / No",
    anchor: "clean-sheet",
  },
  {
    index: 5,
    title: "Correct score",
    outcomes: "Exact home & away goals (e.g. 2–1)",
    anchor: "correct-score",
  },
];

const BASKETBALL_SLOTS: readonly ScriptSlotDef[] = [
  {
    index: 1,
    title: "Game winner",
    outcomes: "Home / Away",
    anchor: "bb-game-winner",
  },
  {
    index: 2,
    title: "Total points",
    outcomes: "Over 220.5 / Under 220.5",
    anchor: "bb-total-points",
  },
  {
    index: 3,
    title: "Both teams 100+",
    outcomes: "Each team scores at least 100 — Yes / No",
    anchor: "bb-both-100",
  },
  {
    index: 4,
    title: "Combined 230+",
    outcomes: "Total points 230 or more — Yes / No",
    anchor: "bb-combined-230",
  },
  {
    index: 5,
    title: "Blowout margin",
    outcomes: "Winner wins by 10+ points — Yes / No",
    anchor: "bb-margin-10",
  },
];

const BASEBALL_SLOTS: readonly ScriptSlotDef[] = [
  {
    index: 1,
    title: "Game winner",
    outcomes: "Home / Away",
    anchor: "mlb-game-winner",
  },
  {
    index: 2,
    title: "Total runs",
    outcomes: "Over 8.5 / Under 8.5",
    anchor: "mlb-total-runs",
  },
  {
    index: 3,
    title: "Both teams 3+ runs",
    outcomes: "Each team scores at least 3 runs — Yes / No",
    anchor: "mlb-both-3",
  },
  {
    index: 4,
    title: "Combined 10+ runs",
    outcomes: "Total runs 10 or more — Yes / No",
    anchor: "mlb-combined-10",
  },
  {
    index: 5,
    title: "Run margin",
    outcomes: "Winner wins by 3+ runs — Yes / No",
    anchor: "mlb-margin-3",
  },
];

const AMERICAN_FOOTBALL_SLOTS: readonly ScriptSlotDef[] = [
  {
    index: 1,
    title: "Game result",
    outcomes: "Home / Away / Tie",
    anchor: "nfl-result",
  },
  {
    index: 2,
    title: "Total points",
    outcomes: "Over 43.5 / Under 43.5",
    anchor: "nfl-total-points",
  },
  {
    index: 3,
    title: "Both teams 20+",
    outcomes: "Each team scores at least 20 — Yes / No",
    anchor: "nfl-both-20",
  },
  {
    index: 4,
    title: "Combined 50+",
    outcomes: "Total points 50 or more — Yes / No",
    anchor: "nfl-combined-50",
  },
  {
    index: 5,
    title: "Double-digit win",
    outcomes: "Winner wins by 10+ points — Yes / No",
    anchor: "nfl-margin-10",
  },
];

const SLOT_PACKS: Record<ScriptSportKey, readonly ScriptSlotDef[]> = {
  soccer: SOCCER_SLOTS,
  basketball: BASKETBALL_SLOTS,
  american_football: AMERICAN_FOOTBALL_SLOTS,
  baseball: BASEBALL_SLOTS,
};

export function getScriptSlots(sport: ScriptSportKey): readonly ScriptSlotDef[] {
  return SLOT_PACKS[sport] ?? SOCCER_SLOTS;
}

/** Default pack (football) — how-it-works primary copy + legacy imports. */
export const SCRIPT_SLOTS: readonly ScriptSlotDef[] = SOCCER_SLOTS;

export const SCRIPT_SLOT_PACKS_ORDER: readonly ScriptSportKey[] = [
  "soccer",
  "basketball",
  "american_football",
  "baseball",
];

export const SCRIPT_SPORT_TITLES: Record<ScriptSportKey, string> = {
  soccer: "Football (soccer)",
  basketball: "Basketball (NBA)",
  american_football: "American football (NFL)",
  baseball: "Baseball (MLB)",
};
