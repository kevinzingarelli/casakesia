import React, { useState } from 'react';
import { Flame, Trophy, Crown, TrendingUp, Target, Calendar, Award } from 'lucide-react';
import { getLevel, pointsForEntry, todayStr, startOfWeek, choreNameForEntry } from './helpers';

// Schermata "Widget": riproduce l'estetica dei widget iOS (piccolo/medio/grande)
// dentro l'app. Nota: i veri widget home-screen richiedono un'app nativa Swift.
export default function WidgetScreen({ data, choresById, totals, streaks, me, t, dark, health }) {
  const [size, setSize] = useState('medium');

  const users = data.users;
  const [uA, uB] = users;
  const leader = (totals[uA?.id] || 0) >= (totals[uB?.id] || 0) ? uA : uB;

  // dati settimana
  const ws = startOfWeek();
  const weekPts = {};
  users.forEach((u) => { weekPts[u.id] = 0; });
  data.log.forEach((e) => { if (new Date(e.timestamp) >= ws) weekPts[e.userId] = (weekPts[e.userId] || 0) + pointsForEntry(e, choresById); });

  const todayPts = {};
  users.forEach((u) => { todayPts[u.id] = 0; });
  data.log.forEach((e) => { if (e.date === todayStr()) todayPts[e.userId] = (todayPts[e.userId] || 0) + pointsForEntry(e, choresById); });

  const cardShadow = dark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 16px rgba(45,42,74,0.1)';

  const gradient = `linear-gradient(135deg, ${t.coral}, ${t.lavender})`;

  // WIDGET PICCOLO: solo il mio punteggio + livello
  const SmallWidget = ({ user }) => {
    const lvl = getLevel(totals[user.id] || 0);
    return (
      <div style={{ background: gradient, borderRadius: '22px', padding: '16px', width: '160px', height: '160px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: cardShadow }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '28px' }}>{user.emoji}</span>
          <span style={{ fontSize: '20px' }}>{lvl.emoji}</span>
        </div>
        <div>
          <div className="display" style={{ fontSize: '40px', fontWeight: 800, color: '#fff', lineHeight: 1 }}>{totals[user.id] || 0}</div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.9)', fontWeight: 700 }}>punti · {lvl.title}</div>
        </div>
        {streaks[user.id] > 0 && <div style={{ fontSize: '12px', color: '#fff', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}><Flame size={14} /> {streaks[user.id]} giorni</div>}
      </div>
    );
  };

  // WIDGET MEDIO: classifica + oggi
  const MediumWidget = () => (
    <div style={{ background: t.card, borderRadius: '22px', padding: '16px', width: '340px', height: '160px', boxShadow: cardShadow, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="display" style={{ fontSize: '13px', fontWeight: 800, color: t.text }}>🏠 Casa Points</span>
        <span style={{ fontSize: '11px', color: t.textSoft }}>questa settimana</span>
      </div>
      {users.map((u, i) => {
        const maxRef = Math.max(weekPts[uA?.id] || 0, weekPts[uB?.id] || 0, 10);
        const pct = Math.max(6, ((weekPts[u.id] || 0) / maxRef) * 100);
        const isLeader = i === 0 ? (weekPts[uA?.id] || 0) >= (weekPts[uB?.id] || 0) : (weekPts[uB?.id] || 0) > (weekPts[uA?.id] || 0);
        return (
          <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>{u.emoji}</span>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: t.text }}>{u.name} {isLeader && (weekPts[u.id] || 0) > 0 && '👑'}</span>
                <span className="display" style={{ fontSize: '14px', fontWeight: 800, color: u.color }}>{weekPts[u.id] || 0}</span>
              </div>
              <div style={{ height: '8px', background: t.line, borderRadius: '5px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: u.color, borderRadius: '5px', transition: 'width 0.5s' }} />
              </div>
            </div>
          </div>
        );
      })}
      <div style={{ fontSize: '11px', color: t.textSoft, textAlign: 'center' }}>Oggi: {users.map((u) => `${u.emoji} ${todayPts[u.id] || 0}`).join('  ·  ')}</div>
    </div>
  );

  // WIDGET GRANDE: tutto
  const LargeWidget = () => (
    <div style={{ background: t.card, borderRadius: '22px', padding: '18px', width: '340px', boxShadow: cardShadow }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <span className="display" style={{ fontSize: '16px', fontWeight: 800, color: t.text }}>🏠 Casa Points</span>
        <span style={{ fontSize: '20px' }}>{health.emoji}</span>
      </div>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
        {users.map((u) => {
          const lvl = getLevel(totals[u.id] || 0);
          return (
            <div key={u.id} style={{ flex: 1, background: dark ? 'rgba(255,255,255,0.05)' : '#FFF7ED', borderRadius: '16px', padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '26px' }}>{u.emoji}</div>
              <div className="display" style={{ fontSize: '26px', fontWeight: 800, color: u.color }}>{totals[u.id] || 0}</div>
              <div style={{ fontSize: '11px', color: t.textSoft, fontWeight: 700 }}>{lvl.emoji} {lvl.title}</div>
              {streaks[u.id] > 0 && <div style={{ fontSize: '11px', color: t.textSoft, marginTop: '2px' }}>🔥 {streaks[u.id]}g</div>}
            </div>
          );
        })}
      </div>
      <div style={{ background: gradient, borderRadius: '14px', padding: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Crown size={22} color="#fff" />
        <div style={{ fontSize: '13px', color: '#fff', fontWeight: 700 }}>
          {(weekPts[leader?.id] || 0) > 0 ? `${leader.emoji} ${leader.name} è in testa questa settimana!` : 'Iniziate a fare lavori questa settimana!'}
        </div>
      </div>
    </div>
  );

  return (
    <div className="fade-in" style={{ padding: '0 18px' }}>
      <div style={{ background: dark ? 'rgba(255,209,102,0.12)' : '#FFF9E6', borderRadius: '14px', padding: '12px 14px', marginBottom: '16px', fontSize: '12px', color: t.text, lineHeight: 1.5 }}>
        💡 Anteprima dei widget. Su iPhone puoi <strong>aggiungere l'app alla Home</strong> (Condividi → Aggiungi a Home) per aprirla come un'app. I widget veri sulla schermata Home richiederebbero un'app nativa.
      </div>

      <div className="display" style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px', color: t.text }}>Anteprima widget</div>

      {/* Selettore dimensione */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        {[['small', 'Piccolo'], ['medium', 'Medio'], ['large', 'Grande']].map(([k, label]) => (
          <button key={k} onClick={() => setSize(k)} style={{ flex: 1, padding: '10px', borderRadius: '12px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 700, background: size === k ? t.coral : t.card, color: size === k ? '#fff' : t.textSoft, boxShadow: cardShadow }}>{label}</button>
        ))}
      </div>

      {/* Anteprima */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
        {size === 'small' && (
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
            {users.map((u) => <SmallWidget key={u.id} user={u} />)}
          </div>
        )}
        {size === 'medium' && <MediumWidget />}
        {size === 'large' && <LargeWidget />}
      </div>

      <div style={{ fontSize: '12px', color: t.textSoft, textAlign: 'center', marginBottom: '20px' }}>
        {size === 'small' && 'Widget piccolo: punteggio e livello di ciascuno'}
        {size === 'medium' && 'Widget medio: classifica della settimana e punti di oggi'}
        {size === 'large' && 'Widget grande: panoramica completa con salute della casa'}
      </div>
    </div>
  );
}
