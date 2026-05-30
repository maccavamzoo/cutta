'use client';

import { useState, useEffect } from 'react';
import { Tappable, Mono, BigNum } from './primitives';
import { calcActivityCals } from '@/lib/maths';

type Intensity = 'easy' | 'steady' | 'hard';
type ActivityType = 'ride' | 'run' | 'other';

function Sheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { requestAnimationFrame(() => setMounted(true)); }, []);
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: mounted ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0)',
        transition: 'background 220ms ease',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        position: 'absolute', top: 0, bottom: 0,
        left: '50%', transform: mounted ? 'translateX(-50%)' : 'translateX(-50%) translateY(100%)',
        transition: 'transform 320ms cubic-bezier(.2,.7,.2,1)',
        width: '100%', maxWidth: 430,
      }}>
        {children}
      </div>
    </div>
  );
}

function DurationPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const hours = Math.floor(value / 60);
  const mins = value % 60;

  const btnStyle: React.CSSProperties = {
    width: 40, height: 40, borderRadius: 12,
    background: 'var(--surface)', border: '0.5px solid var(--line)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 20, fontWeight: 300, color: 'var(--text)', flexShrink: 0,
  };

  const adjustHours = (d: number) => {
    const h = Math.max(0, Math.min(12, hours + d));
    onChange(Math.max(5, h * 60 + mins));
  };

  const adjustMins = (d: number) => {
    const m = Math.max(0, Math.min(55, Math.round(mins / 5) * 5 + d));
    onChange(Math.max(5, hours * 60 + m));
  };

  return (
    <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Tappable onClick={() => adjustHours(-1)} style={btnStyle}>−</Tappable>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <span className="tnum" style={{ fontSize: 36, fontWeight: 300, color: 'var(--text)' }}>{hours}</span>
          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 14, color: 'var(--text-dim)', marginLeft: 4 }}>h</span>
        </div>
        <Tappable onClick={() => adjustHours(+1)} style={btnStyle}>+</Tappable>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Tappable onClick={() => adjustMins(-5)} style={btnStyle}>−</Tappable>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <span className="tnum" style={{ fontSize: 36, fontWeight: 300, color: 'var(--text)' }}>{String(mins).padStart(2, '0')}</span>
          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 14, color: 'var(--text-dim)', marginLeft: 4 }}>m</span>
        </div>
        <Tappable onClick={() => adjustMins(+5)} style={btnStyle}>+</Tappable>
      </div>
    </div>
  );
}

export default function ActivityModal({
  weightKg,
  onClose,
  onSave,
}: {
  weightKg: number;
  onClose: () => void;
  onSave: (entry: { activity_type: ActivityType; duration_min: number; intensity: Intensity; cals: number }) => void;
}) {
  const [type, setType] = useState<ActivityType>('ride');
  const [duration, setDuration] = useState(60);
  const [intensity, setIntensity] = useState<Intensity>('steady');
  const [saving, setSaving] = useState(false);

  const cals = calcActivityCals(intensity, weightKg, duration);

  const typeLabels: Record<ActivityType, string> = { ride: '🚴 Ride', run: '🏃 Run', other: '✦ Other' };
  const intensityCopy: Record<Intensity, string> = { easy: 'conversational', steady: 'tempo', hard: 'hurting' };

  const save = async () => {
    setSaving(true);
    await onSave({ activity_type: type, duration_min: duration, intensity, cals });
  };

  return (
    <Sheet onClose={onClose}>
      <div style={{ height: '100%', background: 'var(--bg)', color: 'var(--text)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '60px 22px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Mono style={{ color: 'var(--text-dim)' }}>log activity</Mono>
          <Tappable onClick={onClose} style={{ padding: 6 }}>
            <Mono style={{ color: 'var(--text-faint)' }}>cancel</Mono>
          </Tappable>
        </div>

        <div style={{ padding: '34px 22px 8px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 36, fontWeight: 300, color: 'var(--accent)', lineHeight: 1 }}>+</span>
            <BigNum value={cals.toLocaleString()} color="var(--accent)" size={88} weight={300} />
            <Mono style={{ color: 'var(--text-dim)', marginLeft: 4 }}>cal back</Mono>
          </div>
        </div>

        <div style={{ padding: '24px 22px 0' }}>
          <Mono style={{ color: 'var(--text-faint)' }}>type</Mono>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            {(Object.entries(typeLabels) as [ActivityType, string][]).map(([k, label]) => (
              <Tappable key={k} onClick={() => setType(k)} style={{
                flex: 1, padding: '14px 0', textAlign: 'center',
                background: type === k ? 'var(--text)' : 'var(--surface)',
                color: type === k ? 'var(--bg)' : 'var(--text)',
                borderRadius: 14, fontSize: 14, fontWeight: 500,
              }}>{label}</Tappable>
            ))}
          </div>
        </div>

        <div style={{ padding: '22px 22px 0' }}>
          <Mono style={{ color: 'var(--text-faint)' }}>duration</Mono>
          <DurationPicker value={duration} onChange={setDuration} />
        </div>

        <div style={{ padding: '24px 22px 0' }}>
          <Mono style={{ color: 'var(--text-faint)' }}>intensity</Mono>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            {(['easy', 'steady', 'hard'] as Intensity[]).map(k => (
              <Tappable key={k} onClick={() => setIntensity(k)} style={{
                flex: 1, padding: '16px 0', textAlign: 'center',
                background: intensity === k ? 'var(--accent)' : 'var(--surface)',
                color: intensity === k ? 'var(--accent-ink)' : 'var(--text)',
                borderRadius: 14,
              }}>
                <div style={{ fontSize: 14, fontWeight: 600, textTransform: 'capitalize' }}>{k}</div>
                <Mono style={{ color: intensity === k ? 'var(--accent-ink)' : 'var(--text-faint)', marginTop: 2, fontSize: 10 }}>
                  {intensityCopy[k]}
                </Mono>
              </Tappable>
            ))}
          </div>
        </div>

        <div style={{ flex: 1 }} />

        <div style={{ padding: '0 22px 28px' }}>
          <Tappable
            onClick={save}
            disabled={saving}
            style={{
              background: 'var(--accent)', color: 'var(--accent-ink)',
              padding: '18px 0', borderRadius: 18,
              textAlign: 'center', fontSize: 16, fontWeight: 600,
            }}
          >
            Log it
          </Tappable>
        </div>
      </div>
    </Sheet>
  );
}
