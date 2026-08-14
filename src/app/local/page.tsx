"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import CharacterSelect, { type GameMode } from "@/components/CharacterSelect";
import type { AIDifficulty } from "@/hooks/use-ai-player";
import MoveListPopup from "@/components/MoveListPopup";
import TouchControls from "@/components/TouchControls";
import { useWipeNavigation } from "@/components/WipeTransition";
import { VsSplash, RoundAnnounce, KoFlash, ComboCounter, SuperFlash, PauseMenu, ResultsScreen } from "@/components/FightOverlays";
import { UI_FLAGS } from "@/lib/ui-flags";
import { useSoundEffects } from "@/hooks/use-sound-effects";
import { useLocalTwoPlayer } from "@/hooks/use-local-two-player";
import { useFightState } from "@/hooks/use-fight-state";
import type { CharacterInfo } from "@/lib/character-catalog";
import type { GameInstance } from "@/lib/wasm-loader";
import { isCharacterCached, getCachedCharacter, cacheCharacter } from "@/lib/character-cache";
import { downloadCharacter, type DownloadProgress } from "@/lib/character-downloader";
import { injectCharacterIntoWasm, isCharacterInWasm, injectStageIntoWasm, isStageInWasm } from "@/lib/wasm-asset-injector";
import { isStageCached, getCachedStage } from "@/lib/stage-cache";

// GameCanvas is dynamically loaded because it touches `window` (Emscripten)
// and must only render client-side.
const GameCanvas = dynamic(() => import("@/components/GameCanvas"), {
  ssr: false,
  loading: () => <div className="game-loading"><p>Loading engine...</p></div>,
});

type Screen = "select" | "stage-select" | "vs" | "fight";

/** Detect whether the device is touch-only (mobile/tablet, no mouse/trackpad).
 *
 *  Detection strategy (most-reliable signals first):
 *  1. User override in localStorage — if the user has manually set a mode,
 *     always respect it. This is the escape hatch for devices where the
 *     browser misreports pointer capabilities (some touchscreen laptops).
 *  2. Screen size — phones are narrow (< 900px). If the screen is wide,
 *     assume desktop regardless of pointer queries.
 *  3. any-pointer: fine — has a mouse/trackpad.
 *  4. ontouchstart + no fine pointer — touch device.
 *
 *  The screen-size check is the key fallback: your laptop's browser may
 *  misreport pointer capabilities, but it won't pretend to be a phone. */
function useIsTouchDevice(): boolean {
  const [isTouch, setIsTouch] = useState(false);
  useEffect(() => {
    const compute = () => {
      // 1. User override — highest priority
      const override = localStorage.getItem("input-mode-override");
      if (override === "desktop") return false;
      if (override === "touch") return true;

      // 2. Screen size — laptops/desktops are wide, phones aren't
      //    This is the most reliable signal when pointer queries lie.
      if (window.innerWidth >= 900) return false;

      // 3. Pointer queries — for actual phones/tablets
      const anyFine = window.matchMedia("(any-pointer: fine)").matches;
      if (anyFine) return false; // has a mouse/trackpad

      // 4. Touch capability without fine pointer = phone/tablet
      const maxTouchPoints = navigator.maxTouchPoints || 0;
      return maxTouchPoints > 0;
    };
    setIsTouch(compute());
  }, []);
  return isTouch;
}

/** Allow the user to manually override the touch/desktop detection.
 *  Stored in localStorage so it persists across sessions. */
function useInputModeOverride() {
  const [override, setOverride] = useState<"desktop" | "touch" | null>(null);
  useEffect(() => {
    setOverride(localStorage.getItem("input-mode-override") as "desktop" | "touch" | null);
  }, []);

  const set = (mode: "desktop" | "touch") => {
    localStorage.setItem("input-mode-override", mode);
    setOverride(mode);
    // Reload to apply the change cleanly
    window.location.reload();
  };

  const clear = () => {
    localStorage.removeItem("input-mode-override");
    setOverride(null);
    window.location.reload();
  };

  return { override, set, clear };
}

/** Debug hook — returns the raw media query values so we can see what
 *  the browser is actually reporting. Displayed in the diagnostic badge. */
