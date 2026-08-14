/**
 * Move lists for each character, derived from the engine's .cmd files.
 *
 * Notation legend (shown to the player):
 *   ↑  = Up          ↓  = Down        →  = Forward     ←  = Back
 *   ↘  = Down+Fwd    ↙  = Down+Back
 *   Ⓐ  = Light Punch Ⓑ  = Med Punch   Ⓒ  = Heavy Punch
 *   ⓧ  = Light Kick  ⓨ  = Med Kick    ⓩ  = Heavy Kick
 *   Ⓢ  = Start
 *
 * Each move stores both the display notation and the P1/P2 key sequences
 * (so the UI can show "W A S D" or "↑ ← ↓ →" depending on which player
 * is viewing). The key sequence uses the actual keyboard keys the player
 * presses, in order, with "+" meaning simultaneous.
 */

export type MoveCategory = "special" | "super" | "dash" | "system" | "basic";

export interface Move {
  /** Display name (e.g. "Kamehameha") */
  name: string;
  /** Category for grouping in the UI */
  category: MoveCategory;
  /** Short description (optional) */
  description?: string;
  /** Display notation using arrow/symbol legend (e.g. "↓ ↘ → + ⓨ") */
  notation: string;
  /** P1 key sequence (e.g. "S D+D K" — space-separated steps, + means simultaneous) */
  p1Keys: string;
  /** P2 key sequence */
  p2Keys: string;
}

interface CharacterMoves {
  /** Character display name */
  name: string;
  /** Moves grouped by category */
  moves: Move[];
}

// Symbol legend for notation
export const NOTATION_LEGEND = [
  { symbol: "↑", label: "Up" },
  { symbol: "↓", label: "Down" },
  { symbol: "→", label: "Forward" },
  { symbol: "←", label: "Back" },
  { symbol: "↘", label: "Down + Forward" },
  { symbol: "↙", label: "Down + Back" },
  { symbol: "Ⓐ", label: "Light Punch" },
  { symbol: "Ⓑ", label: "Medium Punch" },
  { symbol: "Ⓒ", label: "Heavy Punch" },
  { symbol: "ⓧ", label: "Light Kick" },
  { symbol: "ⓨ", label: "Medium Kick" },
  { symbol: "ⓩ", label: "Heavy Kick" },
  { symbol: "Ⓢ", label: "Start" },
] as const;

// P1 key legend
export const P1_KEY_LEGEND = [
  { key: "W", action: "Up" },
  { key: "S", action: "Down" },
  { key: "D", action: "Forward" },
  { key: "A", action: "Back" },
  { key: "U", action: "Light Punch (Ⓐ)" },
  { key: "I", action: "Medium Punch (Ⓑ)" },
  { key: "O", action: "Heavy Punch (Ⓒ)" },
  { key: "J", action: "Light Kick (ⓧ)" },
  { key: "K", action: "Medium Kick (ⓨ)" },
  { key: "L", action: "Heavy Kick (ⓩ)" },
  { key: "1", action: "Start (Ⓢ)" },
] as const;

// P2 key legend
export const P2_KEY_LEGEND = [
  { key: "↑", action: "Up" },
  { key: "↓", action: "Down" },
  { key: "→", action: "Forward" },
  { key: "←", action: "Back" },
  { key: "8", action: "Light Punch (Ⓐ)" },
  { key: "9", action: "Medium Punch (Ⓑ)" },
  { key: "0", action: "Heavy Punch (Ⓒ)" },
  { key: "M", action: "Light Kick (ⓧ)" },
  { key: ",", action: "Medium Kick (ⓨ)" },
  { key: ".", action: "Heavy Kick (ⓩ)" },
  { key: "2", action: "Start (Ⓢ)" },
] as const;

