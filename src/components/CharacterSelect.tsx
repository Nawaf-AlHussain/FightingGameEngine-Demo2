"use client";

/**
 * CharacterSelect — fighting-game style character select screen.
 *
 * Modes:
 *   - local2p: P1 uses WASD+U, P2 uses Arrows+0 (two players, one keyboard)
 *   - vsAI: P1 picks both characters (WASD+U for both). P2 is AI-controlled.
 */

import { useState, useEffect, useCallback } from "react";
import {
  getBundledCharacters,
  type CharacterInfo,
} from "@/lib/character-catalog";
import { getAllCharacters, getPortraitUrl } from "@/lib/character-manifest";
import { isCharacterCached, cacheCharacter, clearCharacterCache } from "@/lib/character-cache";
import { downloadCharacter, type DownloadProgress } from "@/lib/character-downloader";
import { UI_FLAGS } from "@/lib/ui-flags";
import type { AIDifficulty } from "@/hooks/use-ai-player";

export type GameMode = "local2p" | "vsAI" | "training" | "aivsai";

interface CharacterSelectProps {
  onLockIn: (
    p1: CharacterInfo,
    p2: CharacterInfo,
    mode: GameMode,
    p2Difficulty?: AIDifficulty,
    p1Difficulty?: AIDifficulty
  ) => void;
  onCancel: () => void;
  isTouch?: boolean;
}

/**
 * Portrait — loads a character's portrait.png from DemoAssets with a graceful
 * fallback to a bold first-letter design when the image hasn't been uploaded
 * yet or fails to load. The image fades in on top of the fallback letter
 * when it arrives, so there's no layout shift.
 */
function Portrait({ charId, displayName }: { charId: string; displayName: string }) {
  const [imgStatus, setImgStatus] = useState<"loading" | "loaded" | "error">("loading");
  const url = getPortraitUrl(charId);

  return (
    <>
      <span className="cs__card-fallback">{displayName.charAt(0)}</span>
      <img
        src={url}
        alt=""
        loading="lazy"
        onLoad={() => setImgStatus("loaded")}
        onError={() => setImgStatus("error")}
        className={`cs__card-img ${imgStatus === "loaded" ? "cs__card-img--visible" : ""}`}
      />
    </>
  );
}

