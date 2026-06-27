'use client';

import { useCallback, useRef, useState } from 'react';

const CONFETTI = ['⚽', '🏆', '🎉', '😎', '🥅', '🔥', '⭐', '🏅'];
const TRIGGER_CLICKS = 5;

type Burst = { id: number; pieces: { left: number; emoji: string; delay: number; dur: number }[] };

export default function LogoEasterEgg() {
  const [bursts, setBursts] = useState<Burst[]>([]);
  const clicks = useRef(0);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const burstId = useRef(0);

  const fire = useCallback(() => {
    const id = burstId.current++;
    const pieces = Array.from({ length: 26 }, () => ({
      left: Math.random() * 100,
      emoji: CONFETTI[Math.floor(Math.random() * CONFETTI.length)],
      delay: Math.random() * 0.25,
      dur: 1.6 + Math.random() * 1.2,
    }));
    setBursts((b) => [...b, { id, pieces }]);
    setTimeout(() => setBursts((b) => b.filter((x) => x.id !== id)), 3200);
  }, []);

  const onClick = useCallback(() => {
    clicks.current += 1;
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => {
      clicks.current = 0;
    }, 1500);
    if (clicks.current >= TRIGGER_CLICKS) {
      clicks.current = 0;
      fire();
    }
  }, [fire]);

  return (
    <>
      <button
        type="button"
        className="header-logo logo-egg"
        onClick={onClick}
        title="WC 2026"
        aria-label="World Cup 2026 Pool"
      >
        <svg
          className="logo-trophy"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M6 4h12v4a6 6 0 0 1-12 0V4Z" />
          <path d="M6 6H4a2 2 0 0 0 2 2" />
          <path d="M18 6h2a2 2 0 0 1-2 2" />
          <path d="M12 14v3" />
          <path d="M9 20h6" />
          <path d="M10 17h4l-.5 3h-3l-.5-3Z" />
        </svg>
        <span className="logo-text">WC</span>
      </button>
      {bursts.length > 0 && (
        <div className="confetti-layer" aria-hidden>
          {bursts.flatMap((b) =>
            b.pieces.map((p, i) => (
              <span
                key={`${b.id}-${i}`}
                className="confetti-piece"
                style={{
                  left: `${p.left}%`,
                  animationDelay: `${p.delay}s`,
                  animationDuration: `${p.dur}s`,
                }}
              >
                {p.emoji}
              </span>
            )),
          )}
        </div>
      )}
    </>
  );
}
