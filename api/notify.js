// Funzione serverless (gira su Vercel, non nel telefono) che spedisce le
// notifiche push. È qui e non nell'app perché la firma richiede la chiave
// privata VAPID, che non deve mai finire dentro il codice scaricato dai
// telefoni.
//
// Richiede due variabili d'ambiente impostate su Vercel:
//   VAPID_PUBLIC_KEY  · VAPID_PRIVATE_KEY
//
// NIENTE chiave di amministratore qui: da quando ogni casa ha la sua riga
// protetta da RLS, questa funzione legge Supabase usando il token di chi
// la chiama (che l'app allega alla richiesta). Chi chiama è già membro
// della propria casa, quindi l'RLS gli lascia leggere quella riga e
// nessun'altra — la stessa garanzia di prima, senza però che giri da
// nessuna parte una chiave che scavalca tutti i permessi.
//
// Le iscrizioni dei due telefoni NON arrivano comunque dal client: le
// rilegge da sé da Supabase, così chi chiama non deve (e non può)
// maneggiare i dati di iscrizione dell'altra persona.

import webpush from 'web-push';

const SUPABASE_URL = 'https://qtocmomtqsazerqikjrc.supabase.co';
const SUPABASE_KEY = 'sb_publishable_H9m9tPwK7vC3116wU9SPKg_42ODMYul';
const TABLE = 'household_data';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Metodo non consentito' });
  }

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    return res.status(500).json({ error: 'Chiavi VAPID non configurate su Vercel' });
  }
  webpush.setVapidDetails('mailto:asiavicolii@gmail.com', publicKey, privateKey);

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const { householdId, toUserId, title, message, url, tag } = body || {};
  if (!householdId || !toUserId || !title) {
    return res.status(400).json({ error: 'Servono almeno householdId, toUserId e title' });
  }

  // Il token di chi sta chiamando: è ciò che ci autorizza a leggere la sua
  // casa e SOLO quella (ci pensa l'RLS). Senza, non si va avanti.
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Manca il token di accesso' });
  }

  // Leggo le iscrizioni dal documento della casa che ha chiamato
  let subs = [];
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}?id=eq.${encodeURIComponent(householdId)}&select=value`, {
      headers: { apikey: SUPABASE_KEY, Authorization: auth },
    });
    if (!r.ok) throw new Error(`Supabase ha risposto ${r.status}`);
    const rows = await r.json();
    // Nessuna riga = il chiamante non fa parte di quella casa (l'RLS gliela
    // nasconde): non è un errore da spiegare, semplicemente non si spedisce.
    const value = rows && rows[0] && rows[0].value;
    subs = ((value && value.pushSubscriptions) || []).filter((s) => s.userId === toUserId);
  } catch (e) {
    return res.status(502).json({ error: 'Non riesco a leggere le iscrizioni', detail: String(e) });
  }

  if (subs.length === 0) return res.status(200).json({ sent: 0, failed: [], note: 'nessun telefono iscritto' });

  const payload = JSON.stringify({
    title,
    body: message || '',
    url: url || '/',
    tag: tag || 'casa-points',
  });

  let sent = 0;
  const failed = [];   // iscrizioni non più valide: il client le ripulirà
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, payload);
      sent += 1;
    } catch (e) {
      // 404/410 = il telefono ha disinstallato o revocato: da rimuovere
      if (e && (e.statusCode === 404 || e.statusCode === 410)) failed.push(s.endpoint);
    }
  }));

  return res.status(200).json({ sent, failed });
}
