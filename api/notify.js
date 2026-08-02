// Funzione serverless (gira su Vercel, non nel telefono) che spedisce le
// notifiche push. È qui e non nell'app perché la firma richiede la chiave
// privata VAPID, che non deve mai finire dentro il codice scaricato dai
// telefoni.
//
// Richiede due variabili d'ambiente impostate su Vercel:
//   VAPID_PUBLIC_KEY  · VAPID_PRIVATE_KEY
//
// Le iscrizioni dei due telefoni NON arrivano dal client: le rilegge da sé
// da Supabase, così chi chiama non deve (e non può) maneggiare i dati di
// iscrizione dell'altra persona.

import webpush from 'web-push';

const SUPABASE_URL = 'https://qtocmomtqsazerqikjrc.supabase.co';
const SUPABASE_KEY = 'sb_publishable_H9m9tPwK7vC3116wU9SPKg_42ODMYul';
const TABLE = 'household_data';
const ROW_ID = 'main';

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
  const { toUserId, title, message, url, tag } = body || {};
  if (!toUserId || !title) {
    return res.status(400).json({ error: 'Servono almeno toUserId e title' });
  }

  // Leggo le iscrizioni dal documento condiviso
  let subs = [];
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}?id=eq.${ROW_ID}&select=value`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!r.ok) throw new Error(`Supabase ha risposto ${r.status}`);
    const rows = await r.json();
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
