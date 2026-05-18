import { expect } from "chai";

import {
  V2_BASKETBALL_MARKET_LEG_KINDS,
  V2_MLB_MARKET_LEG_KINDS,
  V2_NFL_MARKET_LEG_KINDS,
  V2_SOCCER_MARKET_LEG_KINDS,
  V2_BASKETBALL_LEG_KINDS as BK,
  V2_SOCCER_LEG_KINDS as SC,
} from "../lib/playscript-v2-leg-kinds";
import {
  gradeV2LegMaskPicks,
  legIdsToBitmask,
  selectV2MarketLegs,
  v2LegsFromRegisteredKinds,
  V2_LEG_COUNT,
} from "../lib/playscript-v2-legs";

describe("v2 structured market legs", () => {
  it("each sport exposes exactly 15 fixed kinds", () => {
    expect(V2_SOCCER_MARKET_LEG_KINDS).to.have.length(V2_LEG_COUNT);
    expect(V2_BASKETBALL_MARKET_LEG_KINDS).to.have.length(V2_LEG_COUNT);
    expect(V2_NFL_MARKET_LEG_KINDS).to.have.length(V2_LEG_COUNT);
    expect(V2_MLB_MARKET_LEG_KINDS).to.have.length(V2_LEG_COUNT);
  });

  it("soccer market includes 1X2, halves, totals, BTTS, clean sheets, 2H", () => {
    const kinds = V2_SOCCER_MARKET_LEG_KINDS;
    expect(kinds).to.include(SC.HOME_WIN);
    expect(kinds).to.include(SC.DRAW_HT);
    expect(kinds).to.include(SC.HT_OVER_15);
    expect(kinds).to.include(SC.HOME_CS);
    expect(kinds).to.include(SC.SH_OVER_15);
    expect(kinds).to.include(SC.SH_BTTS);
  });

  it("basketball market pairs home/away win and main totals", () => {
    const kinds = V2_BASKETBALL_MARKET_LEG_KINDS;
    expect(kinds).to.include(BK.HOME_WIN);
    expect(kinds).to.include(BK.AWAY_WIN);
    expect(kinds).to.include(BK.OVER_225);
    expect(kinds).to.include(BK.TOTAL_230_PLUS);
    expect(kinds).to.include(BK.HOME_Q1_OVER_28);
    expect(kinds).to.include(BK.AWAY_Q1_OVER_28);
  });

  it("same fixture id does not change leg kinds (no random pool)", () => {
    const a = selectV2MarketLegs("1", "Arsenal", "Chelsea", "soccer").map((l) => l.kind);
    const b = selectV2MarketLegs("999", "Arsenal", "Chelsea", "soccer").map((l) => l.kind);
    expect(a).to.deep.equal(b);
  });

  it("builds unique leg ids 1..15", () => {
    const legs = selectV2MarketLegs("x", "Lakers", "Celtics", "basketball");
    expect(legs).to.have.length(V2_LEG_COUNT);
    expect(new Set(legs.map((l) => l.id)).size).to.equal(V2_LEG_COUNT);
    expect(new Set(legs.map((l) => l.kind)).size).to.equal(V2_LEG_COUNT);
  });

  it("grades pick labels from on-chain legKinds (not today's template)", () => {
    const registered = [...V2_SOCCER_MARKET_LEG_KINDS];
    registered[2] = SC.FH_ANY_GOAL;
    registered[4] = SC.HOME_LEAD_HT;

    const mask = legIdsToBitmask([1, 3, 5, 9, 10]);
    const resolved = (1 << 0) | (1 << 2) | (1 << 4) | (1 << 8);

    const wrong = gradeV2LegMaskPicks(
      "748508",
      "Barcelona",
      "Real Betis",
      "soccer",
      mask,
      resolved,
      true,
    );
    expect(wrong.picks.find((p) => p.legId === 3)?.description).to.equal("Draw");

    const right = gradeV2LegMaskPicks(
      "748508",
      "Barcelona",
      "Real Betis",
      "soccer",
      mask,
      resolved,
      true,
      registered,
    );
    expect(right.picks.find((p) => p.legId === 3)?.description).to.equal(
      "At least one goal in the first half",
    );
    expect(right.picks.find((p) => p.legId === 5)?.description).to.equal(
      "Barcelona leads at half-time",
    );

    const board = v2LegsFromRegisteredKinds("Barcelona", "Real Betis", "soccer", registered);
    expect(board[4]?.kind).to.equal(SC.HOME_LEAD_HT);
  });
});
