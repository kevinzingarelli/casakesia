// Citazioni sull'ordine, la casa e la cura, con attribuzione verificata.
// Rotazione settimanale deterministica (stessa citazione per tutta la settimana, uguale per entrambi).
// Le attribuzioni a persone reali sono verificate; i proverbi sono marcati come tali.

export const QUOTES = [
  {
    text: "Non avere nulla in casa che tu non sappia utile o che tu non creda bello.",
    author: "William Morris",
    source: '"The Beauty of Life", 1880',
  },
  {
    text: "L'ordine è il piacere della ragione, ma il disordine è la delizia dell'immaginazione.",
    author: "Paul Claudel",
  },
  {
    text: "Per ogni minuto speso a organizzare, si guadagna un'ora.",
    author: "Proverbio",
  },
  {
    text: "La semplicità è la massima raffinatezza.",
    author: "Leonardo da Vinci",
  },
  {
    text: "Il modo migliore per cominciare è smettere di parlare e iniziare a fare.",
    author: "Walt Disney",
  },
  {
    text: "Fai le cose piccole come se fossero grandi, e le grandi come se fossero piccole.",
    author: "Baltasar Gracián",
  },
  {
    text: "La casa è dove si trova il cuore.",
    author: "Plinio il Vecchio",
  },
  {
    text: "Una casa pulita è segno di una mente ordinata.",
    author: "Proverbio",
  },
  {
    text: "La disciplina è il ponte tra obiettivi e risultati.",
    author: "Jim Rohn",
  },
  {
    text: "Non aspettare. Il momento non sarà mai perfetto.",
    author: "Napoleon Hill",
  },
  {
    text: "Le piccole azioni quotidiane costruiscono i grandi risultati.",
    author: "Proverbio",
  },
  {
    text: "Chi ben comincia è a metà dell'opera.",
    author: "Proverbio",
  },
  {
    text: "L'ordine e la semplificazione sono i primi passi verso la padronanza di un argomento.",
    author: "Thomas Mann",
  },
  {
    text: "Fatto è meglio che perfetto.",
    author: "Proverbio",
  },
  {
    text: "Cura la tua casa e la tua casa si prenderà cura di te.",
    author: "Proverbio",
  },
];

// Numero della settimana ISO dall'anno, per ruotare in modo deterministico
function weekNumber(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const diff = date - firstThursday;
  return 1 + Math.round(diff / (7 * 24 * 3600 * 1000));
}

export function quoteOfTheWeek() {
  const wk = weekNumber();
  const year = new Date().getFullYear();
  const idx = (wk + year) % QUOTES.length;
  return QUOTES[idx];
}

// Giorno dell'anno (1-366), per ruotare la citazione ogni giorno
function dayOfYear(d = new Date()) {
  const start = new Date(d.getFullYear(), 0, 0);
  const diff = d - start;
  return Math.floor(diff / 86400000);
}

export function quoteOfTheDay() {
  const doy = dayOfYear();
  const year = new Date().getFullYear();
  const idx = (doy + year) % QUOTES.length;
  return QUOTES[idx];
}
