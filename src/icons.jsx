import React from 'react';
import {
  UtensilsCrossed, Droplets, Brush, Droplet, ShowerHead, ShoppingCart, ChefHat, Shirt,
  ShoppingBasket, Trash2, BedDouble, Feather, Snowflake, Sofa, FileText, Sprout,
  PawPrint, Moon, Sparkles, Car, Laptop, Package, Eraser, SprayCan, Milk, Scissors,
  Gift, HeartHandshake, Heart, Plane, Coffee, Clapperboard, Candy, Bath, TreePine,
  Music, PhoneOff, Flower2, Cake, Ticket, Martini, Palette, BookOpen, Croissant,
  Flame, Waves, Popcorn,
  Target, Rocket, Dumbbell, Medal, Star, Crown, Trophy, Zap, Rainbow, Sunrise, Timer, Award,
} from 'lucide-react';

/* ------------------------------------------------------------------ *
 *  Grafica in stile iOS al posto delle emoji.
 *
 *  Le emoji restano nei DATI (è la chiave salvata su Supabase per lavori
 *  e regali, quindi non tocca niente di esistente): qui vengono solo
 *  TRADOTTE in un'icona pulita dentro una tessera sfumata, come le
 *  categorie dell'app Salute di iPhone. Un'emoji non mappata continua a
 *  mostrarsi com'è, così i dati vecchi o personalizzati non si rompono.
 * ------------------------------------------------------------------ */

// Palette di sfumature ispirate ad Apple Salute
export const GRADIENTS = {
  green: ['#34C759', '#2FB350'],
  teal: ['#40C8E0', '#32ADE6'],
  blue: ['#4DA2FF', '#007AFF'],
  indigo: ['#6E6ADE', '#5856D6'],
  purple: ['#BF5AF2', '#AF52DE'],
  pink: ['#FF6482', '#FF2D55'],
  red: ['#FF6961', '#FF3B30'],
  orange: ['#FF9F0A', '#FF8C00'],
  yellow: ['#FFD60A', '#FFC300'],
  brown: ['#AC8E68', '#98795A'],
  gray: ['#98989D', '#8E8E93'],
};

// emoji → [Icona, sfumatura]
const CHORE_MAP = {
  '🍽️': [UtensilsCrossed, 'blue'],
  '🫧': [Droplets, 'teal'],
  '🧹': [Brush, 'orange'],
  '🪣': [Droplet, 'teal'],
  '🚿': [ShowerHead, 'blue'],
  '🛒': [ShoppingCart, 'green'],
  '🍳': [ChefHat, 'orange'],
  '👕': [Shirt, 'indigo'],
  '🧺': [ShoppingBasket, 'purple'],
  '🗑️': [Trash2, 'gray'],
  '🛏️': [BedDouble, 'indigo'],
  '🪶': [Feather, 'pink'],
  '🪟': [Sparkles, 'teal'],
  '❄️': [Snowflake, 'blue'],
  '🛋️': [Sofa, 'brown'],
  '📑': [FileText, 'gray'],
  '🪴': [Sprout, 'green'],
  '🐾': [PawPrint, 'brown'],
  '👔': [Shirt, 'blue'],
  '🌙': [Moon, 'indigo'],
  '✨': [Sparkles, 'yellow'],
  '🚗': [Car, 'red'],
  '💻': [Laptop, 'gray'],
  '📦': [Package, 'brown'],
  '🧽': [Eraser, 'yellow'],
  '🚽': [Droplets, 'blue'],
  '🪥': [Brush, 'teal'],
  '🧴': [SprayCan, 'purple'],
  '🍶': [Milk, 'gray'],
  '🪒': [Scissors, 'blue'],
};

const GIFT_MAP = {
  '🎁': [Gift, 'red'],
  '💆': [HeartHandshake, 'purple'],
  '🤗': [Heart, 'pink'],
  '✈️': [Plane, 'blue'],
  '🍽️': [UtensilsCrossed, 'orange'],
  '☕': [Coffee, 'brown'],
  '🎬': [Clapperboard, 'indigo'],
  '🛌': [BedDouble, 'indigo'],
  '🚗': [Car, 'red'],
  '🍫': [Candy, 'brown'],
  '🛁': [Bath, 'teal'],
  '🌳': [TreePine, 'green'],
  '🎶': [Music, 'pink'],
  '📵': [PhoneOff, 'gray'],
  '💐': [Flower2, 'pink'],
  '🧁': [Cake, 'yellow'],
  '🍿': [Popcorn, 'orange'],
  '🕯️': [Flame, 'orange'],
  '🧖': [Waves, 'teal'],
  '🎟️': [Ticket, 'red'],
  '🍸': [Martini, 'indigo'],
  '🎨': [Palette, 'purple'],
  '📚': [BookOpen, 'brown'],
  '🥐': [Croissant, 'yellow'],
  '🧹': [Brush, 'orange'],
};

function lookup(emoji, map) {
  return map[emoji] || map[(emoji || '').replace(/️/g, '')] || null;
}

