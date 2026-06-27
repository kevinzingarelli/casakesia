import React, { useState, useMemo } from 'react';
import { Flame, Shield, X, Check, ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { computeStreakHistory, computeStreak, computeBestStreak, todayStr } from './helpers';

const REASONS = [
  { id: 'vacation', label: '🏖️ Vacanza', short: 'Vacanza' },
  { id: 'sick', label: '🤒 Malattia', short: 'Malattia' },
  { id: 'busy', label: '💼 Impegni', short: 'Impegni' },
  { id: 'away', label: '🚗 Fuori casa', short: 'Fuori casa' },
  { id: 'other', label: '📝 Altro', short: 'Altro' },
];

export default function StreakView({ data, me, t, onExcuse, onUnexcuse }) {
  const [selectedDay, setSelectedDay] = useState(null);
  const [excuseReason, setExcuseReason] = useState(null);
  const [viewMonths, setViewMonths] = useState(3); // 1, 3, 6 mesi
  const [customNote, setCustomNote] = useState('');

  const excused = data.excused || {};
  const users = data.users;

  const numDays = viewMonths * 30;

  // Storia per ogni utente
  const histories = useMemo(() =>
    users.map((u) => ({
      user: u,
      history: computeStreakHistory(data.log, u.id, excused, numDays),
      streak: computeStreak(data.log, u.id, excused),
      best: computeBestStreak(data.log, u.id, excused),
    })), [data, excused, numDays, users]);

  const cardStyle = {
    background: t.card,
    borderRadius: t.radius || '20px',
    padding: '16px',
    boxShadow: t.shadow,
    marginBottom: '16px',
  };

  const statusColor = (status) => {
    if (status === 'done') return t.mint;
    if (status === 'excused') return t.lavender;
    if (status === 'open') return t.sunny;
    if (status === 'missed') return t.coral;
    return t.line;
  };

  const statusEmoji = (status) => {
    if (status === 'done') return '✅';
    if (status === 'excused') return '🛡️';
    if (status === 'open') return '⏳';
    if (status === 'missed') return '❌';
    return '·';
  };

  const isMyDay = (userId) => me && me.id === userId;

  const handleDayTap = (day, userId) => {
    if (!isMyDay(userId)) return; // solo i tuoi giorni
    if (day.date > todayStr()) return; // non giorni futuri
    setSelectedDay({ ...day, userId });
    setExcuseReason(day.status === 'excused' ? (excused[userId]?.[day.date]?.reason || null) : null);
    setCustomNote(excused[userId]?.[day.date]?.note || '');
  };

  const handleSaveExcuse = () => {
    if (!selectedDay || !excuseReason) return;
    onExcuse(selectedDay.userId, selectedDay.date, excuseReason, customNote);
    setSelectedDay(null);
    setExcuseReason(null);
    setCustomNote('');
  };

  const handleRemoveExcuse = () => {
    if (!selectedDay) return;
    onUnexcuse(selectedDay.userId, selectedDay.date);
    setSelectedDay(null);
  };

  // Raggruppa la history a settimane per visualizzazione a griglia
  const toWeeks = (history) => {
    const weeks = [];
    let week = [];
    // Riempiamo la prima settimana se non inizia di lunedì
    const first = new Date(history[0].date);
    const startOffset = (first.getDay() + 6) % 7; // 0=lun
    for (let i = 0; i < startOffset; i++) week.push(null);
    history.forEach((d) => {
      week.push(d);
      if (week.length === 7) { weeks.push(week); week = []; }
    });
    if (week.length > 0) {
      while (week.length < 7) week.push(null);
      weeks.push(week);
    }
    return weeks;
  };

  return (
    <div className="fade-in" style={{ padding: '0 18px' }}>
      {/* Modal giustificazione giorno */}
      {selectedDay && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(45,42,74,0.5)', zIndex: 60, display: 'flex', alignItems: 'flex-end' }} onClick={() => setSelectedDay(null)}>
          <div className="pop-card" style={{ background: t.card, width: '100%', borderRadius: '28px 28px 0 0', padding: '24px', paddingBottom: 'calc(24px + env(safe-area-inset-bottom))' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <div className="display" style={{ fontSize: '18px', fontWeight: 800, color: t.text }}>
                {selectedDay.status === 'missed' ? '❌ Giorno saltato' : selectedDay.status === 'excused' ? '🛡️ Giorno giustificato' : `${statusEmoji(selectedDay.status)} Giorno`}
              </div>
              <button onClick={() => setSelectedDay(null)} style={{ background: 'transparent', border: 'none', color: t.textSoft, cursor: 'pointer' }}><X size={22} /></button>
            </div>
            <div style={{ fontSize: '13px', color: t.textSoft, marginBottom: '18px' }}>
              {new Date(selectedDay.date).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              {selectedDay.count > 0 && ` · ${selectedDay.count} lavori svolti`}
            </div>

            {(selectedDay.status === 'missed' || selectedDay.status === 'excused') && (
              <>
                <div style={{ fontSize: '13px', fontWeight: 800, color: t.text, marginBottom: '10px' }}>Motivazione</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
                  {REASONS.map((r) => (
                    <button key={r.id} onClick={() => setExcuseReason(r.id)} style={{ textAlign: 'left', padding: '12px 14px', borderRadius: t.radiusSm || '12px', border: `1.5px solid ${excuseReason === r.id ? t.lavender : t.line}`, background: excuseReason === r.id ? (t.card === '#FFFFFF' ? '#F3F0FF' : 'rgba(167,139,250,0.12)') : 'transparent', color: t.text, fontSize: '14px', fontWeight: excuseReason === r.id ? 800 : 600, cursor: 'pointer' }}>
                      {r.label}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: t.textSoft, marginBottom: '6px' }}>Nota (opzionale)</div>
                <input
                  value={customNote}
                  onChange={(e) => setCustomNote(e.target.value)}
                  placeholder="Es. Weekend fuori città..."
                  style={{ width: '100%', padding: '10px', borderRadius: '10px', border: `1px solid ${t.line}`, fontSize: '14px', marginBottom: '14px', background: t.card, color: t.text }}
                />
                <div style={{ display: 'flex', gap: '8px' }}>
                  {selectedDay.status === 'excused' && (
                    <button onClick={handleRemoveExcuse} style={{ background: '#FFE5E5', border: 'none', color: '#C0392B', borderRadius: '12px', padding: '12px 14px', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}>
                      Rimuovi
                    </button>
                  )}
                  <button onClick={handleSaveExcuse} disabled={!excuseReason} style={{ flex: 1, background: excuseReason ? t.lavender : t.line, border: 'none', color: excuseReason ? '#fff' : t.textSoft, borderRadius: '12px', padding: '12px', fontWeight: 800, cursor: excuseReason ? 'pointer' : 'default', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    <Shield size={16} /> Giustifica giorno
                  </button>
                </div>
              </>
            )}

            {selectedDay.status === 'done' && (
              <div style={{ textAlign: 'center', padding: '16px 0', fontSize: '14px', color: t.textSoft }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>✅</div>
                Hai fatto {selectedDay.count} {selectedDay.count === 1 ? 'lavoro' : 'lavori'} questo giorno. La serie è intatta!
              </div>
            )}

            {selectedDay.status === 'open' && (
              <div style={{ textAlign: 'center', padding: '16px 0', fontSize: '14px', color: t.textSoft }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>⏳</div>
                La giornata è ancora aperta. Hai tempo fino a mezzanotte!
              </div>
            )}
          </div>
        </div>
      )}

      {/* Titolo */}
      <div className="display" style={{ fontSize: '17px', fontWeight: 800, marginBottom: '4px', color: t.text, display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Flame size={20} color={t.coral} /> Storia delle serie
      </div>
      <div style={{ fontSize: '12px', color: t.textSoft, marginBottom: '16px' }}>
        Tocca un ❌ nei tuoi giorni per giustificarlo e recuperare la serie.
      </div>

      {/* Selettore periodo */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        {[[1, '1 mese'], [3, '3 mesi'], [6, '6 mesi']].map(([m, label]) => (
          <button key={m} onClick={() => setViewMonths(m)} style={{ flex: 1, padding: '9px', borderRadius: t.radiusSm || '12px', border: 'none', fontWeight: 700, fontSize: '13px', cursor: 'pointer', background: viewMonths === m ? t.coral : t.card, color: viewMonths === m ? '#fff' : t.textSoft, boxShadow: t.shadow }}>
            {label}
          </button>
        ))}
      </div>

      {/* Legenda */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {[['done', '✅ Fatto'], ['excused', '🛡️ Giustificato'], ['missed', '❌ Saltato'], ['open', '⏳ Oggi']].map(([s, label]) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: t.textSoft, fontWeight: 700 }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: statusColor(s) }} />
            {label}
          </div>
        ))}
      </div>

      {/* Per ogni utente */}
      {histories.map(({ user, history, streak, best }) => {
        const isMine = me && me.id === user.id;
        const weeks = toWeeks(history);
        const dayLabels = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];
        const missed = history.filter((d) => d.status === 'missed').length;
        const excusedCount = history.filter((d) => d.status === 'excused').length;
        const done = history.filter((d) => d.status === 'done').length;

        return (
          <div key={user.id} style={{ ...cardStyle }}>
            {/* Header utente */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div style={{ fontSize: '28px' }}>{user.emoji}</div>
              <div style={{ flex: 1 }}>
                <div className="display" style={{ fontSize: '16px', fontWeight: 800, color: t.text }}>
                  {user.name} {isMine && <span style={{ fontSize: '11px', background: user.color, color: '#fff', borderRadius: '6px', padding: '2px 6px', marginLeft: '4px' }}>tu</span>}
                </div>
                <div style={{ fontSize: '12px', color: t.textSoft, marginTop: '2px' }}>
                  {done} fatti · {excusedCount} giustificati · {missed} saltati
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
                  <Flame size={18} color={streak > 0 ? t.coral : t.textSoft} />
                  <span className="display" style={{ fontSize: '24px', fontWeight: 800, color: streak > 0 ? t.coral : t.textSoft }}>{streak}</span>
                </div>
                <div style={{ fontSize: '10px', color: t.textSoft }}>Best: {best}</div>
              </div>
            </div>

            {/* Intestazioni giorni settimana */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '3px', marginBottom: '3px' }}>
              {dayLabels.map((d, i) => (
                <div key={i} style={{ textAlign: 'center', fontSize: '10px', color: t.textSoft, fontWeight: 800 }}>{d}</div>
              ))}
            </div>

            {/* Griglia settimane */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {weeks.map((week, wi) => (
                <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '3px' }}>
                  {week.map((day, di) => {
                    if (!day) return <div key={di} />;
                    const isToday = day.date === todayStr();
                    const canTap = isMine && (day.status === 'missed' || day.status === 'excused');
                    return (
                      <button
                        key={di}
                        onClick={() => handleDayTap(day, user.id)}
                        title={`${day.date}${day.reason ? ' · ' + REASONS.find((r) => r.id === day.reason)?.short : ''}`}
                        style={{
                          aspectRatio: '1',
                          borderRadius: '6px',
                          border: isToday ? `2px solid ${user.color}` : 'none',
                          background: statusColor(day.status),
                          opacity: day.status === 'future' ? 0.2 : 1,
                          cursor: canTap ? 'pointer' : 'default',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '9px',
                          padding: 0,
                          transition: 'transform 0.1s',
                          transform: canTap ? undefined : undefined,
                          position: 'relative',
                        }}
                        className={canTap ? 'wiggle' : ''}
                      >
                        {day.status === 'excused' && <Shield size={8} color="#fff" />}
                        {day.status === 'done' && day.count > 1 && (
                          <span style={{ fontSize: '8px', color: '#fff', fontWeight: 800, lineHeight: 1 }}>{day.count}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Indicazione se non è il proprio profilo */}
            {!isMine && (
              <div style={{ marginTop: '10px', fontSize: '11px', color: t.textSoft, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                <Info size={13} /> Solo {user.name} può giustificare i propri giorni
              </div>
            )}

            {/* Segmenti di serie (le serie separate da interruzioni) */}
            <StreakSegments history={history} t={t} />
          </div>
        );
      })}
    </div>
  );
}

// Mostra le serie distinte con lunghezza e date
function StreakSegments({ history, t }) {
  const segments = useMemo(() => {
    const result = [];
    let current = null;
    history.forEach((d) => {
      if (d.status === 'done' || d.status === 'excused' || d.status === 'open') {
        if (!current) current = { start: d.date, end: d.date, len: 1 };
        else { current.end = d.date; current.len++; }
      } else {
        if (current) { result.push(current); current = null; }
      }
    });
    if (current) result.push(current);
    return result.filter((s) => s.len >= 2).sort((a, b) => b.len - a.len).slice(0, 4);
  }, [history]);

  if (segments.length === 0) return null;

  return (
    <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: `1px solid ${t.line}` }}>
      <div style={{ fontSize: '11px', fontWeight: 800, color: t.textSoft, marginBottom: '8px' }}>Serie più lunghe in questo periodo</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {segments.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: `${Math.min(100, (s.len / segments[0].len) * 100)}%`, height: '6px', background: i === 0 ? t.coral : t.lavender, borderRadius: '4px', minWidth: '24px', transition: 'width 0.5s' }} />
            <span style={{ fontSize: '12px', fontWeight: 700, color: t.text, whiteSpace: 'nowrap' }}>{s.len} gg</span>
            <span style={{ fontSize: '11px', color: t.textSoft, whiteSpace: 'nowrap' }}>
              {new Date(s.start).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} – {new Date(s.end).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
