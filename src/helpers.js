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

// Tema chiaro/scuro
export function theme(dark) {
  return {
    bg: dark ? PALETTE.bgDark : PALETTE.bg,
    card: dark ? PALETTE.cardDark : PALETTE.card,
    text: dark ? '#F0EEF7' : PALETTE.plum,
    textSoft: dark ? '#A8A3C0' : PALETTE.plumSoft,
    line: dark ? PALETTE.lineDark : PALETTE.line,
    coral: PALETTE.coral,
    mint: PALETTE.mint,
    lavender: PALETTE.lavender,
    sunny: PALETTE.sunny,
  };
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
  if (chore) return chore.points;
  return entry.snapshotPoints || 0; // lavoro eliminato: usa il valore storico
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
export function computeStreak(log, userId) {
  const days = new Set(log.filter((e) => e.userId === userId).map((e) => e.date));
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
  return streak;
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
