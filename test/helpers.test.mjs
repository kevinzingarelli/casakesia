// Prove automatiche sulle funzioni di calcolo (nessun browser, nessun database).
// Si lanciano con:  npm test
import { pointsForEntry, recurringStatus } from '../src/helpers.js';

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

console.log(`\n${pass} passati, ${fail} falliti`);
process.exit(fail ? 1 : 0);
