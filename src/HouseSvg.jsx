import React from 'react';
import { houseState } from './helpers';

// Casetta illustrata: cambia aspetto in base alla salute (0-100).
// level 0 trasandata → 4 splendente con stelline.
export default function HouseSvg({ score, t, size = 120 }) {
  const st = houseState(score);
  const lvl = st.level;

  // Colori che si "schiariscono" col livello
  const dull = lvl <= 1;
  const wallColor = dull ? '#C9BCA8' : lvl === 2 ? '#F2D9A8' : '#FFE3A3';
  const roofColor = dull ? '#9B7B6B' : lvl === 2 ? '#D98C6A' : t.coral;
  const doorColor = dull ? '#7A6A5A' : '#A0673E';
  const skyGlow = lvl >= 3;

  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Alone luminoso se pulita/splendente */}
      {skyGlow && (
        <circle cx="60" cy="58" r="50" fill={st.sparkle ? t.sunny : t.mint} opacity={st.sparkle ? 0.18 : 0.1} />
      )}

      {/* Terreno */}
      <ellipse cx="60" cy="104" rx="46" ry="8" fill={dull ? '#A89A86' : '#C8E6C9'} opacity="0.6" />

      {/* Corpo casa */}
      <rect x="28" y="56" width="64" height="46" rx="4" fill={wallColor} />
      {/* Tetto */}
      <path d="M22 58 L60 30 L98 58 Z" fill={roofColor} />
      {/* Comignolo */}
      <rect x="78" y="38" width="9" height="16" rx="2" fill={roofColor} opacity="0.85" />

      {/* Porta */}
      <rect x="52" y="76" width="16" height="26" rx="3" fill={doorColor} />
      <circle cx="64" cy="90" r="1.6" fill="#FFD166" />

      {/* Finestre */}
      <rect x="35" y="65" width="13" height="13" rx="2" fill={skyGlow ? '#BFE3FF' : '#9FB4C0'} />
      <rect x="72" y="65" width="13" height="13" rx="2" fill={skyGlow ? '#BFE3FF' : '#9FB4C0'} />
      <line x1="41.5" y1="65" x2="41.5" y2="78" stroke={wallColor} strokeWidth="1.4" />
      <line x1="35" y1="71.5" x2="48" y2="71.5" stroke={wallColor} strokeWidth="1.4" />
      <line x1="78.5" y1="65" x2="78.5" y2="78" stroke={wallColor} strokeWidth="1.4" />
      <line x1="72" y1="71.5" x2="85" y2="71.5" stroke={wallColor} strokeWidth="1.4" />

      {/* Stato 0-1: sporco — ragnatela, macchie, fumo grigio */}
      {lvl === 0 && (
        <>
          {/* Ragnatela angolo */}
          <path d="M28 56 L40 56 M28 56 L28 68 M28 56 L38 66" stroke="#6B6151" strokeWidth="0.8" opacity="0.7" />
          <path d="M30 58 Q34 58 34 62 Q34 58 38 58" stroke="#6B6151" strokeWidth="0.6" fill="none" opacity="0.6" />
          {/* Macchie */}
          <circle cx="44" cy="92" r="3" fill="#8A7B6A" opacity="0.5" />
          <circle cx="74" cy="88" r="2.4" fill="#8A7B6A" opacity="0.5" />
          {/* Erbaccia */}
          <path d="M24 102 Q22 96 25 94 M27 102 Q28 97 31 96" stroke="#7C8A4A" strokeWidth="1.4" fill="none" />
        </>
      )}
      {lvl === 1 && (
        <>
          <circle cx="46" cy="93" r="2.2" fill="#9A8B7A" opacity="0.45" />
          <path d="M28 56 L36 56 M28 56 L28 64" stroke="#7B7161" strokeWidth="0.7" opacity="0.5" />
        </>
      )}

      {/* Stato 3: pulita — piccolo cuore/fiore */}
      {lvl === 3 && (
        <path d="M60 44 q-3 -4 -6 -1 q-2 2 0 4 l6 6 l6 -6 q2 -2 0 -4 q-3 -3 -6 1 z" fill={t.coral} opacity="0.85" />
      )}

      {/* Stato 4: splendente — stelline scintillanti */}
      {st.sparkle && (
        <>
          <Sparkle x={26} y={40} c={t.sunny} s={6} />
          <Sparkle x={96} y={48} c={t.sunny} s={5} />
          <Sparkle x={88} y={28} c={t.sunny} s={4} />
          <Sparkle x={18} y={64} c={t.sunny} s={4} />
          <Sparkle x={60} y={20} c={t.sunny} s={7} />
        </>
      )}
    </svg>
  );
}

function Sparkle({ x, y, c, s }) {
  return (
    <path
      d={`M${x} ${y - s} L${x + s * 0.28} ${y - s * 0.28} L${x + s} ${y} L${x + s * 0.28} ${y + s * 0.28} L${x} ${y + s} L${x - s * 0.28} ${y + s * 0.28} L${x - s} ${y} L${x - s * 0.28} ${y - s * 0.28} Z`}
      fill={c}
    >
      <animate attributeName="opacity" values="0.4;1;0.4" dur="1.8s" repeatCount="indefinite" begin={`${(x % 5) * 0.2}s`} />
    </path>
  );
}
