// Generazione suoni via Web Audio API — nessun file esterno necessario.
// Ogni completamento produce un suono diverso in base ai punti guadagnati,
// nel timbro scelto dall'utente nelle impostazioni.

let audioCtx = null;

function getCtx() {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      return null;
    }
  }
  // iOS sospende il contesto finché non c'è interazione: lo riattiviamo.
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  return audioCtx;
}

function playNote(ctx, freq, startTime, duration, type = 'sine', gainValue = 0.15) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(gainValue, startTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration);
}

// I cinque timbri scelti dalle impostazioni.
// Ogni pacchetto definisce: onda, volume, durata e passo fra le note, e le
// quattro melodie usate in base ai punti del lavoro (più punti = più ricca).
const PACKS = {
  classico: {
    wave: 'sine', waveBig: 'triangle', gain: 0.15, dur: 0.22, step: 0.08,
    big: [523.25, 659.25, 783.99, 1046.5],
    mid: [523.25, 659.25, 783.99],
    small: [587.33, 880],
    tiny: [783.99],
    achievement: [659.25, 783.99, 1046.5, 1318.51],
    levelUp: [392, 523.25, 659.25, 783.99, 1046.5],
  },
  morbido: {
    wave: 'sine', waveBig: 'sine', gain: 0.11, dur: 0.4, step: 0.13,
    big: [329.63, 392, 493.88, 587.33],
    mid: [329.63, 440, 523.25],
    small: [392, 523.25],
    tiny: [440],
    achievement: [392, 493.88, 587.33, 698.46],
    levelUp: [261.63, 329.63, 392, 493.88, 587.33],
  },
  cristallo: {
    wave: 'triangle', waveBig: 'triangle', gain: 0.1, dur: 0.5, step: 0.06,
    big: [1046.5, 1318.51, 1567.98, 2093],
    mid: [1046.5, 1396.91, 1760],
    small: [1318.51, 1975.53],
    tiny: [1567.98],
    achievement: [1318.51, 1567.98, 2093, 2637],
    levelUp: [783.99, 1046.5, 1318.51, 1567.98, 2093],
  },
  retro: {
    wave: 'square', waveBig: 'square', gain: 0.06, dur: 0.1, step: 0.05,
    big: [523.25, 659.25, 783.99, 1046.5, 1318.51],
    mid: [659.25, 987.77, 1318.51],
    small: [987.77, 1318.51],
    tiny: [880],
    achievement: [523.25, 783.99, 1046.5, 1568],
    levelUp: [392, 523.25, 659.25, 783.99, 1046.5, 1318.51],
  },
  marimba: {
    wave: 'triangle', waveBig: 'triangle', gain: 0.18, dur: 0.14, step: 0.09,
    big: [349.23, 440, 523.25, 698.46],
    mid: [349.23, 466.16, 587.33],
    small: [440, 659.25],
    tiny: [523.25],
    achievement: [440, 587.33, 698.46, 880],
    levelUp: [261.63, 349.23, 440, 523.25, 698.46],
  },
};

export const DEFAULT_PACK = 'classico';

// Elenco per le impostazioni
export const SOUND_PACKS = [
  { id: 'classico', name: 'Classico', emoji: '🎵', desc: 'Il suono di sempre' },
  { id: 'morbido', name: 'Morbido', emoji: '🫧', desc: 'Delicato, poco invadente' },
  { id: 'cristallo', name: 'Cristallo', emoji: '🔔', desc: 'Campanellini luminosi' },
  { id: 'retro', name: 'Retrò', emoji: '🕹️', desc: 'Stile videogioco' },
  { id: 'marimba', name: 'Marimba', emoji: '🪵', desc: 'Legno caldo e ovattato' },
];

function getPack(packId) {
  return PACKS[packId] || PACKS[DEFAULT_PACK];
}

function playSequence(ctx, notes, p, { wave, gain, dur, step } = {}) {
  const now = ctx.currentTime;
  const w = wave || p.wave;
  const g = gain != null ? gain : p.gain;
  const d = dur != null ? dur : p.dur;
  const s = step != null ? step : p.step;
  notes.forEach((f, i) => playNote(ctx, f, now + i * s, d, w, g));
}

// Suono in base ai punti: più punti = melodia più ricca e gratificante.
export function playCompletionSound(points, soundEnabled, packId = DEFAULT_PACK) {
  if (!soundEnabled) return;
  const ctx = getCtx();
  if (!ctx) return;
  const p = getPack(packId);

  if (points >= 25) playSequence(ctx, p.big, p, { wave: p.waveBig, gain: p.gain * 1.15, dur: p.dur * 1.4 });
  else if (points >= 15) playSequence(ctx, p.mid, p, { gain: p.gain * 1.05 });
  else if (points >= 8) playSequence(ctx, p.small, p);
  else playSequence(ctx, p.tiny, p);
}

// Suono speciale per sblocco traguardo
export function playAchievementSound(soundEnabled, packId = DEFAULT_PACK) {
  if (!soundEnabled) return;
  const ctx = getCtx();
  if (!ctx) return;
  const p = getPack(packId);
  playSequence(ctx, p.achievement, p, { wave: p.waveBig, gain: p.gain * 1.05, dur: p.dur * 1.5, step: p.step * 1.25 });
}

// Suono per il "level up"
export function playLevelUpSound(soundEnabled, packId = DEFAULT_PACK) {
  if (!soundEnabled) return;
  const ctx = getCtx();
  if (!ctx) return;
  const p = getPack(packId);
  playSequence(ctx, p.levelUp, p, { wave: p.waveBig, gain: p.gain * 1.1, dur: p.dur * 1.6, step: p.step * 1.15 });
}

// Anteprima nelle impostazioni: fa sentire il timbro senza dover fare un lavoro
export function playPackPreview(packId) {
  const ctx = getCtx();
  if (!ctx) return;
  const p = getPack(packId);
  playSequence(ctx, p.mid, p, { gain: p.gain * 1.05 });
}

// Vibrazione (haptic) su dispositivi che la supportano
export function vibrate(pattern = 15) {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try { navigator.vibrate(pattern); } catch (e) {}
  }
}
