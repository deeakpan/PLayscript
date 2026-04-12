import {
  SCRIPT_SLOT_PACKS_ORDER,
  SCRIPT_SPORT_TITLES,
} from "@/lib/script-slots";

export const HIW_SPORT_KEYS = SCRIPT_SLOT_PACKS_ORDER;

export const HIW_SCROLL_SPY_IDS = [
  "overview",
  "tokens",
  "slots",
  "sports",
  "agent",
  "grading",
  "payouts",
  "odds",
  ...HIW_SPORT_KEYS.map((k) => `sport-${k}`),
] as const;

export type HiWTocGroup = {
  label: string;
  items: { id: string; label: string }[];
};

export const HIW_TOC_GROUPS: HiWTocGroup[] = [
  {
    label: "Start here",
    items: [
      { id: "overview", label: "Overview" },
      { id: "tokens", label: "$PLAY & stakes" },
      { id: "slots", label: "Five slots" },
    ],
  },
  {
    label: "Sports",
    items: [
      { id: "sports", label: "How sports differ" },
      ...HIW_SPORT_KEYS.map((k) => ({
        id: `sport-${k}`,
        label: SCRIPT_SPORT_TITLES[k],
      })),
    ],
  },
  {
    label: "Settlement & payouts",
    items: [
      { id: "agent", label: "Settlement & agent" },
      { id: "grading", label: "Grading" },
      { id: "payouts", label: "Payouts & claim" },
      { id: "odds", label: "What “odds” means here" },
    ],
  },
];
