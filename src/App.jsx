import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Home, ListChecks, History, BarChart3, Settings, Plus, Minus, Flame, Trophy, Sparkles,
  Trash2, Check, Pencil, X, RotateCcw, Crown, Volume2, VolumeX, Moon, Sun, Download,
  Calendar, Heart, Target, AlertTriangle, Palmtree, Share2, LayoutGrid, Clock, Zap,
} from 'lucide-react';
import { supabase, TABLE, DATA_ROW_ID } from './supabaseClient';
import {
  theme, USER_EMOJIS, USER_COLORS, CHORE_EMOJIS, CATEGORIES,
  DEFAULT_CHORES, DEFAULT_USERS, LEVELS, ACHIEVEMENTS,
  todayStr, formatDate, formatTime, getLevel, computeStreak,
  pointsForEntry, choreNameForEntry, achievementContext, uid, startOfWeek,
  houseHealth, motivationalMessage, currentSeason,
} from './helpers';
import { playCompletionSound, playAchievementSound, playLevelUpSound, vibrate } from './sounds';
import { quoteOfTheWeek } from './quotes';
import StatsView from './StatsView';
import WidgetScreen from './WidgetScreen';
import ShareCard from './ShareCard';

const DEFAULT_DATA = { users: DEFAULT_USERS, chores: DEFAULT_CHORES, log: [], version: 3, coupleGoal: null, vacations: {}, penaltiesOn: false, customCategories: [] };

const LS_IDENTITY = 'casa-points-identity';
const LS_SOUND = 'casa-points-sound';
const LS_DARK = 'casa-points-dark';
const LS_SEASONAL = 'casa-points-seasonal';

