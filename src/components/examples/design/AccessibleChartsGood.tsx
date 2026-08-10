import { useId, useState } from 'react';

type Texture = 'solid' | 'stripes' | 'dots';

const data: { label: string; value: number; swatch: string; texture: Texture }[] = [
  { label: 'Active', value: 45, swatch: 'bg-primary', texture: 'solid' },
  { label: 'Pending', value: 30, swatch: 'bg-warning', texture: 'stripes' },
  { label: 'Inactive', value: 25, swatch: 'bg-muted-foreground', texture: 'dots' },
];

/** Real textures, so a segment is identifiable without relying on its colour. */
function textureStyle(texture: Texture): React.CSSProperties | undefined {
  if (texture === 'stripes') {
    return {
      backgroundImage:
        'repeating-linear-gradient(45deg, rgba(0,0,0,0.4) 0 3px, transparent 3px 7px)',
    };
  }
  if (texture === 'dots') {
    return {
      backgroundImage: 'radial-gradient(rgba(0,0,0,0.45) 1.2px, transparent 1.4px)',
      backgroundSize: '6px 6px',
    };
  }
  return undefined;
}

/** Same simulation matrices as the Bad example, so the two can be compared honestly. */
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

export function AccessibleChartsGood() {
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
        <h3 className="font-semibold mb-3">User status</h3>
        <div className="flex h-5 rounded-full overflow-hidden mb-4">
          {data.map((item) => (
            <div
              key={item.label}
              className={item.swatch}
              style={{ width: `${item.value}%`, ...textureStyle(item.texture) }}
            />
          ))}
        </div>
        <div className="flex gap-4">
          {data.map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-sm ${item.swatch}`}
                style={textureStyle(item.texture)}
              />
              <span className="text-xs">
                {item.label} {item.value}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* The region has to carry the CHANGING part, or a screen reader user hears nothing
          when they operate the control. */}
      <p aria-live="polite" className="text-xs text-muted-foreground">
        {mode === 'none'
          ? 'Texture and label carry the data alongside colour.'
          : `${active?.label}: texture and label still separate the segments.`}
      </p>

      <p className="text-xs text-success">
        Each segment carries a distinct texture (solid, striped, dotted) as well as a colour and a
        text label, so the chart still reads in greyscale
      </p>
    </div>
  );
}
