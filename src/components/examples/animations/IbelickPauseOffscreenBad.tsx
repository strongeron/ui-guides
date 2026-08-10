import { useState, useEffect, useRef } from 'react';
import { useMediaQuery } from '@/hooks/useMediaQuery';

const TICK_MS = 250;

export function IbelickPauseOffscreenBad() {
  const cardRef = useRef<HTMLDivElement>(null);
  const spinnerRowRef = useRef<HTMLDivElement>(null);
  const [spinnerVisible, setSpinnerVisible] = useState(true);
  const [cardOnScreen, setCardOnScreen] = useState(true);
  const [runtimeMs, setRuntimeMs] = useState(0);
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');

  // Two observers, and only one of them is part of the anti-pattern being shown.
  // `spinnerVisible` merely labels the readout — nothing about it stops the animation,
  // which is the whole point. `cardOnScreen` is a host-level courtesy: this demo lives
  // on a real page, and leaving a deliberately-wasteful loop running after the reader has
  // scrolled the entire rule away would inflict the very cost the rule is warning about.
  useEffect(() => {
    const spinnerObserver = new IntersectionObserver(
      ([entry]) => setSpinnerVisible(entry.isIntersecting),
      { threshold: 0.1 }
    );
    const cardObserver = new IntersectionObserver(
      ([entry]) => setCardOnScreen(entry.isIntersecting),
      { threshold: 0 }
    );

    if (spinnerRowRef.current) spinnerObserver.observe(spinnerRowRef.current);
    if (cardRef.current) cardObserver.observe(cardRef.current);

    return () => {
      spinnerObserver.disconnect();
      cardObserver.disconnect();
    };
  }, []);

  // Note what is NOT in this dependency list: `spinnerVisible`. The animation keeps
  // running, and the runtime keeps climbing, while the spinner sits scrolled out of view.
  useEffect(() => {
    if (!cardOnScreen || reduced) return;

    const id = setInterval(() => setRuntimeMs((ms) => ms + TICK_MS), TICK_MS);
    return () => clearInterval(id);
  }, [cardOnScreen, reduced]);

  return (
    <div ref={cardRef} className="space-y-3">
      <div className="h-44 overflow-y-auto overscroll-contain rounded-lg border border-border bg-background p-3 text-xs">
        <p className="mb-3 text-muted-foreground">Scroll this panel past the spinner ↓</p>
        <div ref={spinnerRowRef} className="flex items-center gap-3 rounded-md bg-muted p-4">
          <div
            className="pause-demo-bad size-8 shrink-0 border-4 border-primary border-t-transparent rounded-full"
            style={{ animationPlayState: cardOnScreen ? 'running' : 'paused' }}
          />
          <span className="text-sm">Loading data...</span>
        </div>
        <div className="h-56" />
        <p className="text-muted-foreground">Out of view — and the runtime below is still climbing.</p>
      </div>

      <style>{`
        .pause-demo-bad { animation: pause-demo-bad-spin 1s linear infinite; }
        @keyframes pause-demo-bad-spin { to { transform: rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) {
          .pause-demo-bad { animation: none; }
        }
      `}</style>

      <div className="flex items-center justify-between gap-2 text-xs">
        <span>
          Animation runtime:{' '}
          <span className="font-mono tabular-nums">{(runtimeMs / 1000).toFixed(1)}s</span>
        </span>
        <span
          className={
            spinnerVisible || reduced
              ? 'rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground'
              : 'rounded-full bg-destructive/15 px-2 py-0.5 font-medium text-destructive'
          }
        >
          {reduced
            ? 'stopped (reduced motion)'
            : spinnerVisible
              ? 'running'
              : 'out of view — still animating'}
        </span>
      </div>

      <p className="text-xs text-error">
        Nothing observes visibility: scroll the spinner away and the runtime keeps climbing, burning
        cycles and battery for pixels nobody sees
      </p>
    </div>
  );
}
