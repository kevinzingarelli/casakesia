// Notifiche push — lato app.
//
// Su iPhone funzionano SOLO se l'app è stata aggiunta alla schermata Home
// (in Safari come sito normale non esistono), e il permesso va chiesto da un
// tocco dell'utente, non da solo all'avvio.

import { supabase } from './supabaseClient';

// Chiave pubblica VAPID: è pubblica per definizione, sta nel codice apposta.
// La corrispondente chiave privata vive solo fra le variabili d'ambiente di
// Vercel e non è mai scaricata dai telefoni.
export const VAPID_PUBLIC_KEY = 'BJjELiMlpwDE1H2XrH9-5BrkGMM37fc8owKot_YZc9pRf8h8OT_Y7XXLPISS4efG6vjC0ySImCE01OX_2tZa9nU';

export function pushSupported() {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

export function isIOS() {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

// "Installata" = aperta dall'icona sulla Home, non da una scheda del browser
export function isStandalone() {
  if (typeof window === 'undefined') return false;
  if (window.navigator.standalone === true) return true;
  return !!(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
}

// Perché le notifiche non sono (ancora) attivabili su questo dispositivo
export function pushBlockedReason() {
  if (!pushSupported()) {
    if (isIOS() && !isStandalone()) return 'ios-non-installata';
    return 'non-supportato';
  }
  if (isIOS() && !isStandalone()) return 'ios-non-installata';
  if (typeof Notification !== 'undefined' && Notification.permission === 'denied') return 'negato';
  return null;
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch (e) {
    console.error('Service worker non registrato', e);
    return null;
  }
}

export async function currentSubscription() {
  if (!pushSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return null;
    const sub = await reg.pushManager.getSubscription();
    return sub ? sub.toJSON() : null;
  } catch {
    return null;
  }
}

// Chiede il permesso e crea l'iscrizione. Va chiamata da un tocco.
export async function subscribeToPush() {
  if (!pushSupported()) return { ok: false, reason: 'non-supportato' };
  const reg = (await navigator.serviceWorker.getRegistration()) || (await registerServiceWorker());
  if (!reg) return { ok: false, reason: 'no-sw' };
  await navigator.serviceWorker.ready;

  let permission = Notification.permission;
  if (permission === 'default') permission = await Notification.requestPermission();
  if (permission !== 'granted') return { ok: false, reason: permission === 'denied' ? 'negato' : 'non-concesso' };

  try {
    const existing = await reg.pushManager.getSubscription();
    if (existing) return { ok: true, subscription: existing.toJSON() };
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
    return { ok: true, subscription: sub.toJSON() };
  } catch (e) {
    console.error('Iscrizione push fallita', e);
    return { ok: false, reason: 'errore', detail: String(e) };
  }
}

export async function unsubscribeFromPush() {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return null;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return null;
    const json = sub.toJSON();
    await sub.unsubscribe();
    return json;
  } catch {
    return null;
  }
}

// Chiede al server di spedire una notifica all'altra persona.
// Non blocca mai l'azione dell'utente: se fallisce, pazienza.
export async function sendPush({ householdId, toUserId, title, message, url, tag }) {
  if (!householdId || !toUserId || !title) return { sent: 0, failed: [] };
  try {
    // Il server legge le iscrizioni per conto nostro, con il NOSTRO token:
    // così non gli serve una chiave da amministratore e resta comunque
    // impossibile spedire notifiche a una casa che non è la nostra.
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { sent: 0, failed: [] };
    const res = await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ householdId, toUserId, title, message, url, tag }),
    });
    if (!res.ok) return { sent: 0, failed: [] };
    return await res.json();
  } catch (e) {
    return { sent: 0, failed: [] };
  }
}
