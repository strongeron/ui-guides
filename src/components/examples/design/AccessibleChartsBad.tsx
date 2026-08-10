import { useId, useState } from 'react';

const data = [
  { label: 'Active', value: 45, swatch: 'bg-green-500' },
  { label: 'Pending', value: 30, swatch: 'bg-red-500' },
  { label: 'Inactive', value: 25, swatch: 'bg-yellow-500' },
];

/**
 * Colour-vision simulation matrices (sRGB). Rendering the chart through one of these
 * is the only honest way to show that a red/green palette collapses — describing it
 * in a caption asks the reader to take it on faith.
 */
const MODES = [
  { id: 'none', label: 'Typical vision', matrix: null },
  {
    id: 'protanopia',
    label: 'Protanopia (no red cones)',
    matrix: '0.567 0.433 0 0 0  0.558 0.442 0 0 0  0 0.242 0.758 0 0  0 0 0 1 0',
  },
  {
    id: 'deuteranopia',
    label: 'Deuteranopia (no green cones)',
    matrix: '0.625 0.375 0 0 0  0.7 0.3 0 0 0  0 0.3 0.7 0 0  0 0 0 1 0',
  },
  {
    id: 'tritanopia',
    label: 'Tritanopia (no blue cones)',
    matrix: '0.95 0.05 0 0 0  0 0.433 0.567 0 0  0 0.475 0.525 0 0  0 0 0 1 0',
  },
  {
    id: 'achromatopsia',
    label: 'Achromatopsia (greyscale)',
    matrix: '0.299 0.587 0.114 0 0  0.299 0.587 0.114 0 0  0.299 0.587 0.114 0 0  0 0 0 1 0',
  },
];

export function AccessibleChartsBad() {
  const [mode, setMode] = useState('none');
  // useId emits colons, which CSS cannot carry through `filter: url(#...)`.
  const uid = useId().replace(/:/g, '');
  const selectId = `${uid}-mode`;
  const active = MODES.find((m) => m.id === mode);

  return (
    <div className="w-full max-w-sm space-y-3">
      <svg aria-hidden="true" style={{ position: 'absolute', width: 0, height: 0 }}>
        <defs>
          {MODES.map(
            (m) =>
              m.matrix && (
                <filter key={m.id} id={`${uid}-${m.id}`} colorInterpolationFilters="sRGB">
                  <feColorMatrix type="matrix" values={m.matrix} />
                </filter>
              )
          )}
        </defs>
      </svg>

      <div className="space-y-1">
        <label htmlFor={selectId} className="block text-xs text-muted-foreground">
          Simulate colour vision
        </label>
        <select
          id={selectId}
          value={mode}
          onChange={(e) => setMode(e.target.value)}
          className="min-h-11 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring sm:min-h-9"
        >
          {MODES.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      <div
        className="bg-card border border-border rounded-lg p-4"
        style={{ filter: mode === 'none' ? undefined : `url(#${uid}-${mode})` }}
      >
        <h3 className="font-semibold mb-3">User Status</h3>
        <div className="flex h-4 rounded-full overflow-hidden mb-4">
          {data.map((item) => (
            <div key={item.label} className={item.swatch} style={{ width: `${item.value}%` }} />
          ))}
        </div>
        <div className="flex gap-4">
          {data.map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-sm ${item.swatch}`} />
              <span className="text-xs">{item.value}%</span>
            </div>
          ))}
        </div>
      </div>

      <p aria-live="polite" className="text-xs text-muted-foreground">
        {mode === 'none'
          ? 'Three clearly different colours — to a trichromat.'
          : `${active?.label}: the segments converge, and nothing but colour tells them apart.`}
      </p>

      <p className="text-xs text-error">
        Colour is the only channel: switch the simulation to deuteranopia and the chart stops
        answering which slice is which
      </p>
    </div>
  );
}
