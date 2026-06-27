import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Home, ListChecks, History, BarChart3, Settings, Plus, Minus, Flame, Trophy, Sparkles,
  Trash2, Check, Pencil, X, RotateCcw, Crown, Volume2, VolumeX, Moon, Sun, Download,
  Calendar, Heart, Target, AlertTriangle, Palmtree, Share2, LayoutGrid, Clock, Zap,
  Search, Gift, Bell, Repeat, Bookmark, Sparkle as SparkleIcon, Star,
} from 'lucide-react';
import { supabase, TABLE, DATA_ROW_ID } from './supabaseClient';
import {
  theme, USER_EMOJIS, USER_COLORS, CHORE_EMOJIS, CATEGORIES,
  DEFAULT_CHORES, DEFAULT_USERS, LEVELS, ACHIEVEMENTS,
  todayStr, formatDate, formatTime, getLevel, computeStreak,
  pointsForEntry, choreNameForEntry, achievementContext, uid, startOfWeek,
  houseHealth, motivationalMessage, currentSeason,
  houseState, recurringStatus, rewardAchieved, recentChores, groupByDay, computeWeekWins,
} from './helpers';
import { playCompletionSound, playAchievementSound, playLevelUpSound, vibrate } from './sounds';
import { quoteOfTheDay } from './quotes';
import StatsView from './StatsView';
import WidgetScreen from './WidgetScreen';
import ShareCard from './ShareCard';
import HouseSvg from './HouseSvg';
import StreakView from './StreakView';

const DEFAULT_DATA = { users: DEFAULT_USERS, chores: DEFAULT_CHORES, log: [], version: 6, coupleGoal: null, vacations: {}, penaltiesOn: false, customCategories: [], categories: [...CATEGORIES], rewards: [], savedQuotes: [], excused: {} };

