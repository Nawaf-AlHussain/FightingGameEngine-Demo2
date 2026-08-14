"use client";

/**
 * WipeTransition — 3-pane diagonal color wipe overlay for route transitions.
 *
 * Inspired by mezdev.xyz / Persona 5 menu transitions:
 *   - 3 solid-color panes (red, black, white) sweep left→right
 *   - Each pane is skewed -14deg (diagonal stripes)
 *   - Panes are staggered 60ms apart (white → black → red)
 *   - A white flash at the midpoint hides the content swap
 *   - Total duration: ~700ms per pane, content swaps at 340ms
 *
 * Usage:
 *   const { navigate } = useWipeNavigation();
 *   navigate("/local");  // triggers wipe, then routes after 340ms
 */

import { createContext, useContext, useCallback, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

interface WipeContextValue {
  /** Navigate to a route with the wipe transition. */
  navigate: (href: string) => void;
  /** Trigger the wipe without navigating (e.g., for same-page state changes). */
  triggerWipe: (onSwap?: () => void) => void;
}

const WipeContext = createContext<WipeContextValue | null>(null);

export function useWipeNavigation(): WipeContextValue {
  const ctx = useContext(WipeContext);
  if (!ctx) {
    // Fallback: if no provider, just use router directly
    throw new Error("useWipeNavigation must be used within <WipeTransitionProvider>");
  }
  return ctx;
}

export function WipeTransitionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const wipeRef = useRef<HTMLDivElement>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const animatingRef = useRef(false);

  const triggerWipe = useCallback((onSwap?: () => void) => {
    // Re-entrancy guard — ignore if already animating
    if (animatingRef.current) return;
    animatingRef.current = true;
    setIsAnimating(true);

    const el = wipeRef.current;
    if (!el) {
      // No element — just swap immediately
      onSwap?.();
      setTimeout(() => {
        animatingRef.current = false;
        setIsAnimating(false);
      }, 100);
      return;
    }

    // Restart trick: remove 'go', force reflow, re-add 'go'
    el.classList.remove("go");
    void el.offsetWidth;
    el.classList.add("go");

    // Swap content at 340ms (mid-cover, when flash is at peak)
    setTimeout(() => {
      onSwap?.();
    }, 340);

    // Release lock at 720ms
    setTimeout(() => {
      animatingRef.current = false;
      setIsAnimating(false);
      // Remove 'go' class so it's ready for next trigger
      el.classList.remove("go");
    }, 720);
  }, []);

  const navigate = useCallback((href: string) => {
    triggerWipe(() => {
      router.push(href);
    });
  }, [router, triggerWipe]);

  return (
    <WipeContext.Provider value={{ navigate, triggerWipe }}>
      {children}
      <div
        ref={wipeRef}
        id="wipe"
        aria-hidden="true"
        style={{ pointerEvents: isAnimating ? "auto" : "none" }}
      >
        <div className="pane p3" />
        <div className="pane p2" />
        <div className="pane p1" />
        <div className="flash" />
      </div>
    </WipeContext.Provider>
  );
}
