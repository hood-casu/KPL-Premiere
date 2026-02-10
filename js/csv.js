/**
 * @module csv
 * @description Data import/export — full JSON backup with version validation,
 * league standings CSV, and Swiss standings CSV. All file I/O uses FileReader
 * for imports and Blob URLs for downloads.
 */
import * as State from './state.js';
import { TOTAL_WEEKS, SWISS_ROUNDS, TEAM_COUNT } from './config.js';
import { comparePlayersByLeague } from './sorting.js';
import { buchholz, sortTeamsBySwiss } from './swiss.js';
import * as UI from './ui.js';

// --- Full Backup (JSON) ---
export function exportFullBackup() {
  if (!State.hasTeams()) { UI.showNotification('No league data to export'); return; }

  const backup = {
    version: '1.1',
    exportDate: new Date().toISOString(),
    week: State.getWeek(),
    swissRound: State.getSwissRound(),
    pending: State.getPending(),
    teams: State.getTeams(),
    players: State.getPlayers(),
    bracketRounds: State.getBracketRounds(),
    constants: { TOTAL_WEEKS, SWISS_ROUNDS },
  };

  const json = JSON.stringify(backup, null, 2);
  const week = State.getWeek();
  const date = new Date().toISOString().split('T')[0];
  UI.downloadCSV(`kpl_league_backup_week${week}_${date}.json`, json);
  UI.showNotification('Complete league backup exported!');
}

export function importFullBackup(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const backup = JSON.parse(e.target.result);

      // Validate backup structure
      if (!backup.version || !backup.teams || !Array.isArray(backup.teams)) {
        return alert('Invalid backup file format');
      }
      if (backup.teams.length !== TEAM_COUNT) {
        return alert(`Backup contains ${backup.teams.length} teams. Expected ${TEAM_COUNT} teams.`);
      }

      // Handle version 1.1
      if (backup.version === '1.1' && backup.players) {
        for (const t of backup.teams) {
          if (!t.name || !t.swiss || !t.bracket || !t.players) {
            return alert('Invalid team data structure in backup');
          }
        }

        if (State.hasTeams()) {
          if (!confirm('This will replace your current league data. Continue?')) {
            event.target.value = '';
            return;
          }
        }

        State.restoreState(backup);
      } else {
        return alert('This backup is from an older version. Please export a new backup with the current version.');
      }

      // Update UI
      UI.clearContent();
      UI.updateLeagueTable();
      UI.updateSwissTable();
      UI.updateButtonStates();
      State.save();
      UI.showNotification(`League restored! Week ${State.getWeek()}, ${State.getPlayers().length} players`);
    } catch (err) {
      alert('Error reading backup file: ' + err.message);
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

// --- League CSV Export/Import ---
export function exportLeagueCSV() {
  if (!State.hasPlayers()) { UI.showNotification('No league data to export'); return; }

  const players = State.getPlayers();
  let csv = 'Rank,Player,Team,Points,Wins,Losses,Point Differential\n';
  const sorted = [...players].sort(comparePlayersByLeague);

  sorted.forEach((p, i) => {
    csv += `${i + 1},"${p.name}","${p.team}",${p.league.pts},${p.league.w},${p.league.l},${p.league.pd}\n`;
  });

  UI.downloadCSV(`league_standings_week${State.getWeek()}.csv`, csv);
  UI.showNotification('League standings exported!');
}

export function importLeagueCSV(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const lines = e.target.result.split('\n').filter(l => l.trim());
      if (lines.length < 2) return alert('CSV file is empty or invalid');

      const header = lines[0].toLowerCase();
      if (!header.includes('player') || !header.includes('points')) {
        return alert('Invalid CSV format. Expected columns: Rank,Player,Team,Points,Wins,Losses,Point Differential');
      }

      const imported = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
        if (!cols || cols.length < 7) continue;
        const playerName = cols[1].replace(/^"|"$/g, '').trim();
        imported.push({
          name: playerName,
          pts: parseInt(cols[3]) || 0,
          w: parseInt(cols[4]) || 0,
          l: parseInt(cols[5]) || 0,
          pd: parseInt(cols[6]) || 0,
        });
      }

      const players = State.getPlayers();
      if (imported.length !== players.length) {
        return alert(`CSV has ${imported.length} players but league has ${players.length} players. Import cancelled.`);
      }

      players.forEach(p => {
        const imp = imported.find(i => i.name === p.name);
        if (imp) {
          p.league.pts = imp.pts;
          p.league.w = imp.w;
          p.league.l = imp.l;
          p.league.pd = imp.pd;
        }
      });

      UI.updateLeagueTable();
      UI.updateStatus();
      State.save();
      UI.showNotification('League standings imported!');
    } catch (err) {
      alert('Error parsing CSV: ' + err.message);
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

// --- Swiss CSV Export/Import ---
export function exportSwissCSV() {
  if (!State.hasTeams()) { UI.showNotification('No Swiss data to export'); return; }

  const sorted = sortTeamsBySwiss(State.getTeams());
  let csv = 'Seed,Team,Wins,Losses,Point Differential,Buchholz\n';
  sorted.forEach((t, i) => {
    csv += `${i + 1},"${t.name}",${t.swiss.w},${t.swiss.l},${t.swiss.pd},${buchholz(t)}\n`;
  });

  UI.downloadCSV(`swiss_standings_week${State.getWeek()}.csv`, csv);
  UI.showNotification('Swiss standings exported!');
}

export function importSwissCSV(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const lines = e.target.result.split('\n').filter(l => l.trim());
      if (lines.length < 2) return alert('CSV file is empty or invalid');

      const header = lines[0].toLowerCase();
      if (!header.includes('team') || !header.includes('wins')) {
        return alert('Invalid CSV format. Expected columns: Seed,Team,Wins,Losses,Point Differential,Buchholz');
      }

      const imported = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
        if (!cols || cols.length < 5) continue;
        const teamName = cols[1].replace(/^"|"$/g, '').trim();
        imported.push({
          name: teamName,
          w: parseInt(cols[2]) || 0,
          l: parseInt(cols[3]) || 0,
          pd: parseInt(cols[4]) || 0,
        });
      }

      const teams = State.getTeams();
      if (imported.length !== teams.length) {
        return alert(`CSV has ${imported.length} teams but league has ${teams.length} teams. Import cancelled.`);
      }

      teams.forEach(t => {
        const imp = imported.find(i => i.name === t.name);
        if (imp) {
          t.swiss.w = imp.w;
          t.swiss.l = imp.l;
          t.swiss.pd = imp.pd;
        }
      });

      UI.updateSwissTable();
      State.save();
      UI.showNotification('Swiss standings imported!');
    } catch (err) {
      alert('Error parsing CSV: ' + err.message);
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}
