/**
 * @module bracket
 * @description Placement bracket — seeds teams by Swiss results, runs 3
 * bracket rounds with event-driven completion, awards league points to
 * players based on final placement, and resets team stats for the next week.
 */
import * as State from './state.js';
import {
  BRACKET_BASE_POINTS, FIRST_PLACE_BONUS, LOSER_POINT_PENALTY,
  BRACKET_ROUND_COUNT
} from './config.js';
import { sortTeamsBySwiss } from './swiss.js';
import { makeMatch, setOnAllMatchesComplete } from './match.js';
import * as UI from './ui.js';

// --- Start Bracket Phase ---
export function startBracket() {
  UI.disableStartBracket();

  const teams = State.getTeams();
  if (!Array.isArray(teams) || teams.length < 8) {
    console.error('Cannot start bracket: need 8 teams');
    return;
  }

  const seed = sortTeamsBySwiss(teams);
  State.setBracketRounds([
    [[seed[0], seed[7]], [seed[3], seed[4]], [seed[1], seed[6]], [seed[2], seed[5]]],
    [],
    []
  ]);
  runBracketRound(1);
}

// --- Run a Bracket Round (event-driven, no polling) ---
function runBracketRound(roundNum) {
  UI.updateStatus();
  const week = State.getWeek();
  const bracketRounds = State.getBracketRounds();

  if (!bracketRounds[roundNum - 1] || bracketRounds[roundNum - 1].length === 0) {
    console.error(`Bracket round ${roundNum} has no matches`);
    return;
  }

  const roundEl = UI.createRoundElement(`Week ${week} – Bracket Round ${roundNum}`);
  State.setPending(0);

  // Register callback BEFORE creating matches so it's ready when last match completes
  setOnAllMatchesComplete(() => {
    if (roundNum < BRACKET_ROUND_COUNT) {
      generateNextBracketRound(roundNum);
    } else {
      finalizeWeek();
    }
  });

  bracketRounds[roundNum - 1].forEach(pair => {
    if (!pair || pair.length < 2) {
      console.error('Invalid bracket pair:', pair);
      return;
    }
    roundEl.appendChild(makeMatch(pair[0], pair[1], false));
    State.incrementPending();
  });

  UI.appendRound(roundEl);
  UI.scrollToElement(roundEl);
}

// --- Generate Next Bracket Round from Results ---
function generateNextBracketRound(roundNum) {
  const bracketRounds = State.getBracketRounds();
  const winners = [];
  const losers = [];

  bracketRounds[roundNum - 1].forEach(([a, b]) => {
    if (a.bracket.w > b.bracket.w) {
      winners.push(a);
      losers.push(b);
    } else {
      winners.push(b);
      losers.push(a);
    }
  });

  if (roundNum === 1) {
    bracketRounds[1] = [
      [winners[0], winners[1]], [winners[2], winners[3]],
      [losers[0], losers[1]], [losers[2], losers[3]]
    ];
  } else {
    bracketRounds[2] = [
      [winners[0], winners[1]], [losers[0], losers[1]],
      [winners[2], winners[3]], [losers[2], losers[3]]
    ];
  }

  runBracketRound(roundNum + 1);
}

// --- Finalize Week: Award Points and Reset ---
function finalizeWeek() {
  const bracketRounds = State.getBracketRounds();

  if (!bracketRounds[2] || bracketRounds[2].length === 0) {
    console.error('Cannot finalize week: bracket round 3 data missing');
    return;
  }

  // Award points to players based on team bracket performance
  bracketRounds[2].forEach(([a, b], i) => {
    const hiTeam = a.bracket.w > b.bracket.w ? a : b;
    const loTeam = hiTeam === a ? b : a;
    const hiPts = BRACKET_BASE_POINTS[i] + (i === 0 ? FIRST_PLACE_BONUS : 0);
    const loPts = BRACKET_BASE_POINTS[i] - LOSER_POINT_PENALTY;

    hiTeam.players.forEach(pName => {
      const player = State.findPlayerByName(pName);
      if (player) {
        player.league.pts += hiPts;
        player.league.w += hiTeam.bracket.w;
        player.league.l += hiTeam.bracket.l;
        player.league.pd += hiTeam.bracket.pd;
      } else {
        console.warn(`Player "${pName}" not found when awarding points`);
      }
    });

    loTeam.players.forEach(pName => {
      const player = State.findPlayerByName(pName);
      if (player) {
        player.league.pts += loPts;
        player.league.w += loTeam.bracket.w;
        player.league.l += loTeam.bracket.l;
        player.league.pd += loTeam.bracket.pd;
      } else {
        console.warn(`Player "${pName}" not found when awarding points`);
      }
    });
  });

  // Reset team swiss and bracket stats for next week
  State.getTeams().forEach(t => {
    t.swiss = { w: 0, l: 0, pd: 0, opps: [], h2h: {} };
    t.bracket = { w: 0, l: 0, pd: 0 };
  });

  UI.updateLeagueTable();
  UI.updateStatus();
  State.save();
  UI.enableNextWeek();
}

// --- Advance to Next Week ---
export function nextWeek() {
  if (State.isLeagueComplete()) {
    UI.showNotification('🏆 League complete! All 15 weeks finished.');
    return;
  }

  State.setWeek(State.getWeek() + 1);
  State.setSwissRound(0);
  UI.updateStatus();
  UI.clearContent();
  UI.setButtonsForNewWeek();
  State.save();
}