export const MOVE_LISTS: Record<string, CharacterMoves> = {
  Songoku: {
    name: "Songoku",
    moves: [
      // ===== SPECIALS =====
      {
        name: "Hadouken (Light)",
        category: "special",
        description: "Ki blast, light version",
        notation: "↓ ↘ → + ⓧ",
        p1Keys: "S D+D J",
        p2Keys: "↓ →+↓ 8",
      },
      {
        name: "Hadouken (Heavy)",
        category: "special",
        description: "Ki blast, heavy version",
        notation: "↓ ↘ → + ⓨ",
        p1Keys: "S D+D K",
        p2Keys: "↓ →+↓ 9",
      },
      {
        name: "Tatsumaki (Light)",
        category: "special",
        description: "Spinning kick, light version",
        notation: "↓ ↙ ← + Ⓐ",
        p1Keys: "S A+D U",
        p2Keys: "↓ ←+↓ 8",
      },
      {
        name: "Tatsumaki (Heavy)",
        category: "special",
        description: "Spinning kick, heavy version",
        notation: "↓ ↙ ← + Ⓑ",
        p1Keys: "S A+D I",
        p2Keys: "↓ ←+↓ 9",
      },
      {
        name: "Shoryuken (Light)",
        category: "special",
        description: "Rising uppercut, light version",
        notation: "→ ↓ ↘ + ⓧ",
        p1Keys: "D S D+D J",
        p2Keys: "→ ↓ →+↓ 8",
      },
      {
        name: "Shoryuken (Heavy)",
        category: "special",
        description: "Rising uppercut, heavy version",
        notation: "→ ↓ ↘ + ⓨ",
        p1Keys: "D S D+D K",
        p2Keys: "→ ↓ →+↓ 9",
      },
      {
        name: "Meteo Smash",
        category: "special",
        description: "Sliding knockdown attack",
        notation: "↓ ↙ ← + ⓨ",
        p1Keys: "S A+D K",
        p2Keys: "↓ ←+↓ 9",
      },
      // ===== SUPERS =====
      {
        name: "Kamehameha",
        category: "super",
        description: "Signature energy beam (super)",
        notation: "↓ ↘ → ↓ ↘ → + ⓨ",
        p1Keys: "S D+D D S D+D K",
        p2Keys: "↓ →+↓ → ↓ →+↓ 9",
      },
      {
        name: "Kaiohken",
        category: "super",
        description: "Power-up rush attack (super)",
        notation: "↓ ↙ ← → + ⓨ",
        p1Keys: "S A+D D K",
        p2Keys: "↓ ←+↓ → 9",
      },
      {
        name: "Ryuken",
        category: "super",
        description: "Dragon fist uppercut (super)",
        notation: "↓ ↘ → ↓ ↘ → + Ⓑ",
        p1Keys: "S D+D D S D+D I",
        p2Keys: "↓ →+↓ → ↓ →+↓ 9",
      },
      {
        name: "Dragon Rush",
        category: "super",
        description: "Rushing combo finisher (super)",
        notation: "↓ ↙ ← → + Ⓑ",
        p1Keys: "S A+D D I",
        p2Keys: "↓ ←+↓ → 9",
      },
      // ===== DASH ATTACKS =====
      {
        name: "Dash Punch (Light)",
        category: "dash",
        notation: "→ → + Ⓐ",
        p1Keys: "D D U",
        p2Keys: "→ → 8",
      },
      {
        name: "Dash Punch (Heavy)",
        category: "dash",
        notation: "→ → + Ⓑ",
        p1Keys: "D D I",
        p2Keys: "→ → 9",
      },
      {
        name: "Dash Kick (Light)",
        category: "dash",
        notation: "→ → + ⓧ",
        p1Keys: "D D J",
        p2Keys: "→ → M",
      },
      {
        name: "Dash Kick (Heavy)",
        category: "dash",
        notation: "→ → + ⓨ",
        p1Keys: "D D K",
        p2Keys: "→ → ,",
      },
      // ===== SYSTEM =====
      {
        name: "Forward Dash",
        category: "system",
        notation: "→ →",
        p1Keys: "D D",
        p2Keys: "→ →",
      },
      {
        name: "Back Dash",
        category: "system",
        notation: "← ←",
        p1Keys: "A A",
        p2Keys: "← ←",
      },
      {
        name: "Long Jump",
        category: "system",
        notation: "↓ (hold) then ↑",
        p1Keys: "S (hold) W",
        p2Keys: "↓ (hold) ↑",
      },
      {
        name: "Recovery",
        category: "system",
        description: "Quick stand after knockdown",
        notation: "ⓧ + Ⓐ  or  Ⓒ",
        p1Keys: "J+U  or  O",
        p2Keys: "8+M  or  0",
      },
      {
        name: "Charge Power",
        category: "system",
        description: "Build super meter",
        notation: "ⓨ + Ⓑ",
        p1Keys: "K+I",
        p2Keys: ",+9",
      },
      // ===== BASIC ATTACKS =====
      {
        name: "Light Punch",
        category: "basic",
        notation: "Ⓐ",
        p1Keys: "U",
        p2Keys: "8",
      },
      {
        name: "Medium Punch",
        category: "basic",
        notation: "Ⓑ",
        p1Keys: "I",
        p2Keys: "9",
      },
      {
        name: "Heavy Punch",
        category: "basic",
        notation: "Ⓒ",
        p1Keys: "O",
        p2Keys: "0",
      },
      {
        name: "Light Kick",
        category: "basic",
        notation: "ⓧ",
        p1Keys: "J",
        p2Keys: "M",
      },
      {
        name: "Medium Kick",
        category: "basic",
        notation: "ⓨ",
        p1Keys: "K",
        p2Keys: ",",
      },
      {
        name: "Heavy Kick",
        category: "basic",
        notation: "ⓩ",
        p1Keys: "L",
        p2Keys: ".",
      },
      {
        name: "Crouch + Light Punch",
        category: "basic",
        notation: "↓ (hold) + Ⓐ",
        p1Keys: "S (hold) U",
        p2Keys: "↓ (hold) 8",
      },
      {
        name: "Crouch + Medium Punch",
        category: "basic",
        notation: "↓ (hold) + Ⓑ",
        p1Keys: "S (hold) I",
        p2Keys: "↓ (hold) 9",
      },
    ],
  },

  Vegeta: {
    name: "Vegeta",
    moves: [
      // ===== SPECIALS =====
      {
        name: "Hadouken (Light)",
        category: "special",
        description: "Ki blast, light version",
        notation: "↓ → + ⓧ",
        p1Keys: "S D J",
        p2Keys: "↓ → 8",
      },
      {
        name: "Hadouken (Heavy)",
        category: "special",
        description: "Ki blast, heavy version",
        notation: "↓ → + ⓨ",
        p1Keys: "S D K",
        p2Keys: "↓ → 9",
      },
      {
        name: "Shoryuken (Light)",
        category: "special",
        description: "Rising uppercut, light version",
        notation: "→ ↓ ↘ + ⓧ",
        p1Keys: "D S D+D J",
        p2Keys: "→ ↓ →+↓ 8",
      },
      {
        name: "Shoryuken (Heavy)",
        category: "special",
        description: "Rising uppercut, heavy version",
        notation: "→ ↓ ↘ + ⓨ",
        p1Keys: "D S D+D K",
        p2Keys: "→ ↓ →+↓ 9",
      },
      {
        name: "Tatsumaki (Light)",
        category: "special",
        description: "Spinning kick, light version",
        notation: "↓ ← + Ⓐ",
        p1Keys: "S A U",
        p2Keys: "↓ ← 8",
      },
      {
        name: "Tatsumaki (Heavy)",
        category: "special",
        description: "Spinning kick, heavy version",
        notation: "↓ ← + Ⓑ",
        p1Keys: "S A I",
        p2Keys: "↓ ← 9",
      },
      {
        name: "Flying Attack (Light)",
        category: "special",
        description: "Aerial diving attack, light version",
        notation: "↓ ← + ⓧ",
        p1Keys: "S A J",
        p2Keys: "↓ ← M",
      },
      {
        name: "Flying Attack (Heavy)",
        category: "special",
        description: "Aerial diving attack, heavy version",
        notation: "↓ ← + ⓨ",
        p1Keys: "S A K",
        p2Keys: "↓ ← ,",
      },
      // ===== SUPERS =====
      {
        name: "Shinkuu Hadouken",
        category: "super",
        description: "Vacuum ki beam (super)",
        notation: "↓ ↘ → ↓ ↘ → + ⓨ",
        p1Keys: "S D+D D S D+D K",
        p2Keys: "↓ →+↓ → ↓ →+↓ 9",
      },
      {
        name: "Bakuhatsu",
        category: "super",
        description: "Explosive blast (super)",
        notation: "↓ ↘ → ↓ ↘ → + Ⓑ",
        p1Keys: "S D+D D S D+D I",
        p2Keys: "↓ →+↓ → ↓ →+↓ 9",
      },
      {
        name: "Mega",
        category: "super",
        description: "Mega energy blast (super)",
        notation: "↓ ↙ ← → + ⓨ",
        p1Keys: "S A+D D K",
        p2Keys: "↓ ←+↓ → 9",
      },
      {
        name: "Dragon Rush",
        category: "super",
        description: "Rushing combo finisher (super)",
        notation: "↓ ↙ ← → + Ⓑ",
        p1Keys: "S A+D D I",
        p2Keys: "↓ ←+↓ → 9",
      },
      // ===== DASH ATTACKS =====
      {
        name: "Dash Punch (Light)",
        category: "dash",
        notation: "→ → + Ⓐ",
        p1Keys: "D D U",
        p2Keys: "→ → 8",
      },
      {
        name: "Dash Punch (Heavy)",
        category: "dash",
        notation: "→ → + Ⓑ",
        p1Keys: "D D I",
        p2Keys: "→ → 9",
      },
      {
        name: "Dash Kick (Light)",
        category: "dash",
        notation: "→ → + ⓧ",
        p1Keys: "D D J",
        p2Keys: "→ → M",
      },
      {
        name: "Dash Kick (Heavy)",
        category: "dash",
        notation: "→ → + ⓨ",
        p1Keys: "D D K",
        p2Keys: "→ → ,",
      },
      // ===== SYSTEM =====
      {
        name: "Forward Dash",
        category: "system",
        notation: "→ →",
        p1Keys: "D D",
        p2Keys: "→ →",
      },
      {
        name: "Back Dash",
        category: "system",
        notation: "← ←",
        p1Keys: "A A",
        p2Keys: "← ←",
      },
      {
        name: "Long Jump",
        category: "system",
        notation: "↓ (hold) then ↑",
        p1Keys: "S (hold) W",
        p2Keys: "↓ (hold) ↑",
      },
      {
        name: "Recovery",
        category: "system",
        description: "Quick stand after knockdown",
        notation: "ⓧ + Ⓐ  or  Ⓒ",
        p1Keys: "J+U  or  O",
        p2Keys: "8+M  or  0",
      },
      {
        name: "Charge Power",
        category: "system",
        description: "Build super meter",
        notation: "ⓨ + Ⓑ",
        p1Keys: "K+I",
        p2Keys: ",+9",
      },
      // ===== BASIC ATTACKS =====
      {
        name: "Light Punch",
        category: "basic",
        notation: "Ⓐ",
        p1Keys: "U",
        p2Keys: "8",
      },
      {
        name: "Medium Punch",
        category: "basic",
        notation: "Ⓑ",
        p1Keys: "I",
        p2Keys: "9",
      },
      {
        name: "Heavy Punch",
        category: "basic",
        notation: "Ⓒ",
        p1Keys: "O",
        p2Keys: "0",
      },
      {
        name: "Light Kick",
        category: "basic",
        notation: "ⓧ",
        p1Keys: "J",
        p2Keys: "M",
      },
      {
        name: "Medium Kick",
        category: "basic",
        notation: "ⓨ",
        p1Keys: "K",
        p2Keys: ",",
      },
      {
        name: "Heavy Kick",
        category: "basic",
        notation: "ⓩ",
        p1Keys: "L",
        p2Keys: ".",
      },
      {
        name: "Crouch + Light Punch",
        category: "basic",
        notation: "↓ (hold) + Ⓐ",
        p1Keys: "S (hold) U",
        p2Keys: "↓ (hold) 8",
      },
      {
        name: "Crouch + Medium Punch",
        category: "basic",
        notation: "↓ (hold) + Ⓑ",
        p1Keys: "S (hold) I",
        p2Keys: "↓ (hold) 9",
      },
    ],
  },
};

/** Get the move list for a character by id. Returns null if not found. */
export function getMoveList(characterId: string): CharacterMoves | null {
  return MOVE_LISTS[characterId] ?? null;
}

/** Category display order and labels */
export const CATEGORY_ORDER: { id: MoveCategory; label: string; description: string }[] = [
  { id: "special", label: "Special Moves", description: "Hadouken, Shoryuken, Tatsumaki, etc." },
  { id: "super", label: "Super Moves", description: "Costs power meter. Big damage." },
  { id: "dash", label: "Dash Attacks", description: "Press → → + attack while dashing." },
  { id: "system", label: "System", description: "Movement and utility." },
  { id: "basic", label: "Basic Attacks", description: "Normal punches and kicks." },
];
