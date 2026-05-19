import {
  SCRIPT_SLOT_PACKS_ORDER,
  SCRIPT_SPORT_TITLES,
} from "@/lib/script-slots";

export const HIW_SPORT_KEYS = SCRIPT_SLOT_PACKS_ORDER;

export const HIW_SCROLL_SPY_IDS = [
  "overview",
  "play",
  "build",
  "stake-example",
  "before-kickoff",
  "after-match",
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
      { id: "play", label: "$PLAY & locking" },
      { id: "build", label: "Pick your five" },
    ],
  },
  {
    label: "Stakes & results",
    items: [
      { id: "stake-example", label: "Stake & multiplier" },
      { id: "before-kickoff", label: "Before kickoff" },
      { id: "after-match", label: "After the match" },
    ],
  },
  {
    label: "Markets by sport",
    items: HIW_SPORT_KEYS.map((k) => ({
      id: `sport-${k}`,
      label: SCRIPT_SPORT_TITLES[k],
    })),
  },
];
