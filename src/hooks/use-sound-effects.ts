"use client";

/**
 * useSoundEffects — generates short UI sound effects via the Web Audio API.
 *
 * No audio files needed — all sounds are synthesized at runtime.
 * Respects the UI_FLAGS.soundEffects flag and the browser's audio policy
 * (must wait for user gesture before AudioContext can start).
 *
 * Sounds:
 *   - click    — short high blip for button presses
 *   - select   — ascending two-tone for lock-ins / selections
 *   - confirm  — triumphant chord for match start / FIGHT!
 *   - back     — descending tone for cancel / back
 *   - ko       — low hit sound for KO
 */

import { useCallback, useRef, useEffect } from "react";
import { UI_FLAGS } from "@/lib/ui-flags";

type SoundName = "click" | "select" | "confirm" | "back" | "ko";

export function useSoundEffects() {
  const ctxRef = useRef<AudioContext | null>(null);

  // Lazily create the AudioContext on first use (after user gesture)
  const getCtx = useCallback((): AudioContext | null => {
    if (typeof window === "undefined") return null;
    if (!ctxRef.current) {
      try {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        ctxRef.current = new AC();
      } catch {
        return null;
      }
    }
    // Resume if suspended (browser autoplay policy)
    if (ctxRef.current.state === "suspended") {
      ctxRef.current.resume().catch(() => {});
    }
    return ctxRef.current;
  }, []);

  const play = useCallback((name: SoundName) => {
    if (!UI_FLAGS.soundEffects) return;
    const ctx = getCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.0001, now);

    // Sound definitions: array of { freq, start, duration, type, volume }
    const notes: { freq: number; start: number; dur: number; type: OscillatorType; vol: number }[] = ({
      click:   [{ freq: 1200, start: 0,    dur: 0.05, type: "square",   vol: 0.08 }],
      select:  [{ freq: 660,  start: 0,    dur: 0.08, type: "square",   vol: 0.1 },
                { freq: 880,  start: 0.06, dur: 0.08, type: "square",   vol: 0.1 }],
      confirm: [{ freq: 523,  start: 0,    dur: 0.12, type: "triangle", vol: 0.12 },
                { freq: 659,  start: 0.08, dur: 0.12, type: "triangle", vol: 0.12 },
                { freq: 784,  start: 0.16, dur: 0.18, type: "triangle", vol: 0.12 }],
      back:    [{ freq: 440,  start: 0,    dur: 0.1,  type: "square",   vol: 0.1 },
                { freq: 220,  start: 0.08, dur: 0.1,  type: "square",   vol: 0.1 }],
      ko:      [{ freq: 150,  start: 0,    dur: 0.3,  type: "sawtooth", vol: 0.15 },
                { freq: 80,   start: 0.1,  dur: 0.4,  type: "sawtooth", vol: 0.12 }],
    } as Record<SoundName, { freq: number; start: number; dur: number; type: OscillatorType; vol: number }[]>)[name] ?? [];

    notes.forEach((note) => {
      const osc = ctx.createOscillator();
      osc.type = note.type;
      osc.frequency.setValueAtTime(note.freq, now + note.start);

      const noteGain = ctx.createGain();
      noteGain.gain.setValueAtTime(0.0001, now + note.start);
      noteGain.gain.exponentialRampToValueAtTime(note.vol, now + note.start + 0.01);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, now + note.start + note.dur);

      osc.connect(noteGain);
      noteGain.connect(gain);
      osc.start(now + note.start);
      osc.stop(now + note.start + note.dur + 0.02);
    });
  }, [getCtx]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (ctxRef.current) {
        ctxRef.current.close().catch(() => {});
      }
    };
  }, []);

  return { play };
}
