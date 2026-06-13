import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Home, ListChecks, History, BarChart3, Settings, Plus, Flame, Trophy, Sparkles, Trash2, Check, Pencil, X, RotateCcw, Crown, Lock } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
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

const USER_EMOJIS = ['🦊', '🐧', '🐶', '🐱', '🐻', '🦁', '🐼', '🦄', '🐰', '🦉', '🐯', '🐨'];
const USER_COLORS = ['#FF6B6B', '#06D6A0', '#A78BFA', '#FFD166', '#4D96FF', '#FF8FAB', '#7CCB7B', '#FF9F45'];
const CHORE_EMOJIS = ['🍽️', '🫧', '🧹', '🪣', '🚿', '🛒', '🍳', '👕', '🧺', '🗑️', '🛏️', '🪶', '🪟', '❄️', '🛋️', '📑', '🪴', '🐾', '👔', '🌙', '✨', '🚗', '💻', '📦'];
const CATEGORIES = ['Cucina', 'Pulizia', 'Bucato', 'Gestione', 'Esterno'];

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

const ACHIEVEMENTS = [
  { id: 'first', emoji: '🎯', title: 'Primo passo', desc: 'Completa il tuo primo lavoro', check: (c) => c.userLog.length >= 1 },
  { id: 'ten', emoji: '🚀', title: 'Decollo', desc: '10 lavori completati', check: (c) => c.userLog.length >= 10 },
  { id: 'fifty', emoji: '💪', title: 'Macchina da guerra', desc: '50 lavori completati', check: (c) => c.userLog.length >= 50 },
  { id: 'pts100', emoji: '💯', title: 'Cento punti', desc: 'Raggiungi 100 punti', check: (c) => c.total >= 100 },
  { id: 'pts300', emoji: '👑', title: 'Maestro di casa', desc: 'Raggiungi 300 punti', check: (c) => c.total >= 300 },
  { id: 'streak3', emoji: '🔥', title: 'In fiamme', desc: '3 giorni di fila', check: (c) => c.streak >= 3 },
  { id: 'streak7', emoji: '⚡', title: 'Settimana perfetta', desc: '7 giorni di fila', check: (c) => c.streak >= 7 },
  { id: 'rainbow', emoji: '🌈', title: 'Tutto pulito', desc: 'Un lavoro per ogni categoria', check: (c) => new Set(c.userLog.map((e) => e.category)).size >= CATEGORIES.length },
  { id: 'earlybird', emoji: '🌅', title: 'Mattiniero', desc: 'Lavoro completato prima delle 9:00', check: (c) => c.userLog.some((e) => new Date(e.timestamp).getHours() < 9) },
  { id: 'nightowl', emoji: '🦉', title: 'Gufo notturno', desc: 'Lavoro completato dopo le 22:00', check: (c) => c.userLog.some((e) => new Date(e.timestamp).getHours() >= 22) },
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

function startOfWeek(d = new Date()) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day === 0 ? -6 : 1) - day; // lunedì come inizio settimana
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
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
  const [editingChoreId, setEditingChoreId] = useState(null);
  const [error, setError] = useState(null);
  const dataRef = useRef(null);

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
        setError('Impossibile collegarsi al database condiviso.');
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

  const weeklyTotals = useMemo(() => {
    if (!data) return {};
    const t = {};
    const ws = startOfWeek();
    data.users.forEach((u) => (t[u.id] = 0));
    data.log.forEach((e) => {
      if (new Date(e.timestamp) >= ws) t[e.userId] = (t[e.userId] || 0) + e.points;
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

    const prevUserLog = dataRef.current.log.filter((e) => e.userId === user.id);
    const prevTotal = totals[user.id] || 0;
    const prevUnlocked = ACHIEVEMENTS.filter((a) => a.check({ userLog: prevUserLog, total: prevTotal, streak: streaks[user.id] || 0 }));
    const newUserLog = [entry, ...prevUserLog];
    const newTotal = prevTotal + entry.points;
    const newUnlocked = ACHIEVEMENTS.filter((a) => a.check({ userLog: newUserLog, total: newTotal, streak: (streaks[user.id] || 0) + 1 }));
    const justUnlocked = newUnlocked.find((a) => !prevUnlocked.some((p) => p.id === a.id));

    save(next);
    setPickerChore(null);
    setConfetti({ user, chore, achievement: justUnlocked });
    setTimeout(() => setConfetti(null), justUnlocked ? 2600 : 1800);
  };

  const removeEntry = (id) => {
    save({ ...dataRef.current, log: dataRef.current.log.filter((e) => e.id !== id) });
  };

  const updateUser = (id, patch) => {
    save({ ...dataRef.current, users: dataRef.current.users.map((u) => (u.id === id ? { ...u, ...patch } : u)) });
  };

  const addChore = () => {
    if (!newChore.name.trim()) return;
    const chore = { id: `custom-${Date.now()}`, ...newChore, points: Number(newChore.points) || 1 };
    save({ ...dataRef.current, chores: [...dataRef.current.chores, chore] });
    setNewChore({ name: '', points: 10, emoji: '✨', category: 'Pulizia' });
    setShowAddChore(false);
  };

  const updateChore = (id, patch) => {
    save({ ...dataRef.current, chores: dataRef.current.chores.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
  };

  const removeChore = (id) => {
    save({ ...dataRef.current, chores: dataRef.current.chores.filter((c) => c.id !== id) });
    if (editingChoreId === id) setEditingChoreId(null);
  };

  const resetHistory = () => {
    if (window.confirm("Azzerare tutto lo storico e i punti? I lavori e gli utenti rimangono invariati.")) {
      save({ ...dataRef.current, log: [] });
    }
  };

  if (loading || !data) {
    return (
      <div style={{ background: PALETTE.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', color: PALETTE.plumSoft }}>
        Caricamento...
      </div>
    );
  }

  return (
    <div style={{ background: PALETTE.bg, minHeight: '100vh', fontFamily: "'Nunito', sans-serif", color: PALETTE.plum, paddingBottom: 'calc(92px + env(safe-area-inset-bottom))' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Nunito:wght@400;600;700;800&display=swap');
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        body { margin: 0; }
        .display { font-family: 'Fredoka', sans-serif; }
        @keyframes pop { 0% { transform: scale(0.6) translateY(10px); opacity: 0; } 60% { transform: scale(1.08); opacity: 1; } 100% { transform: scale(1); } }
        @keyframes float-up { 0% { transform: translateY(0) scale(1); opacity: 1; } 100% { transform: translateY(-130px) scale(1.4); opacity: 0; } }
        @keyframes fade-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse-ring { 0% { box-shadow: 0 0 0 0 rgba(255,209,102,0.6); } 100% { box-shadow: 0 0 0 14px rgba(255,209,102,0); } }
        .confetti-piece { position: absolute; font-size: 28px; animation: float-up 1.6s ease-out forwards; }
        .pop-card { animation: pop 0.35s ease-out; }
        .fade-in { animation: fade-in 0.3s ease-out; }
        .achievement-toast { animation: pulse-ring 1.4s ease-out; }
        button { font-family: inherit; }
        ::-webkit-scrollbar { display: none; }
      `}</style>

      {error && (
        <div style={{ background: '#FFE5E5', color: '#C0392B', fontSize: '12px', padding: '8px 16px', textAlign: 'center' }}>
          {error}
        </div>
      )}

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
              {confetti.achievement && (
                <div className="pop-card achievement-toast" style={{ marginTop: '12px', background: PALETTE.sunny, borderRadius: '14px', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '24px' }}>{confetti.achievement.emoji}</span>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#946800' }}>NUOVO TRAGUARDO</div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: PALETTE.plum }}>{confetti.achievement.title}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {pickerChore && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(45,42,74,0.35)', zIndex: 40, display: 'flex', alignItems: 'flex-end' }} onClick={() => setPickerChore(null)}>
          <div className="pop-card" style={{ background: PALETTE.card, width: '100%', borderRadius: '28px 28px 0 0', padding: '24px', paddingBottom: 'calc(24px + env(safe-area-inset-bottom))', boxShadow: '0 -8px 30px rgba(45,42,74,0.15)' }} onClick={(e) => e.stopPropagation()}>
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

      <div style={{ padding: 'calc(20px + env(safe-area-inset-top)) 18px 12px' }}>
        <h1 className="display" style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>🏠 Casa Points</h1>
        <p style={{ margin: '2px 0 0', color: PALETTE.plumSoft, fontSize: '13px' }}>Dividetevi i lavori, raccogliete punti, festeggiate insieme</p>
      </div>

      {tab === 'home' && (
        <div className="fade-in" style={{ padding: '0 18px' }}>
          <div style={{ background: PALETTE.card, borderRadius: '24px', padding: '18px', boxShadow: '0 6px 20px rgba(45,42,74,0.06)', marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '12px' }}>
              {data.users.map((u) => {
                const lvl = getLevel(totals[u.id] || 0);
                const maxRef = Math.max(totals[data.users[0].id] || 0, totals[data.users[1].id] || 0, 50);
                const pct = Math.max(8, ((totals[u.id] || 0) / maxRef) * 100);
                return (
                  <div key={u.id} style={{ flex: 1 }}>
                    <div className="display" style={{ fontSize: '15px', fontWeight: 600, marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '20px' }}>{u.emoji}</span> {u.name}
                    </div>
                    <div style={{ fontSize: '12px', color: PALETTE.plumSoft, marginBottom: '6px' }}>{lvl.emoji} {lvl.title}</div>
                    <div style={{ fontSize: '26px', fontWeight: 800 }} className="display">{totals[u.id] || 0}</div>
                    <div style={{ height: '10px', background: PALETTE.line, borderRadius: '8px', marginTop: '8px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: u.color, borderRadius: '8px', transition: 'width 0.5s ease' }} />
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
        <div className="fade-in" style={{ padding: '0 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div className="display" style={{ fontSize: '15px', fontWeight: 600 }}>Tutti i lavori</div>
            <button onClick={() => setShowAddChore((s) => !s)} style={{ background: PALETTE.lavender, border: 'none', color: '#fff', borderRadius: '12px', padding: '8px 12px', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
              <Plus size={16} /> Nuovo
            </button>
          </div>

          {showAddChore && (
            <div className="pop-card" style={{ background: PALETTE.card, borderRadius: '18px', padding: '14px', marginBottom: '14px', boxShadow: '0 6px 16px rgba(45,42,74,0.06)' }}>
              <input placeholder="Nome del lavoro" value={newChore.name} onChange={(e) => setNewChore({ ...newChore, name: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '10px', border: `1px solid ${PALETTE.line}`, marginBottom: '8px', fontSize: '14px', fontFamily: 'inherit' }} />
              <EmojiPicker options={CHORE_EMOJIS} value={newChore.emoji} onChange={(em) => setNewChore({ ...newChore, emoji: em })} />
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <input type="number" placeholder="Punti" value={newChore.points} onChange={(e) => setNewChore({ ...newChore, points: e.target.value })} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: `1px solid ${PALETTE.line}`, fontSize: '14px' }} />
                <select value={newChore.category} onChange={(e) => setNewChore({ ...newChore, category: e.target.value })} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: `1px solid ${PALETTE.line}`, fontSize: '14px' }}>
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <button onClick={addChore} style={{ width: '100%', marginTop: '8px', background: PALETTE.mint, border: 'none', color: '#fff', borderRadius: '10px', padding: '10px', fontWeight: 700, cursor: 'pointer' }}>Aggiungi lavoro</button>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {data.chores.map((c) => (
              <ChoreRow
                key={c.id}
                chore={c}
                editing={editingChoreId === c.id}
                onEdit={() => setEditingChoreId(editingChoreId === c.id ? null : c.id)}
                onSave={(patch) => { updateChore(c.id, patch); setEditingChoreId(null); }}
                onDelete={() => removeChore(c.id)}
                onLog={() => setPickerChore(c)}
              />
            ))}
          </div>
        </div>
      )}

      {tab === 'history' && (
        <div className="fade-in" style={{ padding: '0 18px' }}>
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

      {tab === 'stats' && <StatsView data={data} totals={totals} weeklyTotals={weeklyTotals} streaks={streaks} />}

      {tab === 'settings' && (
        <div className="fade-in" style={{ padding: '0 18px' }}>
          <div className="display" style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px' }}>Giocatori</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
            {data.users.map((u) => (
              <div key={u.id} style={{ background: PALETTE.card, borderRadius: '18px', padding: '14px', boxShadow: '0 4px 12px rgba(45,42,74,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                  <div style={{ fontSize: '28px' }}>{u.emoji}</div>
                  <input value={u.name} onChange={(e) => updateUser(u.id, { name: e.target.value })} className="display" style={{ flex: 1, border: `1px solid ${PALETTE.line}`, borderRadius: '10px', padding: '8px 10px', fontSize: '15px', fontWeight: 700, color: PALETTE.plum }} />
                </div>
                <div style={{ fontSize: '12px', color: PALETTE.plumSoft, marginBottom: '6px' }}>Avatar</div>
                <EmojiPicker options={USER_EMOJIS} value={u.emoji} onChange={(em) => updateUser(u.id, { emoji: em })} />
                <div style={{ fontSize: '12px', color: PALETTE.plumSoft, margin: '10px 0 6px' }}>Colore</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {USER_COLORS.map((color) => (
                    <button key={color} onClick={() => updateUser(u.id, { color })} style={{ width: '32px', height: '32px', borderRadius: '50%', background: color, border: u.color === color ? `3px solid ${PALETTE.plum}` : '3px solid transparent', cursor: 'pointer' }} />
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="display" style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px' }}>Dati</div>
          <button onClick={resetHistory} style={{ width: '100%', background: PALETTE.card, border: `1px solid ${PALETTE.line}`, color: '#C0392B', borderRadius: '14px', padding: '12px', fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', marginBottom: '24px' }}>
            <RotateCcw size={16} /> Azzera storico e punti
          </button>

          <div className="display" style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px' }}>Suggerimento</div>
          <div style={{ background: PALETTE.card, borderRadius: '16px', padding: '14px', color: PALETTE.plumSoft, fontSize: '13px', marginBottom: '20px', lineHeight: 1.5 }}>
            Per modificare o eliminare un lavoro vai nella tab <strong>Lavori</strong> e tocca l'icona ✏️ su ogni riga: puoi cambiare nome, emoji, punti, categoria oppure eliminarlo.
          </div>
        </div>
      )}

      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: PALETTE.card, boxShadow: '0 -4px 16px rgba(45,42,74,0.08)', display: 'flex', justifyContent: 'space-around', padding: '10px 4px calc(14px + env(safe-area-inset-bottom))', borderRadius: '20px 20px 0 0' }}>
        {[
          { id: 'home', icon: Home, label: 'Home' },
          { id: 'chores', icon: ListChecks, label: 'Lavori' },
          { id: 'history', icon: History, label: 'Storico' },
          { id: 'stats', icon: BarChart3, label: 'Stats' },
          { id: 'settings', icon: Settings, label: 'Impostazioni' },
        ].map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ background: 'transparent', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', color: active ? PALETTE.coral : PALETTE.plumSoft, cursor: 'pointer', fontSize: '10px', fontWeight: 700, transition: 'color 0.2s', flex: 1 }}>
              <Icon size={20} />
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function EmojiPicker({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
      {options.map((em) => (
        <button key={em} onClick={() => onChange(em)} style={{ width: '38px', height: '38px', fontSize: '19px', borderRadius: '10px', border: value === em ? `2px solid ${PALETTE.coral}` : `1px solid ${PALETTE.line}`, background: value === em ? '#FFF0EE' : '#fff', cursor: 'pointer' }}>
          {em}
        </button>
      ))}
    </div>
  );
}

function ChoreRow({ chore, editing, onEdit, onSave, onDelete, onLog }) {
  const [draft, setDraft] = useState(chore);

  useEffect(() => { setDraft(chore); }, [chore, editing]);

  if (editing) {
    return (
      <div className="pop-card" style={{ background: PALETTE.card, borderRadius: '16px', padding: '14px', boxShadow: '0 6px 16px rgba(45,42,74,0.06)' }}>
        <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '10px', border: `1px solid ${PALETTE.line}`, marginBottom: '8px', fontSize: '14px', fontFamily: 'inherit', fontWeight: 700 }} />
        <EmojiPicker options={CHORE_EMOJIS} value={draft.emoji} onChange={(em) => setDraft({ ...draft, emoji: em })} />
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
          <input type="number" value={draft.points} onChange={(e) => setDraft({ ...draft, points: Number(e.target.value) || 0 })} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: `1px solid ${PALETTE.line}`, fontSize: '14px' }} />
          <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: `1px solid ${PALETTE.line}`, fontSize: '14px' }}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
          <button onClick={onDelete} style={{ background: '#FFE5E5', border: 'none', color: '#C0392B', borderRadius: '10px', padding: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700, fontSize: '13px' }}><Trash2 size={15} /> Elimina</button>
          <button onClick={() => onSave(draft)} style={{ flex: 1, background: PALETTE.mint, border: 'none', color: '#fff', borderRadius: '10px', padding: '10px', fontWeight: 700, cursor: 'pointer' }}>Salva</button>
          <button onClick={onEdit} style={{ background: PALETTE.line, border: 'none', color: PALETTE.plumSoft, borderRadius: '10px', padding: '10px', cursor: 'pointer' }}><X size={16} /></button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: PALETTE.card, borderRadius: '16px', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 4px 12px rgba(45,42,74,0.04)' }}>
      <div style={{ fontSize: '24px' }}>{chore.emoji}</div>
      <div style={{ flex: 1 }} onClick={onLog} role="button">
        <div style={{ fontSize: '14px', fontWeight: 700 }}>{chore.name}</div>
        <div style={{ fontSize: '12px', color: PALETTE.plumSoft }}>{chore.category} · {chore.points} punti</div>
      </div>
      <button onClick={onEdit} style={{ background: PALETTE.line, border: 'none', borderRadius: '10px', padding: '8px', color: PALETTE.plumSoft, cursor: 'pointer', display: 'flex' }}><Pencil size={15} /></button>
      <button onClick={onLog} style={{ background: PALETTE.sunny, border: 'none', borderRadius: '12px', padding: '8px 12px', fontWeight: 700, color: PALETTE.plum, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
        <Check size={15} /> Fatto
      </button>
    </div>
  );
}

function StatsView({ data, totals, weeklyTotals, streaks }) {
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

  const weeklyWinner = useMemo(() => {
    const [a, b] = data.users;
    if (!a || !b) return null;
    const ta = weeklyTotals[a.id] || 0;
    const tb = weeklyTotals[b.id] || 0;
    if (ta === 0 && tb === 0) return null;
    if (ta === tb) return 'tie';
    return ta > tb ? a : b;
  }, [data, weeklyTotals]);

  return (
    <div className="fade-in" style={{ padding: '0 18px' }}>
      <div className="display" style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px' }}>Classifica della settimana</div>
      <div style={{ background: PALETTE.card, borderRadius: '20px', padding: '16px', boxShadow: '0 4px 12px rgba(45,42,74,0.05)', marginBottom: '18px' }}>
        {[...data.users].sort((a, b) => (weeklyTotals[b.id] || 0) - (weeklyTotals[a.id] || 0)).map((u, i) => (
          <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: i === 0 ? `1px solid ${PALETTE.line}` : 'none', marginBottom: i === 0 ? '8px' : 0 }}>
            <div style={{ fontSize: '20px', width: '24px', textAlign: 'center' }}>
              {i === 0 && weeklyWinner !== 'tie' && (weeklyTotals[u.id] || 0) > 0 ? <Crown size={20} color={PALETTE.sunny} fill={PALETTE.sunny} /> : (i + 1)}
            </div>
            <div style={{ fontSize: '22px' }}>{u.emoji}</div>
            <div style={{ flex: 1, fontWeight: 700, fontSize: '14px' }}>{u.name}</div>
            <div className="display" style={{ fontWeight: 800, fontSize: '18px', color: u.color }}>{weeklyTotals[u.id] || 0} pt</div>
          </div>
        ))}
        {weeklyWinner === 'tie' && <div style={{ fontSize: '12px', color: PALETTE.plumSoft, textAlign: 'center', marginTop: '6px' }}>Pareggio questa settimana! 🤝</div>}
      </div>

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

      <div className="display" style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px' }}>Livelli</div>
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

      <div className="display" style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px' }}>Traguardi</div>
      {data.users.map((u) => {
        const userLog = data.log.filter((e) => e.userId === u.id);
        const ctx = { userLog, total: totals[u.id] || 0, streak: streaks[u.id] || 0 };
        return (
          <div key={u.id} style={{ background: PALETTE.card, borderRadius: '18px', padding: '14px', boxShadow: '0 4px 12px rgba(45,42,74,0.05)', marginBottom: '12px' }}>
            <div style={{ fontWeight: 800, fontSize: '13px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }} className="display">{u.emoji} {u.name}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
              {ACHIEVEMENTS.map((a) => {
                const unlocked = a.check(ctx);
                return (
                  <div key={a.id} title={`${a.title} — ${a.desc}`} style={{ textAlign: 'center', opacity: unlocked ? 1 : 0.35 }}>
                    <div style={{ fontSize: '24px', position: 'relative' }}>
                      {unlocked ? a.emoji : <Lock size={18} color={PALETTE.plumSoft} />}
                    </div>
                    <div style={{ fontSize: '9px', color: PALETTE.plumSoft, marginTop: '2px', lineHeight: 1.1 }}>{a.title}</div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <div style={{ background: PALETTE.card, borderRadius: '18px', padding: '14px', boxShadow: '0 4px 12px rgba(45,42,74,0.05)', display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px', marginBottom: '20px' }}>
        <Trophy size={28} color={PALETTE.sunny} />
        <div>
          <div style={{ fontWeight: 800, fontSize: '16px' }} className="display">{totalLogged} lavori completati in totale</div>
          <div style={{ fontSize: '12px', color: PALETTE.plumSoft }}>Continuate così! <Sparkles size={12} style={{ display: 'inline' }} /></div>
        </div>
      </div>
    </div>
  );
}
