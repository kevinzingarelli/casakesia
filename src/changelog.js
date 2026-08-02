// Novità dell'app, dalla più recente.
// Ogni voce ha la sua spunta "Letto": il pallino rosso sulla campanella
// resta finché non sono state lette tutte.
//
// Quando si pubblica un aggiornamento: alza CURRENT_VERSION e aggiungi una
// voce in cima. Il numero finisce anche in dist/version.json (vedi
// vite.config.js), che è ciò che l'app confronta per accorgersi che sul
// telefono sta girando una versione vecchia.

export const CURRENT_VERSION = '15';

export const CHANGELOG = [
  {
    version: '15',
    date: '2026-08-02',
    time: '19:30',
    title: 'Nuovo look in stile iPhone, statistiche sui regali, app più veloce',
    items: [
      'NUOVO ASPETTO: via le emoji, dentro icone vere e pulite su tessere sfumate, come le categorie dell\'app Salute di iPhone. Vale per lavori, regali, traguardi, milestone e titoli delle sezioni',
      'I vostri avatar ora sono l\'iniziale del nome nel vostro colore, come i contatti iPhone. Il colore si sceglie nelle Opzioni',
      'In Stats c\'è la nuova sezione Regali: quanti richiesti, consegnati, percentuale di accettazione, chi chiede di più e il regalo più gettonato',
      'L\'app si apre molto più in fretta: i grafici si scaricano solo quando apri Stats, non al primo avvio (quasi metà del peso in meno)',
      'Sistemato il pulsante «Non posso» nelle richieste di regalo, che aveva un doppio bordo',
    ],
  },
  {
    version: '14',
    date: '2026-08-02',
    time: '18:00',
    title: 'Regali "buono mensile"',
    items: [
      'Ora un regalo del catalogo può avere un numero massimo di richieste al mese — utile per cose come "3 massaggi al mese": finiti quelli, il pulsante diventa «Esaurito» finché non inizia il mese dopo',
      'Si imposta col ✏️ sul regalo, o quando se ne aggiunge uno nuovo: basta attivare «Buono mensile» e scegliere quante volte',
      'Una richiesta rifiutata non consuma il buono: si può richiedere di nuovo',
      'I regali senza buono restano come prima: si possono chiedere quante volte si vuole',
    ],
  },
  {
    version: '13',
    date: '2026-08-02',
    time: '16:00',
    title: 'Notifiche anche per traguardi e livelli',
    items: [
      'Quando sblocchi un traguardo o sali di livello, l\'altra persona lo scopre subito con una notifica — non serve più aprire l\'app per fare il tifo',
      'Non arriva una notifica per ogni singolo lavoro segnato: solo per questi momenti importanti, così restano un\'aggiunta piacevole e non un fastidio',
    ],
  },
  {
    version: '12',
    date: '2026-08-02',
    time: '14:30',
    title: 'Notifiche sul telefono per i regali',
    items: [
      'Quando ti chiedono un regalo ora arriva una notifica sul telefono, senza dover tenere l\'app aperta. Arriva anche quando l\'altra persona accetta, rifiuta o ti consegna il regalo',
      'Si attivano dalle Opzioni, una volta per telefono, con il pulsante «Attiva le notifiche»',
      'IMPORTANTE su iPhone: le notifiche funzionano solo se l\'app è stata aggiunta alla schermata Home (Condividi → Aggiungi a Home) e aperta da lì. In Safari come sito normale iOS non le permette proprio',
      'L\'icona dell\'app sulla schermata Home ora si vede come si deve: prima era in un formato che iPhone non sa disegnare',
    ],
  },
  {
    version: '11',
    date: '2026-08-02',
    time: '12:30',
    title: 'Regali, suoni a scelta e questa finestrella',
    items: [
      'NUOVA SEZIONE «Regali»: potete chiedervi coccole e sorprese a vicenda — un massaggio, un abbraccio, una cena, una vacanza. Si sceglie il regalo e il giorno, e l\'altra persona accetta o rifiuta quella richiesta',
      'Nei regali c\'è un catalogo già pronto con dei suggerimenti, e potete aggiungerne di vostri quando volete',
      'Ogni richiesta lascia traccia nello storico: cosa è stato chiesto, quando, e com\'è andata a finire',
      'I lavori con sotto-task si possono segnare direttamente dalla lista: se hai fatto solo «Pulizia filtri» ora basta un tocco, senza passare dal lavoro principale',
      'Nelle Opzioni puoi scegliere fra 5 suoni diversi per quando segni un lavoro, con l\'anteprima per sentirli prima di decidere',
      'Questa finestrella: da qui vedi cosa è cambiato nell\'app, quando, e puoi spuntare «Letto» per ricordarti cosa hai già visto',
    ],
  },
  {
    version: '10',
    date: '2026-08-02',
    time: '11:05',
    title: 'Rete di sicurezza contro le schermate bianche',
    items: [
      'Se qualcosa va storto nell\'app non si vede più una pagina bianca: compare un avviso con il pulsante per ricaricare, e i dati restano al sicuro sul server',
      'Le date non possono più sfasarsi di un giorno in Storico, Serie e Statistiche quando siete fuori dall\'Italia',
      'Il numero della serie in cima e le «serie più lunghe» qui sotto ora raccontano la stessa cosa: prima la giornata di oggi ancora aperta veniva contata solo in uno dei due punti',
      'La condivisione della settimana non può più bloccare l\'app se il telefono non riesce a generare l\'immagine',
    ],
  },
  {
    version: '9',
    date: '2026-08-02',
    time: '10:42',
    title: 'Niente più lavori che spariscono',
    items: [
      'Se segnate un lavoro nello stesso momento da due telefoni, non se ne perde più nessuno: le due modifiche si uniscono invece di sovrascriversi',
      'Se cade la rete mentre segni qualcosa, la modifica viene messa da parte sul telefono e l\'app riprova da sola finché non ci riesce (prima spariva in silenzio)',
      'Segnare un lavoro e chiudere subito l\'app non lo fa più perdere',
      'Il traguardo della settimana perfetta ora tiene conto dei giorni giustificati',
      'L\'anteprima dei widget iOS, che era scritta ma irraggiungibile, ora si apre dalle Opzioni',
      'Non si possono più impostare punti negativi su un lavoro',
    ],
  },
];

const READ_KEY = 'casa-points-news-read';

function readVersions() {
  try {
    const arr = JSON.parse(localStorage.getItem(READ_KEY) || 'null');
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

export function isVersionRead(version) {
  return readVersions().has(version);
}

export function setVersionRead(version, read) {
  const s = readVersions();
  if (read) s.add(version);
  else s.delete(version);
  try { localStorage.setItem(READ_KEY, JSON.stringify([...s])); } catch {}
}

export function unreadCount() {
  const s = readVersions();
  return CHANGELOG.filter((v) => !s.has(v.version)).length;
}

export function markAllRead() {
  const s = readVersions();
  CHANGELOG.forEach((v) => s.add(v.version));
  try { localStorage.setItem(READ_KEY, JSON.stringify([...s])); } catch {}
}