const LS_IDENTITY = 'casa-points-identity';
const LS_SOUND = 'casa-points-sound';
const LS_DARK = 'casa-points-dark';
const LS_SEASONAL = 'casa-points-seasonal';
const LS_STYLE = 'casa-points-style';

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
  const [pickerExtras, setPickerExtras] = useState([]);          // extra opzionali selezionati
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
  const [style, setStyle] = useState(() => loadLS(LS_STYLE, 'pop'));
  const [choreSearch, setChoreSearch] = useState('');
  const [choreCat, setChoreCat] = useState('all');
  const [showRewards, setShowRewards] = useState(false);
  const [showSavedQuotes, setShowSavedQuotes] = useState(false);
  const [removingIds, setRemovingIds] = useState([]);
  const dataRef = useRef(null);
  const saveTimer = useRef(null);

  const season = currentSeason();
  const baseTheme = theme(dark, style);
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
  useEffect(() => { saveLS(LS_STYLE, style); }, [style]);

  const choresById = useMemo(() => {
    const m = {};
    if (data) data.chores.forEach((c) => { m[c.id] = c; });
    return m;
  }, [data]);

  const allCategories = useMemo(() => {
    if (data?.categories && data.categories.length) return data.categories;
    return [...CATEGORIES, ...(data?.customCategories || [])];
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
        if (value.version < 4) {
          value.rewards = value.rewards || [];
          value.savedQuotes = value.savedQuotes || [];
          value.version = 4;
        }
        if (value.version < 5) {
          value.excused = value.excused || {};
          value.version = 5;
        }
        if (value.version < 6) {
          // Unifico le categorie: base + eventuali personalizzate diventano un'unica lista modificabile
          const base = ['Cucina', 'Pulizia', 'Bucato', 'Gestione', 'Esterno'];
          const custom = value.customCategories || [];
          value.categories = Array.from(new Set([...base, ...custom]));
          value.version = 6;
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
    data.users.forEach((u) => { s[u.id] = computeStreak(data.log, u.id, data.excused || {}); });
    return s;
  }, [data]);

  const me = useMemo(() => {
    if (!data || !identity) return null;
    return data.users.find((u) => u.id === identity) || null;
  }, [data, identity]);

  const otherUser = me && data ? data.users.find((u) => u.id !== me.id) : null;

  // Registrazione con retrodatazione + dedica + conteggio multiplo
  const logChore = (chore, user, count = 1, dateStr = todayStr(), dedicate = false, extras = []) => {
    const isToday = dateStr === todayStr();
    const baseTime = isToday ? new Date() : new Date(`${dateStr}T12:00:00`);
    // Extra selezionati: salvo gli id + uno snapshot (per il ricalcolo storico anche se poi cambiano)
    const choreExtras = chore.extras || [];
    const selectedExtras = extras.filter((id) => choreExtras.some((e) => e.id === id));
    const extrasSnapshot = choreExtras.filter((e) => selectedExtras.includes(e.id)).map((e) => ({ id: e.id, name: e.name, points: e.points }));
    const extrasPoints = extrasSnapshot.reduce((s, e) => s + e.points, 0);
    const entries = [];
    for (let i = 0; i < count; i++) {
      const ts = new Date(baseTime.getTime() + i * 1000);
      entries.push({
        id: uid(), userId: user.id, choreId: chore.id,
        snapshotPoints: chore.points, snapshotName: chore.name, snapshotEmoji: chore.emoji, snapshotCategory: chore.category,
        selectedExtras, extrasSnapshot,
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
    setPickerChore(null); setPickerCount(1); setPickerDate(todayStr()); setPickerDedicate(false); setPickerExtras([]);

    const pts = (chore.points + extrasPoints) * count;
    vibrate(count > 1 ? [15, 40, 15] : 15);
    if (leveledUp) playLevelUpSound(soundOn);
    else if (justUnlocked) playAchievementSound(soundOn);
    else playCompletionSound(chore.points, soundOn);

    setConfetti({ user, chore, count, points: pts, achievement: justUnlocked, levelUp: leveledUp ? newLevel : null, dedicated: dedicate && otherUser ? otherUser : null, retro: !isToday ? dateStr : null });
    setTimeout(() => setConfetti(null), (justUnlocked || leveledUp) ? 2800 : 2000);
  };

  const removeEntry = (id) => {
    setRemovingIds((ids) => [...ids, id]);
    vibrate(10);
    setTimeout(() => {
      save({ ...dataRef.current, log: dataRef.current.log.filter((e) => e.id !== id) });
      setRemovingIds((ids) => ids.filter((x) => x !== id));
    }, 280);
  };
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
  const addCustomCategory = (name) => {
    const n = name.trim();
    if (!n || allCategories.includes(n)) return;
    save({ ...dataRef.current, categories: [...(dataRef.current.categories || []), n] });
  };
  const renameCategory = (oldName, newName) => {
    const n = newName.trim();
    if (!n || n === oldName) return;
    const cats = Array.from(new Set((dataRef.current.categories || []).map((c) => (c === oldName ? n : c))));
    const chores = dataRef.current.chores.map((c) => (c.category === oldName ? { ...c, category: n } : c));
    save({ ...dataRef.current, categories: cats, chores });
  };
  const removeCategory = (name) => {
    const cats = (dataRef.current.categories || []).filter((c) => c !== name);
    if (cats.length === 0) return; // deve restarne almeno una
    const fallback = cats[0];
    // I lavori che usavano la categoria eliminata passano alla prima rimasta
    const chores = dataRef.current.chores.map((c) => (c.category === name ? { ...c, category: fallback } : c));
    save({ ...dataRef.current, categories: cats, chores });
  };
  const choresUsingCategory = (name) => (dataRef.current?.chores || []).filter((c) => c.category === name).length;
  const togglePenalties = () => save({ ...dataRef.current, penaltiesOn: !dataRef.current.penaltiesOn });

  // Ricompense
  const addReward = (reward) => save({ ...dataRef.current, rewards: [...(dataRef.current.rewards || []), { id: uid(), claimed: false, ...reward }] });
  const removeReward = (id) => save({ ...dataRef.current, rewards: (dataRef.current.rewards || []).filter((r) => r.id !== id) });
  const claimReward = (id) => save({ ...dataRef.current, rewards: (dataRef.current.rewards || []).map((r) => (r.id === id ? { ...r, claimed: true, claimedAt: todayStr(), claimedBy: identity } : r)) });

  // Citazioni salvate
  const isQuoteSaved = (q) => (dataRef.current.savedQuotes || []).some((s) => s.text === q.text);
  const toggleSaveQuote = (q) => {
    const saved = dataRef.current.savedQuotes || [];
    if (saved.some((s) => s.text === q.text)) save({ ...dataRef.current, savedQuotes: saved.filter((s) => s.text !== q.text) });
    else save({ ...dataRef.current, savedQuotes: [{ ...q, savedAt: todayStr() }, ...saved] });
  };

  // Ricorrenza lavori (giorni; 0/null = nessuna)
  const setChoreRecurrence = (id, days) => save({ ...dataRef.current, chores: dataRef.current.chores.map((c) => (c.id === id ? { ...c, recurrence: days ? { days: Number(days) } : null } : c)) });

  // Giustificazione giorni serie
  const excuseDay = (userId, date, reason, note = '') => {
    const excused = { ...(dataRef.current.excused || {}) };
    excused[userId] = { ...(excused[userId] || {}), [date]: { reason, note } };
    save({ ...dataRef.current, excused });
  };
  const unexcuseDay = (userId, date) => {
    const excused = { ...(dataRef.current.excused || {}) };
    if (excused[userId]) {
      excused[userId] = { ...excused[userId] };
      delete excused[userId][date];
    }
    save({ ...dataRef.current, excused });
  };

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
    setPickerCount(1); setPickerDate(todayStr()); setPickerDedicate(false); setPickerExtras([]);
    setPickerChore(chore);
  };

  if (loading || !data) {
    return (
      <div style={{ background: t.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', color: t.textSoft }}>
        Caricamento...
      </div>
    );
  }

  const cardShadow = t.shadow;

  // Salute casa, citazione giornaliera, messaggio motivazionale, allarme streak
  const health = houseHealth(data.log, choresById);
  const hState = houseState(health.score);
  const quote = quoteOfTheDay();
  const quoteSaved = isQuoteSaved(quote);
  const motivation = me ? motivationalMessage(data.log, choresById, me.id, otherUser?.id, data.users) : null;
  const streakRisk = me && streaks[me.id] > 0 && !data.log.some((e) => e.userId === me.id && e.date === todayStr()) && new Date().getHours() >= 18;

  // Lavori ricorrenti in scadenza o scaduti
  const dueChores = data.chores
    .map((c) => ({ chore: c, rec: recurringStatus(c, data.log) }))
    .filter((x) => x.rec && (x.rec.status === 'due' || x.rec.status === 'overdue'))
    .sort((a, b) => a.rec.daysLeft - b.rec.daysLeft);

  // Contesto ricompense
  const weeklyWinnerId = (() => {
    if (!otherUser || !me) return null;
    const ws = startOfWeek();
    const wk = {};
    data.users.forEach((u) => { wk[u.id] = 0; });
    data.log.forEach((e) => { if (new Date(e.timestamp) >= ws) wk[e.userId] = (wk[e.userId] || 0) + pointsForEntry(e, choresById); });
    const sorted = [...data.users].sort((a, b) => (wk[b.id] || 0) - (wk[a.id] || 0));
    return (wk[sorted[0].id] || 0) > (wk[sorted[1]?.id] || 0) ? sorted[0].id : null;
  })();
  const rewardCtx = me ? {
    myId: me.id,
    myTotal: totals[me.id] || 0,
    otherTotal: otherUser ? totals[otherUser.id] || 0 : 0,
    coupleTotal: Object.values(totals).reduce((a, b) => a + b, 0),
    weeklyWinnerId,
    myWeekPoints: 1,
  } : null;
  const rewards = data.rewards || [];
  const unclaimedAchievedRewards = rewardCtx ? rewards.filter((r) => !r.claimed && rewardAchieved(r, rewardCtx)) : [];

  // Progresso obiettivo di coppia
  const coupleGoalProgress = (() => {
    if (!data.coupleGoal) return null;
    const since = data.coupleGoal.createdAt;
    const pts = data.log.filter((e) => e.date >= since).reduce((s, e) => s + pointsForEntry(e, choresById), 0);
    return { current: pts, target: data.coupleGoal.target, pct: Math.min(100, Math.round((pts / data.coupleGoal.target) * 100)), deadline: data.coupleGoal.deadline };
  })();

  return (
    <div style={{ background: t.bg, minHeight: '100vh', fontFamily: t.font, color: t.text, paddingBottom: 'calc(92px + env(safe-area-inset-bottom))', transition: 'background 0.4s' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Nunito:wght@400;600;700;800&display=swap');
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        body { margin: 0; }
        .display { font-family: ${t.fontDisplay}; font-weight: ${t.displayWeight}; }
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
        input, select { background: ${t.card}; color: ${t.text}; min-height: 44px; }
        input[type="date"] { min-height: 44px; }
        @keyframes slide-out { from { opacity: 1; transform: translateX(0); max-height: 80px; } to { opacity: 0; transform: translateX(40px); max-height: 0; margin: 0; padding-top: 0; padding-bottom: 0; } }
        .slide-out { animation: slide-out 0.28s ease-in forwards; overflow: hidden; }
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
              {(() => {
                const exPts = (pickerChore.extras || []).filter((e) => pickerExtras.includes(e.id)).reduce((s, e) => s + e.points, 0);
                const unit = pickerChore.points + exPts;
                return <div style={{ fontSize: '14px', color: t.textSoft }}>+{unit * pickerCount} punti{pickerCount > 1 ? ` (${unit} × ${pickerCount})` : ''}{exPts > 0 ? ` · include +${exPts} extra` : ''}</div>;
              })()}
            </div>

            {/* Quantità */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px', marginBottom: '6px' }}>
              <button onClick={() => setPickerCount((c) => Math.max(1, c - 1))} style={{ width: '52px', height: '52px', borderRadius: '50%', border: `2px solid ${t.line}`, background: t.card, color: t.text, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Minus size={24} /></button>
              <div className="display" style={{ fontSize: '32px', fontWeight: 800, minWidth: '50px', textAlign: 'center', color: t.text }}>{pickerCount}</div>
              <button onClick={() => setPickerCount((c) => Math.min(20, c + 1))} style={{ width: '52px', height: '52px', borderRadius: '50%', border: `2px solid ${t.line}`, background: t.card, color: t.text, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={24} /></button>
            </div>
            <div style={{ fontSize: '11px', color: t.textSoft, textAlign: 'center', marginBottom: '14px' }}>Quante volte?</div>

            {/* Extra opzionali */}
            {(pickerChore.extras || []).length > 0 && (
              <div style={{ background: dark ? 'rgba(255,255,255,0.05)' : '#F5F0FF', borderRadius: '14px', padding: '12px', marginBottom: '12px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: t.text, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}><Plus size={15} color={t.lavender} /> Hai fatto anche...? (facoltativo)</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {(pickerChore.extras || []).map((ex) => {
                    const on = pickerExtras.includes(ex.id);
                    return (
                      <button key={ex.id} onClick={() => setPickerExtras((arr) => on ? arr.filter((x) => x !== ex.id) : [...arr, ex.id])} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '11px 12px', borderRadius: '12px', border: `2px solid ${on ? t.lavender : t.line}`, background: on ? (dark ? 'rgba(167,139,250,0.15)' : '#EDE7FF') : t.card, cursor: 'pointer', textAlign: 'left', minHeight: '44px' }}>
                        <div style={{ width: '22px', height: '22px', borderRadius: '7px', border: `2px solid ${on ? t.lavender : t.line}`, background: on ? t.lavender : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{on && <Check size={14} color="#fff" />}</div>
                        <span style={{ flex: 1, fontSize: '14px', fontWeight: 700, color: t.text }}>{ex.name}</span>
                        <span style={{ fontSize: '14px', fontWeight: 800, color: t.lavender }}>+{ex.points}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
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
                <button onClick={() => logChore(pickerChore, me, pickerCount, pickerDate, pickerDedicate, pickerExtras)} style={{ background: me.color, border: 'none', borderRadius: '18px', padding: '16px', color: '#fff', fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: '17px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '24px' }}>{me.emoji}</span> L'ho fatto io
                </button>
                {otherUser && (
                  <button onClick={() => logChore(pickerChore, otherUser, pickerCount, pickerDate, false, pickerExtras)} style={{ background: 'transparent', border: `2px solid ${otherUser.color}`, borderRadius: '18px', padding: '12px', color: otherUser.color, fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '20px' }}>{otherUser.emoji}</span> L'ha fatto {otherUser.name}
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '12px' }}>
                {data.users.map((u) => (
                  <button key={u.id} onClick={() => logChore(pickerChore, u, pickerCount, pickerDate, false, pickerExtras)} style={{ flex: 1, background: u.color, border: 'none', borderRadius: '18px', padding: '18px 8px', color: '#fff', fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: '16px', cursor: 'pointer' }}>
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
          <button onClick={() => setShowShare(true)} className="nav-btn" style={{ background: t.card, border: 'none', borderRadius: '12px', width: '42px', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.textSoft, cursor: 'pointer', boxShadow: cardShadow }}><Share2 size={18} /></button>
          <button onClick={() => setSoundOn((s) => !s)} className="nav-btn" style={{ background: t.card, border: 'none', borderRadius: '12px', width: '42px', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.textSoft, cursor: 'pointer', boxShadow: cardShadow }}>{soundOn ? <Volume2 size={18} /> : <VolumeX size={18} />}</button>
          <button onClick={() => setDark((d) => !d)} className="nav-btn" style={{ background: t.card, border: 'none', borderRadius: '12px', width: '42px', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.textSoft, cursor: 'pointer', boxShadow: cardShadow }}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
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
                      <button onClick={() => setTab('streak')} style={{ fontSize: '12px', marginTop: '6px', color: t.textSoft, display: 'flex', alignItems: 'center', gap: '4px', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}><Flame size={14} color={t.coral} /> {streaks[u.id]} {streaks[u.id] === 1 ? 'giorno' : 'giorni'}</button>
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

          {/* Casetta illustrata — salute della casa */}
          <div className="slide-up" style={{ background: t.card, borderRadius: t.radius, padding: '18px', marginBottom: '16px', boxShadow: cardShadow, display: 'flex', alignItems: 'center', gap: '16px' }}>
            <HouseSvg score={health.score} t={t} size={104} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: t.textSoft, textTransform: 'uppercase', letterSpacing: '0.04em' }}>La casa è</div>
              <div className="display" style={{ fontSize: '20px', fontWeight: 800, color: t.text, textTransform: 'capitalize' }}>{hState.label}{hState.sparkle ? ' ✨' : ''}</div>
              <div style={{ height: '8px', background: t.line, borderRadius: '6px', overflow: 'hidden', marginTop: '10px' }}>
                <div style={{ height: '100%', width: `${health.score}%`, background: health.color, borderRadius: '6px', transition: 'width 0.6s' }} />
              </div>
              <div style={{ fontSize: '11px', color: t.textSoft, marginTop: '6px' }}>{hState.sparkle ? 'Perfetta! Continuate così 🌟' : health.score < 35 ? 'Un paio di lavori e migliora subito' : 'Si mantiene bene'}</div>
            </div>
          </div>

          {/* Lavori in scadenza (ricorrenti) */}
          {dueChores.length > 0 && (
            <div className="slide-up" style={{ background: t.card, borderRadius: t.radius, padding: '14px', marginBottom: '16px', boxShadow: cardShadow, borderLeft: `4px solid ${t.sunny}` }}>
              <div style={{ fontSize: '13px', fontWeight: 800, color: t.text, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}><Bell size={16} color={t.sunny} /> Da fare presto</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {dueChores.slice(0, 4).map(({ chore, rec }) => (
                  <div key={chore.id} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ fontSize: '20px' }}>{chore.emoji}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: t.text }}>{chore.name}</div>
                      <div style={{ fontSize: '11px', color: rec.status === 'overdue' ? t.coral : t.textSoft, fontWeight: 700 }}>
                        {rec.status === 'overdue' ? `In ritardo di ${Math.abs(rec.daysLeft)} ${Math.abs(rec.daysLeft) === 1 ? 'giorno' : 'giorni'}` : rec.daysLeft === 0 ? 'Da fare oggi' : 'Da fare domani'}
                      </div>
                    </div>
                    <button onClick={() => handleChoreClick(chore)} className="wiggle" style={{ background: t.sunny, border: 'none', borderRadius: t.radiusSm, padding: '11px 16px', fontWeight: 700, color: '#2D2A4A', cursor: 'pointer', fontSize: '14px', minHeight: '44px' }}>Fatto</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ricompense */}
          {(rewards.length > 0 || unclaimedAchievedRewards.length > 0) && (
            <button onClick={() => setShowRewards(true)} className="slide-up" style={{ width: '100%', textAlign: 'left', background: unclaimedAchievedRewards.length > 0 ? `linear-gradient(135deg, ${t.sunny}, ${t.coral})` : t.card, border: 'none', borderRadius: t.radius, padding: '14px', marginBottom: '16px', boxShadow: cardShadow, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Gift size={26} color={unclaimedAchievedRewards.length > 0 ? '#fff' : t.lavender} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '14px', fontWeight: 800, color: unclaimedAchievedRewards.length > 0 ? '#fff' : t.text }}>
                  {unclaimedAchievedRewards.length > 0 ? `${unclaimedAchievedRewards.length} ricompensa${unclaimedAchievedRewards.length > 1 ? 'e' : ''} da riscuotere! 🎁` : 'Ricompense'}
                </div>
                <div style={{ fontSize: '12px', color: unclaimedAchievedRewards.length > 0 ? 'rgba(255,255,255,0.9)' : t.textSoft }}>
                  {unclaimedAchievedRewards.length > 0 ? 'Tocca per vedere' : `${rewards.filter((r) => !r.claimed).length} attive`}
                </div>
              </div>
            </button>
          )}

          {/* Citazione del giorno (salvabile) */}
          <div className="slide-up" style={{ background: t.style === 'minimal' ? (dark ? 'rgba(167,139,250,0.1)' : '#FFFFFF') : (dark ? 'rgba(167,139,250,0.12)' : '#F5F0FF'), borderRadius: t.radius, padding: '14px 16px', marginBottom: '16px', borderLeft: `4px solid ${t.lavender}`, boxShadow: t.style === 'minimal' ? cardShadow : 'none', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '14px', fontStyle: 'italic', color: t.text, lineHeight: 1.5 }}>"{quote.text}"</div>
              <div style={{ fontSize: '12px', color: t.textSoft, marginTop: '6px', fontWeight: 700 }}>— {quote.author}{quote.source ? `, ${quote.source}` : ''}</div>
            </div>
            <button onClick={() => toggleSaveQuote(quote)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: quoteSaved ? t.coral : t.textSoft, flexShrink: 0, padding: '2px' }} title={quoteSaved ? 'Salvata' : 'Salva citazione'}>
              <Bookmark size={20} fill={quoteSaved ? t.coral : 'none'} />
            </button>
          </div>

          {/* Messaggio motivazionale */}
          {motivation && (
            <div className="slide-up" style={{ background: t.card, borderRadius: t.radiusSm, padding: '12px 14px', marginBottom: '16px', fontSize: '13px', color: t.text, fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', boxShadow: cardShadow }}>
              <Sparkles size={16} color={t.sunny} /> {motivation}
            </div>
          )}

          {/* Azioni rapide */}
          <div className="display" style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px', color: t.text }}>Azioni rapide</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '18px' }}>
            {data.chores.slice(0, 6).map((c, i) => (
              <button key={c.id} onClick={() => handleChoreClick(c)} className="quick-card slide-up" style={{ background: t.card, border: 'none', borderRadius: '18px', padding: '16px', textAlign: 'left', boxShadow: cardShadow, cursor: 'pointer', animationDelay: `${i * 0.04}s` }}>
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

      {/* ===== SERIE ===== */}
      {tab === 'streak' && (
        <StreakView
          data={data}
          me={me}
          t={t}
          onExcuse={excuseDay}
          onUnexcuse={unexcuseDay}
        />
      )}

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
          <div style={{ fontSize: '11px', color: t.textSoft, marginBottom: '10px', background: t.card, borderRadius: t.radiusSm, padding: '10px 12px' }}>💡 Cambiando i punti di un lavoro, <strong>tutto lo storico si ricalcola</strong> automaticamente.</div>

          {/* Ricerca */}
          <div style={{ position: 'relative', marginBottom: '10px' }}>
            <Search size={16} color={t.textSoft} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input placeholder="Cerca un lavoro..." value={choreSearch} onChange={(e) => setChoreSearch(e.target.value)} style={{ width: '100%', padding: '11px 11px 11px 38px', borderRadius: t.radiusSm, border: `1px solid ${t.line}`, fontSize: '14px', background: t.card, color: t.text }} />
            {choreSearch && <button onClick={() => setChoreSearch('')} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: t.textSoft, cursor: 'pointer' }}><X size={16} /></button>}
          </div>

          {/* Filtri categoria */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', flexWrap: 'wrap' }}>
            {['all', ...allCategories].map((cat) => {
              const active = choreCat === cat;
              return <button key={cat} onClick={() => setChoreCat(cat)} style={{ padding: '7px 12px', borderRadius: t.radiusSm, border: 'none', fontWeight: 700, fontSize: '12px', cursor: 'pointer', background: active ? t.coral : t.card, color: active ? '#fff' : t.textSoft, boxShadow: active ? 'none' : cardShadow }}>{cat === 'all' ? 'Tutte' : cat}</button>;
            })}
          </div>

          {/* Usati di recente */}
          {(() => {
            const recent = recentChores(data.log, choresById, 7, 5);
            if (recent.length === 0 || choreSearch || choreCat !== 'all') return null;
            return (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: 800, color: t.textSoft, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}><Clock size={14} /> USATI DI RECENTE</div>
                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                  {recent.map((c) => (
                    <button key={c.id} onClick={() => handleChoreClick(c)} className="quick-card" style={{ flexShrink: 0, background: t.card, border: 'none', borderRadius: t.radiusSm, padding: '10px 14px', boxShadow: cardShadow, cursor: 'pointer', textAlign: 'center', minWidth: '88px' }}>
                      <div style={{ fontSize: '24px' }}>{c.emoji}</div>
                      <div style={{ fontSize: '11px', fontWeight: 700, marginTop: '4px', color: t.text, lineHeight: 1.1 }}>{c.name.length > 16 ? c.name.slice(0, 15) + '…' : c.name}</div>
                      <div style={{ fontSize: '11px', color: t.coral, fontWeight: 800, marginTop: '2px' }}>+{c.points}</div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {(() => {
              const filtered = data.chores.filter((c) => {
                if (choreCat !== 'all' && c.category !== choreCat) return false;
                if (choreSearch && !c.name.toLowerCase().includes(choreSearch.toLowerCase())) return false;
                return true;
              });
              if (filtered.length === 0) return <div style={{ background: t.card, borderRadius: t.radius, padding: '16px', color: t.textSoft, fontSize: '14px', textAlign: 'center' }}>Nessun lavoro trovato.</div>;
              return filtered.map((c) => (
                <ChoreRow key={c.id} chore={c} editing={editingChoreId === c.id} t={t} categories={allCategories} log={data.log}
                  onEdit={() => setEditingChoreId(editingChoreId === c.id ? null : c.id)}
                  onSave={(patch) => { updateChore(c.id, patch); setEditingChoreId(null); }}
                  onDelete={() => removeChore(c.id)} onLog={() => handleChoreClick(c)}
                  onRecurrence={(days) => setChoreRecurrence(c.id, days)} />
              ));
            })()}
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
              if (filtered.length === 0) return <div style={{ background: t.card, borderRadius: t.radius, padding: '16px', color: t.textSoft, fontSize: '14px', textAlign: 'center' }}>Nessuna attività trovata.</div>;
              const groups = groupByDay(filtered);
              let idx = 0;
              return groups.map((g) => {
                const dayPts = g.entries.reduce((s, e) => s + pointsForEntry(e, choresById), 0);
                return (
                  <div key={g.date}>
                    {/* Intestazione giorno */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '14px 4px 8px', position: 'sticky', top: 0 }}>
                      <div className="display" style={{ fontSize: '14px', fontWeight: 800, color: t.text, textTransform: 'capitalize' }}>{g.label}</div>
                      <div style={{ fontSize: '12px', fontWeight: 800, color: t.coral, background: t.style === 'minimal' ? 'transparent' : (dark ? 'rgba(255,107,107,0.12)' : '#FFF0EE'), padding: '3px 10px', borderRadius: '10px' }}>{g.entries.length} {g.entries.length === 1 ? 'lavoro' : 'lavori'} · {dayPts} pt</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {g.entries.map((e) => {
                        const u = data.users.find((x) => x.id === e.userId);
                        const info = choreNameForEntry(e, choresById);
                        const dedUser = e.dedicatedTo ? data.users.find((x) => x.id === e.dedicatedTo) : null;
                        idx++;
                        return (
                          <div key={e.id} className={removingIds.includes(e.id) ? 'slide-out' : 'slide-up'} style={{ background: t.card, borderRadius: t.radiusSm, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: cardShadow, animationDelay: removingIds.includes(e.id) ? '0s' : `${Math.min(idx, 10) * 0.02}s` }}>
                            <div style={{ fontSize: '22px' }}>{info.emoji}</div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '13px', fontWeight: 700, color: t.text }}>{info.name} {dedUser && <Heart size={11} color={t.coral} fill={t.coral} style={{ display: 'inline', verticalAlign: 'middle' }} />}</div>
                              <div style={{ fontSize: '12px', color: t.textSoft }}>{u?.emoji} {u?.name} · {formatTime(e.timestamp)}{dedUser ? ` · ❤️ ${dedUser.name}` : ''}</div>
                            </div>
                            <div style={{ fontWeight: 800, color: u?.color }} className="display">+{pointsForEntry(e, choresById)}</div>
                            <button onClick={() => removeEntry(e.id)} style={{ background: 'transparent', border: 'none', color: t.textSoft, cursor: 'pointer' }}><Trash2 size={16} /></button>
                          </div>
                        );
                      })}
                    </div>
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
          style={style} setStyle={setStyle}
          exportCSV={exportCSV} resetHistory={resetHistory} t={t} cardShadow={cardShadow} season={season}
          allCategories={allCategories} addCustomCategory={addCustomCategory} renameCategory={renameCategory} removeCategory={removeCategory} choresUsingCategory={choresUsingCategory}
          penaltiesOn={data.penaltiesOn} togglePenalties={togglePenalties} vacations={data.vacations} setVacation={setVacation}
          onOpenRewards={() => setShowRewards(true)} onOpenSavedQuotes={() => setShowSavedQuotes(true)}
          savedCount={(data.savedQuotes || []).length}
        />
      )}

      {/* Goal edit modal */}
      {showGoalEdit && <GoalEditModal current={data.coupleGoal} onSave={(target, deadline) => { setCoupleGoal(target, deadline); setShowGoalEdit(false); }} onClose={() => setShowGoalEdit(false)} t={t} />}

      {/* Rewards modal */}
      {showRewards && rewardCtx && (
        <RewardsModal rewards={rewards} ctx={rewardCtx} users={data.users} identity={identity} t={t}
          onAdd={addReward} onRemove={removeReward} onClaim={claimReward} onClose={() => setShowRewards(false)} />
      )}

      {/* Saved quotes modal */}
      {showSavedQuotes && (
        <SavedQuotesModal saved={data.savedQuotes || []} t={t} onRemove={(q) => toggleSaveQuote(q)} onClose={() => setShowSavedQuotes(false)} />
      )}

      {/* Bottom nav */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: t.navBg, backdropFilter: t.blur, WebkitBackdropFilter: t.blur, boxShadow: dark ? '0 -4px 16px rgba(0,0,0,0.4)' : '0 -4px 16px rgba(45,42,74,0.08)', borderTop: t.style === 'minimal' ? `0.5px solid ${t.line}` : 'none', display: 'flex', justifyContent: 'space-around', padding: '10px 2px calc(14px + env(safe-area-inset-bottom))', borderRadius: t.style === 'minimal' ? '0' : '20px 20px 0 0' }}>
        {[
          { id: 'home', icon: Home, label: 'Home' },
          { id: 'chores', icon: ListChecks, label: 'Lavori' },
          { id: 'history', icon: History, label: 'Storico' },
          { id: 'streak', icon: Flame, label: 'Serie' },
          { id: 'stats', icon: BarChart3, label: 'Stats' },
          { id: 'settings', icon: Settings, label: 'Opzioni' },
        ].map((it) => {
          const Icon = it.icon; const active = tab === it.id;
          return <button key={it.id} onClick={() => setTab(it.id)} className="nav-btn" style={{ background: 'transparent', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', color: active ? t.coral : t.textSoft, cursor: 'pointer', fontSize: '11px', fontWeight: 700, flex: 1, minHeight: '50px', padding: '4px 0' }}><Icon size={23} />{it.label}</button>;
        })}
      </div>
    </div>
  );
}

// ============================================================
// COMPONENTI AUSILIARI
// ============================================================

function SettingsView({ data, me, identity, setIdentity, updateUser, soundOn, setSoundOn, dark, setDark, seasonal, setSeasonal, style, setStyle, exportCSV, resetHistory, t, cardShadow, season, allCategories, addCustomCategory, renameCategory, removeCategory, choresUsingCategory, penaltiesOn, togglePenalties, vacations, setVacation, onOpenRewards, onOpenSavedQuotes, savedCount }) {
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

      {/* Categorie */}
      <div className="display" style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px', color: t.text }}>Categorie</div>
      <div style={{ background: t.card, borderRadius: t.radius, padding: '14px', boxShadow: cardShadow, marginBottom: '20px' }}>
        <div style={{ fontSize: '12px', color: t.textSoft, marginBottom: '12px' }}>Personalizza tutte le categorie. Rinominandone una, i lavori collegati si aggiornano da soli. Eliminandone una, i suoi lavori passano alla prima categoria.</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
          {allCategories.map((c) => {
            const used = choresUsingCategory(c);
            return (
              <div key={c} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  defaultValue={c}
                  onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== c) renameCategory(c, v); else e.target.value = c; }}
                  style={{ flex: 1, padding: '10px', borderRadius: '10px', border: `1px solid ${t.line}`, fontSize: '14px', fontWeight: 700, background: t.card, color: t.text }}
                />
                <span style={{ fontSize: '11px', color: t.textSoft, minWidth: '52px', textAlign: 'right' }}>{used} {used === 1 ? 'lavoro' : 'lavori'}</span>
                <button
                  onClick={() => {
                    if (allCategories.length <= 1) return;
                    if (used > 0) { if (!window.confirm(`"${c}" è usata da ${used} lavori. Eliminandola, passeranno a "${allCategories.find((x) => x !== c)}". Procedere?`)) return; }
                    removeCategory(c);
                  }}
                  disabled={allCategories.length <= 1}
                  style={{ background: 'transparent', border: 'none', color: allCategories.length <= 1 ? t.line : t.textSoft, cursor: allCategories.length <= 1 ? 'default' : 'pointer', display: 'flex', padding: '8px' }}
                ><Trash2 size={16} /></button>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="Nuova categoria (es. Garage)" style={{ flex: 1, padding: '10px', borderRadius: '10px', border: `1px solid ${t.line}`, fontSize: '13px' }} />
          <button onClick={() => { addCustomCategory(newCat); setNewCat(''); }} style={{ background: t.mint, border: 'none', color: '#fff', borderRadius: '10px', padding: '8px 16px', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}>Aggiungi</button>
        </div>
      </div>

      {/* Stile grafico */}
      <div className="display" style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px', color: t.text }}>Stile grafico</div>
      <div style={{ background: t.card, borderRadius: t.radius, padding: '14px', boxShadow: cardShadow, marginBottom: '20px' }}>
        <div style={{ fontSize: '12px', color: t.textSoft, marginBottom: '10px' }}>Scegli l'aspetto dell'app. Puoi tornare indietro quando vuoi con un tocco.</div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => setStyle('pop')} style={{ flex: 1, padding: '14px', borderRadius: t.radiusSm, border: `2px solid ${style === 'pop' ? t.coral : t.line}`, background: style === 'pop' ? (dark ? 'rgba(255,107,107,0.12)' : '#FFF0EE') : 'transparent', cursor: 'pointer', textAlign: 'center' }}>
            <div style={{ fontSize: '24px' }}>🎨</div>
            <div style={{ fontSize: '13px', fontWeight: 800, color: t.text, marginTop: '4px' }}>Colorato</div>
            <div style={{ fontSize: '10px', color: t.textSoft }}>Vivace e giocoso {style === 'pop' ? '✓' : ''}</div>
          </button>
          <button onClick={() => setStyle('minimal')} style={{ flex: 1, padding: '14px', borderRadius: t.radiusSm, border: `2px solid ${style === 'minimal' ? t.coral : t.line}`, background: style === 'minimal' ? (dark ? 'rgba(255,107,107,0.12)' : '#FFF0EE') : 'transparent', cursor: 'pointer', textAlign: 'center' }}>
            <div style={{ fontSize: '24px' }}>🍏</div>
            <div style={{ fontSize: '13px', fontWeight: 800, color: t.text, marginTop: '4px' }}>Minimal</div>
            <div style={{ fontSize: '10px', color: t.textSoft }}>Pulito, stile Apple {style === 'minimal' ? '✓' : ''}</div>
          </button>
        </div>
      </div>

      {/* Ricompense & Citazioni */}
      <div className="display" style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px', color: t.text }}>Extra</div>
      <button onClick={onOpenRewards} style={{ width: '100%', background: t.card, border: 'none', color: t.text, borderRadius: t.radiusSm, padding: '14px', fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginBottom: '10px', boxShadow: cardShadow }}>
        <Gift size={18} color={t.lavender} /> Gestisci ricompense <span style={{ marginLeft: 'auto', color: t.textSoft, fontSize: '12px' }}>{(data.rewards || []).length}</span>
      </button>
      <button onClick={onOpenSavedQuotes} style={{ width: '100%', background: t.card, border: 'none', color: t.text, borderRadius: t.radiusSm, padding: '14px', fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginBottom: '20px', boxShadow: cardShadow }}>
        <Bookmark size={18} color={t.coral} /> Citazioni salvate <span style={{ marginLeft: 'auto', color: t.textSoft, fontSize: '12px' }}>{savedCount}</span>
      </button>

      {/* Preferenze */}
      <div className="display" style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px', color: t.text }}>Preferenze</div>
      <div style={{ background: t.card, borderRadius: t.radius, padding: '4px 14px', boxShadow: cardShadow, marginBottom: '20px' }}>
        <ToggleRow label="🔊 Suoni" value={soundOn} onChange={() => setSoundOn((s) => !s)} t={t} />
        <ToggleRow label="🌙 Tema scuro" value={!!dark} onChange={() => setDark((d) => !d)} t={t} />
        <ToggleRow label={`${season.emoji} Tema stagionale (${season.name})`} value={seasonal} onChange={() => setSeasonal((s) => !s)} t={t} />
        <ToggleRow label="⚠️ Penalità per lavori dimenticati" value={penaltiesOn} onChange={togglePenalties} t={t} last />
      </div>
      {penaltiesOn && <div style={{ fontSize: '11px', color: t.textSoft, marginBottom: '20px', background: t.card, borderRadius: t.radiusSm, padding: '10px 12px' }}>Con le penalità attive, dimenticare a lungo i lavori chiave abbassa la "salute della casa" più velocemente.</div>}

      {/* Dati */}
      <div className="display" style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px', color: t.text }}>Dati</div>
      <button onClick={exportCSV} style={{ width: '100%', background: t.card, border: `1px solid ${t.line}`, color: t.text, borderRadius: t.radiusSm, padding: '12px', fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', marginBottom: '10px' }}><Download size={16} /> Esporta storico (CSV)</button>
      <button onClick={resetHistory} style={{ width: '100%', background: t.card, border: `1px solid ${t.line}`, color: '#C0392B', borderRadius: t.radiusSm, padding: '12px', fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', marginBottom: '24px' }}><RotateCcw size={16} /> Azzera storico e punti</button>
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

function ChoreRow({ chore, editing, onEdit, onSave, onDelete, onLog, t, categories, log, onRecurrence }) {
  const [draft, setDraft] = useState(chore);
  useEffect(() => { setDraft(chore); }, [chore, editing]);
  const rec = log ? recurringStatus(chore, log) : null;
  if (editing) {
    const recDays = draft.recurrence?.days || 0;
    return (
      <div className="pop-card" style={{ background: t.card, borderRadius: t.radiusSm, padding: '14px', boxShadow: '0 6px 16px rgba(45,42,74,0.1)' }}>
        <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '10px', border: `1px solid ${t.line}`, marginBottom: '8px', fontSize: '14px', fontFamily: 'inherit', fontWeight: 700 }} />
        <EmojiPicker options={CHORE_EMOJIS} value={draft.emoji} onChange={(em) => setDraft({ ...draft, emoji: em })} t={t} />
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
          <input type="number" value={draft.points} onChange={(e) => setDraft({ ...draft, points: Number(e.target.value) || 0 })} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: `1px solid ${t.line}`, fontSize: '14px' }} />
          <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: `1px solid ${t.line}`, fontSize: '14px' }}>{(categories || CATEGORIES).map((c) => <option key={c}>{c}</option>)}</select>
        </div>
        {/* Ricorrenza */}
        <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', color: t.textSoft, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}><Repeat size={14} /> Ricorrenza:</span>
          {[[0, 'No'], [1, 'Ogni giorno'], [3, 'Ogni 3 gg'], [7, 'Ogni settimana'], [14, 'Ogni 2 sett.'], [30, 'Ogni mese']].map(([d, label]) => (
            <button key={d} onClick={() => setDraft({ ...draft, recurrence: d ? { days: d } : null })} style={{ padding: '6px 10px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 700, background: recDays === d ? t.lavender : t.line, color: recDays === d ? '#fff' : t.textSoft }}>{label}</button>
          ))}
        </div>

        {/* Extra opzionali (sotto-voci con punti facoltativi) */}
        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: `1px solid ${t.line}` }}>
          <div style={{ fontSize: '12px', color: t.textSoft, fontWeight: 700, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}><Plus size={14} color={t.lavender} /> Extra opzionali (punti in più facoltativi)</div>
          {(draft.extras || []).map((ex, i) => (
            <div key={ex.id} style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '6px' }}>
              <input value={ex.name} placeholder="Es. Pulizia filtri" onChange={(e) => {
                const extras = [...draft.extras]; extras[i] = { ...ex, name: e.target.value }; setDraft({ ...draft, extras });
              }} style={{ flex: 1, padding: '9px', borderRadius: '9px', border: `1px solid ${t.line}`, fontSize: '13px' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                <span style={{ fontSize: '13px', color: t.textSoft, fontWeight: 700 }}>+</span>
                <input type="number" value={ex.points} onChange={(e) => {
                  const extras = [...draft.extras]; extras[i] = { ...ex, points: Number(e.target.value) || 0 }; setDraft({ ...draft, extras });
                }} style={{ width: '56px', padding: '9px', borderRadius: '9px', border: `1px solid ${t.line}`, fontSize: '13px', textAlign: 'center' }} />
              </div>
              <button onClick={() => setDraft({ ...draft, extras: draft.extras.filter((x) => x.id !== ex.id) })} style={{ background: 'transparent', border: 'none', color: t.textSoft, cursor: 'pointer', display: 'flex', padding: '6px' }}><X size={16} /></button>
            </div>
          ))}
          <button onClick={() => setDraft({ ...draft, extras: [...(draft.extras || []), { id: 'ex-' + uid(), name: '', points: 2 }] })} style={{ background: 'transparent', border: `1.5px dashed ${t.line}`, color: t.textSoft, borderRadius: '9px', padding: '8px 12px', fontWeight: 700, fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}><Plus size={14} /> Aggiungi extra</button>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
          <button onClick={onDelete} style={{ background: '#FFE5E5', border: 'none', color: '#C0392B', borderRadius: '10px', padding: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700, fontSize: '13px' }}><Trash2 size={15} /> Elimina</button>
          <button onClick={() => onSave({ ...draft, extras: (draft.extras || []).filter((e) => e.name.trim()) })} style={{ flex: 1, background: t.mint, border: 'none', color: '#fff', borderRadius: '10px', padding: '10px', fontWeight: 700, cursor: 'pointer' }}>Salva</button>
          <button onClick={onEdit} style={{ background: t.line, border: 'none', color: t.textSoft, borderRadius: '10px', padding: '10px', cursor: 'pointer' }}><X size={16} /></button>
        </div>
      </div>
    );
  }
  return (
    <div style={{ background: t.card, borderRadius: t.radiusSm, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: t.shadow }}>
      <div style={{ fontSize: '24px' }}>{chore.emoji}</div>
      <div style={{ flex: 1 }} onClick={onLog} role="button">
        <div style={{ fontSize: '14px', fontWeight: 700, color: t.text, display: 'flex', alignItems: 'center', gap: '6px' }}>
          {chore.name}
          {rec && <Repeat size={12} color={t.textSoft} />}
        </div>
        <div style={{ fontSize: '12px', color: t.textSoft }}>
          {chore.category} · {chore.points} punti
          {(chore.extras || []).length > 0 && <span style={{ color: t.lavender, fontWeight: 700 }}> · {chore.extras.length} extra</span>}
          {rec && rec.status === 'overdue' && <span style={{ color: t.coral, fontWeight: 700 }}> · in ritardo</span>}
          {rec && rec.status === 'due' && <span style={{ color: t.sunny, fontWeight: 700 }}> · da fare</span>}
        </div>
      </div>
      <button onClick={onEdit} style={{ background: t.line, border: 'none', borderRadius: '12px', padding: '11px', color: t.textSoft, cursor: 'pointer', display: 'flex', minHeight: '44px', alignItems: 'center' }}><Pencil size={17} /></button>
      <button onClick={onLog} className="wiggle" style={{ background: t.sunny, border: 'none', borderRadius: t.radiusSm, padding: '11px 16px', fontWeight: 700, color: '#2D2A4A', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '14px', minHeight: '44px' }}><Check size={17} /> Fatto</button>
    </div>
  );
}

// ============================================================
// MODALE RICOMPENSE
// ============================================================
function RewardsModal({ rewards, ctx, users, identity, t, onAdd, onRemove, onClaim, onClose }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ title: '', emoji: '🎁', type: 'points', target: 100 });

  const submit = () => {
    if (!form.title.trim()) return;
    onAdd({ title: form.title.trim(), emoji: form.emoji, type: form.type, target: Number(form.target) || 0 });
    setForm({ title: '', emoji: '🎁', type: 'points', target: 100 });
    setAdding(false);
  };

  const typeLabel = (r) => {
    if (r.type === 'points') return `Quando raggiungi ${r.target} punti`;
    if (r.type === 'couple') return `Quando insieme raggiungete ${r.target} punti`;
    if (r.type === 'weekly_win') return `Quando vinci la settimana`;
    return '';
  };
  const progress = (r) => {
    if (r.type === 'points') return Math.min(100, Math.round(((ctx.myTotal || 0) / r.target) * 100));
    if (r.type === 'couple') return Math.min(100, Math.round(((ctx.coupleTotal || 0) / r.target) * 100));
    if (r.type === 'weekly_win') return ctx.weeklyWinnerId === ctx.myId ? 100 : 0;
    return 0;
  };

  const REWARD_EMOJIS = ['🎁', '🍕', '🎬', '☕', '🍫', '🛋️', '💆', '🍷', '🏆', '❤️', '🎮', '🧖', '🍦', '🛍️'];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(45,42,74,0.5)', zIndex: 60, display: 'flex', alignItems: 'flex-end' }} onClick={onClose}>
      <div className="pop-card" style={{ background: t.card, width: '100%', borderRadius: '28px 28px 0 0', padding: '24px', paddingBottom: 'calc(24px + env(safe-area-inset-bottom))', maxHeight: '88vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div className="display" style={{ fontSize: '20px', fontWeight: 800, color: t.text, display: 'flex', alignItems: 'center', gap: '8px' }}><Gift size={22} color={t.lavender} /> Ricompense</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: t.textSoft, cursor: 'pointer' }}><X size={22} /></button>
        </div>
        <div style={{ fontSize: '12px', color: t.textSoft, marginBottom: '16px' }}>Premi veri concordati tra voi. Quando raggiungi l'obiettivo, riscuoti! 🎉</div>

        {rewards.length === 0 && !adding && (
          <div style={{ textAlign: 'center', padding: '20px', color: t.textSoft, fontSize: '14px' }}>Nessuna ricompensa ancora. Aggiungine una!</div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
          {rewards.map((r) => {
            const achieved = rewardAchieved(r, ctx);
            const pct = progress(r);
            return (
              <div key={r.id} style={{ background: achieved && !r.claimed ? `linear-gradient(135deg, ${t.sunny}22, ${t.coral}22)` : (t.style === 'minimal' ? 'transparent' : (t.card)), border: `1.5px solid ${achieved && !r.claimed ? t.coral : t.line}`, borderRadius: t.radiusSm, padding: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ fontSize: '28px', opacity: r.claimed ? 0.4 : 1 }}>{r.emoji}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: t.text, textDecoration: r.claimed ? 'line-through' : 'none' }}>{r.title}</div>
                    <div style={{ fontSize: '11px', color: t.textSoft }}>{typeLabel(r)}</div>
                  </div>
                  <button onClick={() => onRemove(r.id)} style={{ background: 'transparent', border: 'none', color: t.textSoft, cursor: 'pointer' }}><Trash2 size={15} /></button>
                </div>
                {!r.claimed && (
                  <>
                    <div style={{ height: '6px', background: t.line, borderRadius: '4px', overflow: 'hidden', marginTop: '10px' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: achieved ? t.mint : t.lavender, borderRadius: '4px', transition: 'width 0.5s' }} />
                    </div>
                    {achieved ? (
                      <button onClick={() => onClaim(r.id)} style={{ width: '100%', marginTop: '10px', background: t.coral, border: 'none', color: '#fff', borderRadius: '10px', padding: '10px', fontWeight: 800, cursor: 'pointer', fontSize: '13px' }}>🎉 Riscuoti ricompensa!</button>
                    ) : (
                      <div style={{ fontSize: '11px', color: t.textSoft, marginTop: '6px', textAlign: 'right' }}>{pct}%</div>
                    )}
                  </>
                )}
                {r.claimed && <div style={{ fontSize: '11px', color: t.mint, fontWeight: 700, marginTop: '6px' }}>✓ Riscossa{r.claimedBy ? ` da ${users.find((u) => u.id === r.claimedBy)?.name || ''}` : ''}</div>}
              </div>
            );
          })}
        </div>

        {adding ? (
          <div style={{ background: t.style === 'minimal' ? 'transparent' : (t.card), border: `1px solid ${t.line}`, borderRadius: t.radiusSm, padding: '14px' }}>
            <input placeholder="Es. Cena fuori a scelta" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '10px', border: `1px solid ${t.line}`, fontSize: '14px', marginBottom: '10px' }} />
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
              {REWARD_EMOJIS.map((em) => (
                <button key={em} onClick={() => setForm({ ...form, emoji: em })} style={{ width: '36px', height: '36px', fontSize: '18px', borderRadius: '10px', border: form.emoji === em ? `2px solid ${t.coral}` : `1px solid ${t.line}`, background: 'transparent', cursor: 'pointer' }}>{em}</button>
              ))}
            </div>
            <div style={{ fontSize: '12px', color: t.textSoft, marginBottom: '6px' }}>Condizione</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
              {[['points', 'Raggiungo un totale di punti'], ['couple', 'Raggiungiamo insieme dei punti'], ['weekly_win', 'Vinco la settimana']].map(([val, label]) => (
                <button key={val} onClick={() => setForm({ ...form, type: val })} style={{ textAlign: 'left', padding: '10px', borderRadius: '10px', border: `1.5px solid ${form.type === val ? t.lavender : t.line}`, background: form.type === val ? (t.style === 'minimal' ? 'transparent' : `${t.lavender}11`) : 'transparent', color: t.text, fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>{label}</button>
              ))}
            </div>
            {(form.type === 'points' || form.type === 'couple') && (
              <input type="number" placeholder="Punti" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '10px', border: `1px solid ${t.line}`, fontSize: '14px', marginBottom: '10px' }} />
            )}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setAdding(false)} style={{ background: t.line, border: 'none', color: t.textSoft, borderRadius: '10px', padding: '10px 14px', fontWeight: 700, cursor: 'pointer' }}>Annulla</button>
              <button onClick={submit} style={{ flex: 1, background: t.mint, border: 'none', color: '#fff', borderRadius: '10px', padding: '10px', fontWeight: 700, cursor: 'pointer' }}>Aggiungi ricompensa</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} style={{ width: '100%', background: 'transparent', border: `2px dashed ${t.line}`, color: t.textSoft, borderRadius: t.radiusSm, padding: '14px', fontWeight: 700, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><Plus size={16} /> Nuova ricompensa</button>
        )}
      </div>
    </div>
  );
}

// ============================================================
// MODALE CITAZIONI SALVATE
// ============================================================
function SavedQuotesModal({ saved, t, onRemove, onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(45,42,74,0.5)', zIndex: 60, display: 'flex', alignItems: 'flex-end' }} onClick={onClose}>
      <div className="pop-card" style={{ background: t.card, width: '100%', borderRadius: '28px 28px 0 0', padding: '24px', paddingBottom: 'calc(24px + env(safe-area-inset-bottom))', maxHeight: '85vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div className="display" style={{ fontSize: '20px', fontWeight: 800, color: t.text, display: 'flex', alignItems: 'center', gap: '8px' }}><Bookmark size={20} color={t.coral} /> Citazioni salvate</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: t.textSoft, cursor: 'pointer' }}><X size={22} /></button>
        </div>
        {saved.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px', color: t.textSoft, fontSize: '14px' }}>Nessuna citazione salvata.<br />Tocca il segnalibro sulla citazione del giorno per salvarla.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {saved.map((q, i) => (
              <div key={i} style={{ background: t.style === 'minimal' ? 'transparent' : `${t.lavender}11`, border: `1px solid ${t.line}`, borderRadius: t.radiusSm, padding: '14px', borderLeft: `4px solid ${t.lavender}`, display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontStyle: 'italic', color: t.text, lineHeight: 1.5 }}>"{q.text}"</div>
                  <div style={{ fontSize: '12px', color: t.textSoft, marginTop: '6px', fontWeight: 700 }}>— {q.author}{q.source ? `, ${q.source}` : ''}</div>
                </div>
                <button onClick={() => onRemove(q)} style={{ background: 'transparent', border: 'none', color: t.coral, cursor: 'pointer', flexShrink: 0 }}><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
