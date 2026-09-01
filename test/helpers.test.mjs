// Prove automatiche sulle funzioni di calcolo (nessun browser, nessun database).
// Si lanciano con:  npm test
import { pointsForEntry, recurringStatus, dedupeData, weeklyChallenge, todayStr, startOfWeek } from '../src/helpers.js';

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name}`, extra !== undefined ? JSON.stringify(extra) : ''); }
}

// --- Correzione manuale di una voce dello Storico (pointsOverride) ---
{
  const choresById = { c1: { id: 'c1', points: 10 } };
  const voce = { id: 'e1', choreId: 'c1', subtaskId: null, snapshotPoints: 10, date: '2026-08-01' };
  check('senza correzione usa i punti attuali del lavoro', pointsForEntry(voce, choresById) === 10);

  const corretta = { ...voce, pointsOverride: 35 };
  check('la correzione vince sui punti del lavoro', pointsForEntry(corretta, choresById) === 35);
  check('la correzione resiste se il lavoro cambia punti dopo', pointsForEntry(corretta, { c1: { id: 'c1', points: 99 } }) === 35);
  check('la correzione vale anche se il lavoro è stato eliminato', pointsForEntry(corretta, {}) === 35);
  check('correzione a 0 è valida (non scambiata per "nessuna correzione")', pointsForEntry({ ...voce, pointsOverride: 0 }, choresById) === 0);
}

// --- Ricorrenza a giorni fissi della settimana ---
{
  const oggi = new Date(); oggi.setHours(0, 0, 0, 0);
  const giornoDiOggi = oggi.getDay();
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const lavoro = { id: 'cw', recurrence: { weekdays: [giornoDiOggi] } };
  const fattoOggi = [{ id: 'a', choreId: 'cw', date: iso(oggi), timestamp: oggi.toISOString() }];
  const s1 = recurringStatus(lavoro, fattoOggi);
  check('fatto oggi nel suo giorno fisso → a posto, 7 giorni al prossimo', s1.status === 'ok' && s1.daysLeft === 7, s1);

  const s2 = recurringStatus(lavoro, []);
  check('mai fatto e oggi è il giorno fisso → in ritardo', s2.status === 'overdue' && s2.daysLeft === 0, s2);

  const domani = (giornoDiOggi + 1) % 7;
  const s3 = recurringStatus({ id: 'cw2', recurrence: { weekdays: [domani] } }, []);
  check('giorno fisso domani → in scadenza fra 1 giorno', s3.status === 'due' && s3.daysLeft === 1, s3);

  const s4 = recurringStatus({ id: 'cd', recurrence: { days: 3 } }, []);
  check('la ricorrenza "ogni N giorni" continua a funzionare come prima', s4.status === 'due' && s4.every === 3, s4);
}

// --- Nessun doppione può essere salvato (il bug dei punti raddoppiati) ---
{
  const conDoppioni = {
    log: [
      { id: 'riporto-kenin-909', pointsOverride: 909 },
      { id: 'a', snapshotPoints: 10 },
      { id: 'riporto-kenin-909', pointsOverride: 909 },
    ],
    chores: [{ id: 'c1' }, { id: 'c1' }, { id: 'c2' }],
    users: [{ id: 'u1' }, { id: 'u2' }],
  };
  const pulito = dedupeData(conDoppioni);
  check('lo storico perde il doppione', pulito.log.length === 2);
  check('resta la PRIMA occorrenza', pulito.log[0].id === 'riporto-kenin-909' && pulito.log[1].id === 'a');
  check('vale anche per i lavori', pulito.chores.length === 2);
  check('le liste già pulite non vengono toccate', pulito.users.length === 2);

  const somma = (arr) => arr.reduce((s, e) => s + (e.pointsOverride ?? e.snapshotPoints ?? 0), 0);
  check('i punti non sono più contati due volte', somma(pulito.log) === 919, somma(pulito.log));

  const giaPulito = { log: [{ id: 'a' }, { id: 'b' }] };
  check('senza doppioni restituisce lo stesso oggetto (nessun lavoro inutile)', dedupeData(giaPulito) === giaPulito);
  check('voci senza id vengono conservate', dedupeData({ log: [{}, {}] }).log.length === 2);
  check('dati vuoti o strani non fanno esplodere nulla', dedupeData(null) === null && dedupeData({}).log === undefined);
}

// --- Sfida della settimana ---
{
  const monday = todayStr(startOfWeek());
  const chores = { c1: { id: 'c1', points: 10, category: 'Cucina' }, c2: { id: 'c2', points: 5, category: 'Pulizia' } };
  const users = [{ id: 'u1' }, { id: 'u2' }];
  const cats = ['Cucina', 'Pulizia', 'Bucato'];
  const log = [
    { id: 'a', userId: 'u1', choreId: 'c1', date: monday, snapshotPoints: 10 },       // conta se la categoria è Cucina
    { id: 'b', userId: 'u2', choreId: 'c2', date: monday, snapshotPoints: 5 },        // Pulizia
    { id: 'c', userId: 'u1', choreId: 'c1', date: '2020-01-01', snapshotPoints: 10 }, // settimana vecchia: mai
  ];
  const s1 = weeklyChallenge(log, chores, cats, users);
  const s2 = weeklyChallenge(log, chores, cats, users);
  check('la sfida esiste con 2 utenti e categorie', !!s1);
  check('stessa settimana → stessa categoria (deterministica)', s1.category === s2.category);
  check('conta solo la settimana corrente', (s1.points.u1 + s1.points.u2) <= 15);
  const attesi = s1.category === 'Cucina' ? { u1: 10, u2: 0 } : s1.category === 'Pulizia' ? { u1: 0, u2: 5 } : { u1: 0, u2: 0 };
  check('punti giusti per la categoria estratta', s1.points.u1 === attesi.u1 && s1.points.u2 === attesi.u2, JSON.stringify(s1));
  check('giorni rimasti fra 0 e 6', s1.daysLeft >= 0 && s1.daysLeft <= 6);
  check('senza secondo utente niente sfida', weeklyChallenge(log, chores, cats, [{ id: 'u1' }]) === null);
}

console.log(`\n${pass} passati, ${fail} falliti`);
process.exit(fail ? 1 : 0);
