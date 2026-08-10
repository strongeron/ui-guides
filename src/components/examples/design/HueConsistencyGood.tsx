import { useState } from 'react';

// Same explicit OKLCH plate as the Bad example, so the comparison is fair — only the
// shadow, border, and text hues differ.
const HUES = [
  { label: 'Blue', hue: 250 },
  { label: 'Green', hue: 150 },
  { label: 'Amber', hue: 70 },
];

export function HueConsistencyGood() {
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
            background: `oklch(0.99 0.006 ${hue})`,
            // Every neutral is carried to the plate's hue: dark enough to read as shadow,
            // chromatic enough to belong to the surface it sits on.
            boxShadow: `0 1px 2px oklch(0.3 0.09 ${hue} / 0.2), 0 8px 20px oklch(0.3 0.09 ${hue} / 0.3)`,
            border: `1px solid oklch(0.45 0.1 ${hue} / 0.22)`,
          }}
        >
          <h3 className="mb-1 font-semibold" style={{ color: `oklch(0.28 0.05 ${hue})` }}>
            Card Title
          </h3>
          <p className="text-sm" style={{ color: `oklch(0.48 0.04 ${hue})` }}>
            The shadow, border, and text all carry a trace of the background hue.
          </p>
        </div>
      </div>

      <p className="text-xs text-success">
        Shadow, border, and text share the plate's hue — switch the background and the whole card
        follows it
      </p>
    </div>
  );
}
