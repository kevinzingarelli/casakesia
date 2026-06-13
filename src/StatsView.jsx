import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import { Crown, Trophy, Sparkles, Flame, TrendingUp, Award, Lock, X } from 'lucide-react';
import {
  ACHIEVEMENTS, CATEGORIES, PERIOD_LABELS,
  todayStr, periodStart, getLevel, pointsForEntry, choreNameForEntry,
  achievementContext, startOfWeek,
} from './helpers';

function PeriodSelector({ period, setPeriod, customDays, setCustomDays, t }) {
  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {Object.keys(PERIOD_LABELS).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            style={{
              padding: '6px 12px', borderRadius: '10px', border: 'none', cursor: 'pointer',
              fontSize: '12px', fontWeight: 700,
              background: period === p ? t.coral : t.card,
              color: period === p ? '#fff' : t.textSoft,
            }}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>
      {period === 'custom' && (
        <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: t.textSoft }}>
          Ultimi
          <input
            type="number"
            value={customDays}
            onChange={(e) => setCustomDays(Math.max(1, Number(e.target.value) || 1))}
            style={{ width: '70px', padding: '6px 8px', borderRadius: '8px', border: `1px solid ${t.line}`, fontSize: '13px', background: t.card, color: t.text }}
          />
          giorni
        </div>
      )}
    </div>
  );
}

