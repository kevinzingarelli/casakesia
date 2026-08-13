import React, { useState, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, BarChart, Bar,
} from 'recharts';
import { Crown, Trophy, Sparkles, TrendingUp, TrendingDown, Award, Lock, X, Heart, Home as HomeIcon, Clock, Gift, HeartHandshake, PieChart as PieIcon, Target, Scale, Flame, Medal, Star } from 'lucide-react';
import { Avatar, SectionTitle, BadgeIcon } from './icons';
import {
  ACHIEVEMENTS, CATEGORIES, PERIOD_LABELS, COUPLE_MILESTONES,
  todayStr, periodStart, getLevel, pointsForEntry, choreNameForEntry,
  achievementContext, startOfWeek, coupleContext, computeTrend,
  hourDistribution, categoryRadar, userTitle, parseLocalDate,
} from './helpers';

function PeriodSelector({ period, setPeriod, customDays, setCustomDays, t, options }) {
  const keys = options || Object.keys(PERIOD_LABELS);
  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {keys.map((p) => (
          <button key={p} onClick={() => setPeriod(p)} style={{
            padding: '6px 12px', borderRadius: '12px', border: 'none', cursor: 'pointer',
            fontSize: '12px', fontWeight: 700,
            background: period === p ? t.coral : (t.card === '#FFFFFF' ? '#FFF0E6' : 'rgba(255,255,255,0.06)'),
            color: period === p ? '#fff' : t.textSoft,
          }}>{PERIOD_LABELS[p]}</button>
        ))}
      </div>
      {period === 'custom' && (
        <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: t.textSoft }}>
          Ultimi
          <input type="number" value={customDays} onChange={(e) => setCustomDays(Math.max(1, Number(e.target.value) || 1))}
            style={{ width: '70px', padding: '6px 8px', borderRadius: '8px', border: `1px solid ${t.line}`, fontSize: '13px' }} />
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
  const [heatPeriod, setHeatPeriod] = useState('3m'); // 3m, 4m, 6m, 12m
  const [achievementInfo, setAchievementInfo] = useState(null);

  const users = data.users;
  const [uA, uB] = users;

  const cardStyle = { background: t.card, borderRadius: '20px', padding: '14px', boxShadow: dark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(45,42,74,0.05)', marginBottom: '18px' };
  const titleStyle = { fontSize: '15px', fontWeight: 600, marginBottom: '8px', color: t.text };

  // ---- Classifica ----
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

  // ---- Andamento ----
  const chartData = useMemo(() => {
    const start = periodStart(chartPeriod, chartCustom);
    const now = new Date();
    const spanDays = Math.ceil((now - start) / 86400000);
    let buckets = [];
    if (chartPeriod === 'all' || spanDays > 120) {
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
        const row = { label: parseLocalDate(key).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }) };
        users.forEach((u) => { row[u.name] = weekMap[key][u.id] || 0; });
        return row;
      });
    } else {
      const nDays = Math.min(spanDays, 31) || 7;
      for (let i = nDays - 1; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const key = todayStr(d);
        const row = { label: d.toLocaleDateString('it-IT', { weekday: 'short' }) };
        users.forEach((u) => {
          row[u.name] = data.log.filter((e) => e.date === key && e.userId === u.id).reduce((s, e) => s + pointsForEntry(e, choresById), 0);
        });
        buckets.push(row);
      }
    }
    return buckets;
  }, [data, chartPeriod, chartCustom, choresById, users]);

  // ---- Torta con percentuali ----
  const choresPerUser = useMemo(() => {
    const total = data.log.length || 1;
    return users.map((u) => {
      const value = data.log.filter((e) => e.userId === u.id).length;
      return { name: u.name, value, pct: Math.round((value / total) * 100), color: u.color };
    }).filter((x) => x.value > 0);
  }, [data, users]);

  // ---- Equità ----
  const fairness = useMemo(() => {
    const counts = users.map((u) => data.log.filter((e) => e.userId === u.id).length);
    const totalCount = counts.reduce((a, b) => a + b, 0);
    if (totalCount === 0) return null;
    return users.map((u, i) => ({ user: u, pct: Math.round((counts[i] / totalCount) * 100), count: counts[i] }));
  }, [data, users]);

  // ---- Totali assoluti ----
  const totalPoints = useMemo(() => {
    const tot = {};
    users.forEach((u) => (tot[u.id] = 0));
    data.log.forEach((e) => { tot[e.userId] = (tot[e.userId] || 0) + pointsForEntry(e, choresById); });
    return tot;
  }, [data, choresById, users]);

  // ---- Record personali ----
  const records = useMemo(() => users.map((u) => {
    const byDay = {};
    data.log.filter((e) => e.userId === u.id).forEach((e) => { byDay[e.date] = (byDay[e.date] || 0) + pointsForEntry(e, choresById); });
    let bestDay = null, bestPts = 0;
    Object.entries(byDay).forEach(([day, pts]) => { if (pts > bestPts) { bestPts = pts; bestDay = day; } });
    return { user: u, bestDay, bestPts };
  }), [data, choresById, users]);

  // ---- Heatmap con periodo ----
  const heatDays = { '3m': 91, '4m': 122, '6m': 182, '12m': 364 }[heatPeriod];
  const heatmap = useMemo(() => {
    const days = [];
    const today = new Date();
    const countByDay = {};
    data.log.forEach((e) => { countByDay[e.date] = (countByDay[e.date] || 0) + 1; });
    for (let i = heatDays - 1; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      const key = todayStr(d);
      days.push({ date: key, count: countByDay[key] || 0 });
    }
    return days;
  }, [data, heatDays]);
  const maxHeat = Math.max(1, ...heatmap.map((d) => d.count));

  // ---- Previsione ----
  const prediction = useMemo(() => {
    if (!uA || !uB) return null;
    const ws = startOfWeek();
    const daysPassed = Math.max(1, Math.ceil((new Date() - ws) / 86400000));
    const daysLeft = 7 - daysPassed;
    const proj = {};
    users.forEach((u) => {
      const wkPoints = data.log.filter((e) => e.userId === u.id && new Date(e.timestamp) >= ws).reduce((s, e) => s + pointsForEntry(e, choresById), 0);
      proj[u.id] = { current: wkPoints, projected: Math.round(wkPoints + (wkPoints / daysPassed) * daysLeft) };
    });
    return { proj, daysLeft };
  }, [data, choresById, users, uA, uB]);

  // ---- Trend ----
  const trends = useMemo(() => users.map((u) => ({ user: u, ...computeTrend(data.log, choresById, u.id, 7) })), [data, choresById, users]);

  // ---- Radar ----
  const radarData = useMemo(() => categoryRadar(data.log, choresById, users, data.categories || CATEGORIES), [data, choresById, users]);
  const hasRadarData = radarData.some((r) => users.some((u) => r[u.name] > 0));

  // ---- Fasce orarie ----
  const hourData = useMemo(() => {
    const dists = users.map((u) => ({ user: u, dist: hourDistribution(data.log, u.id) }));
    const slots = ['Mattina', 'Pomeriggio', 'Sera', 'Notte'];
    return slots.map((s) => {
      const row = { slot: s };
      dists.forEach((d) => { row[d.user.name] = d.dist[s]; });
      return row;
    });
  }, [data, users]);
  const hasHourData = data.log.length > 0;

  // ---- Coppia ----
  const couple = useMemo(() => coupleContext(data.log, choresById, users), [data, choresById, users]);
  const coupleTotalPts = couple.totalPoints;

  return (
    <div className="fade-in" style={{ padding: '0 18px' }}>
      {/* Modal info traguardo */}
      {achievementInfo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(45,42,74,0.45)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }} onClick={() => setAchievementInfo(null)}>
          <div className="pop-card" style={{ background: t.card, borderRadius: '20px', padding: '24px', maxWidth: '320px', textAlign: 'center', position: 'relative' }} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setAchievementInfo(null)} style={{ position: 'absolute', top: '12px', right: '12px', background: 'transparent', border: 'none', color: t.textSoft, cursor: 'pointer' }}><X size={20} /></button>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}><BadgeIcon id={achievementInfo.id} kind={String(achievementInfo.id).startsWith('cm_') ? 'milestone' : 'achievement'} unlocked={achievementInfo.unlocked} size={64} fallbackEmoji={achievementInfo.emoji} /></div>
            <div className="display" style={{ fontSize: '20px', fontWeight: 700, color: t.text }}>{achievementInfo.title}</div>
            <div style={{ fontSize: '13px', color: achievementInfo.unlocked ? t.mint : t.textSoft, marginTop: '4px', fontWeight: 700 }}>{achievementInfo.unlocked ? 'SBLOCCATO ✓' : 'DA SBLOCCARE'}</div>
            <div style={{ fontSize: '14px', color: t.text, marginTop: '14px', lineHeight: 1.5, background: dark ? 'rgba(255,255,255,0.05)' : '#FFF7ED', borderRadius: '16px', padding: '12px' }}>
              <strong>Come ottenerlo:</strong><br />{achievementInfo.how || achievementInfo.desc}
            </div>
          </div>
        </div>
      )}

      {/* INSIEME — riepilogo di coppia in cima */}
      <SectionTitle icon={HeartHandshake} gradient="pink" t={t} style={titleStyle}>Insieme avete raggiunto</SectionTitle>
      <div style={{ ...cardStyle, background: `linear-gradient(135deg, ${t.lavender}22, ${t.mint}22)` }}>
        <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center', marginBottom: '12px' }}>
          <div>
            <div className="display" style={{ fontSize: '26px', fontWeight: 800, color: t.text }}>{couple.totalJobs}</div>
            <div style={{ fontSize: '11px', color: t.textSoft }}>lavori insieme</div>
          </div>
          <div>
            <div className="display" style={{ fontSize: '26px', fontWeight: 800, color: t.text }}>{coupleTotalPts}</div>
            <div style={{ fontSize: '11px', color: t.textSoft }}>punti combinati</div>
          </div>
          <div>
            <div className="display" style={{ fontSize: '26px', fontWeight: 800, color: t.text }}>{couple.bothActiveStreak}</div>
            <div style={{ fontSize: '11px', color: t.textSoft }}>giorni entrambi attivi</div>
          </div>
        </div>
        {/* Milestone di coppia */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
          {COUPLE_MILESTONES.map((m) => {
            const unlocked = m.check(couple);
            return (
              <button key={m.id} onClick={() => setAchievementInfo({ ...m, unlocked, how: m.desc })} style={{ textAlign: 'center', opacity: unlocked ? 1 : 0.4, background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px' }}>
                <BadgeIcon id={m.id} kind="milestone" unlocked={unlocked} size={36} fallbackEmoji={m.emoji} />
                <div style={{ fontSize: '11px', color: t.textSoft, marginTop: '4px', lineHeight: 1.15 }}>{m.title}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* CLASSIFICA */}
      <SectionTitle icon={Trophy} gradient="yellow" t={t} style={titleStyle}>Classifica</SectionTitle>
      <div style={cardStyle}>
        <PeriodSelector period={rankPeriod} setPeriod={setRankPeriod} customDays={rankCustom} setCustomDays={setRankCustom} t={t} />
        {[...users].sort((a, b) => (rankTotals[b.id]?.points || 0) - (rankTotals[a.id]?.points || 0)).map((u, i) => (
          <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderBottom: i === 0 ? `1px solid ${t.line}` : 'none', marginBottom: i === 0 ? '8px' : 0 }}>
            <div style={{ fontSize: '20px', width: '28px', textAlign: 'center' }}>
              {i === 0 && rankWinner !== 'tie' && (rankTotals[u.id]?.points || 0) > 0 ? <Crown size={22} color={t.sunny} fill={t.sunny} /> : (i + 1)}
            </div>
            <Avatar user={u} size={34} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '15px', color: t.text }}>{u.name}</div>
              <div style={{ fontSize: '12px', color: t.textSoft }}>{rankTotals[u.id]?.count || 0} lavori</div>
            </div>
            <div className="display" style={{ fontWeight: 800, fontSize: '22px', color: u.color }}>{rankTotals[u.id]?.points || 0}</div>
          </div>
        ))}
        {rankWinner === 'tie' && <div style={{ fontSize: '12px', color: t.textSoft, textAlign: 'center', marginTop: '6px' }}>Siete in pareggio!</div>}
      </div>

      {/* PREVISIONE */}
      {prediction && prediction.daysLeft > 0 && uA && uB && (
        <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: '12px' }}>
          <TrendingUp size={26} color={t.lavender} />
          <div style={{ fontSize: '13px', color: t.text, lineHeight: 1.5 }}>
            <strong>Proiezione fine settimana</strong> ({prediction.daysLeft} {prediction.daysLeft === 1 ? 'giorno' : 'giorni'} rimasti):<br />
            {users.map((u, i) => (
              <span key={u.id} style={{ color: u.color, fontWeight: 700 }}>{u.name}: {prediction.proj[u.id].projected}pt{i === 0 ? ' · ' : ''}</span>
            ))}
          </div>
        </div>
      )}

      {/* TREND */}
      <SectionTitle icon={TrendingUp} gradient="green" t={t} style={titleStyle}>Andamento vs settimana scorsa</SectionTitle>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '18px' }}>
        {trends.map((tr) => (
          <div key={tr.user.id} style={{ flex: 1, background: t.card, borderRadius: '20px', padding: '14px', boxShadow: dark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(45,42,74,0.05)' }}>
            <div style={{ fontSize: '13px', fontWeight: 800, color: t.text, display: 'flex', alignItems: 'center', gap: '4px' }} className="display"><Avatar user={tr.user} size={20} /> {tr.user.name}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
              {tr.pct >= 0 ? <TrendingUp size={18} color={t.mint} /> : <TrendingDown size={18} color={t.coral} />}
              <span className="display" style={{ fontSize: '22px', fontWeight: 800, color: tr.pct >= 0 ? t.mint : t.coral }}>{tr.pct >= 0 ? '+' : ''}{tr.pct}%</span>
            </div>
            <div style={{ fontSize: '11px', color: t.textSoft, marginTop: '2px' }}>{tr.cur}pt questa settimana (prima {tr.prev}pt)</div>
          </div>
        ))}
      </div>

      {/* ANDAMENTO PUNTI */}
      <SectionTitle icon={TrendingUp} gradient="blue" t={t} style={titleStyle}>Andamento punti</SectionTitle>
      <div style={cardStyle}>
        <PeriodSelector period={chartPeriod} setPeriod={setChartPeriod} customDays={chartCustom} setCustomDays={setChartCustom} t={t} />
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke={t.line} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: t.textSoft }} />
            <YAxis tick={{ fontSize: 11, fill: t.textSoft }} />
            <Tooltip contentStyle={{ background: t.card, border: `1px solid ${t.line}`, borderRadius: '12px', color: t.text }} />
            {users.map((u) => <Line key={u.id} type="monotone" dataKey={u.name} stroke={u.color} strokeWidth={3} dot={{ r: 3 }} />)}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* TORTA CON PERCENTUALI */}
      <SectionTitle icon={PieIcon} gradient="purple" t={t} style={titleStyle}>Chi ha fatto di più</SectionTitle>
      <div style={cardStyle}>
        {choresPerUser.length === 0 ? (
          <div style={{ color: t.textSoft, fontSize: '13px', textAlign: 'center', padding: '20px' }}>Nessun dato ancora.</div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={210}>
              <PieChart>
                <Pie data={choresPerUser} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={78}
                  label={(e) => `${e.pct}%`} labelLine={false} style={{ fontSize: 13, fontWeight: 700 }}>
                  {choresPerUser.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={(v, n, p) => [`${v} lavori (${p.payload.pct}%)`, n]} contentStyle={{ background: t.card, border: `1px solid ${t.line}`, borderRadius: '12px', color: t.text }} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '4px' }}>
              {choresPerUser.map((c) => (
                <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '4px', background: c.color }} />
                  <span style={{ color: t.text, fontWeight: 700 }}>{c.name}: {c.pct}%</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* RADAR CATEGORIE */}
      {hasRadarData && (
        <>
          <SectionTitle icon={Target} gradient="red" t={t} style={titleStyle}>Forze per categoria</SectionTitle>
          <div style={cardStyle}>
            <ResponsiveContainer width="100%" height={250}>
              <RadarChart data={radarData}>
                <PolarGrid stroke={t.line} />
                <PolarAngleAxis dataKey="category" tick={{ fontSize: 11, fill: t.textSoft }} />
                <PolarRadiusAxis tick={{ fontSize: 9, fill: t.textSoft }} />
                {users.map((u) => <Radar key={u.id} name={u.name} dataKey={u.name} stroke={u.color} fill={u.color} fillOpacity={0.3} />)}
                <Tooltip contentStyle={{ background: t.card, border: `1px solid ${t.line}`, borderRadius: '12px', color: t.text }} />
              </RadarChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '16px' }}>
              {users.map((u) => (
                <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '4px', background: u.color }} />
                  <span style={{ color: t.text, fontWeight: 700 }}>{u.name}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* FASCE ORARIE */}
      {hasHourData && (
        <>
          <SectionTitle icon={Clock} gradient="indigo" t={t} style={titleStyle}>Quando siete più attivi</SectionTitle>
          <div style={cardStyle}>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={hourData}>
                <CartesianGrid strokeDasharray="3 3" stroke={t.line} />
                <XAxis dataKey="slot" tick={{ fontSize: 11, fill: t.textSoft }} />
                <YAxis tick={{ fontSize: 11, fill: t.textSoft }} />
                <Tooltip contentStyle={{ background: t.card, border: `1px solid ${t.line}`, borderRadius: '12px', color: t.text }} />
                {users.map((u) => <Bar key={u.id} dataKey={u.name} fill={u.color} radius={[6, 6, 0, 0]} />)}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* EQUITÀ */}
      {fairness && (
        <>
          <SectionTitle icon={Scale} gradient="teal" t={t} style={titleStyle}>Equilibrio dei lavori</SectionTitle>
          <div style={cardStyle}>
            <div style={{ display: 'flex', height: '28px', borderRadius: '12px', overflow: 'hidden', marginBottom: '10px' }}>
              {fairness.map((f) => (
                <div key={f.user.id} style={{ width: `${f.pct}%`, background: f.user.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '12px', fontWeight: 800, transition: 'width 0.5s' }}>
                  {f.pct > 12 ? `${f.pct}%` : ''}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
              {fairness.map((f) => <span key={f.user.id} style={{ color: f.user.color, fontWeight: 700 }}>{f.user.name}: {f.count}</span>)}
            </div>
            {(() => {
              const diff = Math.abs((fairness[0]?.pct || 0) - (fairness[1]?.pct || 0));
              let msg = diff <= 10 ? 'Siete forti tutti e due' : diff <= 30 ? 'Quasi in pari' : 'Squilibrio evidente';
              return <div style={{ fontSize: '12px', color: t.textSoft, textAlign: 'center', marginTop: '8px' }}>{msg}</div>;
            })()}
          </div>
        </>
      )}

      {/* HEATMAP con periodo */}
      <SectionTitle icon={Flame} gradient="orange" t={t} style={titleStyle}>Costanza</SectionTitle>
      <div style={cardStyle}>
        <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
          {[['3m', '3 mesi'], ['4m', '4 mesi'], ['6m', '6 mesi'], ['12m', '1 anno']].map(([k, label]) => (
            <button key={k} onClick={() => setHeatPeriod(k)} style={{ padding: '6px 12px', borderRadius: '12px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700, background: heatPeriod === k ? t.coral : (t.card === '#FFFFFF' ? '#FFF0E6' : 'rgba(255,255,255,0.06)'), color: heatPeriod === k ? '#fff' : t.textSoft }}>{label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', justifyContent: 'center' }}>
          {heatmap.map((d, i) => {
            const intensity = d.count / maxHeat;
            let bg = t.line;
            if (d.count > 0) bg = `rgba(6, 214, 160, ${0.3 + intensity * 0.7})`;
            return <div key={i} title={`${d.date}: ${d.count} lavori`} style={{ width: '12px', height: '12px', borderRadius: '4px', background: bg }} />;
          })}
        </div>
        <div style={{ fontSize: '11px', color: t.textSoft, textAlign: 'center', marginTop: '10px' }}>Ogni quadratino è un giorno · più verde = più lavori</div>
      </div>

      {/* RECORD */}
      <SectionTitle icon={Medal} gradient="yellow" t={t} style={titleStyle}>Record personali</SectionTitle>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '18px' }}>
        {records.map((r) => (
          <div key={r.user.id} style={{ flex: 1, background: t.card, borderRadius: '20px', padding: '14px', boxShadow: dark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(45,42,74,0.05)' }}>
            <Avatar user={r.user} size={28} />
            <div style={{ fontWeight: 800, fontSize: '13px', color: t.text, marginTop: '6px' }} className="display">{r.user.name}</div>
            <div style={{ fontSize: '11px', color: t.textSoft, marginTop: '4px' }}>Giorno migliore</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: r.user.color }} className="display">{r.bestPts} pt</div>
            {r.bestDay && <div style={{ fontSize: '11px', color: t.textSoft }}>{parseLocalDate(r.bestDay).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}</div>}
          </div>
        ))}
      </div>

      {/* LIVELLI + TITOLI */}
      <SectionTitle icon={Star} gradient="purple" t={t} style={titleStyle}>Livelli e titoli</SectionTitle>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '18px' }}>
        {users.map((u) => {
          const lvl = getLevel(totalPoints[u.id] || 0);
          const toNext = lvl.next ? lvl.next.min - (totalPoints[u.id] || 0) : 0;
          const range = lvl.next ? lvl.next.min - lvl.min : 1;
          const progress = lvl.next ? Math.min(100, (((totalPoints[u.id] || 0) - lvl.min) / range) * 100) : 100;
          const title = userTitle(data.log, choresById, u.id);
          return (
            <div key={u.id} style={{ flex: 1, background: t.card, borderRadius: '20px', padding: '14px', boxShadow: dark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(45,42,74,0.05)' }}>
              <Avatar user={u} size={30} />
              <div style={{ fontWeight: 800, fontSize: '14px', color: t.text, marginTop: '6px' }} className="display">{u.name}</div>
              <div style={{ fontSize: '12px', color: t.textSoft, marginBottom: '6px' }}>{lvl.title}</div>
              {title && <div style={{ fontSize: '11px', fontWeight: 700, color: u.color, marginBottom: '6px' }}>{title.title}</div>}
              <div style={{ height: '8px', background: t.line, borderRadius: '8px', overflow: 'hidden', marginBottom: '6px' }}>
                <div style={{ height: '100%', width: `${progress}%`, background: u.color, transition: 'width 0.5s' }} />
              </div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: u.color }} className="display">{totalPoints[u.id] || 0} pt</div>
              {lvl.next && <div style={{ fontSize: '11px', color: t.textSoft, marginTop: '4px' }}>{toNext} pt a "{lvl.next.title}"</div>}
            </div>
          );
        })}
      </div>

      {/* TRAGUARDI individuali */}
      <SectionTitle icon={Award} gradient="blue" t={t} style={titleStyle}>Traguardi (tocca per i dettagli)</SectionTitle>
      {users.map((u) => {
        const otherId = users.find((x) => x.id !== u.id)?.id;
        const ctx = achievementContext(data.log, choresById, u.id, otherId, data.excused || {});
        const unlockedCount = ACHIEVEMENTS.filter((a) => a.check(ctx)).length;
        return (
          <div key={u.id} style={{ ...cardStyle, marginBottom: '12px' }}>
            <div style={{ fontWeight: 800, fontSize: '13px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px', color: t.text }} className="display">
              <Avatar user={u} size={22} /> {u.name}<span style={{ marginLeft: 'auto', fontSize: '12px', color: t.textSoft }}>{unlockedCount}/{ACHIEVEMENTS.length}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
              {ACHIEVEMENTS.map((a) => {
                const unlocked = a.check(ctx);
                return (
                  <button key={a.id} onClick={() => setAchievementInfo({ ...a, unlocked })} style={{ textAlign: 'center', opacity: unlocked ? 1 : 0.4, background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px' }}>
                    <BadgeIcon id={a.id} unlocked={unlocked} size={40} fallbackEmoji={a.emoji} />
                    <div style={{ fontSize: '11px', color: t.textSoft, marginTop: '4px', lineHeight: 1.15 }}>{a.title}</div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* REGALI */}
      <GiftStats data={data} users={users} t={t} dark={dark} cardStyle={cardStyle} titleStyle={titleStyle} />

      {/* WALL OF FAME + MEMORIA DI COPPIA */}
      <WallOfFame data={data} choresById={choresById} users={users} t={t} cardStyle={cardStyle} titleStyle={titleStyle} />
    </div>
  );
}

function GiftStats({ data, users, t, dark, cardStyle, titleStyle }) {
  const requests = data.giftRequests || [];
  const stats = useMemo(() => {
    if (requests.length === 0) return null;
    const concluded = requests.filter((r) => r.status === 'accepted' || r.status === 'declined' || r.status === 'done');
    const answered = concluded.length;
    const accepted = concluded.filter((r) => r.status !== 'declined').length;
    const acceptRate = answered > 0 ? Math.round((accepted / answered) * 100) : null;
    const done = requests.filter((r) => r.status === 'done').length;

    const byUser = users.map((u) => ({
      user: u,
      asked: requests.filter((r) => r.fromUserId === u.id).length,
      given: requests.filter((r) => r.toUserId === u.id && r.status === 'done').length,
    }));
    const totalAsked = byUser.reduce((s, x) => s + x.asked, 0) || 1;

    const byGift = {};
    requests.forEach((r) => { byGift[r.snapshotName] = (byGift[r.snapshotName] || { name: r.snapshotName, emoji: r.snapshotEmoji, count: 0 }); byGift[r.snapshotName].count += 1; });
    const topGift = Object.values(byGift).sort((a, b) => b.count - a.count)[0] || null;

    return { total: requests.length, done, acceptRate, byUser, totalAsked, topGift };
  }, [requests, users]);

  if (!stats) return null;

  return (
    <>
      <SectionTitle icon={Gift} gradient="red" t={t} style={titleStyle}>Regali</SectionTitle>
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center', marginBottom: '14px' }}>
          <div>
            <div className="display" style={{ fontSize: '22px', fontWeight: 800, color: t.text }}>{stats.total}</div>
            <div style={{ fontSize: '11px', color: t.textSoft }}>richiesti</div>
          </div>
          <div>
            <div className="display" style={{ fontSize: '22px', fontWeight: 800, color: t.text }}>{stats.done}</div>
            <div style={{ fontSize: '11px', color: t.textSoft }}>consegnati</div>
          </div>
          <div>
            <div className="display" style={{ fontSize: '22px', fontWeight: 800, color: t.text }}>{stats.acceptRate != null ? `${stats.acceptRate}%` : '—'}</div>
            <div style={{ fontSize: '11px', color: t.textSoft }}>accettati</div>
          </div>
        </div>

        {/* Chi chiede di più */}
        <div style={{ fontSize: '11px', color: t.textSoft, fontWeight: 700, marginBottom: '6px' }}>Chi chiede di più</div>
        <div style={{ display: 'flex', height: '24px', borderRadius: '8px', overflow: 'hidden', marginBottom: '10px' }}>
          {stats.byUser.map((x) => {
            const pct = Math.round((x.asked / stats.totalAsked) * 100);
            return pct > 0 ? (
              <div key={x.user.id} style={{ width: `${pct}%`, background: x.user.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '11px', fontWeight: 800, transition: 'width 0.5s' }}>
                {pct > 14 ? `${pct}%` : ''}
              </div>
            ) : null;
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '12px' }}>
          {stats.byUser.map((x) => (
            <span key={x.user.id} style={{ color: x.user.color, fontWeight: 700 }}>{x.user.name}: {x.asked} chiesti · {x.given} consegnati</span>
          ))}
        </div>

        {stats.topGift && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '10px', borderTop: `1px solid ${t.line}` }}>
            <Gift size={20} color={t.coral} />
            <div style={{ fontSize: '13px', color: t.text }}>
              Il più richiesto: <strong>{stats.topGift.name}</strong> ({stats.topGift.count}×)
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function WallOfFame({ data, choresById, users, t, cardStyle, titleStyle }) {
  const stats = useMemo(() => {
    const choreCount = {};
    data.log.forEach((e) => { choreCount[e.choreId] = (choreCount[e.choreId] || 0) + 1; });
    let topChoreId = null, topChoreN = 0;
    Object.entries(choreCount).forEach(([id, n]) => { if (n > topChoreN) { topChoreN = n; topChoreId = id; } });
    const topChore = topChoreId ? choreNameForEntry({ choreId: topChoreId }, choresById) : null;

    const dayCount = {};
    data.log.forEach((e) => { dayCount[e.date] = (dayCount[e.date] || 0) + 1; });
    let topDay = null, topDayN = 0;
    Object.entries(dayCount).forEach(([d, n]) => { if (n > topDayN) { topDayN = n; topDay = d; } });

    // settimana di coppia più produttiva
    const weekTotals = {};
    data.log.forEach((e) => {
      const ws = todayStr(startOfWeek(new Date(e.timestamp)));
      weekTotals[ws] = (weekTotals[ws] || 0) + pointsForEntry(e, choresById);
    });
    let topWeek = null, topWeekPts = 0;
    Object.entries(weekTotals).forEach(([w, p]) => { if (p > topWeekPts) { topWeekPts = p; topWeek = w; } });

    return { topChore, topChoreN, topDay, topDayN, totalAll: data.log.length, topWeek, topWeekPts };
  }, [data, choresById]);

  return (
    <>
      <SectionTitle icon={Crown} gradient="yellow" t={t} style={titleStyle}>Wall of Fame</SectionTitle>
      <div style={cardStyle}>
        <Row icon={<Trophy size={22} color={t.sunny} />} t={t}>
          <strong>{stats.totalAll}</strong> lavori completati in totale dalla coppia
        </Row>
        {stats.topChore && (
          <Row icon={<Star size={22} color={t.coral} />} t={t} border>
            Lavoro più svolto: <strong>{stats.topChore.name}</strong> ({stats.topChoreN}×)
          </Row>
        )}
        {stats.topDay && (
          <Row icon={<Award size={22} color={t.coral} />} t={t} border>
            Giorno record: <strong>{stats.topDayN} lavori</strong> il {parseLocalDate(stats.topDay).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}
          </Row>
        )}
        {stats.topWeek && (
          <Row icon={<Heart size={22} color={t.lavender} />} t={t} border>
            Settimana migliore di coppia: <strong>{stats.topWeekPts} punti</strong> (dal {parseLocalDate(stats.topWeek).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })})
          </Row>
        )}
      </div>
    </>
  );
}

function Row({ icon, emoji, children, t, border }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderTop: border ? `1px solid ${t.line}` : 'none' }}>
      {icon || <span style={{ fontSize: '22px' }}>{emoji}</span>}
      <div style={{ fontSize: '13px', color: t.text }}>{children}</div>
    </div>
  );
}
