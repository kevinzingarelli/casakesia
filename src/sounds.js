// Generazione suoni via Web Audio API — nessun file esterno necessario.
// Ogni completamento produce un suono diverso in base ai punti guadagnati.

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
  if (audioCtx.state === 'suspended') audioCtx.resume();
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

// Suono in base ai punti: più punti = melodia più ricca e gratificante.
export function playCompletionSound(points, soundEnabled) {
  if (!soundEnabled) return;
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;

  if (points >= 25) {
    // Fanfara trionfale
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => playNote(ctx, f, now + i * 0.08, 0.3, 'triangle', 0.18));
    playNote(ctx, 1318.51, now + 0.32, 0.4, 'triangle', 0.12);
  } else if (points >= 15) {
    // Accordo ascendente medio
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((f, i) => playNote(ctx, f, now + i * 0.07, 0.25, 'sine', 0.16));
  } else if (points >= 8) {
    // Due note allegre
    playNote(ctx, 587.33, now, 0.18, 'sine', 0.15);
    playNote(ctx, 880, now + 0.08, 0.2, 'sine', 0.15);
  } else {
    // Ding singolo
    playNote(ctx, 783.99, now, 0.18, 'sine', 0.14);
  }
}

// Suono speciale per sblocco traguardo
export function playAchievementSound(soundEnabled) {
  if (!soundEnabled) return;
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  const notes = [659.25, 783.99, 1046.5, 1318.51];
  notes.forEach((f, i) => playNote(ctx, f, now + i * 0.1, 0.35, 'triangle', 0.16));
}

// Suono per il "level up"
export function playLevelUpSound(soundEnabled) {
  if (!soundEnabled) return;
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  const notes = [392, 523.25, 659.25, 783.99, 1046.5];
  notes.forEach((f, i) => playNote(ctx, f, now + i * 0.09, 0.4, 'triangle', 0.17));
}

// Vibrazione (haptic) su dispositivi che la supportano
export function vibrate(pattern = 15) {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try { navigator.vibrate(pattern); } catch (e) {}
  }
}
