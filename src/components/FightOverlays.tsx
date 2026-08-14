"use client";

/**
 * FightOverlays — all full-screen overlay effects for the fight screen.
 *
 * Each overlay is independently toggled by a flag in ui-flags.ts.
 * If you don't like an effect, set its flag to false and it disappears.
 *
 * Overlays in this file:
 *   - VsSplash       (#6) — "SONGOKU VS VEGETA" splash before fight
 *   - RoundAnnounce   (#2) — "ROUND 1" / "FIGHT!" full-screen text
 *   - KoFlash         (#3) — white/red flash on KO
 *   - WinSplash       (#3) — "1P WINS" splash after match
 *   - ComboCounter    (#8) — "xN COMBO!" popup
 *   - SuperFlash      (#10) — power meter glow when super-ready
 */

import { useEffect, useState, useRef, type ReactNode } from "react";
import { UI_FLAGS } from "@/lib/ui-flags";
import { useSoundEffects } from "@/hooks/use-sound-effects";
import type { CharacterInfo } from "@/lib/character-catalog";

/* ========================================
   #6 — VS Splash Screen
   ======================================== */

interface VsSplashProps {
  p1Char: CharacterInfo;
  p2Char: CharacterInfo;
  onDone: () => void;
}

export function VsSplash({ p1Char, p2Char, onDone }: VsSplashProps) {
  const [phase, setPhase] = useState<"in" | "hold" | "out">("in");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("hold"), 300);
    const t2 = setTimeout(() => setPhase("out"), 1500);
    const t3 = setTimeout(() => onDone(), 2000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onDone]);

  return (
    <div className={`vs-splash vs-splash--${phase}`} aria-hidden="true">
      <div className="vs-splash__left">
        <span className="vs-splash__num">1P</span>
        <span className="vs-splash__name">{p1Char.displayName}</span>
      </div>
      <div className="vs-splash__center">
        <span className="vs-splash__vs">VS</span>
      </div>
      <div className="vs-splash__right">
        <span className="vs-splash__num">2P</span>
        <span className="vs-splash__name">{p2Char.displayName}</span>
      </div>
    </div>
  );
}

/* ========================================
   #2 — Round Announcement Overlay
   ======================================== */

interface RoundAnnounceProps {
  roundNumber: number;
  phase: "intro" | "fighting" | "ko" | "round_over" | "match_over" | "loading";
}

export function RoundAnnounce({ roundNumber, phase }: RoundAnnounceProps) {
  const [show, setShow] = useState(false);
  const [text, setText] = useState("");
  const lastPhaseRef = useRef<string>("");

  useEffect(() => {
    const prev = lastPhaseRef.current;
    // ALWAYS update the ref first, regardless of which branch fires
    lastPhaseRef.current = phase;

    // Show "ROUND N" when entering intro (from non-intro state)
    if (phase === "intro" && prev !== "intro") {
      setText(`ROUND ${roundNumber}`);
      setShow(true);
      const t = setTimeout(() => setShow(false), 1200);
      return () => clearTimeout(t);
    }
    // Show "FIGHT!" when transitioning from intro to fighting
    if (phase === "fighting" && prev === "intro") {
      setText("FIGHT!");
      setShow(true);
      const t = setTimeout(() => setShow(false), 800);
      return () => clearTimeout(t);
    }
  }, [phase, roundNumber]);

  if (!show) return null;

  return (
    <div className="round-announce" aria-hidden="true">
      <span className="round-announce__text">{text}</span>
    </div>
  );
}

/* ========================================
   #3 — KO Flash + Win Splash
   ======================================== */

interface KoFlashProps {
  phase: "intro" | "fighting" | "ko" | "round_over" | "match_over" | "loading";
  roundWinner: number;
  matchWinner: number;
  p1Char: CharacterInfo;
  p2Char: CharacterInfo;
}

export function KoFlash({ phase, roundWinner, matchWinner, p1Char, p2Char }: KoFlashProps) {
  const [flash, setFlash] = useState(false);
  const [showWin, setShowWin] = useState(false);
  const lastPhaseRef = useRef<string>("");

  useEffect(() => {
    // KO flash when entering ko phase
    if (phase === "ko" && lastPhaseRef.current !== "ko" && lastPhaseRef.current !== "round_over") {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 300);
      return () => clearTimeout(t);
    }
    // Win splash when match ends
    if (phase === "match_over" && lastPhaseRef.current !== "match_over") {
      setShowWin(true);
    }
    lastPhaseRef.current = phase;
  }, [phase]);

  if (!flash && !showWin) return null;

  return (
    <>
      {flash && <div className="ko-flash" aria-hidden="true" />}
      {showWin && (
        <div className="win-splash" aria-hidden="true">
          <div className="win-splash__text">
            {matchWinner === 0 ? "1P" : "2P"} WINS!
          </div>
          <div className={`win-splash__char win-splash__char--${matchWinner === 0 ? "p1" : "p2"}`}>
            {matchWinner === 0 ? p1Char.displayName : p2Char.displayName}
          </div>
        </div>
      )}
    </>
  );
}

/* ========================================
   #8 — Combo Counter
   ======================================== */

interface ComboCounterProps {
  p1Life: number;
  p2Life: number;
}

