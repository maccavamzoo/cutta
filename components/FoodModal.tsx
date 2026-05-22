'use client';

import { useState, useRef, useEffect } from 'react';
import { Tappable, Mono, Spinner } from './primitives';

type Estimate = { label: string; cals: number; macros: { p: number; c: number; f: number } };

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

function ValueRow({
  label, value, unit, step, big, onAdjust,
}: {
  label: string; value: number; unit: string; step: number; big?: boolean;
  onAdjust: (d: number) => void;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      padding: big ? '14px 0' : '10px 0',
      borderBottom: '0.5px solid var(--line)',
    }}>
      <Mono style={{ color: 'var(--text-dim)', flex: 1 }}>{label}</Mono>
      <Tappable onClick={() => onAdjust(-step)} style={{
        width: 32, height: 32, borderRadius: 10,
        background: 'var(--surface)', color: 'var(--text)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, fontWeight: 300,
      }}>−</Tappable>
      <div style={{ width: 96, textAlign: 'center' }}>
        <span className="tnum" style={{ fontSize: big ? 32 : 22, fontWeight: 400, letterSpacing: -0.4, color: 'var(--text)' }}>
          {value}
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-faint)', marginLeft: 4, fontFamily: '"JetBrains Mono", monospace' }}>
          {unit}
        </span>
      </div>
      <Tappable onClick={() => onAdjust(+step)} style={{
        width: 32, height: 32, borderRadius: 10,
        background: 'var(--surface)', color: 'var(--text)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, fontWeight: 300,
      }}>+</Tappable>
    </div>
  );
}

