# ESPN Unofficial API Documentation

> ⚠️ **Unofficial / Undocumented** — These APIs power ESPN's own website and apps. No official support, no SLA, no published rate limits. No auth required for most endpoints. Always cache aggressively and handle errors defensively.

---

## Base URLs

| Domain | Purpose |
|---|---|
| `https://site.api.espn.com` | Primary — scores, teams, news, schedules |
| `https://site.web.api.espn.com` | Web API — richer per-match summaries |
| `https://sports.core.api.espn.com` | Core API — deep stats, athletes, odds, play-by-play |
| `https://lm-api-reads.fantasy.espn.com` | Fantasy API (migrated from fantasy.espn.com in April 2024) |

---

## URL Pattern

```
https://site.api.espn.com/apis/site/v2/sports/{sport}/{league}/{resource}
```

---

## Sport & League Slugs

### Soccer

| League | Slug |
|---|---|
| Premier League | `soccer/eng.1` |
| La Liga | `soccer/esp.1` |
| Bundesliga | `soccer/ger.1` |
| Serie A | `soccer/ita.1` |
| Ligue 1 | `soccer/fra.1` |
| MLS | `soccer/usa.1` |
| UEFA Champions League | `soccer/uefa.champions` |
| UEFA Europa League | `soccer/uefa.europa` |

> ⚠️ Soccer **requires** a league slug. Passing just `soccer` returns a 400. Always include the league code.

### American Sports

| Sport | Slug |
|---|---|
| NFL | `football/nfl` |
| College Football | `football/college-football` |
| NBA | `basketball/nba` |
| WNBA | `basketball/wnba` |
| College Basketball (Men) | `basketball/mens-college-basketball` |
| College Basketball (Women) | `basketball/womens-college-basketball` |
| MLB | `baseball/mlb` |
| College Baseball | `baseball/college-baseball` |
| Softball | `baseball/college-softball` |
| NHL | `hockey/nhl` |

### Other

| Sport | Slug |
|---|---|
| Golf (PGA) | `golf/pga` |
| Tennis | `tennis/atp` |
| MMA/UFC | `mma/ufc` |
| NASCAR | `racing/nascar` |

---

## Period / Half / Quarter Breakdown by Sport

This is how `linescores` maps per sport — verified live:

| Sport | Period Structure | Where Available |
|---|---|---|
| ⚽ Soccer | 2 periods (halves) — `[0]` = goals in 1st half, `[1]` = 2nd half (not cumulative to each other; sum = final goals) | **Summary → `header.competitions[0].competitors` → each team’s `linescores`** (`displayValue` strings). **Not** in scoreboard; **`boxscore.teams[].linescores` often empty** (spot-checked: EPL, La Liga, Serie A, Bundesliga, UCL). |
| 🏀 NBA | 4 quarters — `[0]`=Q1, `[1]`=Q2, `[2]`=Q3, `[3]`=Q4, `[4]`=OT if needed | **Scoreboard** (inline, no extra call needed) |
| 🏈 NFL | 4 quarters — same index pattern | **Scoreboard** (inline) |
| ⚾ MLB | 9 innings — index 0–8, extras appended | **Scoreboard** (and/or summary `boxscore`) |
| 🏒 NHL | 3 periods + OT | **Scoreboard** |

> Values are **per-period scores, not cumulative across periods** (sum them for the team’s final). For **soccer**, read each half from `header` competitors’ `linescores` — do **not** assume `boxscore.teams` has half rows until you verify; extend `soccer_cross_league_half_probe` in `espn-api-offchain-verify.mjs` for each new league slug.

---

## Player-Level Stats by Sport

