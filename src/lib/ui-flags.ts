/**
 * UI Feature Flags
 *
 * Toggle these to enable/disable specific UI enhancements. If you don't
 * like a feature, set its flag to `false` and it will be completely
 * removed from the build (tree-shaken). No need to revert code.
 *
 * All flags default to `true` (enabled).
 */

export const UI_FLAGS = {
  /** #1 — Styled loading screen (P5 "NOW LOADING" with stripes + animated dots) */
  styledLoadingScreen: true,

  /** #2 — Round start announcement overlay (ROUND 1 / FIGHT! full-screen text) */
  roundAnnouncement: true,

  /** #3 — KO flash + win splash screen */
  koFlashAndWinSplash: true,

  /** #4 — Character select entrance animation (stagger cards in from sides) */
  charSelectEntrance: true,

  /** #5 — Button press feedback (scale/flash on click) */
  buttonPressFeedback: true,

  /** #6 — VS splash screen (SONGOKU VS VEGETA before fight) */
  vsSplashScreen: true,

  /** #7 — Health bar damage ghost trail (slow drain to new value) */
  healthGhostTrail: true,

  /** #8 — Combo counter (xN COMBO! popup on multi-hits) */
  comboCounter: true,

  /** #10 — Super flash (power meter glows when super-ready) */
  superFlash: true,

  /** #12 — Pause menu (Esc during fight → overlay with RESUME / MOVE LIST / EXIT) */
  pauseMenu: true,

  /** #13 — Results screen (after match: winner, rounds, time, REMATCH / CHANGE / EXIT) */
  resultsScreen: true,

  /** #14 — Sound effects on UI interactions (click, lock-in, round announce) */
  soundEffects: true,
} as const;

export type UiFlag = keyof typeof UI_FLAGS;
