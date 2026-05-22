// Cutta — design tokens & shared primitives

const ACCENT_OPTIONS = [
  '#D6FF3A', // hi-vis cycling yellow-green
  '#FF6A2D', // flame
  '#7AE6FF', // ice
  '#F5F1E6', // paper
];

function buildTheme(accent = '#D6FF3A', unit = 'metric') {
  return {
    accent,
    accentInk: '#0a0a0b',
    accentDim: accent + '33',
    bg:        '#0a0a0b',
    bgSoft:    '#111113',
    surface:   '#17171a',
    surfaceHi: '#1f1f23',
    line:      'rgba(255,255,255,0.06)',
    lineStrong:'rgba(255,255,255,0.12)',
    text:      '#f4f4f5',
    textDim:   'rgba(244,244,245,0.55)',
    textFaint: 'rgba(244,244,245,0.32)',
    warn:      '#ff5b4a',
    unit,
  };
}

function Tappable({ onClick, children, style, disabled }) {
  const [down, setDown] = React.useState(false);
  return (
    <div
      onPointerDown={() => !disabled && setDown(true)}
      onPointerUp={() => setDown(false)}
      onPointerLeave={() => setDown(false)}
      onClick={() => !disabled && onClick && onClick()}
      style={{
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.4 : (down ? 0.7 : 1),
        transform: down ? 'scale(0.985)' : 'scale(1)',
        transition: 'transform 90ms ease, opacity 90ms ease',
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
        ...style,
      }}
    >{children}</div>
  );
}

function FuelBar({ pct, T, height = 4, color }) {
  const p = Math.max(0, Math.min(1, pct));
  const c = color || (p < 0.15 ? T.warn : T.accent);
  return (
    <div style={{
      position: 'relative',
      height, borderRadius: height,
      background: 'rgba(255,255,255,0.06)',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0,
        width: `${p * 100}%`,
        background: c,
        borderRadius: height,
        transition: 'width 320ms cubic-bezier(.2,.7,.2,1)',
        boxShadow: `0 0 8px ${c}66`,
      }} />
    </div>
  );
}

function BigNum({ value, color = '#f4f4f5', size = 144, weight = 250 }) {
  return (
    <div className="tnum" style={{
      fontSize: size, fontWeight: weight,
      lineHeight: 0.95, letterSpacing: -0.05 * size / 10,
      color, fontFeatureSettings: '"tnum","ss01"',
    }}>{value}</div>
  );
}

function Mono({ children, style }) {
  return <span style={{
    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
    fontSize: 11, letterSpacing: 0.08, textTransform: 'uppercase',
    ...style,
  }}>{children}</span>;
}

Object.assign(window, { ACCENT_OPTIONS, buildTheme, Tappable, FuelBar, BigNum, Mono });