| Sport | In Scoreboard? | In Summary? | What's Available |
|---|---|---|---|
| ⚽ Soccer | ✅ Leaders only (top scorer per team — season goals) | ✅ Full player stats, lineup, ratings | Goals, assists, shots, fouls per player in summary |
| 🏀 NBA | ✅ Leaders (pts/reb/ast top performer) + team stats | ✅ Full box score per player | PTS, REB, AST, STL, BLK, TO, FG, 3PT, FT, MIN per player |
| 🏈 NFL | ❌ Empty `statistics: []` | ✅ Full box score per player | Passing (C/ATT, YDS, TD, INT, QBR), Rushing (CAR, YDS, AVG, TD), Receiving (REC, YDS, AVG, TD, TGTS) |
| ⚾ MLB | Varies | ✅ Full box score | Batting, pitching, fielding stats per player |
| 🏒 NHL | Varies | ✅ Full box score | Goals, assists, shots, +/-, PIM, TOI per player |

---

## Cards, Penalties, Goals — What Returns Them?

**Soccer scoreboard `details` array** is the key — it contains every on-field event for a completed or live match, directly in the scoreboard response. No separate call needed.

### Event types in `details`:

| Type ID | Text | Fields set |
|---|---|---|
| `70` | Goal | `scoringPlay: true`, `scoreValue: 1` |
| `137` | Goal - Header | `scoringPlay: true`, `scoreValue: 1` |
| `98` | Penalty - Scored | `penaltyKick: true`, `scoringPlay: true` |
| `99` | Penalty - Missed | `penaltyKick: true`, `scoringPlay: false` |
| `94` | Yellow Card | `yellowCard: true` |
| `93` | Red Card | `redCard: true` |
| `114` | Own Goal | `ownGoal: true`, `scoringPlay: true` |

Each detail entry has:
```json
{
  "type": { "id": "70", "text": "Goal" },
  "clock": { "value": 310.0, "displayValue": "6'" },
  "team": { "id": "83" },
  "scoreValue": 1,
  "scoringPlay": true,
  "redCard": false,
  "yellowCard": false,
  "penaltyKick": false,
  "ownGoal": false,
  "shootout": false,
  "athletesInvolved": [
    {
      "id": "231050",
      "displayName": "Raphinha",
      "shortName": "Raphinha",
      "fullName": "Raphinha",
      "jersey": "11",
      "position": "AM-L",
      "team": { "id": "83" },
      "links": [{ "href": "https://www.espn.com/soccer/player/_/id/231050/raphinha" }]
    }
  ]
}
```

For **yellow/red team totals**, you can also read **Summary** (`…/summary?event=`) → **`boxscore.teams[]`** → **`statistics`** → rows named **`yellowCards`** / **`redCards`** (`displayValue` string counts). Prefer mapping by `homeAway` + `team.displayName`, not a fixed statistic index — rows move between responses. The verifier emits both **scoreboard `details` flag counts** and **summary per-team totals** (`discipline_scoreboard_details`, `discipline_summary_team_statistics`).

> ⚠️ `details` is **soccer-only**. NFL/NBA/MLB do not have this. For NFL play-by-play you use the core API plays endpoint. For NBA events you use `plays` in the summary.

---

## Endpoints Reference

---

### 1. Scoreboard — Fixtures (Past, Live, and Future)

**Returns past results, live scores, and upcoming scheduled matches all from the same endpoint.**

```
GET https://site.api.espn.com/apis/site/v2/sports/{sport}/{league}/scoreboard
```

**Query Parameters:**

| Param | Type | Description |
|---|---|---|
| `dates` | string | YYYYMMDD for a specific date, or YYYYMMDD-YYYYMMDD for a range |
| `limit` | int | Max events returned |
| `seasontype` | int | 1=preseason, 2=regular, 3=postseason |
| `week` | int | Week number (NFL only) |

**Examples:**
```bash
# Today's EPL fixtures (past results + upcoming)
GET https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard

# Future EPL match on a specific future date
GET https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard?dates=20260524

# NBA specific date
GET https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=20260120

# NFL with week filter
GET https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&week=5

# MLB (requires dates param)
GET https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates=20250515
```

