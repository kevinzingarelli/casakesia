import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Home, ListChecks, History, BarChart3, Plus, Flame, Trophy, Sparkles, Trash2, Check } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { supabase, TABLE, DATA_ROW_ID } from './supabaseClient';

const PALETTE = {
  bg: '#FFF7ED',
  card: '#FFFFFF',
  coral: '#FF6B6B',
  mint: '#06D6A0',
  lavender: '#A78BFA',
  sunny: '#FFD166',
  plum: '#2D2A4A',
  plumSoft: '#6B6789',
  line: '#FFE8D6',
};

const DEFAULT_CHORES = [
  { id: 'c1', name: 'Lavare i piatti', emoji: '🍽️', points: 10, category: 'Cucina' },
  { id: 'c2', name: 'Lavastoviglie (carico/scarico)', emoji: '🫧', points: 8, category: 'Cucina' },
  { id: 'c3', name: "Passare l'aspirapolvere", emoji: '🧹', points: 15, category: 'Pulizia' },
  { id: 'c4', name: 'Lavare i pavimenti', emoji: '🪣', points: 20, category: 'Pulizia' },
  { id: 'c5', name: 'Pulire il bagno', emoji: '🚿', points: 25, category: 'Pulizia' },
  { id: 'c6', name: 'Fare la spesa', emoji: '🛒', points: 15, category: 'Gestione' },
  { id: 'c7', name: 'Cucinare la cena', emoji: '🍳', points: 20, category: 'Cucina' },
  { id: 'c8', name: 'Stendere il bucato', emoji: '👕', points: 10, category: 'Bucato' },
  { id: 'c9', name: 'Piegare e riporre il bucato', emoji: '🧺', points: 10, category: 'Bucato' },
  { id: 'c10', name: 'Portare fuori la spazzatura', emoji: '🗑️', points: 5, category: 'Pulizia' },
  { id: 'c11', name: 'Cambiare le lenzuola', emoji: '🛏️', points: 15, category: 'Bucato' },
  { id: 'c12', name: 'Spolverare', emoji: '🪶', points: 10, category: 'Pulizia' },
  { id: 'c13', name: 'Pulire i vetri', emoji: '🪟', points: 15, category: 'Pulizia' },
  { id: 'c14', name: 'Pulire forno o frigo', emoji: '❄️', points: 25, category: 'Pulizia' },
  { id: 'c15', name: 'Riordinare il soggiorno', emoji: '🛋️', points: 8, category: 'Pulizia' },
  { id: 'c16', name: 'Bollette e gestione casa', emoji: '📑', points: 12, category: 'Gestione' },
  { id: 'c17', name: 'Curare le piante', emoji: '🪴', points: 5, category: 'Esterno' },
  { id: 'c18', name: 'Animali (passeggiata/pulizia)', emoji: '🐾', points: 8, category: 'Esterno' },
  { id: 'c19', name: 'Stirare', emoji: '👔', points: 15, category: 'Bucato' },
  { id: 'c20', name: 'Pulizia cucina serale', emoji: '🌙', points: 12, category: 'Cucina' },
];

const DEFAULT_USERS = [
  { id: 'u1', name: 'Persona 1', emoji: '🦊', color: PALETTE.coral },
  { id: 'u2', name: 'Persona 2', emoji: '🐧', color: PALETTE.mint },
];

const LEVELS = [
  { min: 0, title: 'Novellino', emoji: '🌱' },
  { min: 50, title: 'Apprendista', emoji: '⭐' },
  { min: 150, title: 'Esperto', emoji: '🔥' },
  { min: 300, title: 'Maestro', emoji: '👑' },
  { min: 500, title: 'Leggenda', emoji: '🏆' },
];

function getLevel(points) {
  let lvl = LEVELS[0];
  for (const l of LEVELS) if (points >= l.min) lvl = l;
  const next = LEVELS.find((l) => l.min > points);
  return { ...lvl, next };
}

function todayStr(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
}

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

