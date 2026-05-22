'use client';

import { useState, useRef, useEffect } from 'react';
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
        position: 'absolute', inset: 0,
        transform: mounted ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 320ms cubic-bezier(.2,.7,.2,1)',
      }}>
        {children}
      </div>
    </div>
  );
}

function DurationSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const min = 15, max = 240;
  const pct = (value - min) / (max - min);
  const ref = useRef<HTMLDivElement>(null);

  const handle = (clientX: number) => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    onChange(Math.round((min + x * (max - min)) / 5) * 5);
  };

  return (
    <div
      ref={ref}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); handle(e.clientX); }}
      onPointerMove={(e) => { if (e.buttons) handle(e.clientX); }}
      style={{
        marginTop: 12, height: 44, position: 'relative',
        display: 'flex', alignItems: 'center',
        touchAction: 'none', cursor: 'pointer',
      }}
    >
      <div style={{ position: 'absolute', left: 0, right: 0, height: 4, borderRadius: 4, background: 'rgba(255,255,255,0.07)' }}>
        <div style={{ height: '100%', borderRadius: 4, width: `${pct * 100}%`, background: 'var(--accent)' }} />
      </div>
      <div style={{
        position: 'absolute', left: `calc(${pct * 100}% - 12px)`,
        width: 24, height: 24, borderRadius: '50%',
        background: 'var(--accent)',
        boxShadow: '0 0 0 6px rgba(214,255,58,0.13)',
      }} />
      {[30, 60, 90, 120, 180].map(t => (
        <div key={t} style={{
          position: 'absolute',
          left: `${(t - min) / (max - min) * 100}%`,
          transform: 'translateX(-50%)', top: 28,
          fontSize: 10, fontFamily: '"JetBrains Mono", monospace',
          color: 'var(--text-faint)',
        }}>{t}</div>
      ))}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Mono style={{ color: 'var(--text-faint)' }}>duration</Mono>
            <div>
              <span className="tnum" style={{ fontSize: 24, fontWeight: 400, color: 'var(--text)' }}>{duration}</span>
              <Mono style={{ color: 'var(--text-faint)', marginLeft: 4 }}>min</Mono>
            </div>
          </div>
          <DurationSlider value={duration} onChange={setDuration} />
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
