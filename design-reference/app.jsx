// Cutta — app root. State machine + iOS frame + Tweaks.

const SEED_LOGS = [
  { id: 1, type: 'food',     time: '07:14', label: 'Oat bowl, banana, honey', cals: 420, macros: { p: 12, c: 78, f: 8 },  thumb: 0 },
  { id: 2, type: 'activity', time: '08:02', label: 'Morning ride',            cals: 680, duration: 62, intensity: 'steady' },
  { id: 3, type: 'food',     time: '09:31', label: 'Espresso & banana',       cals: 110, macros: { p: 1,  c: 27, f: 0 },  thumb: 4 },
  { id: 4, type: 'food',     time: '12:48', label: 'Chicken & rice bowl',    cals: 640, macros: { p: 48, c: 72, f: 14 }, thumb: 2 },
];

const DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#D6FF3A",
  "unit": "metric",
  "stage": "home"
}/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(DEFAULTS);
  const T = React.useMemo(() => buildTheme(t.accent, t.unit), [t.accent, t.unit]);

  // app state
  const [stage, setStage] = React.useState(t.stage); // 'setup' | 'preWeigh' | 'home'
  const [modal, setModal] = React.useState(null);    // 'food' | 'activity'
  const [profile, setProfile] = React.useState({
    weight: 74.2, height: 178, age: 32, sex: 'm',
  });
  const [lastWeight, setLastWeight] = React.useState(74.4);
  const [logs, setLogs] = React.useState(SEED_LOGS);

  // when the tweak changes the stage, mirror
  React.useEffect(() => { setStage(t.stage); }, [t.stage]);

  // BMR + cyclist factor. Mifflin–St Jeor.
  const bmr = profile.sex === 'm'
    ? 10*profile.weight + 6.25*profile.height - 5*profile.age + 5
    : 10*profile.weight + 6.25*profile.height - 5*profile.age - 161;
  const targetCals = Math.round(bmr * 1.4);  // sedentary baseline; rides are added back as +cals
  const target = {
    p: Math.round(profile.weight * 1.8),      // 1.8 g/kg
    c: Math.round(targetCals * 0.5 / 4),      // 50% kcal from carbs
    f: Math.round(targetCals * 0.28 / 9),     // 28% kcal from fat
  };

  // handlers
  const handleSetupDone = (p) => {
    setProfile(p);
    setStage('preWeigh');
    setTweak('stage', 'preWeigh');
  };
  const handleWeighIn = (w) => {
    setProfile(p => ({ ...p, weight: w }));
    setLastWeight(w);
    setStage('home');
    setTweak('stage', 'home');
  };
  const handleSkipWeigh = () => {
    setStage('home');
    setTweak('stage', 'home');
  };

  const handleFoodSave = (est) => {
    setLogs(L => [...L, {
      id: Date.now(),
      type: 'food',
      time: nowStamp(),
      label: est.label,
      cals: est.cals,
      macros: est.macros,
      thumb: est.thumb,
    }]);
    setModal(null);
  };
  const handleActivitySave = (a) => {
    const labels = { ride: 'Ride', run: 'Run', other: 'Activity' };
    setLogs(L => [...L, {
      id: Date.now(),
      type: 'activity',
      time: nowStamp(),
      label: `${labels[a.type]} · ${a.intensity}`,
      cals: a.cals,
      duration: a.duration,
      intensity: a.intensity,
    }]);
    setModal(null);
  };

  const state = { profile, targetCals, logs, target, macros: { eaten: { p:0,c:0,f:0 } } };

  return (
    <div style={{ position: 'relative' }}>
      <IOSDevice width={402} height={874} dark={true}>
        <div style={{ position: 'absolute', inset: 0 }}>
          {stage === 'setup' && (
            <SetupScreen T={T} onDone={handleSetupDone} />
          )}
          {stage === 'preWeigh' && (
            <PreWeighIn T={T} lastWeight={lastWeight}
              onWeigh={handleWeighIn} onSkip={handleSkipWeigh} />
          )}
          {stage === 'home' && (
            <HomeScreen
              T={T} state={state}
              onFood={() => setModal('food')}
              onActivity={() => setModal('activity')}
              onOpenSetup={() => { setStage('setup'); setTweak('stage', 'setup'); }}
            />
          )}
        </div>

        {modal === 'food' && (
          <FoodModal T={T} onClose={() => setModal(null)} onSave={handleFoodSave} />
        )}
        {modal === 'activity' && (
          <ActivityModal T={T} onClose={() => setModal(null)} onSave={handleActivitySave} />
        )}
      </IOSDevice>

      <TweaksPanel title="Tweaks">
        <TweakSection label="Where to start">
          <TweakRadio
            label="Screen"
            value={t.stage}
            onChange={(v) => setTweak('stage', v)}
            options={[
              { value: 'setup', label: 'Setup' },
              { value: 'preWeigh', label: 'Weigh-in' },
              { value: 'home', label: 'Home' },
            ]}
          />
        </TweakSection>
        <TweakSection label="Look">
          <TweakColor
            label="Accent"
            value={t.accent}
            onChange={(v) => setTweak('accent', v)}
            options={ACCENT_OPTIONS}
          />
          <TweakRadio
            label="Units"
            value={t.unit}
            onChange={(v) => setTweak('unit', v)}
            options={[
              { value: 'metric',   label: 'kg / cm' },
              { value: 'imperial', label: 'lb / in' },
            ]}
          />
        </TweakSection>
        <TweakSection label="Try it">
          <TweakButton label="Open food modal"      onClick={() => setModal('food')} />
          <TweakButton label="Open activity modal"  onClick={() => setModal('activity')} />
          <TweakButton label="Clear today's logs"   onClick={() => setLogs([])} secondary />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

function nowStamp() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <div id="stage"><App /></div>
);
