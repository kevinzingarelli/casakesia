// ============================================================
// COSTANTI, DATI DI DEFAULT E FUNZIONI DI CALCOLO
// ============================================================

export const PALETTE = {
  bg: '#FFF7ED',
  bgDark: '#1A1726',
  card: '#FFFFFF',
  cardDark: '#272336',
  coral: '#FF6B6B',
  mint: '#06D6A0',
  lavender: '#A78BFA',
  sunny: '#FFD166',
  plum: '#2D2A4A',
  plumSoft: '#6B6789',
  line: '#FFE8D6',
  lineDark: '#3A3550',
};

// Palette Minimal (stile iOS/Apple)
export const PALETTE_MIN = {
  bg: '#F2F2F7', bgDark: '#000000',
  card: '#FFFFFF', cardDark: '#1C1C1E',
  text: '#1C1C1E', textDark: '#FFFFFF',
  textSoft: '#8E8E93', textSoftDark: '#98989F',
  line: '#E5E5EA', lineDark: '#38383A',
};

// Tema: dark (true/false) + style ('pop' | 'minimal')
export function theme(dark, style = 'pop') {
  const minimal = style === 'minimal';
  if (minimal) {
    return {
      style: 'minimal',
      bg: dark ? PALETTE_MIN.bgDark : PALETTE_MIN.bg,
      card: dark ? PALETTE_MIN.cardDark : PALETTE_MIN.card,
      text: dark ? PALETTE_MIN.textDark : PALETTE_MIN.text,
      textSoft: dark ? PALETTE_MIN.textSoftDark : PALETTE_MIN.textSoft,
      line: dark ? PALETTE_MIN.lineDark : PALETTE_MIN.line,
      coral: PALETTE.coral, mint: PALETTE.mint, lavender: PALETTE.lavender, sunny: PALETTE.sunny,
      font: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif",
      fontDisplay: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif",
      displayWeight: 600,
      radius: '18px', radiusSm: '12px', radiusLg: '22px',
      shadow: dark ? '0 1px 3px rgba(0,0,0,0.6)' : '0 1px 2px rgba(0,0,0,0.04), 0 6px 20px rgba(0,0,0,0.05)',
      blur: 'saturate(180%) blur(20px)',
      navBg: dark ? 'rgba(28,28,30,0.78)' : 'rgba(255,255,255,0.78)',
    };
  }
  return {
    style: 'pop',
    bg: dark ? PALETTE.bgDark : PALETTE.bg,
    card: dark ? PALETTE.cardDark : PALETTE.card,
    text: dark ? '#F0EEF7' : PALETTE.plum,
    textSoft: dark ? '#A8A3C0' : PALETTE.plumSoft,
    line: dark ? PALETTE.lineDark : PALETTE.line,
    coral: PALETTE.coral, mint: PALETTE.mint, lavender: PALETTE.lavender, sunny: PALETTE.sunny,
    font: "'Nunito', sans-serif",
    fontDisplay: "'Fredoka', sans-serif",
    displayWeight: 700,
    radius: '24px', radiusSm: '16px', radiusLg: '28px',
    shadow: dark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(45,42,74,0.05)',
    blur: 'none',
    navBg: dark ? PALETTE.cardDark : PALETTE.card,
  };
}

// Stato della casetta illustrata in base alla salute (0-100)
export function houseState(score) {
  if (score >= 85) return { level: 4, label: 'splendente', sparkle: true };
  if (score >= 60) return { level: 3, label: 'pulita', sparkle: false };
  if (score >= 35) return { level: 2, label: 'normale', sparkle: false };
  if (score >= 15) return { level: 1, label: 'da sistemare', sparkle: false };
  return { level: 0, label: 'trasandata', sparkle: false };
}

