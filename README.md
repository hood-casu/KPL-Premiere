# KPL-Premiere

**Kenji Pickleball League** — A 15-week league management app for 8 teams of 2 players each. Features Swiss-system pairing, placement brackets, and cumulative league standings.

## Quick Start

```bash
npm run dev
# Opens http://localhost:3001
```

## How It Works

Each week follows this flow:

1. **Swiss Rounds (4 rounds)** — Teams are paired by win-loss record using a backtracking algorithm that avoids rematches. Round 3 uses Best-of-3 for 2-0 and 0-2 teams. Round 4 is a tiebreaker for 1-1 teams from Round 3.
2. **Placement Bracket (3 rounds)** — All 8 teams seeded by Swiss results play a single-elimination bracket to determine weekly placement (1st–8th).
3. **Points Awarded** — Players earn league points based on their team's bracket finish. Points accumulate across all 15 weeks.

## Architecture

```
KPL-Premiere/
├── index.html          # Single-page app shell
├── styles.css          # All styles (no inline styles in JS)
├── js/
│   ├── app.js          # Entry point — initialization, event wiring
│   ├── config.js       # Constants (weeks, rounds, points, team count)
│   ├── state.js        # Centralized state management + localStorage persistence
│   ├── ui.js           # DOM manipulation, notifications, tables, button states
│   ├── swiss.js        # Swiss pairing algorithm, Buchholz tiebreaker
│   ├── match.js        # Match/Bo3 creation, score validation, admin override
│   ├── bracket.js      # Bracket generation, round progression, week finalization
│   ├── csv.js          # CSV/JSON import and export
│   └── sorting.js      # Shared sorting comparators (DRY)
├── package.json
└── KPL-logo.png
```

### Module Dependency Graph

```
app.js
├── config.js
├── state.js ← config.js
├── ui.js ← state.js, config.js, sorting.js, swiss.js
├── swiss.js ← state.js, config.js, sorting.js, match.js, ui.js
├── bracket.js ← state.js, config.js, swiss.js, match.js, ui.js
├── csv.js ← state.js, config.js, sorting.js, swiss.js, ui.js
├── match.js ← state.js, config.js, ui.js
└── sorting.js (no dependencies — pure functions)
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **ES Modules** (`<script type="module">`) | Native browser support, no bundler needed, proper encapsulation |
| **Centralized state** (`state.js`) | Single source of truth, all mutations go through getters/setters |
| **Event-driven bracket** | Replaced `setInterval` polling with callback-based completion |
| **Shared comparators** (`sorting.js`) | Eliminated 4x duplicated sorting logic |
| **CSS classes over inline styles** | Separation of concerns, easier theming, smaller JS bundles |
| **XSS prevention** (`escapeHtml`) | All user-provided names are sanitized before DOM insertion |
| **Defensive null guards** | All DOM lookups, `find()` calls, and `localStorage` ops are guarded |

### State Shape

```javascript
{
  week: 1,              // Current week (1–15)
  teams: [{             // 8 teams
    name: "Team A",
    players: ["Player1", "Player2"],
    swiss: { w, l, pd, opps: [], h2h: {} },
    bracket: { w, l, pd }
  }],
  players: [{           // 16 players (2 per team)
    name: "Player1",
    team: "Team A",
    league: { pts, w, l, pd }
  }],
  swissRound: 0,        // Current Swiss round (0–4)
  pending: 0,           // Matches awaiting results
  bracketRounds: []     // Bracket pairings per round
}
```

### Scoring

| Bracket Finish | Winner Points | Loser Points |
|---------------|--------------|-------------|
| 1st/2nd place | 15 (10+5 bonus) | 8 |
| 3rd/4th place | 8 | 6 |
| 5th/6th place | 6 | 4 |
| 7th/8th place | 4 | 2 |

### Data Persistence

- **Auto-save**: All state saved to `localStorage` after every match submission
- **Full backup**: JSON export/import with version validation
- **CSV export**: League standings and Swiss standings exportable as CSV

## Development

No build step required. Uses vanilla JavaScript ES modules served directly by the browser.

```bash
npm run dev    # Start live-server with hot reload on port 3001
```

## License

ISC