**How to get ALL fixtures for a team across all competitions (soccer):**
```bash
# All upcoming fixtures for a team (replace {team_id})
GET https://site.api.espn.com/apis/site/v2/sports/soccer/all/teams/{team_id}/schedule?fixture=true

# All past results for a team
GET https://site.api.espn.com/apis/site/v2/sports/soccer/all/teams/{team_id}/schedule
```

**Status types in scoreboard events:**

| `status.type.name` | `state` | Meaning |
|---|---|---|
| `STATUS_SCHEDULED` | `pre` | Future match, not started |
| `STATUS_IN_PROGRESS` | `in` | Live right now |
| `STATUS_HALFTIME` | `in` | Half-time break |
| `STATUS_FULL_TIME` | `post` | Finished |
| `STATUS_FINAL` | `post` | Finished (American sports) |

**Future match — what you get vs what you don't:**

For a scheduled/future match the scoreboard returns:
- ✅ Match date and kick-off time
- ✅ Team names, logos, IDs, colors
- ✅ Venue
- ✅ Broadcast info (TV network)
- ✅ Ticket links (where available)
- ✅ Team records / form (`"form": "WDWWW"`)
- ✅ Season goals leaders per team (soccer — e.g. Haaland 26 goals)
- ❌ No score (both show `"score": "0"`)
- ❌ No `details` (goals/cards — nothing happened yet)
- ❌ No `linescores`
- ❌ No `statistics`

---

### Per Sport — What Scoreboard Returns for a Finished Match

---

#### ⚽ Soccer

**Per competitor — team-level stats:**
```json
"statistics": [
  { "name": "foulsCommitted",  "abbreviation": "FC",    "displayValue": "9" },
  { "name": "wonCorners",      "abbreviation": "CW",    "displayValue": "6" },
  { "name": "goalAssists",     "abbreviation": "A",     "displayValue": "5" },
  { "name": "possessionPct",   "abbreviation": "PP",    "displayValue": "62.8" },
  { "name": "shotsOnTarget",   "abbreviation": "ST",    "displayValue": "13" },
  { "name": "totalGoals",      "abbreviation": "G",     "displayValue": "7" },
  { "name": "totalShots",      "abbreviation": "SH",    "displayValue": "18" },
  { "name": "shotAssists",     "abbreviation": "SHAST", "displayValue": "15" }
]
```

**Player leaders (season stats, not match stats):**
```json
"leaders": [
  {
    "name": "goals",
    "displayName": "Goals",
    "leaders": [{
      "displayValue": "26",
      "athlete": {
        "id": "253989",
        "displayName": "Erling Haaland",
        "jersey": "9",
        "position": { "abbreviation": "F" }
      }
    }]
  }
]
```

**`details` array — every goal, card, penalty in the match** (see Cards/Penalties section above).

**Knockout competition extras:**
```json
"series": {
  "completed": true,
  "title": "Round of 16",
  "competitors": [
    { "id": "83",  "winner": true,  "aggregateScore": 8.0 },
    { "id": "361", "winner": false, "aggregateScore": 3.0 }
  ]
},
"leg": { "value": 2, "displayValue": "2nd Leg" }
```

**Form string per competitor:**
```json
"form": "WWDWW"
```

> ⚠️ No `linescores` on **soccer scoreboard**. For **completed EPL** fixtures, half-by-half **goal splits** reliably live under **Summary → `header.competitions[0].competitors`** (each competitor has `linescores[].displayValue` per half — see below). `summary.boxscore.teams[].linescores` is often missing; don’t rely on it for halves.

---

#### 🏀 NBA

Per-quarter linescores + team stats + player leaders **all inline in scoreboard**:

**Linescores:**
```json
"linescores": [
  { "value": 30.0, "displayValue": "30", "period": 1 },
  { "value": 23.0, "displayValue": "23", "period": 2 },
  { "value": 31.0, "displayValue": "31", "period": 3 },
  { "value": 26.0, "displayValue": "26", "period": 4 }
]
```