function useTouchDebugInfo() {
  const [info, setInfo] = useState<string>("");
  useEffect(() => {
    const anyFine = window.matchMedia("(any-pointer: fine)").matches;
    const anyCoarse = window.matchMedia("(any-pointer: coarse)").matches;
    const pointerFine = window.matchMedia("(pointer: fine)").matches;
    const pointerCoarse = window.matchMedia("(pointer: coarse)").matches;
    const hoverHover = window.matchMedia("(hover: hover)").matches;
    const hoverNone = window.matchMedia("(hover: none)").matches;
    const ontouchstart = "ontouchstart" in window;
    const maxTouch = navigator.maxTouchPoints || 0;
    const w = window.innerWidth;
    setInfo(
      `any-fine:${anyFine} any-coarse:${anyCoarse} ` +
      `ptr-fine:${pointerFine} ptr-coarse:${pointerCoarse} ` +
      `hover:${hoverHover} hover-none:${hoverNone} ` +
      `ontouchstart:${ontouchstart} maxTouch:${maxTouch} ` +
      `width:${w}`
    );
  }, []);
  return info;
}

/** #7 — Ghost trail hook for health bars.
 *  Returns a value that slowly drains toward the target value, creating
 *  a "damage trail" effect. When the target drops, the ghost holds the
 *  previous value briefly then drains to meet it. */
function useGhostTrail(target: number, enabled: boolean): number {
  const [ghost, setGhost] = useState(target);
  const ghostRef = useRef(target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      ghostRef.current = target;
      setGhost(target);
      return;
    }
    // If target increased (healing), snap ghost immediately
    if (target >= ghostRef.current) {
      ghostRef.current = target;
      setGhost(target);
      return;
    }
    // Target decreased — animate ghost down over ~600ms
    const startGhost = ghostRef.current;
    const startTime = performance.now();
    const duration = 600;
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      // Ease-out
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startGhost + (target - startGhost) * eased;
      ghostRef.current = current;
      setGhost(current);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, enabled]);

  return enabled ? ghost : target;
}

