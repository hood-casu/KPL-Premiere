/**
 * @module state
 * @description Centralized state management with getters, setters, and
 * localStorage persistence. All app state flows through this module —
 * no other module should hold mutable state.
 */
import { TOTAL_WEEKS, SWISS_ROUNDS } from './config.js';

const STORAGE_KEY = 'leagueState';

const state = {
  week: 1,
  teams: [],
  players: [],
  swissRound: 0,
  pending: 0,
  bracketRounds: [],
};

// --- Getters ---
export function getWeek() { return state.week; }
export function getTeams() { return state.teams; }
export function getPlayers() { return state.players; }
export function getSwissRound() { return state.swissRound; }
export function getPending() { return state.pending; }
export function getBracketRounds() { return state.bracketRounds; }

// --- Setters ---
export function setWeek(val) { state.week = val; }
export function setTeams(val) { state.teams = val; }
export function setPlayers(val) { state.players = val; }
export function setSwissRound(val) { state.swissRound = val; }
export function setPending(val) { state.pending = val; }
export function setBracketRounds(val) { state.bracketRounds = val; }

export function incrementSwissRound() { state.swissRound++; }
export function decrementPending() { state.pending--; }
export function incrementPending() { state.pending++; }

// --- Derived state ---
export function hasTeams() { return state.teams.length > 0; }
export function hasPlayers() { return state.players.length > 0; }
export function isSwissComplete() { return state.swissRound === SWISS_ROUNDS; }
export function isLeagueComplete() { return state.week >= TOTAL_WEEKS; }
export function hasBracketStarted() {
  return state.bracketRounds[0] && state.bracketRounds[0].length > 0;
}

export function getCurrentPhase() {
  if (state.swissRound === 0) return 'Ready to Start Swiss';
  if (state.swissRound > 0 && state.swissRound <= SWISS_ROUNDS) return `Swiss Round ${state.swissRound}`;
  if (hasBracketStarted()) return 'Placement Bracket';
  return 'Week Complete';
}

// --- Find helpers ---
export function findTeamByName(name) {
  return state.teams.find(t => t.name === name) || null;
}

export function findPlayerByName(name) {
  return state.players.find(p => p.name === name) || null;
}

// --- Persistence ---
export function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      week: state.week,
      teams: state.teams,
      players: state.players,
      swissRound: state.swissRound,
      pending: state.pending,
      bracketRounds: state.bracketRounds,
    }));
  } catch (err) {
    console.error('Failed to save league state:', err);
  }
}

export function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    state.week = data.week || 1;
    state.teams = data.teams || [];
    state.players = data.players || [];
    state.swissRound = data.swissRound || 0;
    state.pending = data.pending || 0;
    state.bracketRounds = data.bracketRounds || [];
    return true;
  } catch (err) {
    console.error('Failed to load league state:', err);
    return false;
  }
}

export function clearSaved() {
  localStorage.removeItem(STORAGE_KEY);
}

// --- Bulk restore (for import) ---
export function restoreState(backup) {
  state.week = backup.week || 1;
  state.swissRound = backup.swissRound || 0;
  state.pending = backup.pending || 0;
  state.teams = backup.teams;
  state.players = backup.players;
  state.bracketRounds = backup.bracketRounds || [];
}