**Team stats:**
```json
"statistics": [
  { "name": "rebounds",                      "abbreviation": "REB", "displayValue": "49" },
  { "name": "assists",                        "abbreviation": "AST", "displayValue": "20" },
  { "name": "fieldGoalsAttempted",            "abbreviation": "FGA", "displayValue": "93" },
  { "name": "fieldGoalsMade",                "abbreviation": "FGM", "displayValue": "39" },
  { "name": "fieldGoalPct",                  "abbreviation": "FG%", "displayValue": "41.9" },
  { "name": "freeThrowPct",                  "abbreviation": "FT%", "displayValue": "77.8" },
  { "name": "freeThrowsAttempted",           "abbreviation": "FTA", "displayValue": "27" },
  { "name": "freeThrowsMade",               "abbreviation": "FTM", "displayValue": "21" },
  { "name": "points",                        "abbreviation": "PTS", "displayValue": "110" },
  { "name": "threePointFieldGoalsAttempted", "abbreviation": "3PA", "displayValue": "34" },
  { "name": "threePointFieldGoalsMade",      "abbreviation": "3PM", "displayValue": "11" },
  { "name": "threePointFieldGoalPct",        "abbreviation": "3P%", "displayValue": "32.4" }
]
```

**Player leaders (top performer per category):**
```json
"leaders": [
  {
    "name": "points", "abbreviation": "Pts",
    "leaders": [{
      "displayValue": "25", "value": 25.0,
      "athlete": {
        "id": "5124612", "fullName": "VJ Edgecombe",
        "jersey": "77", "position": { "abbreviation": "G" },
        "headshot": "https://a.espncdn.com/i/headshots/nba/players/full/5124612.png"
      }
    }]
  },
  { "name": "rebounds", ... },
  { "name": "assists", ... }
]
```

---

#### 🏈 NFL

**Linescores (per quarter) — in scoreboard:**
```json
"linescores": [
  { "value": 0.0,  "displayValue": "0",  "period": 1 },
  { "value": 0.0,  "displayValue": "0",  "period": 2 },
  { "value": 0.0,  "displayValue": "0",  "period": 3 },
  { "value": 13.0, "displayValue": "13", "period": 4 }
]
```

**`statistics: []` — empty in NFL scoreboard.** Full team/player stats only in Summary.

**Records per competitor:**
```json
"records": [
  { "name": "overall", "summary": "14-3" },
  { "name": "Home",    "summary": "6-3" },
  { "name": "Road",    "summary": "8-0" }
]
```

---

### 2. Match Summary — Per-Match Deep Data

Use this for **soccer half splits** (`header` competitors), full player box scores, play-by-play, lineups, odds.

```
GET https://site.api.espn.com/apis/site/v2/sports/{sport}/{league}/summary?event={event_id}
```

Also works via `site.web.api.espn.com` domain.

**Examples:**
```bash
GET https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/summary?event=401862582
GET https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=400878160
GET https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=401671764
```

**Top-level keys:**

| Key | Description |
|---|---|
| `boxscore.teams` | Team-level stats (`statistics`, cards, shots, …). **`linescores` per half may appear for some comps/sports**, but **EPL summaries often omit `boxscore.teams[].linescores`** — use `header` competitors for soccer halves instead. |
| `boxscore.players` | **Full per-player stats for every player who appeared** |
| `plays` | Full play-by-play log (every event, timed, with scores) |
| `leaders` | Statistical leaders for this specific match |
| `standings` | League table at time of match |
| `odds` | Betting lines (spread, moneyline, over/under) |
| `videos` | Highlight clip URLs |
| `header` | Match metadata — teams, status, date, scores; **soccer competitors also carry `linescores` for half-by-half goals**. |
| `news` | Related articles |
| `pickcenter` | Win probability / predictions |
| `injuries` | Player injury report |
| `roster` | Starting lineups / squads (soccer) |

---

#### `header.competitions[0].competitors[].linescores` — Soccer half-by-half goals (preferred)

For **completed** soccer matches on the **site API** (`soccer/{league}/summary`), each competitor in the summary `header` often includes two `linescores` entries — **goals in 1st half** and **goals in 2nd half**. Use **`displayValue`** (string) or numeric `value` when present.