export default function LocalPage() {
  const [screen, setScreen] = useState<Screen>("select");
  const [p1Char, setP1Char] = useState<CharacterInfo | null>(null);
  const [p2Char, setP2Char] = useState<CharacterInfo | null>(null);
  const [stage, setStage] = useState<{ id: string; displayName: string; def: string } | null>(null);
  const [game, setGame] = useState<GameInstance | null>(null);
  const [mode, setMode] = useState<GameMode>("local2p");
  const [aiDifficulty, setAiDifficulty] = useState<AIDifficulty>("normal");
  const [p1Difficulty, setP1Difficulty] = useState<AIDifficulty>("normal");
  const [matchKey, setMatchKey] = useState(0);
  const isTouch = useIsTouchDevice();
  const debugInfo = useTouchDebugInfo();
  const override = useInputModeOverride();
  const { navigate: wipeNavigate, triggerWipe } = useWipeNavigation();

  const handleLockIn = useCallback((
    p1: CharacterInfo,
    p2: CharacterInfo,
    m: GameMode,
    p2Diff?: AIDifficulty,
    p1Diff?: AIDifficulty
  ) => {
    setP1Char(p1);
    setP2Char(p2);
    setMode(m);
    if (p2Diff) setAiDifficulty(p2Diff);
    if (p1Diff) setP1Difficulty(p1Diff);
    setScreen("stage-select");
  }, []);

  const handleVsDone = useCallback(() => {
    setScreen("fight");
  }, []);

  /** Prepare a character for the WASM engine: check cache → download → inject.
   *  Filters out common1.cns (auto-injected from MUGEN 1.0 baseline) to avoid 404s.
   *  For .cmd files, uses GitHub raw directly (jsDelivr blocks .cmd with 403). */
  const prepareCharacter = useCallback(async (
    char: CharacterInfo,
    gameInstance: GameInstance | null
  ): Promise<boolean> => {
    console.info(`[prepareCharacter] called for ${char.id} (bundled=${char.bundled}, gameInstance=${gameInstance ? "yes" : "no"})`);
    if (char.bundled) return true;
    if (!char.cdnBase || !char.files) return false;

    const alreadyInWasm = !!(gameInstance && isCharacterInWasm(gameInstance, char.id));

    if (!alreadyInWasm) {
      // Filter out common1.cns — it's auto-injected from the MUGEN 1.0 baseline
      // (served at /common1.cns) after character files are written into MEMFS.
      // This avoids 404 errors on both CDNs (the file doesn't exist in the assets repo).
      const filesToDownload = char.files.filter(f => f !== "common1.cns");

      const cached = await isCharacterCached(char.id, char.files);
      let files: Map<string, ArrayBuffer>;

      if (cached) {
        files = await getCachedCharacter(char.id);
      } else {
        const result = await downloadCharacter(
          char.id, char.cdnBase, filesToDownload,
          (_progress: DownloadProgress) => {}
        );
        files = result.files;
        await cacheCharacter(char.id, files);
      }

      // Inject into WASM MEMFS
      if (gameInstance) {
        const success = await injectCharacterIntoWasm(gameInstance, char.id, files);
        if (!success) return false;
      }
    } else {
      console.info(`[prepareCharacter] ${char.id} already in WASM — skipping download/inject`);
    }

    // ALWAYS (re-)inject the MUGEN 1.0 common1.cns for non-bundled characters.
    //
    // WHY ALWAYS (not just when missing):
    // If the user previously played this character in the same WASM session
    // using an older build of the app (which copied Songoku's common1.cns
    // as the fallback), the character's MEMFS folder already contains
    // Songoku's broken common1.cns. That copy has a ChangeState to state
    // 9000 (Recovery Roll) inside state 5120 (GetUp) gated by Var(0)=1.
    // Characters like Piccolo Daimaoh don't define state 9000, so they
    // freeze in LieDown forever. The `analyzePath(...).exists` guard would
    // see the stale file and skip injection — leaving the character broken.
    // By always overwriting, we guarantee the correct MUGEN 1.0 baseline
    // is in place for every match.
    //
    // WHY THIS IS SAFE:
    // No downloaded character in the assets repo ships its own common1.cns
    // (verified: all return HTTP 404). The manifest lists common1.cns for
    // every character, but the file is absent — it's filtered out of the
    // download and replaced by this baseline. Bundled characters (Songoku,
    // Vegeta) return early above and never reach this code.
    //
    // WHY MUGEN 1.0 BASELINE (not Songoku's):
    // CHOUJIN characters were built against the stock MUGEN 1.0 data/common1.cns.
    // Its state 5120 goes directly to state 0 (Stand) — no state 9000 reference.
    if (gameInstance) {
      const FS = (gameInstance.Module as unknown as {
        FS?: {
          analyzePath: (path: string) => { exists: boolean };
          writeFile: (path: string, data: Uint8Array | ArrayBuffer) => void;
        };
      }).FS;

      if (FS) {
        const commonPath = `/chars/${char.id}/common1.cns`;
        try {
          console.info(`[common1] fetching /common1.cns for ${char.id}...`);
          const resp = await fetch("/common1.cns", { cache: "no-cache" });
          if (!resp.ok) {
            console.warn(`[common1] fetch failed: HTTP ${resp.status} ${resp.statusText}`);
          } else {
            const buf = await resp.arrayBuffer();
            FS.writeFile(commonPath, new Uint8Array(buf));
            const verify = FS.analyzePath(commonPath);
            console.info(
              `[common1] injected MUGEN 1.0 common1.cns for ${char.id}: ` +
              `${buf.byteLength} bytes, exists=${verify.exists}`
            );
          }
        } catch (e) {
          console.warn(`[common1] injection failed for ${char.id}:`, e);
        }
      }
    }

    return true;
  }, []);

  /** Called by GameCanvas AFTER engine ready, BEFORE startDirectMatch.
   *  Injects already-downloaded characters AND stage into WASM MEMFS. */
  const handleBeforeStart = useCallback(async (gameInstance: GameInstance) => {
    if (!p1Char || !p2Char) return;
    const p1Ok = await prepareCharacter(p1Char, gameInstance);
    if (!p1Ok) throw new Error(`Failed to prepare ${p1Char.displayName}`);
    const p2Ok = await prepareCharacter(p2Char, gameInstance);
    if (!p2Ok) throw new Error(`Failed to prepare ${p2Char.displayName}`);

    // Inject stage if it's not bundled
    if (stage && stage.id !== "uiu_campus_low") {
      const stageDef = stage.def;
      if (!isStageInWasm(gameInstance, stageDef)) {
        const cached = await isStageCached(stage.id, [stageDef]);
        if (cached) {
          const files = await getCachedStage(stage.id);
          await injectStageIntoWasm(gameInstance, stage.id, files);
        }
      }
    }
  }, [p1Char, p2Char, stage, prepareCharacter]);

  const handleCancel = useCallback(() => {
    wipeNavigate("/lobby");
  }, [wipeNavigate]);

  const handleExitMatch = useCallback(() => {
    // The WASM engine's main loop (emscripten_set_main_loop) runs
    // independently of React and cannot be stopped from JS without
    // reloading the page. Unmounting GameCanvas hides the canvas, but
    // the SDL2 render loop + audio keep running in the background.
    // Force a full page reload to tear everything down cleanly.
    //
    // NOTE: We do NOT use the wipe transition here. The wipe has a
    // re-entrancy guard that silently ignores calls if a wipe is already
    // animating — which would prevent the reload from ever happening.
    // Reliability is more important than a pretty transition for exit.
    window.location.href = "/local";
  }, []);

  if (screen === "select") {
    return (
      <main className="local-page">
        <CharacterSelect onLockIn={handleLockIn} onCancel={handleCancel} isTouch={isTouch} />
        <InputModePanel isTouch={isTouch} override={override} debugInfo={debugInfo} />
        <footer className="footer-credit">Made by Nawaf Al Hussain</footer>
      </main>
    );
  }

  if (screen === "stage-select" && p1Char && p2Char) {
    return (
      <main className="local-page">
        <StageSelect
          onSelect={(s) => {
            setStage(s);
            setScreen(UI_FLAGS.vsSplashScreen ? "vs" : "fight");
          }}
          onCancel={() => setScreen("select")}
        />
        <InputModePanel isTouch={isTouch} override={override} debugInfo={debugInfo} />
        <footer className="footer-credit">Made by Nawaf Al Hussain</footer>
      </main>
    );
  }

  if (screen === "vs" && p1Char && p2Char) {
    return (
      <main className="local-page local-page--vs">
        <VsSplash p1Char={p1Char} p2Char={p2Char} onDone={handleVsDone} />
        <InputModePanel isTouch={isTouch} override={override} debugInfo={debugInfo} />
        <footer className="footer-credit">Made by Nawaf Al Hussain</footer>
      </main>
    );
  }

  return (
    <main className={`local-page local-page--fight ${isTouch ? "local-page--touch" : ""}`}>
      {/* Portrait-only overlay: asks the user to rotate to landscape */}
      {isTouch && <RotateOverlay />}
      <FightScreen
        p1Char={p1Char!}
        p2Char={p2Char!}
        stageDef={stage ? stage.def : "uiu_campus_low.def"}
        onGameReady={setGame}
        onExit={handleExitMatch}
        game={game}
        isTouch={isTouch}
        mode={mode}
        aiDifficulty={aiDifficulty}
        p1Difficulty={p1Difficulty}
        matchKey={matchKey}
        onRematch={() => setMatchKey(k => k + 1)}
        onBeforeStart={handleBeforeStart}
      />
      <InputModePanel isTouch={isTouch} override={override} debugInfo={debugInfo} />
      <footer className="footer-credit">Made by Nawaf Al Hussain</footer>
    </main>
  );
}

