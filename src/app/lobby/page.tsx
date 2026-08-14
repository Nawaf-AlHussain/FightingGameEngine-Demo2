"use client";

import { useWipeNavigation } from "@/components/WipeTransition";
import { useSoundEffects } from "@/hooks/use-sound-effects";

/**
 * Lobby page — title screen with fighting-game aesthetic.
 */

export default function LobbyPage() {
  const { navigate } = useWipeNavigation();
  const { play } = useSoundEffects();

  const handleStart = () => {
    play("confirm");
    navigate("/local");
  };

  return (
    <main className="lobby">
      <div className="lobby__bg-grid" aria-hidden="true" />
      <div className="lobby__bg-glow" aria-hidden="true" />

      <div className="lobby__card">
        <div className="lobby__logo">
          <div className="lobby__logo-line">FIGHTING</div>
          <div className="lobby__logo-line lobby__logo-line--accent">GAME</div>
          <div className="lobby__logo-line">ENGINE</div>
        </div>
        <div className="lobby__subtitle">
          <span className="lobby__subtitle-bracket">[</span>
          BROWSER · WASM · 60FPS
          <span className="lobby__subtitle-bracket">]</span>
        </div>

        <div className="lobby__section">
          <button
            onClick={handleStart}
            className="lobby__start-btn"
          >
            <span className="lobby__start-btn-text">PRESS START</span>
            <span className="lobby__start-btn-sub">LOCAL 2P · VS AI</span>
          </button>
          <p className="lobby__hint">
            Local 2P: two players, one keyboard · VS AI: fight the computer
          </p>
        </div>

        <div className="lobby__roster">
          <span className="lobby__roster-label">ROSTER</span>
          <div className="lobby__roster-chars">
            <span className="lobby__roster-char lobby__roster-char--p1">SONGOKU</span>
            <span className="lobby__roster-vs">VS</span>
            <span className="lobby__roster-char lobby__roster-char--p2">VEGETA</span>
          </div>
        </div>
      </div>

      <footer className="footer-credit">Made by Nawaf Al Hussain</footer>
    </main>
  );
}