// Stato di un lavoro ricorrente: quando è stato fatto l'ultima volta e se è in scadenza
export function recurringStatus(chore, log) {
  if (!chore.recurrence || !chore.recurrence.days) return null;
  const days = chore.recurrence.days;
  const entries = log.filter((e) => e.choreId === chore.id).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  if (entries.length === 0) return { status: 'due', daysLeft: 0, lastDone: null, every: days };
  const last = new Date(entries[0].timestamp);
  const next = new Date(last); next.setDate(next.getDate() + days);
  const now = new Date();
  const daysLeft = Math.ceil((next - now) / 86400000);
  let status = 'ok';
  if (daysLeft <= 0) status = 'overdue';
  else if (daysLeft <= 1) status = 'due';
  return { status, daysLeft, lastDone: entries[0].date, every: days };
}

// Verifica se una ricompensa è stata raggiunta
export function rewardAchieved(reward, ctx) {
  // ctx: { myTotal, otherTotal, coupleTotal, weeklyWinnerId, myId }
  if (reward.type === 'points') return (ctx.myTotal || 0) >= reward.target;
  if (reward.type === 'couple') return (ctx.coupleTotal || 0) >= reward.target;
  if (reward.type === 'weekly_win') return ctx.weeklyWinnerId === ctx.myId && (ctx.myWeekPoints || 0) > 0;
  return false;
}

// Lavori usati più di recente/frequente nell'ultima finestra di giorni
export function recentChores(log, choresById, days = 7, limit = 5) {
  const since = new Date(); since.setDate(since.getDate() - days);
  const freq = {};
  log.forEach((e) => {
    if (new Date(e.timestamp) >= since && choresById[e.choreId]) {
      freq[e.choreId] = (freq[e.choreId] || 0) + 1;
    }
  });
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => choresById[id])
    .filter(Boolean);
}

// Raggruppa le voci di log per giorno con etichette Oggi/Ieri/data
export function groupByDay(entries) {
  const groups = {};
  entries.forEach((e) => { (groups[e.date] = groups[e.date] || []).push(e); });
  const today = todayStr();
  const yest = todayStr(new Date(Date.now() - 86400000));
  return Object.keys(groups).sort((a, b) => b.localeCompare(a)).map((date) => {
    let label;
    if (date === today) label = 'Oggi';
    else if (date === yest) label = 'Ieri';
    else label = new Date(date).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
    return { date, label, entries: groups[date] };
  });
}

export const USER_EMOJIS = ['🦊', '🐧', '🐶', '🐱', '🐻', '🦁', '🐼', '🦄', '🐰', '🦉', '🐯', '🐨', '🐸', '🐵', '🐷', '🐔'];
export const USER_COLORS = ['#FF6B6B', '#06D6A0', '#A78BFA', '#FFD166', '#4D96FF', '#FF8FAB', '#7CCB7B', '#FF9F45', '#E879F9', '#22D3EE'];
export const CHORE_EMOJIS = ['🍽️', '🫧', '🧹', '🪣', '🚿', '🛒', '🍳', '👕', '🧺', '🗑️', '🛏️', '🪶', '🪟', '❄️', '🛋️', '📑', '🪴', '🐾', '👔', '🌙', '✨', '🚗', '💻', '📦', '🧽', '🚽', '🪥', '🧴', '🍶', '🪒'];
export const CATEGORIES = ['Cucina', 'Pulizia', 'Bucato', 'Gestione', 'Esterno'];