/** Full-screen overlay shown on touch devices in portrait orientation. */
function RotateOverlay() {
  // CSS shows this only in @media (orientation: portrait) — no JS needed.
  return (
    <div className="rotate-overlay" aria-hidden="true">
      <div className="rotate-overlay__icon">⟳</div>
      <div className="rotate-overlay__text">Rotate your device</div>
      <div className="rotate-overlay__sub">This game is best played in landscape</div>
    </div>
  );
}

interface InputModePanelProps {
  isTouch: boolean;
  override: { override: "desktop" | "touch" | null; set: (m: "desktop" | "touch") => void; clear: () => void };
  debugInfo: string;
}

/** A small panel (bottom-left) that shows the current input mode and lets
 *  the user manually override the detection. This is the escape hatch for
 *  devices where the browser misreports pointer capabilities. */
function InputModePanel({ isTouch, override, debugInfo }: InputModePanelProps) {
  const [expanded, setExpanded] = useState(false);
  const currentMode = override.override ?? (isTouch ? "touch (auto)" : "desktop (auto)");

  return (
    <div className="input-mode-panel">
      <button
        className="input-mode-panel__toggle"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? "▼" : "▲"} Input: {currentMode}
      </button>
      {expanded && (
        <div className="input-mode-panel__body">
          <div className="input-mode-panel__row">
            <button
              className={`input-mode-btn ${!isTouch && !override.override ? "input-mode-btn--active" : ""}`}
              onClick={() => override.set("desktop")}
            >
              Desktop (keyboard)
            </button>
            <button
              className={`input-mode-btn ${isTouch && !override.override ? "input-mode-btn--active" : ""}`}
              onClick={() => override.set("touch")}
            >
              Touch (mobile)
            </button>
            {override.override && (
              <button className="input-mode-btn input-mode-btn--clear" onClick={override.clear}>
                Auto
              </button>
            )}
          </div>
          <div className="input-mode-panel__debug">{debugInfo || "loading..."}</div>
        </div>
      )}
    </div>
  );
}

// === Stage Select ===

interface StageInfo {
  id: string;
  displayName: string;
  def: string;
}

const BUNDLED_STAGES: StageInfo[] = [
  { id: "uiu_campus_low", displayName: "UIU Campus Low", def: "uiu_campus_low.def" },
];

