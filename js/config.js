/**
 * @module config
 * @description All constants and configuration values for the league.
 * Change these values to adjust league rules without touching business logic.
 */

/** Total number of weeks in the league season. */
export const TOTAL_WEEKS = 15;

/** Number of Swiss rounds per week. */
export const SWISS_ROUNDS = 4;

/** Number of teams in the league. */
export const TEAM_COUNT = 8;

/** Number of players per team. */
export const PLAYERS_PER_TEAM = 2;

/** Number of bracket rounds after Swiss phase. */
export const BRACKET_ROUND_COUNT = 3;

/**
 * Points awarded in finalizeWeek based on bracket placement.
 * Index 0 = 1st/2nd place match, Index 3 = 7th/8th place match.
 */
export const BRACKET_BASE_POINTS = [10, 8, 6, 4];

/** Bonus points for winning the 1st place match. */
export const FIRST_PLACE_BONUS = 5;

/** Points subtracted from base for the loser of each bracket match. */
export const LOSER_POINT_PENALTY = 2;
