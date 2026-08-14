"use client";

/**
 * TouchControls — on-screen virtual gamepad for mobile devices.
 *
 * Uses 8 discrete direction buttons (left) + 6 staggered action buttons
 * (right). Discrete buttons (instead of a floating joystick) allow
 * double-tapping for dashes — e.g. tap F, release, tap F within 10
 * frames triggers the engine's `FF` (forward dash) command.
 *
 * Direction button layout (3×3 grid, center empty):
 *   [↖ UB] [↑ U ] [↗ UF]
 *   [← B ]        [→ F ]
 *   [↙ DB] [↓ D ] [↘ DF]
 *
 * Action button layout (staggered arcade fight-stick style):
 *   [LP] [MP] [HP]        ← punches (a, b, c)
 *      [LK] [MK] [HK]     ← kicks (x, y, z)
 *
 * Multi-touch is fully supported — direction buttons (left thumb) and
 * action buttons (right thumb) work independently and simultaneously.
 * You can also press two direction buttons at once (e.g. U + F = UF).
 *
 * Only P1 is controllable via touch. The hook pumps P1's input to the
 * WASM engine via its own RAF loop.
 */

import { useEffect, useRef, useCallback, useState } from "react";
import type { GameInstance } from "@/lib/wasm-loader";

interface TouchControlsProps {
  game: GameInstance | null;
  /** When false, the pump is paused and no input is sent. */
  enabled: boolean;
}

// Canonical input order: directions first, then buttons.
const INPUT_ORDER = ["U", "D", "B", "F", "a", "b", "c", "x", "y", "z"] as const;
type InputChar = (typeof INPUT_ORDER)[number];

// Direction buttons — each maps to one or two direction chars.
// Pressing U and F simultaneously produces the same output as pressing UF.
const DIRECTION_BUTTONS: { id: string; label: string; chars: InputChar[]; pos: string }[] = [
  { id: "UB", label: "↖", chars: ["U", "B"], pos: "tl" },
  { id: "U",  label: "↑", chars: ["U"],      pos: "tc" },
  { id: "UF", label: "↗", chars: ["U", "F"], pos: "tr" },
  { id: "B",  label: "←", chars: ["B"],      pos: "ml" },
  // center (mc) is intentionally empty — neutral / no direction
  { id: "F",  label: "→", chars: ["F"],      pos: "mr" },
  { id: "DB", label: "↙", chars: ["D", "B"], pos: "bl" },
  { id: "D",  label: "↓", chars: ["D"],      pos: "bc" },
  { id: "DF", label: "↘", chars: ["D", "F"], pos: "br" },
];

// Action buttons — top row punches, bottom row kicks (staggered).
const ACTION_BUTTONS: { input: InputChar; label: string; sub: string; row: "top" | "bottom" }[] = [
  { input: "a", label: "LP", sub: "Light Punch", row: "top" },
  { input: "b", label: "MP", sub: "Med Punch", row: "top" },
  { input: "c", label: "HP", sub: "Heavy Punch", row: "top" },
  { input: "x", label: "LK", sub: "Light Kick", row: "bottom" },
  { input: "y", label: "MK", sub: "Med Kick", row: "bottom" },
  { input: "z", label: "HK", sub: "Heavy Kick", row: "bottom" },
];