**Leagues spot-checked** (same pattern: header halves present, `boxscore.teams[].linescores` empty): **EPL** (`eng.1`), **La Liga** (`esp.1`), **Serie A** (`ita.1`), **Bundesliga** (`ger.1`), **UEFA Champions League** (`uefa.champions`) — see `soccer_cross_league_half_probe` in `lib/espn-mock-hardcoded.generated.json` after running the verifier. Other slugs may differ; re-run the script if you add a league.

```json
// Summary response — excerpt from header.competitions[0].competitors[]
"competitors": [
  {
    "homeAway": "home",
    "team": { "displayName": "Manchester City FC" },
    "score": "3",
    "linescores": [
      { "displayValue": "2" },
      { "displayValue": "1" }
    ]
  },
  {
    "homeAway": "away",
    "team": { "displayName": "Crystal Palace" },
    "score": "0",
    "linescores": [
      { "displayValue": "0" },
      { "displayValue": "0" }
    ]
  }
]
```

**Selectors (map by `homeAway`, not blindly `[0]`/`[1]`):** once you know indices for home vs away,

- First-half home goals: `header.competitions[0].competitors[<homeIx>].linescores[0].displayValue`
- Second-half home goals: `header.competitions[0].competitors[<homeIx>].linescores[1].displayValue`

> Offchain check: run `scripts/espn-api-offchain-verify.mjs` — output includes EPL deep probes plus **`soccer_cross_league_half_probe`** (one sample fixture per league) in `lib/espn-mock-hardcoded.generated.json`. Extend `soccer_cross_league_half_probe` in the script when you need another slug.

---

#### `boxscore.teams[n].linescores` — Period / inning breakdown (non-soccer‑primary)

Historically documented with a soccer example; **live summaries for EPL / La Liga / Serie A / Bundesliga / UCL sampled in our verifier frequently return empty `linescores` under `boxscore.teams`** — **prefer the `header` block above for soccer halves**.

For **NBA / NFL / MLB** (and other sports where ESPN fills team `linescores`), the same-shaped array can appear under **`boxscore.teams`**:

```json
// Illustrative — may apply to basketball/football/baseball summaries; not reliable for EPL soccer halves
"teams": [
  {
    "homeAway": "home",
    "team": { "displayName": "Example FC" },
    "linescores": [
      { "value": 1, "displayValue": "1" },
      { "value": 2, "displayValue": "2" }
    ]
  }
]
```

When populated, entries are **per-period scores, not running totals** (semantics depend on sport). Always confirm with a live response for the league you ship.

---

#### `boxscore.players` — Full Player Stats

Structure is consistent across sports but stat columns differ. Each entry is one stat category (passing/rushing/receiving for NFL, one table for NBA, etc.):

```json
"players": [
  {
    "team": { "displayName": "Detroit Lions", "abbreviation": "DET" },
    "statistics": [
      {
        "name": "passing",
        "keys":   ["completions/passingAttempts", "passingYards", "yardsPerPassAttempt", "passingTouchdowns", "interceptions", "sacks-sackYardsLost", "adjQBR", "QBRating"],
        "labels": ["C/ATT", "YDS", "AVG", "TD", "INT", "SACKS", "QBR", "RTG"],
        "athletes": [
          {
            "athlete": {
              "id": "3046779",
              "displayName": "Jared Goff",
              "firstName": "Jared", "lastName": "Goff",
              "jersey": "16",
              "headshot": { "href": "https://a.espncdn.com/i/headshots/nfl/players/full/3046779.png" }
            },
            "stats": ["18/25", "315", "12.6", "3", "0", "2-17", "66.9", "153.8"]
          }
        ],
        "totals": ["19/27", "308", "12.4", "3", "0", "3-26", "--", "149.3"]
      },
      {
        "name": "rushing",
        "keys":   ["rushingAttempts", "rushingYards", "yardsPerRushAttempt", "rushingTouchdowns", "longRushing"],
        "labels": ["CAR", "YDS", "AVG", "TD", "LONG"],
        "athletes": [
          {
            "athlete": { "displayName": "David Montgomery", "jersey": "5" },
            "stats": ["12", "80", "6.7", "2", "19"]
          },
          {
            "athlete": { "displayName": "Jahmyr Gibbs", "jersey": "26" },
            "stats": ["12", "63", "5.3", "0", "15"]
          }
        ]
      },
      {
        "name": "receiving",
        "keys":   ["receptions", "receivingYards", "yardsPerReception", "receivingTouchdowns", "longReception", "receivingTargets"],
        "labels": ["REC", "YDS", "AVG", "TD", "LONG", "TGTS"],
        "athletes": [ ... ]
      }
    ]
  }
]
```

