# KPL-Premiere Security Vulnerability Report

**Application:** Kenji Pickleball League — 15-Week League Management App  
**Type:** Client-side Single Page Application (HTML/CSS/JS, no backend)  
**Date:** 2026-02-09  
**Assessed by:** SDET Security Review  

---

## Executive Summary

KPL-Premiere is a purely client-side web application with no backend server, authentication, or database. All state is stored in `localStorage`. While the app has some good practices (HTML escaping in table rendering), it has several vulnerabilities ranging from **Critical** to **Low** severity, primarily around data integrity, input validation gaps, and the inherent insecurity of a client-only architecture.

---

## 🔴 CRITICAL Vulnerabilities

### 1. No Authentication or Authorization
- **Location:** Entire application
- **Description:** There is zero authentication. Anyone who can access the URL can manipulate all league data — start/reset leagues, submit scores, use admin overrides, import/export data. The "Admin Override" feature (⚙ gear icon in `match.js`) uses `prompt()` dialogs with no password or credential check whatsoever.
- **Impact:** Any user can tamper with scores, reset the league, or corrupt data. There is no audit trail of who made changes.
- **Recommendation:** If this app is used in any competitive context, add at minimum a simple admin PIN/password for destructive operations (reset league, admin override, imports). Consider moving to a backend with proper auth.

### 2. Client-Side Only Data Storage — Trivially Tamperable
- **Location:** `state.js` — `save()` / `load()` using `localStorage`
- **Description:** All league state (scores, standings, brackets) is stored in `localStorage` under the key `leagueState`. Any user can open browser DevTools and directly modify this data:
  ```js
  // Example attack in browser console:
  let state = JSON.parse(localStorage.getItem('leagueState'));
  state.players[0].league.pts = 9999;
  localStorage.setItem('leagueState', JSON.stringify(state));
  location.reload();
  ```
- **Impact:** Complete data integrity compromise. Any player/spectator can inflate their own scores, change win/loss records, or corrupt the entire league.
- **Recommendation:** Move state to a server-side database. If client-only is required, implement data integrity checksums/signatures that are validated on load.

---

## 🟠 HIGH Vulnerabilities

### 3. Unvalidated JSON Import — Prototype Pollution & State Corruption
- **Location:** `csv.js` — `importFullBackup()`, lines using `JSON.parse()`
- **Description:** The JSON backup import performs only shallow structural validation:
  ```js
  if (!backup.version || !backup.teams || !Array.isArray(backup.teams)) { ... }
  if (backup.teams.length !== TEAM_COUNT) { ... }
  ```
  It does **not** validate:
  - Data types of nested properties (e.g., `swiss.w` could be a string or object instead of a number)
  - Presence of unexpected/malicious properties (prototype pollution via `__proto__`, `constructor`)
  - Reasonable value ranges (negative wins, impossibly high scores)
  - Player name consistency between teams and players arrays
  - That `bracketRounds` contains valid team references
- **Impact:** A crafted JSON file could corrupt application state, cause runtime errors, or potentially exploit prototype pollution if the parsed object contains `__proto__` keys that propagate through `restoreState()`.
- **Recommendation:** 
  - Validate all imported data against a strict schema (types, ranges, required fields)
  - Use `Object.create(null)` or sanitize parsed JSON to prevent prototype pollution
  - Validate referential integrity (player names match team rosters)

### 4. Unvalidated CSV Import — Data Injection & Type Coercion
- **Location:** `csv.js` — `importLeagueCSV()`, `importSwissCSV()`
- **Description:** CSV imports use a regex to parse columns and `parseInt()` for numeric values. Issues:
  - `parseInt()` with no radix specified (defaults to 10 but can be surprising with leading zeros)
  - `parseInt("NaN")` returns `NaN`, but `|| 0` fallback silently converts garbage to 0
  - No upper/lower bound validation on imported values — negative points, impossibly large numbers accepted
  - Player/team name matching is exact (`imported.find(i => i.name === p.name)`) — if names don't match, data is silently skipped with no warning
  - The CSV regex `(".*?"|[^",\s]+)` can fail on edge cases (embedded quotes, commas in names, newlines in quoted fields)
- **Impact:** Malformed CSV files can silently corrupt standings or silently skip players without warning.
- **Recommendation:** Add strict validation with bounds checking, warn on unmatched players, use a proper CSV parser.