export function ComboCounter({ p1Life, p2Life }: ComboCounterProps) {
  const [combo, setCombo] = useState<{ side: "p1" | "p2"; count: number } | null>(null);
  const lastLifeRef = useRef({ p1: p1Life, p2: p2Life });
  const comboRef = useRef<{ side: "p1" | "p2"; count: number; timer: ReturnType<typeof setTimeout> | null } | null>(null);

  useEffect(() => {
    const lastP1 = lastLifeRef.current.p1;
    const lastP2 = lastLifeRef.current.p2;
    // P1 took damage → P2 is attacking
    if (p1Life < lastP1) {
      incrementCombo("p2");
    }
    // P2 took damage → P1 is attacking
    if (p2Life < lastP2) {
      incrementCombo("p1");
    }
    lastLifeRef.current = { p1: p1Life, p2: p2Life };
  }, [p1Life, p2Life]);

  const incrementCombo = (side: "p1" | "p2") => {
    if (comboRef.current?.timer) clearTimeout(comboRef.current.timer);
    const count = (comboRef.current?.side === side ? comboRef.current.count : 0) + 1;
    comboRef.current = {
      side,
      count,
      timer: setTimeout(() => {
        setCombo(null);
        comboRef.current = null;
      }, 2000),
    };
    setCombo({ side, count });
  };

  useEffect(() => {
    return () => {
      if (comboRef.current?.timer) clearTimeout(comboRef.current.timer);
    };
  }, []);

  if (!combo || combo.count < 2) return null;

  return (
    <div className={`combo-counter combo-counter--${combo.side}`} aria-hidden="true">
      <span className="combo-counter__num">{combo.count}</span>
      <span className="combo-counter__hits">HITS!</span>
    </div>
  );
}

/* ========================================
   #10 — Super Flash (power meter glow)
   ======================================== */

interface SuperFlashProps {
  p1Power: number;
  p2Power: number;
  children: ReactNode;
}

export function SuperFlash({ p1Power, p2Power, children }: SuperFlashProps) {
  const p1Ready = p1Power >= 100;
  const p2Ready = p2Power >= 100;

  return (
    <div
      className={`super-flash-wrap ${p1Ready ? "super-flash-wrap--p1" : ""} ${p2Ready ? "super-flash-wrap--p2" : ""}`}
    >
      {children}
    </div>
  );
}

/* ========================================
   #12 — Pause Menu
   ======================================== */

interface PauseMenuProps {
  open: boolean;
  onResume: () => void;
  onMoveList: () => void;
  onExit: () => void;
}

export function PauseMenu({ open, onResume, onMoveList, onExit }: PauseMenuProps) {
  const { play } = useSoundEffects();

  if (!open) return null;

  const handleResume = () => { play("back"); onResume(); };
  const handleMoveList = () => { play("click"); onMoveList(); };
  const handleExit = () => { play("back"); onExit(); };

  return (
    <div className="pause-menu" role="dialog" aria-modal="true" aria-label="Paused">
      <div className="pause-menu__panel">
        <div className="pause-menu__title">PAUSED</div>
        <div className="pause-menu__buttons">
          <button className="pause-menu__btn pause-menu__btn--primary" onClick={handleResume}>
            RESUME
          </button>
          <button className="pause-menu__btn" onClick={handleMoveList}>
            MOVE LIST
          </button>
          <button className="pause-menu__btn pause-menu__btn--exit" onClick={handleExit}>
            EXIT TO CHARACTER SELECT
          </button>
        </div>
        <div className="pause-menu__hint">Press ESC to resume</div>
      </div>
    </div>
  );
}

/* ========================================
   #13 — Results Screen
   ======================================== */

interface ResultsScreenProps {
  p1Char: CharacterInfo;
  p2Char: CharacterInfo;
  matchWinner: number; // 0 or 1
  p1RoundsWon: number;
  p2RoundsWon: number;
  timeElapsed: number; // in seconds
  onRematch: () => void;
  onChangeChar: () => void;
  onExit: () => void;
}

export function ResultsScreen({
  p1Char,
  p2Char,
  matchWinner,
  p1RoundsWon,
  p2RoundsWon,
  timeElapsed,
  onRematch,
  onChangeChar,
  onExit,
}: ResultsScreenProps) {
  const { play } = useSoundEffects();

  useEffect(() => {
    play("confirm");
  }, [play]);

  const winnerChar = matchWinner === 0 ? p1Char : p2Char;
  const winnerSide = matchWinner === 0 ? "p1" : "p2";
  const mins = Math.floor(timeElapsed / 60);
  const secs = timeElapsed % 60;
  const timeStr = `${mins}:${secs.toString().padStart(2, "0")}`;

  const handleRematch = () => { play("select"); onRematch(); };
  const handleChange = () => { play("click"); onChangeChar(); };
  const handleExit = () => { play("back"); onExit(); };

  return (
    <div className="results" role="dialog" aria-modal="true" aria-label="Match results">
      <div className="results__panel">
        <div className="results__header">
          <span className="results__label">WINNER</span>
        </div>
        <div className={`results__winner results__winner--${winnerSide}`}>
          <span className="results__winner-num">{matchWinner === 0 ? "1P" : "2P"}</span>
          <span className="results__winner-name">{winnerChar.displayName}</span>
        </div>
        <div className="results__stats">
          <div className="results__stat-row">
            <span className="results__stat-label">ROUNDS</span>
            <span className="results__stat-value">{p1RoundsWon} — {p2RoundsWon}</span>
          </div>
          <div className="results__stat-row">
            <span className="results__stat-label">TIME</span>
            <span className="results__stat-value">{timeStr}</span>
          </div>
        </div>
        <div className="results__vs-mini">
          <span className="results__vs-char results__vs-char--p1">{p1Char.displayName}</span>
          <span className="results__vs-label">VS</span>
          <span className="results__vs-char results__vs-char--p2">{p2Char.displayName}</span>
        </div>
        <div className="results__buttons">
          <button className="results__btn results__btn--primary" onClick={handleRematch}>
            REMATCH
          </button>
          <button className="results__btn" onClick={handleChange}>
            CHANGE CHARACTER
          </button>
          <button className="results__btn results__btn--exit" onClick={handleExit}>
            EXIT
          </button>
        </div>
      </div>
    </div>
  );
}
