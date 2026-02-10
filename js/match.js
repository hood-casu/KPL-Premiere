/**
 * @module match
 * @description Match and Best-of-3 match creation, score validation, and score application.
 * Handles both Swiss and Bracket match types with admin override support.
 */
import * as State from './state.js';
import { SWISS_ROUNDS } from './config.js';
import * as UI from './ui.js';

/**
 * Validate a pickleball score pair.
 * Rules: first to 11, win by 2.
 * @param {number} scoreA - Score for team A
 * @param {number} scoreB - Score for team B
 * @returns {boolean} True if the scores represent a valid completed game
 */
export function isValidScore(scoreA, scoreB) {
  if (typeof scoreA !== 'number' || typeof scoreB !== 'number') return false;
  if (isNaN(scoreA) || isNaN(scoreB)) return false;
  if (scoreA < 0 || scoreB < 0 || scoreA > 99 || scoreB > 99) return false;
  const max = Math.max(scoreA, scoreB);
  const min = Math.min(scoreA, scoreB);
  return max >= 11 && (max - min) >= 2;
}

/**
 * Apply score to team stats, with undo support for re-submission.
 * @param {Object} a - Team A object
 * @param {Object} b - Team B object
 * @param {number} scoreA - Team A's score
 * @param {number} scoreB - Team B's score
 * @param {boolean} isSwiss - Whether this is a Swiss match (vs bracket)
 * @param {Object|null} lastResult - Previous result to undo, or null
 * @returns {Object} The new result record {sa, sb}
 */
function applyScore(a, b, scoreA, scoreB, isSwiss, lastResult) {
  const teamA = isSwiss ? a.swiss : a.bracket;
  const teamB = isSwiss ? b.swiss : b.bracket;

  if (!teamA || !teamB) {
    console.error('Cannot apply score: team stats object missing');
    return lastResult;
  }

  if (lastResult) {
    teamA.w -= (lastResult.sa > lastResult.sb) ? 1 : 0;
    teamA.l -= (lastResult.sb > lastResult.sa) ? 1 : 0;
    teamB.w -= (lastResult.sb > lastResult.sa) ? 1 : 0;
    teamB.l -= (lastResult.sa > lastResult.sb) ? 1 : 0;
    teamA.pd -= (lastResult.sa - lastResult.sb);
    teamB.pd -= (lastResult.sb - lastResult.sa);
  }

  teamA.pd += scoreA - scoreB;
  teamB.pd += scoreB - scoreA;
  if (scoreA > scoreB) { teamA.w++; teamB.l++; }
  else { teamB.w++; teamA.l++; }

  return { sa: scoreA, sb: scoreB };
}

/** Check if all pending matches are done and update button states. */
function checkPendingComplete(isSwiss) {
  if (State.getPending() === 0) {
    const swissRound = State.getSwissRound();
    if (isSwiss && swissRound < SWISS_ROUNDS) UI.enableNextSwiss();
    if (isSwiss && swissRound === SWISS_ROUNDS) UI.enableStartBracket();
  }
}

// --- Event-driven bracket completion callback ---
let onAllMatchesComplete = null;

/**
 * Register a callback to fire when all bracket matches in a round complete.
 * Replaces the old setInterval polling approach.
 * @param {Function} callback - Called when pending reaches 0 for bracket matches
 */
export function setOnAllMatchesComplete(callback) {
  onAllMatchesComplete = callback;
}

function notifyCompletion(isSwiss) {
  checkPendingComplete(isSwiss);
  if (!isSwiss && State.getPending() === 0 && typeof onAllMatchesComplete === 'function') {
    const cb = onAllMatchesComplete;
    onAllMatchesComplete = null;
    Promise.resolve().then(cb);
  }
}

/**
 * Create a single-game match DOM element.
 * @param {Object} a - Team A object
 * @param {Object} b - Team B object
 * @param {boolean} isSwiss - Whether this is a Swiss match
 * @returns {HTMLElement} The match element to append to the DOM
 */
