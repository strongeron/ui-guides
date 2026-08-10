import { useState } from 'react';

// Explicit OKLCH values, not theme tokens: the demo has to control the background
// hue itself, otherwise the "tint toward the background" claim cannot be shown.
const HUES = [
  { label: 'Blue', hue: 250 },
  { label: 'Green', hue: 150 },
  { label: 'Amber', hue: 70 },
];

export function HueConsistencyBad() {
  const [hue, setHue] = useState(250);

  return (
    <div className="w-full max-w-sm space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Background hue:</span>
        {HUES.map((option) => (
          <button
            key={option.hue}
            type="button"
            onClick={() => setHue(option.hue)}
            aria-pressed={hue === option.hue}
            className={`min-h-11 rounded-md px-3 py-1 text-xs transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring sm:min-h-8 ${
              hue === option.hue
                ? 'bg-foreground/10 font-medium text-foreground'
                : 'text-muted-foreground hover:bg-foreground/[0.06]'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="rounded-lg p-6" style={{ background: `oklch(0.62 0.15 ${hue})` }}>
        <div
          className="rounded-lg p-4"
          style={{
            background: 'oklch(0.99 0 0)',
            // Neutral black, whatever the plate underneath is doing.
            boxShadow: '0 1px 2px oklch(0 0 0 / 0.18), 0 8px 20px oklch(0 0 0 / 0.28)',
            border: '1px solid oklch(0 0 0 / 0.22)',
          }}
        >
          <h3 className="mb-1 font-semibold" style={{ color: 'oklch(0.28 0 0)' }}>
            Card Title
          </h3>
          <p className="text-sm" style={{ color: 'oklch(0.48 0 0)' }}>
            The gray shadow, border, and text sit on the surface instead of belonging to it.
          </p>
        </div>
      </div>

      <p className="text-xs text-error">
        A pure black shadow reads as dirt on a saturated plate — and it stays wrong when the
        background hue changes
      </p>
    </div>
  );
}