interface StageSelectProps {
  onSelect: (stage: StageInfo) => void;
  onCancel: () => void;
}

function StageSelect({ onSelect, onCancel }: StageSelectProps) {
  const [stages, setStages] = useState<StageInfo[]>(BUNDLED_STAGES);
  const [downloadStates, setDownloadStates] = useState<Record<string, { status: string; progress?: number }>>({});

  useEffect(() => {
    (async () => {
      try {
        const resp = await fetch("https://raw.githubusercontent.com/FightingGameEngine/DemoAssets/main/manifest.json", { cache: "no-cache" });
        if (!resp.ok) return;
        const data = await resp.json();
        if (data?.stages) {
          const remote: StageInfo[] = data.stages.map((s: { id: string; displayName: string }) => ({
            id: s.id, displayName: s.displayName, def: `${s.id}.def`,
          }));
          setStages([...BUNDLED_STAGES, ...remote]);

          // Check cache for remote stages
          const states: Record<string, { status: string; progress?: number }> = {};
          for (const s of remote) {
            const manifestStage = data.stages.find((ms: { id: string }) => ms.id === s.id);
            if (manifestStage?.files) {
              const { isStageCached } = await import("@/lib/stage-cache");
              const cached = await isStageCached(s.id, manifestStage.files);
              states[s.id] = cached ? { status: "cached" } : { status: "idle" };
            }
          }
          setDownloadStates(states);
        }
      } catch {}
    })();
  }, []);

  const isStageReady = (s: StageInfo): boolean => {
    if (s.id === "uiu_campus_low") return true; // bundled
    return downloadStates[s.id]?.status === "cached";
  };

  const triggerStageDownload = useCallback(async (stageId: string, cdnBase: string, files: string[]) => {
    if (downloadStates[stageId]?.status === "downloading") return;
    if (downloadStates[stageId]?.status === "cached") return;
    setDownloadStates((p) => ({ ...p, [stageId]: { status: "downloading", progress: 0 } }));
    try {
      const { downloadStage } = await import("@/lib/stage-downloader");
      const { cacheStage } = await import("@/lib/stage-cache");
      const result = await downloadStage(stageId, cdnBase, files, (p) => {
        setDownloadStates((prev) => ({ ...prev, [stageId]: { status: "downloading", progress: p.percent } }));
      });
      await cacheStage(stageId, result.files);
      setDownloadStates((p) => ({ ...p, [stageId]: { status: "cached" } }));
    } catch {
      setDownloadStates((p) => ({ ...p, [stageId]: { status: "error" } }));
    }
  }, [downloadStates]);

  const handleStageClick = (s: StageInfo) => {
    if (!isStageReady(s)) {
      // Need to download — find manifest entry for cdnBase/files
      fetch("https://raw.githubusercontent.com/FightingGameEngine/DemoAssets/main/manifest.json", { cache: "no-cache" })
        .then(r => r.json())
        .then(data => {
          const ms = data?.stages?.find((st: { id: string }) => st.id === s.id);
          if (ms?.cdnBase && ms?.files) triggerStageDownload(s.id, ms.cdnBase, ms.files);
        })
        .catch(() => {});
      return;
    }
    onSelect(s);
  };

  // Keyboard: Enter to select first (bundled) stage, Esc to cancel
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === "Escape" && !e.repeat) { e.preventDefault(); onCancel(); }
      if (e.code === "Enter" && !e.repeat) { e.preventDefault(); handleStageClick(BUNDLED_STAGES[0]); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onCancel]); // eslint-disable-line

  return (
    <div className="ss">
      <h1 className="ss__title">
        <span className="ss__title-main">SELECT</span>
        <span className="ss__title-sub">STAGE</span>
      </h1>
      <div className="ss__grid">
        {stages.map((s, i) => {
          const dl = downloadStates[s.id];
          const ready = isStageReady(s);
          return (
            <button
              key={s.id}
              className={`ss__card ${!ready ? "ss__card--downloadable" : ""}`}
              style={{ animationDelay: `${i * 100}ms` }}
              onClick={() => handleStageClick(s)}
            >
              <div className="ss__card-portrait">
                <span className="ss__card-initial">{s.displayName.charAt(0)}</span>
              </div>
              <div className="ss__card-name">{s.displayName}</div>
              <div className="ss__card-desc">{s.id === "uiu_campus_low" ? "Bundled stage" : "Downloadable"}</div>
              {s.id !== "uiu_campus_low" && (
                <div className="ss__card-download">
                  {dl?.status === "cached" && <span className="ss__dl-badge ss__dl-badge--cached">✓ Ready</span>}
                  {dl?.status === "downloading" && (
                    <>
                      <span className="ss__dl-badge ss__dl-badge--downloading">{dl.progress?.toFixed(0)}%</span>
                      <div className="ss__dl-progress"><div className="ss__dl-progress-fill" style={{ width: `${dl.progress}%` }} /></div>
                    </>
                  )}
                  {dl?.status === "error" && <span className="ss__dl-badge ss__dl-badge--error">Failed</span>}
                  {(!dl || dl.status === "idle") && <span className="ss__dl-badge ss__dl-badge--idle">Click to download</span>}
                </div>
              )}
            </button>
          );
        })}
      </div>
      <div className="ss__footer">
        <div className="ss__controls-help">
          <span>Click a stage to select · Downloadable stages must be downloaded first</span>
        </div>
        <div className="ss__buttons">
          <button onClick={onCancel} className="ss__btn ss__btn--back">◄ BACK</button>
        </div>
      </div>
    </div>
  );
}

