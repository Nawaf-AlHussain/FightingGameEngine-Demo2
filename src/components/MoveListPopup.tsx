"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getMoveList,
  CATEGORY_ORDER,
  NOTATION_LEGEND,
  P1_KEY_LEGEND,
  P2_KEY_LEGEND,
  type Move,
  type MoveCategory,
} from "@/lib/move-lists";
import type { CharacterInfo } from "@/lib/character-catalog";

interface MoveListPopupProps {
  /** P1 character info */
  p1Char: CharacterInfo;
  /** P2 character info */
  p2Char: CharacterInfo;
  /** Whether the popup is currently open */
  open: boolean;
  /** Called when the user wants to close the popup */
  onClose: () => void;
}

/**
 * MoveListPopup — full-screen overlay showing the move lists for both
 * characters. Closable via the X button, the Escape key, or clicking the
 * backdrop.
 *
 * Shows each move's notation (using arrows + button symbols) and the
 * actual keyboard keys for both P1 and P2.
 */
export default function MoveListPopup({ p1Char, p2Char, open, onClose }: MoveListPopupProps) {
  const [activeTab, setActiveTab] = useState<"p1" | "p2">("p1");

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.code === "Escape" && !e.repeat) {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    // Use capture phase so the game's Escape handler doesn't also fire
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [open, onClose]);

  // Reset to P1 tab whenever the popup is opened
  useEffect(() => {
    if (open) setActiveTab("p1");
  }, [open]);

  const activeChar = activeTab === "p1" ? p1Char : p2Char;
  const moveList = getMoveList(activeChar.id);

  if (!open) return null;

  return (
    <div
      className="movelist-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Move list"
    >
      <div
        className="movelist-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="movelist-modal__header">
          <h2 className="movelist-modal__title">Move List</h2>
          <div className="movelist-modal__tabs">
            <button
              className={`btn btn--small ${activeTab === "p1" ? "btn--primary" : "btn--secondary"}`}
              onClick={() => setActiveTab("p1")}
            >
              P1: {p1Char.displayName}
            </button>
            <button
              className={`btn btn--small ${activeTab === "p2" ? "btn--primary" : "btn--secondary"}`}
              onClick={() => setActiveTab("p2")}
            >
              P2: {p2Char.displayName}
            </button>
          </div>
          <button
            className="btn btn--secondary btn--small movelist-modal__close"
            onClick={onClose}
            aria-label="Close move list"
          >
            ✕ Close (Esc)
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="movelist-modal__body">
          {moveList ? (
            <>
              {/* Notation legend */}
              <section className="movelist-legend">
                <h3 className="movelist-legend__title">Notation</h3>
                <div className="movelist-legend__grid">
                  {NOTATION_LEGEND.map((entry) => (
                    <div key={entry.symbol} className="movelist-legend__item">
                      <span className="movelist-legend__symbol">{entry.symbol}</span>
                      <span className="movelist-legend__label">{entry.label}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* Key legend for the active player */}
              <section className="movelist-legend">
                <h3 className="movelist-legend__title">
                  {activeTab === "p1" ? "P1 Keys" : "P2 Keys"}
                </h3>
                <div className="movelist-legend__grid">
                  {(activeTab === "p1" ? P1_KEY_LEGEND : P2_KEY_LEGEND).map((entry) => (
                    <div key={entry.key} className="movelist-legend__item">
                      <kbd className="movelist-legend__key">{entry.key}</kbd>
                      <span className="movelist-legend__label">{entry.action}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* Move categories */}
              {CATEGORY_ORDER.map((cat) => {
                const moves = moveList.moves.filter((m) => m.category === cat.id);
                if (moves.length === 0) return null;
                return (
                  <MoveCategorySection
                    key={cat.id}
                    category={cat.id}
                    label={cat.label}
                    description={cat.description}
                    moves={moves}
                  />
                );
              })}
            </>
          ) : (
            <p>No move list available for {activeChar.displayName}.</p>
          )}
        </div>
      </div>
    </div>
  );
}

interface MoveCategorySectionProps {
  category: MoveCategory;
  label: string;
  description: string;
  moves: Move[];
}

function MoveCategorySection({ category, label, description, moves }: MoveCategorySectionProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <section className={`movelist-category movelist-category--${category}`}>
      <button
        className="movelist-category__header"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <span className="movelist-category__label">{label}</span>
        <span className="movelist-category__count">{moves.length} moves</span>
        <span className="movelist-category__chevron">{expanded ? "▾" : "▸"}</span>
      </button>
      {expanded && (
        <>
          <p className="movelist-category__desc">{description}</p>
          <table className="movelist-table">
            <thead>
              <tr>
                <th>Move</th>
                <th>Notation</th>
                <th>P1 Keys</th>
                <th>P2 Keys</th>
              </tr>
            </thead>
            <tbody>
              {moves.map((move) => (
                <tr key={move.name}>
                  <td className="movelist-table__name">
                    <div className="movelist-table__move-name">{move.name}</div>
                    {move.description && (
                      <div className="movelist-table__move-desc">{move.description}</div>
                    )}
                  </td>
                  <td className="movelist-table__notation">{move.notation}</td>
                  <td className="movelist-table__keys">{renderKeys(move.p1Keys)}</td>
                  <td className="movelist-table__keys">{renderKeys(move.p2Keys)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}

/**
 * Render a key sequence string like "S D+D K" as styled <kbd> elements.
 * "+" between keys means simultaneous (shown without space).
 * Space between groups is a sequence step.
 */
function renderKeys(seq: string): React.ReactNode {
  // Tokenize: split on whitespace, but keep "+" joined tokens together
  const tokens: string[] = [];
  let current = "";
  for (const ch of seq) {
    if (ch === " ") {
      if (current) tokens.push(current);
      current = "";
    } else if (ch === "+") {
      // "+" joins — push current and start a "simultaneous" group
      if (current) tokens.push(current);
      current = "+";
    } else {
      current += ch;
    }
  }
  if (current) tokens.push(current);

  return (
    <span className="movelist-keys">
      {tokens.map((tok, i) => {
        if (tok === "+") {
          return (
            <span key={`p${i}`} className="movelist-keys__plus">+</span>
          );
        }
        // Strip "(hold)" suffix for the key label but keep it as a hint
        const holdMatch = tok.match(/^(.+?)\(hold\)$/);
        const keyLabel = holdMatch ? holdMatch[1] : tok;
        const isHold = !!holdMatch;
        return (
          <span key={i} className="movelist-keys__step">
            <kbd className={isHold ? "movelist-keys__key movelist-keys__key--hold" : "movelist-keys__key"}>
              {keyLabel}
            </kbd>
            {isHold && <span className="movelist-keys__hint">(hold)</span>}
          </span>
        );
      })}
    </span>
  );
}
