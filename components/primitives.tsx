'use client';

import { useState, CSSProperties, ReactNode } from 'react';

export function Tappable({
  onClick,
  children,
  style,
  disabled,
}: {
  onClick?: () => void;
  children: ReactNode;
  style?: CSSProperties;
  disabled?: boolean;
}) {
  const [down, setDown] = useState(false);
  return (
    <div
      onPointerDown={() => !disabled && setDown(true)}
      onPointerUp={() => setDown(false)}
      onPointerLeave={() => setDown(false)}
      onClick={() => !disabled && onClick?.()}
      style={{
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.4 : down ? 0.7 : 1,
        transform: down ? 'scale(0.985)' : 'scale(1)',
        transition: 'transform 90ms ease, opacity 90ms ease',
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Mono({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <span style={{
      fontFamily: '"JetBrains Mono", ui-monospace, monospace',
      fontSize: 11,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      ...style,
    }}>
      {children}
    </span>
  );
}

export function BigNum({
  value,
  color = '#f4f4f5',
  size = 108,
  weight = 250,
}: {
  value: string;
  color?: string;
  size?: number;
  weight?: number;
}) {
  return (
    <div className="tnum" style={{
      fontSize: size,
      fontWeight: weight,
      lineHeight: 0.95,
      letterSpacing: -0.05 * size / 10,
      color,
      fontVariantNumeric: 'tabular-nums',
      fontFeatureSettings: '"tnum","ss01"',
    }}>
      {value}
    </div>
  );
}

export function FuelBar({
  pct,
  height = 4,
  color,
}: {
  pct: number;
  height?: number;
  color?: string;
}) {
  const p = Math.max(0, Math.min(1, pct));
  const c = color ?? (p < 0.15 ? 'var(--warn)' : 'var(--accent)');
  return (
    <div style={{
      position: 'relative',
      height,
      borderRadius: height,
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

export function Spinner({ color = 'var(--accent)' }: { color?: string }) {
  return (
    <div style={{
      width: 14, height: 14, borderRadius: '50%',
      border: `2px solid ${color}33`,
      borderTopColor: color,
      animation: 'cutta-spin 700ms linear infinite',
    }} />
  );
}
