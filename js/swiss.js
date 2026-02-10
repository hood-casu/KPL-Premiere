/**
 * @module swiss
 * @description Swiss-system tournament logic — pairing algorithm with
 * backtracking to avoid rematches, Buchholz tiebreaker calculation,
 * and round generation with special rules for Rounds 3 and 4.
 */
import * as State from './state.js';
import { SWISS_ROUNDS } from './config.js';
import { createTeamSwissComparator } from './sorting.js';
import { makeMatch, makeBo3Match } from './match.js';
import * as UI from './ui.js';

// --- Buchholz Tiebreaker ---
export function buchholz(team) {
  if (!team || !team.swiss || !Array.isArray(team.swiss.opps)) return 0;
  const teams = State.getTeams();
  return team.swiss.opps
    .map(name => teams.find(x => x.name === name))
    .filter(opp => opp != null)
    .reduce((sum, opp) => sum + opp.swiss.w, 0);
}

// --- Sort teams by Swiss standings (single source of truth) ---
export function sortTeamsBySwiss(teams) {
  if (!Array.isArray(teams) || teams.length === 0) return [];
  const comparator = createTeamSwissComparator(buchholz);
  return [...teams].sort(comparator);
}

// --- Swiss Pairing (backtracking to avoid rematches) ---
export function swissPair(pool) {
  if (!Array.isArray(pool) || pool.length < 2) return [];

  const used = new Set();
  const result = [];

  function backtrack() {
    if (used.size === pool.length) return true;
    const a = pool.find(t => !used.has(t));
    if (!a) return false;
    used.add(a);
    for (const b of pool) {
      if (used.has(b) || a.swiss.opps.includes(b.name)) continue;
      used.add(b);
      result.push([a, b]);
      if (backtrack()) return true;
      result.pop();
      used.delete(b);
    }
    used.delete(a);
    return false;
  }

  backtrack();
  return result;
}

// --- Generate Next Swiss Round ---
export function nextSwissRound() {
  if (State.getPending() > 0) return;

  State.incrementSwissRound();
  State.setPending(0);

  const swissRound = State.getSwissRound();
  const teams = State.getTeams();
  const week = State.getWeek();

  if (!Array.isArray(teams) || teams.length === 0) {
    console.warn('No teams available for Swiss round');
    return;
  }

  // Group teams into pools by win-loss record
  const pools = {};
  teams.forEach(t => {
    const key = `${t.swiss.w}-${t.swiss.l}`;
    if (!pools[key]) pools[key] = [];
    pools[key].push(t);
  });

  const roundEl = UI.createRoundElement(`Week ${week} – Swiss Round ${swissRound}`);

  if (swissRound === 3) {
    // Round 3: 2-0 and 0-2 play bo3, 1-1 play single
    if (pools['2-0']) {
      swissPair(pools['2-0']).forEach(([a, b]) => {
        roundEl.appendChild(makeBo3Match(a, b, true));
        State.incrementPending();
      });
    }
    if (pools['1-1']) {
      pools['1-1'].forEach(t => t.swiss.playR4 = true);
      swissPair(pools['1-1']).forEach(([a, b]) => {
        roundEl.appendChild(makeMatch(a, b, true));
        State.incrementPending();
      });
    }
    if (pools['0-2']) {
      swissPair(pools['0-2']).forEach(([a, b]) => {
        roundEl.appendChild(makeBo3Match(a, b, true));
        State.incrementPending();
      });
    }
  } else if (swissRound === 4) {
    // Round 4: only the 4 teams that played single games in Round 3
    const r4teams = teams.filter(t => t.swiss.playR4);
    if (r4teams.length === 4) {
      const winners = r4teams.filter(t => t.swiss.w === 2 && t.swiss.l === 1);
      const losers = r4teams.filter(t => t.swiss.w === 1 && t.swiss.l === 2);

      if (winners.length === 2) {
        swissPair(winners).forEach(([a, b]) => {
          roundEl.appendChild(makeMatch(a, b, true));
          State.incrementPending();
        });
      }
      if (losers.length === 2) {
        swissPair(losers).forEach(([a, b]) => {
          roundEl.appendChild(makeMatch(a, b, true));
          State.incrementPending();
        });
      }
      r4teams.forEach(t => delete t.swiss.playR4);
    } else {
      console.warn(`Round 4 expected 4 teams, found ${r4teams.length}`);
    }
  } else {
    // Rounds 1-2: everyone plays single game
    Object.values(pools).forEach(pool => {
      swissPair(pool).forEach(([a, b]) => {
        roundEl.appendChild(makeMatch(a, b, true));
        State.incrementPending();
      });
    });
  }

  UI.appendRound(roundEl);
  UI.scrollToElement(roundEl);
  UI.updateStatus();
  UI.disableNextSwiss();
}
