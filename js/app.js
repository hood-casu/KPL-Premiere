/**
 * @module app
 * @description Main entry point — generates team input fields, wires up
 * all button/file event handlers, and loads saved state on startup.
 * This is the only module that touches the DOM directly for initialization.
 */
import { TEAM_COUNT, PLAYERS_PER_TEAM } from './config.js';
import * as State from './state.js';
import * as UI from './ui.js';
import { nextSwissRound } from './swiss.js';
import { startBracket, nextWeek } from './bracket.js';
import {
  exportFullBackup, importFullBackup,
  exportLeagueCSV, importLeagueCSV,
  exportSwissCSV, importSwissCSV,
} from './csv.js';

// --- League Initialization ---
async function startLeague() {
  // If league already exists, confirm before resetting
  if (State.hasTeams()) {
    const confirmed = await UI.showConfirm(
      'Reset League?',
      'This will erase all current league data including standings, scores, and history. This cannot be undone.'
    );
    if (!confirmed) return;
  }

  // Validate all names (teams and players)
  const allNames = new Set();
  let valid = true;

  document.querySelectorAll('.teamInput').forEach(input => {
    const name = input.value.trim();
    if (!name || allNames.has(name.toLowerCase())) {
      valid = false;
      input.classList.add('error');
    } else {
      input.classList.remove('error');
      allNames.add(name.toLowerCase());
    }
  });

  if (!valid) {
    return UI.showNotification('Please enter unique, non-empty names for all teams and players');
  }

  State.clearSaved();
  State.setTeams([]);
  State.setPlayers([]);
  UI.clearContent();

  const teams = [];
  const players = [];

  // Create teams and players
  for (let i = 1; i <= TEAM_COUNT; i++) {
    const teamInput = document.querySelector(`.teamName[data-team="${i}"]`);
    const p1Input = document.querySelector(`.player1[data-team="${i}"]`);
    const p2Input = document.querySelector(`.player2[data-team="${i}"]`);

    const teamName = teamInput.value.trim();
    const p1Name = p1Input.value.trim();
    const p2Name = p2Input.value.trim();

    teams.push({
      name: teamName,
      players: [p1Name, p2Name],
      swiss: { w: 0, l: 0, pd: 0, opps: [], h2h: {} },
      bracket: { w: 0, l: 0, pd: 0 },
    });

    players.push({
      name: p1Name,
      team: teamName,
      league: { pts: 0, w: 0, l: 0, pd: 0 },
    });
    players.push({
      name: p2Name,
      team: teamName,
      league: { pts: 0, w: 0, l: 0, pd: 0 },
    });
  }

  State.setTeams(teams);
  State.setPlayers(players);
  State.setWeek(1);
  State.setSwissRound(0);

  UI.setButtonsForLeagueStart();
  UI.updateLeagueTable();
  UI.updateSwissTable();
  UI.updateStatus();
  State.save();
  UI.showNotification('League started!');

  // Automatically generate Round 1
  nextSwissRound();
}

// --- Load saved state on startup ---
function initializeApp() {
  // Generate team input fields
  const container = document.getElementById('teamInputs');
  for (let i = 1; i <= TEAM_COUNT; i++) {
    const group = document.createElement('div');
    group.className = 'team-group';
    group.innerHTML = `
      <div class="team-group-label">Team ${i}</div>
      <input type="text" placeholder="Team Name" class="teamInput teamName" data-team="${i}">
      <input type="text" placeholder="Player 1 Name" class="teamInput player1" data-team="${i}">
      <input type="text" placeholder="Player 2 Name" class="teamInput player2" data-team="${i}">
    `;
    container.appendChild(group);
  }

  // Wire up button event handlers
  document.getElementById('startLeagueBtn').addEventListener('click', startLeague);
  document.getElementById('nextSwissBtn').addEventListener('click', nextSwissRound);
  document.getElementById('startBracketBtn').addEventListener('click', startBracket);
  document.getElementById('nextWeekBtn').addEventListener('click', nextWeek);

  // Wire up export/import handlers
  document.getElementById('exportFullBackupBtn').addEventListener('click', exportFullBackup);
  document.getElementById('importFullBackupInput').addEventListener('change', importFullBackup);
  document.getElementById('exportLeagueCSVBtn').addEventListener('click', exportLeagueCSV);
  document.getElementById('importLeagueCSVInput').addEventListener('change', importLeagueCSV);
  document.getElementById('exportSwissCSVBtn').addEventListener('click', exportSwissCSV);
  document.getElementById('importSwissCSVInput').addEventListener('change', importSwissCSV);

  // Load saved state
  if (State.load()) {
    UI.updateLeagueTable();
    UI.updateSwissTable();
    UI.updateStatus();
    UI.showNotification(`Week ${State.getWeek()} league data loaded`);
  }
}

// Start the app
initializeApp();