**Selector pattern to read player stats:**
```javascript
// Get all passing stats for team 0
const passingStats = data.boxscore.players[0].statistics.find(s => s.name === "passing");
const labels = passingStats.labels;          // ["C/ATT", "YDS", "AVG", "TD", ...]
const players = passingStats.athletes;       // array of athletes
const playerName = players[0].athlete.displayName;
const playerStatValues = players[0].stats;   // ["18/25", "315", "12.6", ...]

// Map label → value for a player
const statMap = Object.fromEntries(labels.map((l, i) => [l, playerStatValues[i]]));
// { "C/ATT": "18/25", "YDS": "315", "TD": "3", ... }
```

**NBA player stats in summary:**
```json
{
  "name": "passing",   // NBA uses different keys
  "names":  ["PTS", "REB", "AST", "STL", "BLK", "TO", "FG",   "3PT",  "FT",   "MIN"],
  "athletes": [{
    "athlete": { "displayName": "Tyrese Maxey", "jersey": "0" },
    "stats":   ["28",  "4",   "7",   "1",   "0",   "2",  "9-21", "3-8",  "7-8",  "36"]
  }]
}
```

---

#### `boxscore.teams[n].statistics` — Team-Level Stats in Summary

**NFL team stats in summary (verified live — Detroit Lions vs Cowboys):**
```json
[
  { "name": "firstDowns",            "displayValue": "27",    "label": "1st Downs" },
  { "name": "thirdDownEff",          "displayValue": "4-10",  "label": "3rd down efficiency" },
  { "name": "fourthDownEff",         "displayValue": "1-2",   "label": "4th down efficiency" },
  { "name": "totalYards",            "displayValue": "492",   "label": "Total Yards" },
  { "name": "yardsPerPlay",          "displayValue": "7.5",   "label": "Yards per Play" },
  { "name": "netPassingYards",       "displayValue": "308",   "label": "Passing" },
  { "name": "completionAttempts",    "displayValue": "19/27", "label": "Comp/Att" },
  { "name": "rushingYards",          "displayValue": "184",   "label": "Rushing" },
  { "name": "rushingAttempts",       "displayValue": "36",    "label": "Rushing Attempts" },
  { "name": "redZoneAttempts",       "displayValue": "3-5",   "label": "Red Zone (Made-Att)" },
  { "name": "totalPenaltiesYards",   "displayValue": "8-63",  "label": "Penalties" },
  { "name": "turnovers",             "displayValue": "0",     "label": "Turnovers" },
  { "name": "fumblesLost",           "displayValue": "0",     "label": "Fumbles lost" },
  { "name": "interceptions",         "displayValue": "0",     "label": "Interceptions thrown" },
  { "name": "possessionTime",        "displayValue": "34:43", "label": "Possession" }
]
```

---

### 3. Teams

```
GET https://site.api.espn.com/apis/site/v2/sports/{sport}/{league}/teams
GET https://site.api.espn.com/apis/site/v2/sports/{sport}/{league}/teams/{team_id}
GET https://site.api.espn.com/apis/site/v2/sports/{sport}/{league}/teams/{team_id}/roster
```

