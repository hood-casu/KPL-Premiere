/**
 * @module sorting
 * @description Shared sorting comparators used across multiple modules.
 * These are pure functions with no dependencies — the single source of
 * truth for how players and teams are ranked.
 */

/**
 * Compare two players by league standings.
 * Used in: updateLeagueTable, exportLeagueCSV, importLeagueCSV
 */
export function comparePlayersByLeague(a, b) {
  if (b.league.pts !== a.league.pts) return b.league.pts - a.league.pts;
  if (b.league.w !== a.league.w) return b.league.w - a.league.w;
  if (b.league.pd !== a.league.pd) return b.league.pd - a.league.pd;
  return a.name.localeCompare(b.name);
}

/**
 * Create a comparator for teams by Swiss standings.
 * Requires a buchholz function since it depends on opponent data.
 * Used in: updateSwissTable, exportSwissCSV, startBracket
 */
export function createTeamSwissComparator(buchholzFn) {
  return function compareTeamsBySwiss(a, b) {
    if (b.swiss.w !== a.swiss.w) return b.swiss.w - a.swiss.w;
    const bh = buchholzFn(b) - buchholzFn(a);
    if (bh) return bh;
    if (b.swiss.pd !== a.swiss.pd) return b.swiss.pd - a.swiss.pd;
    return a.name.localeCompare(b.name);
  };
}