function loadLS(key, fallback) {
  try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); } catch { return fallback; }
}
function saveLS(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('home');
  const [pickerChore, setPickerChore] = useState(null);
  const [pickerCount, setPickerCount] = useState(1);
  const [pickerDate, setPickerDate] = useState(todayStr());      // retrodatazione
  const [pickerDedicate, setPickerDedicate] = useState(false);   // dedica
  const [confetti, setConfetti] = useState(null);
  const [dedicationToast, setDedicationToast] = useState(null);
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
  const [seasonal, setSeasonal] = useState(() => loadLS(LS_SEASONAL, true));
  const [showShare, setShowShare] = useState(false);
  const [showGoalEdit, setShowGoalEdit] = useState(false);
  const dataRef = useRef(null);
  const saveTimer = useRef(null);

  const season = currentSeason();
  const baseTheme = theme(dark);
  // Tema stagionale: sostituisce coral/accent se attivo
  const t = seasonal ? { ...baseTheme, coral: season.colors.coral, lavender: season.colors.accent } : baseTheme;

  useEffect(() => {
    if (dark === null && typeof window !== 'undefined' && window.matchMedia) {
      setDark(window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
  }, []);
  useEffect(() => { if (dark !== null) saveLS(LS_DARK, dark); }, [dark]);
  useEffect(() => { saveLS(LS_SOUND, soundOn); }, [soundOn]);
  useEffect(() => { saveLS(LS_IDENTITY, identity); }, [identity]);
  useEffect(() => { saveLS(LS_SEASONAL, seasonal); }, [seasonal]);

  const choresById = useMemo(() => {
    const m = {};
    if (data) data.chores.forEach((c) => { m[c.id] = c; });
    return m;
  }, [data]);

  const allCategories = useMemo(() => {
    const custom = (data?.customCategories || []);
    return [...CATEGORIES, ...custom];
  }, [data]);

  useEffect(() => {
    let channel;
    const load = async () => {
      try {
        const { data: row, error: err } = await supabase.from(TABLE).select('value').eq('id', DATA_ROW_ID).single();
        if (err) throw err;
        let value = row?.value;
        if (!value || Object.keys(value).length === 0) value = DEFAULT_DATA;
        // migrazioni
        if (!value.version || value.version < 2) {
          value.log = (value.log || []).map((e) => ({ ...e, snapshotPoints: e.points, snapshotName: e.choreName, snapshotEmoji: e.emoji, snapshotCategory: e.category }));
          value.version = 2;
        }
        if (value.version < 3) {
          value.coupleGoal = value.coupleGoal || null;
          value.vacations = value.vacations || {};
          value.penaltiesOn = value.penaltiesOn || false;
          value.customCategories = value.customCategories || [];
          value.version = 3;
        }
        dataRef.current = value;
        setData(value);
      } catch (e) {
        console.error(e);
        setError('Impossibile collegarsi al database condiviso.');
        dataRef.current = DEFAULT_DATA;
        setData(DEFAULT_DATA);
      } finally { setLoading(false); }
    };
    load();

    channel = supabase.channel('household_data_changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: TABLE, filter: `id=eq.${DATA_ROW_ID}` }, (payload) => {
        const incoming = payload.new?.value;
        if (incoming) { dataRef.current = incoming; setData(incoming); }
      }).subscribe();
    return () => { if (channel) supabase.removeChannel(channel); };
  }, []);

  const save = (next) => {
    dataRef.current = next;
    setData(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const { error: err } = await supabase.from(TABLE).update({ value: next, updated_at: new Date().toISOString() }).eq('id', DATA_ROW_ID);
        if (err) throw err;
      } catch (e) { console.error('Errore salvataggio', e); setError('Errore di salvataggio.'); }
    }, 250);
  };

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

  const me = useMemo(() => {
    if (!data || !identity) return null;
    return data.users.find((u) => u.id === identity) || null;
  }, [data, identity]);

  const otherUser = me && data ? data.users.find((u) => u.id !== me.id) : null;

  // Registrazione con retrodatazione + dedica + conteggio multiplo
  const logChore = (chore, user, count = 1, dateStr = todayStr(), dedicate = false) => {
    const isToday = dateStr === todayStr();
    const baseTime = isToday ? new Date() : new Date(`${dateStr}T12:00:00`);
    const entries = [];
    for (let i = 0; i < count; i++) {
      const ts = new Date(baseTime.getTime() + i * 1000);
      entries.push({
        id: uid(), userId: user.id, choreId: chore.id,
        snapshotPoints: chore.points, snapshotName: chore.name, snapshotEmoji: chore.emoji, snapshotCategory: chore.category,
        timestamp: ts.toISOString(), date: dateStr,
        dedicatedTo: dedicate && otherUser ? otherUser.id : null,
      });
    }
    const next = { ...dataRef.current, log: [...entries, ...dataRef.current.log] };

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
    setPickerChore(null); setPickerCount(1); setPickerDate(todayStr()); setPickerDedicate(false);

    const pts = chore.points * count;
    vibrate(count > 1 ? [15, 40, 15] : 15);
    if (leveledUp) playLevelUpSound(soundOn);
    else if (justUnlocked) playAchievementSound(soundOn);
    else playCompletionSound(chore.points, soundOn);

    setConfetti({ user, chore, count, points: pts, achievement: justUnlocked, levelUp: leveledUp ? newLevel : null, dedicated: dedicate && otherUser ? otherUser : null, retro: !isToday ? dateStr : null });
    setTimeout(() => setConfetti(null), (justUnlocked || leveledUp) ? 2800 : 2000);
  };

  const removeEntry = (id) => save({ ...dataRef.current, log: dataRef.current.log.filter((e) => e.id !== id) });
  const updateUser = (id, patch) => save({ ...dataRef.current, users: dataRef.current.users.map((u) => (u.id === id ? { ...u, ...patch } : u)) });

  const addChore = () => {
    if (!newChore.name.trim()) return;
    const chore = { id: `custom-${uid()}`, ...newChore, points: Number(newChore.points) || 1 };
    save({ ...dataRef.current, chores: [...dataRef.current.chores, chore] });
    setNewChore({ name: '', points: 10, emoji: '✨', category: 'Pulizia' });
    setShowAddChore(false);
  };
  const updateChore = (id, patch) => save({ ...dataRef.current, chores: dataRef.current.chores.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
  const removeChore = (id) => { save({ ...dataRef.current, chores: dataRef.current.chores.filter((c) => c.id !== id) }); if (editingChoreId === id) setEditingChoreId(null); };

  const resetHistory = () => { if (window.confirm("Azzerare tutto lo storico e i punti?")) save({ ...dataRef.current, log: [] }); };

  const setCoupleGoal = (target, deadline) => save({ ...dataRef.current, coupleGoal: target ? { target: Number(target), deadline, createdAt: todayStr() } : null });
  const addCustomCategory = (name) => { if (name.trim() && !allCategories.includes(name.trim())) save({ ...dataRef.current, customCategories: [...(dataRef.current.customCategories || []), name.trim()] }); };
  const removeCustomCategory = (name) => save({ ...dataRef.current, customCategories: (dataRef.current.customCategories || []).filter((c) => c !== name) });
  const togglePenalties = () => save({ ...dataRef.current, penaltiesOn: !dataRef.current.penaltiesOn });

  // Vacanza: range di date in cui lo streak è "in pausa"
  const setVacation = (userId, from, to) => {
    const v = { ...(dataRef.current.vacations || {}) };
    v[userId] = from && to ? { from, to } : null;
    save({ ...dataRef.current, vacations: v });
  };

  const exportCSV = () => {
    const rows = [['Data', 'Ora', 'Persona', 'Lavoro', 'Categoria', 'Punti', 'Dedica']];
    [...dataRef.current.log].reverse().forEach((e) => {
      const u = dataRef.current.users.find((x) => x.id === e.userId);
      const info = choreNameForEntry(e, choresById);
      const d = new Date(e.timestamp);
      const ded = e.dedicatedTo ? (dataRef.current.users.find((x) => x.id === e.dedicatedTo)?.name || '') : '';
      rows.push([d.toLocaleDateString('it-IT'), d.toLocaleTimeString('it-IT'), u?.name || '?', info.name, info.category, pointsForEntry(e, choresById), ded]);
    });
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `casa-points-${todayStr()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleChoreClick = (chore) => {
    setPickerCount(1); setPickerDate(todayStr()); setPickerDedicate(false);
    setPickerChore(chore);
  };

  if (loading || !data) {
    return (
      <div style={{ background: t.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', color: t.textSoft }}>
        Caricamento...
      </div>
    );
  }

  const dailyChore = (() => {
    if (data.chores.length === 0) return null;
    const seed = todayStr().split('-').join('');
    return data.chores[parseInt(seed, 10) % data.chores.length];
  })();

  const cardShadow = dark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(45,42,74,0.05)';

  // Salute casa, citazione, messaggio motivazionale, allarme streak
  const health = houseHealth(data.log, choresById);
  const quote = quoteOfTheWeek();
  const motivation = me ? motivationalMessage(data.log, choresById, me.id, otherUser?.id, data.users) : null;
  const streakRisk = me && streaks[me.id] > 0 && !data.log.some((e) => e.userId === me.id && e.date === todayStr()) && new Date().getHours() >= 18;

  // Progresso obiettivo di coppia
  const coupleGoalProgress = (() => {
    if (!data.coupleGoal) return null;
    const since = data.coupleGoal.createdAt;
    const pts = data.log.filter((e) => e.date >= since).reduce((s, e) => s + pointsForEntry(e, choresById), 0);
    return { current: pts, target: data.coupleGoal.target, pct: Math.min(100, Math.round((pts / data.coupleGoal.target) * 100)), deadline: data.coupleGoal.deadline };
  })();

  return (
    <div style={{ background: t.bg, minHeight: '100vh', fontFamily: "'Nunito', sans-serif", color: t.text, paddingBottom: 'calc(92px + env(safe-area-inset-bottom))', transition: 'background 0.4s' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Nunito:wght@400;600;700;800&display=swap');
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        body { margin: 0; }
        .display { font-family: 'Fredoka', sans-serif; }
        @keyframes pop { 0% { transform: scale(0.6) translateY(10px); opacity: 0; } 60% { transform: scale(1.08); opacity: 1; } 100% { transform: scale(1); } }
        @keyframes float-up { 0% { transform: translateY(0) scale(1); opacity: 1; } 100% { transform: translateY(-140px) scale(1.5) rotate(20deg); opacity: 0; } }
        @keyframes fade-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slide-up { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse-ring { 0% { box-shadow: 0 0 0 0 rgba(255,209,102,0.6); } 100% { box-shadow: 0 0 0 18px rgba(255,209,102,0); } }
        @keyframes shimmer { 0%,100% { opacity: 1; } 50% { opacity: 0.65; } }
        @keyframes wiggle { 0%,100% { transform: rotate(0); } 25% { transform: rotate(-3deg); } 75% { transform: rotate(3deg); } }
        @keyframes heart-float { 0% { transform: translateY(0) scale(0.8); opacity: 1; } 100% { transform: translateY(-60px) scale(1.4); opacity: 0; } }
        @keyframes glow { 0%,100% { box-shadow: 0 4px 12px rgba(45,42,74,0.05); } 50% { box-shadow: 0 4px 24px rgba(255,209,102,0.4); } }
        .confetti-piece { position: absolute; font-size: 28px; animation: float-up 1.7s ease-out forwards; }
        .pop-card { animation: pop 0.35s cubic-bezier(0.34,1.56,0.64,1); }
        .fade-in { animation: fade-in 0.35s ease-out; }
        .slide-up { animation: slide-up 0.4s ease-out backwards; }
        .achievement-toast { animation: pulse-ring 1.4s ease-out; }
        .daily-badge { animation: shimmer 2.2s ease-in-out infinite; }
        .wiggle:active { animation: wiggle 0.3s ease-in-out; }
        .quick-card { transition: transform 0.15s ease, box-shadow 0.15s ease; }
        .quick-card:active { transform: scale(0.94); }
        .nav-btn { transition: color 0.2s, transform 0.15s; }
        .nav-btn:active { transform: scale(0.85); }
        button { font-family: inherit; }
        ::-webkit-scrollbar { display: none; }
        input, select { background: ${t.card}; color: ${t.text}; }
      `}</style>

      {error && <div style={{ background: '#FFE5E5', color: '#C0392B', fontSize: '12px', padding: '8px 16px', textAlign: 'center' }}>{error}</div>}

      {/* Share card modal */}
      {showShare && <ShareCard data={data} choresById={choresById} totals={totals} streaks={streaks} t={t} season={season} onClose={() => setShowShare(false)} />}

      {/* Confetti / toast */}
      {confetti && (
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'relative', textAlign: 'center' }}>
            {(confetti.dedicated ? ['❤️', '💕', '💖', '💗', '💝'] : ['🎉', '✨', '⭐', '🎊', '💥', '🌟']).map((e, i) => (
              <span key={i} className="confetti-piece" style={{ left: `${(i - 2.5) * 26}px`, animationDelay: `${i * 0.05}s` }}>{e}</span>
            ))}
            <div className="pop-card display" style={{ background: t.card, borderRadius: '24px', padding: '20px 28px', boxShadow: '0 12px 30px rgba(45,42,74,0.25)', border: `3px solid ${confetti.user.color}` }}>
              <div style={{ fontSize: '40px' }}>{confetti.chore.emoji}</div>
              <div style={{ fontSize: '20px', fontWeight: 700, marginTop: '4px', color: t.text }}>+{confetti.points} punti!{confetti.count > 1 ? ` (×${confetti.count})` : ''}</div>
              <div style={{ fontSize: '14px', color: t.textSoft, marginTop: '2px' }}>{confetti.user.emoji} {confetti.user.name}</div>
              {confetti.retro && <div style={{ fontSize: '12px', color: t.textSoft, marginTop: '4px' }}>📅 retrodatato al {new Date(confetti.retro).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}</div>}
              {confetti.dedicated && <div style={{ fontSize: '13px', color: confetti.user.color, marginTop: '6px', fontWeight: 700 }}>❤️ Dedicato a {confetti.dedicated.name}</div>}
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

      {/* Picker */}
      {pickerChore && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(45,42,74,0.4)', zIndex: 40, display: 'flex', alignItems: 'flex-end' }} onClick={() => setPickerChore(null)}>
          <div className="pop-card" style={{ background: t.card, width: '100%', borderRadius: '28px 28px 0 0', padding: '24px', paddingBottom: 'calc(24px + env(safe-area-inset-bottom))', boxShadow: '0 -8px 30px rgba(45,42,74,0.2)', maxHeight: '88vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <div style={{ fontSize: '36px' }}>{pickerChore.emoji}</div>
              <div className="display" style={{ fontSize: '18px', fontWeight: 600, color: t.text }}>{pickerChore.name}</div>
              <div style={{ fontSize: '14px', color: t.textSoft }}>+{pickerChore.points * pickerCount} punti{pickerCount > 1 ? ` (${pickerChore.points} × ${pickerCount})` : ''}</div>
            </div>

            {/* Quantità */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px', marginBottom: '6px' }}>
              <button onClick={() => setPickerCount((c) => Math.max(1, c - 1))} style={{ width: '44px', height: '44px', borderRadius: '50%', border: `2px solid ${t.line}`, background: t.card, color: t.text, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Minus size={20} /></button>
              <div className="display" style={{ fontSize: '32px', fontWeight: 800, minWidth: '50px', textAlign: 'center', color: t.text }}>{pickerCount}</div>
              <button onClick={() => setPickerCount((c) => Math.min(20, c + 1))} style={{ width: '44px', height: '44px', borderRadius: '50%', border: `2px solid ${t.line}`, background: t.card, color: t.text, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={20} /></button>
            </div>
            <div style={{ fontSize: '11px', color: t.textSoft, textAlign: 'center', marginBottom: '14px' }}>Quante volte?</div>

            {/* Retrodatazione */}
            <div style={{ background: dark ? 'rgba(255,255,255,0.05)' : '#FFF7ED', borderRadius: '14px', padding: '12px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontSize: '13px', fontWeight: 700, color: t.text }}>
                <Calendar size={16} /> Quando l'hai fatto?
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {[0, 1, 2, 3].map((daysAgo) => {
                  const d = new Date(); d.setDate(d.getDate() - daysAgo);
                  const ds = todayStr(d);
                  const label = daysAgo === 0 ? 'Oggi' : daysAgo === 1 ? 'Ieri' : d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric' });
                  return (
                    <button key={daysAgo} onClick={() => setPickerDate(ds)} style={{ padding: '8px 12px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700, background: pickerDate === ds ? t.coral : t.card, color: pickerDate === ds ? '#fff' : t.textSoft }}>{label}</button>
                  );
                })}
                <input type="date" value={pickerDate} max={todayStr()} onChange={(e) => setPickerDate(e.target.value)} style={{ padding: '6px 8px', borderRadius: '10px', border: `1px solid ${t.line}`, fontSize: '12px' }} />
              </div>
            </div>

            {/* Dedica */}
            {otherUser && (
              <button onClick={() => setPickerDedicate((d) => !d)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px', borderRadius: '12px', border: `2px solid ${pickerDedicate ? t.coral : t.line}`, background: pickerDedicate ? (dark ? 'rgba(255,107,107,0.15)' : '#FFF0EE') : t.card, color: pickerDedicate ? t.coral : t.textSoft, fontWeight: 700, fontSize: '13px', cursor: 'pointer', marginBottom: '14px' }}>
                <Heart size={16} fill={pickerDedicate ? t.coral : 'none'} /> {pickerDedicate ? `Dedicato a ${otherUser.name} ❤️` : `Dedica a ${otherUser.name}`}
              </button>
            )}

            {/* Chi */}
            {me ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button onClick={() => logChore(pickerChore, me, pickerCount, pickerDate, pickerDedicate)} style={{ background: me.color, border: 'none', borderRadius: '18px', padding: '16px', color: '#fff', fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: '17px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '24px' }}>{me.emoji}</span> L'ho fatto io
                </button>
                {otherUser && (
                  <button onClick={() => logChore(pickerChore, otherUser, pickerCount, pickerDate, false)} style={{ background: 'transparent', border: `2px solid ${otherUser.color}`, borderRadius: '18px', padding: '12px', color: otherUser.color, fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '20px' }}>{otherUser.emoji}</span> L'ha fatto {otherUser.name}
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '12px' }}>
                {data.users.map((u) => (
                  <button key={u.id} onClick={() => logChore(pickerChore, u, pickerCount, pickerDate, false)} style={{ flex: 1, background: u.color, border: 'none', borderRadius: '18px', padding: '18px 8px', color: '#fff', fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: '16px', cursor: 'pointer' }}>
                    <div style={{ fontSize: '28px', marginBottom: '4px' }}>{u.emoji}</div>{u.name}
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
          <p style={{ margin: '2px 0 0', color: t.textSoft, fontSize: '13px' }}>{me ? `Ciao ${me.name}! ${me.emoji}` : 'Dividetevi i lavori, raccogliete punti'}</p>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={() => setShowShare(true)} className="nav-btn" style={{ background: t.card, border: 'none', borderRadius: '12px', width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.textSoft, cursor: 'pointer', boxShadow: cardShadow }}><Share2 size={18} /></button>
          <button onClick={() => setSoundOn((s) => !s)} className="nav-btn" style={{ background: t.card, border: 'none', borderRadius: '12px', width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.textSoft, cursor: 'pointer', boxShadow: cardShadow }}>{soundOn ? <Volume2 size={18} /> : <VolumeX size={18} />}</button>
          <button onClick={() => setDark((d) => !d)} className="nav-btn" style={{ background: t.card, border: 'none', borderRadius: '12px', width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.textSoft, cursor: 'pointer', boxShadow: cardShadow }}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
        </div>
      </div>

      {/* Banner identità */}
      {!me && (
        <div className="slide-up" style={{ margin: '0 18px 12px', background: t.card, borderRadius: '16px', padding: '14px', boxShadow: cardShadow }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: t.text, marginBottom: '8px' }}>👋 Chi sei? (così segni più velocemente)</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {data.users.map((u) => (
              <button key={u.id} onClick={() => setIdentity(u.id)} style={{ flex: 1, background: u.color, border: 'none', borderRadius: '12px', padding: '10px', color: '#fff', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}>{u.emoji} {u.name}</button>
            ))}
          </div>
        </div>
      )}

      {/* Allarme rischio streak */}
      {streakRisk && (
        <div className="slide-up wiggle" style={{ margin: '0 18px 12px', background: `linear-gradient(135deg, ${t.coral}, ${t.sunny})`, borderRadius: '16px', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: cardShadow }}>
          <AlertTriangle size={22} color="#fff" />
          <div style={{ fontSize: '13px', color: '#fff', fontWeight: 700 }}>Stai per perdere la tua serie di {streaks[me.id]} giorni! Fai un lavoro prima di mezzanotte 🔥</div>
        </div>
      )}

      {/* ===== HOME ===== */}
      {tab === 'home' && (
        <div className="fade-in" style={{ padding: '0 18px' }}>
          {/* Score race */}
          <div className="slide-up" style={{ background: t.card, borderRadius: '24px', padding: '18px', boxShadow: cardShadow, marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '12px' }}>
              {data.users.map((u) => {
                const lvl = getLevel(totals[u.id] || 0);
                const maxRef = Math.max(totals[data.users[0].id] || 0, totals[data.users[1]?.id] || 0, 50);
                const pct = Math.max(8, ((totals[u.id] || 0) / maxRef) * 100);
                const onVacation = data.vacations?.[u.id] && todayStr() >= data.vacations[u.id].from && todayStr() <= data.vacations[u.id].to;
                return (
                  <div key={u.id} style={{ flex: 1 }}>
                    <div className="display" style={{ fontSize: '15px', fontWeight: 600, marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '6px', color: t.text }}>
                      <span style={{ fontSize: '20px' }}>{u.emoji}</span> {u.name}
                      {me && me.id === u.id && <span style={{ fontSize: '10px', background: u.color, color: '#fff', borderRadius: '6px', padding: '1px 5px' }}>tu</span>}
                    </div>
                    <div style={{ fontSize: '12px', color: t.textSoft, marginBottom: '6px' }}>{lvl.emoji} {lvl.title}</div>
                    <div style={{ fontSize: '26px', fontWeight: 800, color: t.text }} className="display">{totals[u.id] || 0}</div>
                    <div style={{ height: '10px', background: t.line, borderRadius: '8px', marginTop: '8px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: u.color, borderRadius: '8px', transition: 'width 0.6s cubic-bezier(0.34,1.56,0.64,1)' }} />
                    </div>
                    {onVacation ? (
                      <div style={{ fontSize: '12px', marginTop: '6px', color: t.textSoft, display: 'flex', alignItems: 'center', gap: '4px' }}><Palmtree size={14} color={t.mint} /> in pausa</div>
                    ) : streaks[u.id] > 0 && (
                      <div style={{ fontSize: '12px', marginTop: '6px', color: t.textSoft, display: 'flex', alignItems: 'center', gap: '4px' }}><Flame size={14} color={t.coral} /> {streaks[u.id]} {streaks[u.id] === 1 ? 'giorno' : 'giorni'}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Obiettivo di coppia */}
          {coupleGoalProgress && (
            <div className="slide-up" style={{ background: t.card, borderRadius: '18px', padding: '16px', boxShadow: cardShadow, marginBottom: '16px', borderLeft: `4px solid ${t.lavender}` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ fontSize: '13px', fontWeight: 800, color: t.text, display: 'flex', alignItems: 'center', gap: '6px' }}><Target size={16} color={t.lavender} /> Obiettivo di coppia</div>
                <button onClick={() => setShowGoalEdit(true)} style={{ background: 'transparent', border: 'none', color: t.textSoft, cursor: 'pointer', fontSize: '12px' }}><Pencil size={14} /></button>
              </div>
              <div style={{ fontSize: '13px', color: t.textSoft, marginBottom: '8px' }}>{coupleGoalProgress.current} / {coupleGoalProgress.target} punti insieme {coupleGoalProgress.deadline ? `entro ${new Date(coupleGoalProgress.deadline).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}` : ''}</div>
              <div style={{ height: '14px', background: t.line, borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${coupleGoalProgress.pct}%`, background: `linear-gradient(90deg, ${t.lavender}, ${t.mint})`, borderRadius: '8px', transition: 'width 0.6s', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '6px' }}>
                  {coupleGoalProgress.pct > 15 && <span style={{ fontSize: '10px', color: '#fff', fontWeight: 800 }}>{coupleGoalProgress.pct}%</span>}
                </div>
              </div>
              {coupleGoalProgress.pct >= 100 && <div style={{ fontSize: '13px', color: t.mint, fontWeight: 700, textAlign: 'center', marginTop: '8px' }}>🎉 Obiettivo raggiunto insieme!</div>}
            </div>
          )}
          {!coupleGoalProgress && (
            <button onClick={() => setShowGoalEdit(true)} className="slide-up" style={{ width: '100%', background: t.card, border: `2px dashed ${t.line}`, borderRadius: '16px', padding: '14px', color: t.textSoft, fontSize: '13px', fontWeight: 700, cursor: 'pointer', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <Target size={16} /> Imposta un obiettivo di coppia
            </button>
          )}

          {/* Citazione settimanale */}
          <div className="slide-up" style={{ background: dark ? 'rgba(167,139,250,0.12)' : '#F5F0FF', borderRadius: '16px', padding: '14px 16px', marginBottom: '16px', borderLeft: `4px solid ${t.lavender}` }}>
            <div style={{ fontSize: '14px', fontStyle: 'italic', color: t.text, lineHeight: 1.5 }}>"{quote.text}"</div>
            <div style={{ fontSize: '12px', color: t.textSoft, marginTop: '6px', fontWeight: 700 }}>— {quote.author}{quote.source ? `, ${quote.source}` : ''}</div>
          </div>

          {/* Messaggio motivazionale */}
          {motivation && (
            <div className="slide-up" style={{ background: t.card, borderRadius: '14px', padding: '12px 14px', marginBottom: '16px', fontSize: '13px', color: t.text, fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', boxShadow: cardShadow }}>
              <Sparkles size={16} color={t.sunny} /> {motivation}
            </div>
          )}

          {/* Salute casa */}
          <div className="slide-up" style={{ background: t.card, borderRadius: '16px', padding: '14px', marginBottom: '16px', boxShadow: cardShadow, display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ fontSize: '32px' }}>{health.emoji}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: 800, color: t.text }}>{health.label}</div>
              <div style={{ height: '8px', background: t.line, borderRadius: '6px', overflow: 'hidden', marginTop: '6px' }}>
                <div style={{ height: '100%', width: `${health.score}%`, background: health.color, borderRadius: '6px', transition: 'width 0.6s' }} />
              </div>
            </div>
          </div>

          {/* Lavoro del giorno */}
          {dailyChore && (
            <div className="daily-badge quick-card" onClick={() => handleChoreClick({ ...dailyChore, points: dailyChore.points * 2 })} style={{ background: `linear-gradient(135deg, ${t.sunny}, ${t.coral})`, borderRadius: '18px', padding: '14px 16px', marginBottom: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: cardShadow }}>
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
            {data.chores.slice(0, 6).map((c, i) => (
              <button key={c.id} onClick={() => handleChoreClick(c)} className="quick-card slide-up" style={{ background: t.card, border: 'none', borderRadius: '18px', padding: '14px 10px', textAlign: 'left', boxShadow: cardShadow, cursor: 'pointer', animationDelay: `${i * 0.04}s` }}>
                <div style={{ fontSize: '24px' }}>{c.emoji}</div>
                <div style={{ fontSize: '13px', fontWeight: 700, marginTop: '4px', lineHeight: 1.2, color: t.text }}>{c.name}</div>
                <div style={{ fontSize: '12px', color: '#D49A00', fontWeight: 700, marginTop: '2px' }}>+{c.points} pt</div>
              </button>
            ))}
          </div>

          {/* Ultime attività */}
          <div className="display" style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px', color: t.text }}>Ultime attività</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {data.log.length === 0 && <div style={{ background: t.card, borderRadius: '16px', padding: '16px', color: t.textSoft, fontSize: '14px', textAlign: 'center' }}>Ancora nessuna attività. Tocca un lavoro per iniziare! 🎯</div>}
            {data.log.slice(0, 6).map((e, i) => {
              const u = data.users.find((x) => x.id === e.userId);
              const info = choreNameForEntry(e, choresById);
              const dedUser = e.dedicatedTo ? data.users.find((x) => x.id === e.dedicatedTo) : null;
              return (
                <div key={e.id} className="slide-up" style={{ background: t.card, borderRadius: '16px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: cardShadow, animationDelay: `${i * 0.03}s` }}>
                  <div style={{ fontSize: '22px' }}>{info.emoji}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: t.text }}>{info.name} {dedUser && <Heart size={11} color={t.coral} fill={t.coral} style={{ display: 'inline', verticalAlign: 'middle' }} />}</div>
                    <div style={{ fontSize: '12px', color: t.textSoft }}>{u?.emoji} {u?.name} · {formatTime(e.timestamp)}{dedUser ? ` · per ${dedUser.name}` : ''}</div>
                  </div>
                  <div style={{ fontWeight: 800, color: u?.color }} className="display">+{pointsForEntry(e, choresById)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===== WIDGET ===== */}
      {tab === 'widget' && <WidgetScreen data={data} choresById={choresById} totals={totals} streaks={streaks} me={me} t={t} dark={dark} health={health} />}

      {/* ===== LAVORI ===== */}
      {tab === 'chores' && (
        <div className="fade-in" style={{ padding: '0 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div className="display" style={{ fontSize: '15px', fontWeight: 600, color: t.text }}>Tutti i lavori</div>
            <button onClick={() => setShowAddChore((s) => !s)} style={{ background: t.lavender, border: 'none', color: '#fff', borderRadius: '12px', padding: '8px 12px', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}><Plus size={16} /> Nuovo</button>
          </div>
          {showAddChore && (
            <div className="pop-card" style={{ background: t.card, borderRadius: '18px', padding: '14px', marginBottom: '14px', boxShadow: cardShadow }}>
              <input placeholder="Nome del lavoro" value={newChore.name} onChange={(e) => setNewChore({ ...newChore, name: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '10px', border: `1px solid ${t.line}`, marginBottom: '8px', fontSize: '14px', fontFamily: 'inherit' }} />
              <EmojiPicker options={CHORE_EMOJIS} value={newChore.emoji} onChange={(em) => setNewChore({ ...newChore, emoji: em })} t={t} />
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <input type="number" placeholder="Punti" value={newChore.points} onChange={(e) => setNewChore({ ...newChore, points: e.target.value })} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: `1px solid ${t.line}`, fontSize: '14px' }} />
                <select value={newChore.category} onChange={(e) => setNewChore({ ...newChore, category: e.target.value })} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: `1px solid ${t.line}`, fontSize: '14px' }}>{allCategories.map((c) => <option key={c}>{c}</option>)}</select>
              </div>
              <button onClick={addChore} style={{ width: '100%', marginTop: '8px', background: t.mint, border: 'none', color: '#fff', borderRadius: '10px', padding: '10px', fontWeight: 700, cursor: 'pointer' }}>Aggiungi lavoro</button>
            </div>
          )}
          <div style={{ fontSize: '11px', color: t.textSoft, marginBottom: '10px', background: t.card, borderRadius: '12px', padding: '10px 12px' }}>💡 Cambiando i punti di un lavoro, <strong>tutto lo storico si ricalcola</strong> automaticamente.</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {data.chores.map((c) => (
              <ChoreRow key={c.id} chore={c} editing={editingChoreId === c.id} t={t} categories={allCategories}
                onEdit={() => setEditingChoreId(editingChoreId === c.id ? null : c.id)}
                onSave={(patch) => { updateChore(c.id, patch); setEditingChoreId(null); }}
                onDelete={() => removeChore(c.id)} onLog={() => handleChoreClick(c)} />
            ))}
          </div>
        </div>
      )}

      {/* ===== STORICO ===== */}
      {tab === 'history' && (
        <div className="fade-in" style={{ padding: '0 18px' }}>
          <div style={{ position: 'relative', marginBottom: '10px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.textSoft} strokeWidth="2" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <input placeholder="Cerca un lavoro..." value={historySearch} onChange={(e) => setHistorySearch(e.target.value)} style={{ width: '100%', padding: '10px 10px 10px 36px', borderRadius: '12px', border: `1px solid ${t.line}`, fontSize: '14px' }} />
          </div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            {['all', ...data.users.map((u) => u.id)].map((f) => {
              const u = data.users.find((x) => x.id === f);
              const active = historyFilter === f;
              return <button key={f} onClick={() => setHistoryFilter(f)} style={{ flex: 1, padding: '8px', borderRadius: '12px', border: 'none', fontWeight: 700, fontSize: '13px', cursor: 'pointer', background: active ? (u ? u.color : t.coral) : t.card, color: active ? '#fff' : t.textSoft }}>{u ? `${u.emoji} ${u.name}` : 'Tutti'}</button>;
            })}
          </div>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', flexWrap: 'wrap' }}>
            {['all', ...allCategories].map((cat) => {
              const active = historyCat === cat;
              return <button key={cat} onClick={() => setHistoryCat(cat)} style={{ padding: '6px 10px', borderRadius: '10px', border: 'none', fontWeight: 700, fontSize: '12px', cursor: 'pointer', background: active ? t.lavender : t.card, color: active ? '#fff' : t.textSoft }}>{cat === 'all' ? 'Tutte' : cat}</button>;
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
              return filtered.map((e, i) => {
                const u = data.users.find((x) => x.id === e.userId);
                const info = choreNameForEntry(e, choresById);
                const dedUser = e.dedicatedTo ? data.users.find((x) => x.id === e.dedicatedTo) : null;
                return (
                  <div key={e.id} className="slide-up" style={{ background: t.card, borderRadius: '16px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: cardShadow, animationDelay: `${Math.min(i, 10) * 0.02}s` }}>
                    <div style={{ fontSize: '22px' }}>{info.emoji}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: t.text }}>{info.name} {dedUser && <Heart size={11} color={t.coral} fill={t.coral} style={{ display: 'inline', verticalAlign: 'middle' }} />}</div>
                      <div style={{ fontSize: '12px', color: t.textSoft }}>{u?.emoji} {u?.name} · {formatDate(e.timestamp)} alle {formatTime(e.timestamp)}{dedUser ? ` · ❤️ ${dedUser.name}` : ''}</div>
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

      {/* ===== STATS ===== */}
      {tab === 'stats' && <StatsView data={data} choresById={choresById} t={t} dark={dark} />}

      {/* ===== IMPOSTAZIONI ===== */}
      {tab === 'settings' && (
        <SettingsView
          data={data} me={me} identity={identity} setIdentity={setIdentity} updateUser={updateUser}
          soundOn={soundOn} setSoundOn={setSoundOn} dark={dark} setDark={setDark} seasonal={seasonal} setSeasonal={setSeasonal}
          exportCSV={exportCSV} resetHistory={resetHistory} t={t} cardShadow={cardShadow} season={season}
          allCategories={allCategories} addCustomCategory={addCustomCategory} removeCustomCategory={removeCustomCategory}
          penaltiesOn={data.penaltiesOn} togglePenalties={togglePenalties} vacations={data.vacations} setVacation={setVacation}
        />
      )}

      {/* Goal edit modal */}
      {showGoalEdit && <GoalEditModal current={data.coupleGoal} onSave={(target, deadline) => { setCoupleGoal(target, deadline); setShowGoalEdit(false); }} onClose={() => setShowGoalEdit(false)} t={t} />}

      {/* Bottom nav */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: t.card, boxShadow: dark ? '0 -4px 16px rgba(0,0,0,0.4)' : '0 -4px 16px rgba(45,42,74,0.08)', display: 'flex', justifyContent: 'space-around', padding: '10px 2px calc(14px + env(safe-area-inset-bottom))', borderRadius: '20px 20px 0 0' }}>
        {[
          { id: 'home', icon: Home, label: 'Home' },
          { id: 'chores', icon: ListChecks, label: 'Lavori' },
          { id: 'history', icon: History, label: 'Storico' },
          { id: 'stats', icon: BarChart3, label: 'Stats' },
          { id: 'widget', icon: LayoutGrid, label: 'Widget' },
          { id: 'settings', icon: Settings, label: 'Opzioni' },
        ].map((it) => {
          const Icon = it.icon; const active = tab === it.id;
          return <button key={it.id} onClick={() => setTab(it.id)} className="nav-btn" style={{ background: 'transparent', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', color: active ? t.coral : t.textSoft, cursor: 'pointer', fontSize: '9px', fontWeight: 700, flex: 1 }}><Icon size={19} />{it.label}</button>;
        })}
      </div>
    </div>
  );
}

// ============================================================
// COMPONENTI AUSILIARI
// ============================================================

function SettingsView({ data, me, identity, setIdentity, updateUser, soundOn, setSoundOn, dark, setDark, seasonal, setSeasonal, exportCSV, resetHistory, t, cardShadow, season, allCategories, addCustomCategory, removeCustomCategory, penaltiesOn, togglePenalties, vacations, setVacation }) {
  const [newCat, setNewCat] = useState('');
  const customCats = data.customCategories || [];

  return (
    <div className="fade-in" style={{ padding: '0 18px' }}>
      {/* Identità */}
      <div className="display" style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px', color: t.text }}>La tua identità su questo telefono</div>
      <div style={{ background: t.card, borderRadius: '18px', padding: '14px', boxShadow: cardShadow, marginBottom: '20px' }}>
        <div style={{ fontSize: '12px', color: t.textSoft, marginBottom: '10px' }}>Scegli chi sei: i lavori che segni saranno automaticamente tuoi.</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {data.users.map((u) => (
            <button key={u.id} onClick={() => setIdentity(u.id)} style={{ flex: 1, background: identity === u.id ? u.color : 'transparent', border: `2px solid ${u.color}`, borderRadius: '12px', padding: '10px', color: identity === u.id ? '#fff' : u.color, fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}>{u.emoji} {u.name} {identity === u.id ? '✓' : ''}</button>
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
              {USER_COLORS.map((color) => <button key={color} onClick={() => updateUser(u.id, { color })} style={{ width: '32px', height: '32px', borderRadius: '50%', background: color, border: u.color === color ? `3px solid ${t.text}` : '3px solid transparent', cursor: 'pointer' }} />)}
            </div>
            {/* Vacanza */}
            <div style={{ fontSize: '12px', color: t.textSoft, margin: '12px 0 6px', display: 'flex', alignItems: 'center', gap: '4px' }}><Palmtree size={14} /> Modalità vacanza (serie in pausa)</div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
              <input type="date" value={vacations?.[u.id]?.from || ''} onChange={(e) => setVacation(u.id, e.target.value, vacations?.[u.id]?.to || e.target.value)} style={{ padding: '6px 8px', borderRadius: '8px', border: `1px solid ${t.line}`, fontSize: '12px' }} />
              <span style={{ fontSize: '12px', color: t.textSoft }}>→</span>
              <input type="date" value={vacations?.[u.id]?.to || ''} onChange={(e) => setVacation(u.id, vacations?.[u.id]?.from || e.target.value, e.target.value)} style={{ padding: '6px 8px', borderRadius: '8px', border: `1px solid ${t.line}`, fontSize: '12px' }} />
              {vacations?.[u.id] && <button onClick={() => setVacation(u.id, null, null)} style={{ background: 'transparent', border: 'none', color: t.textSoft, cursor: 'pointer' }}><X size={16} /></button>}
            </div>
          </div>
        ))}
      </div>

      {/* Categorie personalizzate */}
      <div className="display" style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px', color: t.text }}>Categorie personalizzate</div>
      <div style={{ background: t.card, borderRadius: '18px', padding: '14px', boxShadow: cardShadow, marginBottom: '20px' }}>
        <div style={{ fontSize: '12px', color: t.textSoft, marginBottom: '10px' }}>Le 5 categorie base non si possono eliminare. Aggiungi le tue (es. Garage, Giardino).</div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
          {customCats.map((c) => (
            <div key={c} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: t.lavender, color: '#fff', borderRadius: '10px', padding: '6px 10px', fontSize: '12px', fontWeight: 700 }}>
              {c} <button onClick={() => removeCustomCategory(c)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex' }}><X size={13} /></button>
            </div>
          ))}
          {customCats.length === 0 && <span style={{ fontSize: '12px', color: t.textSoft }}>Nessuna categoria personalizzata</span>}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="Nuova categoria" style={{ flex: 1, padding: '8px 10px', borderRadius: '10px', border: `1px solid ${t.line}`, fontSize: '13px' }} />
          <button onClick={() => { addCustomCategory(newCat); setNewCat(''); }} style={{ background: t.mint, border: 'none', color: '#fff', borderRadius: '10px', padding: '8px 14px', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}>Aggiungi</button>
        </div>
      </div>

      {/* Preferenze */}
      <div className="display" style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px', color: t.text }}>Preferenze</div>
      <div style={{ background: t.card, borderRadius: '18px', padding: '4px 14px', boxShadow: cardShadow, marginBottom: '20px' }}>
        <ToggleRow label="🔊 Suoni" value={soundOn} onChange={() => setSoundOn((s) => !s)} t={t} />
        <ToggleRow label="🌙 Tema scuro" value={!!dark} onChange={() => setDark((d) => !d)} t={t} />
        <ToggleRow label={`${season.emoji} Tema stagionale (${season.name})`} value={seasonal} onChange={() => setSeasonal((s) => !s)} t={t} />
        <ToggleRow label="⚠️ Penalità per lavori dimenticati" value={penaltiesOn} onChange={togglePenalties} t={t} last />
      </div>
      {penaltiesOn && <div style={{ fontSize: '11px', color: t.textSoft, marginBottom: '20px', background: t.card, borderRadius: '12px', padding: '10px 12px' }}>Con le penalità attive, dimenticare a lungo i lavori chiave abbassa la "salute della casa" più velocemente.</div>}

      {/* Dati */}
      <div className="display" style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px', color: t.text }}>Dati</div>
      <button onClick={exportCSV} style={{ width: '100%', background: t.card, border: `1px solid ${t.line}`, color: t.text, borderRadius: '14px', padding: '12px', fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', marginBottom: '10px' }}><Download size={16} /> Esporta storico (CSV)</button>
      <button onClick={resetHistory} style={{ width: '100%', background: t.card, border: `1px solid ${t.line}`, color: '#C0392B', borderRadius: '14px', padding: '12px', fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', marginBottom: '24px' }}><RotateCcw size={16} /> Azzera storico e punti</button>
    </div>
  );
}

function GoalEditModal({ current, onSave, onClose, t }) {
  const [target, setTarget] = useState(current?.target || 500);
  const [deadline, setDeadline] = useState(current?.deadline || '');
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(45,42,74,0.45)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }} onClick={onClose}>
      <div className="pop-card" style={{ background: t.card, borderRadius: '24px', padding: '24px', maxWidth: '340px', width: '100%' }} onClick={(e) => e.stopPropagation()}>
        <div className="display" style={{ fontSize: '18px', fontWeight: 700, color: t.text, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}><Target size={20} color={t.lavender} /> Obiettivo di coppia</div>
        <div style={{ fontSize: '13px', color: t.textSoft, marginBottom: '16px' }}>Punti da raggiungere insieme.</div>
        <div style={{ fontSize: '12px', color: t.textSoft, marginBottom: '6px' }}>Punti obiettivo</div>
        <input type="number" value={target} onChange={(e) => setTarget(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '10px', border: `1px solid ${t.line}`, fontSize: '15px', marginBottom: '12px', fontWeight: 700 }} />
        <div style={{ fontSize: '12px', color: t.textSoft, marginBottom: '6px' }}>Scadenza (opzionale)</div>
        <input type="date" value={deadline} min={todayStr()} onChange={(e) => setDeadline(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '10px', border: `1px solid ${t.line}`, fontSize: '14px', marginBottom: '16px' }} />
        <div style={{ display: 'flex', gap: '8px' }}>
          {current && <button onClick={() => onSave(null, null)} style={{ background: '#FFE5E5', border: 'none', color: '#C0392B', borderRadius: '12px', padding: '12px', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}>Rimuovi</button>}
          <button onClick={() => onSave(target, deadline || null)} style={{ flex: 1, background: t.mint, border: 'none', color: '#fff', borderRadius: '12px', padding: '12px', fontWeight: 700, cursor: 'pointer' }}>Salva obiettivo</button>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({ label, value, onChange, t, last }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: last ? 'none' : `1px solid ${t.line}` }}>
      <span style={{ fontSize: '14px', fontWeight: 700, color: t.text }}>{label}</span>
      <button onClick={onChange} style={{ width: '48px', height: '28px', borderRadius: '14px', border: 'none', cursor: 'pointer', background: value ? t.mint : t.line, position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
        <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '3px', left: value ? '23px' : '3px', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
      </button>
    </div>
  );
}

function EmojiPicker({ options, value, onChange, t }) {
  return (
    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', maxHeight: '140px', overflowY: 'auto' }}>
      {options.map((em) => (
        <button key={em} onClick={() => onChange(em)} style={{ width: '38px', height: '38px', fontSize: '19px', borderRadius: '10px', border: value === em ? `2px solid ${t.coral}` : `1px solid ${t.line}`, background: value === em ? (t.card === '#FFFFFF' ? '#FFF0EE' : 'rgba(255,107,107,0.15)') : t.card, cursor: 'pointer' }}>{em}</button>
      ))}
    </div>
  );
}

function ChoreRow({ chore, editing, onEdit, onSave, onDelete, onLog, t, categories }) {
  const [draft, setDraft] = useState(chore);
  useEffect(() => { setDraft(chore); }, [chore, editing]);
  if (editing) {
    return (
      <div className="pop-card" style={{ background: t.card, borderRadius: '16px', padding: '14px', boxShadow: '0 6px 16px rgba(45,42,74,0.1)' }}>
        <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '10px', border: `1px solid ${t.line}`, marginBottom: '8px', fontSize: '14px', fontFamily: 'inherit', fontWeight: 700 }} />
        <EmojiPicker options={CHORE_EMOJIS} value={draft.emoji} onChange={(em) => setDraft({ ...draft, emoji: em })} t={t} />
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
          <input type="number" value={draft.points} onChange={(e) => setDraft({ ...draft, points: Number(e.target.value) || 0 })} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: `1px solid ${t.line}`, fontSize: '14px' }} />
          <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: `1px solid ${t.line}`, fontSize: '14px' }}>{(categories || CATEGORIES).map((c) => <option key={c}>{c}</option>)}</select>
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
      <button onClick={onLog} className="wiggle" style={{ background: t.sunny, border: 'none', borderRadius: '12px', padding: '8px 12px', fontWeight: 700, color: '#2D2A4A', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}><Check size={15} /> Fatto</button>
    </div>
  );
}
