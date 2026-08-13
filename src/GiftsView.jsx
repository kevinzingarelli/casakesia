import React, { useState, useMemo } from 'react';
import { Gift, X, Check, Plus, Heart, Trash2, Clock, Sparkles, Pencil, Ticket } from 'lucide-react';
import { GIFT_EMOJIS, GIFT_SUGGESTIONS, GIFT_STATUS, giftDayLabel, giftRemaining, todayStr } from './helpers';
import { IconTile, Avatar } from './icons';

const emptyDraft = { name: '', emoji: '🎁', hasLimit: false, monthlyLimit: 3 };

export default function GiftsView({
  data, me, otherUser, t, dark, cardShadow,
  onAddGift, onEditGift, onRemoveGift, onRequestGift, onRespondGift, onGiftDone, onDeleteRequest,
}) {
  const [requesting, setRequesting] = useState(null);   // regalo scelto dal catalogo
  const [reqDate, setReqDate] = useState(todayStr());
  const [reqNote, setReqNote] = useState('');
  const [declining, setDeclining] = useState(null);     // richiesta che sto rifiutando
  const [declineNote, setDeclineNote] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState(null);     // id del regalo in modifica, o null se sto aggiungendo
  const [draft, setDraft] = useState(emptyDraft);

  const gifts = data.gifts || [];
  const requests = data.giftRequests || [];

  const byNewest = (a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''));

  // Richieste che l'altra persona ha fatto a me e a cui devo rispondere
  const toAnswer = useMemo(
    () => (me ? requests.filter((r) => r.toUserId === me.id && r.status === 'pending').sort(byNewest) : []),
    [requests, me],
  );
  // Quello che ho chiesto io e non è ancora concluso
  const mine = useMemo(
    () => (me ? requests.filter((r) => r.fromUserId === me.id && (r.status === 'pending' || r.status === 'accepted')).sort(byNewest) : []),
    [requests, me],
  );
  // Richieste accettate rivolte a me: le devo ancora consegnare
  const toGive = useMemo(
    () => (me ? requests.filter((r) => r.toUserId === me.id && r.status === 'accepted').sort(byNewest) : []),
    [requests, me],
  );
  const history = useMemo(
    () => requests.filter((r) => r.status === 'declined' || r.status === 'done').sort(byNewest),
    [requests],
  );

  const openRequest = (gift) => {
    setRequesting(gift);
    setReqDate(todayStr());
    setReqNote('');
  };

  const confirmRequest = () => {
    if (!requesting || !otherUser) return;
    onRequestGift(requesting, reqDate, reqNote.trim());
    setRequesting(null);
  };

  const openAdd = () => { setEditingId(null); setDraft(emptyDraft); setShowAdd(true); };
  const openEdit = (g) => {
    setEditingId(g.id);
    setDraft({ name: g.name, emoji: g.emoji, hasLimit: !!g.monthlyLimit, monthlyLimit: g.monthlyLimit || 3 });
    setShowAdd(true);
  };
  const saveDraft = () => {
    if (!draft.name.trim()) return;
    const payload = { name: draft.name, emoji: draft.emoji, monthlyLimit: draft.hasLimit ? draft.monthlyLimit : null };
    if (editingId) onEditGift(editingId, payload);
    else onAddGift(payload);
    setShowAdd(false); setEditingId(null); setDraft(emptyDraft);
  };

  // Residuo del buono mensile per QUESTO regalo, per la data scelta nel foglio di richiesta
  const remainingFor = (gift, dateStr) => (me ? giftRemaining(gift, me.id, requests, dateStr) : null);

  const userById = (id) => data.users.find((u) => u.id === id);

  const sectionTitle = (text, icon) => (
    <div className="display" style={{ fontSize: '15px', fontWeight: 800, color: t.text, marginBottom: '10px', marginTop: '22px', display: 'flex', alignItems: 'center', gap: '7px' }}>
      {icon} {text}
    </div>
  );

  const card = { background: t.card, borderRadius: t.radius || '18px', padding: '14px', boxShadow: cardShadow };

  // Riga di una richiesta (usata in più sezioni)
  const RequestRow = ({ r, children, muted }) => {
    const from = userById(r.fromUserId);
    const to = userById(r.toUserId);
    const st = GIFT_STATUS[r.status] || GIFT_STATUS.pending;
    return (
      <div style={{ ...card, marginBottom: '10px', opacity: muted ? 0.75 : 1 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '11px' }}>
          <IconTile emoji={r.snapshotEmoji} kind="gift" size={40} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '14px', fontWeight: 800, color: t.text }}>{r.snapshotName}</div>
            <div style={{ fontSize: '12px', color: t.textSoft, marginTop: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Avatar user={from} size={16} /> {from?.name} → <Avatar user={to} size={16} /> {to?.name} · <strong style={{ color: t.coral }}>{giftDayLabel(r.date)}</strong>
            </div>
            {r.note && <div style={{ fontSize: '12px', color: t.text, marginTop: '6px', fontStyle: 'italic' }}>« {r.note} »</div>}
            {r.replyNote && <div style={{ fontSize: '12px', color: t.textSoft, marginTop: '6px' }}>Risposta: « {r.replyNote} »</div>}
          </div>
          <div style={{ fontSize: '11px', fontWeight: 800, whiteSpace: 'nowrap', padding: '3px 8px', borderRadius: '8px', background: r.status === 'accepted' || r.status === 'done' ? `${t.mint}22` : r.status === 'declined' ? `${t.coral}22` : `${t.sunny}33`, color: r.status === 'accepted' || r.status === 'done' ? t.mint : r.status === 'declined' ? t.coral : '#B8860B' }}>{st.label}</div>
        </div>
        {children && <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>{children}</div>}
      </div>
    );
  };

  const btn = (bg, color) => ({
    flex: 1, background: bg, border: 'none', color, borderRadius: '12px', padding: '11px',
    fontWeight: 800, fontSize: '13px', cursor: 'pointer', display: 'flex',
    alignItems: 'center', justifyContent: 'center', gap: '6px',
  });

  if (!me) {
    return (
      <div className="fade-in" style={{ padding: '0 18px' }}>
        <div style={{ ...card, textAlign: 'center', padding: '30px 20px', color: t.textSoft, fontSize: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}><IconTile emoji="🎁" kind="gift" size={52} /></div>
          Scegli chi sei qui sopra per poter chiedere e ricevere regali.
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ padding: '0 18px' }}>
      <div className="display" style={{ fontSize: '17px', fontWeight: 800, marginBottom: '4px', color: t.text, display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Gift size={20} color={t.lavender} /> Regali
      </div>
      <div style={{ fontSize: '12px', color: t.textSoft, marginBottom: '4px' }}>
        Niente punti qui: scegli un regalo e il giorno, {otherUser ? otherUser.name : "l'altra persona"} accetta o rifiuta.
      </div>

      {/* ---- Da rispondere ---- */}
      {toAnswer.length > 0 && (
        <>
          {sectionTitle(`${otherUser?.name} ti ha chiesto`, <Heart size={16} color={t.coral} />)}
          {toAnswer.map((r) => (
            <RequestRow key={r.id} r={r}>
              <button onClick={() => onRespondGift(r.id, true, '')} style={btn(t.mint, '#fff')}><Check size={15} /> Accetto</button>
              <button onClick={() => { setDeclining(r); setDeclineNote(''); }} style={{ ...btn('transparent', t.textSoft), border: `1.5px solid ${t.line}` }}>Non posso</button>
            </RequestRow>
          ))}
        </>
      )}

      {/* ---- Da consegnare ---- */}
      {toGive.length > 0 && (
        <>
          {sectionTitle('Hai promesso', <Clock size={16} color={t.sunny} />)}
          {toGive.map((r) => (
            <RequestRow key={r.id} r={r}>
              <button onClick={() => onGiftDone(r.id)} style={btn(t.lavender, '#fff')}><Check size={15} /> Fatto, regalo consegnato</button>
            </RequestRow>
          ))}
        </>
      )}

      {/* ---- Le mie richieste ---- */}
      {sectionTitle('I miei regali richiesti', <Sparkles size={16} color={t.lavender} />)}
      {mine.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', padding: '20px', color: t.textSoft, fontSize: '13px' }}>
          Non hai richieste in corso. Scegline uno dal catalogo qui sotto 👇
        </div>
      ) : (
        mine.map((r) => (
          <RequestRow key={r.id} r={r}>
            <button onClick={() => onDeleteRequest(r.id)} style={{ ...btn('transparent', t.textSoft), flex: 'none', padding: '8px' }}><Trash2 size={15} /> Ritira</button>
          </RequestRow>
        ))
      )}

      {/* ---- Catalogo ---- */}
      {sectionTitle('Catalogo regali', <Gift size={16} color={t.coral} />)}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {gifts.map((g) => {
          const remaining = remainingFor(g, todayStr());
          const exhausted = remaining === 0;
          return (
            <div key={g.id} style={{ ...card, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
                <IconTile emoji={g.emoji} kind="gift" size={40} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: t.text }}>{g.name}</div>
                  {g.monthlyLimit && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: exhausted ? t.coral : t.textSoft, fontWeight: 700, marginTop: '2px' }}>
                      <Ticket size={12} /> {remaining}/{g.monthlyLimit} questo mese
                    </div>
                  )}
                </div>
                <button onClick={() => openEdit(g)} style={{ background: 'transparent', border: 'none', color: t.textSoft, cursor: 'pointer', padding: '6px' }}><Pencil size={15} /></button>
                <button onClick={() => onRemoveGift(g.id)} style={{ background: 'transparent', border: 'none', color: t.textSoft, cursor: 'pointer', padding: '6px' }}><Trash2 size={15} /></button>
                <button onClick={() => openRequest(g)} disabled={!otherUser || exhausted} style={{ background: (!otherUser || exhausted) ? t.line : t.coral, border: 'none', color: (!otherUser || exhausted) ? t.textSoft : '#fff', borderRadius: '12px', padding: '10px 14px', fontWeight: 800, fontSize: '13px', cursor: (!otherUser || exhausted) ? 'default' : 'pointer', whiteSpace: 'nowrap' }}>
                  {exhausted ? 'Esaurito' : 'Chiedi'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Aggiungi / modifica un regalo */}
      {!showAdd ? (
        <button onClick={openAdd} style={{ width: '100%', marginTop: '10px', background: 'transparent', border: `1.5px dashed ${t.line}`, color: t.textSoft, borderRadius: '16px', padding: '13px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
          <Plus size={16} /> Aggiungi un regalo
        </button>
      ) : (
        <div style={{ ...card, marginTop: '10px' }}>
          <div style={{ fontSize: '13px', fontWeight: 800, color: t.text, marginBottom: '10px' }}>{editingId ? 'Modifica regalo' : 'Nuovo regalo'}</div>
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Es. Colazione a letto" style={{ width: '100%', padding: '11px', borderRadius: '12px', border: `1px solid ${t.line}`, fontSize: '14px', marginBottom: '10px', fontFamily: 'inherit', background: t.card, color: t.text }} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
            {GIFT_EMOJIS.map((em) => (
              <button key={em} onClick={() => setDraft({ ...draft, emoji: em })} style={{ width: '42px', height: '42px', padding: 0, borderRadius: '12px', border: draft.emoji === em ? `2.5px solid ${t.coral}` : '2.5px solid transparent', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IconTile emoji={em} kind="gift" size={34} />
              </button>
            ))}
          </div>

          <button onClick={() => setDraft({ ...draft, hasLimit: !draft.hasLimit })} style={{ display: 'flex', alignItems: 'center', gap: '9px', width: '100%', background: 'transparent', border: 'none', padding: 0, marginBottom: draft.hasLimit ? '10px' : '14px', cursor: 'pointer' }}>
            <div style={{ width: '38px', height: '22px', borderRadius: '12px', background: draft.hasLimit ? t.mint : t.line, position: 'relative', transition: 'background 0.15s', flexShrink: 0 }}>
              <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '2px', left: draft.hasLimit ? '18px' : '2px', transition: 'left 0.15s' }} />
            </div>
            <span style={{ fontSize: '13px', fontWeight: 700, color: t.text, display: 'flex', alignItems: 'center', gap: '5px' }}><Ticket size={14} color={t.lavender} /> Buono mensile (numero limitato al mese)</span>
          </button>

          {draft.hasLimit && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <span style={{ fontSize: '13px', color: t.textSoft }}>Quante volte al mese:</span>
              <input type="number" min="1" max="99" value={draft.monthlyLimit} onChange={(e) => setDraft({ ...draft, monthlyLimit: Math.max(1, Number(e.target.value) || 1) })} style={{ width: '64px', padding: '8px', borderRadius: '8px', border: `1px solid ${t.line}`, fontSize: '14px', fontWeight: 700, textAlign: 'center', background: t.card, color: t.text }} />
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => { setShowAdd(false); setEditingId(null); setDraft(emptyDraft); }} style={btn('transparent', t.textSoft)}>Annulla</button>
            <button onClick={saveDraft} style={btn(t.mint, '#fff')}>{editingId ? 'Salva' : 'Aggiungi'}</button>
          </div>
        </div>
      )}

      {/* Suggerimenti */}
      {(() => {
        const already = new Set(gifts.map((g) => g.name.toLowerCase()));
        const free = GIFT_SUGGESTIONS.filter((s) => !already.has(s.name.toLowerCase()));
        if (free.length === 0) return null;
        return (
          <>
            {sectionTitle('Idee da aggiungere', <Sparkles size={16} color={t.sunny} />)}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
              {free.slice(0, 8).map((s) => (
                <button key={s.name} onClick={() => onAddGift(s)} style={{ background: t.card, border: `1px solid ${t.line}`, borderRadius: '20px', padding: '8px 12px', fontSize: '12px', fontWeight: 700, color: t.text, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', boxShadow: cardShadow }}>
                  <Plus size={13} color={t.textSoft} /> <IconTile emoji={s.emoji} kind="gift" size={20} radius={6} /> {s.name}
                </button>
              ))}
            </div>
          </>
        );
      })()}

      {/* ---- Storico ---- */}
      {history.length > 0 && (
        <>
          {sectionTitle('Storico', <Clock size={16} color={t.textSoft} />)}
          {history.map((r) => <RequestRow key={r.id} r={r} muted />)}
        </>
      )}

      <div style={{ height: '20px' }} />

      {/* ---- Foglio: chiedi un regalo ---- */}
      {requesting && otherUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(45,42,74,0.55)', zIndex: 70, display: 'flex', alignItems: 'flex-end' }} onClick={() => setRequesting(null)}>
          <div className="picker-sheet" style={{ background: t.card, width: '100%', borderRadius: '28px 28px 0 0', padding: '24px 20px calc(24px + env(safe-area-inset-bottom))', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: '18px' }}>
              <div className="hero-emoji" style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}><IconTile emoji={requesting.emoji} kind="gift" size={64} /></div>
              <div className="display" style={{ fontSize: '20px', fontWeight: 800, color: t.text }}>{requesting.name}</div>
              <div style={{ fontSize: '13px', color: t.textSoft, marginTop: '3px' }}>Lo chiedi a {otherUser.name}</div>
            </div>

            <div style={{ fontSize: '13px', fontWeight: 800, color: t.text, marginBottom: '9px' }}>Per quando?</div>
            <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap', marginBottom: '14px' }}>
              {[[0, 'Oggi'], [1, 'Domani'], [2, 'Fra 2 giorni'], [7, 'Fra una settimana']].map(([d, label]) => {
                const val = todayStr(new Date(Date.now() + d * 86400000));
                const on = reqDate === val;
                return (
                  <button key={d} onClick={() => setReqDate(val)} style={{ padding: '9px 13px', borderRadius: '12px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 800, background: on ? t.coral : t.line, color: on ? '#fff' : t.textSoft }}>{label}</button>
                );
              })}
              <input type="date" value={reqDate} min={todayStr()} onChange={(e) => e.target.value && setReqDate(e.target.value)} style={{ padding: '9px 11px', borderRadius: '12px', border: `1px solid ${t.line}`, fontSize: '13px', background: t.card, color: t.text }} />
            </div>

            <div style={{ fontSize: '13px', fontWeight: 800, color: t.text, marginBottom: '7px' }}>Vuoi aggiungere qualcosa? (facoltativo)</div>
            <input value={reqNote} onChange={(e) => setReqNote(e.target.value)} placeholder="Es. dopo cena, se non sei stanca..." style={{ width: '100%', padding: '11px', borderRadius: '12px', border: `1px solid ${t.line}`, fontSize: '14px', marginBottom: '18px', fontFamily: 'inherit', background: t.card, color: t.text }} />

            {(() => {
              if (!requesting.monthlyLimit) return null;
              const remaining = remainingFor(requesting, reqDate);
              const mese = parseInt(reqDate.slice(5, 7), 10) === parseInt(todayStr().slice(5, 7), 10) ? 'questo mese' : 'in quel mese';
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: remaining === 0 ? t.coral : t.textSoft, marginBottom: '14px', marginTop: '-8px' }}>
                  <Ticket size={13} /> {remaining === 0 ? `Buono esaurito ${mese}` : `${remaining}/${requesting.monthlyLimit} rimasti ${mese}`}
                </div>
              );
            })()}

            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setRequesting(null)} style={btn('transparent', t.textSoft)}>Annulla</button>
              <button onClick={confirmRequest} disabled={remainingFor(requesting, reqDate) === 0} style={btn(remainingFor(requesting, reqDate) === 0 ? t.line : t.coral, remainingFor(requesting, reqDate) === 0 ? t.textSoft : '#fff')}><Gift size={16} /> Chiedi per {giftDayLabel(reqDate)}</button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Foglio: rifiuta ---- */}
      {declining && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(45,42,74,0.55)', zIndex: 70, display: 'flex', alignItems: 'flex-end' }} onClick={() => setDeclining(null)}>
          <div className="picker-sheet" style={{ background: t.card, width: '100%', borderRadius: '28px 28px 0 0', padding: '24px 20px calc(24px + env(safe-area-inset-bottom))' }} onClick={(e) => e.stopPropagation()}>
            <div className="display" style={{ fontSize: '17px', fontWeight: 800, color: t.text, marginBottom: '4px' }}>Non per {giftDayLabel(declining.date)}</div>
            <div style={{ fontSize: '13px', color: t.textSoft, marginBottom: '14px' }}>Puoi dire perché, o proporre un altro momento.</div>
            <input value={declineNote} onChange={(e) => setDeclineNote(e.target.value)} placeholder="Es. quel giorno lavoro, facciamo sabato?" style={{ width: '100%', padding: '11px', borderRadius: '12px', border: `1px solid ${t.line}`, fontSize: '14px', marginBottom: '16px', fontFamily: 'inherit', background: t.card, color: t.text }} />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setDeclining(null)} style={btn('transparent', t.textSoft)}>Annulla</button>
              <button onClick={() => { onRespondGift(declining.id, false, declineNote.trim()); setDeclining(null); }} style={btn(t.coral, '#fff')}>Invia risposta</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