export default function CharacterSelect({ onLockIn, onCancel, isTouch = false }: CharacterSelectProps) {
  const [characters, setCharacters] = useState<CharacterInfo[]>(getBundledCharacters());
  const [mode, setMode] = useState<GameMode>("local2p");
  const [difficulty, setDifficulty] = useState<AIDifficulty>("normal");
  const [p1Difficulty, setP1Difficulty] = useState<AIDifficulty>("normal");
  const [p1Index, setP1Index] = useState(0);
  const [p2Index, setP2Index] = useState(characters.length > 1 ? 1 : 0);
  const [p1Locked, setP1Locked] = useState(false);
  const [p2Locked, setP2Locked] = useState(false);
  const [downloadStates, setDownloadStates] = useState<Record<string, { status: string; progress?: number }>>({});

  // Fetch remote characters + check cache on mount
  useEffect(() => {
    (async () => {
      const allChars = await getAllCharacters(getBundledCharacters());
      setCharacters(allChars);
      const states: Record<string, { status: string; progress?: number }> = {};
      for (const char of allChars) {
        if (!char.bundled && char.files) {
          const cached = await isCharacterCached(char.id, char.files);
          states[char.id] = cached ? { status: "cached" } : { status: "idle" };
        }
      }
      setDownloadStates(states);
    })();
  }, []);

  const isCharReady = (char: CharacterInfo): boolean => {
    if (char.bundled) return true;
    return downloadStates[char.id]?.status === "cached";
  };

  const triggerDownload = useCallback(async (char: CharacterInfo) => {
    if (!char.cdnBase || !char.files) return;
    if (downloadStates[char.id]?.status === "downloading") return;
    if (downloadStates[char.id]?.status === "cached") return;
    setDownloadStates((p) => ({ ...p, [char.id]: { status: "downloading", progress: 0 } }));
    try {
      const filesToDownload = char.files.filter(f => f !== "common1.cns");
      const result = await downloadCharacter(char.id, char.cdnBase, filesToDownload, (p: DownloadProgress) => {
        setDownloadStates((prev) => ({ ...prev, [char.id]: { status: "downloading", progress: p.percent } }));
      });
      await cacheCharacter(char.id, result.files);
      setDownloadStates((p) => ({ ...p, [char.id]: { status: "cached" } }));
    } catch {
      setDownloadStates((p) => ({ ...p, [char.id]: { status: "error" } }));
    }
  }, [downloadStates]);

  // In VS AI / training / aivsai modes, P1 picks both characters. The "active selector" tracks
  // which character P1 is currently choosing: "p1" or "p2".
  const isSinglePlayer = mode === "vsAI" || mode === "training";
  const isWatchMode = mode === "aivsai";
  const isHumanSelectingBoth = isSinglePlayer || isWatchMode;
  const activeSelector = !p1Locked ? "p1" : (!p2Locked ? "p2" : "done");

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (isTouch) return;
      // Start match only if both locked AND both ready
      const p1Ready = isCharReady(characters[p1Index]);
      const p2Ready = isCharReady(characters[p2Index]);
      if (p1Locked && p2Locked && p1Ready && p2Ready && (e.code === "KeyU" || e.code === "Digit0" || e.code === "Enter") && !e.repeat) {
        e.preventDefault();
        onLockIn(characters[p1Index], characters[p2Index], mode, difficulty, p1Difficulty);
        return;
      }
      if (e.code === "Escape") {
        e.preventDefault();
        onCancel();
        return;
      }

      // Mode switching (only when no one is locked)
      if (!p1Locked && !p2Locked) {
        if (e.code === "Digit1" && !e.repeat) { setMode("local2p"); return; }
        if (e.code === "Digit2" && !e.repeat) { setMode("vsAI"); return; }
        if (e.code === "Digit3" && !e.repeat) { setMode("training"); return; }
        // Digit4 (aivsai) intentionally NOT bound — mode is hidden from UI.
        // Re-enable by uncommenting: if (e.code === "Digit4" && !e.repeat) { setMode("aivsai"); return; }
      }

      const navigate = (setter: React.Dispatch<React.SetStateAction<number>>, dir: number, vertical: boolean = false) => {
        e.preventDefault();
        const step = vertical ? 2 : 1;
        setter((i) => {
          if (dir < 0) return (i - step + characters.length) % characters.length;
          return (i + step) % characters.length;
        });
      };

      if (isHumanSelectingBoth) {
        // VS AI / training / aivsai: P1 picks both characters with WASD+U
        if (activeSelector === "p1") {
          if (e.code === "KeyA") navigate(setP1Index, -1);
          if (e.code === "KeyD") navigate(setP1Index, 1);
          if (e.code === "KeyW") navigate(setP1Index, -1, true);
          if (e.code === "KeyS") navigate(setP1Index, 1, true);
          if (e.code === "KeyU" && !e.repeat) {
            e.preventDefault();
            if (!isCharReady(characters[p1Index])) { triggerDownload(characters[p1Index]); return; }
            setP1Locked(true);
          }
        } else if (activeSelector === "p2") {
          if (e.code === "KeyA") navigate(setP2Index, -1);
          if (e.code === "KeyD") navigate(setP2Index, 1);
          if (e.code === "KeyW") navigate(setP2Index, -1, true);
          if (e.code === "KeyS") navigate(setP2Index, 1, true);
          if (e.code === "KeyU" && !e.repeat) {
            e.preventDefault();
            if (!isCharReady(characters[p2Index])) { triggerDownload(characters[p2Index]); return; }
            setP2Locked(true);
          }
          if (e.code === "Backspace" && !e.repeat) { e.preventDefault(); setP1Locked(false); }
        }
      } else {
        // Local 2P: P1 uses WASD+U, P2 uses Arrows+0
        if (!p1Locked) {
          if (e.code === "KeyA") navigate(setP1Index, -1);
          if (e.code === "KeyD") navigate(setP1Index, 1);
          if (e.code === "KeyW") navigate(setP1Index, -1, true);
          if (e.code === "KeyS") navigate(setP1Index, 1, true);
          if (e.code === "KeyU" && !e.repeat) {
            e.preventDefault();
            if (!isCharReady(characters[p1Index])) { triggerDownload(characters[p1Index]); return; }
            setP1Locked(true);
          }
        } else if (e.code === "KeyU" && !e.repeat && !p2Locked) {
          e.preventDefault(); setP1Locked(false);
        }
        if (!p2Locked) {
          if (e.code === "ArrowLeft") navigate(setP2Index, -1);
          if (e.code === "ArrowRight") navigate(setP2Index, 1);
          if (e.code === "ArrowUp") navigate(setP2Index, -1, true);
          if (e.code === "ArrowDown") navigate(setP2Index, 1, true);
          if (e.code === "Digit0" && !e.repeat) {
            e.preventDefault();
            if (!isCharReady(characters[p2Index])) { triggerDownload(characters[p2Index]); return; }
            setP2Locked(true);
          }
        } else if (e.code === "Digit0" && !e.repeat && !p1Locked) {
          e.preventDefault(); setP2Locked(false);
        }
      }
    },
    [p1Locked, p2Locked, characters, p1Index, p2Index, onLockIn, onCancel, isTouch, mode, difficulty, isSinglePlayer, activeSelector]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  // Reset locks when mode changes
  useEffect(() => {
    setP1Locked(false);
    setP2Locked(false);
  }, [mode]);

  const bothReady = p1Locked && p2Locked && isCharReady(characters[p1Index]) && isCharReady(characters[p2Index]);

  // The click handler for cards: in single-player, P1 selects for both
  const handleCardClick = (i: number) => {
    const char = characters[i];
    if (!isCharReady(char)) { triggerDownload(char); return; }
    if (isSinglePlayer) {
      if (activeSelector === "p1") { setP1Index(i); setP1Locked(true); }
      else if (activeSelector === "p2") { setP2Index(i); setP2Locked(true); }
    } else {
      if (!p1Locked) { setP1Index(i); setP1Locked(true); }
      else if (!p2Locked) { setP2Index(i); setP2Locked(true); }
    }
  };

  // P2 label depends on mode
  const p2Label = isWatchMode ? "AI2" : (mode === "training" ? "DUMMY" : (isSinglePlayer ? "AI" : "2P"));

  return (
    <div className="cs">
      <div className="cs__bg-grid" aria-hidden="true" />

      <h1 className="cs__title">
        <span className="cs__title-main">SELECT</span>
        <span className="cs__title-sub">YOUR FIGHTER</span>
      </h1>

      {/* Mode selector */}
      <div className="cs__mode-bar">
        <button
          className={`cs__mode-btn ${mode === "local2p" ? "cs__mode-btn--active" : ""}`}
          onClick={() => setMode("local2p")}
        >
          LOCAL 2P
        </button>
        <button
          className={`cs__mode-btn ${mode === "vsAI" ? "cs__mode-btn--active" : ""}`}
          onClick={() => setMode("vsAI")}
        >
          VS AI
        </button>
        <button
          className={`cs__mode-btn ${mode === "training" ? "cs__mode-btn--active" : ""}`}
          onClick={() => setMode("training")}
        >
          TRAINING
        </button>
        {/* AI VS AI button intentionally omitted — hidden from UI.
            Mode is still reachable via Digit4 keyboard shortcut if re-enabled. */}
      </div>

      {/* AI difficulty selector (VS AI or AI vs AI mode) */}
      {(mode === "vsAI" || mode === "aivsai") && (
        <div className="cs__difficulty-bar">
          <span className="cs__difficulty-label">{mode === "aivsai" ? "P2 (RIGHT) AI DIFFICULTY:" : "AI DIFFICULTY:"}</span>
          {(["easy", "normal", "hard"] as AIDifficulty[]).map((d) => (
            <button
              key={d}
              className={`cs__diff-btn ${difficulty === d ? "cs__diff-btn--active" : ""}`}
              onClick={() => setDifficulty(d)}
            >
              {d.toUpperCase()}
            </button>
          ))}
        </div>
      )}

      {/* P1 AI difficulty selector (only in AI vs AI mode) */}
      {mode === "aivsai" && (
        <div className="cs__difficulty-bar">
          <span className="cs__difficulty-label">P1 (LEFT) AI DIFFICULTY:</span>
          {(["easy", "normal", "hard"] as AIDifficulty[]).map((d) => (
            <button
              key={d}
              className={`cs__diff-btn ${p1Difficulty === d ? "cs__diff-btn--active" : ""}`}
              onClick={() => setP1Difficulty(d)}
            >
              {d.toUpperCase()}
            </button>
          ))}
        </div>
      )}

      <div className="cs__vs-bar">
        <div className={`cs__player-tag cs__player-tag--p1 ${p1Locked ? "cs__player-tag--locked" : ""}`}>
          <span className="cs__player-num">1P</span>
          <span className="cs__player-name">{characters[p1Index].displayName}</span>
          <span className="cs__player-state">{p1Locked ? "READY" : "SELECT"}</span>
        </div>

        <div className="cs__vs">VS</div>

        <div className={`cs__player-tag cs__player-tag--p2 ${p2Locked ? "cs__player-tag--locked" : ""}`}>
          <span className="cs__player-num">{p2Label}</span>
          <span className="cs__player-name">{characters[p2Index].displayName}</span>
          <span className="cs__player-state">{p2Locked ? "READY" : "SELECT"}</span>
        </div>
      </div>

      <div className="cs__grid">
        {characters.map((char, i) => {
          const isP1Here = i === p1Index;
          const isP2Here = i === p2Index;
          const dl = downloadStates[char.id];
          const isReady = char.bundled || dl?.status === "cached";
          const isDownloading = dl?.status === "downloading";
          const isError = dl?.status === "error";
          const isGreyed = !isReady;
          const isLockedCard = (p1Locked && isP1Here) || (p2Locked && isP2Here);
          return (
            <button
              key={char.id}
              className={[
                "cs__card",
                isP1Here ? "cs__card--p1" : "",
                isP2Here ? "cs__card--p2" : "",
                isP1Here && isP2Here ? "cs__card--both" : "",
                isReady ? "cs__card--ready" : "",
                isGreyed ? "cs__card--greyed" : "",
                isLockedCard ? "cs__card--locked" : "",
                UI_FLAGS.charSelectEntrance ? "cs__card--enter" : "",
              ].filter(Boolean).join(" ")}
              style={UI_FLAGS.charSelectEntrance ? { animationDelay: `${i * 60}ms` } : undefined}
              onClick={() => handleCardClick(i)}
            >
              {/* Portrait area (3:4 aspect ratio) */}
              <div className="cs__card-portrait">
                <Portrait charId={char.id} displayName={char.displayName} />

                {/* Dark overlay for non-downloaded characters */}
                {isGreyed && <div className="cs__card-overlay" />}

                {/* Download progress bar */}
                {isDownloading && (
                  <div className="cs__card-progress">
                    <div className="cs__card-progress-fill" style={{ width: `${dl.progress ?? 0}%` }} />
                  </div>
                )}

                {/* Lock / status icon (top-right corner) */}
                {isGreyed && !isDownloading && !isError && (
                  <div className="cs__card-lock" aria-hidden="true">🔒</div>
                )}
                {isError && (
                  <div className="cs__card-lock cs__card-lock--error" aria-hidden="true">↻</div>
                )}

                {/* Cursor badges (top corners) */}
                <div className="cs__card-cursors">
                  {isP1Here && (
                    <span className={`cs__cursor cs__cursor--p1 ${p1Locked ? "cs__cursor--locked" : ""}`}>
                      1P
                    </span>
                  )}
                  {isP2Here && (
                    <span className={`cs__cursor cs__cursor--p2 ${p2Locked ? "cs__cursor--locked" : ""}`}>
                      {p2Label}
                    </span>
                  )}
                </div>
              </div>

              {/* Bottom info: name (if ready) or download badge */}
              <div className="cs__card-info">
                {isReady ? (
                  <span className="cs__card-name">{char.displayName}</span>
                ) : isDownloading ? (
                  <span className="cs__card-badge cs__card-badge--downloading">
                    {dl.progress?.toFixed(0)}%
                  </span>
                ) : isError ? (
                  <span className="cs__card-badge cs__card-badge--error">TAP TO RETRY</span>
                ) : (
                  <span className="cs__card-badge cs__card-badge--idle">
                    DOWNLOAD · {char.sizeMB}MB
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="cs__footer">
        <div className="cs__controls-help">
          {isTouch ? (
            <span>Tap a character: P1 first, then {p2Label}</span>
          ) : isSinglePlayer ? (
            <span>
              1P: WASD + U {activeSelector === "p2" ? "(selecting AI character — Backspace to go back)" : ""}
            </span>
          ) : (
            <>
              <span className="cs__ctrl-p1">1P: WASD + U</span>
              <span className="cs__ctrl-p2">2P: ARROWS + 0</span>
            </>
          )}
        </div>
        <div className="cs__buttons">
          <button onClick={onCancel} className="cs__btn cs__btn--back">
            ◄ BACK
          </button>
          {bothReady && (
            <button
              onClick={() => onLockIn(characters[p1Index], characters[p2Index], mode, difficulty, p1Difficulty)}
              className="cs__btn cs__btn--fight"
            >
              FIGHT! ►
            </button>
          )}
          <button
            onClick={async () => {
              if (confirm("Clear all downloaded character files? They will re-download when selected.")) {
                await clearCharacterCache();
                const states: Record<string, { status: string }> = {};
                for (const char of characters) {
                  if (!char.bundled) states[char.id] = { status: "idle" };
                }
                setDownloadStates(states);
              }
            }}
            className="cs__btn cs__btn--back"
            title="Clear all downloaded character files from browser cache"
          >CLEAR CACHE</button>
        </div>
      </div>
    </div>
  );
}