**Response per team:**
```json
{
  "id": "83",
  "slug": "barcelona",
  "displayName": "Barcelona",
  "abbreviation": "BAR",
  "location": "Barcelona",
  "color": "990000",
  "alternateColor": "FCE38A",
  "isActive": true,
  "logos": [
    { "href": "https://a.espncdn.com/i/teamlogos/soccer/500/83.png", "width": 500, "height": 500, "rel": ["full","default"] },
    { "href": "https://a.espncdn.com/i/teamlogos/soccer/500-dark/83.png", "rel": ["full","dark"] }
  ],
  "links": [
    { "rel": ["clubhouse"], "href": "..." },
    { "rel": ["stats"],     "href": "..." },
    { "rel": ["schedule"],  "href": "..." },
    { "rel": ["squad"],     "href": "..." }
  ],
  "record": { "items": [{ "summary": "20-8-10" }] },
  "venue": { "id": "1625" }
}
```

---

### 4. Team Schedule

```
GET https://site.api.espn.com/apis/site/v2/sports/{sport}/{league}/teams/{team_id}/schedule
```

Full season schedule — past and future, with scores where played.

**Soccer — all competitions across all leagues:**
```bash
# Future fixtures across all comps
GET https://site.api.espn.com/apis/site/v2/sports/soccer/all/teams/{team_id}/schedule?fixture=true

# All results across all comps
GET https://site.api.espn.com/apis/site/v2/sports/soccer/all/teams/{team_id}/schedule
```

---

### 5. Standings

```
GET https://site.api.espn.com/apis/site/v2/sports/{sport}/{league}/standings
```

---

### 6. News

```
GET https://site.api.espn.com/apis/site/v2/sports/{sport}/{league}/news?limit=25
```

---

### 7. Players / Athletes

```bash
# All players (site API, light data)
GET https://site.api.espn.com/apis/site/v2/sports/{sport}/{league}/players

# Full roster via core API (paginated, richer)
GET https://sports.core.api.espn.com/v2/sports/{sport}/leagues/{league}/athletes?limit=1000

# Individual player detail
GET https://site.web.api.espn.com/apis/common/v3/sports/{sport}/{league}/athletes/{athlete_id}

# Team injuries
GET https://sports.core.api.espn.com/v2/sports/{sport}/leagues/{league}/teams/{team_id}/injuries
```

Player detail returns: career stats, bio, current team, injury status, headshot URL, position, jersey number, active status.

---

### 8. Core API — Full Season Event List

```bash
# All events in a season
GET https://sports.core.api.espn.com/v2/sports/{sport}/leagues/{league}/events?dates=2025&limit=1000

# NFL regular season (type=2)
GET https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2025/types/2/events?limit=1000

# Soccer team events (all comps)
GET https://sports.core.api.espn.com/v2/sports/soccer/teams/{team_id}/events
```

---

### 9. Core API — Match Odds

```
GET https://sports.core.api.espn.com/v2/sports/{sport}/leagues/{league}/events/{event_id}/competitions/{event_id}/odds
```

---

### 10. Core API — Play-by-Play

```
GET https://sports.core.api.espn.com/v2/sports/{sport}/leagues/{league}/events/{event_id}/competitions/{event_id}/plays?limit=500
```

---

## Playscript v2 (this repo)

| Piece | ESPN usage |
|---|---|
| **Fixtures table** (`/api/fixtures`) | Scoreboard `?dates=YYYYMMDD-YYYYMMDD` — **14-day** forward window (UTC), per league slug in `lib/fixtures-shared.ts` |
| **Match identity** (`registerMatch` / resolve) | Soccer: **summary** URL `…/summary?event={id}`; NBA/NFL/MLB: **scoreboard** `…/scoreboard/{id}` |
| **Settlement fetches** | `fetchUint` via Somnia JSON agent — soccer **8** calls (final on scoreboard; HT + Y/R on summary); NBA/NFL **6** (final + Q1/Q2 per team); MLB **2** |
| **Leg markets** | ~20–30 leg **kinds** per sport in `lib/playscript-v2-leg-kinds.ts`; UI picks **12 unique** per fixture (`selectV2MarketLegs`); on-chain stores `legKinds[12]` + grades with `PlayscriptV2Grading` |

