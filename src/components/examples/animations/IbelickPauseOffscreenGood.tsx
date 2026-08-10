import { useState, useEffect, useRef } from 'react';
import { useMediaQuery } from '@/hooks/useMediaQuery';

const TICK_MS = 250;

export function IbelickPauseOffscreenGood() {
  const spinnerRowRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(true);
  const [runtimeMs, setRuntimeMs] = useState(0);
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');

  // The root is the viewport, not the panel below. IntersectionObserver already clips a
  // target against every scrolling ancestor, so one viewport-rooted observer covers both
  // "scrolled out of the panel" and "the whole page scrolled past" — and the second case
  // is the one the rule is actually about. Rooting it to the panel would report the
  // spinner as fully visible while the reader is three screens further down.
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.1 }
    );

    if (spinnerRowRef.current) {
      observer.observe(spinnerRowRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // The meter reports how long the animation has actually run, so it may only advance
  // while the animation is running: on screen, and not suppressed by reduced motion.
  useEffect(() => {
    if (!isVisible || reduced) return;

    const id = setInterval(() => setRuntimeMs((ms) => ms + TICK_MS), TICK_MS);
    return () => clearInterval(id);
  }, [isVisible, reduced]);

  return (
    <div className="space-y-3">
      <div className="h-44 overflow-y-auto overscroll-contain rounded-lg border border-border bg-background p-3 text-xs">
        <p className="mb-3 text-muted-foreground">Scroll this panel — or the whole page — past the spinner ↓</p>
        <div ref={spinnerRowRef} className="flex items-center gap-3 rounded-md bg-muted p-4">
          <div
            className="pause-demo-good size-8 shrink-0 border-4 border-primary border-t-transparent rounded-full"
            style={{ animationPlayState: isVisible ? 'running' : 'paused' }}
          />
          <span className="text-sm">Loading data...</span>
        </div>
        <div className="h-56" />
        <p className="text-muted-foreground">Out of view — the runtime below has stopped advancing.</p>
      </div>

      {/* A CSS animation, so the spin is compositor-driven and a reduced-motion request
          can switch it off declaratively. `animation-play-state` is the toggle the rule
          names; no main-thread loop is involved. */}
      <style>{`
        .pause-demo-good { animation: pause-demo-good-spin 1s linear infinite; }
        @keyframes pause-demo-good-spin { to { transform: rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) {
          .pause-demo-good { animation: none; }
        }
      `}</style>

      <div className="flex items-center justify-between gap-2 text-xs">
        <span>
          Animation runtime:{' '}
          <span className="font-mono tabular-nums">{(runtimeMs / 1000).toFixed(1)}s</span>
        </span>
        <span
          className={
            isVisible && !reduced
              ? 'rounded-full bg-success/15 px-2 py-0.5 font-medium text-success'
              : 'rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground'
          }
        >
          {reduced ? 'stopped (reduced motion)' : isVisible ? 'running' : 'paused (out of view)'}
        </span>
      </div>

      <p className="text-xs text-success">
        IntersectionObserver pauses the animation the moment the spinner leaves the viewport, so the
        runtime freezes and resumes exactly where it stopped
      </p>
    </div>
  );
}