interface FightScreenProps {
  p1Char: CharacterInfo;
  p2Char: CharacterInfo;
  stageDef: string;
  game: GameInstance | null;
  onGameReady: (g: GameInstance) => void;
  onExit: () => void;
  isTouch: boolean;
  mode: GameMode;
  aiDifficulty: AIDifficulty;
  p1Difficulty: AIDifficulty;
  matchKey: number;
  onRematch: () => void;
  onBeforeStart?: (game: GameInstance) => Promise<void>;
}

function FightScreen({ p1Char, p2Char, stageDef, game, onGameReady, onExit, isTouch, mode, aiDifficulty, p1Difficulty, matchKey, onRematch, onBeforeStart }: FightScreenProps) {
  // In VS AI / training mode, P2 is AI or dummy — disable P2 keyboard pump.
  // In AI vs AI (watch) mode, both P1 and P2 are AI — disable both keyboard pumps.
  const isSinglePlayer = mode === "vsAI" || mode === "training";
  const isWatchMode = mode === "aivsai";
  const p1KeyboardEnabled = !isTouch && !isWatchMode;
  const p2KeyboardEnabled = !isTouch && !isSinglePlayer && !isWatchMode;

  // Map difficulty to engine AI level (1-8). Engine formula:
  // mDifficultyFactor = (level - 1) / 7.0
  //   easy (2)   → factor 0.14 → very easy
  //   normal (5) → factor 0.57 → moderate
  //   hard (8)   → factor 1.0  → max aggression
  const aiLevelMap: Record<AIDifficulty, number> = { easy: 2, normal: 5, hard: 8 };
  const p2AILevel = isSinglePlayer || isWatchMode ? aiLevelMap[aiDifficulty] : 0;
  const p1AILevel = isWatchMode ? aiLevelMap[p1Difficulty] : 0;
  const twoPlayer = useLocalTwoPlayer(game, p1KeyboardEnabled, p2KeyboardEnabled);
  const fightState = useFightState(game);
  const [moveListOpen, setMoveListOpen] = useState(false);
  const [paused, setPaused] = useState(false);

  // For training mode, feed empty input to P2 to keep it standing still.
  // (Engine CNS AI is NOT activated for P2 in training mode — p2AILevel=0 —
  // so without this pump, SDL keyboard leak would make the dummy twitch.)
  useEffect(() => {
    if (game && mode === "training") {
      const interval = setInterval(() => {
        try {
          game.Module.ccall('setExternalPlayerInput', 'void', ['number', 'string'], [1, '']);
        } catch (_) {}
      }, 16);
      return () => clearInterval(interval);
    }
  }, [game, mode]);
  const [showResults, setShowResults] = useState(false);
  const [matchStartTime, setMatchStartTime] = useState<number | null>(null);
  const [matchEndTime, setMatchEndTime] = useState<number | null>(null);

  const toggleMoveList = useCallback(() => setMoveListOpen((v) => !v), []);
  const closeMoveList = useCallback(() => setMoveListOpen(false), []);
  const togglePause = useCallback(() => setPaused((v) => !v), []);
  const closePause = useCallback(() => setPaused(false), []);
  const { play: playSfx } = useSoundEffects();

  // Results screen handlers
  const handleRematch = useCallback(() => {
    // Remount GameCanvas via key prop to get a fresh WASM instance.
    playSfx("select");
    onRematch();
  }, [playSfx, onRematch]);

  const handleChangeChar = useCallback(() => {
    // Go back to character select (just exit to /local which starts at select)
    playSfx("click");
    window.location.href = "/local";
  }, [playSfx]);

  // Track match start time when game becomes available
  useEffect(() => {
    if (game && matchStartTime === null) {
      setMatchStartTime(Date.now());
    }
  }, [game, matchStartTime]);

  // Show results when match ends
  useEffect(() => {
    if (fightState.phase === "match_over" && matchEndTime === null) {
      setMatchEndTime(Date.now());
      if (UI_FLAGS.resultsScreen) {
        const t = setTimeout(() => setShowResults(true), 2500); // after win splash
        return () => clearTimeout(t);
      }
    }
  }, [fightState.phase, matchEndTime]);

  useEffect(() => {
    if (game && !twoPlayer.isPumping && (p1KeyboardEnabled || p2KeyboardEnabled || isSinglePlayer)) {
      twoPlayer.start();
    }
  }, [game, twoPlayer, p1KeyboardEnabled, p2KeyboardEnabled]);

  // Escape: if move list open → close it; if paused → unpause; if results → ignore;
  // otherwise toggle pause (if pause menu enabled) or exit (if not)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === "Escape" && !e.repeat) {
        if (moveListOpen) return; // MoveListPopup handles its own Escape
        if (showResults) return;  // results screen has buttons
        e.preventDefault();
        if (paused) {
          setPaused(false);
        } else if (UI_FLAGS.pauseMenu) {
          setPaused(true);
        } else {
          onExit();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onExit, moveListOpen, paused, showResults]);

  const timerSeconds = Math.ceil(fightState.timerFrames / 60);

  // Health/power percentages — guard against NaN (lifeMax could be 0 before
  // the match fully loads, which would make the fill width NaN and invisible)
  const p1HealthPct = fightState.p1.lifeMax > 0 ? (fightState.p1.life / fightState.p1.lifeMax) * 100 : 100;
  const p2HealthPct = fightState.p2.lifeMax > 0 ? (fightState.p2.life / fightState.p2.lifeMax) * 100 : 100;
  const p1PowerPct = Math.min(100, (fightState.p1.power / 3000) * 100);
  const p2PowerPct = Math.min(100, (fightState.p2.power / 3000) * 100);

  // Ghost trail for health bars (#7) — tracks the previous health value and
  // slowly drains to the current value, creating a "damage trail" effect.
  const p1GhostPct = useGhostTrail(p1HealthPct, UI_FLAGS.healthGhostTrail);
  const p2GhostPct = useGhostTrail(p2HealthPct, UI_FLAGS.healthGhostTrail);

  return (
    <div className="fight">
      <div className="fight__hud">
        {/* P1 side (left) */}
        <div className="fhud__side fhud__side--p1">
          <div className="fhud__name-row">
            <span className="fhud__num">1P</span>
            <span className="fhud__name">{p1Char.displayName}</span>
          </div>
          <div className="fhud__health-row">
            <div className="fhud__rounds">
              <span className={`fhud__dot ${fightState.p1.roundsWon >= 1 ? "fhud__dot--win" : ""}`} />
              <span className={`fhud__dot ${fightState.p1.roundsWon >= 2 ? "fhud__dot--win" : ""}`} />
            </div>
            <div className="fhud__health fhud__health--p1">
              {UI_FLAGS.healthGhostTrail && (
                <div
                  className="fhud__health-ghost fhud__health-ghost--p1"
                  style={{ width: `${p1GhostPct}%` }}
                />
              )}
              <div
                className="fhud__health-fill fhud__health-fill--p1"
                style={{ width: `${p1HealthPct}%` }}
              />
              <div className="fhud__health-shine" />
            </div>
          </div>
          <div className="fhud__power fhud__power--p1">
            <div
              className={`fhud__power-fill fhud__power-fill--p1 ${UI_FLAGS.superFlash && p1PowerPct >= 100 ? "fhud__power-fill--ready" : ""}`}
              style={{ width: `${p1PowerPct}%` }}
            />
            <span className="fhud__power-label">POWER</span>
          </div>
        </div>

        {/* Center — timer + phase */}
        <div className="fhud__center">
          <div className="fhud__timer">{timerSeconds}</div>
          <div className="fhud__phase">
            {fightState.phase === "intro" && "READY?"}
            {fightState.phase === "fighting" && "FIGHT!"}
            {fightState.phase === "ko" && "K.O.!"}
            {fightState.phase === "round_over" && `${fightState.roundWinner === 0 ? "1P" : "2P"} WINS`}
            {fightState.phase === "match_over" && `${fightState.matchWinner === 0 ? "1P" : "2P"} WINS!`}
          </div>
          <div className="fhud__center-buttons">
            <button onClick={toggleMoveList} className="fhud__btn fhud__btn--moves">
              MOVES
            </button>
            <button onClick={onExit} className="fhud__btn fhud__btn--exit">
              EXIT
            </button>
          </div>
        </div>

        {/* P2 side (right) */}
        <div className="fhud__side fhud__side--p2">
          <div className="fhud__name-row">
            <span className="fhud__name">{p2Char.displayName}</span>
            <span className="fhud__num">{isWatchMode ? "AI2" : (mode === "training" ? "DUMMY" : (isSinglePlayer ? "AI" : "2P"))}</span>
          </div>
          <div className="fhud__health-row fhud__health-row--p2">
            <div className="fhud__health fhud__health--p2">
              {UI_FLAGS.healthGhostTrail && (
                <div
                  className="fhud__health-ghost fhud__health-ghost--p2"
                  style={{ width: `${p2GhostPct}%` }}
                />
              )}
              <div
                className="fhud__health-fill fhud__health-fill--p2"
                style={{ width: `${p2HealthPct}%` }}
              />
              <div className="fhud__health-shine" />
            </div>
            <div className="fhud__rounds fhud__rounds--p2">
              <span className={`fhud__dot ${fightState.p2.roundsWon >= 1 ? "fhud__dot--win" : ""}`} />
              <span className={`fhud__dot ${fightState.p2.roundsWon >= 2 ? "fhud__dot--win" : ""}`} />
            </div>
          </div>
          <div className="fhud__power fhud__power--p2">
            <div
              className={`fhud__power-fill fhud__power-fill--p2 ${UI_FLAGS.superFlash && p2PowerPct >= 100 ? "fhud__power-fill--ready" : ""}`}
              style={{ width: `${p2PowerPct}%` }}
            />
            <span className="fhud__power-label">POWER</span>
          </div>
        </div>
      </div>

      <div className="fight__canvas-wrap">
        <GameCanvas
          key={`match-${matchKey}`}
          onReady={onGameReady}
          onBeforeStart={onBeforeStart}
          p1Char={p1Char.id}
          p2Char={p2Char.id}
          stage={stageDef}
          p1AILevel={p1AILevel}
          p2AILevel={p2AILevel}
        />
        {isTouch && <TouchControls game={game} enabled={!!game} />}
        {isTouch && (
          <button
            onClick={onExit}
            className="fight__exit-touch"
            aria-label="Exit match"
          >
            ✕
          </button>
        )}
        {/* Round announcement overlay (#2) — shows ROUND N / FIGHT! */}
        {UI_FLAGS.roundAnnouncement && game && (
          <RoundAnnounce roundNumber={fightState.roundNumber} phase={fightState.phase} />
        )}
        {/* KO flash + win splash (#3) */}
        {UI_FLAGS.koFlashAndWinSplash && game && (
          <KoFlash
            phase={fightState.phase}
            roundWinner={fightState.roundWinner}
            matchWinner={fightState.matchWinner}
            p1Char={p1Char}
            p2Char={p2Char}
          />
        )}
        {/* Combo counter (#8) */}
        {UI_FLAGS.comboCounter && game && (
          <ComboCounter p1Life={fightState.p1.life} p2Life={fightState.p2.life} />
        )}
      </div>

      {!isTouch && (
        <div className="fight__controls-help">
          <div><strong>P1:</strong> WASD = move, U/I/O = punch, J/K/L = kick, 1 = start</div>
          <div><strong>P2:</strong> Arrows = move, 8/9/0 = punch, M/,/. = kick, 2 = start</div>
        </div>
      )}

      <MoveListPopup
        p1Char={p1Char}
        p2Char={p2Char}
        open={moveListOpen}
        onClose={closeMoveList}
      />

      {/* #12 — Pause menu */}
      {UI_FLAGS.pauseMenu && (
        <PauseMenu
          open={paused}
          onResume={closePause}
          onMoveList={() => { closePause(); setMoveListOpen(true); }}
          onExit={onExit}
        />
      )}

      {/* #13 — Results screen */}
      {UI_FLAGS.resultsScreen && showResults && matchStartTime && matchEndTime && (
        <ResultsScreen
          p1Char={p1Char}
          p2Char={p2Char}
          matchWinner={fightState.matchWinner}
          p1RoundsWon={fightState.p1.roundsWon}
          p2RoundsWon={fightState.p2.roundsWon}
          timeElapsed={Math.floor((matchEndTime - matchStartTime) / 1000)}
          onRematch={handleRematch}
          onChangeChar={handleChangeChar}
          onExit={onExit}
        />
      )}
    </div>
  );
}
