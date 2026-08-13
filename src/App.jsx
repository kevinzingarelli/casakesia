import React, { useState, useEffect, useMemo, useRef, Suspense, lazy } from 'react';
import {
  Home, ListChecks, BarChart3, Settings, Plus, Minus, Flame, Trophy, Sparkles,
  Trash2, Check, Pencil, X, RotateCcw, Crown, Volume2, VolumeX, Moon, Sun, Download,
  Calendar, Heart, Target, AlertTriangle, Palmtree, Share2, LayoutGrid, Clock, Zap,
  Search, Gift, Bell, Repeat, Bookmark, Sparkle as SparkleIcon, Star, Music, Copy,
} from 'lucide-react';
import { supabase, TABLE } from './supabaseClient';
import { AuthScreen, HouseholdSetupScreen, SplashScreen } from './Auth';
import {
  theme, USER_COLORS, CHORE_EMOJIS, CATEGORIES,
  DEFAULT_CHORES, DEFAULT_USERS, LEVELS, ACHIEVEMENTS,
  todayStr, formatDate, formatTime, getLevel, computeStreak,
  pointsForEntry, choreNameForEntry, achievementContext, uid, startOfWeek,
  houseHealth, motivationalMessage, currentSeason,
  houseState, recurringStatus, rewardAchieved, recentChores, groupByDay, computeWeekWins,
  mergeData, sameData, cloneData, parseLocalDate, DEFAULT_GIFTS, giftDayLabel, giftRemaining,
} from './helpers';
import { playCompletionSound, playAchievementSound, playLevelUpSound, vibrate, playPackPreview, SOUND_PACKS, DEFAULT_PACK } from './sounds';
import { quoteOfTheDay } from './quotes';
import { buildDemoData } from './demoData';
import HouseSvg from './HouseSvg';
import GiftsView from './GiftsView';
import StreakView from './StreakView';
import { NewsModal, UpdateBanner, useUnreadNews } from './News';
import { IconTile, Avatar, SectionTitle, hasIcon } from './icons';

// Caricate solo quando servono: Stats porta con sé tutta la libreria dei
// grafici (recharts), che da sola pesa più di metà dell'app. Così il primo
// avvio sul telefono scarica solo ciò che serve alla Home.
const StatsView = lazy(() => import('./StatsView'));
const WidgetScreen = lazy(() => import('./WidgetScreen'));
const ShareCard = lazy(() => import('./ShareCard'));

function LazyFallback({ t }) {
  return <div style={{ padding: '40px', textAlign: 'center', color: t.textSoft, fontSize: '14px' }}>Un attimo…</div>;
}
import {
  registerServiceWorker, currentSubscription, subscribeToPush, unsubscribeFromPush,
  sendPush, pushSupported, pushBlockedReason,
} from './push';

const DEFAULT_DATA = { users: DEFAULT_USERS, chores: DEFAULT_CHORES, log: [], version: 9, coupleGoal: null, vacations: {}, penaltiesOn: false, customCategories: [], categories: [...CATEGORIES], rewards: [], savedQuotes: [], excused: {}, gifts: [...DEFAULT_GIFTS], giftRequests: [], pushSubscriptions: [] };

const LS_IDENTITY = 'casa-points-identity';
const LS_SOUND = 'casa-points-sound';
const LS_DARK = 'casa-points-dark';
const LS_SEASONAL = 'casa-points-seasonal';
const LS_STYLE = 'casa-points-style';
const LS_SOUNDPACK = 'casa-points-soundpack';
const LS_PENDING = 'casa-points-pending';   // modifiche non ancora arrivate sul server
const LS_LAST_KNOWN = 'casa-points-last-known'; // ultima copia confermata dal server, per aprire l'app offline
// Copia di sicurezza che NON può rimpicciolirsi: tiene sempre la versione con
// più storico mai vista su questo telefono. Serve da rete di salvataggio se
// qualcosa impoverisce i dati sul server (è successo il 09/08/2026): quella
// normale qui sopra verrebbe sovrascritta col dato impoverito al primo
// caricamento, questa no.
const LS_BEST = 'casa-points-copia-piu-completa';

const SAVE_DEBOUNCE = 250;   // ms di attesa prima di scrivere su Supabase
const RETRY_MIN = 1000;      // primo tentativo dopo un errore di rete
const RETRY_MAX = 20000;     // attesa massima fra un tentativo e l'altro

function loadLS(key, fallback) {
  try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); } catch { return fallback; }
}
function saveLS(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }

// ?demo=1 nell'URL: mostra dati finti e non tocca mai Supabase. Serve per
// far provare l'app (a un potenziale acquirente, in una landing page...)
// senza esporre i dati reali di Kevin e Asia. Letto una volta sola: la
// query string non cambia durante la vita della pagina.
const isDemo = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('demo') === '1';

