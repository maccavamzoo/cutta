'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Tappable, Mono, BigNum, FuelBar } from './primitives';
import { calcBMR, calcTargetCals, calcMacroTargets } from '@/lib/maths';
import dynamic from 'next/dynamic';

const FoodModal = dynamic(() => import('./FoodModal'), { ssr: false });
const ActivityModal = dynamic(() => import('./ActivityModal'), { ssr: false });

type Profile = {
  clerk_user_id: string;
  weight_kg: number;
  height_cm: number;
  age: number;
  sex: 'm' | 'f';
  unit: string;
};

type WeighIn = { id: number; weight_kg: number; local_date: string };
type FoodLog = { id: number; label: string; cals: number; protein_g: number; carbs_g: number; fat_g: number; logged_at: string };
type ActivityLog = { id: number; activity_type: string; duration_min: number; intensity: string; cals: number; logged_at: string };

function localDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function timeStamp(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatDayHeader() {
  const d = new Date();
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
    .format(d)
    .toLowerCase();
}

// ── Pre-weigh-in screen ──────────────────────────────────────────────────────

function PreWeighIn({
  lastWeighIn,
  onDone,
  onSkip,
}: {
  lastWeighIn: WeighIn | null;
  onDone: (weightKg: number) => void;
  onSkip: (() => void) | null;
}) {
  const [val, setVal] = useState('');
  const display = val || (lastWeighIn ? Number(lastWeighIn.weight_kg).toFixed(1) : '0.0');
  const hasInput = val.length > 0;

  const press = (k: string) => {
    if (k === '⌫') { setVal(v => v.slice(0, -1)); return; }
    if (k === '.' && val.includes('.')) return;
    if (val.replace('.', '').length >= 4) return;
    setVal(v => v + k);
  };

  const keys = ['1','2','3','4','5','6','7','8','9','.','0','⌫'];

  return (
    <div style={{ height: '100svh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', color: 'var(--text)' }}>
      <div style={{ padding: '64px 22px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Mono style={{ color: 'var(--text-dim)' }}>{formatDayHeader()}</Mono>
        {onSkip && (
          <Tappable onClick={onSkip} style={{ padding: 6 }}>
            <Mono style={{ color: 'var(--text-faint)' }}>skip →</Mono>
          </Tappable>
        )}
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 22px' }}>
        <div style={{ fontSize: 36, fontWeight: 400, letterSpacing: -0.6, marginBottom: 28 }}>
          Weigh in?
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span className="tnum" style={{
            fontSize: 96, fontWeight: 250, letterSpacing: -3, lineHeight: 0.9,
            color: hasInput ? 'var(--accent)' : 'var(--text-faint)',
          }}>{display}</span>
          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 18, color: 'var(--text-dim)' }}>kg</span>
        </div>
        {lastWeighIn && !hasInput && (
          <Mono style={{ color: 'var(--text-faint)', marginTop: 14 }}>
            last · {Number(lastWeighIn.weight_kg).toFixed(1)} kg
          </Mono>
        )}
      </div>

      <div style={{ padding: '0 14px 14px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
          {keys.map(k => (
            <Tappable key={k} onClick={() => press(k)} style={{
              height: 64,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28, fontWeight: 300, color: 'var(--text)',
              background: 'transparent', borderRadius: 16,
            }}>
              <span className="tnum">{k}</span>
            </Tappable>
          ))}
        </div>
        <Tappable
          disabled={!hasInput}
          onClick={() => hasInput && onDone(parseFloat(val))}
          style={{
            marginTop: 12,
            background: hasInput ? 'var(--accent)' : 'var(--surface)',
            color: hasInput ? 'var(--accent-ink)' : 'var(--text-faint)',
            padding: '18px 0', borderRadius: 18,
            textAlign: 'center', fontSize: 16, fontWeight: 600, letterSpacing: 0.2,
          }}
        >
          Lock in
        </Tappable>
      </div>
    </div>
  );
}

// ── Post-weigh-in home screen ────────────────────────────────────────────────

function HomeScreen({
  profile,
  weighIn,
  foodLogs,
  activityLogs,
  onFood,
  onActivity,
  onReweigh,
}: {
  profile: Profile;
  weighIn: WeighIn;
  foodLogs: FoodLog[];
  activityLogs: ActivityLog[];
  onFood: () => void;
  onActivity: () => void;
  onReweigh: () => void;
}) {
  const weightKg = Number(weighIn.weight_kg);
  const bmr = calcBMR(weightKg, Number(profile.height_cm), profile.age, profile.sex);
  const targetCals = calcTargetCals(bmr);
  const { protein_g, carbs_g, fat_g } = calcMacroTargets(targetCals, weightKg);

  const foodCals = foodLogs.reduce((s, l) => s + l.cals, 0);
  const activityCals = activityLogs.reduce((s, l) => s + l.cals, 0);
  const calsLeft = targetCals + activityCals - foodCals;
  const over = calsLeft < 0;
  const pct = Math.max(0, Math.min(1, calsLeft / targetCals));

  const eatenP = foodLogs.reduce((s, l) => s + Number(l.protein_g), 0);
  const eatenC = foodLogs.reduce((s, l) => s + Number(l.carbs_g), 0);
  const eatenF = foodLogs.reduce((s, l) => s + Number(l.fat_g), 0);

  const allLogs = [
    ...foodLogs.map(l => ({ ...l, kind: 'food' as const })),
    ...activityLogs.map(l => ({ ...l, kind: 'activity' as const })),
  ].sort((a, b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime());

  const MacroRow = ({ label, eaten, target }: { label: string; eaten: number; target: number }) => {
    const left = target - eaten;
    const p = Math.max(0, Math.min(1, left / target));
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '7px 0' }}>
        <Mono style={{ color: 'var(--text-dim)', width: 56, flexShrink: 0 }}>{label}</Mono>
        <div style={{ flex: 1 }}>
          <FuelBar pct={p} height={3} color="var(--text)" />
        </div>
        <div style={{ width: 64, textAlign: 'right' }}>
          <span className="tnum" style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)' }}>
            {Math.max(0, Math.round(left))}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-faint)', marginLeft: 3 }}>g</span>
        </div>
      </div>
    );
  };

  return (
    <div style={{ height: '100svh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', color: 'var(--text)' }}>
      <div style={{ padding: '60px 22px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Mono style={{ color: 'var(--text-dim)' }}>{formatDayHeader()}</Mono>
        <Tappable onClick={() => { window.location.href = '/setup'; }} style={{ padding: '2px 0' }}>
          <Mono style={{ color: 'var(--text-faint)' }} className="tnum">
            {weightKg.toFixed(1)} kg
          </Mono>
        </Tappable>
      </div>

      <div style={{ padding: '34px 22px 8px' }}>
        <BigNum
          value={over ? `−${Math.abs(calsLeft).toLocaleString()}` : calsLeft.toLocaleString()}
          color={over ? 'var(--warn)' : 'var(--text)'}
          size={108}
          weight={250}
        />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
          <Mono style={{ color: over ? 'var(--warn)' : 'var(--text-dim)' }}>
            {over ? 'over budget' : 'cals left today'}
          </Mono>
          <Mono style={{ color: 'var(--text-faint)' }} className="tnum">
            of {targetCals.toLocaleString()}
          </Mono>
        </div>
        <div style={{ marginTop: 14 }}>
          <FuelBar pct={pct} height={6} />
        </div>
      </div>

      <div style={{ padding: '20px 22px 0' }}>
        <MacroRow label="protein" eaten={eatenP} target={protein_g} />
        <MacroRow label="carbs" eaten={eatenC} target={carbs_g} />
        <MacroRow label="fat" eaten={eatenF} target={fat_g} />
      </div>

      <div style={{ padding: '20px 22px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Tappable onClick={onFood} style={{
          background: 'var(--accent)', color: 'var(--accent-ink)',
          borderRadius: 18, padding: '18px 16px',
          display: 'flex', alignItems: 'center', gap: 10,
          fontWeight: 600, fontSize: 16,
        }}>
          <span style={{ fontSize: 20 }}>📷</span>Food
        </Tappable>
        <Tappable onClick={onActivity} style={{
          background: 'var(--surface)', color: 'var(--text)',
          borderRadius: 18, padding: '18px 16px',
          display: 'flex', alignItems: 'center', gap: 10,
          fontWeight: 600, fontSize: 16,
          border: '0.5px solid var(--line)',
        }}>
          <span style={{ fontSize: 20 }}>🚴</span>Activity
        </Tappable>
      </div>
      <div style={{ padding: '8px 22px 0' }}>
        <Tappable onClick={onReweigh} style={{
          background: 'var(--surface)', color: 'var(--text-dim)',
          borderRadius: 18, padding: '14px 16px',
          display: 'flex', alignItems: 'center', gap: 10,
          fontWeight: 500, fontSize: 15,
          border: '0.5px solid var(--line)',
        }}>
          <span style={{ fontSize: 18 }}>⚖️</span>Weigh in
        </Tappable>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '14px 22px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0 6px' }}>
          <Mono style={{ color: 'var(--text-dim)' }}>today</Mono>
          <div style={{ flex: 1, height: 0.5, background: 'var(--line)' }} />
          <Mono style={{ color: 'var(--text-faint)' }} className="tnum">{allLogs.length}</Mono>
        </div>
        {allLogs.length === 0 && (
          <div style={{ color: 'var(--text-faint)', fontSize: 14, padding: '20px 0' }}>
            Nothing logged yet.
          </div>
        )}
        {allLogs.map(l => (
          <div key={`${l.kind}-${l.id}`} style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '12px 0',
            borderBottom: '0.5px solid var(--line)',
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: l.kind === 'activity' ? 'var(--surface)' : 'var(--surface-hi)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18,
              border: '0.5px solid var(--line)',
              flexShrink: 0,
            }}>
              {l.kind === 'activity' ? '🚴' : '🍽️'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {l.kind === 'food' ? l.label : `${l.activity_type} · ${(l as ActivityLog).intensity}`}
              </div>
              <Mono style={{ color: 'var(--text-faint)' }} className="tnum">
                {timeStamp(l.logged_at)}
                {l.kind === 'activity' ? ` · ${(l as ActivityLog).duration_min}min` : ''}
              </Mono>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span className="tnum" style={{
                fontSize: 17, fontWeight: 500,
                color: l.kind === 'activity' ? 'var(--accent)' : 'var(--text)',
              }}>
                {l.kind === 'activity' ? '−' : ''}{l.cals}
              </span>
              <Mono style={{ color: 'var(--text-faint)', marginLeft: 4 }}>cal</Mono>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Root HomeView ────────────────────────────────────────────────────────────

export default function HomeView() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [weighIn, setWeighIn] = useState<WeighIn | null>(null);
  const [lastWeighIn, setLastWeighIn] = useState<WeighIn | null>(null);
  const [foodLogs, setFoodLogs] = useState<FoodLog[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [modal, setModal] = useState<'food' | 'activity' | null>(null);
  const [reweighing, setReweighing] = useState(false);

  const today = localDate();

  useEffect(() => {
    async function load() {
      const [profileRes, todayRes] = await Promise.all([
        fetch('/api/profile'),
        fetch(`/api/today?date=${today}`),
      ]);
      const p = await profileRes.json();
      if (!p) { router.replace('/setup'); return; }
      const t = await todayRes.json();
      setProfile(p);
      setWeighIn(t.weighIn);
      setLastWeighIn(t.lastWeighIn);
      setFoodLogs(t.foodLogs);
      setActivityLogs(t.activityLogs);
      setLoading(false);
    }
    load();
  }, [today, router]);

  const handleWeighIn = async (weightKg: number) => {
    const res = await fetch('/api/weigh-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weight_kg: weightKg, local_date: today }),
    });
    const w = await res.json();
    setWeighIn(w);
    setReweighing(false);
  };

  const handleFoodSave = async (estimate: { label: string; cals: number; macros: { p: number; c: number; f: number } }) => {
    const res = await fetch('/api/food-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        label: estimate.label,
        cals: estimate.cals,
        protein_g: estimate.macros.p,
        carbs_g: estimate.macros.c,
        fat_g: estimate.macros.f,
        local_date: today,
      }),
    });
    const entry = await res.json();
    setFoodLogs(l => [...l, entry]);
    setModal(null);
  };

  const handleActivitySave = async (entry: { activity_type: string; duration_min: number; intensity: string; cals: number }) => {
    const res = await fetch('/api/activity-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...entry, local_date: today }),
    });
    const saved = await res.json();
    setActivityLogs(l => [...l, saved]);
    setModal(null);
  };

  if (loading) {
    return (
      <div style={{
        height: '100svh', background: 'var(--bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          width: 20, height: 20, borderRadius: '50%',
          border: '2px solid rgba(214,255,58,0.2)',
          borderTopColor: 'var(--accent)',
          animation: 'cutta-spin 700ms linear infinite',
        }} />
      </div>
    );
  }

  if (!profile) return null;

  const effectiveWeighIn = weighIn ?? (lastWeighIn ? { ...lastWeighIn, local_date: today } : null);

  return (
    <>
      {(!effectiveWeighIn || reweighing) ? (
        <PreWeighIn
          lastWeighIn={lastWeighIn}
          onDone={handleWeighIn}
          onSkip={effectiveWeighIn ? () => setReweighing(false) : null}
        />
      ) : (
        <HomeScreen
          profile={profile}
          weighIn={effectiveWeighIn!}
          foodLogs={foodLogs}
          activityLogs={activityLogs}
          onFood={() => setModal('food')}
          onActivity={() => setModal('activity')}
          onReweigh={() => setReweighing(true)}
        />
      )}
      {modal === 'food' && (
        <FoodModal onClose={() => setModal(null)} onSave={handleFoodSave} />
      )}
      {modal === 'activity' && effectiveWeighIn && (
        <ActivityModal
          weightKg={Number(effectiveWeighIn.weight_kg)}
          onClose={() => setModal(null)}
          onSave={handleActivitySave}
        />
      )}
    </>
  );
}
