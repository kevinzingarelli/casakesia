// Dati finti per la modalità demo (?demo=1): non toccano mai Supabase, così
// si può far provare l'app a chiunque — anche a chi valuta se comprarla —
// senza esporre i dati veri di una coppia reale.
import { DEFAULT_CHORES, CATEGORIES } from './helpers';

const DEMO_USERS = [
  { id: 'd1', name: 'Marco', color: '#FF6B6B' },
  { id: 'd2', name: 'Giulia', color: '#FFA94D' },
];

// Genera 5 settimane di storico plausibile: entrambi attivi quasi ogni
// giorno, con qualche buco realistico, così le statistiche non sono vuote.
function buildDemoLog() {
  const log = [];
  const today = new Date();
  const choresByCat = DEFAULT_CHORES;
  let seed = 42;
  const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };

  for (let daysAgo = 34; daysAgo >= 0; daysAgo--) {
    const d = new Date(today); d.setDate(d.getDate() - daysAgo);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    DEMO_USERS.forEach((u, ui) => {
      // ~85% di probabilità di aver fatto qualcosa quel giorno
      if (rand() < 0.15) return;
      const n = 1 + Math.floor(rand() * 3);
      for (let i = 0; i < n; i++) {
        const chore = choresByCat[Math.floor(rand() * choresByCat.length)];
        const hour = 8 + Math.floor(rand() * 13);
        const ts = new Date(d); ts.setHours(hour, Math.floor(rand() * 60), i * 7, 0);
        log.push({
          id: `demo-${daysAgo}-${ui}-${i}`,
          userId: u.id,
          choreId: chore.id,
          subtaskId: null,
          snapshotPoints: chore.points,
          snapshotName: chore.name,
          snapshotEmoji: chore.emoji,
          snapshotCategory: chore.category,
          timestamp: ts.toISOString(),
          date: dateStr,
          dedicatedTo: null,
        });
      }
    });
  }
  return log.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export function buildDemoData() {
  return {
    users: DEMO_USERS,
    chores: DEFAULT_CHORES,
    log: buildDemoLog(),
    version: 9,
    coupleGoal: { target: 2000, deadline: null, createdAt: '2026-07-01' },
    vacations: {},
    penaltiesOn: false,
    customCategories: [],
    categories: [...CATEGORIES],
    rewards: [
      { id: 'demo-r1', title: 'Cena fuori', emoji: '🍽️', type: 'couple', target: 500, claimed: false },
    ],
    savedQuotes: [],
    excused: {},
    gifts: [
      { id: 'demo-g1', name: 'Massaggio di 20 minuti', emoji: '💆', monthlyLimit: 3 },
      { id: 'demo-g2', name: 'Abbraccio', emoji: '🤗' },
      { id: 'demo-g3', name: 'Cena a sorpresa', emoji: '🍽️' },
    ],
    giftRequests: [
      { id: 'demo-gr1', giftId: 'demo-g2', snapshotName: 'Abbraccio', snapshotEmoji: '🤗', fromUserId: 'd2', toUserId: 'd1', date: new Date().toISOString().slice(0, 10), note: '', status: 'pending', createdAt: new Date().toISOString() },
    ],
    pushSubscriptions: [],
  };
}