export default function TouchControls({ game, enabled }: TouchControlsProps) {
  // Track which buttons are currently held down (by button id for directions,
  // by input char for actions). We compute the final input string as the
  // union of all active direction chars + all active action chars.
  const activeDirectionButtonsRef = useRef<Set<string>>(new Set());
  const activeActionsRef = useRef<Set<InputChar>>(new Set());
  const gameRef = useRef<GameInstance | null>(game);
  const rafRef = useRef<number | null>(null);
  const enabledRef = useRef(enabled);
  const lastSentRef = useRef<string | null>(null);

  // For visual highlight — mirrors the refs above.
  const [activeDirs, setActiveDirs] = useState<Set<string>>(new Set());
  const [activeActions, setActiveActions] = useState<Set<InputChar>>(new Set());

  useEffect(() => { gameRef.current = game; }, [game]);
  useEffect(() => { enabledRef.current = enabled; }, [enabled]);

  // RAF pump — only sends when input changes (avoids redundant ccall).
  const pump = useCallback(() => {
    const g = gameRef.current;
    if (g?.Module && typeof g.Module.ccall === "function" && enabledRef.current) {
      // Build the set of active input chars from all pressed buttons.
      const active = new Set<InputChar>();
      for (const id of activeDirectionButtonsRef.current) {
        const btn = DIRECTION_BUTTONS.find((b) => b.id === id);
        if (btn) btn.chars.forEach((c) => active.add(c));
      }
      for (const c of activeActionsRef.current) {
        active.add(c);
      }
      // Build string in canonical order.
      const input = INPUT_ORDER.filter((c) => active.has(c)).join("");
      if (input !== lastSentRef.current) {
        try {
          g.Module.ccall("setExternalPlayerInput", "void", ["number", "string"], [0, input]);
        } catch (_) {
          // Swallow — engine errors are non-recoverable from JS
        }
        lastSentRef.current = input;
      }
    }
    rafRef.current = requestAnimationFrame(pump);
  }, []);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(pump);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [pump]);

  // Direction button press/release.
  const pressDir = useCallback((id: string) => {
    activeDirectionButtonsRef.current.add(id);
    setActiveDirs(new Set(activeDirectionButtonsRef.current));
  }, []);
  const releaseDir = useCallback((id: string) => {
    activeDirectionButtonsRef.current.delete(id);
    setActiveDirs(new Set(activeDirectionButtonsRef.current));
  }, []);

  // Action button press/release.
  const pressAction = useCallback((c: InputChar) => {
    activeActionsRef.current.add(c);
    setActiveActions(new Set(activeActionsRef.current));
  }, []);
  const releaseAction = useCallback((c: InputChar) => {
    activeActionsRef.current.delete(c);
    setActiveActions(new Set(activeActionsRef.current));
  }, []);

  // Generic touch handlers.
  const makeDirHandlers = (id: string) => ({
    onTouchStart: (e: React.TouchEvent) => { e.preventDefault(); pressDir(id); },
    onTouchEnd: (e: React.TouchEvent) => { e.preventDefault(); releaseDir(id); },
    onTouchCancel: (e: React.TouchEvent) => { e.preventDefault(); releaseDir(id); },
    onMouseDown: (e: React.MouseEvent) => { e.preventDefault(); pressDir(id); },
    onMouseUp: (e: React.MouseEvent) => { e.preventDefault(); releaseDir(id); },
    onMouseLeave: () => { releaseDir(id); },
    onContextMenu: (e: React.MouseEvent) => { e.preventDefault(); },
  });

  const makeActionHandlers = (c: InputChar) => ({
    onTouchStart: (e: React.TouchEvent) => { e.preventDefault(); pressAction(c); },
    onTouchEnd: (e: React.TouchEvent) => { e.preventDefault(); releaseAction(c); },
    onTouchCancel: (e: React.TouchEvent) => { e.preventDefault(); releaseAction(c); },
    onMouseDown: (e: React.MouseEvent) => { e.preventDefault(); pressAction(c); },
    onMouseUp: (e: React.MouseEvent) => { e.preventDefault(); releaseAction(c); },
    onMouseLeave: () => { releaseAction(c); },
    onContextMenu: (e: React.MouseEvent) => { e.preventDefault(); },
  });

  return (
    <div className="touch-controls" aria-label="Touch controls">
      {/* Direction buttons — 3×3 grid (center empty) */}
      <div className="touch-dpad-grid">
        {DIRECTION_BUTTONS.map((btn) => (
          <button
            key={btn.id}
            className={`touch-btn touch-dir__btn touch-dir__btn--${btn.pos} ${activeDirs.has(btn.id) ? "touch-btn--active" : ""}`}
            aria-label={btn.id}
            {...makeDirHandlers(btn.id)}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* Action buttons — staggered arcade layout */}
      <div className="touch-actions">
        <div className="touch-actions__row touch-actions__row--top">
          {ACTION_BUTTONS.filter((b) => b.row === "top").map((btn) => (
            <button
              key={btn.input}
              className={`touch-btn touch-action__btn touch-action__btn--${btn.input} ${activeActions.has(btn.input) ? "touch-btn--active" : ""}`}
              aria-label={btn.sub}
              {...makeActionHandlers(btn.input)}
            >
              <span className="touch-action__label">{btn.label}</span>
            </button>
          ))}
        </div>
        <div className="touch-actions__row touch-actions__row--bottom">
          {ACTION_BUTTONS.filter((b) => b.row === "bottom").map((btn) => (
            <button
              key={btn.input}
              className={`touch-btn touch-action__btn touch-action__btn--${btn.input} ${activeActions.has(btn.input) ? "touch-btn--active" : ""}`}
              aria-label={btn.sub}
              {...makeActionHandlers(btn.input)}
            >
              <span className="touch-action__label">{btn.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