export const DEFAULT_CHORES = [
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

export const DEFAULT_USERS = [
  { id: 'u1', name: 'Persona 1', emoji: '🦊', color: PALETTE.coral },
  { id: 'u2', name: 'Persona 2', emoji: '🐧', color: PALETTE.mint },
];

export const LEVELS = [
  { min: 0, title: 'Novellino', emoji: '🌱' },
  { min: 50, title: 'Apprendista', emoji: '⭐' },
  { min: 150, title: 'Esperto', emoji: '🔥' },
  { min: 300, title: 'Maestro', emoji: '👑' },
  { min: 500, title: 'Leggenda', emoji: '🏆' },
  { min: 800, title: 'Mito', emoji: '🌟' },
  { min: 1200, title: 'Divinità domestica', emoji: '✨' },
];

// Traguardi: ognuno ha una descrizione di COME sbloccarlo (richiesta dall'utente)
export const ACHIEVEMENTS = [
  { id: 'first', emoji: '🎯', title: 'Primo passo', desc: 'Completa il tuo primo lavoro', how: 'Registra un qualsiasi lavoro per la prima volta.', check: (c) => c.count >= 1 },
  { id: 'ten', emoji: '🚀', title: 'Decollo', desc: '10 lavori completati', how: 'Completa 10 lavori in totale (di qualsiasi tipo).', check: (c) => c.count >= 10 },
  { id: 'fifty', emoji: '💪', title: 'Inarrestabile', desc: '50 lavori completati', how: 'Completa 50 lavori in totale.', check: (c) => c.count >= 50 },
  { id: 'hundred', emoji: '🏅', title: 'Centurione', desc: '100 lavori completati', how: 'Completa 100 lavori in totale.', check: (c) => c.count >= 100 },
  { id: 'pts100', emoji: '💯', title: 'Cento punti', desc: 'Raggiungi 100 punti', how: 'Accumula 100 punti totali completando lavori.', check: (c) => c.total >= 100 },
  { id: 'pts300', emoji: '👑', title: 'Maestro di casa', desc: 'Raggiungi 300 punti', how: 'Accumula 300 punti totali.', check: (c) => c.total >= 300 },
  { id: 'pts500', emoji: '🏆', title: 'Leggendario', desc: 'Raggiungi 500 punti', how: 'Accumula 500 punti totali.', check: (c) => c.total >= 500 },
  { id: 'streak3', emoji: '🔥', title: 'In fiamme', desc: '3 giorni di fila', how: 'Completa almeno un lavoro al giorno per 3 giorni consecutivi.', check: (c) => c.streak >= 3 },
  { id: 'streak7', emoji: '⚡', title: 'Settimana perfetta', desc: '7 giorni di fila', how: 'Completa almeno un lavoro al giorno per 7 giorni consecutivi.', check: (c) => c.streak >= 7 },
  { id: 'streak30', emoji: '🌟', title: 'Mese leggendario', desc: '30 giorni di fila', how: 'Completa almeno un lavoro al giorno per 30 giorni consecutivi.', check: (c) => c.streak >= 30 },
  { id: 'rainbow', emoji: '🌈', title: 'Tuttofare', desc: 'Un lavoro per ogni categoria', how: 'Completa almeno un lavoro in ciascuna delle 5 categorie.', check: (c) => c.categoriesCovered >= CATEGORIES.length },
  { id: 'earlybird', emoji: '🌅', title: 'Mattiniero', desc: 'Lavoro prima delle 9:00', how: 'Registra un lavoro prima delle 9 del mattino.', check: (c) => c.hasEarly },
  { id: 'nightowl', emoji: '🦉', title: 'Gufo notturno', desc: 'Lavoro dopo le 22:00', how: 'Registra un lavoro dopo le 22 di sera.', check: (c) => c.hasNight },
  { id: 'marathon', emoji: '🏃', title: 'Maratoneta', desc: '5 lavori in un giorno', how: 'Completa 5 o più lavori nello stesso giorno.', check: (c) => c.maxInDay >= 5 },
  { id: 'weekendwin', emoji: '🎖️', title: 'Campione settimanale', desc: 'Vinci una settimana', how: 'Termina una settimana con più punti del coinquilino.', check: (c) => c.weekWins >= 1 },
];

// ---------- Funzioni di utilità tempo ----------
export function todayStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

export function startOfWeek(d = new Date()) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function startOfYear(d = new Date()) {
  return new Date(d.getFullYear(), 0, 1);
}

// Restituisce la data di inizio per un periodo dato
export function periodStart(period, customDays) {
  const now = new Date();
  switch (period) {
    case 'week': return startOfWeek(now);
    case 'month': return startOfMonth(now);
    case 'year': return startOfYear(now);
    case 'all': return new Date(0);
    case 'custom': {
      const d = new Date();
      d.setDate(d.getDate() - (customDays || 30));
      d.setHours(0, 0, 0, 0);
      return d;
    }
    default: return startOfWeek(now);
  }
}

export const PERIOD_LABELS = {
  week: 'Settimana',
  month: 'Mese',
  year: 'Anno',
  all: 'Totale',
  custom: 'Personalizzato',
};

// ---------- Calcoli punti (con supporto cambio retroattivo) ----------
// I log NON memorizzano i punti: li calcoliamo dalla definizione corrente del lavoro.
// Per i lavori eliminati usiamo lo snapshot salvato nel log (fallback).
export function pointsForEntry(entry, choresById) {
  const chore = choresById[entry.choreId];
  let base = chore ? chore.points : (entry.snapshotPoints || 0);
  // Extra opzionali selezionati al momento della registrazione
  if (entry.selectedExtras && entry.selectedExtras.length) {
    entry.selectedExtras.forEach((exId) => {
      const ex = chore?.extras?.find((e) => e.id === exId);
      if (ex) base += ex.points;
      else {
        const snap = entry.extrasSnapshot?.find((e) => e.id === exId);
        if (snap) base += snap.points;
      }
    });
  }
  return base;
}

export function choreNameForEntry(entry, choresById) {
  const chore = choresById[entry.choreId];
  if (chore) return { name: chore.name, emoji: chore.emoji, category: chore.category };
  return { name: entry.snapshotName || 'Lavoro rimosso', emoji: entry.snapshotEmoji || '❓', category: entry.snapshotCategory || 'Gestione' };
}

export function getLevel(points) {
  let lvl = LEVELS[0];
  for (const l of LEVELS) if (points >= l.min) lvl = l;
  const next = LEVELS.find((l) => l.min > points);
  return { ...lvl, next };
}

// Calcola lo streak (giorni consecutivi con almeno un lavoro) per un utente
// excused: { [userId]: { [dateStr]: { reason: string } } }
export function computeStreak(log, userId, excused = {}) {
  const userExcused = excused[userId] || {};
  const days = new Set(log.filter((e) => e.userId === userId).map((e) => e.date));
  let streak = 0;
  let cursor = new Date();
  // Se oggi non ha ancora fatto nulla e non e' giustificato, partiamo da ieri
  if (!days.has(todayStr()) && !userExcused[todayStr()]) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (streak < 3650) {
    const key = todayStr(cursor);
    if (days.has(key) || userExcused[key]) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

// Storia giornaliera degli ultimi N giorni per un utente
// status: done | excused | missed | open (oggi senza lavori ma ancora in gioco)
export function computeStreakHistory(log, userId, excused = {}, numDays = 90) {
  const userExcused = excused[userId] || {};
  const countByDay = {};
  log.filter((e) => e.userId === userId).forEach((e) => {
    countByDay[e.date] = (countByDay[e.date] || 0) + 1;
  });
  const today = todayStr();
  const result = [];
  for (let i = numDays - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const date = todayStr(d);
    let status;
    if (date > today) status = 'future';
    else if (countByDay[date]) status = 'done';
    else if (userExcused[date]) status = 'excused';
    else if (date === today) status = 'open';
    else status = 'missed';
    result.push({ date, status, reason: userExcused[date]?.reason || null, count: countByDay[date] || 0 });
  }
  return result;
}

// Serie piu' lunga mai fatta (inclusi giorni giustificati)
export function computeBestStreak(log, userId, excused = {}) {
  const history = computeStreakHistory(log, userId, excused, 3650);
  let best = 0, cur = 0;
  history.forEach((d) => {
    if (d.status === 'done' || d.status === 'excused' || d.status === 'open') {
      cur++; if (cur > best) best = cur;
    } else { cur = 0; }
  });
  return best;
}

// Calcola quante settimane passate l'utente ha vinto (per il traguardo)
export function computeWeekWins(log, choresById, userId, otherId) {
  const weekMap = {}; // chiave: lunedì della settimana -> {userId: punti}
  log.forEach((e) => {
    const ws = todayStr(startOfWeek(new Date(e.timestamp)));
    if (!weekMap[ws]) weekMap[ws] = {};
    weekMap[ws][e.userId] = (weekMap[ws][e.userId] || 0) + pointsForEntry(e, choresById);
  });
  const thisWeek = todayStr(startOfWeek());
  let wins = 0;
  Object.keys(weekMap).forEach((wk) => {
    if (wk === thisWeek) return; // settimana corrente non conta ancora
    const mine = weekMap[wk][userId] || 0;
    const other = weekMap[wk][otherId] || 0;
    if (mine > other && mine > 0) wins += 1;
  });
  return wins;
}

// Costruisce il contesto per valutare i traguardi di un utente
export function achievementContext(log, choresById, userId, otherId) {
  const userLog = log.filter((e) => e.userId === userId);
  const total = userLog.reduce((s, e) => s + pointsForEntry(e, choresById), 0);
  const count = userLog.length;
  const categories = new Set(userLog.map((e) => choreNameForEntry(e, choresById).category));
  const hasEarly = userLog.some((e) => new Date(e.timestamp).getHours() < 9);
  const hasNight = userLog.some((e) => new Date(e.timestamp).getHours() >= 22);
  const byDay = {};
  userLog.forEach((e) => { byDay[e.date] = (byDay[e.date] || 0) + 1; });
  const maxInDay = Object.values(byDay).reduce((m, v) => Math.max(m, v), 0);
  const streak = computeStreak(log, userId);
  const weekWins = computeWeekWins(log, choresById, userId, otherId);
  return { total, count, categoriesCovered: categories.size, hasEarly, hasNight, maxInDay, streak, weekWins };
}

export function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ============================================================
// FUNZIONI AGGIUNTIVE (coppia, titoli, salute casa, trend, stagioni)
// ============================================================

// Traguardi di COPPIA (collettivi)
export const COUPLE_MILESTONES = [
  { id: 'cm_jobs50', emoji: '🤝', title: '50 lavori insieme', desc: 'Completate 50 lavori in totale come coppia', check: (c) => c.totalJobs >= 50 },
  { id: 'cm_jobs100', emoji: '💞', title: '100 lavori insieme', desc: '100 lavori completati insieme', check: (c) => c.totalJobs >= 100 },
  { id: 'cm_jobs250', emoji: '🏠', title: 'Squadra di casa', desc: '250 lavori insieme', check: (c) => c.totalJobs >= 250 },
  { id: 'cm_jobs500', emoji: '🏰', title: 'Dinastia domestica', desc: '500 lavori insieme', check: (c) => c.totalJobs >= 500 },
  { id: 'cm_pts1000', emoji: '💎', title: '1000 punti di coppia', desc: '1000 punti totali combinati', check: (c) => c.totalPoints >= 1000 },
  { id: 'cm_pts3000', emoji: '👑', title: 'Impero domestico', desc: '3000 punti combinati', check: (c) => c.totalPoints >= 3000 },
  { id: 'cm_days7', emoji: '🔥', title: 'Settimana di coppia', desc: 'Entrambi attivi per 7 giorni', check: (c) => c.bothActiveStreak >= 7 },
  { id: 'cm_balance', emoji: '⚖️', title: 'Equilibrio perfetto', desc: 'Differenza lavori sotto il 5% (min. 40 lavori)', check: (c) => c.totalJobs >= 40 && c.balanceDiff <= 5 },
];

export function coupleContext(log, choresById, users) {
  const totalJobs = log.length;
  const totalPoints = log.reduce((s, e) => s + pointsForEntry(e, choresById), 0);
  // giorni in cui ENTRAMBI hanno fatto qualcosa, consecutivi da oggi
  const dayHasUser = {};
  users.forEach((u) => { dayHasUser[u.id] = new Set(log.filter((e) => e.userId === u.id).map((e) => e.date)); });
  let bothActiveStreak = 0;
  let cursor = new Date();
  while (users.length >= 2) {
    const key = todayStr(cursor);
    const allActive = users.every((u) => dayHasUser[u.id].has(key));
    if (allActive) { bothActiveStreak += 1; cursor.setDate(cursor.getDate() - 1); }
    else {
      if (key === todayStr() && bothActiveStreak === 0) { cursor.setDate(cursor.getDate() - 1); continue; }
      break;
    }
    if (bothActiveStreak > 400) break;
  }
  // bilanciamento
  const counts = users.map((u) => log.filter((e) => e.userId === u.id).length);
  const tot = counts.reduce((a, b) => a + b, 0) || 1;
  const pcts = counts.map((c) => (c / tot) * 100);
  const balanceDiff = pcts.length >= 2 ? Math.abs(pcts[0] - pcts[1]) : 100;
  return { totalJobs, totalPoints, bothActiveStreak, balanceDiff };
}

// Titolo personalizzato in base alla categoria dominante dell'utente
export function userTitle(log, choresById, userId) {
  const userLog = log.filter((e) => e.userId === userId);
  if (userLog.length < 5) return null;
  const byCat = {};
  userLog.forEach((e) => { const c = choreNameForEntry(e, choresById).category; byCat[c] = (byCat[c] || 0) + 1; });
  let topCat = null, topN = 0;
  Object.entries(byCat).forEach(([c, n]) => { if (n > topN) { topN = n; topCat = c; } });
  const titles = {
    Cucina: { title: 'Re della cucina', emoji: '👨‍🍳' },
    Pulizia: { title: 'Maestro del pulito', emoji: '✨' },
    Bucato: { title: 'Signore del bucato', emoji: '🧺' },
    Gestione: { title: 'Stratega di casa', emoji: '📊' },
    Esterno: { title: 'Guardiano del verde', emoji: '🪴' },
  };
  return titles[topCat] || null;
}

// Salute della casa: basata su frequenza lavori chiave nelle ultime 48h
export function houseHealth(log, choresById) {
  const now = Date.now();
  const h48 = now - 48 * 3600 * 1000;
  const recent = log.filter((e) => new Date(e.timestamp).getTime() >= h48);
  const recentCount = recent.length;
  // copertura categorie nelle ultime 48h
  const cats = new Set(recent.map((e) => choreNameForEntry(e, choresById).category));
  let score = 0;
  score += Math.min(50, recentCount * 8); // attività
  score += Math.min(50, cats.size * 12); // varietà
  let status, color, emoji, label;
  if (score >= 70) { status = 'ottima'; color = '#06D6A0'; emoji = '🌿'; label = 'La casa è in ottime condizioni!'; }
  else if (score >= 35) { status = 'discreta'; color = '#FFD166'; emoji = '🌤️'; label = 'La casa è in condizioni discrete'; }
  else { status = 'da_curare'; color = '#FF6B6B'; emoji = '🏚️'; label = 'La casa ha bisogno di attenzioni'; }
  return { score: Math.round(score), status, color, emoji, label };
}

// Trend: confronto punti periodo corrente vs precedente
export function computeTrend(log, choresById, userId, days = 7) {
  const now = new Date();
  const startCur = new Date(now); startCur.setDate(startCur.getDate() - days); startCur.setHours(0, 0, 0, 0);
  const startPrev = new Date(startCur); startPrev.setDate(startPrev.getDate() - days);
  let cur = 0, prev = 0;
  log.filter((e) => e.userId === userId).forEach((e) => {
    const ts = new Date(e.timestamp);
    if (ts >= startCur) cur += pointsForEntry(e, choresById);
    else if (ts >= startPrev && ts < startCur) prev += pointsForEntry(e, choresById);
  });
  let pct = 0;
  if (prev === 0 && cur > 0) pct = 100;
  else if (prev > 0) pct = Math.round(((cur - prev) / prev) * 100);
  return { cur, prev, pct };
}

// Distribuzione per fascia oraria
export function hourDistribution(log, userId) {
  const slots = { Mattina: 0, Pomeriggio: 0, Sera: 0, Notte: 0 };
  log.filter((e) => e.userId === userId).forEach((e) => {
    const h = new Date(e.timestamp).getHours();
    if (h >= 6 && h < 12) slots.Mattina++;
    else if (h >= 12 && h < 18) slots.Pomeriggio++;
    else if (h >= 18 && h < 23) slots.Sera++;
    else slots.Notte++;
  });
  return slots;
}

// Radar per categoria (conteggio per categoria, per utente)
export function categoryRadar(log, choresById, users, categories = CATEGORIES) {
  return categories.map((cat) => {
    const row = { category: cat };
    users.forEach((u) => {
      row[u.name] = log.filter((e) => e.userId === u.id && choreNameForEntry(e, choresById).category === cat).length;
    });
    return row;
  });
}

// Stagione corrente (per badge e tema)
export function currentSeason(d = new Date()) {
  const m = d.getMonth();
  if (m >= 2 && m <= 4) return { id: 'spring', name: 'Primavera', emoji: '🌸', colors: { coral: '#FF8FAB', accent: '#7CCB7B' } };
  if (m >= 5 && m <= 7) return { id: 'summer', name: 'Estate', emoji: '☀️', colors: { coral: '#FF9F45', accent: '#22D3EE' } };
  if (m >= 8 && m <= 10) return { id: 'autumn', name: 'Autunno', emoji: '🍂', colors: { coral: '#E07856', accent: '#FFB627' } };
  return { id: 'winter', name: 'Inverno', emoji: '❄️', colors: { coral: '#5B8DEF', accent: '#A78BFA' } };
}

// Messaggio motivazionale basato sui dati reali dell'utente
export function motivationalMessage(log, choresById, userId, otherId, users) {
  const me = users.find((u) => u.id === userId);
  const streak = computeStreak(log, userId);
  const myTotal = log.filter((e) => e.userId === userId).reduce((s, e) => s + pointsForEntry(e, choresById), 0);
  const otherTotal = otherId ? log.filter((e) => e.userId === otherId).reduce((s, e) => s + pointsForEntry(e, choresById), 0) : 0;
  const todayCount = log.filter((e) => e.userId === userId && e.date === todayStr()).length;
  const lvl = getLevel(myTotal);

  const msgs = [];
  if (todayCount === 0) msgs.push("Non hai ancora fatto nulla oggi. Inizia con un piccolo lavoro! 💪");
  if (streak >= 3) msgs.push(`Sei in serie da ${streak} giorni! Non spezzarla ora 🔥`);
  if (otherId && myTotal < otherTotal) {
    const diff = otherTotal - myTotal;
    msgs.push(`Sei indietro di ${diff} punti. Tempo di recuperare! 😏`);
  } else if (otherId && myTotal > otherTotal && otherTotal > 0) {
    msgs.push(`Sei in testa! Mantieni il vantaggio 👑`);
  }
  if (lvl.next) {
    const toNext = lvl.next.min - myTotal;
    if (toNext <= 30 && toNext > 0) msgs.push(`Ti mancano solo ${toNext} punti per "${lvl.next.title}" ${lvl.next.emoji}`);
  }
  if (todayCount >= 3) msgs.push(`${todayCount} lavori oggi! Sei inarrestabile 🚀`);
  if (msgs.length === 0) msgs.push("Ogni piccolo gesto rende la casa migliore ✨");

  // sceglie un messaggio in modo deterministico per la giornata
  const seed = parseInt(todayStr().split('-').join(''), 10) + userId.length;
  return msgs[seed % msgs.length];
}