function App({ householdId, household, onSignOut }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('home');
  const [pickerChore, setPickerChore] = useState(null);
  const [pickerCount, setPickerCount] = useState(1);
  const [pickerDate, setPickerDate] = useState(todayStr());      // retrodatazione
  const [pickerDedicate, setPickerDedicate] = useState(false);   // dedica
  const [pickerSelections, setPickerSelections] = useState(['parent']); // 'parent' | subtask id
  const [confetti, setConfetti] = useState(null);
  const [dedicationToast, setDedicationToast] = useState(null);
  const [historyFilter, setHistoryFilter] = useState('all');
  const [historyCat, setHistoryCat] = useState('all');
  const [historySearch, setHistorySearch] = useState('');
  const [progressSection, setProgressSection] = useState('storico'); // 'storico' | 'serie' | 'stats' — dentro il tab unico Progressi
  const [newChore, setNewChore] = useState({ name: '', points: 10, emoji: '✨', category: 'Pulizia' });
  const [showAddChore, setShowAddChore] = useState(false);
  const [editingChoreId, setEditingChoreId] = useState(null);
  const [error, setError] = useState(null);
  const [identity, setIdentity] = useState(() => (isDemo ? null : loadLS(LS_IDENTITY, null)));
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
  const [undoToast, setUndoToast] = useState(null); // { ids, label } — lavoro appena segnato, ancora annullabile
  const undoTimerRef = useRef(null);
  const [editingEntry, setEditingEntry] = useState(null); // voce di storico in modifica
  const [recuperabile, setRecuperabile] = useState(null); // { copia, mancanti } — storico sparito dal server ma ancora qui
  const [recuperoInCorso, setRecuperoInCorso] = useState(false);
  const [soundPack, setSoundPack] = useState(() => loadLS(LS_SOUNDPACK, DEFAULT_PACK));
  const [showNews, setShowNews] = useState(false);
  const [unreadNews, refreshUnread] = useUnreadNews();
  const [pushSub, setPushSub] = useState(null);      // iscrizione di QUESTO telefono
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMsg, setPushMsg] = useState(null);
  const dataRef = useRef(null);
  const saveTimer = useRef(null);
  const baseRef = useRef(null);       // ultimo stato confermato dal server
  const rev = useRef(0);              // cresce ad ogni modifica locale
  const savedRev = useRef(0);         // revisione già confermata dal server
  const flushing = useRef(false);
  const retryDelay = useRef(0);
  const loaded = useRef(false);       // true solo dopo una lettura riuscita dal server

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
  useEffect(() => { if (!isDemo) saveLS(LS_IDENTITY, identity); }, [identity]);
  useEffect(() => { saveLS(LS_SEASONAL, seasonal); }, [seasonal]);
  useEffect(() => { saveLS(LS_STYLE, style); }, [style]);
  useEffect(() => { saveLS(LS_SOUNDPACK, soundPack); }, [soundPack]);

  // Registra il service worker (serve solo alle notifiche: non mette nulla
  // in cache) e recupera l'eventuale iscrizione già fatta su questo telefono.
  useEffect(() => {
    if (!pushSupported()) return;
    let alive = true;
    (async () => {
      await registerServiceWorker();
      const sub = await currentSubscription();
      if (alive) setPushSub(sub);
    })();
    return () => { alive = false; };
  }, []);

  const choresById = useMemo(() => {
    const m = {};
    if (data) data.chores.forEach((c) => { m[c.id] = c; });
    return m;
  }, [data]);

  const allCategories = useMemo(() => {
    if (data?.categories && data.categories.length) return data.categories;
    return [...CATEGORIES, ...(data?.customCategories || [])];
  }, [data]);

  // Applica le migrazioni di schema su una copia, senza toccare l'originale
  const migrate = (input) => {
    const value = cloneData(input);
    {
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
        if (value.version < 7) {
          // Converto extras (v6) in subtasks indipendenti
          value.chores = (value.chores || []).map((ch) => {
            if (ch.extras && ch.extras.length) {
              const subtasks = ch.extras.map((ex) => ({
                id: ex.id, name: ex.name, emoji: ch.emoji, points: ex.points,
              }));
              const { extras, ...rest } = ch;
              return { ...rest, subtasks };
            }
            return { ...ch, subtasks: ch.subtasks || [] };
          });
          value.version = 7;
        }
        if (value.version < 8) {
          // Regali: catalogo di partenza + elenco richieste vuoto
          value.gifts = (value.gifts && value.gifts.length) ? value.gifts : cloneData(DEFAULT_GIFTS);
          value.giftRequests = value.giftRequests || [];
          value.version = 8;
        }
        if (value.version < 9) {
          // Telefoni iscritti alle notifiche push
          value.pushSubscriptions = value.pushSubscriptions || [];
          value.version = 9;
        }
    }
    return value;
  };

  // Copia di sicurezza locale delle modifiche non ancora arrivate sul server
  const writePending = () => saveLS(LS_PENDING, { base: baseRef.current, local: dataRef.current });
  const clearPending = () => { try { localStorage.removeItem(LS_PENDING); } catch {} };

  // Invia su Supabase l'ultimo stato conosciuto; se fallisce riprova da sola.
  const flush = async () => {
    if (flushing.current) return;                       // già in corso: si riprogramma da sé
    if (savedRev.current === rev.current) return;       // niente da salvare
    const sendingRev = rev.current;
    let payload = dataRef.current;
    flushing.current = true;
    let ok = false;
    try {
      // Prima di scrivere, si rilegge com'è ADESSO sul server. Se è cambiato
      // rispetto all'ultima volta che l'abbiamo visto, si fondono le due
      // versioni invece di sovrascrivere. Senza questo, una scheda rimasta
      // aperta da prima (magari con una casa ancora vuota) al primo lavoro
      // segnato spazzava via tutto lo storico di entrambi: è successo
      // davvero il 09/08/2026 e ci sono voluti dei backup dai telefoni.
      const { data: row, error: readErr } = await supabase.from(TABLE)
        .select('value').eq('id', householdId).single();
      if (readErr) throw readErr;
      const remote = (row?.value && Object.keys(row.value).length) ? row.value : null;
      if (remote && !sameData(remote, baseRef.current)) {
        payload = mergeData(baseRef.current, dataRef.current, remote);
        dataRef.current = payload;
        setData(payload);
      }

      const { error: err } = await supabase.from(TABLE)
        .update({ value: payload, updated_at: new Date().toISOString() })
        .eq('id', householdId);
      if (err) throw err;
      ok = true;
    } catch (e) {
      console.error('Errore salvataggio', e);
    }
    flushing.current = false;

    if (ok) {
      savedRev.current = Math.max(savedRev.current, sendingRev);
      baseRef.current = payload;
      retryDelay.current = 0;
      setError(null);
      if (rev.current === sendingRev) clearPending();
      else scheduleFlush(SAVE_DEBOUNCE);               // altre modifiche nel frattempo
    } else {
      retryDelay.current = retryDelay.current ? Math.min(retryDelay.current * 2, RETRY_MAX) : RETRY_MIN;
      setError('Modifiche non ancora salvate. Riprovo da solo…');
      scheduleFlush(retryDelay.current);
    }
  };

  // Rimette lo storico sparito, unendo la copia locale più completa a quello
  // che c'è adesso sul server (così non si perde neanche ciò che è stato
  // segnato nel frattempo). Non sovrascrive mai a scatola chiusa.
  const recuperaStorico = () => {
    if (!recuperabile?.copia || !dataRef.current) return;
    setRecuperoInCorso(true);
    const copia = recuperabile.copia;
    const attuale = dataRef.current;
    const unisci = (a, b) => {
      const base = Array.isArray(a) ? a : [];
      const extra = Array.isArray(b) ? b : [];
      const visti = new Set(base.map((x) => x && x.id).filter(Boolean));
      return base.concat(extra.filter((x) => x && x.id && !visti.has(x.id)));
    };
    const unito = {
      ...copia,
      log: unisci(copia.log, attuale.log).sort((x, y) => String(y.timestamp).localeCompare(String(x.timestamp))),
      chores: unisci(copia.chores, attuale.chores),
      gifts: unisci(copia.gifts, attuale.gifts),
      giftRequests: unisci(copia.giftRequests, attuale.giftRequests),
      rewards: unisci(copia.rewards, attuale.rewards),
      pushSubscriptions: unisci(copia.pushSubscriptions, attuale.pushSubscriptions),
    };
    // Salvagente: se per qualsiasi motivo l'unione perdesse voci, non si scrive
    if (unito.log.length < (copia.log || []).length || unito.log.length < (attuale.log || []).length) {
      setRecuperoInCorso(false);
      setError('Recupero annullato per sicurezza: il risultato aveva meno lavori di quelli attuali.');
      return;
    }
    saveLS(LS_BEST, unito);
    save(unito);
    setRecuperabile(null);
    setRecuperoInCorso(false);
  };

  const scheduleFlush = (delay) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { saveTimer.current = null; flush(); }, delay);
  };

  const save = (next) => {
    // Demo: si comporta come se avesse salvato, ma resta solo in memoria —
    // niente Supabase, niente localStorage, per non confondersi con una
    // sessione vera sullo stesso telefono.
    if (isDemo) { dataRef.current = next; setData(next); return; }
    // Senza una lettura riuscita non sappiamo cosa c'è sul server: scrivere ora
    // significherebbe sovrascrivere i dati veri con quelli di default.
    if (!loaded.current) {
      setError('Non sei collegato al database condiviso: la modifica non è stata salvata. Ricarica l\'app.');
      return;
    }
    dataRef.current = next;
    setData(next);
    rev.current += 1;
    writePending();
    scheduleFlush(SAVE_DEBOUNCE);
  };

  useEffect(() => {
    if (isDemo) {
      // Mai una richiesta a Supabase in modalità demo: dati finti, subito.
      const demo = buildDemoData();
      baseRef.current = cloneData(demo);
      dataRef.current = demo;
      loaded.current = true;
      setData(demo);
      setLoading(false);
      return;
    }
    let channel;
    const load = async () => {
      try {
        const { data: row, error: err } = await supabase.from(TABLE).select('value').eq('id', householdId).single();
        if (err) throw err;
        const raw = (!row?.value || Object.keys(row.value).length === 0) ? DEFAULT_DATA : row.value;
        const server = cloneData(raw);
        let value = migrate(raw);
        // Le migrazioni vanno riscritte sul server, non solo tenute in memoria
        let dirty = !sameData(server, value);

        // Modifiche rimaste in sospeso da una sessione precedente (app chiusa o rete assente)
        const pending = loadLS(LS_PENDING, null);
        if (pending && pending.base && pending.local) {
          const merged = mergeData(pending.base, pending.local, value);
          if (!sameData(merged, value)) { value = merged; dirty = true; }
        }

        baseRef.current = server;
        dataRef.current = value;
        loaded.current = true;
        setData(value);
        // ATTENZIONE all'ordine: la copia precedente va letta PRIMA di
        // sovrascriverla, altrimenti si perde proprio quella che servirebbe
        // a recuperare. Vale anche come ripiego per i telefoni che non hanno
        // ancora la copia "più completa" (introdotta solo il 09/08/2026).
        const copiaPrecedente = loadLS(LS_LAST_KNOWN, null);
        const sospesiSalvati = loadLS(LS_PENDING, null);
        saveLS(LS_LAST_KNOWN, server); // per poter aprire l'app anche offline, la prossima volta
        // Copia "più completa": si aggiorna solo se il server ha almeno
        // altrettanto storico, così un dato impoverito non la cancella.
        // Si guarda in TUTTI i posti dove può essere rimasto uno stato
        // completo e si tiene quello con più storico: la copia dedicata, la
        // copia dell'ultimo caricamento, e le due metà delle modifiche
        // rimaste in sospeso. Ogni posto è una possibilità in più di
        // recuperare, e nessuno di questi viene mai rimpicciolito.
        {
          const candidati = [
            loadLS(LS_BEST, null),
            copiaPrecedente,
            sospesiSalvati?.local,
            sospesiSalvati?.base,
          ].filter((c) => c && Array.isArray(c.log) && Array.isArray(c.users));
          const best = candidati.sort((a, b) => b.log.length - a.log.length)[0] || null;
          const quanteOra = (server?.log || []).length;
          const quanteInCopia = (best?.log || []).length;
          if (!best || quanteOra >= quanteInCopia) saveLS(LS_BEST, server);
          else { saveLS(LS_BEST, best); setRecuperabile({ copia: best, mancanti: quanteInCopia - quanteOra }); }
        }
        if (dirty) { rev.current += 1; writePending(); scheduleFlush(SAVE_DEBOUNCE); }
        else clearPending();
      } catch (e) {
        console.error(e);
        // Rete assente o Supabase irraggiungibile: se abbiamo già visto i
        // dati veri in passato, apriamo l'app con quelli invece di uno
        // stato vuoto. Le modifiche fatte da offline si mettono comunque in
        // coda (stesso meccanismo del salvataggio normale) e partono da
        // sole appena torna la rete.
        const lastKnown = loadLS(LS_LAST_KNOWN, null);
        if (lastKnown) {
          let value = cloneData(lastKnown);
          const pending = loadLS(LS_PENDING, null);
          if (pending && pending.base && pending.local) {
            value = mergeData(pending.base, pending.local, value);
          }
          baseRef.current = cloneData(lastKnown);
          dataRef.current = value;
          loaded.current = true;
          setData(value);
          setError('Sei offline: stai vedendo l\'ultimo salvataggio. Le modifiche partiranno da sole appena torna la rete.');
        } else {
          setError('Impossibile collegarsi al database condiviso.');
          dataRef.current = cloneData(DEFAULT_DATA);
          setData(dataRef.current);
        }
      } finally { setLoading(false); }
    };
    load();

    channel = supabase.channel('household_data_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE, filter: `id=eq.${householdId}` }, (payload) => {
        const incoming = payload.new?.value;
        if (!incoming || !dataRef.current) return;
        if (sameData(incoming, dataRef.current)) {      // è l'eco del nostro stesso salvataggio
          baseRef.current = incoming;
          return;
        }
        if (rev.current === savedRev.current) {         // nessuna modifica locale in attesa
          baseRef.current = incoming;
          dataRef.current = incoming;
          setData(incoming);
          return;
        }
        // Ci sono modifiche locali non ancora salvate: si fondono invece di perderle
        const merged = mergeData(baseRef.current, dataRef.current, incoming);
        baseRef.current = incoming;
        dataRef.current = merged;
        setData(merged);
        rev.current += 1;
        writePending();
        scheduleFlush(SAVE_DEBOUNCE);
      }).subscribe();

    // Se l'app viene chiusa o mandata in background, si salva subito senza aspettare il debounce
    const flushNow = () => {
      if (rev.current === savedRev.current) return;
      if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
      flush();
    };
    const onVisibility = () => { if (document.visibilityState === 'hidden') flushNow(); };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flushNow);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flushNow);
      if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

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

  const weekPoints = useMemo(() => {
    const wk = {};
    if (!data) return wk;
    const ws = startOfWeek();
    data.users.forEach((u) => { wk[u.id] = 0; });
    data.log.forEach((e) => { if (new Date(e.timestamp) >= ws) wk[e.userId] = (wk[e.userId] || 0) + pointsForEntry(e, choresById); });
    return wk;
  }, [data, choresById]);

  const me = useMemo(() => {
    if (!data || !identity) return null;
    return data.users.find((u) => u.id === identity) || null;
  }, [data, identity]);

  const otherUser = me && data ? data.users.find((u) => u.id !== me.id) : null;

  // Registra una o più selezioni (task genitore + sotto-task indipendenti)
  // selections: array di 'parent' | subtask.id
  const logSelection = (chore, selections, user, count = 1, dateStr = todayStr(), dedicate = false) => {
    if (!selections || selections.length === 0) return;
    const isToday = dateStr === todayStr();
    const baseTime = isToday ? new Date() : new Date(`${dateStr}T12:00:00`);
    const hasSubtasks = (chore.subtasks || []).length > 0;
    const entries = [];
    let idx = 0;

    selections.forEach((sel) => {
      const isParent = sel === 'parent';
      const sub = isParent ? null : (chore.subtasks || []).find((s) => s.id === sel);
      if (!isParent && !sub) return;

      const pts = isParent ? chore.points : sub.points;
      const name = isParent ? chore.name : sub.name;
      const emoji = isParent ? chore.emoji : (sub.emoji || chore.emoji);
      // count si applica solo al task genitore; i sotto-task sono sempre 1x per sessione
      const qty = (isParent && !hasSubtasks) ? count : 1;

      for (let i = 0; i < qty; i++) {
        const ts = new Date(baseTime.getTime() + idx * 1000);
        entries.push({
          id: uid(), userId: user.id, choreId: chore.id,
          subtaskId: isParent ? null : sel,
          snapshotPoints: pts, snapshotName: name, snapshotEmoji: emoji, snapshotCategory: chore.category,
          timestamp: ts.toISOString(), date: dateStr,
          dedicatedTo: dedicate && otherUser ? otherUser.id : null,
        });
        idx++;
      }
    });

    if (entries.length === 0) return;
    const next = { ...dataRef.current, log: [...entries, ...dataRef.current.log] };

    const otherId = dataRef.current.users.find((x) => x.id !== user.id)?.id;
    const prevCtx = achievementContext(dataRef.current.log, choresById, user.id, otherId, dataRef.current.excused || {});
    const prevLevel = getLevel(totals[user.id] || 0);
    const newCtx = achievementContext(next.log, choresById, user.id, otherId, dataRef.current.excused || {});
    const newTotal = next.log.filter((e) => e.userId === user.id).reduce((s, e) => s + pointsForEntry(e, choresById), 0);
    const newLevel = getLevel(newTotal);
    const prevUnlocked = ACHIEVEMENTS.filter((a) => a.check(prevCtx)).map((a) => a.id);
    const justUnlocked = ACHIEVEMENTS.find((a) => a.check(newCtx) && !prevUnlocked.includes(a.id));
    const leveledUp = newLevel.title !== prevLevel.title;

    save(next);
    setPickerChore(null); setPickerSelections(['parent']); setPickerCount(1); setPickerDate(todayStr()); setPickerDedicate(false);

    const totalPts = entries.reduce((s, e) => s + e.snapshotPoints, 0);
    const vibPat = entries.length > 1 ? [10, 30, 10, 30, 10] : 15;
    vibrate(vibPat);
    if (leveledUp) playLevelUpSound(soundOn, soundPack);
    else if (justUnlocked) playAchievementSound(soundOn, soundPack);
    else playCompletionSound(totalPts, soundOn, soundPack);

    setConfetti({ user, chore, count: entries.length, points: totalPts, achievement: justUnlocked, levelUp: leveledUp ? newLevel : null, dedicated: dedicate && otherUser ? otherUser : null, retro: !isToday ? dateStr : null });
    setTimeout(() => setConfetti(null), (justUnlocked || leveledUp) ? 2800 : 2000);

    // Qualche secondo per rimediare a un tocco sbagliato, senza dover
    // andare nello Storico a cancellare a mano.
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoToast({ ids: entries.map((e) => e.id), label: entries.length > 1 ? `${entries.length} lavori segnati` : chore.name });
    undoTimerRef.current = setTimeout(() => setUndoToast(null), 6000);

    // Notifica all'altra persona solo per i momenti che contano: traguardo
    // sbloccato o cambio livello. Non per ogni singolo lavoro, altrimenti
    // diventa fastidiosa (scelta confermata da Kevin il 02/08/2026).
    if (otherId && (leveledUp || justUnlocked)) {
      if (leveledUp) {
        notify(otherId, `${newLevel.emoji} ${user.name} è salito di livello!`, `Ora è "${newLevel.title}"`);
      } else if (justUnlocked) {
        notify(otherId, `${justUnlocked.emoji} ${user.name} ha sbloccato un traguardo!`, justUnlocked.title);
      }
    }
  };

  const removeEntry = (id) => {
    setRemovingIds((ids) => [...ids, id]);
    vibrate(10);
    setTimeout(() => {
      save({ ...dataRef.current, log: dataRef.current.log.filter((e) => e.id !== id) });
      setRemovingIds((ids) => ids.filter((x) => x !== id));
    }, 280);
  };

  // Toglie SOLO le voci appena aggiunte (per id), non l'intero stato: al
  // sicuro anche se nel frattempo è arrivata una sincronizzazione dall'altro
  // telefono, che non verrebbe toccata.
  const undoLog = (ids) => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoToast(null);
    save({ ...dataRef.current, log: dataRef.current.log.filter((e) => !ids.includes(e.id)) });
    vibrate(10);
  };

  // Correzione di una voce di storico già registrata (punti e data)
  const updateEntry = (id, patch) => {
    save({
      ...dataRef.current,
      log: dataRef.current.log.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    });
  };
  const updateUser = (id, patch) => save({ ...dataRef.current, users: dataRef.current.users.map((u) => (u.id === id ? { ...u, ...patch } : u)) });

  const addChore = () => {
    if (!newChore.name.trim()) return;
    const chore = { id: `custom-${uid()}`, ...newChore, points: Math.max(1, Number(newChore.points) || 1) };
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

  // ---- Notifiche push ----
  // L'iscrizione di ogni telefono finisce nel documento condiviso, così
  // l'altra persona (cioè il server, per suo conto) sa dove spedire.
  const enablePush = async () => {
    if (!me) { setPushMsg('Scegli prima chi sei, in cima alla schermata.'); return; }
    setPushBusy(true); setPushMsg(null);
    const res = await subscribeToPush();
    setPushBusy(false);
    if (!res.ok) {
      const msgs = {
        'negato': 'Le notifiche sono bloccate nelle impostazioni del telefono. Vai in Impostazioni → Casa Points → Notifiche per riattivarle.',
        'non-supportato': 'Questo telefono non supporta le notifiche.',
        'no-sw': 'Non riesco ad avviare il servizio delle notifiche.',
      };
      setPushMsg(msgs[res.reason] || 'Non sono riuscito ad attivarle. Riprova.');
      return;
    }
    const sub = res.subscription;
    const others = (dataRef.current.pushSubscriptions || []).filter((s) => s.endpoint !== sub.endpoint);
    save({
      ...dataRef.current,
      pushSubscriptions: [...others, {
        endpoint: sub.endpoint,
        keys: sub.keys,
        userId: me.id,
        createdAt: new Date().toISOString(),
      }],
    });
    setPushSub(sub);
    setPushMsg('Fatto! Riceverai una notifica quando ti chiedono un regalo.');
  };

  const disablePush = async () => {
    setPushBusy(true); setPushMsg(null);
    const removed = await unsubscribeFromPush();
    const endpoint = (removed && removed.endpoint) || (pushSub && pushSub.endpoint);
    if (endpoint) {
      save({
        ...dataRef.current,
        pushSubscriptions: (dataRef.current.pushSubscriptions || []).filter((s) => s.endpoint !== endpoint),
      });
    }
    setPushSub(null);
    setPushBusy(false);
    setPushMsg('Notifiche disattivate su questo telefono.');
  };

  // Spedisce e, se il server segnala iscrizioni ormai morte, le ripulisce
  const notify = async (toUserId, title, message) => {
    if (isDemo) return; // niente chiamate di rete finte in demo
    const res = await sendPush({ householdId, toUserId, title, message, url: '/', tag: 'regali' });
    if (res && res.failed && res.failed.length) {
      const dead = new Set(res.failed);
      save({
        ...dataRef.current,
        pushSubscriptions: (dataRef.current.pushSubscriptions || []).filter((s) => !dead.has(s.endpoint)),
      });
    }
  };

  // Regali: catalogo condiviso + richieste da una persona all'altra
  const addGift = (gift) => {
    const name = (gift.name || '').trim();
    if (!name) return;
    const existing = dataRef.current.gifts || [];
    if (existing.some((g) => g.name.toLowerCase() === name.toLowerCase())) return;
    const limit = Number(gift.monthlyLimit) || 0;
    save({ ...dataRef.current, gifts: [...existing, { id: `gift-${uid()}`, name, emoji: gift.emoji || '🎁', monthlyLimit: limit > 0 ? limit : null }] });
  };
  const editGift = (id, patch) => {
    const name = (patch.name || '').trim();
    if (!name) return;
    const limit = Number(patch.monthlyLimit) || 0;
    save({
      ...dataRef.current,
      gifts: (dataRef.current.gifts || []).map((g) => (g.id === id
        ? { ...g, name, emoji: patch.emoji || g.emoji, monthlyLimit: limit > 0 ? limit : null }
        : g)),
    });
  };
  const removeGift = (id) => save({ ...dataRef.current, gifts: (dataRef.current.gifts || []).filter((g) => g.id !== id) });

  const requestGift = (gift, date, note) => {
    if (!me || !otherUser) return;
    // Difesa in profondità: l'interfaccia disabilita già il pulsante quando
    // il buono mensile è esaurito, ma ricontrolliamo qui prima di salvare.
    if (giftRemaining(gift, me.id, dataRef.current.giftRequests || [], date) === 0) return;
    const req = {
      id: `greq-${uid()}`,
      giftId: gift.id,
      snapshotName: gift.name,
      snapshotEmoji: gift.emoji,
      fromUserId: me.id,
      toUserId: otherUser.id,
      date,
      note: note || '',
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    save({ ...dataRef.current, giftRequests: [req, ...(dataRef.current.giftRequests || [])] });
    vibrate(15);
    playCompletionSound(8, soundOn, soundPack);
    notify(otherUser.id, `${gift.emoji} ${me.name} ti ha chiesto un regalo`,
      `${gift.name} · per ${giftDayLabel(date)}${note ? ` — «${note}»` : ''}`);
  };

  const respondGift = (id, accept, replyNote) => {
    const req = (dataRef.current.giftRequests || []).find((r) => r.id === id);
    save({
      ...dataRef.current,
      giftRequests: (dataRef.current.giftRequests || []).map((r) => (r.id === id
        ? { ...r, status: accept ? 'accepted' : 'declined', replyNote: replyNote || '', respondedAt: new Date().toISOString() }
        : r)),
    });
    vibrate(accept ? [10, 30, 10] : 10);
    if (accept) playAchievementSound(soundOn, soundPack);
    if (req && me) {
      notify(req.fromUserId,
        accept ? `💚 ${me.name} ha detto sì!` : `🙈 ${me.name} non può`,
        accept
          ? `${req.snapshotName} · per ${giftDayLabel(req.date)}`
          : `${req.snapshotName}${replyNote ? ` — «${replyNote}»` : ''}`);
    }
  };

  const giftDone = (id) => {
    const req = (dataRef.current.giftRequests || []).find((r) => r.id === id);
    save({
      ...dataRef.current,
      giftRequests: (dataRef.current.giftRequests || []).map((r) => (r.id === id
        ? { ...r, status: 'done', doneAt: new Date().toISOString() }
        : r)),
    });
    vibrate([10, 30, 10, 30, 10]);
    playLevelUpSound(soundOn, soundPack);
    if (req && me) notify(req.fromUserId, `🎉 Regalo consegnato!`, `${req.snapshotEmoji} ${req.snapshotName}`);
  };

  const deleteGiftRequest = (id) => save({ ...dataRef.current, giftRequests: (dataRef.current.giftRequests || []).filter((r) => r.id !== id) });

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
    setPickerCount(1); setPickerDate(todayStr()); setPickerDedicate(false);
    // Se il task ha sotto-task, default: solo il genitore selezionato
    // Se non ha sotto-task, selezione implicita del genitore
    setPickerSelections(['parent']);
    setPickerChore(chore);
  };

  // Tocco diretto su una sotto-task dalla lista: apre la conferma con SOLO
  // quella selezionata, senza il lavoro principale.
  const handleSubtaskClick = (chore, sub) => {
    setPickerCount(1); setPickerDate(todayStr()); setPickerDedicate(false);
    setPickerSelections([sub.id]);
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
    const sorted = [...data.users].sort((a, b) => (weekPoints[b.id] || 0) - (weekPoints[a.id] || 0));
    return (weekPoints[sorted[0].id] || 0) > (weekPoints[sorted[1]?.id] || 0) ? sorted[0].id : null;
  })();
  const rewardCtx = me ? {
    myId: me.id,
    myTotal: totals[me.id] || 0,
    otherTotal: otherUser ? totals[otherUser.id] || 0 : 0,
    coupleTotal: Object.values(totals).reduce((a, b) => a + b, 0),
    weeklyWinnerId,
    myWeekPoints: weekPoints[me.id] || 0,
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
        @keyframes hero-pop { 0% { transform: scale(0.4) translateY(24px); opacity: 0; } 65% { transform: scale(1.06) translateY(-4px); opacity: 1; } 100% { transform: scale(1) translateY(0); opacity: 1; } }
        @keyframes sheet-rise { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes backdrop-blur-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes subtask-check { 0% { transform: scale(0.7); } 60% { transform: scale(1.15); } 100% { transform: scale(1); } }
        .hero-emoji { animation: hero-pop 0.42s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
        .picker-sheet { animation: sheet-rise 0.36s cubic-bezier(0.32, 0.72, 0, 1) forwards; }
        .picker-backdrop { animation: backdrop-blur-in 0.25s ease forwards; }
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
      {showShare && (
        <Suspense fallback={null}>
          <ShareCard data={data} choresById={choresById} totals={totals} streaks={streaks} t={t} season={season} onClose={() => setShowShare(false)} />
        </Suspense>
      )}

      {/* Confetti / toast */}
      {confetti && (
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'relative', textAlign: 'center' }}>
            {(confetti.dedicated ? ['❤️', '💕', '💖', '💗', '💝'] : ['🎉', '✨', '⭐', '🎊', '💥', '🌟']).map((e, i) => (
              <span key={i} className="confetti-piece" style={{ left: `${(i - 2.5) * 26}px`, animationDelay: `${i * 0.05}s` }}>{e}</span>
            ))}
            <div className="pop-card display" style={{ background: t.card, borderRadius: '24px', padding: '20px 28px', boxShadow: '0 12px 30px rgba(45,42,74,0.25)', border: `3px solid ${confetti.user.color}` }}>
              <div style={{ display: 'flex', justifyContent: 'center' }}><IconTile emoji={confetti.chore.emoji} size={56} /></div>
              <div style={{ fontSize: '20px', fontWeight: 700, marginTop: '8px', color: t.text }}>+{confetti.points} punti!{confetti.count > 1 ? ` (×${confetti.count})` : ''}</div>
              <div style={{ fontSize: '14px', color: t.textSoft, marginTop: '2px' }}>{confetti.user.name}</div>
              {confetti.retro && <div style={{ fontSize: '12px', color: t.textSoft, marginTop: '4px' }}>Retrodatato al {parseLocalDate(confetti.retro).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}</div>}
              {confetti.dedicated && <div style={{ fontSize: '13px', color: confetti.user.color, marginTop: '6px', fontWeight: 700 }}>Dedicato a {confetti.dedicated.name} ❤</div>}
              {confetti.levelUp && (
                <div className="pop-card achievement-toast" style={{ marginTop: '12px', background: confetti.user.color, borderRadius: '14px', padding: '10px 16px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>LIVELLO RAGGIUNTO</div>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#fff' }}>{confetti.levelUp.title}</div>
                </div>
              )}
              {confetti.achievement && !confetti.levelUp && (
                <div className="pop-card achievement-toast" style={{ marginTop: '12px', background: t.sunny, borderRadius: '14px', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Trophy size={22} color="#946800" />
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
      {pickerChore && (() => {
        const subtasks = pickerChore.subtasks || [];
        const hasSubtasks = subtasks.length > 0;
        const totalPts = (() => {
          let pts = 0;
          pickerSelections.forEach(sel => {
            if (sel === 'parent') pts += pickerChore.points * (hasSubtasks ? 1 : pickerCount);
            else {
              const sub = subtasks.find(s => s.id === sel);
              if (sub) pts += sub.points;
            }
          });
          return pts;
        })();
        const allIds = ['parent', ...subtasks.map(s => s.id)];
        const allSelected = allIds.every(id => pickerSelections.includes(id));
        return (
          <div className="picker-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(10,8,30,0.6)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', zIndex: 40, display: 'flex', alignItems: 'flex-end' }} onClick={() => setPickerChore(null)}>
            <div className="picker-sheet" style={{ background: t.card, width: '100%', borderRadius: '32px 32px 0 0', padding: '0 0 calc(20px + env(safe-area-inset-bottom)) 0', boxShadow: '0 -12px 40px rgba(0,0,0,0.3)', maxHeight: '92vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>

              {/* Hero section */}
              <div style={{ background: `linear-gradient(160deg, ${t.coral}22, ${t.lavender}22)`, borderRadius: '32px 32px 0 0', padding: '28px 24px 20px', textAlign: 'center', position: 'relative' }}>
                <button onClick={() => setPickerChore(null)} style={{ position: 'absolute', top: '16px', right: '16px', background: t.line, border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: t.textSoft }}><X size={16} /></button>
                <div className="hero-emoji" style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}><IconTile emoji={pickerChore.emoji} size={72} /></div>
                <div className="display" style={{ fontSize: '24px', fontWeight: 700, color: t.text, marginBottom: '4px' }}>{pickerChore.name}</div>
                <div style={{ fontSize: '15px', color: t.textSoft }}>
                  {pickerSelections.length === 0 ? 'Nessuna selezione' : <span style={{ color: t.coral, fontWeight: 800 }}>+{totalPts} punti</span>}
                  {!hasSubtasks && pickerCount > 1 && <span style={{ color: t.textSoft }}> ({pickerChore.points} × {pickerCount})</span>}
                </div>
              </div>

              <div style={{ padding: '20px 24px 0' }}>

                {/* Sotto-task selezionabili */}
                {hasSubtasks && (
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: t.textSoft }}>Cosa hai fatto?</div>
                      <button onClick={() => setPickerSelections(allSelected ? [] : allIds)} style={{ background: 'transparent', border: 'none', fontSize: '12px', fontWeight: 800, color: t.lavender, cursor: 'pointer' }}>{allSelected ? 'Deseleziona tutto' : 'Tutto fatto'}</button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {/* Genitore */}
                      {(() => {
                        const on = pickerSelections.includes('parent');
                        return (
                          <button onClick={() => setPickerSelections(prev => on ? prev.filter(x => x !== 'parent') : [...prev, 'parent'])} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', borderRadius: t.radiusSm, border: `2px solid ${on ? t.coral : t.line}`, background: on ? (dark ? 'rgba(255,107,107,0.12)' : '#FFF0EE') : 'transparent', cursor: 'pointer', textAlign: 'left', minHeight: '52px', transition: 'all 0.15s' }}>
                            <div style={{ width: '26px', height: '26px', borderRadius: '8px', border: `2px solid ${on ? t.coral : t.line}`, background: on ? t.coral : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>{on && <Check size={16} color="#fff" />}</div>
                            <IconTile emoji={pickerChore.emoji} size={32} />
                            <span style={{ flex: 1, fontSize: '15px', fontWeight: 800, color: t.text }}>{pickerChore.name}</span>
                            <span style={{ fontSize: '15px', fontWeight: 800, color: t.coral }}>+{pickerChore.points}</span>
                          </button>
                        );
                      })()}
                      {/* Sotto-task */}
                      {subtasks.map((sub) => {
                        const on = pickerSelections.includes(sub.id);
                        return (
                          <button key={sub.id} onClick={() => { vibrate(8); setPickerSelections(prev => on ? prev.filter(x => x !== sub.id) : [...prev, sub.id]); }} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', borderRadius: t.radiusSm, border: `2px solid ${on ? t.lavender : t.line}`, background: on ? (dark ? 'rgba(167,139,250,0.12)' : '#F0ECFF') : 'transparent', cursor: 'pointer', textAlign: 'left', minHeight: '52px', transition: 'all 0.15s' }}>
                            <div style={{ width: '26px', height: '26px', borderRadius: '8px', border: `2px solid ${on ? t.lavender : t.line}`, background: on ? t.lavender : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>{on && <Check size={16} color="#fff" />}</div>
                            <IconTile emoji={sub.emoji || pickerChore.emoji} size={32} />
                            <span style={{ flex: 1, fontSize: '15px', fontWeight: 700, color: t.text }}>{sub.name}</span>
                            <span style={{ fontSize: '15px', fontWeight: 800, color: t.lavender }}>+{sub.points}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Quantità (solo se non ci sono sotto-task) */}
                {!hasSubtasks && (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '24px', marginBottom: '6px' }}>
                      <button onClick={() => setPickerCount((c) => Math.max(1, c - 1))} style={{ width: '52px', height: '52px', borderRadius: '50%', border: `2px solid ${t.line}`, background: t.card, color: t.text, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Minus size={24} /></button>
                      <div className="display" style={{ fontSize: '36px', fontWeight: 800, minWidth: '50px', textAlign: 'center', color: t.text }}>{pickerCount}</div>
                      <button onClick={() => setPickerCount((c) => Math.min(20, c + 1))} style={{ width: '52px', height: '52px', borderRadius: '50%', border: `2px solid ${t.line}`, background: t.card, color: t.text, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={24} /></button>
                    </div>
                    <div style={{ fontSize: '12px', color: t.textSoft, textAlign: 'center', marginBottom: '16px' }}>Quante volte?</div>
                  </>
                )}

                {/* Retrodatazione */}
                <div style={{ background: dark ? 'rgba(255,255,255,0.05)' : '#FFF7ED', borderRadius: t.radiusSm, padding: '12px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontSize: '13px', fontWeight: 700, color: t.text }}><Calendar size={16} /> Quando l'hai fatto?</div>
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
                  <button onClick={() => setPickerDedicate((d) => !d)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', borderRadius: t.radiusSm, border: `2px solid ${pickerDedicate ? t.coral : t.line}`, background: pickerDedicate ? (dark ? 'rgba(255,107,107,0.15)' : '#FFF0EE') : t.card, color: pickerDedicate ? t.coral : t.textSoft, fontWeight: 700, fontSize: '13px', cursor: 'pointer', marginBottom: '14px' }}>
                    <Heart size={16} fill={pickerDedicate ? t.coral : 'none'} /> {pickerDedicate ? `Dedicato a ${otherUser.name}` : `Dedica a ${otherUser.name}`}
                  </button>
                )}

                {/* Chi ha fatto */}
                {me ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <button onClick={() => logSelection(pickerChore, pickerSelections, me, pickerCount, pickerDate, pickerDedicate)} disabled={pickerSelections.length === 0} style={{ background: pickerSelections.length === 0 ? t.line : me.color, border: 'none', borderRadius: '20px', padding: '18px', color: '#fff', fontFamily: t.fontDisplay, fontWeight: 700, fontSize: '18px', cursor: pickerSelections.length === 0 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: pickerSelections.length === 0 ? 0.5 : 1 }}>
                      <Check size={22} strokeWidth={3} /> L'ho fatto io
                    </button>
                    {otherUser && (
                      <button onClick={() => logSelection(pickerChore, pickerSelections, otherUser, pickerCount, pickerDate, false)} disabled={pickerSelections.length === 0} style={{ background: 'transparent', border: `2px solid ${otherUser.color}`, borderRadius: '20px', padding: '14px', color: otherUser.color, fontFamily: t.fontDisplay, fontWeight: 700, fontSize: '15px', cursor: pickerSelections.length === 0 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: pickerSelections.length === 0 ? 0.5 : 1 }}>
                        <Avatar user={otherUser} size={24} /> L'ha fatto {otherUser.name}
                      </button>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '12px' }}>
                    {data.users.map((u) => (
                      <button key={u.id} onClick={() => logSelection(pickerChore, pickerSelections, u, pickerCount, pickerDate, false)} disabled={pickerSelections.length === 0} style={{ flex: 1, background: pickerSelections.length === 0 ? t.line : u.color, border: 'none', borderRadius: '20px', padding: '18px 8px', color: '#fff', fontFamily: t.fontDisplay, fontWeight: 700, fontSize: '16px', cursor: pickerSelections.length === 0 ? 'default' : 'pointer', opacity: pickerSelections.length === 0 ? 0.5 : 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '6px' }}><span style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.28)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 800 }}>{u.name.charAt(0).toUpperCase()}</span></div>{u.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}


            {/* Header */}
      <div style={{ padding: 'calc(20px + env(safe-area-inset-top)) 18px 12px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="display" style={{ fontSize: '26px', fontWeight: 800, margin: 0, color: t.text, letterSpacing: '-0.02em' }}>Casa Points</h1>
          <p style={{ margin: '2px 0 0', color: t.textSoft, fontSize: '13px' }}>{me ? `Ciao ${me.name}!` : 'Dividetevi i lavori, raccogliete punti'}</p>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={() => setShowNews(true)} className="nav-btn" style={{ position: 'relative', background: t.card, border: 'none', borderRadius: '12px', width: '42px', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.textSoft, cursor: 'pointer', boxShadow: cardShadow }}>
            <Bell size={18} />
            {unreadNews > 0 && <span style={{ position: 'absolute', top: '7px', right: '7px', width: '9px', height: '9px', borderRadius: '50%', background: t.coral, border: `2px solid ${t.card}` }} />}
          </button>
          <button onClick={() => setShowShare(true)} className="nav-btn" style={{ background: t.card, border: 'none', borderRadius: '12px', width: '42px', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.textSoft, cursor: 'pointer', boxShadow: cardShadow }}><Share2 size={18} /></button>
          <button onClick={() => setSoundOn((s) => !s)} className="nav-btn" style={{ background: t.card, border: 'none', borderRadius: '12px', width: '42px', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.textSoft, cursor: 'pointer', boxShadow: cardShadow }}>{soundOn ? <Volume2 size={18} /> : <VolumeX size={18} />}</button>
          <button onClick={() => setDark((d) => !d)} className="nav-btn" style={{ background: t.card, border: 'none', borderRadius: '12px', width: '42px', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.textSoft, cursor: 'pointer', boxShadow: cardShadow }}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
        </div>
      </div>

      {/* Modalità demo: sempre visibile, per non confonderla mai con dati veri */}
      {isDemo && (
        <div style={{ margin: '0 18px 12px', background: '#2D2A4A', color: '#fff', borderRadius: '14px', padding: '10px 14px', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          <span>Modalità demo — dati finti, niente viene salvato</span>
          <a href="/" style={{ color: '#fff', textDecoration: 'underline', flexShrink: 0 }}>Esci</a>
        </div>
      )}

      {/* Storico sparito dal server ma ancora presente su questo telefono */}
      {recuperabile && (
        <div className="slide-up" style={{ margin: '0 18px 12px', background: '#FFF3CD', border: '2px solid #FFC107', borderRadius: '16px', padding: '14px' }}>
          <div style={{ fontSize: '14px', fontWeight: 800, color: '#7A5B00', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '7px' }}>
            <AlertTriangle size={17} /> Mancano {recuperabile.mancanti} lavori
          </div>
          <div style={{ fontSize: '12.5px', color: '#7A5B00', marginBottom: '10px', lineHeight: 1.45 }}>
            Su questo telefono c'è ancora una copia completa. Posso rimetterli a posto, tenendo anche quelli segnati nel frattempo.
          </div>
          <button
            onClick={recuperaStorico}
            disabled={recuperoInCorso}
            style={{ width: '100%', background: recuperoInCorso ? '#bbb' : '#FFC107', border: 'none', borderRadius: '12px', padding: '12px', fontSize: '14px', fontWeight: 800, color: '#4A3800', cursor: recuperoInCorso ? 'default' : 'pointer' }}
          >
            {recuperoInCorso ? 'Ripristino…' : `Rimetti a posto i ${recuperabile.mancanti} lavori`}
          </button>
          <button
            onClick={() => setRecuperabile(null)}
            style={{ width: '100%', marginTop: '6px', background: 'transparent', border: 'none', color: '#7A5B00', fontSize: '12px', cursor: 'pointer' }}
          >
            No, va bene così
          </button>
        </div>
      )}

      {/* Banner identità */}
      {!me && (
        <div className="slide-up" style={{ margin: '0 18px 12px', background: t.card, borderRadius: '16px', padding: '14px', boxShadow: cardShadow }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: t.text, marginBottom: '8px' }}>Chi sei? (così segni più velocemente)</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {data.users.map((u) => (
              <button key={u.id} onClick={() => setIdentity(u.id)} style={{ flex: 1, background: u.color, border: 'none', borderRadius: '14px', padding: '11px', color: '#fff', fontWeight: 700, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <span style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(255,255,255,0.28)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800 }}>{u.name.charAt(0).toUpperCase()}</span>
                {u.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Allarme rischio streak */}
      {streakRisk && (
        <div className="slide-up wiggle" style={{ margin: '0 18px 12px', background: `linear-gradient(135deg, ${t.coral}, ${t.sunny})`, borderRadius: '16px', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: cardShadow }}>
          <AlertTriangle size={22} color="#fff" />
          <div style={{ fontSize: '13px', color: '#fff', fontWeight: 700 }}>Stai per perdere la tua serie di {streaks[me.id]} giorni! Fai un lavoro prima di mezzanotte</div>
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
                    <div className="display" style={{ fontSize: '15px', fontWeight: 600, marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '7px', color: t.text }}>
                      <Avatar user={u} size={26} /> {u.name}
                      {me && me.id === u.id && <span style={{ fontSize: '10px', background: u.color, color: '#fff', borderRadius: '6px', padding: '1px 5px' }}>tu</span>}
                    </div>
                    <div style={{ fontSize: '12px', color: t.textSoft, marginBottom: '6px' }}>{lvl.title}</div>
                    <div style={{ fontSize: '26px', fontWeight: 800, color: t.text }} className="display">{totals[u.id] || 0}</div>
                    <div style={{ height: '10px', background: t.line, borderRadius: '8px', marginTop: '8px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: u.color, borderRadius: '8px', transition: 'width 0.6s cubic-bezier(0.34,1.56,0.64,1)' }} />
                    </div>
                    {onVacation ? (
                      <div style={{ fontSize: '12px', marginTop: '6px', color: t.textSoft, display: 'flex', alignItems: 'center', gap: '4px' }}><Palmtree size={14} color={t.mint} /> in pausa</div>
                    ) : streaks[u.id] > 0 && (
                      <button onClick={() => { setTab('progress'); setProgressSection('serie'); }} style={{ fontSize: '12px', marginTop: '6px', color: t.textSoft, display: 'flex', alignItems: 'center', gap: '4px', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}><Flame size={14} color={t.coral} /> {streaks[u.id]} {streaks[u.id] === 1 ? 'giorno' : 'giorni'}</button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Lavori in scadenza (ricorrenti) — la cosa più urgente, subito sotto ai punti */}
          {dueChores.length > 0 && (
            <div className="slide-up" style={{ background: t.card, borderRadius: t.radius, padding: '14px', marginBottom: '16px', boxShadow: cardShadow, borderLeft: `4px solid ${t.sunny}` }}>
              <div style={{ fontSize: '13px', fontWeight: 800, color: t.text, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}><Bell size={16} color={t.sunny} /> Da fare presto</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {dueChores.slice(0, 4).map(({ chore, rec }) => (
                  <div key={chore.id} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <IconTile emoji={chore.emoji} size={36} />
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

          {/* Azioni rapide — l'azione più usata dell'app, va vista subito */}
          <SectionTitle icon={Zap} gradient="orange" t={t}>Azioni rapide</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '18px' }}>
            {data.chores.slice(0, 6).map((c, i) => (
              <button key={c.id} onClick={() => handleChoreClick(c)} className="quick-card slide-up" style={{ background: t.card, border: 'none', borderRadius: '18px', padding: '14px', textAlign: 'left', boxShadow: cardShadow, cursor: 'pointer', animationDelay: `${i * 0.04}s` }}>
                <IconTile emoji={c.emoji} size={40} />
                <div style={{ fontSize: '13px', fontWeight: 700, marginTop: '8px', lineHeight: 1.2, color: t.text }}>{c.name}</div>
                <div style={{ fontSize: '12px', color: '#D49A00', fontWeight: 700, marginTop: '2px' }}>+{c.points} pt</div>
              </button>
            ))}
          </div>

          {/* Obiettivo di coppia */}
          {coupleGoalProgress && (
            <div className="slide-up" style={{ background: t.card, borderRadius: '18px', padding: '16px', boxShadow: cardShadow, marginBottom: '16px', borderLeft: `4px solid ${t.lavender}` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ fontSize: '13px', fontWeight: 800, color: t.text, display: 'flex', alignItems: 'center', gap: '6px' }}><Target size={16} color={t.lavender} /> Obiettivo di coppia</div>
                <button onClick={() => setShowGoalEdit(true)} style={{ background: 'transparent', border: 'none', color: t.textSoft, cursor: 'pointer', fontSize: '12px' }}><Pencil size={14} /></button>
              </div>
              <div style={{ fontSize: '13px', color: t.textSoft, marginBottom: '8px' }}>{coupleGoalProgress.current} / {coupleGoalProgress.target} punti insieme {coupleGoalProgress.deadline ? `entro ${parseLocalDate(coupleGoalProgress.deadline).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}` : ''}</div>
              <div style={{ height: '14px', background: t.line, borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${coupleGoalProgress.pct}%`, background: `linear-gradient(90deg, ${t.lavender}, ${t.mint})`, borderRadius: '8px', transition: 'width 0.6s', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '6px' }}>
                  {coupleGoalProgress.pct > 15 && <span style={{ fontSize: '10px', color: '#fff', fontWeight: 800 }}>{coupleGoalProgress.pct}%</span>}
                </div>
              </div>
              {coupleGoalProgress.pct >= 100 && <div style={{ fontSize: '13px', color: t.mint, fontWeight: 700, textAlign: 'center', marginTop: '8px' }}>Obiettivo raggiunto insieme! 🎉</div>}
            </div>
          )}
          {!coupleGoalProgress && (
            <button onClick={() => setShowGoalEdit(true)} className="slide-up" style={{ width: '100%', background: t.card, border: `2px dashed ${t.line}`, borderRadius: '16px', padding: '14px', color: t.textSoft, fontSize: '13px', fontWeight: 700, cursor: 'pointer', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <Target size={16} /> Imposta un obiettivo di coppia
            </button>
          )}

          {/* Casa — da illustrazione grande a riga snella: è ambiente, non deve competere con l'azione */}
          <div className="slide-up" style={{ background: t.card, borderRadius: t.radiusSm, padding: '12px 14px', marginBottom: '16px', boxShadow: cardShadow, display: 'flex', alignItems: 'center', gap: '12px' }}>
            <HouseSvg score={health.score} t={t} size={40} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: 800, color: t.text }}>La casa è <span style={{ textTransform: 'capitalize' }}>{hState.label}</span></div>
              <div style={{ height: '6px', background: t.line, borderRadius: '4px', overflow: 'hidden', marginTop: '6px' }}>
                <div style={{ height: '100%', width: `${health.score}%`, background: health.color, borderRadius: '4px', transition: 'width 0.6s' }} />
              </div>
            </div>
          </div>

          {/* Ricompense */}
          {(rewards.length > 0 || unclaimedAchievedRewards.length > 0) && (
            <button onClick={() => setShowRewards(true)} className="slide-up" style={{ width: '100%', textAlign: 'left', background: unclaimedAchievedRewards.length > 0 ? `linear-gradient(135deg, ${t.sunny}, ${t.coral})` : t.card, border: 'none', borderRadius: t.radius, padding: '14px', marginBottom: '16px', boxShadow: cardShadow, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Gift size={26} color={unclaimedAchievedRewards.length > 0 ? '#fff' : t.lavender} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '14px', fontWeight: 800, color: unclaimedAchievedRewards.length > 0 ? '#fff' : t.text }}>
                  {unclaimedAchievedRewards.length > 0 ? `${unclaimedAchievedRewards.length} ricompensa${unclaimedAchievedRewards.length > 1 ? 'e' : ''} da riscuotere!` : 'Ricompense'}
                </div>
                <div style={{ fontSize: '12px', color: unclaimedAchievedRewards.length > 0 ? 'rgba(255,255,255,0.9)' : t.textSoft }}>
                  {unclaimedAchievedRewards.length > 0 ? 'Tocca per vedere' : `${rewards.filter((r) => !r.claimed).length} attive`}
                </div>
              </div>
            </button>
          )}

          {/* Messaggio motivazionale + citazione — contenuto d'atmosfera, in fondo e più discreto */}
          {motivation && (
            <div className="slide-up" style={{ background: t.card, borderRadius: t.radiusSm, padding: '10px 14px', marginBottom: '10px', fontSize: '12.5px', color: t.textSoft, fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', boxShadow: cardShadow }}>
              <Sparkles size={14} color={t.sunny} /> {motivation}
            </div>
          )}
          <div className="slide-up" style={{ background: t.style === 'minimal' ? (dark ? 'rgba(167,139,250,0.1)' : '#FFFFFF') : (dark ? 'rgba(167,139,250,0.1)' : '#F8F5FF'), borderRadius: t.radiusSm, padding: '12px 14px', marginBottom: '18px', borderLeft: `3px solid ${t.lavender}`, boxShadow: t.style === 'minimal' ? cardShadow : 'none', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '12.5px', fontStyle: 'italic', color: t.textSoft, lineHeight: 1.45 }}>"{quote.text}"</div>
              <div style={{ fontSize: '11px', color: t.textSoft, marginTop: '4px', fontWeight: 700, opacity: 0.8 }}>— {quote.author}{quote.source ? `, ${quote.source}` : ''}</div>
            </div>
            <button onClick={() => toggleSaveQuote(quote)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: quoteSaved ? t.coral : t.textSoft, flexShrink: 0, padding: '2px' }} title={quoteSaved ? 'Salvata' : 'Salva citazione'}>
              <Bookmark size={17} fill={quoteSaved ? t.coral : 'none'} />
            </button>
          </div>

          {/* Ultime attività */}
          <SectionTitle icon={Clock} gradient="indigo" t={t}>Ultime attività</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {data.log.length === 0 && <div style={{ background: t.card, borderRadius: '16px', padding: '16px', color: t.textSoft, fontSize: '14px', textAlign: 'center' }}>Ancora nessuna attività. Tocca un lavoro per iniziare!</div>}
            {data.log.slice(0, 6).map((e, i) => {
              const u = data.users.find((x) => x.id === e.userId);
              const info = choreNameForEntry(e, choresById);
              const dedUser = e.dedicatedTo ? data.users.find((x) => x.id === e.dedicatedTo) : null;
              return (
                <div key={e.id} className="slide-up" style={{ background: t.card, borderRadius: '16px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: cardShadow, animationDelay: `${i * 0.03}s` }}>
                  <IconTile emoji={info.emoji} size={36} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: t.text }}>{info.name} {info.parentName && <span style={{ fontSize: '11px', color: t.textSoft, fontWeight: 600 }}>· {info.parentName}</span>} {dedUser && <Heart size={11} color={t.coral} fill={t.coral} style={{ display: 'inline', verticalAlign: 'middle' }} />}</div>
                    <div style={{ fontSize: '12px', color: t.textSoft, display: 'flex', alignItems: 'center', gap: '5px' }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: u?.color, display: 'inline-block' }} /> {u?.name} · {formatTime(e.timestamp)}{dedUser ? ` · per ${dedUser.name}` : ''}</div>
                  </div>
                  <div style={{ fontWeight: 800, color: u?.color }} className="display">+{pointsForEntry(e, choresById)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===== WIDGET ===== */}
      {tab === 'widget' && (
        <div>
          <div style={{ padding: '0 18px', marginBottom: '4px' }}>
            <button onClick={() => setTab('settings')} style={{ background: 'none', border: 'none', padding: 0, color: t.coral, fontSize: '13px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>← Opzioni</button>
          </div>
          <Suspense fallback={<LazyFallback t={t} />}>
            <WidgetScreen data={data} choresById={choresById} totals={totals} streaks={streaks} me={me} t={t} dark={dark} health={health} />
          </Suspense>
        </div>
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
                <input type="number" min="1" placeholder="Punti" value={newChore.points} onChange={(e) => setNewChore({ ...newChore, points: e.target.value })} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: `1px solid ${t.line}`, fontSize: '14px' }} />
                <select value={newChore.category} onChange={(e) => setNewChore({ ...newChore, category: e.target.value })} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: `1px solid ${t.line}`, fontSize: '14px' }}>{allCategories.map((c) => <option key={c}>{c}</option>)}</select>
              </div>
              <button onClick={addChore} style={{ width: '100%', marginTop: '8px', background: t.mint, border: 'none', color: '#fff', borderRadius: '10px', padding: '10px', fontWeight: 700, cursor: 'pointer' }}>Aggiungi lavoro</button>
            </div>
          )}
          <div style={{ fontSize: '11px', color: t.textSoft, marginBottom: '10px', background: t.card, borderRadius: t.radiusSm, padding: '10px 12px' }}>Cambiando i punti di un lavoro, <strong>tutto lo storico si ricalcola</strong> automaticamente.</div>

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
                      <div style={{ display: 'flex', justifyContent: 'center' }}><IconTile emoji={c.emoji} size={36} /></div>
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
                  onLogSubtask={(sub) => handleSubtaskClick(c, sub)}
                  onRecurrence={(days) => setChoreRecurrence(c.id, days)} />
              ));
            })()}
          </div>
        </div>
      )}

      {/* ===== PROGRESSI (Storico + Serie + Stats, un unico tab con selettore) ===== */}
      {tab === 'progress' && (
        <div className="fade-in">
          <div style={{ padding: '0 18px', marginBottom: '14px', display: 'flex', gap: '6px', background: t.card, borderRadius: '14px', boxShadow: cardShadow, margin: '0 18px 14px' }}>
            {[
              { id: 'storico', label: 'Storico' },
              { id: 'serie', label: 'Serie' },
              { id: 'stats', label: 'Stats' },
            ].map((s) => {
              const active = progressSection === s.id;
              return (
                <button key={s.id} onClick={() => setProgressSection(s.id)} style={{ flex: 1, padding: '10px 0', borderRadius: '11px', border: 'none', fontWeight: 800, fontSize: '13px', cursor: 'pointer', background: active ? t.coral : 'transparent', color: active ? '#fff' : t.textSoft, transition: 'background 0.15s, color 0.15s' }}>{s.label}</button>
              );
            })}
          </div>

          {progressSection === 'serie' && (
            <StreakView data={data} me={me} t={t} onExcuse={excuseDay} onUnexcuse={unexcuseDay} />
          )}

          {progressSection === 'stats' && (
            <Suspense fallback={<LazyFallback t={t} />}>
              <StatsView data={data} choresById={choresById} t={t} dark={dark} />
            </Suspense>
          )}

          {progressSection === 'storico' && (
        <div style={{ padding: '0 18px' }}>
          <div style={{ position: 'relative', marginBottom: '10px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.textSoft} strokeWidth="2" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <input placeholder="Cerca un lavoro..." value={historySearch} onChange={(e) => setHistorySearch(e.target.value)} style={{ width: '100%', padding: '10px 10px 10px 36px', borderRadius: '12px', border: `1px solid ${t.line}`, fontSize: '14px' }} />
          </div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            {['all', ...data.users.map((u) => u.id)].map((f) => {
              const u = data.users.find((x) => x.id === f);
              const active = historyFilter === f;
              return <button key={f} onClick={() => setHistoryFilter(f)} style={{ flex: 1, padding: '8px', borderRadius: '12px', border: 'none', fontWeight: 700, fontSize: '13px', cursor: 'pointer', background: active ? (u ? u.color : t.coral) : t.card, color: active ? '#fff' : t.textSoft }}>{u ? u.name : 'Tutti'}</button>;
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
                            <IconTile emoji={info.emoji} size={36} />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '13px', fontWeight: 700, color: t.text }}>{info.name} {info.parentName && <span style={{ fontSize: '11px', color: t.textSoft, fontWeight: 600 }}>· {info.parentName}</span>} {dedUser && <Heart size={11} color={t.coral} fill={t.coral} style={{ display: 'inline', verticalAlign: 'middle' }} />}</div>
                              <div style={{ fontSize: '12px', color: t.textSoft, display: 'flex', alignItems: 'center', gap: '5px' }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: u?.color, display: 'inline-block' }} /> {u?.name} · {formatTime(e.timestamp)}{dedUser ? ` · per ${dedUser.name}` : ''}</div>
                            </div>
                            <div style={{ fontWeight: 800, color: u?.color }} className="display">+{pointsForEntry(e, choresById)}</div>
                            <button onClick={() => setEditingEntry({ ...e, editPoints: pointsForEntry(e, choresById) })} style={{ background: 'transparent', border: 'none', color: t.textSoft, cursor: 'pointer', padding: '4px' }}><Pencil size={15} /></button>
                            <button onClick={() => removeEntry(e.id)} style={{ background: 'transparent', border: 'none', color: t.textSoft, cursor: 'pointer', padding: '4px' }}><Trash2 size={16} /></button>
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
        </div>
      )}

      {/* ===== REGALI ===== */}
      {tab === 'gifts' && (
        <GiftsView
          data={data} me={me} otherUser={otherUser} t={t} dark={dark} cardShadow={cardShadow}
          onAddGift={addGift} onEditGift={editGift} onRemoveGift={removeGift} onRequestGift={requestGift}
          onRespondGift={respondGift} onGiftDone={giftDone} onDeleteRequest={deleteGiftRequest}
        />
      )}

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
          onOpenWidgetPreview={() => setTab('widget')}
          soundPack={soundPack} setSoundPack={setSoundPack}
          onOpenNews={() => setShowNews(true)} unreadNews={unreadNews}
          pushSub={pushSub} pushBusy={pushBusy} pushMsg={pushMsg}
          onEnablePush={enablePush} onDisablePush={disablePush}
          savedCount={(data.savedQuotes || []).length}
          household={household} onSignOut={onSignOut}
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

      {/* Novità dell'app + invito ad aggiornare */}
      {showNews && <NewsModal t={t} dark={dark} onClose={() => setShowNews(false)} onReadChange={refreshUnread} />}
      <UpdateBanner t={t} onOpenNews={() => setShowNews(true)} />

      {/* Correzione voce di storico */}
      {editingEntry && (
        <EditEntryModal
          entry={editingEntry} t={t}
          onSave={(patch) => { updateEntry(editingEntry.id, patch); setEditingEntry(null); }}
          onClose={() => setEditingEntry(null)}
        />
      )}

      {/* Annulla l'ultimo lavoro segnato */}
      {undoToast && (
        <div className="slide-up" style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 'calc(88px + env(safe-area-inset-bottom))', zIndex: 65, background: dark ? '#2D2A4A' : '#2D2A4A', color: '#fff', borderRadius: '16px', padding: '10px 10px 10px 16px', boxShadow: '0 8px 24px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: '12px', maxWidth: 'min(360px, calc(100vw - 32px))' }}>
          <span style={{ fontSize: '13px', fontWeight: 600 }}>{undoToast.label} segnato</span>
          <button onClick={() => undoLog(undoToast.ids)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: '10px', padding: '8px 12px', fontWeight: 800, fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' }}>Annulla</button>
        </div>
      )}

      {/* Bottom nav */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: t.navBg, backdropFilter: t.blur, WebkitBackdropFilter: t.blur, boxShadow: dark ? '0 -4px 16px rgba(0,0,0,0.4)' : '0 -4px 16px rgba(45,42,74,0.08)', borderTop: t.style === 'minimal' ? `0.5px solid ${t.line}` : 'none', display: 'flex', justifyContent: 'space-around', padding: '10px 2px calc(14px + env(safe-area-inset-bottom))', borderRadius: t.style === 'minimal' ? '0' : '20px 20px 0 0' }}>
        {[
          { id: 'home', icon: Home, label: 'Home' },
          { id: 'chores', icon: ListChecks, label: 'Lavori' },
          { id: 'gifts', icon: Gift, label: 'Regali' },
          { id: 'progress', icon: BarChart3, label: 'Progressi' },
          { id: 'settings', icon: Settings, label: 'Opzioni' },
        ].map((it) => {
          const Icon = it.icon; const active = tab === it.id;
          const pending = it.id === 'gifts' && me ? (data.giftRequests || []).filter((r) => r.toUserId === me.id && r.status === 'pending').length : 0;
          return (
            <button key={it.id} onClick={() => setTab(it.id)} className="nav-btn" style={{ position: 'relative', background: 'transparent', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', color: active ? t.coral : t.textSoft, cursor: 'pointer', fontSize: '10.5px', fontWeight: 700, flex: 1, minHeight: '50px', padding: '4px 0' }}>
              <Icon size={22} />
              {it.label}
              {pending > 0 && <span style={{ position: 'absolute', top: '2px', right: 'calc(50% - 18px)', minWidth: '16px', height: '16px', borderRadius: '8px', background: t.coral, color: '#fff', fontSize: '10px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>{pending}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// COMPONENTI AUSILIARI
// ============================================================

function SettingsView({ data, me, identity, setIdentity, updateUser, soundOn, setSoundOn, dark, setDark, seasonal, setSeasonal, style, setStyle, exportCSV, resetHistory, t, cardShadow, season, allCategories, addCustomCategory, renameCategory, removeCategory, choresUsingCategory, penaltiesOn, togglePenalties, vacations, setVacation, onOpenRewards, onOpenSavedQuotes, savedCount, onOpenWidgetPreview, soundPack, setSoundPack, onOpenNews, unreadNews, pushSub, pushBusy, pushMsg, onEnablePush, onDisablePush, household, onSignOut }) {
  const [newCat, setNewCat] = useState('');
  const [codeCopied, setCodeCopied] = useState(false);
  const customCats = data.customCategories || [];

  return (
    <div className="fade-in" style={{ padding: '0 18px' }}>
      {/* La tua casa: account e invito al partner */}
      {household && (
        <>
          <div className="display" style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px', color: t.text }}>La tua casa</div>
          <div style={{ background: t.card, borderRadius: '18px', padding: '14px', boxShadow: cardShadow, marginBottom: '20px' }}>
            {household.memberCount < 2 ? (
              <>
                <div style={{ fontSize: '12px', color: t.textSoft, marginBottom: '10px' }}>In attesa che il tuo partner si unisca. Condividi questo codice:</div>
                <div
                  onClick={() => { if (household.inviteCode) { navigator.clipboard?.writeText(household.inviteCode).then(() => { setCodeCopied(true); setTimeout(() => setCodeCopied(false), 2000); }).catch(() => {}); } }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', background: t.bg, border: `1.5px dashed ${t.coral}`, borderRadius: '14px', padding: '12px', cursor: 'pointer', marginBottom: '12px' }}
                >
                  <div className="display" style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '4px', color: t.text }}>{household.inviteCode || '—'}</div>
                  {codeCopied ? <Check size={16} color={t.mint} /> : <Copy size={16} color={t.textSoft} />}
                </div>
              </>
            ) : (
              <div style={{ fontSize: '12px', color: t.textSoft, marginBottom: '12px' }}>Voi due siete collegati alla stessa casa.</div>
            )}
            {onSignOut && (
              <button onClick={() => { if (window.confirm('Uscire dal tuo account su questo telefono?')) onSignOut(); }} style={{ width: '100%', background: 'transparent', border: `1.5px solid ${t.line}`, borderRadius: '12px', padding: '10px', color: t.textSoft, fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>Esci dall'account</button>
            )}
          </div>
        </>
      )}

      {/* Identità */}
      <div className="display" style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px', color: t.text }}>La tua identità su questo telefono</div>
      <div style={{ background: t.card, borderRadius: '18px', padding: '14px', boxShadow: cardShadow, marginBottom: '20px' }}>
        <div style={{ fontSize: '12px', color: t.textSoft, marginBottom: '10px' }}>Scegli chi sei: i lavori che segni saranno automaticamente tuoi.</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {data.users.map((u) => (
            <button key={u.id} onClick={() => setIdentity(u.id)} style={{ flex: 1, background: identity === u.id ? u.color : 'transparent', border: `2px solid ${u.color}`, borderRadius: '12px', padding: '10px', color: identity === u.id ? '#fff' : u.color, fontWeight: 700, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>{u.name} {identity === u.id && <Check size={15} strokeWidth={3} />}</button>
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
              <Avatar user={u} size={40} />
              <input value={u.name} onChange={(e) => updateUser(u.id, { name: e.target.value })} className="display" style={{ flex: 1, border: `1px solid ${t.line}`, borderRadius: '10px', padding: '8px 10px', fontSize: '15px', fontWeight: 700 }} />
            </div>
            <div style={{ fontSize: '12px', color: t.textSoft, margin: '10px 0 6px' }}>Colore (è anche il tuo avatar)</div>
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
      <button onClick={onOpenSavedQuotes} style={{ width: '100%', background: t.card, border: 'none', color: t.text, borderRadius: t.radiusSm, padding: '14px', fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginBottom: '10px', boxShadow: cardShadow }}>
        <Bookmark size={18} color={t.coral} /> Citazioni salvate <span style={{ marginLeft: 'auto', color: t.textSoft, fontSize: '12px' }}>{savedCount}</span>
      </button>
      <button onClick={onOpenWidgetPreview} style={{ width: '100%', background: t.card, border: 'none', color: t.text, borderRadius: t.radiusSm, padding: '14px', fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginBottom: '10px', boxShadow: cardShadow }}>
        <LayoutGrid size={18} color={t.lavender} /> Anteprima widget
      </button>
      <button onClick={onOpenNews} style={{ width: '100%', background: t.card, border: 'none', color: t.text, borderRadius: t.radiusSm, padding: '14px', fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginBottom: '20px', boxShadow: cardShadow }}>
        <Bell size={18} color={t.sunny} /> Novità dell'app
        {unreadNews > 0 && <span style={{ marginLeft: 'auto', background: t.coral, color: '#fff', borderRadius: '10px', padding: '2px 8px', fontSize: '11px', fontWeight: 800 }}>{unreadNews} da leggere</span>}
      </button>

      {/* Preferenze */}
      <div className="display" style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px', color: t.text }}>Preferenze</div>
      <div style={{ background: t.card, borderRadius: t.radius, padding: '4px 14px', boxShadow: cardShadow, marginBottom: '20px' }}>
        <ToggleRow label="Suoni" value={soundOn} onChange={() => setSoundOn((s) => !s)} t={t} />
        <ToggleRow label="Tema scuro" value={!!dark} onChange={() => setDark((d) => !d)} t={t} />
        <ToggleRow label={`Tema stagionale (${season.name})`} value={seasonal} onChange={() => setSeasonal((s) => !s)} t={t} />
        <ToggleRow label="Penalità per lavori dimenticati" value={penaltiesOn} onChange={togglePenalties} t={t} last />
      </div>
      {penaltiesOn && <div style={{ fontSize: '11px', color: t.textSoft, marginBottom: '20px', background: t.card, borderRadius: t.radiusSm, padding: '10px 12px' }}>Con le penalità attive, dimenticare a lungo i lavori chiave abbassa la "salute della casa" più velocemente.</div>}

      {/* Notifiche push */}
      <div className="display" style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px', color: t.text, display: 'flex', alignItems: 'center', gap: '6px' }}><Bell size={16} color={t.coral} /> Notifiche sul telefono</div>
      {(() => {
        const blocked = pushBlockedReason();
        const attive = !!pushSub;
        if (blocked === 'ios-non-installata') {
          return (
            <div style={{ background: t.card, borderRadius: t.radiusSm, padding: '14px', boxShadow: cardShadow, marginBottom: '20px', fontSize: '13px', color: t.text, lineHeight: 1.5 }}>
              📲 Su iPhone le notifiche funzionano solo se l'app è <strong>aggiunta alla schermata Home</strong>.<br />
              <span style={{ color: t.textSoft, fontSize: '12.5px' }}>In Safari tocca <strong>Condividi</strong> → <strong>Aggiungi a Home</strong>, poi apri Casa Points dall'icona e torna qui.</span>
            </div>
          );
        }
        if (blocked === 'non-supportato') {
          return (
            <div style={{ background: t.card, borderRadius: t.radiusSm, padding: '14px', boxShadow: cardShadow, marginBottom: '20px', fontSize: '13px', color: t.textSoft }}>
              Questo browser non supporta le notifiche.
            </div>
          );
        }
        return (
          <div style={{ background: t.card, borderRadius: t.radiusSm, padding: '14px', boxShadow: cardShadow, marginBottom: '20px' }}>
            <div style={{ fontSize: '13px', color: t.textSoft, marginBottom: '12px', lineHeight: 1.5 }}>
              {attive
                ? 'Attive su questo telefono: ricevi un avviso quando ti chiedono un regalo o rispondono a una tua richiesta.'
                : 'Attivale per sapere subito quando ti chiedono un regalo, senza dover aprire l\'app.'}
            </div>
            <button
              onClick={attive ? onDisablePush : onEnablePush}
              disabled={pushBusy}
              style={{ width: '100%', background: attive ? 'transparent' : t.coral, border: attive ? `1.5px solid ${t.line}` : 'none', color: attive ? t.textSoft : '#fff', borderRadius: '12px', padding: '13px', fontWeight: 800, fontSize: '14px', cursor: pushBusy ? 'default' : 'pointer', opacity: pushBusy ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px' }}
            >
              <Bell size={16} />
              {pushBusy ? 'Un attimo…' : attive ? 'Disattiva su questo telefono' : 'Attiva le notifiche'}
            </button>
            {pushMsg && <div style={{ fontSize: '12.5px', color: t.text, marginTop: '10px', lineHeight: 1.5 }}>{pushMsg}</div>}
          </div>
        );
      })()}

      {/* Suono del completamento */}
      <div className="display" style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px', color: t.text, display: 'flex', alignItems: 'center', gap: '6px' }}><Music size={16} color={t.lavender} /> Suono quando segni un lavoro</div>
      <div style={{ fontSize: '12px', color: t.textSoft, marginBottom: '10px' }}>Tocca per sentirlo. {soundOn ? 'Vale solo per questo telefono.' : 'I suoni sono spenti: riaccendili qui sopra per sentirli.'}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
        {SOUND_PACKS.map((p) => {
          const on = soundPack === p.id;
          return (
            <button key={p.id} onClick={() => { setSoundPack(p.id); playPackPreview(p.id); }} style={{ display: 'flex', alignItems: 'center', gap: '11px', background: t.card, border: `2px solid ${on ? t.lavender : 'transparent'}`, borderRadius: t.radiusSm, padding: '13px 14px', cursor: 'pointer', boxShadow: cardShadow, textAlign: 'left' }}>
              <span style={{ fontSize: '22px' }}>{p.emoji}</span>
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', fontSize: '14px', fontWeight: 800, color: t.text }}>{p.name}</span>
                <span style={{ display: 'block', fontSize: '11.5px', color: t.textSoft }}>{p.desc}</span>
              </span>
              {on && <Check size={18} color={t.lavender} />}
            </button>
          );
        })}
      </div>

      {/* Dati */}
      <div className="display" style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px', color: t.text }}>Dati</div>
      <button onClick={exportCSV} style={{ width: '100%', background: t.card, border: `1px solid ${t.line}`, color: t.text, borderRadius: t.radiusSm, padding: '12px', fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', marginBottom: '10px' }}><Download size={16} /> Esporta storico (CSV)</button>
      <button onClick={resetHistory} style={{ width: '100%', background: t.card, border: `1px solid ${t.line}`, color: '#C0392B', borderRadius: t.radiusSm, padding: '12px', fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', marginBottom: '24px' }}><RotateCcw size={16} /> Azzera storico e punti</button>
    </div>
  );
}

function EditEntryModal({ entry, onSave, onClose, t }) {
  const [points, setPoints] = useState(entry.editPoints);
  const [date, setDate] = useState(entry.date);
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(45,42,74,0.45)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }} onClick={onClose}>
      <div className="pop-card" style={{ background: t.card, borderRadius: '24px', padding: '24px', maxWidth: '340px', width: '100%' }} onClick={(e) => e.stopPropagation()}>
        <div className="display" style={{ fontSize: '18px', fontWeight: 700, color: t.text, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}><Pencil size={18} color={t.lavender} /> Correggi voce</div>
        <div style={{ fontSize: '13px', color: t.textSoft, marginBottom: '16px' }}>{entry.snapshotName}</div>
        <div style={{ fontSize: '12px', color: t.textSoft, marginBottom: '6px' }}>Punti</div>
        <input type="number" value={points} onChange={(e) => setPoints(Number(e.target.value) || 0)} style={{ width: '100%', padding: '10px', borderRadius: '10px', border: `1px solid ${t.line}`, fontSize: '15px', marginBottom: '12px', fontWeight: 700 }} />
        <div style={{ fontSize: '12px', color: t.textSoft, marginBottom: '6px' }}>Data</div>
        <input type="date" value={date} max={todayStr()} onChange={(e) => setDate(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '10px', border: `1px solid ${t.line}`, fontSize: '14px', marginBottom: '16px' }} />
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={onClose} style={{ background: t.line, border: 'none', color: t.textSoft, borderRadius: '12px', padding: '12px 16px', fontWeight: 700, cursor: 'pointer' }}>Annulla</button>
          <button
            onClick={() => {
              const isToday = date === todayStr();
              const ts = isToday ? new Date().toISOString() : new Date(`${date}T12:00:00`).toISOString();
              onSave({ pointsOverride: points, date, timestamp: ts });
            }}
            style={{ flex: 1, background: t.mint, border: 'none', color: '#fff', borderRadius: '12px', padding: '12px', fontWeight: 700, cursor: 'pointer' }}
          >Salva</button>
        </div>
      </div>
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

// Selettore di icone: il valore salvato resta l'emoji (chiave dei dati),
// ma a schermo si vede l'icona pulita corrispondente.
function EmojiPicker({ options, value, onChange, t, kind = 'chore' }) {
  return (
    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', maxHeight: '150px', overflowY: 'auto' }}>
      {options.map((em) => (
        <button key={em} onClick={() => onChange(em)} style={{ width: '42px', height: '42px', padding: 0, borderRadius: '12px', border: value === em ? `2.5px solid ${t.coral}` : '2.5px solid transparent', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <IconTile emoji={em} kind={kind} size={34} />
        </button>
      ))}
    </div>
  );
}

function ChoreRow({ chore, editing, onEdit, onSave, onDelete, onLog, onLogSubtask, t, categories, log, onRecurrence }) {
  const [draft, setDraft] = useState(chore);
  useEffect(() => { setDraft(chore); }, [chore, editing]);
  const rec = log ? recurringStatus(chore, log) : null;
  if (editing) {
    const recDays = draft.recurrence?.days || 0;
    const recWeekdays = draft.recurrence?.weekdays || [];
    const WEEKDAY_LABELS = [['L', 1], ['M', 2], ['M', 3], ['G', 4], ['V', 5], ['S', 6], ['D', 0]];
    const toggleWeekday = (d) => {
      const next = recWeekdays.includes(d) ? recWeekdays.filter((x) => x !== d) : [...recWeekdays, d];
      setDraft({ ...draft, recurrence: next.length ? { weekdays: next } : null });
    };
    return (
      <div className="pop-card" style={{ background: t.card, borderRadius: t.radiusSm, padding: '14px', boxShadow: '0 6px 16px rgba(45,42,74,0.1)' }}>
        <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '10px', border: `1px solid ${t.line}`, marginBottom: '8px', fontSize: '14px', fontFamily: 'inherit', fontWeight: 700 }} />
        <EmojiPicker options={CHORE_EMOJIS} value={draft.emoji} onChange={(em) => setDraft({ ...draft, emoji: em })} t={t} />
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
          <input type="number" min="1" value={draft.points} onChange={(e) => setDraft({ ...draft, points: Math.max(1, Number(e.target.value) || 0) })} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: `1px solid ${t.line}`, fontSize: '14px' }} />
          <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: `1px solid ${t.line}`, fontSize: '14px' }}>{(categories || CATEGORIES).map((c) => <option key={c}>{c}</option>)}</select>
        </div>
        {/* Ricorrenza */}
        <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', color: t.textSoft, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}><Repeat size={14} /> Ricorrenza:</span>
          {[[0, 'No'], [1, 'Ogni giorno'], [3, 'Ogni 3 gg'], [7, 'Ogni settimana'], [14, 'Ogni 2 sett.'], [30, 'Ogni mese']].map(([d, label]) => (
            <button key={d} onClick={() => setDraft({ ...draft, recurrence: d ? { days: d } : null })} style={{ padding: '6px 10px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 700, background: recDays === d && recWeekdays.length === 0 ? t.lavender : t.line, color: recDays === d && recWeekdays.length === 0 ? '#fff' : t.textSoft }}>{label}</button>
          ))}
        </div>
        <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', color: t.textSoft }}>oppure giorni fissi:</span>
          {WEEKDAY_LABELS.map(([label, d]) => (
            <button key={d} onClick={() => toggleWeekday(d)} style={{ width: '26px', height: '26px', borderRadius: '50%', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 800, background: recWeekdays.includes(d) ? t.coral : t.line, color: recWeekdays.includes(d) ? '#fff' : t.textSoft }}>{label}</button>
          ))}
        </div>

        {/* Sotto-task indipendenti */}
        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: `1px solid ${t.line}` }}>
          <div style={{ fontSize: '12px', color: t.textSoft, fontWeight: 700, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}><Plus size={14} color={t.lavender} /> Sotto-task (selezionabili indipendentemente)</div>
          <div style={{ fontSize: '11px', color: t.textSoft, marginBottom: '10px' }}>Es. "Pulizia filtri" si può segnare anche senza aver fatto il task principale.</div>
          {(draft.subtasks || []).map((sub, i) => (
            <div key={sub.id} style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '8px' }}>
              <input value={sub.emoji || ''} onChange={(e) => {
                const subtasks = [...(draft.subtasks || [])]; subtasks[i] = { ...sub, emoji: e.target.value }; setDraft({ ...draft, subtasks });
              }} style={{ width: '48px', padding: '9px', borderRadius: '9px', border: `1px solid ${t.line}`, fontSize: '18px', textAlign: 'center' }} placeholder="🔧" />
              <input value={sub.name} placeholder="Es. Pulizia filtri" onChange={(e) => {
                const subtasks = [...(draft.subtasks || [])]; subtasks[i] = { ...sub, name: e.target.value }; setDraft({ ...draft, subtasks });
              }} style={{ flex: 1, padding: '9px', borderRadius: '9px', border: `1px solid ${t.line}`, fontSize: '13px' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                <span style={{ fontSize: '13px', color: t.textSoft, fontWeight: 700 }}>+</span>
                <input type="number" min="1" value={sub.points} onChange={(e) => {
                  const subtasks = [...(draft.subtasks || [])]; subtasks[i] = { ...sub, points: Math.max(1, Number(e.target.value) || 0) }; setDraft({ ...draft, subtasks });
                }} style={{ width: '52px', padding: '9px', borderRadius: '9px', border: `1px solid ${t.line}`, fontSize: '13px', textAlign: 'center' }} />
              </div>
              <button onClick={() => setDraft({ ...draft, subtasks: (draft.subtasks || []).filter((x) => x.id !== sub.id) })} style={{ background: 'transparent', border: 'none', color: t.textSoft, cursor: 'pointer', display: 'flex', padding: '6px' }}><X size={16} /></button>
            </div>
          ))}
          <button onClick={() => setDraft({ ...draft, subtasks: [...(draft.subtasks || []), { id: 'sub-' + uid(), name: '', emoji: '', points: 3 }] })} style={{ background: 'transparent', border: `1.5px dashed ${t.line}`, color: t.textSoft, borderRadius: '9px', padding: '8px 12px', fontWeight: 700, fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}><Plus size={14} /> Aggiungi sotto-task</button>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
          <button onClick={onDelete} style={{ background: '#FFE5E5', border: 'none', color: '#C0392B', borderRadius: '10px', padding: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700, fontSize: '13px' }}><Trash2 size={15} /> Elimina</button>
          <button onClick={() => onSave({ ...draft, subtasks: (draft.subtasks || []).filter((s) => s.name.trim()) })} style={{ flex: 1, background: t.mint, border: 'none', color: '#fff', borderRadius: '10px', padding: '10px', fontWeight: 700, cursor: 'pointer' }}>Salva</button>
          <button onClick={onEdit} style={{ background: t.line, border: 'none', color: t.textSoft, borderRadius: '10px', padding: '10px', cursor: 'pointer' }}><X size={16} /></button>
        </div>
      </div>
    );
  }
  const subtasks = chore.subtasks || [];
  return (
    <div style={{ background: t.card, borderRadius: t.radiusSm, padding: '12px 14px', boxShadow: t.shadow }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <IconTile emoji={chore.emoji} size={40} />
        <div style={{ flex: 1 }} onClick={onLog} role="button">
          <div style={{ fontSize: '14px', fontWeight: 700, color: t.text, display: 'flex', alignItems: 'center', gap: '6px' }}>
            {chore.name}
            {rec && <Repeat size={12} color={t.textSoft} />}
          </div>
          <div style={{ fontSize: '12px', color: t.textSoft }}>
            {chore.category} · {chore.points} punti
            {rec && rec.status === 'overdue' && <span style={{ color: t.coral, fontWeight: 700 }}> · in ritardo</span>}
            {rec && rec.status === 'due' && <span style={{ color: t.sunny, fontWeight: 700 }}> · da fare</span>}
          </div>
        </div>
        <button onClick={onEdit} style={{ background: t.line, border: 'none', borderRadius: '12px', padding: '11px', color: t.textSoft, cursor: 'pointer', display: 'flex', minHeight: '44px', alignItems: 'center' }}><Pencil size={17} /></button>
        <button onClick={onLog} className="wiggle" style={{ background: t.sunny, border: 'none', borderRadius: t.radiusSm, padding: '11px 16px', fontWeight: 700, color: '#2D2A4A', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '14px', minHeight: '44px' }}><Check size={17} /> Fatto</button>
      </div>

      {/* Sotto-task: si segnano da sole, senza passare dal lavoro principale */}
      {subtasks.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px', paddingTop: '10px', borderTop: `1px solid ${t.line}` }}>
          {subtasks.map((sub) => (
            <button key={sub.id} onClick={() => onLogSubtask(sub)} className="wiggle" style={{ background: 'transparent', border: `1.5px solid ${t.line}`, borderRadius: '20px', padding: '6px 12px 6px 7px', fontSize: '12.5px', fontWeight: 700, color: t.text, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <IconTile emoji={sub.emoji || chore.emoji} size={22} radius={7} />
              <span>{sub.name}</span>
              <span style={{ color: t.lavender, fontWeight: 800 }}>+{sub.points}</span>
            </button>
          ))}
        </div>
      )}
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

// ============================================================================
// Guscio autenticazione: prima di mostrare l'app vera e propria, verifica
// che ci sia una sessione e che l'account faccia già parte di una casa.
// In modalità demo salta tutto questo (nessun account, dati finti).
// ============================================================================
function AppRoot() {
  const [state, setState] = useState(() => (isDemo ? { status: 'demo' } : { status: 'loading' }));

  useEffect(() => {
    if (isDemo) return;
    let alive = true;

    const resolve = async (session) => {
      if (!session) { if (alive) setState({ status: 'signed-out' }); return; }
      const { data: membership } = await supabase.from('household_members').select('household_id').eq('user_id', session.user.id).maybeSingle();
      if (!alive) return;
      if (!membership) { setState({ status: 'no-household' }); return; }
      const [{ data: hh }, { data: members }] = await Promise.all([
        supabase.from('households').select('id, invite_code').eq('id', membership.household_id).single(),
        supabase.from('household_members').select('user_id').eq('household_id', membership.household_id),
      ]);
      if (!alive) return;
      setState({
        status: 'ready',
        householdId: membership.household_id,
        household: { inviteCode: hh?.invite_code || null, memberCount: members?.length || 1 },
      });
    };

    supabase.auth.getSession().then(({ data }) => resolve(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => resolve(session));
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, []);

  if (state.status === 'demo') return <App householdId={null} household={null} onSignOut={null} />;
  if (state.status === 'loading') return <SplashScreen />;
  if (state.status === 'signed-out') return <AuthScreen />;
  if (state.status === 'no-household') return <HouseholdSetupScreen />;
  return <App householdId={state.householdId} household={state.household} onSignOut={() => supabase.auth.signOut()} />;
}

export default AppRoot;