const DEFAULT_DATA = { users: DEFAULT_USERS, chores: DEFAULT_CHORES, log: [] };

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('home');
  const [pickerChore, setPickerChore] = useState(null);
  const [confetti, setConfetti] = useState(null);
  const [historyFilter, setHistoryFilter] = useState('all');
  const [newChore, setNewChore] = useState({ name: '', points: 10, emoji: '✨', category: 'Pulizia' });
  const [showAddChore, setShowAddChore] = useState(false);
  const [error, setError] = useState(null);
  const dataRef = useRef(null);

  // Caricamento iniziale + sottoscrizione realtime
  useEffect(() => {
    let channel;

    const load = async () => {
      try {
        const { data: row, error: err } = await supabase
          .from(TABLE)
          .select('value')
          .eq('id', DATA_ROW_ID)
          .single();

        if (err) throw err;

        let value = row?.value;
        if (!value || Object.keys(value).length === 0) {
          value = DEFAULT_DATA;
          await supabase.from(TABLE).update({ value }).eq('id', DATA_ROW_ID);
        }
        dataRef.current = value;
        setData(value);
      } catch (e) {
        console.error(e);
        setError('Impossibile collegarsi al database condiviso. Controlla URL e chiave Supabase.');
        dataRef.current = DEFAULT_DATA;
        setData(DEFAULT_DATA);
      } finally {
        setLoading(false);
      }
    };

    load();

    channel = supabase
      .channel('household_data_changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: TABLE, filter: `id=eq.${DATA_ROW_ID}` }, (payload) => {
        const incoming = payload.new?.value;
        if (incoming) {
          dataRef.current = incoming;
          setData(incoming);
        }
      })
      .subscribe();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const save = async (next) => {
    dataRef.current = next;
    setData(next);
    try {
      const { error: err } = await supabase.from(TABLE).update({ value: next, updated_at: new Date().toISOString() }).eq('id', DATA_ROW_ID);
      if (err) throw err;
    } catch (e) {
      console.error('Errore salvataggio', e);
      setError('Errore di salvataggio: le modifiche potrebbero non essere condivise.');
    }
  };

  const totals = useMemo(() => {
    if (!data) return {};
    const t = {};
    data.users.forEach((u) => (t[u.id] = 0));
    data.log.forEach((e) => {
      t[e.userId] = (t[e.userId] || 0) + e.points;
    });
    return t;
  }, [data]);

  const streaks = useMemo(() => {
    if (!data) return {};
    const s = {};
    data.users.forEach((u) => {
      const days = new Set(data.log.filter((e) => e.userId === u.id).map((e) => e.date));
      let streak = 0;
      let cursor = new Date();
      while (true) {
        const key = todayStr(cursor);
        if (days.has(key)) {
          streak += 1;
          cursor.setDate(cursor.getDate() - 1);
        } else {
          if (key === todayStr() && streak === 0) {
            cursor.setDate(cursor.getDate() - 1);
            if (days.has(todayStr(cursor))) continue;
          }
          break;
        }
      }
      s[u.id] = streak;
    });
    return s;
  }, [data]);

  const logChore = (chore, user) => {
    const now = new Date();
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      userId: user.id,
      choreId: chore.id,
      choreName: chore.name,
      emoji: chore.emoji,
      category: chore.category,
      points: chore.points,
      timestamp: now.toISOString(),
      date: todayStr(now),
    };
    const next = { ...dataRef.current, log: [entry, ...dataRef.current.log] };
    save(next);
    setPickerChore(null);
    setConfetti({ user, chore });
    setTimeout(() => setConfetti(null), 1800);
  };

  const removeEntry = (id) => {
    save({ ...dataRef.current, log: dataRef.current.log.filter((e) => e.id !== id) });
  };

  const updateUserName = (id, name) => {
    save({ ...dataRef.current, users: dataRef.current.users.map((u) => (u.id === id ? { ...u, name } : u)) });
  };

  const addChore = () => {
    if (!newChore.name.trim()) return;
    const chore = { id: `custom-${Date.now()}`, ...newChore, points: Number(newChore.points) || 1 };
    save({ ...dataRef.current, chores: [...dataRef.current.chores, chore] });
    setNewChore({ name: '', points: 10, emoji: '✨', category: 'Pulizia' });
    setShowAddChore(false);
  };

  const removeChore = (id) => {
    save({ ...dataRef.current, chores: dataRef.current.chores.filter((c) => c.id !== id) });
  };

  if (loading || !data) {
    return (
      <div style={{ background: PALETTE.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', color: PALETTE.plumSoft }}>
        Caricamento...
      </div>
    );
  }

  return (
    <div style={{ background: PALETTE.bg, minHeight: '100vh', fontFamily: "'Nunito', sans-serif", color: PALETTE.plum, paddingBottom: '88px' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Nunito:wght@400;600;700;800&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
        .display { font-family: 'Fredoka', sans-serif; }
        @keyframes pop { 0% { transform: scale(0.6) translateY(10px); opacity: 0; } 60% { transform: scale(1.08); opacity: 1; } 100% { transform: scale(1); } }
        @keyframes float-up { 0% { transform: translateY(0) scale(1); opacity: 1; } 100% { transform: translateY(-120px) scale(1.4); opacity: 0; } }
        .confetti-piece { position: absolute; font-size: 28px; animation: float-up 1.6s ease-out forwards; }
        .pop-card { animation: pop 0.35s ease-out; }
      `}</style>

      {error && (
        <div style={{ background: '#FFE5E5', color: '#C0392B', fontSize: '12px', padding: '8px 16px', textAlign: 'center' }}>
          {error}
        </div>
      )}

      {/* Confetti overlay */}
      {confetti && (
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'relative', textAlign: 'center' }}>
            {['🎉', '✨', '⭐', '🎊', '💥', '🌟'].map((e, i) => (
              <span key={i} className="confetti-piece" style={{ left: `${(i - 2.5) * 26}px`, animationDelay: `${i * 0.05}s` }}>{e}</span>
            ))}
            <div className="pop-card display" style={{ background: PALETTE.card, borderRadius: '24px', padding: '20px 28px', boxShadow: '0 12px 30px rgba(45,42,74,0.18)', border: `3px solid ${confetti.user.color}` }}>
              <div style={{ fontSize: '40px' }}>{confetti.chore.emoji}</div>
              <div style={{ fontSize: '20px', fontWeight: 700, marginTop: '4px' }}>+{confetti.chore.points} punti!</div>
              <div style={{ fontSize: '14px', color: PALETTE.plumSoft, marginTop: '2px' }}>{confetti.user.emoji} {confetti.user.name}</div>
            </div>
          </div>
        </div>
      )}

      {/* User picker modal */}
      {pickerChore && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(45,42,74,0.35)', zIndex: 40, display: 'flex', alignItems: 'flex-end' }} onClick={() => setPickerChore(null)}>
          <div className="pop-card" style={{ background: PALETTE.card, width: '100%', borderRadius: '28px 28px 0 0', padding: '24px', boxShadow: '0 -8px 30px rgba(45,42,74,0.15)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <div style={{ fontSize: '36px' }}>{pickerChore.emoji}</div>
              <div className="display" style={{ fontSize: '18px', fontWeight: 600 }}>{pickerChore.name}</div>
              <div style={{ fontSize: '14px', color: PALETTE.plumSoft }}>Chi l'ha fatto? · +{pickerChore.points} punti</div>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              {data.users.map((u) => (
                <button key={u.id} onClick={() => logChore(pickerChore, u)} style={{ flex: 1, background: u.color, border: 'none', borderRadius: '18px', padding: '18px 8px', color: '#fff', fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: '16px', cursor: 'pointer' }}>
                  <div style={{ fontSize: '28px', marginBottom: '4px' }}>{u.emoji}</div>
                  {u.name}
                </button>
              ))}
            </div>
            <button onClick={() => setPickerChore(null)} style={{ width: '100%', marginTop: '12px', background: 'transparent', border: 'none', color: PALETTE.plumSoft, padding: '8px', fontSize: '14px', cursor: 'pointer' }}>Annulla</button>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ padding: '20px 18px 12px' }}>
        <h1 className="display" style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>🏠 Casa Points</h1>
        <p style={{ margin: '2px 0 0', color: PALETTE.plumSoft, fontSize: '13px' }}>Dividetevi i lavori, raccogliete punti, festeggiate insieme</p>
      </div>

      {tab === 'home' && (
        <div style={{ padding: '0 18px' }}>
          {/* Score race */}
          <div style={{ background: PALETTE.card, borderRadius: '24px', padding: '18px', boxShadow: '0 6px 20px rgba(45,42,74,0.06)', marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '12px' }}>
              {data.users.map((u) => {
                const lvl = getLevel(totals[u.id] || 0);
                const maxRef = Math.max(totals[data.users[0].id] || 0, totals[data.users[1].id] || 0, 50);
                const pct = Math.max(8, ((totals[u.id] || 0) / maxRef) * 100);
                return (
                  <div key={u.id} style={{ flex: 1 }}>
                    <input
                      value={u.name}
                      onChange={(e) => updateUserName(u.id, e.target.value)}
                      className="display"
                      style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '15px', fontWeight: 600, color: PALETTE.plum, padding: 0, marginBottom: '2px' }}
                    />
                    <div style={{ fontSize: '12px', color: PALETTE.plumSoft, marginBottom: '6px' }}>{lvl.emoji} {lvl.title}</div>
                    <div style={{ fontSize: '26px', fontWeight: 800 }} className="display">{totals[u.id] || 0}</div>
                    <div style={{ height: '10px', background: PALETTE.line, borderRadius: '8px', marginTop: '8px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: u.color, borderRadius: '8px', transition: 'width 0.4s ease' }} />
                    </div>
                    {streaks[u.id] > 0 && (
                      <div style={{ fontSize: '12px', marginTop: '6px', color: PALETTE.plumSoft, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Flame size={14} color={PALETTE.coral} /> {streaks[u.id]} {streaks[u.id] === 1 ? 'giorno' : 'giorni'} di fila
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick actions */}
          <div className="display" style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px' }}>Azioni rapide</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '18px' }}>
            {data.chores.slice(0, 6).map((c) => (
              <button key={c.id} onClick={() => setPickerChore(c)} style={{ background: PALETTE.card, border: 'none', borderRadius: '18px', padding: '14px 10px', textAlign: 'left', boxShadow: '0 4px 12px rgba(45,42,74,0.05)', cursor: 'pointer' }}>
                <div style={{ fontSize: '24px' }}>{c.emoji}</div>
                <div style={{ fontSize: '13px', fontWeight: 700, marginTop: '4px', lineHeight: 1.2 }}>{c.name}</div>
                <div style={{ fontSize: '12px', color: '#D49A00', fontWeight: 700, marginTop: '2px' }}>+{c.points} pt</div>
              </button>
            ))}
          </div>

          {/* Recent activity */}
          <div className="display" style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px' }}>Ultime attività</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {data.log.length === 0 && (
              <div style={{ background: PALETTE.card, borderRadius: '16px', padding: '16px', color: PALETTE.plumSoft, fontSize: '14px', textAlign: 'center' }}>
                Ancora nessuna attività. Tocca un lavoro qui sopra per iniziare! 🎯
              </div>
            )}
            {data.log.slice(0, 5).map((e) => {
              const u = data.users.find((x) => x.id === e.userId);
              return (
                <div key={e.id} style={{ background: PALETTE.card, borderRadius: '16px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 4px 12px rgba(45,42,74,0.04)' }}>
                  <div style={{ fontSize: '22px' }}>{e.emoji}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 700 }}>{e.choreName}</div>
                    <div style={{ fontSize: '12px', color: PALETTE.plumSoft }}>{u?.emoji} {u?.name} · {formatTime(e.timestamp)}</div>
                  </div>
                  <div style={{ fontWeight: 800, color: u?.color }} className="display">+{e.points}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'chores' && (
        <div style={{ padding: '0 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div className="display" style={{ fontSize: '15px', fontWeight: 600 }}>Tutti i lavori</div>
            <button onClick={() => setShowAddChore((s) => !s)} style={{ background: PALETTE.lavender, border: 'none', color: '#fff', borderRadius: '12px', padding: '8px 12px', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
              <Plus size={16} /> Nuovo
            </button>
          </div>

          {showAddChore && (
            <div className="pop-card" style={{ background: PALETTE.card, borderRadius: '18px', padding: '14px', marginBottom: '14px', boxShadow: '0 6px 16px rgba(45,42,74,0.06)' }}>
              <input placeholder="Nome del lavoro" value={newChore.name} onChange={(e) => setNewChore({ ...newChore, name: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '10px', border: `1px solid ${PALETTE.line}`, marginBottom: '8px', fontSize: '14px', fontFamily: 'inherit' }} />
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <input placeholder="Emoji" value={newChore.emoji} onChange={(e) => setNewChore({ ...newChore, emoji: e.target.value })} style={{ width: '60px', padding: '10px', borderRadius: '10px', border: `1px solid ${PALETTE.line}`, fontSize: '14px', textAlign: 'center' }} />
                <input type="number" placeholder="Punti" value={newChore.points} onChange={(e) => setNewChore({ ...newChore, points: e.target.value })} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: `1px solid ${PALETTE.line}`, fontSize: '14px' }} />
                <select value={newChore.category} onChange={(e) => setNewChore({ ...newChore, category: e.target.value })} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: `1px solid ${PALETTE.line}`, fontSize: '14px' }}>
                  {['Cucina', 'Pulizia', 'Bucato', 'Gestione', 'Esterno'].map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <button onClick={addChore} style={{ width: '100%', background: PALETTE.mint, border: 'none', color: '#fff', borderRadius: '10px', padding: '10px', fontWeight: 700, cursor: 'pointer' }}>Aggiungi lavoro</button>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {data.chores.map((c) => (
              <div key={c.id} style={{ background: PALETTE.card, borderRadius: '16px', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 4px 12px rgba(45,42,74,0.04)' }}>
                <div style={{ fontSize: '24px' }}>{c.emoji}</div>
                <div style={{ flex: 1 }} onClick={() => setPickerChore(c)} role="button">
                  <div style={{ fontSize: '14px', fontWeight: 700 }}>{c.name}</div>
                  <div style={{ fontSize: '12px', color: PALETTE.plumSoft }}>{c.category} · {c.points} punti</div>
                </div>
                <button onClick={() => setPickerChore(c)} style={{ background: PALETTE.sunny, border: 'none', borderRadius: '12px', padding: '8px 12px', fontWeight: 700, color: PALETTE.plum, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Check size={15} /> Fatto
                </button>
                {c.id.startsWith('custom-') && (
                  <button onClick={() => removeChore(c.id)} style={{ background: 'transparent', border: 'none', color: PALETTE.plumSoft, cursor: 'pointer' }}><Trash2 size={16} /></button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'history' && (
        <div style={{ padding: '0 18px' }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
            {['all', ...data.users.map((u) => u.id)].map((f) => {
              const u = data.users.find((x) => x.id === f);
              const active = historyFilter === f;
              return (
                <button key={f} onClick={() => setHistoryFilter(f)} style={{ flex: 1, padding: '8px', borderRadius: '12px', border: 'none', fontWeight: 700, fontSize: '13px', cursor: 'pointer', background: active ? (u ? u.color : PALETTE.plum) : PALETTE.card, color: active ? '#fff' : PALETTE.plumSoft }}>
                  {u ? `${u.emoji} ${u.name}` : 'Tutti'}
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {data.log.filter((e) => historyFilter === 'all' || e.userId === historyFilter).length === 0 && (
              <div style={{ background: PALETTE.card, borderRadius: '16px', padding: '16px', color: PALETTE.plumSoft, fontSize: '14px', textAlign: 'center' }}>Nessuna attività registrata.</div>
            )}
            {data.log.filter((e) => historyFilter === 'all' || e.userId === historyFilter).map((e) => {
              const u = data.users.find((x) => x.id === e.userId);
              return (
                <div key={e.id} style={{ background: PALETTE.card, borderRadius: '16px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 4px 12px rgba(45,42,74,0.04)' }}>
                  <div style={{ fontSize: '22px' }}>{e.emoji}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 700 }}>{e.choreName}</div>
                    <div style={{ fontSize: '12px', color: PALETTE.plumSoft }}>{u?.emoji} {u?.name} · {formatDate(e.timestamp)} alle {formatTime(e.timestamp)}</div>
                  </div>
                  <div style={{ fontWeight: 800, color: u?.color }} className="display">+{e.points}</div>
                  <button onClick={() => removeEntry(e.id)} style={{ background: 'transparent', border: 'none', color: PALETTE.plumSoft, cursor: 'pointer' }}><Trash2 size={16} /></button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'stats' && <StatsView data={data} totals={totals} />}

      {/* Bottom nav */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: PALETTE.card, boxShadow: '0 -4px 16px rgba(45,42,74,0.08)', display: 'flex', justifyContent: 'space-around', padding: '10px 0 16px', borderRadius: '20px 20px 0 0' }}>
        {[
          { id: 'home', icon: Home, label: 'Home' },
          { id: 'chores', icon: ListChecks, label: 'Lavori' },
          { id: 'history', icon: History, label: 'Storico' },
          { id: 'stats', icon: BarChart3, label: 'Stats' },
        ].map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ background: 'transparent', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', color: active ? PALETTE.coral : PALETTE.plumSoft, cursor: 'pointer', fontSize: '11px', fontWeight: 700 }}>
              <Icon size={20} />
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StatsView({ data, totals }) {
  const last7 = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = todayStr(d);
      const row = { date: d.toLocaleDateString('it-IT', { weekday: 'short' }) };
      data.users.forEach((u) => {
        row[u.name] = data.log.filter((e) => e.date === key && e.userId === u.id).reduce((s, e) => s + e.points, 0);
      });
      days.push(row);
    }
    return days;
  }, [data]);

  const byCategory = useMemo(() => {
    const cats = {};
    data.log.forEach((e) => {
      cats[e.category] = (cats[e.category] || 0) + e.points;
    });
    return Object.entries(cats).map(([name, value]) => ({ name, value }));
  }, [data]);

  const pieColors = [PALETTE.coral, PALETTE.mint, PALETTE.lavender, PALETTE.sunny, PALETTE.plumSoft];
  const totalLogged = data.log.length;

  return (
    <div style={{ padding: '0 18px' }}>
      <div className="display" style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px' }}>Punti negli ultimi 7 giorni</div>
      <div style={{ background: PALETTE.card, borderRadius: '20px', padding: '12px', boxShadow: '0 4px 12px rgba(45,42,74,0.05)', marginBottom: '18px' }}>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={last7}>
            <CartesianGrid strokeDasharray="3 3" stroke={PALETTE.line} />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            {data.users.map((u) => (
              <Line key={u.id} type="monotone" dataKey={u.name} stroke={u.color} strokeWidth={3} dot={{ r: 3 }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="display" style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px' }}>Punti per categoria</div>
      <div style={{ background: PALETTE.card, borderRadius: '20px', padding: '12px', boxShadow: '0 4px 12px rgba(45,42,74,0.05)', marginBottom: '18px' }}>
        {byCategory.length === 0 ? (
          <div style={{ color: PALETTE.plumSoft, fontSize: '13px', textAlign: 'center', padding: '20px' }}>Nessun dato ancora.</div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={byCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={{ fontSize: 11 }}>
                {byCategory.map((entry, i) => <Cell key={i} fill={pieColors[i % pieColors.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="display" style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px' }}>Riepilogo</div>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '18px' }}>
        {data.users.map((u) => {
          const lvl = getLevel(totals[u.id] || 0);
          const toNext = lvl.next ? lvl.next.min - (totals[u.id] || 0) : 0;
          return (
            <div key={u.id} style={{ flex: 1, background: PALETTE.card, borderRadius: '18px', padding: '14px', boxShadow: '0 4px 12px rgba(45,42,74,0.05)' }}>
              <div style={{ fontSize: '24px' }}>{lvl.emoji}</div>
              <div style={{ fontWeight: 800, fontSize: '14px' }} className="display">{u.name}</div>
              <div style={{ fontSize: '12px', color: PALETTE.plumSoft, marginBottom: '4px' }}>{lvl.title}</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: u.color }} className="display">{totals[u.id] || 0} pt</div>
              {lvl.next && <div style={{ fontSize: '11px', color: PALETTE.plumSoft, marginTop: '4px' }}>{toNext} pt per "{lvl.next.title}" {lvl.next.emoji}</div>}
            </div>
          );
        })}
      </div>

      <div style={{ background: PALETTE.card, borderRadius: '18px', padding: '14px', boxShadow: '0 4px 12px rgba(45,42,74,0.05)', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
        <Trophy size={28} color={PALETTE.sunny} />
        <div>
          <div style={{ fontWeight: 800, fontSize: '16px' }} className="display">{totalLogged} lavori completati in totale</div>
          <div style={{ fontSize: '12px', color: PALETTE.plumSoft }}>Continuate così! <Sparkles size={12} style={{ display: 'inline' }} /></div>
        </div>
      </div>
    </div>
  );
}