export default function FoodModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (estimate: Estimate) => void;
}) {
  const [stage, setStage] = useState<'camera' | 'analyzing' | 'review'>('camera');
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setCameraReady(true);
      }
    } catch {
      setError('Camera not available');
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  };

  const snap = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const v = videoRef.current;
    const c = canvasRef.current;
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext('2d')!.drawImage(v, 0, 0);
    const dataUrl = c.toDataURL('image/jpeg', 0.8);
    const base64 = dataUrl.split(',')[1];

    stopCamera();
    setStage('analyzing');
    setError(null);

    const res = await fetch('/api/estimate-food', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_base64: base64 }),
    });

    if (!res.ok) {
      setError('Could not identify food. Try again.');
      setStage('camera');
      startCamera();
      return;
    }

    const data = await res.json();
    setEstimate(data);
    setStage('review');
  };

  const adjust = (key: 'cals' | 'p' | 'c' | 'f', delta: number) => {
    if (!estimate) return;
    if (key === 'cals') {
      setEstimate({ ...estimate, cals: Math.max(0, estimate.cals + delta) });
    } else {
      setEstimate({ ...estimate, macros: { ...estimate.macros, [key]: Math.max(0, estimate.macros[key] + delta) } });
    }
  };

  const handleClose = () => { stopCamera(); onClose(); };

  return (
    <Sheet onClose={handleClose}>
      {stage !== 'review' ? (
        <div style={{ height: '100%', background: '#000', position: 'relative', display: 'flex', flexDirection: 'column' }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            onCanPlay={() => !cameraReady && startCamera()}
          />
          {!cameraReady && (
            <div
              style={{
                position: 'absolute', inset: 0,
                background: 'radial-gradient(circle at 50% 55%, #3a2e22 0%, #1a1410 38%, #0a0807 70%, #000 100%)',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              onClick={startCamera}
            >
              <Mono style={{ color: 'rgba(255,255,255,0.5)' }}>tap to enable camera</Mono>
            </div>
          )}
          <canvas ref={canvasRef} style={{ display: 'none' }} />

          <div style={{
            position: 'relative', zIndex: 2,
            padding: '60px 22px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <Tappable onClick={handleClose} style={{
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
              { top: 0, left: 0 }, { top: 0, right: 0 },
              { bottom: 0, left: 0 }, { bottom: 0, right: 0 },
            ].map((pos, i) => (
              <div key={i} style={{
                position: 'absolute', width: 28, height: 28, ...pos,
                borderTop: (i < 2) ? '2px solid var(--accent)' : undefined,
                borderBottom: (i >= 2) ? '2px solid var(--accent)' : undefined,
                borderLeft: (i === 0 || i === 2) ? '2px solid var(--accent)' : undefined,
                borderRight: (i === 1 || i === 3) ? '2px solid var(--accent)' : undefined,
              } as React.CSSProperties} />
            ))}
          </div>

          {stage === 'analyzing' && (
            <div style={{
              position: 'absolute', left: '50%', top: '50%',
              transform: 'translate(-50%,-50%)',
              background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(20px)',
              padding: '14px 20px', borderRadius: 14,
              display: 'flex', alignItems: 'center', gap: 12,
              border: '0.5px solid var(--accent)',
            }}>
              <Spinner />
              <Mono style={{ color: '#fff' }}>identifying…</Mono>
            </div>
          )}

          {error && (
            <div style={{
              position: 'absolute', top: 120, left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(255,91,74,0.15)', border: '0.5px solid var(--warn)',
              padding: '10px 16px', borderRadius: 10,
            }}>
              <Mono style={{ color: 'var(--warn)' }}>{error}</Mono>
            </div>
          )}

          <div style={{ position: 'absolute', bottom: 28, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 3 }}>
            <Tappable onClick={stage === 'camera' ? snap : undefined} style={{
              width: 76, height: 76, borderRadius: '50%',
              background: 'transparent',
              border: '3px solid rgba(255,255,255,0.85)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{
                width: 60, height: 60, borderRadius: '50%',
                background: stage === 'analyzing' ? 'var(--accent)' : '#fff',
                transition: 'background 200ms',
              }} />
            </Tappable>
          </div>
        </div>
      ) : estimate && (
        <div style={{ height: '100%', background: 'var(--bg)', color: 'var(--text)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '60px 22px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Tappable onClick={() => { setStage('camera'); startCamera(); }} style={{ padding: 6 }}>
              <Mono style={{ color: 'var(--text-dim)' }}>← retake</Mono>
            </Tappable>
            <Mono style={{ color: 'var(--text-dim)' }}>ai estimate</Mono>
            <Tappable onClick={handleClose} style={{ padding: 6 }}>
              <Mono style={{ color: 'var(--text-faint)' }}>cancel</Mono>
            </Tappable>
          </div>

          <div style={{ padding: '24px 22px 0' }}>
            <div style={{
              height: 160, borderRadius: 22, overflow: 'hidden',
              background: 'radial-gradient(circle at 50% 50%, #c89858, #5a3818 70%, #2a1808 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{
                width: 120, height: 120, borderRadius: '50%',
                background: 'radial-gradient(circle, #d8c8a8, #a89878 60%, #786850 100%)',
              }} />
            </div>
          </div>

          <div style={{ padding: '20px 22px 0' }}>
            <div style={{ fontSize: 22, fontWeight: 500, letterSpacing: -0.4 }}>{estimate.label}</div>
            <Mono style={{ color: 'var(--text-faint)', marginTop: 6 }}>tap any value to nudge</Mono>
          </div>

          <div style={{ padding: '18px 22px 0', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <ValueRow label="calories" value={estimate.cals} unit="cal" step={20} big onAdjust={(d) => adjust('cals', d)} />
            <ValueRow label="protein" value={estimate.macros.p} unit="g" step={2} onAdjust={(d) => adjust('p', d)} />
            <ValueRow label="carbs" value={estimate.macros.c} unit="g" step={5} onAdjust={(d) => adjust('c', d)} />
            <ValueRow label="fat" value={estimate.macros.f} unit="g" step={2} onAdjust={(d) => adjust('f', d)} />
          </div>

          <div style={{ flex: 1 }} />

          <div style={{ padding: '0 22px 28px' }}>
            <Tappable onClick={() => onSave(estimate)} style={{
              background: 'var(--accent)', color: 'var(--accent-ink)',
              padding: '18px 0', borderRadius: 18,
              textAlign: 'center', fontSize: 16, fontWeight: 600,
            }}>Log it</Tappable>
          </div>
        </div>
      )}
    </Sheet>
  );
}