export function makeMatch(a, b, isSwiss) {
  const el = document.createElement('div');
  el.className = 'match';
  let done = false;
  let lastResult = null;
  let oppsRecorded = false;

  const nameA = UI.escapeHtml(a.name);
  const nameB = UI.escapeHtml(b.name);

  el.innerHTML = `
    <div class="match-header">
      <strong>${nameA}</strong> <span class="match-vs">vs</span> <strong>${nameB}</strong>
    </div>
    <div class="match-inputs">
      <div class="match-score-box--a">
        <div class="match-score-label--a">${nameA} - Enter Your Score:</div>
        <input type="number" class="scoreA" placeholder="Your points" min="0" max="99">
      </div>
      <div class="match-score-box--b">
        <div class="match-score-label--b">${nameB} - Enter Your Score:</div>
        <input type="number" class="scoreB" placeholder="Your points" min="0" max="99">
      </div>
      <button class="match-submit">Submit Match</button>
      <span class="admin" title="Admin Override">⚙</span>
    </div>
    <div class="match-result"></div>`;

  el.querySelector('.match-submit').onclick = () => {
    const scoreA = parseInt(el.querySelector('.scoreA').value);
    const scoreB = parseInt(el.querySelector('.scoreB').value);
    if (!isValidScore(scoreA, scoreB)) {
      return UI.showMatchError(el, 'Invalid scores — First to 11, win by 2');
    }

    if (!done) { State.decrementPending(); done = true; }
    lastResult = applyScore(a, b, scoreA, scoreB, isSwiss, lastResult);

    if (isSwiss && !oppsRecorded) {
      a.swiss.opps.push(b.name);
      b.swiss.opps.push(a.name);
      oppsRecorded = true;
    }

    const resultDiv = el.querySelector('.match-result');
    resultDiv.style.display = 'block';
    resultDiv.innerHTML = `
      <div class="match-result--success">✓ Match Submitted</div>
      <div class="match-result-scores">${nameA} scored: <strong>${scoreA}</strong> | ${nameB} scored: <strong>${scoreB}</strong></div>
      <div class="match-result-winner">Winner: ${scoreA > scoreB ? nameA : nameB}</div>`;

    el.querySelector('.scoreA').disabled = true;
    el.querySelector('.scoreB').disabled = true;
    el.querySelector('.match-submit').disabled = true;

    UI.updateSwissTable();
    State.save();
    notifyCompletion(isSwiss);
  };

  el.querySelector('.admin').onclick = () => {
    const saStr = prompt(`Admin: Correct score for ${a.name}`);
    if (saStr === null) return;
    const sbStr = prompt(`Admin: Correct score for ${b.name}`);
    if (sbStr === null) return;

    const parsedA = parseInt(saStr);
    const parsedB = parseInt(sbStr);

    if (!isValidScore(parsedA, parsedB)) {
      return UI.showMatchError(el, 'Invalid admin scores — First to 11, win by 2');
    }

    if (!done) { State.decrementPending(); done = true; }
    lastResult = applyScore(a, b, parsedA, parsedB, isSwiss, lastResult);

    const resultDiv = el.querySelector('.match-result');
    resultDiv.style.display = 'block';
    resultDiv.innerHTML = `
      <div class="match-result--admin">⚙ Admin Override</div>
      <div class="match-result-scores">${nameA} scored: <strong>${parsedA}</strong> | ${nameB} scored: <strong>${parsedB}</strong></div>
      <div class="match-result-winner">Winner: ${parsedA > parsedB ? nameA : nameB}</div>`;

    el.querySelector('.scoreA').disabled = true;
    el.querySelector('.scoreB').disabled = true;
    el.querySelector('.match-submit').disabled = true;

    UI.updateSwissTable();
    State.save();
    notifyCompletion(isSwiss);
  };

  return el;
}

/**
 * Create a Best-of-3 match DOM element.
 * @param {Object} a - Team A object
 * @param {Object} b - Team B object
 * @param {boolean} isSwiss - Whether this is a Swiss match
 * @returns {HTMLElement} The Bo3 match element to append to the DOM
 */
