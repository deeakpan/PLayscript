/** Football (soccer) script slots — see `playscript-overview.md`. */

export type ScriptSlotDef = {
  index: number;
  title: string;
  outcomes: string;
  anchor: string;
};

export const SCRIPT_SLOTS: readonly ScriptSlotDef[] = [
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
    outcomes: "Exact home & away goals (e.g. 2-1)",
    anchor: "correct-score",
  },
];
