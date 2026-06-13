import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Home, ListChecks, History, BarChart3, Settings, Plus, Minus, Flame, Trophy, Sparkles, Trash2, Check, Pencil, X, RotateCcw, Crown, Volume2, VolumeX, Moon, Sun, Download, User, Users, Search } from 'lucide-react';
import { supabase, TABLE, DATA_ROW_ID } from './supabaseClient';
import {
  theme, USER_EMOJIS, USER_COLORS, CHORE_EMOJIS, CATEGORIES,
  DEFAULT_CHORES, DEFAULT_USERS, LEVELS, ACHIEVEMENTS,
  todayStr, formatDate, formatTime, getLevel, computeStreak,
  pointsForEntry, choreNameForEntry, achievementContext, uid, startOfWeek,
} from './helpers';
import { playCompletionSound, playAchievementSound, playLevelUpSound, vibrate } from './sounds';
import StatsView from './StatsView';

const DEFAULT_DATA = { users: DEFAULT_USERS, chores: DEFAULT_CHORES, log: [], version: 2 };

// localStorage helpers (identità + preferenze del singolo dispositivo)
const LS_IDENTITY = 'casa-points-identity';
const LS_SOUND = 'casa-points-sound';
const LS_DARK = 'casa-points-dark';

function loadLS(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : JSON.parse(v);
  } catch { return fallback; }
}
function saveLS(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('home');
  const [pickerChore, setPickerChore] = useState(null);
  const [pickerCount, setPickerCount] = useState(1);
  const [pickerForOther, setPickerForOther] = useState(false);
  const [confetti, setConfetti] = useState(null);
  const [historyFilter, setHistoryFilter] = useState('all');
  const [historyCat, setHistoryCat] = useState('all');
  const [historySearch, setHistorySearch] = useState('');
  const [newChore, setNewChore] = useState({ name: '', points: 10, emoji: '✨', category: 'Pulizia' });
  const [showAddChore, setShowAddChore] = useState(false);
  const [editingChoreId, setEditingChoreId] = useState(null);
  const [error, setError] = useState(null);
  const [identity, setIdentity] = useState(() => loadLS(LS_IDENTITY, null));
  const [soundOn, setSoundOn] = useState(() => loadLS(LS_SOUND, true));
  const [dark, setDark] = useState(() => loadLS(LS_DARK, null));
  const dataRef = useRef(null);
  const saveTimer = useRef(null);

  const t = theme(dark);

  // Rileva preferenza sistema per dark mode se non impostata
  useEffect(() => {
    if (dark === null && typeof window !== 'undefined' && window.matchMedia) {
      setDark(window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
  }, []);

  useEffect(() => { if (dark !== null) saveLS(LS_DARK, dark); }, [dark]);
  useEffect(() => { saveLS(LS_SOUND, soundOn); }, [soundOn]);
  useEffect(() => { saveLS(LS_IDENTITY, identity); }, [identity]);

  // Mappa lavori per id (per calcolo retroattivo punti)
  const choresById = useMemo(() => {
    const m = {};
    if (data) data.chores.forEach((c) => { m[c.id] = c; });
    return m;
  }, [data]);

  // ---- Caricamento + realtime ----
  useEffect(() => {
    let channel;
    const load = async () => {
      try {
        const { data: row, error: err } = await supabase
          .from(TABLE).select('value').eq('id', DATA_ROW_ID).single();
        if (err) throw err;
        let value = row?.value;
        if (!value || Object.keys(value).length === 0) {
          value = DEFAULT_DATA;
          await supabase.from(TABLE).update({ value }).eq('id', DATA_ROW_ID);
        }
        // Migrazione: se i log hanno "points" fissi (v1), li teniamo come snapshot
        if (!value.version) {
          value.log = (value.log || []).map((e) => ({
            ...e,
            snapshotPoints: e.points,
            snapshotName: e.choreName,
            snapshotEmoji: e.emoji,
            snapshotCategory: e.category,
          }));
          value.version = 2;
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
          // Aggiornamento dal server: sostituisce sempre lo stato locale.
          dataRef.current = incoming;
          setData(incoming);
        }
      })
      .subscribe();

    return () => { if (channel) supabase.removeChannel(channel); };
  }, []);

  // Salvataggio con debounce per ridurre conflitti di scrittura simultanea
  const save = (next) => {
    dataRef.current = next;
    setData(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const { error: err } = await supabase
          .from(TABLE).update({ value: next, updated_at: new Date().toISOString() }).eq('id', DATA_ROW_ID);
        if (err) throw err;
      } catch (e) {
        console.error('Errore salvataggio', e);
        setError('Errore di salvataggio: le modifiche potrebbero non essere condivise.');
      }
    }, 250);
  };

  // ---- Totali e streak (con calcolo retroattivo) ----
  const totals = useMemo(() => {
    if (!data) return {};
    const tot = {};
    data.users.forEach((u) => (tot[u.id] = 0));
    data.log.forEach((e) => { tot[e.userId] = (tot[e.userId] || 0) + pointsForEntry(e, choresById); });
    return tot;
  }, [data, choresById]);

  const streaks = useMemo(() => {
    if (!data) return {};
    const s = {};
    data.users.forEach((u) => { s[u.id] = computeStreak(data.log, u.id); });
    return s;
  }, [data]);

  // ---- Registrazione lavoro (con conteggio multiplo) ----
  const logChore = (chore, user, count = 1) => {
    const now = new Date();
    const entries = [];
    for (let i = 0; i < count; i++) {
      const ts = new Date(now.getTime() + i); // timestamp leggermente diversi
      entries.push({
        id: uid(),
        userId: user.id,
        choreId: chore.id,
        // snapshot per fallback se il lavoro viene eliminato in futuro
        snapshotPoints: chore.points,
        snapshotName: chore.name,
        snapshotEmoji: chore.emoji,
        snapshotCategory: chore.category,
        timestamp: ts.toISOString(),
        date: todayStr(ts),
      });
    }
    const next = { ...dataRef.current, log: [...entries, ...dataRef.current.log] };

    // Calcolo traguardi e livelli PRIMA/DOPO per i toast
    const otherId = dataRef.current.users.find((x) => x.id !== user.id)?.id;
    const prevCtx = achievementContext(dataRef.current.log, choresById, user.id, otherId);
    const prevLevel = getLevel(totals[user.id] || 0);
    const newCtx = achievementContext(next.log, choresById, user.id, otherId);
    const newTotal = next.log.filter((e) => e.userId === user.id).reduce((s, e) => s + pointsForEntry(e, choresById), 0);
    const newLevel = getLevel(newTotal);

    const prevUnlocked = ACHIEVEMENTS.filter((a) => a.check(prevCtx)).map((a) => a.id);
    const justUnlocked = ACHIEVEMENTS.find((a) => a.check(newCtx) && !prevUnlocked.includes(a.id));
    const leveledUp = newLevel.title !== prevLevel.title;

    save(next);
    setPickerChore(null);
    setPickerCount(1);
    setPickerForOther(false);

    const pts = chore.points * count;
    vibrate(count > 1 ? [15, 40, 15] : 15);
    if (leveledUp) playLevelUpSound(soundOn);
    else if (justUnlocked) playAchievementSound(soundOn);
    else playCompletionSound(chore.points, soundOn);

    setConfetti({ user, chore, count, points: pts, achievement: justUnlocked, levelUp: leveledUp ? newLevel : null });
    setTimeout(() => setConfetti(null), (justUnlocked || leveledUp) ? 2800 : 1800);
  };

  const removeEntry = (id) => {
    save({ ...dataRef.current, log: dataRef.current.log.filter((e) => e.id !== id) });
  };

  const updateUser = (id, patch) => {
    save({ ...dataRef.current, users: dataRef.current.users.map((u) => (u.id === id ? { ...u, ...patch } : u)) });
  };

  const addChore = () => {
    if (!newChore.name.trim()) return;
    const chore = { id: `custom-${uid()}`, ...newChore, points: Number(newChore.points) || 1 };
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
    if (window.confirm("Azzerare tutto lo storico e i punti? I lavori e i giocatori restano invariati.")) {
      save({ ...dataRef.current, log: [] });
    }
  };

  // ---- Export CSV ----
  const exportCSV = () => {
    const rows = [['Data', 'Ora', 'Persona', 'Lavoro', 'Categoria', 'Punti']];
    [...dataRef.current.log].reverse().forEach((e) => {
      const u = dataRef.current.users.find((x) => x.id === e.userId);
      const info = choreNameForEntry(e, choresById);
      const d = new Date(e.timestamp);
      rows.push([
        d.toLocaleDateString('it-IT'), d.toLocaleTimeString('it-IT'),
        u?.name || '?', info.name, info.category, pointsForEntry(e, choresById),
      ]);
    });
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `casa-points-${todayStr()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Identità corrente (oggetto utente o null)
  const me = useMemo(() => {
    if (!data || !identity) return null;
    return data.users.find((u) => u.id === identity) || null;
  }, [data, identity]);

  // Quando si tocca "Fatto": se ho un'identità, registro per me; altrimenti chiedo
  const handleChoreClick = (chore) => {
    setPickerCount(1);
    setPickerForOther(false);
    if (me) {
      // Apriamo comunque il mini-picker per scegliere quante volte
      setPickerChore(chore);
    } else {
      setPickerChore(chore);
    }
  };

  if (loading || !data) {
    return (
      <div style={{ background: t.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', color: t.textSoft }}>
        Caricamento...
      </div>
    );
  }

  // Lavoro del giorno (deterministico per data)
  const dailyChore = (() => {
    if (data.chores.length === 0) return null;
    const seed = todayStr().split('-').join('');
    const idx = parseInt(seed, 10) % data.chores.length;
    return data.chores[idx];
  })();

  const cardShadow = dark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(45,42,74,0.05)';
  const otherUser = me ? data.users.find((u) => u.id !== me.id) : null;
  const pickerTarget = pickerForOther && otherUser ? otherUser : me;

  return (
    <div style={{ background: t.bg, minHeight: '100vh', fontFamily: "'Nunito', sans-serif", color: t.text, paddingBottom: 'calc(92px + env(safe-area-inset-bottom))', transition: 'background 0.3s' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Nunito:wght@400;600;700;800&display=swap');
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        body { margin: 0; }
        .display { font-family: 'Fredoka', sans-serif; }
        @keyframes pop { 0% { transform: scale(0.6) translateY(10px); opacity: 0; } 60% { transform: scale(1.08); opacity: 1; } 100% { transform: scale(1); } }
        @keyframes float-up { 0% { transform: translateY(0) scale(1); opacity: 1; } 100% { transform: translateY(-130px) scale(1.4); opacity: 0; } }
        @keyframes fade-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse-ring { 0% { box-shadow: 0 0 0 0 rgba(255,209,102,0.6); } 100% { box-shadow: 0 0 0 16px rgba(255,209,102,0); } }
        @keyframes shimmer { 0%,100% { opacity: 1; } 50% { opacity: 0.6; } }
        .confetti-piece { position: absolute; font-size: 28px; animation: float-up 1.6s ease-out forwards; }
        .pop-card { animation: pop 0.35s ease-out; }
        .fade-in { animation: fade-in 0.3s ease-out; }
        .achievement-toast { animation: pulse-ring 1.4s ease-out; }
        .daily-badge { animation: shimmer 2s ease-in-out infinite; }
        button { font-family: inherit; }
        ::-webkit-scrollbar { display: none; }
        input, select { background: ${t.card}; color: ${t.text}; }
      `}</style>

      {error && (
        <div style={{ background: '#FFE5E5', color: '#C0392B', fontSize: '12px', padding: '8px 16px', textAlign: 'center' }}>{error}</div>
      )}

      {/* Confetti / toast */}
      {confetti && (
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'relative', textAlign: 'center' }}>
            {['🎉', '✨', '⭐', '🎊', '💥', '🌟'].map((e, i) => (
              <span key={i} className="confetti-piece" style={{ left: `${(i - 2.5) * 26}px`, animationDelay: `${i * 0.05}s` }}>{e}</span>
            ))}
            <div className="pop-card display" style={{ background: t.card, borderRadius: '24px', padding: '20px 28px', boxShadow: '0 12px 30px rgba(45,42,74,0.25)', border: `3px solid ${confetti.user.color}` }}>
              <div style={{ fontSize: '40px' }}>{confetti.chore.emoji}</div>
              <div style={{ fontSize: '20px', fontWeight: 700, marginTop: '4px', color: t.text }}>
                +{confetti.points} punti!{confetti.count > 1 ? ` (×${confetti.count})` : ''}
              </div>
              <div style={{ fontSize: '14px', color: t.textSoft, marginTop: '2px' }}>{confetti.user.emoji} {confetti.user.name}</div>
              {confetti.levelUp && (
                <div className="pop-card achievement-toast" style={{ marginTop: '12px', background: confetti.user.color, borderRadius: '14px', padding: '10px 16px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>LIVELLO RAGGIUNTO</div>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#fff' }}>{confetti.levelUp.emoji} {confetti.levelUp.title}</div>
                </div>
              )}
              {confetti.achievement && !confetti.levelUp && (
                <div className="pop-card achievement-toast" style={{ marginTop: '12px', background: t.sunny, borderRadius: '14px', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '24px' }}>{confetti.achievement.emoji}</span>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#946800' }}>NUOVO TRAGUARDO</div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#2D2A4A' }}>{confetti.achievement.title}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Picker: chi + quante volte */}
      {pickerChore && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(45,42,74,0.4)', zIndex: 40, display: 'flex', alignItems: 'flex-end' }} onClick={() => setPickerChore(null)}>
          <div className="pop-card" style={{ background: t.card, width: '100%', borderRadius: '28px 28px 0 0', padding: '24px', paddingBottom: 'calc(24px + env(safe-area-inset-bottom))', boxShadow: '0 -8px 30px rgba(45,42,74,0.2)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <div style={{ fontSize: '36px' }}>{pickerChore.emoji}</div>
              <div className="display" style={{ fontSize: '18px', fontWeight: 600, color: t.text }}>{pickerChore.name}</div>
              <div style={{ fontSize: '14px', color: t.textSoft }}>+{pickerChore.points * pickerCount} punti{pickerCount > 1 ? ` (${pickerChore.points} × ${pickerCount})` : ''}</div>
            </div>

            {/* Selettore quantità */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px', marginBottom: '18px' }}>
              <button onClick={() => setPickerCount((c) => Math.max(1, c - 1))} style={{ width: '44px', height: '44px', borderRadius: '50%', border: `2px solid ${t.line}`, background: t.card, color: t.text, fontSize: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Minus size={20} /></button>
              <div className="display" style={{ fontSize: '32px', fontWeight: 800, minWidth: '50px', textAlign: 'center', color: t.text }}>{pickerCount}</div>
              <button onClick={() => setPickerCount((c) => Math.min(20, c + 1))} style={{ width: '44px', height: '44px', borderRadius: '50%', border: `2px solid ${t.line}`, background: t.card, color: t.text, fontSize: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={20} /></button>
            </div>
            <div style={{ fontSize: '11px', color: t.textSoft, textAlign: 'center', marginTop: '-10px', marginBottom: '14px' }}>Quante volte l'hai fatto?</div>

            {/* Se ho identità: bottone veloce "io" + "l'altro". Altrimenti scelta classica */}
            {me ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button onClick={() => logChore(pickerChore, me, pickerCount)} style={{ background: me.color, border: 'none', borderRadius: '18px', padding: '16px', color: '#fff', fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: '17px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '24px' }}>{me.emoji}</span> L'ho fatto io ({me.name})
                </button>
                {otherUser && (
                  <button onClick={() => logChore(pickerChore, otherUser, pickerCount)} style={{ background: 'transparent', border: `2px solid ${otherUser.color}`, borderRadius: '18px', padding: '12px', color: otherUser.color, fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '20px' }}>{otherUser.emoji}</span> L'ha fatto {otherUser.name}
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '12px' }}>
                {data.users.map((u) => (
                  <button key={u.id} onClick={() => logChore(pickerChore, u, pickerCount)} style={{ flex: 1, background: u.color, border: 'none', borderRadius: '18px', padding: '18px 8px', color: '#fff', fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: '16px', cursor: 'pointer' }}>
                    <div style={{ fontSize: '28px', marginBottom: '4px' }}>{u.emoji}</div>
                    {u.name}
                  </button>
                ))}
              </div>
            )}
            <button onClick={() => setPickerChore(null)} style={{ width: '100%', marginTop: '12px', background: 'transparent', border: 'none', color: t.textSoft, padding: '8px', fontSize: '14px', cursor: 'pointer' }}>Annulla</button>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ padding: 'calc(20px + env(safe-area-inset-top)) 18px 12px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="display" style={{ fontSize: '24px', fontWeight: 700, margin: 0, color: t.text }}>🏠 Casa Points</h1>
          <p style={{ margin: '2px 0 0', color: t.textSoft, fontSize: '13px' }}>
            {me ? `Ciao ${me.name}! ${me.emoji}` : 'Dividetevi i lavori, raccogliete punti'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={() => setSoundOn((s) => !s)} style={{ background: t.card, border: 'none', borderRadius: '12px', width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.textSoft, cursor: 'pointer', boxShadow: cardShadow }}>
            {soundOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
          <button onClick={() => setDark((d) => !d)} style={{ background: t.card, border: 'none', borderRadius: '12px', width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.textSoft, cursor: 'pointer', boxShadow: cardShadow }}>
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </div>

      {/* Banner identità se non impostata */}
      {!me && (
        <div style={{ margin: '0 18px 12px', background: t.card, borderRadius: '16px', padding: '14px', boxShadow: cardShadow }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: t.text, marginBottom: '8px' }}>👋 Chi sei? (così segni più velocemente)</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {data.users.map((u) => (
              <button key={u.id} onClick={() => setIdentity(u.id)} style={{ flex: 1, background: u.color, border: 'none', borderRadius: '12px', padding: '10px', color: '#fff', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}>
                {u.emoji} {u.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ---------------- HOME ---------------- */}
      {tab === 'home' && (
        <div className="fade-in" style={{ padding: '0 18px' }}>
          {/* Score race */}
          <div style={{ background: t.card, borderRadius: '24px', padding: '18px', boxShadow: cardShadow, marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '12px' }}>
              {data.users.map((u) => {
                const lvl = getLevel(totals[u.id] || 0);
                const maxRef = Math.max(totals[data.users[0].id] || 0, totals[data.users[1]?.id] || 0, 50);
                const pct = Math.max(8, ((totals[u.id] || 0) / maxRef) * 100);
                return (
                  <div key={u.id} style={{ flex: 1 }}>
                    <div className="display" style={{ fontSize: '15px', fontWeight: 600, marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '6px', color: t.text }}>
                      <span style={{ fontSize: '20px' }}>{u.emoji}</span> {u.name}
                      {me && me.id === u.id && <span style={{ fontSize: '10px', background: u.color, color: '#fff', borderRadius: '6px', padding: '1px 5px' }}>tu</span>}
                    </div>
                    <div style={{ fontSize: '12px', color: t.textSoft, marginBottom: '6px' }}>{lvl.emoji} {lvl.title}</div>
                    <div style={{ fontSize: '26px', fontWeight: 800, color: t.text }} className="display">{totals[u.id] || 0}</div>
                    <div style={{ height: '10px', background: t.line, borderRadius: '8px', marginTop: '8px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: u.color, borderRadius: '8px', transition: 'width 0.5s ease' }} />
                    </div>
                    {streaks[u.id] > 0 && (
                      <div style={{ fontSize: '12px', marginTop: '6px', color: t.textSoft, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Flame size={14} color={t.coral} /> {streaks[u.id]} {streaks[u.id] === 1 ? 'giorno' : 'giorni'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Lavoro del giorno */}
          {dailyChore && (
            <div className="daily-badge" onClick={() => handleChoreClick({ ...dailyChore, points: dailyChore.points * 2 })} style={{ background: `linear-gradient(135deg, ${t.sunny}, ${t.coral})`, borderRadius: '18px', padding: '14px 16px', marginBottom: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: cardShadow }}>
              <div style={{ fontSize: '32px' }}>{dailyChore.emoji}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '11px', fontWeight: 800, color: 'rgba(255,255,255,0.9)' }}>⭐ LAVORO DEL GIORNO · PUNTI DOPPI</div>
                <div style={{ fontSize: '16px', fontWeight: 800, color: '#fff' }} className="display">{dailyChore.name}</div>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.9)', fontWeight: 700 }}>+{dailyChore.points * 2} pt invece di {dailyChore.points}</div>
              </div>
            </div>
          )}

          {/* Azioni rapide */}
          <div className="display" style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px', color: t.text }}>Azioni rapide</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '18px' }}>
            {data.chores.slice(0, 6).map((c) => (
              <button key={c.id} onClick={() => handleChoreClick(c)} style={{ background: t.card, border: 'none', borderRadius: '18px', padding: '14px 10px', textAlign: 'left', boxShadow: cardShadow, cursor: 'pointer' }}>
                <div style={{ fontSize: '24px' }}>{c.emoji}</div>
                <div style={{ fontSize: '13px', fontWeight: 700, marginTop: '4px', lineHeight: 1.2, color: t.text }}>{c.name}</div>
                <div style={{ fontSize: '12px', color: '#D49A00', fontWeight: 700, marginTop: '2px' }}>+{c.points} pt</div>
              </button>
            ))}
          </div>

          {/* Ultime attività */}
          <div className="display" style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px', color: t.text }}>Ultime attività</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {data.log.length === 0 && (
              <div style={{ background: t.card, borderRadius: '16px', padding: '16px', color: t.textSoft, fontSize: '14px', textAlign: 'center' }}>
                Ancora nessuna attività. Tocca un lavoro per iniziare! 🎯
              </div>
            )}
            {data.log.slice(0, 6).map((e) => {
              const u = data.users.find((x) => x.id === e.userId);
              const info = choreNameForEntry(e, choresById);
              return (
                <div key={e.id} style={{ background: t.card, borderRadius: '16px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: cardShadow }}>
                  <div style={{ fontSize: '22px' }}>{info.emoji}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: t.text }}>{info.name}</div>
                    <div style={{ fontSize: '12px', color: t.textSoft }}>{u?.emoji} {u?.name} · {formatTime(e.timestamp)}</div>
                  </div>
                  <div style={{ fontWeight: 800, color: u?.color }} className="display">+{pointsForEntry(e, choresById)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ---------------- LAVORI ---------------- */}
      {tab === 'chores' && (
        <div className="fade-in" style={{ padding: '0 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div className="display" style={{ fontSize: '15px', fontWeight: 600, color: t.text }}>Tutti i lavori</div>
            <button onClick={() => setShowAddChore((s) => !s)} style={{ background: t.lavender, border: 'none', color: '#fff', borderRadius: '12px', padding: '8px 12px', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
              <Plus size={16} /> Nuovo
            </button>
          </div>

          {showAddChore && (
            <div className="pop-card" style={{ background: t.card, borderRadius: '18px', padding: '14px', marginBottom: '14px', boxShadow: cardShadow }}>
              <input placeholder="Nome del lavoro" value={newChore.name} onChange={(e) => setNewChore({ ...newChore, name: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '10px', border: `1px solid ${t.line}`, marginBottom: '8px', fontSize: '14px', fontFamily: 'inherit' }} />
              <EmojiPicker options={CHORE_EMOJIS} value={newChore.emoji} onChange={(em) => setNewChore({ ...newChore, emoji: em })} t={t} />
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <input type="number" placeholder="Punti" value={newChore.points} onChange={(e) => setNewChore({ ...newChore, points: e.target.value })} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: `1px solid ${t.line}`, fontSize: '14px' }} />
                <select value={newChore.category} onChange={(e) => setNewChore({ ...newChore, category: e.target.value })} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: `1px solid ${t.line}`, fontSize: '14px' }}>
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <button onClick={addChore} style={{ width: '100%', marginTop: '8px', background: t.mint, border: 'none', color: '#fff', borderRadius: '10px', padding: '10px', fontWeight: 700, cursor: 'pointer' }}>Aggiungi lavoro</button>
            </div>
          )}

          <div style={{ fontSize: '11px', color: t.textSoft, marginBottom: '10px', background: t.card, borderRadius: '12px', padding: '10px 12px' }}>
            💡 Cambiando i punti di un lavoro, <strong>tutto lo storico si ricalcola</strong> automaticamente con il nuovo valore.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {data.chores.map((c) => (
              <ChoreRow key={c.id} chore={c} editing={editingChoreId === c.id} t={t}
                onEdit={() => setEditingChoreId(editingChoreId === c.id ? null : c.id)}
                onSave={(patch) => { updateChore(c.id, patch); setEditingChoreId(null); }}
                onDelete={() => removeChore(c.id)}
                onLog={() => handleChoreClick(c)} />
            ))}
          </div>
        </div>
      )}

      {/* ---------------- STORICO ---------------- */}
      {tab === 'history' && (
        <div className="fade-in" style={{ padding: '0 18px' }}>
          {/* Ricerca */}
          <div style={{ position: 'relative', marginBottom: '10px' }}>
            <Search size={16} color={t.textSoft} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input placeholder="Cerca un lavoro..." value={historySearch} onChange={(e) => setHistorySearch(e.target.value)} style={{ width: '100%', padding: '10px 10px 10px 36px', borderRadius: '12px', border: `1px solid ${t.line}`, fontSize: '14px' }} />
          </div>
          {/* Filtro persona */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            {['all', ...data.users.map((u) => u.id)].map((f) => {
              const u = data.users.find((x) => x.id === f);
              const active = historyFilter === f;
              return (
                <button key={f} onClick={() => setHistoryFilter(f)} style={{ flex: 1, padding: '8px', borderRadius: '12px', border: 'none', fontWeight: 700, fontSize: '13px', cursor: 'pointer', background: active ? (u ? u.color : t.coral) : t.card, color: active ? '#fff' : t.textSoft }}>
                  {u ? `${u.emoji} ${u.name}` : 'Tutti'}
                </button>
              );
            })}
          </div>
          {/* Filtro categoria */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', flexWrap: 'wrap' }}>
            {['all', ...CATEGORIES].map((cat) => {
              const active = historyCat === cat;
              return (
                <button key={cat} onClick={() => setHistoryCat(cat)} style={{ padding: '6px 10px', borderRadius: '10px', border: 'none', fontWeight: 700, fontSize: '12px', cursor: 'pointer', background: active ? t.lavender : t.card, color: active ? '#fff' : t.textSoft }}>
                  {cat === 'all' ? 'Tutte' : cat}
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {(() => {
              const filtered = data.log.filter((e) => {
                if (historyFilter !== 'all' && e.userId !== historyFilter) return false;
                const info = choreNameForEntry(e, choresById);
                if (historyCat !== 'all' && info.category !== historyCat) return false;
                if (historySearch && !info.name.toLowerCase().includes(historySearch.toLowerCase())) return false;
                return true;
              });
              if (filtered.length === 0) return <div style={{ background: t.card, borderRadius: '16px', padding: '16px', color: t.textSoft, fontSize: '14px', textAlign: 'center' }}>Nessuna attività trovata.</div>;
              return filtered.map((e) => {
                const u = data.users.find((x) => x.id === e.userId);
                const info = choreNameForEntry(e, choresById);
                return (
                  <div key={e.id} style={{ background: t.card, borderRadius: '16px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: cardShadow }}>
                    <div style={{ fontSize: '22px' }}>{info.emoji}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: t.text }}>{info.name}</div>
                      <div style={{ fontSize: '12px', color: t.textSoft }}>{u?.emoji} {u?.name} · {formatDate(e.timestamp)} alle {formatTime(e.timestamp)}</div>
                    </div>
                    <div style={{ fontWeight: 800, color: u?.color }} className="display">+{pointsForEntry(e, choresById)}</div>
                    <button onClick={() => removeEntry(e.id)} style={{ background: 'transparent', border: 'none', color: t.textSoft, cursor: 'pointer' }}><Trash2 size={16} /></button>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {/* ---------------- STATS ---------------- */}
      {tab === 'stats' && <StatsView data={data} choresById={choresById} t={t} dark={dark} />}

      {/* ---------------- IMPOSTAZIONI ---------------- */}
      {tab === 'settings' && (
        <div className="fade-in" style={{ padding: '0 18px' }}>
          {/* Identità */}
          <div className="display" style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px', color: t.text }}>La tua identità su questo telefono</div>
          <div style={{ background: t.card, borderRadius: '18px', padding: '14px', boxShadow: cardShadow, marginBottom: '20px' }}>
            <div style={{ fontSize: '12px', color: t.textSoft, marginBottom: '10px' }}>Scegli chi sei: i lavori che segni saranno automaticamente tuoi.</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {data.users.map((u) => (
                <button key={u.id} onClick={() => setIdentity(u.id)} style={{ flex: 1, background: identity === u.id ? u.color : 'transparent', border: `2px solid ${u.color}`, borderRadius: '12px', padding: '10px', color: identity === u.id ? '#fff' : u.color, fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}>
                  {u.emoji} {u.name} {identity === u.id ? '✓' : ''}
                </button>
              ))}
            </div>
            {me && <button onClick={() => setIdentity(null)} style={{ width: '100%', marginTop: '8px', background: 'transparent', border: 'none', color: t.textSoft, fontSize: '12px', cursor: 'pointer' }}>Rimuovi identità</button>}
          </div>

          {/* Giocatori */}
          <div className="display" style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px', color: t.text }}>Giocatori</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
            {data.users.map((u) => (
              <div key={u.id} style={{ background: t.card, borderRadius: '18px', padding: '14px', boxShadow: cardShadow }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                  <div style={{ fontSize: '28px' }}>{u.emoji}</div>
                  <input value={u.name} onChange={(e) => updateUser(u.id, { name: e.target.value })} className="display" style={{ flex: 1, border: `1px solid ${t.line}`, borderRadius: '10px', padding: '8px 10px', fontSize: '15px', fontWeight: 700 }} />
                </div>
                <div style={{ fontSize: '12px', color: t.textSoft, marginBottom: '6px' }}>Avatar</div>
                <EmojiPicker options={USER_EMOJIS} value={u.emoji} onChange={(em) => updateUser(u.id, { emoji: em })} t={t} />
                <div style={{ fontSize: '12px', color: t.textSoft, margin: '10px 0 6px' }}>Colore</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {USER_COLORS.map((color) => (
                    <button key={color} onClick={() => updateUser(u.id, { color })} style={{ width: '32px', height: '32px', borderRadius: '50%', background: color, border: u.color === color ? `3px solid ${t.text}` : '3px solid transparent', cursor: 'pointer' }} />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Preferenze */}
          <div className="display" style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px', color: t.text }}>Preferenze</div>
          <div style={{ background: t.card, borderRadius: '18px', padding: '4px 14px', boxShadow: cardShadow, marginBottom: '20px' }}>
            <ToggleRow label="🔊 Suoni" value={soundOn} onChange={() => setSoundOn((s) => !s)} t={t} />
            <ToggleRow label="🌙 Tema scuro" value={!!dark} onChange={() => setDark((d) => !d)} t={t} last />
          </div>

          {/* Dati */}
          <div className="display" style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px', color: t.text }}>Dati</div>
          <button onClick={exportCSV} style={{ width: '100%', background: t.card, border: `1px solid ${t.line}`, color: t.text, borderRadius: '14px', padding: '12px', fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', marginBottom: '10px' }}>
            <Download size={16} /> Esporta storico (CSV)
          </button>
          <button onClick={resetHistory} style={{ width: '100%', background: t.card, border: `1px solid ${t.line}`, color: '#C0392B', borderRadius: '14px', padding: '12px', fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', marginBottom: '24px' }}>
            <RotateCcw size={16} /> Azzera storico e punti
          </button>
        </div>
      )}

      {/* Bottom nav */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: t.card, boxShadow: dark ? '0 -4px 16px rgba(0,0,0,0.4)' : '0 -4px 16px rgba(45,42,74,0.08)', display: 'flex', justifyContent: 'space-around', padding: '10px 4px calc(14px + env(safe-area-inset-bottom))', borderRadius: '20px 20px 0 0' }}>
        {[
          { id: 'home', icon: Home, label: 'Home' },
          { id: 'chores', icon: ListChecks, label: 'Lavori' },
          { id: 'history', icon: History, label: 'Storico' },
          { id: 'stats', icon: BarChart3, label: 'Stats' },
          { id: 'settings', icon: Settings, label: 'Impostazioni' },
        ].map((it) => {
          const Icon = it.icon;
          const active = tab === it.id;
          return (
            <button key={it.id} onClick={() => setTab(it.id)} style={{ background: 'transparent', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', color: active ? t.coral : t.textSoft, cursor: 'pointer', fontSize: '10px', fontWeight: 700, transition: 'color 0.2s', flex: 1 }}>
              <Icon size={20} />
              {it.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ToggleRow({ label, value, onChange, t, last }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: last ? 'none' : `1px solid ${t.line}` }}>
      <span style={{ fontSize: '14px', fontWeight: 700, color: t.text }}>{label}</span>
      <button onClick={onChange} style={{ width: '48px', height: '28px', borderRadius: '14px', border: 'none', cursor: 'pointer', background: value ? t.mint : t.line, position: 'relative', transition: 'background 0.2s' }}>
        <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '3px', left: value ? '23px' : '3px', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
      </button>
    </div>
  );
}

function EmojiPicker({ options, value, onChange, t }) {
  return (
    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', maxHeight: '140px', overflowY: 'auto' }}>
      {options.map((em) => (
        <button key={em} onClick={() => onChange(em)} style={{ width: '38px', height: '38px', fontSize: '19px', borderRadius: '10px', border: value === em ? `2px solid ${t.coral}` : `1px solid ${t.line}`, background: value === em ? (t.card === '#FFFFFF' ? '#FFF0EE' : 'rgba(255,107,107,0.15)') : t.card, cursor: 'pointer' }}>
          {em}
        </button>
      ))}
    </div>
  );
}

function ChoreRow({ chore, editing, onEdit, onSave, onDelete, onLog, t }) {
  const [draft, setDraft] = useState(chore);
  useEffect(() => { setDraft(chore); }, [chore, editing]);

  if (editing) {
    return (
      <div className="pop-card" style={{ background: t.card, borderRadius: '16px', padding: '14px', boxShadow: '0 6px 16px rgba(45,42,74,0.1)' }}>
        <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '10px', border: `1px solid ${t.line}`, marginBottom: '8px', fontSize: '14px', fontFamily: 'inherit', fontWeight: 700 }} />
        <EmojiPicker options={CHORE_EMOJIS} value={draft.emoji} onChange={(em) => setDraft({ ...draft, emoji: em })} t={t} />
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
          <input type="number" value={draft.points} onChange={(e) => setDraft({ ...draft, points: Number(e.target.value) || 0 })} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: `1px solid ${t.line}`, fontSize: '14px' }} />
          <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: `1px solid ${t.line}`, fontSize: '14px' }}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
          <button onClick={onDelete} style={{ background: '#FFE5E5', border: 'none', color: '#C0392B', borderRadius: '10px', padding: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700, fontSize: '13px' }}><Trash2 size={15} /> Elimina</button>
          <button onClick={() => onSave(draft)} style={{ flex: 1, background: t.mint, border: 'none', color: '#fff', borderRadius: '10px', padding: '10px', fontWeight: 700, cursor: 'pointer' }}>Salva</button>
          <button onClick={onEdit} style={{ background: t.line, border: 'none', color: t.textSoft, borderRadius: '10px', padding: '10px', cursor: 'pointer' }}><X size={16} /></button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: t.card, borderRadius: '16px', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 4px 12px rgba(45,42,74,0.04)' }}>
      <div style={{ fontSize: '24px' }}>{chore.emoji}</div>
      <div style={{ flex: 1 }} onClick={onLog} role="button">
        <div style={{ fontSize: '14px', fontWeight: 700, color: t.text }}>{chore.name}</div>
        <div style={{ fontSize: '12px', color: t.textSoft }}>{chore.category} · {chore.points} punti</div>
      </div>
      <button onClick={onEdit} style={{ background: t.line, border: 'none', borderRadius: '10px', padding: '8px', color: t.textSoft, cursor: 'pointer', display: 'flex' }}><Pencil size={15} /></button>
      <button onClick={onLog} style={{ background: t.sunny, border: 'none', borderRadius: '12px', padding: '8px 12px', fontWeight: 700, color: '#2D2A4A', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
        <Check size={15} /> Fatto
      </button>
    </div>
  );
}
