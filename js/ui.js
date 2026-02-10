/**
 * @module ui
 * @description All DOM manipulation — notifications, status indicator,
 * table rendering, button state management, and content area helpers.
 * No business logic lives here; this module only reads state and updates the DOM.
 */
import * as State from './state.js';
import { SWISS_ROUNDS } from './config.js';
import { comparePlayersByLeague } from './sorting.js';
import { buchholz, sortTeamsBySwiss } from './swiss.js';

// --- Safe DOM element getter ---
function getEl(id) {
  const el = document.getElementById(id);
  if (!el) console.warn(`DOM element #${id} not found`);
  return el;
}

function getQuery(selector) {
  const el = document.querySelector(selector);
  if (!el) console.warn(`DOM element "${selector}" not found`);
  return el;
}

// --- Notification ---
export function showNotification(message, duration = 2000) {
  const notif = document.createElement('div');
  notif.className = 'notification';
  notif.textContent = message;
  document.body.appendChild(notif);
  setTimeout(() => notif.classList.add('show'), 10);
  setTimeout(() => {
    notif.classList.remove('show');
    setTimeout(() => notif.remove(), 300);
  }, duration);
}

// --- Status Indicator ---
export function updateStatus() {
  const indicator = getEl('statusIndicator');
  const weekEl = getEl('statusWeek');
  const phaseEl = getEl('statusPhase');
  const pendingEl = getEl('statusPending');
  const pendingCountEl = getEl('statusPendingCount');

  if (!indicator) return;

  if (!State.hasTeams()) {
    indicator.style.display = 'none';
    return;
  }

  indicator.style.display = 'flex';
  if (weekEl) weekEl.textContent = State.getWeek();
  if (phaseEl) phaseEl.textContent = State.getCurrentPhase();

  const pending = State.getPending();
  if (pendingEl) {
    if (pending > 0) {
      pendingEl.style.display = 'block';
      if (pendingCountEl) pendingCountEl.textContent = pending;
    } else {
      pendingEl.style.display = 'none';
    }
  }
}

// --- Table Updates ---
export function updateSwissTable() {
  const tbody = getQuery('#swissTable tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  const sorted = sortTeamsBySwiss(State.getTeams());
  sorted.forEach((t, i) => {
    const row = document.createElement('tr');
    row.innerHTML = `<td>${i + 1}</td><td>${escapeHtml(t.name)}</td>
      <td>${t.swiss.w}</td><td>${t.swiss.l}</td>
      <td>${t.swiss.pd}</td><td>${buchholz(t)}</td>`;
    tbody.appendChild(row);
  });
}

export function updateLeagueTable() {
  const tbody = getQuery('#leagueTable tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  const sorted = [...State.getPlayers()].sort(comparePlayersByLeague);
  sorted.forEach((p, i) => {
    const row = document.createElement('tr');
    row.innerHTML = `<td>${i + 1}</td><td>${escapeHtml(p.name)} <span class="player-team">(${escapeHtml(p.team)})</span></td>
      <td>${p.league.pts}</td><td>${p.league.w}</td>
      <td>${p.league.l}</td><td>${p.league.pd}</td>`;
    tbody.appendChild(row);
  });
}

// --- Button State Management ---
function setButtonDisabled(id, disabled) {
  const btn = getEl(id);
  if (btn) btn.disabled = disabled;
}

export function updateButtonStates() {
  const swissRound = State.getSwissRound();
  const pending = State.getPending();

  if (swissRound > 0 && swissRound < SWISS_ROUNDS) {
    setButtonDisabled('nextSwissBtn', pending > 0);
  } else if (swissRound === SWISS_ROUNDS) {
    setButtonDisabled('nextSwissBtn', true);
    setButtonDisabled('startBracketBtn', pending > 0);
  } else {
    setButtonDisabled('nextSwissBtn', false);
    setButtonDisabled('startBracketBtn', true);
  }
  setButtonDisabled('nextWeekBtn', true);
}

export function setButtonsForNewWeek() {
  setButtonDisabled('nextSwissBtn', false);
  setButtonDisabled('startBracketBtn', true);
  setButtonDisabled('nextWeekBtn', true);
}

export function setButtonsForLeagueStart() {
  setButtonDisabled('nextSwissBtn', false);
  setButtonDisabled('startBracketBtn', true);
  setButtonDisabled('nextWeekBtn', true);
}

export function disableNextSwiss() { setButtonDisabled('nextSwissBtn', true); }
export function enableNextSwiss() { setButtonDisabled('nextSwissBtn', false); }
export function enableStartBracket() { setButtonDisabled('startBracketBtn', false); }
export function disableStartBracket() { setButtonDisabled('startBracketBtn', true); }
export function enableNextWeek() { setButtonDisabled('nextWeekBtn', false); }

// --- Content Area ---
export function getContentEl() {
  return getEl('content');
}

export function clearContent() {
  const el = getEl('content');
  if (el) el.innerHTML = '';
}

export function appendRound(roundEl) {
  const el = getEl('content');
  if (el) el.appendChild(roundEl);
}

// --- Round Element Creation ---
export function createRoundElement(title) {
  const el = document.createElement('div');
  el.className = 'round';
  el.innerHTML = `<h3>${escapeHtml(title)}</h3>`;
  return el;
}

// --- HTML Escaping (XSS prevention) ---
export function escapeHtml(str) {
  if (str == null) return '';
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(String(str)));
  return div.innerHTML;
}

// --- Styled Confirmation Dialog (replaces window.confirm) ---
export function showConfirm(title, message) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
      <div class="confirm-dialog">
        <h3>⚠️ ${escapeHtml(title)}</h3>
        <p>${escapeHtml(message)}</p>
        <div class="confirm-buttons">
          <button class="btn-confirm-no">Cancel</button>
          <button class="btn-confirm-yes">Yes, Continue</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    overlay.querySelector('.btn-confirm-yes').onclick = () => {
      overlay.remove();
      resolve(true);
    };
    overlay.querySelector('.btn-confirm-no').onclick = () => {
      overlay.remove();
      resolve(false);
    };
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) { overlay.remove(); resolve(false); }
    });
  });
}

// --- Inline Error Message (replaces alert() for match errors) ---
export function showMatchError(matchEl, message) {
  let errorEl = matchEl.querySelector('.match-error');
  if (!errorEl) {
    errorEl = document.createElement('div');
    errorEl.className = 'match-error';
    matchEl.appendChild(errorEl);
  }
  errorEl.textContent = message;
  errorEl.classList.add('show');
  // Auto-hide after 5 seconds
  setTimeout(() => errorEl.classList.remove('show'), 5000);
}

// --- Scroll to newly created round ---
export function scrollToElement(el) {
  if (el && el.scrollIntoView) {
    setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  }
}

// --- CSV Download Helper ---
export function downloadCSV(filename, csvContent) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url); // Clean up memory
}
