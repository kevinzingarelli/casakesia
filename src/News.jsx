import React, { useState, useEffect, useCallback } from 'react';
import { X, Check, Sparkles, RefreshCw } from 'lucide-react';
import { CHANGELOG, CURRENT_VERSION, isVersionRead, setVersionRead, unreadCount, markAllRead } from './changelog';
import { parseLocalDate } from './helpers';

// Quante novità non ancora spuntate come lette (per il pallino sulla campanella)
export function useUnreadNews() {
  const [count, setCount] = useState(() => unreadCount());
  const refresh = useCallback(() => setCount(unreadCount()), []);
  return [count, refresh];
}

// Controlla ogni tanto se sul server è stata pubblicata una versione più
// recente di quella che sta girando su questo telefono. La versione in
// esecuzione è quella inclusa nel pacchetto scaricato; version.json viene
// invece riletto dal server ogni volta.
export function useUpdateAvailable() {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    let alive = true;
    const check = async () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;                       // in sviluppo il file non esiste
        const data = await res.json();
        if (alive && data && data.version && data.version !== CURRENT_VERSION) setAvailable(true);
      } catch { /* offline o file assente: si riprova dopo */ }
    };
    check();
    const id = setInterval(check, 15 * 60 * 1000);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    return () => {
      alive = false;
      clearInterval(id);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
    };
  }, []);
  return available;
}

export function UpdateBanner({ t, onOpenNews }) {
  const available = useUpdateAvailable();
  const [dismissed, setDismissed] = useState(false);
  if (!available || dismissed) return null;
  return (
    <div className="pop-card" style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 'calc(88px + env(safe-area-inset-bottom))', zIndex: 65, width: 'min(420px, calc(100vw - 24px))', background: t.card, borderRadius: '16px', boxShadow: '0 8px 28px rgba(45,42,74,0.28)', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
      <span style={{ fontSize: '22px', flexShrink: 0 }}>✨</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: '13px', color: t.text }}>Nuova versione disponibile</div>
        <button onClick={onOpenNews} style={{ background: 'none', border: 'none', padding: 0, fontSize: '12px', color: t.textSoft, cursor: 'pointer', textDecoration: 'underline' }}>Guarda cosa cambia</button>
      </div>
      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
        <button onClick={() => window.location.reload()} style={{ background: t.coral, border: 'none', color: '#fff', borderRadius: '12px', padding: '9px 12px', fontWeight: 800, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}><RefreshCw size={14} /> Aggiorna</button>
        <button onClick={() => setDismissed(true)} style={{ background: 'transparent', border: 'none', color: t.textSoft, cursor: 'pointer', padding: '6px' }}><X size={16} /></button>
      </div>
    </div>
  );
}

export function NewsModal({ t, dark, onClose, onReadChange }) {
  const [, force] = useState(0);
  const bump = () => { force((n) => n + 1); if (onReadChange) onReadChange(); };

  const toggle = (version) => {
    setVersionRead(version, !isVersionRead(version));
    bump();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(45,42,74,0.5)', zIndex: 70, display: 'flex', alignItems: 'flex-end' }} onClick={onClose}>
      <div className="picker-sheet" style={{ background: t.card, width: '100%', borderRadius: '28px 28px 0 0', padding: '22px 20px calc(22px + env(safe-area-inset-bottom))', maxHeight: '88vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <Sparkles size={20} color={t.lavender} />
          <div className="display" style={{ fontSize: '17px', fontWeight: 800, color: t.text, flex: 1 }}>Novità dell'app</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: t.textSoft, cursor: 'pointer' }}><X size={22} /></button>
        </div>
        <div style={{ fontSize: '12px', color: t.textSoft, marginBottom: '16px' }}>
          Stai usando la versione {CURRENT_VERSION}. Spunta «Letto» per ricordarti cosa hai già visto.
        </div>

        <button onClick={() => { markAllRead(); bump(); }} style={{ width: '100%', background: 'transparent', border: `1.5px solid ${t.line}`, color: t.textSoft, borderRadius: '12px', padding: '10px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', marginBottom: '16px' }}>
          Segna tutto come letto
        </button>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {CHANGELOG.map((v) => {
            const read = isVersionRead(v.version);
            const isCurrent = v.version === CURRENT_VERSION;
            return (
              <div key={v.version} style={{ border: `1.5px solid ${read ? t.line : t.lavender}`, borderRadius: '16px', padding: '14px', background: read ? 'transparent' : (dark ? 'rgba(167,139,250,0.08)' : '#F8F6FF') }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="display" style={{ fontSize: '15px', fontWeight: 800, color: t.text }}>
                      {v.title}
                      {isCurrent && <span style={{ fontSize: '10px', background: t.mint, color: '#fff', borderRadius: '8px', padding: '2px 6px', marginLeft: '6px', fontWeight: 800, verticalAlign: 'middle' }}>in uso</span>}
                    </div>
                    <div style={{ fontSize: '11px', color: t.textSoft, marginTop: '2px' }}>
                      Versione {v.version} · {parseLocalDate(v.date).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })} alle {v.time}
                    </div>
                  </div>
                  <button onClick={() => toggle(v.version)} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: read ? t.mint : 'transparent', border: `1.5px solid ${read ? t.mint : t.line}`, color: read ? '#fff' : t.textSoft, borderRadius: '12px', padding: '6px 9px', fontSize: '11px', fontWeight: 800, cursor: 'pointer', flexShrink: 0 }}>
                    <div style={{ width: '14px', height: '14px', borderRadius: '4px', border: `1.5px solid ${read ? '#fff' : t.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {read && <Check size={10} color="#fff" />}
                    </div>
                    Letto
                  </button>
                </div>
                <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {v.items.map((it, i) => (
                    <li key={i} style={{ fontSize: '13px', color: t.text, lineHeight: 1.45 }}>{it}</li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
