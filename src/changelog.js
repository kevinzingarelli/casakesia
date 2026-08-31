// Novità dell'app, dalla più recente.
// Ogni voce ha la sua spunta "Letto": il pallino rosso sulla campanella
// resta finché non sono state lette tutte.
//
// Quando si pubblica un aggiornamento: alza CURRENT_VERSION e aggiungi una
// voce in cima. Il numero finisce anche in dist/version.json (vedi
// vite.config.js), che è ciò che l'app confronta per accorgersi che sul
// telefono sta girando una versione vecchia.

export const CURRENT_VERSION = '23';

export const CHANGELOG = [
  {
    version: '23',
    date: '2026-08-14',
    time: '23:30',
    title: 'L\'app sa chi sei, e la password si può recuperare',
    items: [
      'Al primo accesso l\'app chiede "Come ti chiami?" una volta sola e lega il nome al tuo account: da lì in poi ti riconosce su qualsiasi telefono, senza più "Persona 1 o Persona 2?"',
      'Per Kevin e Asia è già tutto collegato: non vedrete nessuna schermata in più',
      'Nella schermata di accesso c\'è finalmente "Password dimenticata?": arriva un\'email con il link per sceglierne una nuova',
      'Nelle Opzioni, la sezione "identità" mostra chi sei invece di chiederti di sceglierlo',
    ],
  },
  {
    version: '22',
    date: '2026-08-14',
    time: '23:20',
    title: 'Due protezioni sui tocchi',
    items: [
      'Un doppio tocco veloce su "L\'ho fatto io" non registra più il lavoro due volte (prima raddoppiava i punti senza che ve ne accorgeste)',
      'Il cestino nello Storico ora chiede conferma dicendo cosa state per eliminare e di chi è — prima un tocco sbagliato cancellava all\'istante anche i lavori dell\'altro, senza rimedio',
    ],
  },
  {
    version: '21',
    date: '2026-08-14',
    time: '22:55',
    title: 'Rifiniture: tocchi più facili e schermate più curate',
    items: [
      'I pulsanti matita e cestino (Storico, Regali, Ricompense, Obiettivo) ora hanno un\'area di tocco piena da 40 punti: prima erano così piccoli che capitava di mancarli o toccare quello sbagliato',
      'Le schermate vuote ("nessuna attività", "nessun lavoro trovato"…) hanno ora un\'icona e un suggerimento su cosa fare, invece di una riga grigia',
      'All\'apertura, al posto della scritta "Caricamento…" c\'è la sagoma della schermata che sta arrivando',
    ],
  },
  {
    version: '20',
    date: '2026-08-13',
    time: '18:40',
    title: 'Aspetto più ordinato e coerente',
    items: [
      'Testi e angoli arrotondati ora seguono una scala fissa: prima l\'app usava 21 dimensioni di testo e 16 raggi diversi scelti a occhio, ed è questo che la faceva sembrare disordinata anche quando ogni singolo pezzo era curato',
      'I titoli delle sezioni sono più discreti: il colore pieno resta alle tessere dei lavori, che sono il contenuto vero. Prima competevano fra loro e non risaltava nulla',
      'Nessuna funzione è cambiata: è solo questione di ordine visivo',
    ],
  },
  {
    version: '19',
    date: '2026-08-13',
    time: '18:05',
    title: 'Corretti punti contati due volte',
    items: [
      'Le due voci di "riporto storico" create durante il recupero dei dati risultavano inserite due volte, quindi i punti venivano contati doppi: erano 1818 invece di 909 e 3186 invece di 1593. Ora i totali sono corretti',
      'L\'app ora controlla a ogni salvataggio che non finiscano nello storico due voci identiche: se succede le scarta prima di scrivere, così un problema del genere non può ripetersi',
    ],
  },
  {
    version: '18',
    date: '2026-08-13',
    time: '17:29',
    title: 'Meno voci in basso, più chiarezza in Home',
    items: [
      'In basso ora ci sono 5 voci invece di 7: Storico, Serie e Stats sono confluite in una sola sezione "Progressi", con un selettore in alto per passare dall\'una all\'altra',
      'Nella Home, "Azioni rapide" (il gesto che usate più spesso) è più in alto, appena sotto i punteggi',
      'La casetta che mostra la salute della casa occupa molto meno spazio: l\'informazione resta, ma non ruba più la scena',
      'La citazione del giorno è scesa in fondo alla pagina ed è più piccola: è un tocco piacevole, non deve competere con quello che dovete fare',
    ],
  },
  {
    version: '17',
    date: '2026-08-02',
    time: '23:55',
    title: 'Account personali e case separate',
    items: [
      'Ora si entra con la propria email e password. Prima chiunque avesse il link vedeva i vostri punti: adesso i dati sono vostri e basta',
      'Ogni coppia ha la sua "casa" separata: chi si registra crea la casa e riceve un codice, l\'altra persona entra con quel codice. È il primo passo per poter dare l\'app anche ad altri',
      'Il codice d\'invito resta sempre visibile in Opzioni → La tua casa, insieme al pulsante per uscire dall\'account',
      'Le notifiche push continuano a funzionare come prima, ma ora il server controlla che tu faccia davvero parte della casa a cui stai scrivendo',
    ],
  },
  {
    version: '16',
    date: '2026-08-02',
    time: '23:39',
    title: 'Annulla, storico modificabile, giorni fissi per i lavori',
    items: [
      'Segnato un lavoro per sbaglio? Ora compare "Annulla" per qualche secondo subito dopo, senza dover cancellare la voce dallo storico',
      'Nello Storico ora si può correggere una voce già segnata (punti e data) con la matitina, non solo cancellarla',
      'I lavori ricorrenti si possono impostare anche su giorni fissi della settimana (es. "ogni lunedì e giovedì"), oltre al classico "ogni tot giorni"',
      'Se il telefono perde la connessione, l\'app ora mostra gli ultimi dati salvati invece di un errore bloccante, e riprova da sola quando torna la rete',
      'Aggiunto un suono quando si chiede un regalo, come già succede quando si segna un lavoro',
      'NUOVO: modalità dimostrativa per far provare l\'app a chi deve ancora decidere se comprarla — dati finti, nessuna scrittura sul database vero (si apre con ?demo=1 nel link)',
    ],
  },
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