### 5. Swiss Opponent Tracking Duplication on Re-submission
- **Location:** `match.js` — `makeMatch()` submit handler
- **Description:** When a match score is re-submitted (the submit button can be clicked multiple times before it's disabled), the opponent tracking pushes duplicate entries:
  ```js
  if (isSwiss) {
    a.swiss.opps.push(b.name);
    b.swiss.opps.push(a.name);
  }
  ```
  This runs on **every** submission, not just the first. While `applyScore()` has undo logic for stats, the `opps` array push has no corresponding undo. This corrupts:
  - **Buchholz tiebreaker calculations** (opponent wins counted multiple times)
  - **Swiss pairing** (the backtracking algorithm checks `a.swiss.opps.includes(b.name)` to avoid rematches, but duplicate entries don't break `includes()` — however the inflated Buchholz scores affect seeding)
- **Impact:** Incorrect tiebreaker rankings and potentially unfair bracket seeding.
- **Recommendation:** Only push to `opps` on the first submission, or deduplicate. Track whether opponents have already been recorded.

---

## 🟡 MEDIUM Vulnerabilities

### 6. Race Condition in Bracket Completion Callback
- **Location:** `match.js` — `notifyCompletion()`, `bracket.js` — `runBracketRound()`
- **Description:** The `onAllMatchesComplete` callback is a module-level singleton. If bracket rounds are generated quickly or if there's any async timing issue, the callback could fire prematurely or be overwritten:
  ```js
  let onAllMatchesComplete = null;
  // Set in runBracketRound BEFORE matches are created
  setOnAllMatchesComplete(() => { ... });
  // Cleared and called in notifyCompletion when pending === 0
  ```
  The callback is set before matches are created, but `State.setPending(0)` is called before `incrementPending()` in the loop. If the loop has zero valid matches (e.g., due to corrupted bracket data), `pending` stays at 0 and the callback never fires, leaving the app in a stuck state.
- **Impact:** App can become stuck with no way to advance if bracket data is corrupted.
- **Recommendation:** Add a guard to handle zero-match rounds. Consider a more robust event system.

### 7. `confirm()` and `alert()` Used in Import Flows — Inconsistent UX & Blockable
- **Location:** `csv.js` — `importFullBackup()` uses `confirm()` and `alert()` throughout
- **Description:** The app has a nice custom `showConfirm()` dialog in `ui.js`, but the import functions use native `confirm()` and `alert()`. Modern browsers can suppress these after the first one, and they block the main thread. This is inconsistent with the rest of the app's UX.
- **Impact:** Users can suppress confirmation dialogs, bypassing the "are you sure?" check on data replacement. Also a poor user experience.
- **Recommendation:** Replace all `alert()` and `confirm()` calls in `csv.js` with `UI.showNotification()` and `UI.showConfirm()`.

### 8. No Input Length Limits on Team/Player Names
- **Location:** `app.js` — `startLeague()`, `index.html` — team input fields
- **Description:** There are no `maxlength` attributes on input fields and no programmatic length validation. Users can enter extremely long names that:
  - Break table layouts
  - Cause excessive localStorage usage (localStorage has a ~5-10MB limit)
  - Create oversized CSV/JSON exports
- **Impact:** UI breakage, potential localStorage quota exceeded errors causing data loss.
- **Recommendation:** Add `maxlength="50"` to input fields and validate programmatically.

### 9. Score Input Accepts Negative Numbers and Extremely Large Values
- **Location:** `match.js` — `makeMatch()`, `makeBo3Match()`
- **Description:** Score inputs have `min="0" max="99"` HTML attributes, but these are only enforced by the browser's native number input UI (spinner). They are **not** enforced programmatically in `isValidScore()`:
  ```js
  export function isValidScore(scoreA, scoreB) {
    const max = Math.max(scoreA, scoreB);
    const min = Math.min(scoreA, scoreB);
    return max >= 11 && (max - min) >= 2;
  }
  ```
  A user can type or paste values like `-5` and `11` (difference is 16, passes validation), or `9999` and `0`. Negative scores would corrupt point differentials.
- **Impact:** Data integrity issues — negative or absurdly large scores corrupt standings.
- **Recommendation:** Add bounds checking: `scoreA >= 0 && scoreB >= 0 && max <= 99` in `isValidScore()`.

### 10. localStorage Data Loss — No Backup Reminder or Auto-Export
- **Location:** `state.js` — localStorage persistence
- **Description:** localStorage can be cleared by:
  - User clearing browser data
  - Browser storage pressure (eviction)
  - Incognito/private browsing mode
  - Different browser or device
  There is no warning about this, no auto-backup, and no prompt to export before clearing.
- **Impact:** Complete loss of an entire season's data with no recovery.
- **Recommendation:** Add periodic auto-export reminders, warn users about localStorage limitations, consider IndexedDB for more robust storage.

---

## 🔵 LOW Vulnerabilities

### 11. XSS Partially Mitigated but Inconsistently Applied
- **Location:** `ui.js` — `escapeHtml()`, `match.js` — innerHTML usage
- **Description:** The app has a good `escapeHtml()` function and uses it in table rendering and match headers. However:
  - `match.js` line in match result display uses `nameA` and `nameB` which ARE escaped ✅
  - `app.js` line 97: `group.innerHTML` uses template literals with `${i}` (integer, safe) ✅
  - CSV export in `csv.js` wraps names in double quotes but does NOT escape double quotes within names: `"${p.name}"` — if a player name contains `"`, the CSV will be malformed
- **Impact:** Low risk for XSS (escaping is generally applied), but CSV injection is possible if names contain formula characters (`=`, `+`, `-`, `@`) which could execute in Excel.
- **Recommendation:** Escape double quotes in CSV output (`name.replace(/"/g, '""')`). Consider prefixing values with `'` to prevent CSV formula injection.

### 12. No Content Security Policy (CSP)
- **Location:** `index.html`
- **Description:** No CSP meta tag or headers are set. The app uses `live-server` for development which doesn't set security headers.
- **Impact:** If the app were served on a real domain, it would be vulnerable to injected scripts from browser extensions or man-in-the-middle attacks.
- **Recommendation:** Add a CSP meta tag: `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'">`

### 13. No HTTPS Enforcement
- **Location:** `package.json` — `live-server` on port 3001
- **Description:** The dev server runs on HTTP. If deployed as-is, all data transfers (including imported league files) would be unencrypted.
- **Impact:** Low for local use, but if deployed publicly, data could be intercepted.
- **Recommendation:** Use HTTPS in any production deployment.

### 14. `URL.createObjectURL` Memory Leak Potential
- **Location:** `ui.js` — `downloadCSV()`
- **Description:** The function does call `URL.revokeObjectURL(url)` ✅, but it does so synchronously after `link.click()`. The download may not have started yet when revocation occurs, potentially causing failed downloads in some browsers.
- **Impact:** Occasional failed exports or minor memory leaks.
- **Recommendation:** Revoke the URL in a `setTimeout()` or after a short delay.

### 15. No Rate Limiting on Match Submissions
- **Location:** `match.js` — submit handlers
- **Description:** There's no debouncing or rate limiting on the submit button click handlers. Rapid clicking could cause multiple state mutations before the UI updates.
- **Impact:** Minor — could cause duplicate opponent entries (see #5) or inconsistent state.
- **Recommendation:** Disable the submit button immediately on click, before processing.

---

## 📋 Additional Observations (Not Vulnerabilities)

### Good Practices Found ✅
1. **HTML escaping** is consistently used in table rendering via `escapeHtml()`
2. **Confirmation dialog** before destructive league reset
3. **File input reset** (`event.target.value = ''`) after import to allow re-importing same file
4. **Blob URL cleanup** in download helper
5. **Module pattern** with clear separation of concerns
6. **No external dependencies** — zero supply chain risk (no node_modules needed at runtime)

### Architecture Concerns
1. **Single point of failure:** All data in one localStorage key. Corruption of this key loses everything.
2. **No undo/redo:** Once a week is finalized, there's no way to go back.
3. **No data versioning:** If the data schema changes between app versions, old saved data may break silently.
4. **Fixed team count:** `TEAM_COUNT = 8` is hardcoded. The app will break with odd numbers of teams (Swiss pairing assumes even count).

---

## Risk Matrix Summary

| # | Vulnerability | Severity | Exploitability | Impact |
|---|---|---|---|---|
| 1 | No Authentication | 🔴 Critical | Trivial | Full data manipulation |
| 2 | Client-side localStorage tampering | 🔴 Critical | Trivial | Complete data integrity loss |
| 3 | Unvalidated JSON import | 🟠 High | Easy | State corruption, prototype pollution |
| 4 | Unvalidated CSV import | 🟠 High | Easy | Silent data corruption |
| 5 | Swiss opponent tracking duplication | 🟠 High | Medium | Incorrect rankings |
| 6 | Bracket completion race condition | 🟡 Medium | Unlikely | App stuck state |
| 7 | Native confirm/alert in imports | 🟡 Medium | Easy | Bypass confirmation |
| 8 | No input length limits | 🟡 Medium | Easy | UI breakage, storage overflow |
| 9 | Score bounds not enforced programmatically | 🟡 Medium | Easy | Data integrity |
| 10 | localStorage data loss risk | 🟡 Medium | Likely | Season data loss |
| 11 | CSV injection / incomplete escaping | 🔵 Low | Medium | Formula injection in Excel |
| 12 | No Content Security Policy | 🔵 Low | Requires deployment | Script injection |
| 13 | No HTTPS | 🔵 Low | Requires deployment | Data interception |
| 14 | URL.createObjectURL timing | 🔵 Low | Rare | Failed exports |
| 15 | No rate limiting on submissions | 🔵 Low | Easy | Minor state issues |

---

## Recommended Priority Actions

1. **Immediate:** Add programmatic score bounds validation in `isValidScore()` (fix #9)
2. **Immediate:** Fix Swiss opponent duplication bug (fix #5)
3. **Short-term:** Add JSON import schema validation (fix #3)
4. **Short-term:** Add input length limits (fix #8)
5. **Short-term:** Replace `alert()`/`confirm()` with custom UI dialogs (fix #7)
6. **Medium-term:** Add admin authentication for destructive operations (fix #1)
7. **Medium-term:** Add data integrity checksums (mitigate #2)
8. **Long-term:** Consider server-side architecture for competitive use (fix #1, #2)