export function makeBo3Match(a, b, isSwiss) {
  const el = document.createElement('div');
  el.className = 'match';
  let done = false;
  let oppsRecorded = false;

  const nameA = UI.escapeHtml(a.name);
  const nameB = UI.escapeHtml(b.name);

  el.innerHTML = `
    <div class="match-header">
      <strong>${nameA}</strong> <span class="match-vs">vs</span> <strong>${nameB}</strong>
      <span class="match-bo3-label">(Best of 3)</span>
    </div>
    <div class="match-bo3-inputs">
      <div class="match-score-box--a bo3">
        <div class="match-score-label--a bo3">${nameA} - Enter Your Scores:</div>
        <div class="match-games-list">
          <div class="match-game-row"><span class="match-game-label">Game 1:</span><input type="number" class="g1a match-game-input" placeholder="Points" min="0" max="99"></div>
          <div class="match-game-row"><span class="match-game-label">Game 2:</span><input type="number" class="g2a match-game-input" placeholder="Points" min="0" max="99"></div>
          <div class="match-game-row"><span class="match-game-label">Game 3:</span><input type="number" class="g3a match-game-input" placeholder="If needed" min="0" max="99"></div>
        </div>
      </div>
      <div class="match-score-box--b bo3">
        <div class="match-score-label--b bo3">${nameB} - Enter Your Scores:</div>
        <div class="match-games-list">
          <div class="match-game-row"><span class="match-game-label">Game 1:</span><input type="number" class="g1b match-game-input" placeholder="Points" min="0" max="99"></div>
          <div class="match-game-row"><span class="match-game-label">Game 2:</span><input type="number" class="g2b match-game-input" placeholder="Points" min="0" max="99"></div>
          <div class="match-game-row"><span class="match-game-label">Game 3:</span><input type="number" class="g3b match-game-input" placeholder="If needed" min="0" max="99"></div>
        </div>
      </div>
    </div>
    <div class="match-actions">
      <button>Submit Match</button>
      <span class="status"></span>
    </div>
    <div class="match-result"></div>`;

  el.querySelector('button').onclick = () => {
    const g1a = parseInt(el.querySelector('.g1a').value);
    const g1b = parseInt(el.querySelector('.g1b').value);
    const g2a = parseInt(el.querySelector('.g2a').value);
    const g2b = parseInt(el.querySelector('.g2b').value);
    const g3a = parseInt(el.querySelector('.g3a').value);
    const g3b = parseInt(el.querySelector('.g3b').value);

    if (!isValidScore(g1a, g1b) || !isValidScore(g2a, g2b)) {
      return UI.showMatchError(el, 'Games 1 and 2 required — First to 11, win by 2');
    }

    let aWins = 0, bWins = 0;
    if (g1a > g1b) aWins++; else bWins++;
    if (g2a > g2b) aWins++; else bWins++;

    if (aWins === 1 && bWins === 1) {
      if (!isValidScore(g3a, g3b)) return UI.showMatchError(el, 'Game 3 required — First to 11, win by 2');
      if (g3a > g3b) aWins++; else bWins++;
    }

    if (aWins < 2 && bWins < 2) return UI.showMatchError(el, 'Match not decided — need a 2-game winner');

    if (!done) { State.decrementPending(); done = true; }

    const teamA = isSwiss ? a.swiss : a.bracket;
    const teamB = isSwiss ? b.swiss : b.bracket;

    if (!teamA || !teamB) {
      console.error('Cannot apply Bo3 score: team stats object missing');
      return;
    }

    let pdA = (g1a - g1b) + (g2a - g2b);
    let pdB = (g1b - g1a) + (g2b - g2a);
    if (aWins === 1 && bWins === 1) {
      pdA += (g3a - g3b);
      pdB += (g3b - g3a);
    }

    teamA.pd += pdA;
    teamB.pd += pdB;
    if (aWins > bWins) { teamA.w++; teamB.l++; }
    else { teamB.w++; teamA.l++; }

    if (isSwiss && !oppsRecorded) {
      a.swiss.opps.push(b.name);
      b.swiss.opps.push(a.name);
      oppsRecorded = true;
    }

    const resultDiv = el.querySelector('.match-result');
    resultDiv.style.display = 'block';
    const g3Text = (aWins === 1 && bWins === 1) ? ` | Game 3: ${nameA} ${g3a}-${g3b} ${nameB}` : '';
    resultDiv.innerHTML = `
      <div class="match-result--success">✓ Match Submitted</div>
      <div class="match-result-scores">
        Game 1: ${nameA} ${g1a}-${g1b} ${nameB} | Game 2: ${nameA} ${g2a}-${g2b} ${nameB}${g3Text}
      </div>
      <div class="match-result-winner">Winner: ${aWins > bWins ? nameA : nameB} (${Math.max(aWins, bWins)}-${Math.min(aWins, bWins)})</div>`;

    el.querySelectorAll('input').forEach(inp => inp.disabled = true);
    el.querySelector('button').disabled = true;

    UI.updateSwissTable();
    State.save();
    notifyCompletion(isSwiss);
  };

  return el;
}
