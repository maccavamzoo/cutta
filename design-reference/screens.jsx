// Cutta — screens. Each is self-contained and reads tokens from `T`.

// ─────────────────────────────────────────────────────────────
// 0. SETUP — one-time. Four fields, one button.
// ─────────────────────────────────────────────────────────────
function SetupScreen({ T, onDone }) {
  const [profile, setProfile] = React.useState({
    weight: 74, height: 178, age: 32, sex: 'm',
  });
  const [focused, setFocused] = React.useState('weight');

  const Field = ({ k, label, unit, range }) => {
    const active = focused === k;
    return (
      <Tappable onClick={() => setFocused(k)} style={{
        padding: '20px 22px',
        borderTop: `0.5px solid ${T.line}`,
        background: active ? T.surface : 'transparent',
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
      }}>
        <Mono style={{ color: active ? T.accent : T.textDim }}>{label}</Mono>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span className="tnum" style={{ fontSize: 32, fontWeight: 400, letterSpacing: -0.5, color: T.text }}>
            {profile[k]}
          </span>
          <span style={{ fontSize: 13, color: T.textDim, fontFamily: '"JetBrains Mono", monospace' }}>{unit}</span>
        </div>
      </Tappable>
    );
  };

  const bump = (delta) => {
    setProfile(p => ({ ...p, [focused]: Math.max(1, p[focused] + delta) }));
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: T.bg, color: T.text }}>
      {/* top */}
      <div style={{ padding: '64px 22px 26px' }}>
        <Mono style={{ color: T.accent }}>cutta · setup</Mono>
        <div style={{
          fontSize: 32, fontWeight: 400, lineHeight: 1.1, marginTop: 14,
          letterSpacing: -0.6, color: T.text, maxWidth: 280,
        }}>
          Tell us about you.<br/>
          <span style={{ color: T.textDim }}>That's it.</span>
        </div>
      </div>

      {/* fields */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <Field k="weight" label="Weight" unit={T.unit === 'metric' ? 'kg' : 'lb'} />
        <Field k="height" label="Height" unit={T.unit === 'metric' ? 'cm' : 'in'} />
        <Field k="age"    label="Age"    unit="yr" />
        <Tappable style={{
          padding: '20px 22px', borderTop: `0.5px solid ${T.line}`,
          borderBottom: `0.5px solid ${T.line}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }} onClick={() => setProfile(p => ({ ...p, sex: p.sex === 'm' ? 'f' : 'm' }))}>
          <Mono style={{ color: T.textDim }}>Sex</Mono>
          <div style={{ display: 'flex', gap: 8 }}>
            {['m','f'].map(s => (
              <div key={s} style={{
                padding: '8px 18px', borderRadius: 100,
                background: profile.sex === s ? T.accent : 'transparent',
                color: profile.sex === s ? T.accentInk : T.textDim,
                border: profile.sex === s ? 'none' : `0.5px solid ${T.lineStrong}`,
                fontSize: 14, fontWeight: 500, letterSpacing: 0.5,
                textTransform: 'uppercase',
              }}>{s}</div>
            ))}
          </div>
        </Tappable>

        {/* stepper for focused field */}
        <div style={{ padding: '24px 22px', display: 'flex', gap: 10 }}>
          {[-10, -1, +1, +10].map(d => (
            <Tappable key={d} onClick={() => bump(d)} style={{
              flex: 1, padding: '14px 0', textAlign: 'center',
              background: T.surface, borderRadius: 14,
              fontFamily: '"JetBrains Mono", monospace', fontSize: 14,
              color: T.text, fontWeight: 500,
            }}>
              {d > 0 ? '+' : ''}{d}
            </Tappable>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div style={{ padding: '0 22px 28px' }}>
        <Tappable onClick={() => onDone(profile)} style={{
          background: T.accent, color: T.accentInk,
          padding: '18px 0', borderRadius: 18,
          textAlign: 'center', fontSize: 16, fontWeight: 600,
          letterSpacing: 0.2,
        }}>Start tracking</Tappable>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 1. PRE-WEIGH-IN — single morning prompt. Number pad. Nothing else.
// ─────────────────────────────────────────────────────────────
function PreWeighIn({ T, onWeigh, onSkip, lastWeight }) {
  const [val, setVal] = React.useState('');
  const display = val || (lastWeight ? lastWeight.toFixed(1) : '0.0');
  const hasInput = val.length > 0;

  const press = (k) => {
    if (k === '⌫') return setVal(v => v.slice(0, -1));
    if (k === '.' && val.includes('.')) return;
    if (val.replace('.','').length >= 4) return;
    setVal(v => v + k);
  };

  const keys = ['1','2','3','4','5','6','7','8','9','.','0','⌫'];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: T.bg, color: T.text }}>
      <div style={{ padding: '64px 22px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Mono style={{ color: T.textDim }}>tue · 06:42</Mono>
        <Tappable onClick={onSkip} style={{ padding: 6 }}>
          <Mono style={{ color: T.textFaint }}>skip →</Mono>
        </Tappable>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 22px' }}>
        <div style={{
          fontSize: 36, fontWeight: 400, letterSpacing: -0.6, color: T.text,
          marginBottom: 28,
        }}>
          Weigh in?
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span className="tnum" style={{
            fontSize: 96, fontWeight: 250, letterSpacing: -3, lineHeight: 0.9,
            color: hasInput ? T.accent : T.textFaint,
          }}>{display}</span>
          <span style={{
            fontFamily: '"JetBrains Mono", monospace', fontSize: 18,
            color: T.textDim,
          }}>{T.unit === 'metric' ? 'kg' : 'lb'}</span>
        </div>

        {lastWeight && !hasInput && (
          <Mono style={{ color: T.textFaint, marginTop: 14 }}>
            yesterday · {lastWeight.toFixed(1)} {T.unit === 'metric' ? 'kg' : 'lb'}
          </Mono>
        )}
      </div>

      {/* number pad */}
      <div style={{ padding: '0 14px 14px' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6,
        }}>
          {keys.map(k => (
            <Tappable key={k} onClick={() => press(k)} style={{
              height: 64,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28, fontWeight: 300,
              color: T.text,
              background: 'transparent',
              borderRadius: 16,
            }}>
              <span className="tnum">{k}</span>
            </Tappable>
          ))}
        </div>
        <Tappable
          disabled={!hasInput}
          onClick={() => onWeigh(parseFloat(val))}
          style={{
            marginTop: 12,
            background: hasInput ? T.accent : T.surface,
            color: hasInput ? T.accentInk : T.textFaint,
            padding: '18px 0', borderRadius: 18,
            textAlign: 'center', fontSize: 16, fontWeight: 600, letterSpacing: 0.2,
          }}>
          Lock in
        </Tappable>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 2. HOME — the main screen. Used all day.
// ─────────────────────────────────────────────────────────────
function HomeScreen({ T, state, onFood, onActivity, onOpenSetup }) {
  const { targetCals, logs, macros, target } = state;
  const consumed = logs.filter(l => l.type === 'food').reduce((s, l) => s + l.cals, 0);
  const burned   = logs.filter(l => l.type === 'activity').reduce((s, l) => s + l.cals, 0);
  const remaining = targetCals - consumed + burned;
  const pct = Math.max(0, Math.min(1, remaining / targetCals));
  const over = remaining < 0;

  // macros remaining
  const eatenP = logs.filter(l => l.type === 'food').reduce((s, l) => s + (l.macros?.p || 0), 0);
  const eatenC = logs.filter(l => l.type === 'food').reduce((s, l) => s + (l.macros?.c || 0), 0);
  const eatenF = logs.filter(l => l.type === 'food').reduce((s, l) => s + (l.macros?.f || 0), 0);
  const macroRow = (label, eaten, tgt) => {
    const left = tgt - eaten;
    const p = Math.max(0, Math.min(1, left / tgt));
    return (
      <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '7px 0' }}>
        <Mono style={{ color: T.textDim, width: 56, flexShrink: 0 }}>{label}</Mono>
        <div style={{ flex: 1 }}>
          <FuelBar pct={p} T={T} height={3} color={T.text} />
        </div>
        <div style={{ width: 64, textAlign: 'right' }}>
          <span className="tnum" style={{ fontSize: 15, fontWeight: 500, color: T.text }}>
            {Math.max(0, Math.round(left))}
          </span>
          <span style={{ fontSize: 11, color: T.textFaint, marginLeft: 3 }}>g</span>
        </div>
      </div>
    );
  };

  return (
    <div style={{ height: '100%', background: T.bg, display: 'flex', flexDirection: 'column', color: T.text }}>
      {/* tiny top strip */}
      <div style={{ padding: '60px 22px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Mono style={{ color: T.textDim }}>tue · 14 oct</Mono>
        <Tappable onClick={onOpenSetup} style={{ padding: 6 }}>
          <Mono style={{ color: T.textFaint }}>{state.profile.weight.toFixed(1)} kg</Mono>
        </Tappable>
      </div>

      {/* HERO — fuel gauge */}
      <div style={{ padding: '34px 22px 8px' }}>
        <BigNum
          value={over ? `−${Math.abs(remaining).toLocaleString()}` : remaining.toLocaleString()}
          color={over ? T.warn : T.text}
          size={108} weight={250}
        />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
          <Mono style={{ color: over ? T.warn : T.textDim }}>
            {over ? 'over budget' : 'cals left today'}
          </Mono>
          <Mono style={{ color: T.textFaint }} className="tnum">
            of {targetCals.toLocaleString()}
          </Mono>
        </div>
        <div style={{ marginTop: 14 }}>
          <FuelBar pct={pct} T={T} height={6} />
        </div>
      </div>

      {/* macros */}
      <div style={{ padding: '20px 22px 0' }}>
        {macroRow('protein', eatenP, target.p)}
        {macroRow('carbs',   eatenC, target.c)}
        {macroRow('fat',     eatenF, target.f)}
      </div>

      {/* CTAs */}
      <div style={{ padding: '20px 22px 8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Tappable onClick={onFood} style={{
          background: T.accent, color: T.accentInk,
          borderRadius: 18, padding: '18px 16px',
          display: 'flex', alignItems: 'center', gap: 10,
          fontWeight: 600, fontSize: 16,
        }}>
          <span style={{ fontSize: 20 }}>📷</span>Food
        </Tappable>
        <Tappable onClick={onActivity} style={{
          background: T.surface, color: T.text,
          borderRadius: 18, padding: '18px 16px',
          display: 'flex', alignItems: 'center', gap: 10,
          fontWeight: 600, fontSize: 16,
          border: `0.5px solid ${T.line}`,
        }}>
          <span style={{ fontSize: 20 }}>🚴</span>Activity
        </Tappable>
      </div>

      {/* feed */}
      <div className="feed" style={{ flex: 1, overflow: 'auto', padding: '14px 22px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0 6px' }}>
          <Mono style={{ color: T.textDim }}>today</Mono>
          <div style={{ flex: 1, height: 0.5, background: T.line }} />
          <Mono style={{ color: T.textFaint }} className="tnum">{logs.length}</Mono>
        </div>
        {logs.length === 0 && (
          <div style={{ color: T.textFaint, fontSize: 14, padding: '20px 0' }}>
            Nothing logged yet.
          </div>
        )}
        {logs.slice().reverse().map(l => <LogRow key={l.id} log={l} T={T} />)}
      </div>
    </div>
  );
}

function LogRow({ log, T }) {
  const isActivity = log.type === 'activity';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '12px 0',
      borderBottom: `0.5px solid ${T.line}`,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 12,
        background: isActivity ? T.surface : log.thumbColor || T.surfaceHi,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18,
        border: `0.5px solid ${T.line}`,
        overflow: 'hidden',
        position: 'relative',
        flexShrink: 0,
      }}>
        {log.thumb ? <FoodThumb seed={log.thumb} /> : <span>{isActivity ? '🚴' : '🍽️'}</span>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, color: T.text, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {log.label}
        </div>
        <Mono style={{ color: T.textFaint }} className="tnum">
          {log.time}{isActivity ? ` · ${log.duration}min · ${log.intensity}` : ''}
        </Mono>
      </div>
      <div style={{ textAlign: 'right' }}>
        <span className="tnum" style={{
          fontSize: 17, fontWeight: 500,
          color: isActivity ? T.accent : T.text,
        }}>
          {isActivity ? '−' : ''}{log.cals}
        </span>
        <Mono style={{ color: T.textFaint, marginLeft: 4 }}>cal</Mono>
      </div>
    </div>
  );
}

// Plausible-looking food thumbnail (no real photos — abstract stripes per seed)
function FoodThumb({ seed }) {
  const palettes = [
    ['#8c5a2a', '#c08a4a', '#e0b878'], // oats / bread
    ['#3d6b2e', '#79a35a', '#b4d18a'], // greens
    ['#a83434', '#d96a5a', '#f0a08a'], // protein / tomato
    ['#5a4a8a', '#8a7ac0', '#b8a8e0'], // berries
    ['#c08a2a', '#e0b04a', '#f0d080'], // eggs / pasta
  ];
  const p = palettes[seed % palettes.length];
  return (
    <svg viewBox="0 0 40 40" width="100%" height="100%">
      <rect width="40" height="40" fill={p[0]} />
      <rect y={(seed * 7) % 20 + 6} width="40" height="14" fill={p[1]} />
      <circle cx={10 + (seed*3)%20} cy={20 + (seed*5)%14} r="6" fill={p[2]} />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// 3. FOOD MODAL — camera → AI estimate → confirm
// ─────────────────────────────────────────────────────────────
function FoodModal({ T, onClose, onSave }) {
  const [stage, setStage] = React.useState('camera'); // camera | analyzing | review
  const [estimate, setEstimate] = React.useState(null);

  const snap = () => {
    setStage('analyzing');
    setTimeout(() => {
      // mock estimate
      const candidates = [
        { label: 'Oat bowl, banana, honey', cals: 420, macros: { p: 12, c: 78, f: 8 }, thumb: 0 },
        { label: 'Chicken & rice bowl',     cals: 640, macros: { p: 48, c: 72, f: 14 }, thumb: 2 },
        { label: 'Avocado toast, two eggs', cals: 510, macros: { p: 22, c: 36, f: 30 }, thumb: 4 },
      ];
      setEstimate(candidates[Math.floor(Math.random() * candidates.length)]);
      setStage('review');
    }, 1400);
  };

  return (
    <Sheet T={T} onClose={onClose}>
      {stage !== 'review' && (
        <CameraView T={T} stage={stage} onSnap={snap} onClose={onClose} />
      )}
      {stage === 'review' && (
        <ReviewView T={T} estimate={estimate} setEstimate={setEstimate}
          onClose={onClose} onSave={() => onSave(estimate)} onRetake={() => setStage('camera')} />
      )}
    </Sheet>
  );
}

function CameraView({ T, stage, onSnap, onClose }) {
  return (
    <div style={{
      height: '100%', background: '#000', position: 'relative',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* mock viewfinder — a faux "plate on table" */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `
          radial-gradient(circle at 50% 55%, #3a2e22 0%, #1a1410 38%, #0a0807 70%, #000 100%)
        `,
      }}>
        {/* plate */}
        <div style={{
          position: 'absolute', left: '50%', top: '52%', transform: 'translate(-50%,-50%)',
          width: 260, height: 260, borderRadius: '50%',
          background: 'radial-gradient(circle, #d8c8a8 0%, #a89878 60%, #786850 100%)',
          boxShadow: '0 30px 80px rgba(0,0,0,0.6)',
          opacity: stage === 'analyzing' ? 0.55 : 1,
          transition: 'opacity 300ms',
        }}>
          {/* food blob */}
          <div style={{
            position: 'absolute', inset: 36, borderRadius: '50%',
            background: `radial-gradient(circle at 40% 35%, #c89858, #8a5a28 70%, #5a3818 100%)`,
          }} />
          <div style={{
            position: 'absolute', left: '32%', top: '40%', width: 60, height: 30, borderRadius: 18,
            background: 'linear-gradient(135deg, #f0d090, #d0a050)',
          }} />
        </div>
      </div>

      {/* top bar */}
      <div style={{
        position: 'relative', zIndex: 2,
        padding: '60px 22px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <Tappable onClick={onClose} style={{
          width: 36, height: 36, borderRadius: 999,
          background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(20px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 18, fontWeight: 300,
        }}>×</Tappable>
        <Mono style={{ color: 'rgba(255,255,255,0.7)' }}>aim at your plate</Mono>
        <div style={{ width: 36 }} />
      </div>

      {/* viewfinder corners */}
      <div style={{ position: 'absolute', inset: '20% 12% 28% 12%', pointerEvents: 'none' }}>
        {[
          { top: 0, left: 0, brt: '2px solid', blf: '2px solid' },
          { top: 0, right: 0, brt: '2px solid', brr: '2px solid' },
          { bottom: 0, left: 0, bbb: '2px solid', blf: '2px solid' },
          { bottom: 0, right: 0, bbb: '2px solid', brr: '2px solid' },
        ].map((p, i) => (
          <div key={i} style={{
            position: 'absolute', width: 28, height: 28,
            top: p.top, left: p.left, right: p.right, bottom: p.bottom,
            borderTop: p.brt ? `2px solid ${T.accent}` : undefined,
            borderBottom: p.bbb ? `2px solid ${T.accent}` : undefined,
            borderLeft: p.blf ? `2px solid ${T.accent}` : undefined,
            borderRight: p.brr ? `2px solid ${T.accent}` : undefined,
          }} />
        ))}
      </div>

      {/* status during analyze */}
      {stage === 'analyzing' && (
        <div style={{
          position: 'absolute', left: '50%', top: '50%',
          transform: 'translate(-50%,-50%)',
          background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(20px)',
          padding: '14px 20px', borderRadius: 14,
          display: 'flex', alignItems: 'center', gap: 12,
          border: `0.5px solid ${T.accent}`,
        }}>
          <Spinner color={T.accent} />
          <Mono style={{ color: '#fff' }}>identifying…</Mono>
        </div>
      )}

      {/* shutter */}
      <div style={{
        position: 'absolute', bottom: 28, left: 0, right: 0,
        display: 'flex', justifyContent: 'center', zIndex: 3,
      }}>
        <Tappable onClick={stage === 'camera' ? onSnap : null} style={{
          width: 76, height: 76, borderRadius: '50%',
          background: 'transparent',
          border: `3px solid rgba(255,255,255,0.85)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            width: 60, height: 60, borderRadius: '50%',
            background: stage === 'analyzing' ? T.accent : '#fff',
            transition: 'background 200ms',
          }} />
        </Tappable>
      </div>
    </div>
  );
}

function Spinner({ color }) {
  return (
    <div style={{
      width: 14, height: 14, borderRadius: '50%',
      border: `2px solid ${color}33`,
      borderTopColor: color,
      animation: 'cutta-spin 700ms linear infinite',
    }}>
      <style>{`@keyframes cutta-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function ReviewView({ T, estimate, setEstimate, onClose, onSave, onRetake }) {
  const adjust = (key, delta) => {
    if (key === 'cals') {
      setEstimate({ ...estimate, cals: Math.max(0, estimate.cals + delta) });
    } else {
      setEstimate({ ...estimate, macros: { ...estimate.macros, [key]: Math.max(0, estimate.macros[key] + delta) }});
    }
  };

  return (
    <div style={{ height: '100%', background: T.bg, color: T.text, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '60px 22px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Tappable onClick={onRetake} style={{ padding: 6 }}>
          <Mono style={{ color: T.textDim }}>← retake</Mono>
        </Tappable>
        <Mono style={{ color: T.textDim }}>ai estimate</Mono>
        <Tappable onClick={onClose} style={{ padding: 6 }}>
          <Mono style={{ color: T.textFaint }}>cancel</Mono>
        </Tappable>
      </div>

      {/* thumb */}
      <div style={{ padding: '24px 22px 0' }}>
        <div style={{
          height: 200, borderRadius: 22, overflow: 'hidden', position: 'relative',
          background: 'radial-gradient(circle at 50% 50%, #c89858, #5a3818 70%, #2a1808 100%)',
        }}>
          <div style={{
            position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
            width: 140, height: 140, borderRadius: '50%',
            background: 'radial-gradient(circle, #d8c8a8, #a89878 60%, #786850 100%)',
          }} />
        </div>
      </div>

      {/* label */}
      <div style={{ padding: '20px 22px 0' }}>
        <div style={{ fontSize: 24, fontWeight: 500, letterSpacing: -0.4 }}>{estimate.label}</div>
        <Mono style={{ color: T.textFaint, marginTop: 6 }}>tap any value to nudge</Mono>
      </div>

      {/* values */}
      <div style={{ padding: '18px 22px 0', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <ValueRow T={T} label="calories" value={estimate.cals} unit="cal" onAdjust={(d) => adjust('cals', d)} step={20} big />
        <ValueRow T={T} label="protein"  value={estimate.macros.p} unit="g" onAdjust={(d) => adjust('p', d)} step={2} />
        <ValueRow T={T} label="carbs"    value={estimate.macros.c} unit="g" onAdjust={(d) => adjust('c', d)} step={5} />
        <ValueRow T={T} label="fat"      value={estimate.macros.f} unit="g" onAdjust={(d) => adjust('f', d)} step={2} />
      </div>

      <div style={{ flex: 1 }} />

      <div style={{ padding: '0 22px 28px' }}>
        <Tappable onClick={onSave} style={{
          background: T.accent, color: T.accentInk,
          padding: '18px 0', borderRadius: 18,
          textAlign: 'center', fontSize: 16, fontWeight: 600,
        }}>Log it</Tappable>
      </div>
    </div>
  );
}

function ValueRow({ T, label, value, unit, onAdjust, step, big }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      padding: big ? '14px 0' : '10px 0',
      borderBottom: `0.5px solid ${T.line}`,
    }}>
      <Mono style={{ color: T.textDim, flex: 1 }}>{label}</Mono>
      <Tappable onClick={() => onAdjust(-step)} style={{
        width: 32, height: 32, borderRadius: 10,
        background: T.surface, color: T.text,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, fontWeight: 300,
      }}>−</Tappable>
      <div style={{ width: 96, textAlign: 'center' }}>
        <span className="tnum" style={{
          fontSize: big ? 32 : 22, fontWeight: 400, letterSpacing: -0.4, color: T.text,
        }}>{value}</span>
        <span style={{ fontSize: 12, color: T.textFaint, marginLeft: 4, fontFamily: '"JetBrains Mono", monospace' }}>{unit}</span>
      </div>
      <Tappable onClick={() => onAdjust(+step)} style={{
        width: 32, height: 32, borderRadius: 10,
        background: T.surface, color: T.text,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, fontWeight: 300,
      }}>+</Tappable>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 4. ACTIVITY MODAL — type · duration · intensity → cals back
// ─────────────────────────────────────────────────────────────
function ActivityModal({ T, onClose, onSave }) {
  const [type, setType] = React.useState('ride');
  const [duration, setDuration] = React.useState(60);
  const [intensity, setIntensity] = React.useState('steady');

  // crude cal estimate per minute by type & intensity (good enough for prototype)
  const rates = {
    ride: { easy: 7,  steady: 11, hard: 16 },
    run:  { easy: 9,  steady: 13, hard: 17 },
    other:{ easy: 5,  steady: 8,  hard: 12 },
  };
  const cals = duration * rates[type][intensity];

  const typeLabels = { ride: '🚴 Ride', run: '🏃 Run', other: '✦ Other' };
  const intensityCopy = {
    easy:   'conversational',
    steady: 'tempo',
    hard:   'hurting',
  };

  return (
    <Sheet T={T} onClose={onClose}>
      <div style={{ height: '100%', background: T.bg, color: T.text, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '60px 22px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Mono style={{ color: T.textDim }}>log activity</Mono>
          <Tappable onClick={onClose} style={{ padding: 6 }}>
            <Mono style={{ color: T.textFaint }}>cancel</Mono>
          </Tappable>
        </div>

        {/* HUGE preview */}
        <div style={{ padding: '34px 22px 8px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 36, fontWeight: 300, color: T.accent, lineHeight: 1 }}>+</span>
            <BigNum value={cals.toLocaleString()} color={T.accent} size={88} weight={300} />
            <Mono style={{ color: T.textDim, marginLeft: 4 }}>cal back</Mono>
          </div>
        </div>

        {/* type */}
        <div style={{ padding: '24px 22px 0' }}>
          <Mono style={{ color: T.textFaint }}>type</Mono>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            {Object.entries(typeLabels).map(([k, label]) => (
              <Tappable key={k} onClick={() => setType(k)} style={{
                flex: 1, padding: '14px 0', textAlign: 'center',
                background: type === k ? T.text : T.surface,
                color: type === k ? T.bg : T.text,
                borderRadius: 14, fontSize: 14, fontWeight: 500,
              }}>{label}</Tappable>
            ))}
          </div>
        </div>

        {/* duration slider */}
        <div style={{ padding: '22px 22px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Mono style={{ color: T.textFaint }}>duration</Mono>
            <div>
              <span className="tnum" style={{ fontSize: 24, fontWeight: 400, color: T.text }}>{duration}</span>
              <Mono style={{ color: T.textFaint, marginLeft: 4 }}>min</Mono>
            </div>
          </div>
          <DurationSlider T={T} value={duration} onChange={setDuration} />
        </div>

        {/* intensity */}
        <div style={{ padding: '24px 22px 0' }}>
          <Mono style={{ color: T.textFaint }}>intensity</Mono>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            {['easy','steady','hard'].map(k => (
              <Tappable key={k} onClick={() => setIntensity(k)} style={{
                flex: 1, padding: '16px 0', textAlign: 'center',
                background: intensity === k ? T.accent : T.surface,
                color: intensity === k ? T.accentInk : T.text,
                borderRadius: 14,
              }}>
                <div style={{ fontSize: 14, fontWeight: 600, textTransform: 'capitalize' }}>{k}</div>
                <Mono style={{ color: intensity === k ? T.accentInk : T.textFaint, marginTop: 2, fontSize: 10 }}>{intensityCopy[k]}</Mono>
              </Tappable>
            ))}
          </div>
        </div>

        <div style={{ flex: 1 }} />

        <div style={{ padding: '0 22px 28px' }}>
          <Tappable onClick={() => onSave({ type, duration, intensity, cals })} style={{
            background: T.accent, color: T.accentInk,
            padding: '18px 0', borderRadius: 18,
            textAlign: 'center', fontSize: 16, fontWeight: 600,
          }}>Log it</Tappable>
        </div>
      </div>
    </Sheet>
  );
}

function DurationSlider({ T, value, onChange }) {
  const min = 15, max = 240;
  const pct = (value - min) / (max - min);
  const ref = React.useRef(null);

  const handle = (clientX) => {
    const r = ref.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    const raw = min + x * (max - min);
    onChange(Math.round(raw / 5) * 5);
  };

  return (
    <div
      ref={ref}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        handle(e.clientX);
      }}
      onPointerMove={(e) => {
        if (e.buttons) handle(e.clientX);
      }}
      style={{
        marginTop: 12, height: 44, position: 'relative',
        display: 'flex', alignItems: 'center',
        touchAction: 'none', cursor: 'pointer',
      }}>
      <div style={{
        position: 'absolute', left: 0, right: 0, height: 4, borderRadius: 4,
        background: 'rgba(255,255,255,0.07)',
      }}>
        <div style={{
          height: '100%', borderRadius: 4,
          width: `${pct * 100}%`, background: T.accent,
        }} />
      </div>
      <div style={{
        position: 'absolute', left: `calc(${pct * 100}% - 12px)`,
        width: 24, height: 24, borderRadius: '50%',
        background: T.accent,
        boxShadow: `0 0 0 6px ${T.accent}22`,
      }} />
      {/* tick marks */}
      {[30, 60, 90, 120, 180].map(t => (
        <div key={t} style={{
          position: 'absolute', left: `${(t - min) / (max - min) * 100}%`,
          transform: 'translateX(-50%)', top: 28,
          fontSize: 10, fontFamily: '"JetBrains Mono", monospace',
          color: T.textFaint,
        }}>{t}</div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Bottom sheet wrapper — animated rise from bottom
// ─────────────────────────────────────────────────────────────
function Sheet({ T, children, onClose }) {
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => { requestAnimationFrame(() => setOpen(true)); }, []);
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.5)',
      opacity: open ? 1 : 0, transition: 'opacity 220ms ease',
    }}
    onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        position: 'absolute', inset: 0,
        transform: open ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 320ms cubic-bezier(.2,.7,.2,1)',
      }}>
        {children}
      </div>
    </div>
  );
}

Object.assign(window, {
  SetupScreen, PreWeighIn, HomeScreen, FoodModal, ActivityModal,
});