export default function StatsView({ data, choresById, t, dark }) {
  const [rankPeriod, setRankPeriod] = useState('week');
  const [rankCustom, setRankCustom] = useState(30);
  const [chartPeriod, setChartPeriod] = useState('week');
  const [chartCustom, setChartCustom] = useState(30);
  const [achievementInfo, setAchievementInfo] = useState(null);

  const users = data.users;
  const [uA, uB] = users;

  // ---- Classifica per periodo selezionato ----
  const rankStart = periodStart(rankPeriod, rankCustom);
  const rankTotals = useMemo(() => {
    const tot = {};
    users.forEach((u) => (tot[u.id] = { points: 0, count: 0 }));
    data.log.forEach((e) => {
      if (new Date(e.timestamp) >= rankStart) {
        if (!tot[e.userId]) tot[e.userId] = { points: 0, count: 0 };
        tot[e.userId].points += pointsForEntry(e, choresById);
        tot[e.userId].count += 1;
      }
    });
    return tot;
  }, [data, rankStart, choresById, users]);

  const rankWinner = useMemo(() => {
    if (!uA || !uB) return null;
    const a = rankTotals[uA.id]?.points || 0;
    const b = rankTotals[uB.id]?.points || 0;
    if (a === 0 && b === 0) return null;
    if (a === b) return 'tie';
    return a > b ? uA : uB;
  }, [rankTotals, uA, uB]);

  // ---- Grafico andamento (adatta granularità al periodo) ----
  const chartData = useMemo(() => {
    const start = periodStart(chartPeriod, chartCustom);
    const now = new Date();
    const dayMs = 86400000;
    const spanDays = Math.ceil((now - start) / dayMs);

    // Se il periodo è lungo, raggruppiamo per settimana o mese
    let buckets = [];
    if (chartPeriod === 'all' || spanDays > 120) {
      // raggruppa per mese
      const monthMap = {};
      data.log.forEach((e) => {
        const d = new Date(e.timestamp);
        if (d >= start) {
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          if (!monthMap[key]) monthMap[key] = {};
          monthMap[key][e.userId] = (monthMap[key][e.userId] || 0) + pointsForEntry(e, choresById);
        }
      });
      buckets = Object.keys(monthMap).sort().map((key) => {
        const [y, m] = key.split('-');
        const row = { label: new Date(y, m - 1).toLocaleDateString('it-IT', { month: 'short', year: '2-digit' }) };
        users.forEach((u) => { row[u.name] = monthMap[key][u.id] || 0; });
        return row;
      });
    } else if (spanDays > 31) {
      // raggruppa per settimana
      const weekMap = {};
      data.log.forEach((e) => {
        const d = new Date(e.timestamp);
        if (d >= start) {
          const key = todayStr(startOfWeek(d));
          if (!weekMap[key]) weekMap[key] = {};
          weekMap[key][e.userId] = (weekMap[key][e.userId] || 0) + pointsForEntry(e, choresById);
        }
      });
      buckets = Object.keys(weekMap).sort().map((key) => {
        const row = { label: new Date(key).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }) };
        users.forEach((u) => { row[u.name] = weekMap[key][u.id] || 0; });
        return row;
      });
    } else {
      // giorno per giorno
      const nDays = Math.min(spanDays, 31) || 7;
      for (let i = nDays - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = todayStr(d);
        const row = { label: d.toLocaleDateString('it-IT', { weekday: 'short' }) };
        users.forEach((u) => {
          row[u.name] = data.log
            .filter((e) => e.date === key && e.userId === u.id)
            .reduce((s, e) => s + pointsForEntry(e, choresById), 0);
        });
        buckets.push(row);
      }
    }
    return buckets;
  }, [data, chartPeriod, chartCustom, choresById, users]);

  // ---- Grafico a torta: quanti lavori ha fatto ciascuno (richiesta utente) ----
  const choresPerUser = useMemo(() => {
    return users.map((u) => ({
      name: u.name,
      value: data.log.filter((e) => e.userId === u.id).length,
      color: u.color,
    })).filter((x) => x.value > 0);
  }, [data, users]);

  // ---- Indice di equità (fairness) sul totale ----
  const fairness = useMemo(() => {
    const counts = users.map((u) => data.log.filter((e) => e.userId === u.id).length);
    const totalCount = counts.reduce((a, b) => a + b, 0);
    if (totalCount === 0) return null;
    return users.map((u, i) => ({ user: u, pct: Math.round((counts[i] / totalCount) * 100), count: counts[i] }));
  }, [data, users]);

  // ---- Totali assoluti per livelli ----
  const totalPoints = useMemo(() => {
    const tot = {};
    users.forEach((u) => (tot[u.id] = 0));
    data.log.forEach((e) => { tot[e.userId] = (tot[e.userId] || 0) + pointsForEntry(e, choresById); });
    return tot;
  }, [data, choresById, users]);

  // ---- Record personali ----
  const records = useMemo(() => {
    return users.map((u) => {
      const byDay = {};
      data.log.filter((e) => e.userId === u.id).forEach((e) => {
        byDay[e.date] = (byDay[e.date] || 0) + pointsForEntry(e, choresById);
      });
      let bestDay = null, bestPts = 0;
      Object.entries(byDay).forEach(([day, pts]) => { if (pts > bestPts) { bestPts = pts; bestDay = day; } });
      return { user: u, bestDay, bestPts };
    });
  }, [data, choresById, users]);

  // ---- Heatmap (ultimi ~17 settimane) stile GitHub ----
  const heatmap = useMemo(() => {
    const days = [];
    const today = new Date();
    const totalDays = 119; // 17 settimane
    const countByDay = {};
    data.log.forEach((e) => { countByDay[e.date] = (countByDay[e.date] || 0) + 1; });
    for (let i = totalDays - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = todayStr(d);
      days.push({ date: key, count: countByDay[key] || 0 });
    }
    return days;
  }, [data]);

  const maxHeat = Math.max(1, ...heatmap.map((d) => d.count));

  // ---- Previsione vincitore settimana ----
  const prediction = useMemo(() => {
    if (!uA || !uB) return null;
    const ws = startOfWeek();
    const daysPassed = Math.max(1, Math.ceil((new Date() - ws) / 86400000));
    const daysLeft = 7 - daysPassed;
    const proj = {};
    users.forEach((u) => {
      const wkPoints = data.log
        .filter((e) => e.userId === u.id && new Date(e.timestamp) >= ws)
        .reduce((s, e) => s + pointsForEntry(e, choresById), 0);
      const dailyAvg = wkPoints / daysPassed;
      proj[u.id] = { current: wkPoints, projected: Math.round(wkPoints + dailyAvg * daysLeft) };
    });
    return { proj, daysLeft };
  }, [data, choresById, users, uA, uB]);

  const cardStyle = { background: t.card, borderRadius: '20px', padding: '14px', boxShadow: dark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(45,42,74,0.05)', marginBottom: '18px' };
  const titleStyle = { fontSize: '15px', fontWeight: 600, marginBottom: '8px' };

  return (
    <div className="fade-in" style={{ padding: '0 18px' }}>
      {/* Modal info traguardo */}
      {achievementInfo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(45,42,74,0.45)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }} onClick={() => setAchievementInfo(null)}>
          <div className="pop-card" style={{ background: t.card, borderRadius: '24px', padding: '24px', maxWidth: '320px', textAlign: 'center', position: 'relative' }} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setAchievementInfo(null)} style={{ position: 'absolute', top: '12px', right: '12px', background: 'transparent', border: 'none', color: t.textSoft, cursor: 'pointer' }}><X size={20} /></button>
            <div style={{ fontSize: '52px', marginBottom: '8px' }}>{achievementInfo.unlocked ? achievementInfo.emoji : '🔒'}</div>
            <div className="display" style={{ fontSize: '20px', fontWeight: 700, color: t.text }}>{achievementInfo.title}</div>
            <div style={{ fontSize: '13px', color: t.textSoft, marginTop: '4px', fontWeight: 700 }}>{achievementInfo.unlocked ? 'SBLOCCATO ✓' : 'DA SBLOCCARE'}</div>
            <div style={{ fontSize: '14px', color: t.text, marginTop: '14px', lineHeight: 1.5, background: dark ? 'rgba(255,255,255,0.05)' : '#FFF7ED', borderRadius: '14px', padding: '12px' }}>
              <strong>Come ottenerlo:</strong><br />{achievementInfo.how}
            </div>
          </div>
        </div>
      )}

      {/* CLASSIFICA */}
      <div className="display" style={titleStyle}>🏆 Classifica</div>
      <div style={cardStyle}>
        <PeriodSelector period={rankPeriod} setPeriod={setRankPeriod} customDays={rankCustom} setCustomDays={setRankCustom} t={t} />
        {[...users].sort((a, b) => (rankTotals[b.id]?.points || 0) - (rankTotals[a.id]?.points || 0)).map((u, i) => (
          <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderBottom: i === 0 ? `1px solid ${t.line}` : 'none', marginBottom: i === 0 ? '8px' : 0 }}>
            <div style={{ fontSize: '20px', width: '28px', textAlign: 'center' }}>
              {i === 0 && rankWinner !== 'tie' && (rankTotals[u.id]?.points || 0) > 0 ? <Crown size={22} color={t.sunny} fill={t.sunny} /> : (i + 1)}
            </div>
            <div style={{ fontSize: '26px' }}>{u.emoji}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '15px', color: t.text }}>{u.name}</div>
              <div style={{ fontSize: '12px', color: t.textSoft }}>{rankTotals[u.id]?.count || 0} lavori</div>
            </div>
            <div className="display" style={{ fontWeight: 800, fontSize: '22px', color: u.color }}>{rankTotals[u.id]?.points || 0}</div>
          </div>
        ))}
        {rankWinner === 'tie' && <div style={{ fontSize: '12px', color: t.textSoft, textAlign: 'center', marginTop: '6px' }}>Siete in pareggio! 🤝</div>}
      </div>

      {/* PREVISIONE */}
      {prediction && prediction.daysLeft > 0 && (uA && uB) && (
        <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: '12px' }}>
          <TrendingUp size={26} color={t.lavender} />
          <div style={{ fontSize: '13px', color: t.text, lineHeight: 1.5 }}>
            <strong>Proiezione fine settimana</strong> ({prediction.daysLeft} {prediction.daysLeft === 1 ? 'giorno' : 'giorni'} rimasti):<br />
            {users.map((u, i) => (
              <span key={u.id} style={{ color: u.color, fontWeight: 700 }}>
                {u.emoji} {u.name}: {prediction.proj[u.id].projected}pt{i === 0 ? ' · ' : ''}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ANDAMENTO PUNTI */}
      <div className="display" style={titleStyle}>📈 Andamento punti</div>
      <div style={cardStyle}>
        <PeriodSelector period={chartPeriod} setPeriod={setChartPeriod} customDays={chartCustom} setCustomDays={setChartCustom} t={t} />
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke={t.line} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: t.textSoft }} />
            <YAxis tick={{ fontSize: 11, fill: t.textSoft }} />
            <Tooltip contentStyle={{ background: t.card, border: `1px solid ${t.line}`, borderRadius: '10px', color: t.text }} />
            {users.map((u) => (
              <Line key={u.id} type="monotone" dataKey={u.name} stroke={u.color} strokeWidth={3} dot={{ r: 3 }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* TORTA: LAVORI PER PERSONA */}
      <div className="display" style={titleStyle}>🥧 Chi ha fatto di più</div>
      <div style={cardStyle}>
        {choresPerUser.length === 0 ? (
          <div style={{ color: t.textSoft, fontSize: '13px', textAlign: 'center', padding: '20px' }}>Nessun dato ancora.</div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={choresPerUser} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={(e) => `${e.name}: ${e.value}`} labelLine={false} style={{ fontSize: 11 }}>
                  {choresPerUser.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: t.card, border: `1px solid ${t.line}`, borderRadius: '10px', color: t.text }} />
              </PieChart>
            </ResponsiveContainer>
          </>
        )}
      </div>

      {/* INDICE DI EQUITÀ */}
      {fairness && (
        <>
          <div className="display" style={titleStyle}>⚖️ Equilibrio dei lavori</div>
          <div style={cardStyle}>
            <div style={{ display: 'flex', height: '28px', borderRadius: '10px', overflow: 'hidden', marginBottom: '10px' }}>
              {fairness.map((f) => (
                <div key={f.user.id} style={{ width: `${f.pct}%`, background: f.user.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '12px', fontWeight: 800, transition: 'width 0.5s' }}>
                  {f.pct > 12 ? `${f.pct}%` : ''}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
              {fairness.map((f) => (
                <span key={f.user.id} style={{ color: f.user.color, fontWeight: 700 }}>{f.user.emoji} {f.user.name}: {f.count} lavori</span>
              ))}
            </div>
            {(() => {
              const diff = Math.abs((fairness[0]?.pct || 0) - (fairness[1]?.pct || 0));
              let msg = '';
              if (diff <= 10) msg = 'Perfettamente equilibrato! 🎯';
              else if (diff <= 30) msg = 'Quasi in pari, ci siamo quasi 👍';
              else msg = 'Squilibrio evidente — qualcuno sta lavorando di più 😅';
              return <div style={{ fontSize: '12px', color: t.textSoft, textAlign: 'center', marginTop: '8px' }}>{msg}</div>;
            })()}
          </div>
        </>
      )}

      {/* HEATMAP */}
      <div className="display" style={titleStyle}>🔥 Costanza (ultime 17 settimane)</div>
      <div style={cardStyle}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', justifyContent: 'center' }}>
          {heatmap.map((d, i) => {
            const intensity = d.count / maxHeat;
            let bg = t.line;
            if (d.count > 0) {
              const alpha = 0.3 + intensity * 0.7;
              bg = `rgba(6, 214, 160, ${alpha})`;
            }
            return <div key={i} title={`${d.date}: ${d.count} lavori`} style={{ width: '13px', height: '13px', borderRadius: '3px', background: bg }} />;
          })}
        </div>
        <div style={{ fontSize: '11px', color: t.textSoft, textAlign: 'center', marginTop: '10px' }}>Ogni quadratino è un giorno · più verde = più lavori</div>
      </div>

      {/* RECORD PERSONALI */}
      <div className="display" style={titleStyle}>🏅 Record personali</div>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '18px' }}>
        {records.map((r) => (
          <div key={r.user.id} style={{ flex: 1, background: t.card, borderRadius: '18px', padding: '14px', boxShadow: dark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(45,42,74,0.05)' }}>
            <div style={{ fontSize: '22px' }}>{r.user.emoji}</div>
            <div style={{ fontWeight: 800, fontSize: '13px', color: t.text }} className="display">{r.user.name}</div>
            <div style={{ fontSize: '11px', color: t.textSoft, marginTop: '4px' }}>Giorno migliore</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: r.user.color }} className="display">{r.bestPts} pt</div>
            {r.bestDay && <div style={{ fontSize: '11px', color: t.textSoft }}>{new Date(r.bestDay).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}</div>}
          </div>
        ))}
      </div>

      {/* LIVELLI */}
      <div className="display" style={titleStyle}>⭐ Livelli</div>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '18px' }}>
        {users.map((u) => {
          const lvl = getLevel(totalPoints[u.id] || 0);
          const toNext = lvl.next ? lvl.next.min - (totalPoints[u.id] || 0) : 0;
          const prevMin = lvl.min;
          const range = lvl.next ? lvl.next.min - prevMin : 1;
          const progress = lvl.next ? Math.min(100, (((totalPoints[u.id] || 0) - prevMin) / range) * 100) : 100;
          return (
            <div key={u.id} style={{ flex: 1, background: t.card, borderRadius: '18px', padding: '14px', boxShadow: dark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(45,42,74,0.05)' }}>
              <div style={{ fontSize: '24px' }}>{lvl.emoji}</div>
              <div style={{ fontWeight: 800, fontSize: '14px', color: t.text }} className="display">{u.name}</div>
              <div style={{ fontSize: '12px', color: t.textSoft, marginBottom: '6px' }}>{lvl.title}</div>
              <div style={{ height: '8px', background: t.line, borderRadius: '6px', overflow: 'hidden', marginBottom: '6px' }}>
                <div style={{ height: '100%', width: `${progress}%`, background: u.color, transition: 'width 0.5s' }} />
              </div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: u.color }} className="display">{totalPoints[u.id] || 0} pt</div>
              {lvl.next && <div style={{ fontSize: '11px', color: t.textSoft, marginTop: '4px' }}>{toNext} pt → "{lvl.next.title}" {lvl.next.emoji}</div>}
            </div>
          );
        })}
      </div>

      {/* TRAGUARDI (cliccabili) */}
      <div className="display" style={titleStyle}>🎯 Traguardi (tocca per i dettagli)</div>
      {users.map((u) => {
        const otherId = users.find((x) => x.id !== u.id)?.id;
        const ctx = achievementContext(data.log, choresById, u.id, otherId);
        const unlockedCount = ACHIEVEMENTS.filter((a) => a.check(ctx)).length;
        return (
          <div key={u.id} style={{ ...cardStyle, marginBottom: '12px' }}>
            <div style={{ fontWeight: 800, fontSize: '13px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px', color: t.text }} className="display">
              {u.emoji} {u.name}
              <span style={{ marginLeft: 'auto', fontSize: '12px', color: t.textSoft }}>{unlockedCount}/{ACHIEVEMENTS.length}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
              {ACHIEVEMENTS.map((a) => {
                const unlocked = a.check(ctx);
                return (
                  <button
                    key={a.id}
                    onClick={() => setAchievementInfo({ ...a, unlocked })}
                    style={{ textAlign: 'center', opacity: unlocked ? 1 : 0.4, background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px' }}
                  >
                    <div style={{ fontSize: '26px' }}>
                      {unlocked ? a.emoji : <Lock size={18} color={t.textSoft} />}
                    </div>
                    <div style={{ fontSize: '9px', color: t.textSoft, marginTop: '2px', lineHeight: 1.1 }}>{a.title}</div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* WALL OF FAME */}
      <WallOfFame data={data} choresById={choresById} users={users} t={t} dark={dark} cardStyle={cardStyle} titleStyle={titleStyle} />
    </div>
  );
}

function WallOfFame({ data, choresById, users, t, cardStyle, titleStyle }) {
  const stats = useMemo(() => {
    // Lavoro più completato in assoluto
    const choreCount = {};
    data.log.forEach((e) => { choreCount[e.choreId] = (choreCount[e.choreId] || 0) + 1; });
    let topChoreId = null, topChoreN = 0;
    Object.entries(choreCount).forEach(([id, n]) => { if (n > topChoreN) { topChoreN = n; topChoreId = id; } });
    const topChore = topChoreId ? choreNameForEntry({ choreId: topChoreId }, choresById) : null;

    // Giorno record assoluto
    const dayCount = {};
    data.log.forEach((e) => { dayCount[e.date] = (dayCount[e.date] || 0) + 1; });
    let topDay = null, topDayN = 0;
    Object.entries(dayCount).forEach(([d, n]) => { if (n > topDayN) { topDayN = n; topDay = d; } });

    const totalAll = data.log.length;
    return { topChore, topChoreN, topDay, topDayN, totalAll };
  }, [data, choresById]);

  return (
    <>
      <div className="display" style={titleStyle}>👑 Wall of Fame</div>
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0' }}>
          <Trophy size={24} color={t.sunny} />
          <div style={{ fontSize: '13px', color: t.text }}>
            <strong>{stats.totalAll}</strong> lavori completati in totale dalla coppia
          </div>
        </div>
        {stats.topChore && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderTop: `1px solid ${t.line}` }}>
            <span style={{ fontSize: '22px' }}>{stats.topChore.emoji}</span>
            <div style={{ fontSize: '13px', color: t.text }}>
              Lavoro più svolto: <strong>{stats.topChore.name}</strong> ({stats.topChoreN} volte)
            </div>
          </div>
        )}
        {stats.topDay && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderTop: `1px solid ${t.line}` }}>
            <Award size={22} color={t.coral} />
            <div style={{ fontSize: '13px', color: t.text }}>
              Giorno record: <strong>{stats.topDayN} lavori</strong> il {new Date(stats.topDay).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