/**
 * Tessera sfumata con icona bianca, stile categorie di Apple Salute.
 * kind: 'chore' | 'gift' — sceglie la tabella di traduzione.
 * Se l'emoji non è mappata la mostra com'è (dati custom non si rompono).
 */
export function IconTile({ emoji, kind = 'chore', size = 44, radius, gradient, icon: IconOverride }) {
  const hit = IconOverride ? [IconOverride, gradient || 'blue'] : lookup(emoji, kind === 'gift' ? GIFT_MAP : CHORE_MAP);
  const r = radius != null ? radius : Math.round(size * 0.3);
  if (!hit) {
    return (
      <div style={{ width: size, height: size, borderRadius: r, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.55, flexShrink: 0 }}>
        {emoji}
      </div>
    );
  }
  const [Icon, g] = hit;
  const [c1, c2] = GRADIENTS[gradient || g] || GRADIENTS.blue;
  return (
    <div style={{ width: size, height: size, borderRadius: r, background: `linear-gradient(145deg, ${c1}, ${c2})`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `0 3px 8px ${c2}55` }}>
      <Icon size={Math.round(size * 0.52)} color="#fff" strokeWidth={2.2} />
    </div>
  );
}

/** True se l'emoji ha una traduzione in icona (per i selettori). */
export function hasIcon(emoji, kind = 'chore') {
  return !!lookup(emoji, kind === 'gift' ? GIFT_MAP : CHORE_MAP);
}

/**
 * Avatar iOS: iniziale del nome in un cerchio sfumato del colore
 * dell'utente. Niente più animaletti emoji.
 */
export function Avatar({ user, size = 40 }) {
  const color = user?.color || '#8E8E93';
  const letter = (user?.name || '?').trim().charAt(0).toUpperCase();
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: `linear-gradient(145deg, ${color}, ${shade(color, -18)})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: size * 0.44, flexShrink: 0, boxShadow: `0 3px 8px ${color}55`, fontFamily: 'inherit' }}>
      {letter}
    </div>
  );
}

/** Titolo di sezione con tessera-icona, come le liste di Salute/Impostazioni. */
export function SectionTitle({ icon: Icon, gradient = 'blue', children, t, style }) {
  const [c1, c2] = GRADIENTS[gradient] || GRADIENTS.blue;
  return (
    <div className="display" style={{ display: 'flex', alignItems: 'center', gap: '9px', fontSize: '16px', fontWeight: 700, color: t.text, marginBottom: '10px', ...style }}>
      <span style={{ width: 28, height: 28, borderRadius: 8, background: `linear-gradient(145deg, ${c1}, ${c2})`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={16} color="#fff" strokeWidth={2.4} />
      </span>
      {children}
    </div>
  );
}

// Traguardi individuali (id → icona + sfumatura)
const ACHIEVEMENT_MAP = {
  first: [Target, 'red'],
  ten: [Rocket, 'blue'],
  fifty: [Dumbbell, 'orange'],
  hundred: [Medal, 'yellow'],
  pts100: [Star, 'yellow'],
  pts300: [Crown, 'orange'],
  pts500: [Trophy, 'yellow'],
  streak3: [Flame, 'red'],
  streak7: [Zap, 'orange'],
  streak30: [Sparkles, 'purple'],
  rainbow: [Rainbow, 'teal'],
  earlybird: [Sunrise, 'yellow'],
  nightowl: [Moon, 'indigo'],
  marathon: [Timer, 'green'],
  weekendwin: [Award, 'blue'],
};

// Milestone di coppia (id → icona + sfumatura)
const MILESTONE_MAP = {
  cm_jobs50: [HeartHandshake, 'pink'],
  cm_jobs100: [Heart, 'red'],
  cm_jobs250: [Medal, 'teal'],
  cm_jobs500: [Trophy, 'yellow'],
  cm_pts1000: [Star, 'purple'],
  cm_pts3000: [Crown, 'orange'],
  cm_days7: [Flame, 'red'],
  cm_balance: [Award, 'green'],
};

/** Badge tondo per traguardi/milestone, colorato se sbloccato. */
export function BadgeIcon({ id, kind = 'achievement', unlocked = true, size = 44, fallbackEmoji }) {
  const hit = (kind === 'milestone' ? MILESTONE_MAP : ACHIEVEMENT_MAP)[id];
  if (!hit) {
    return <span style={{ fontSize: size * 0.55 }}>{fallbackEmoji || '•'}</span>;
  }
  const [Icon, g] = hit;
  const [c1, c2] = GRADIENTS[g] || GRADIENTS.blue;
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', margin: '0 auto', background: unlocked ? `linear-gradient(145deg, ${c1}, ${c2})` : 'rgba(128,128,140,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: unlocked ? `0 3px 8px ${c2}55` : 'none' }}>
      <Icon size={Math.round(size * 0.5)} color={unlocked ? '#fff' : '#98989D'} strokeWidth={2.2} />
    </div>
  );
}

function shade(hex, pct) {
  const n = parseInt(hex.slice(1), 16);
  const amt = Math.round(2.55 * pct);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amt));
  const b = Math.max(0, Math.min(255, (n & 0xff) + amt));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}