**Selectors (verified EPL 740902):**

| Field | URL | JSON path |
|---|---|---|
| Final home/away | Scoreboard | `competitions[0].competitors[0\|1].score` |
| 1st-half goals | Summary | `header.competitions[0].competitors[0\|1].linescores[0].displayValue` |
| Yellow / red cards | Summary | `boxscore.teams[i].statistics[1\|2].displayValue` (index varies by match — preflight before register) |
| NBA/NFL Q1–Q2 | Scoreboard | `competitions[0].competitors[n].linescores[0\|1].displayValue` |

Offchain verify: `npm run verify:espn-api` → `lib/espn-mock-hardcoded.generated.json`. On-chain probes: `contracts/demos/EspnJsonApiFetchMocks.sol`.

**Register preflight** (`GET /api/playscript/espn-preflight`): before kickoff, only scoreboard team/score paths (often `"0"`) + soccer summary **structure** (`header` competitors, `boxscore.teams`). Does **not** require HT goals, cards, or quarter lines — those are filled after the match at settlement.

---

## Recommended Workflow

```
FIXTURES / UPCOMING:
  Scoreboard ?dates=YYYYMMDD-YYYYMMDD  →  get scheduled events (Playscript: 14-day range)

RESULTS + TEAM STATS:
  Scoreboard (completed)      →  final scores, basic team stats, goals/cards (soccer)

DEEP MATCH DATA:
  Summary ?event={id}         →  soccer halves: header competitors linescores;
                                 NBA/NFL quarters: scoreboard; full player boxscores,
                                 play-by-play, lineups, odds, highlights

SEASON FIXTURES:
  Core API events             →  complete fixture list without date filtering

PLAYER DATA:
  Core API athletes           →  full roster + career stats
  Summary boxscore.players    →  match-specific per-player stats
```

---

## Gotchas

| Issue | Notes |
|---|---|
| Soccer needs league slug | `soccer` alone → 400. Must pass e.g. `eng.1`, `uefa.champions` |
| Half-time / half-by-half soccer goals missing on scoreboard | Use **Summary** → **`header.competitions[0].competitors`** — match **`homeAway`** (`home` / `away`) and read **`linescores[n].displayValue`** (two entries = two halves). **`boxscore.teams[].linescores` is often empty for EPL.** |
| NBA is the exception | NBA scoreboard includes quarter scores + team stats + player leaders inline |
| NFL `statistics: []` in scoreboard | Always empty. Use Summary for all NFL stats |
| `details` is soccer-only | Goals/cards/penalties in scoreboard only exist for soccer |
| Future matches have no stats | `score: "0"`, `statistics: []`, no `linescores`, no `details` — just metadata |
| Scores are strings | `"score": "7"` — always string, parse to int before math |
| `linescores` absent pre-match | Only populated once game is in progress or complete |
| Fantasy API domain changed | Moved to `lm-api-reads.fantasy.espn.com` in April 2024 — old domain breaks |
| Rate limiting | Not published. Safe ceiling: don't poll faster than ~30–60s for live scores |
| Response structure varies by sport | Parse defensively — a field in NBA response may not exist in soccer |

---

## Further Reference

| Resource | URL |
|---|---|
| Community endpoint list | https://github.com/pseudo-r/Public-ESPN-API |
| DeepWiki sport-by-sport | https://deepwiki.com/pseudo-r/Public-ESPN-API |
| NFL endpoint gist | https://gist.github.com/nntrn/ee26cb2a0716de0947a0a4e9a157bc1c |
| ESPN hidden API thread | https://gist.github.com/akeaswaran/b48b02f1c94f873c6655e7129910fc3b |
| OpenAPI typed spec | https://github.com/aaronweldy/espn-openapi |
