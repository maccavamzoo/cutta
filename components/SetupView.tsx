'use client';

import { useState } from 'react';
import { Tappable, Mono } from './primitives';

type Profile = { weight: number; height: number; age: number; sex: 'm' | 'f' };

export default function SetupView() {
  const [profile, setProfile] = useState<Profile>({ weight: 74, height: 178, age: 32, sex: 'm' });
  const [focused, setFocused] = useState<'weight' | 'height' | 'age'>('weight');
  const [saving, setSaving] = useState(false);

  const bump = (delta: number) => {
    setProfile(p => ({ ...p, [focused]: Math.max(1, p[focused] + delta) }));
  };

  const save = async () => {
    setSaving(true);
    await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        weight_kg: profile.weight,
        height_cm: profile.height,
        age: profile.age,
        sex: profile.sex,
        unit: 'metric',
      }),
    });
    window.location.href = '/';
  };

  const Field = ({
    k, label, unit,
  }: {
    k: 'weight' | 'height' | 'age';
    label: string;
    unit: string;
  }) => {
    const active = focused === k;
    return (
      <Tappable
        onClick={() => setFocused(k)}
        style={{
          padding: '20px 22px',
          borderTop: '0.5px solid var(--line)',
          background: active ? 'var(--surface)' : 'transparent',
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        }}
      >
        <Mono style={{ color: active ? 'var(--accent)' : 'var(--text-dim)' }}>{label}</Mono>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span className="tnum" style={{ fontSize: 32, fontWeight: 400, letterSpacing: -0.5, color: 'var(--text)' }}>
            {profile[k]}
          </span>
          <span style={{ fontSize: 13, color: 'var(--text-dim)', fontFamily: '"JetBrains Mono", monospace' }}>{unit}</span>
        </div>
      </Tappable>
    );
  };

  return (
    <div style={{ height: '100svh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', color: 'var(--text)' }}>
      <div style={{ padding: '64px 22px 26px' }}>
        <Mono style={{ color: 'var(--accent)' }}>cutta · setup</Mono>
        <div style={{ fontSize: 32, fontWeight: 400, lineHeight: 1.1, marginTop: 14, letterSpacing: -0.6, maxWidth: 280 }}>
          Tell us about you.<br />
          <span style={{ color: 'var(--text-dim)' }}>That&apos;s it.</span>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        <Field k="weight" label="Weight" unit="kg" />
        <Field k="height" label="Height" unit="cm" />
        <Field k="age" label="Age" unit="yr" />

        <Tappable
          style={{
            padding: '20px 22px',
            borderTop: '0.5px solid var(--line)',
            borderBottom: '0.5px solid var(--line)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}
          onClick={() => setProfile(p => ({ ...p, sex: p.sex === 'm' ? 'f' : 'm' }))}
        >
          <Mono style={{ color: 'var(--text-dim)' }}>Sex</Mono>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['m', 'f'] as const).map(s => (
              <div key={s} style={{
                padding: '8px 18px', borderRadius: 100,
                background: profile.sex === s ? 'var(--accent)' : 'transparent',
                color: profile.sex === s ? 'var(--accent-ink)' : 'var(--text-dim)',
                border: profile.sex === s ? 'none' : '0.5px solid var(--line-strong)',
                fontSize: 14, fontWeight: 500, letterSpacing: 0.5, textTransform: 'uppercase',
              }}>{s}</div>
            ))}
          </div>
        </Tappable>

        <div style={{ padding: '24px 22px', display: 'flex', gap: 10 }}>
          {([-10, -1, +1, +10] as const).map(d => (
            <Tappable key={d} onClick={() => bump(d)} style={{
              flex: 1, padding: '14px 0', textAlign: 'center',
              background: 'var(--surface)', borderRadius: 14,
              fontFamily: '"JetBrains Mono", monospace', fontSize: 14,
              color: 'var(--text)', fontWeight: 500,
            }}>
              {d > 0 ? '+' : ''}{d}
            </Tappable>
          ))}
        </div>
      </div>

      <div style={{ padding: '0 22px 28px' }}>
        <Tappable
          onClick={save}
          disabled={saving}
          style={{
            background: 'var(--accent)', color: 'var(--accent-ink)',
            padding: '18px 0', borderRadius: 18,
            textAlign: 'center', fontSize: 16, fontWeight: 600, letterSpacing: 0.2,
          }}
        >
          {saving ? 'Saving…' : 'Start tracking'}
        </Tappable>
      </div>
    </div>
  );
}
