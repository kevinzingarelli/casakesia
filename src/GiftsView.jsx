import React, { useState, useMemo } from 'react';
import { Gift, X, Check, Plus, Heart, Trash2, Clock, Sparkles } from 'lucide-react';
import { GIFT_EMOJIS, GIFT_SUGGESTIONS, GIFT_STATUS, giftDayLabel, todayStr } from './helpers';

export default function GiftsView({
  data, me, otherUser, t, dark, cardShadow,
  onAddGift, onRemoveGift, onRequestGift, onRespondGift, onGiftDone, onDeleteRequest,
}) {
  const [requesting, setRequesting] = useState(null);   // regalo scelto dal catalogo
  const [reqDate, setReqDate] = useState(todayStr());
  const [reqNote, setReqNote] = useState('');
  const [declining, setDeclining] = useState(null);     // richiesta che sto rifiutando
  const [declineNote, setDeclineNote] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newGift, setNewGift] = useState({ name: '', emoji: '🎁' });

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
          <div style={{ fontSize: '28px', lineHeight: 1 }}>{r.snapshotEmoji}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '14px', fontWeight: 800, color: t.text }}>{r.snapshotName}</div>
            <div style={{ fontSize: '12px', color: t.textSoft, marginTop: '2px' }}>
              {from?.emoji} {from?.name} → {to?.emoji} {to?.name} · <strong style={{ color: t.coral }}>{giftDayLabel(r.date)}</strong>
            </div>
            {r.note && <div style={{ fontSize: '12px', color: t.text, marginTop: '6px', fontStyle: 'italic' }}>« {r.note} »</div>}
            {r.replyNote && <div style={{ fontSize: '12px', color: t.textSoft, marginTop: '6px' }}>Risposta: « {r.replyNote} »</div>}
          </div>
          <div style={{ fontSize: '11px', color: t.textSoft, fontWeight: 700, whiteSpace: 'nowrap' }}>{st.emoji} {st.label}</div>
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
          <div style={{ fontSize: '38px', marginBottom: '10px' }}>🎁</div>
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
              <button onClick={() => { setDeclining(r); setDeclineNote(''); }} style={btn('transparent', t.textSoft)}>
                <span style={{ border: `1.5px solid ${t.line}`, borderRadius: '10px', padding: '9px 12px', width: '100%' }}>Non posso</span>
              </button>
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
        {gifts.map((g) => (
          <div key={g.id} style={{ ...card, display: 'flex', alignItems: 'center', gap: '11px' }}>
            <div style={{ fontSize: '28px' }}>{g.emoji}</div>
            <div style={{ flex: 1, fontSize: '14px', fontWeight: 700, color: t.text }}>{g.name}</div>
            <button onClick={() => onRemoveGift(g.id)} style={{ background: 'transparent', border: 'none', color: t.textSoft, cursor: 'pointer', padding: '6px' }}><Trash2 size={15} /></button>
            <button onClick={() => openRequest(g)} disabled={!otherUser} style={{ background: otherUser ? t.coral : t.line, border: 'none', color: '#fff', borderRadius: '12px', padding: '10px 14px', fontWeight: 800, fontSize: '13px', cursor: otherUser ? 'pointer' : 'default' }}>Chiedi</button>
          </div>
        ))}
      </div>

      {/* Aggiungi un regalo */}
      {!showAdd ? (
        <button onClick={() => setShowAdd(true)} style={{ width: '100%', marginTop: '10px', background: 'transparent', border: `1.5px dashed ${t.line}`, color: t.textSoft, borderRadius: '14px', padding: '13px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
          <Plus size={16} /> Aggiungi un regalo
        </button>
      ) : (
        <div style={{ ...card, marginTop: '10px' }}>
          <input value={newGift.name} onChange={(e) => setNewGift({ ...newGift, name: e.target.value })} placeholder="Es. Colazione a letto" style={{ width: '100%', padding: '11px', borderRadius: '11px', border: `1px solid ${t.line}`, fontSize: '14px', marginBottom: '10px', fontFamily: 'inherit', background: t.card, color: t.text }} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
            {GIFT_EMOJIS.map((em) => (
              <button key={em} onClick={() => setNewGift({ ...newGift, emoji: em })} style={{ fontSize: '20px', padding: '5px 7px', borderRadius: '9px', border: newGift.emoji === em ? `2px solid ${t.coral}` : `1px solid ${t.line}`, background: 'transparent', cursor: 'pointer' }}>{em}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => { setShowAdd(false); setNewGift({ name: '', emoji: '🎁' }); }} style={btn('transparent', t.textSoft)}>Annulla</button>
            <button onClick={() => { if (!newGift.name.trim()) return; onAddGift(newGift); setNewGift({ name: '', emoji: '🎁' }); setShowAdd(false); }} style={btn(t.mint, '#fff')}>Aggiungi</button>
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
                <button key={s.name} onClick={() => onAddGift(s)} style={{ background: t.card, border: `1px solid ${t.line}`, borderRadius: '20px', padding: '8px 12px', fontSize: '12.5px', fontWeight: 700, color: t.text, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', boxShadow: cardShadow }}>
                  <Plus size={13} color={t.textSoft} /> {s.emoji} {s.name}
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
              <div className="hero-emoji" style={{ fontSize: '58px', lineHeight: 1, marginBottom: '8px' }}>{requesting.emoji}</div>
              <div className="display" style={{ fontSize: '20px', fontWeight: 800, color: t.text }}>{requesting.name}</div>
              <div style={{ fontSize: '13px', color: t.textSoft, marginTop: '3px' }}>Lo chiedi a {otherUser.emoji} {otherUser.name}</div>
            </div>

            <div style={{ fontSize: '13px', fontWeight: 800, color: t.text, marginBottom: '9px' }}>Per quando?</div>
            <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap', marginBottom: '14px' }}>
              {[[0, 'Oggi'], [1, 'Domani'], [2, 'Fra 2 giorni'], [7, 'Fra una settimana']].map(([d, label]) => {
                const val = todayStr(new Date(Date.now() + d * 86400000));
                const on = reqDate === val;
                return (
                  <button key={d} onClick={() => setReqDate(val)} style={{ padding: '9px 13px', borderRadius: '11px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 800, background: on ? t.coral : t.line, color: on ? '#fff' : t.textSoft }}>{label}</button>
                );
              })}
              <input type="date" value={reqDate} min={todayStr()} onChange={(e) => e.target.value && setReqDate(e.target.value)} style={{ padding: '9px 11px', borderRadius: '11px', border: `1px solid ${t.line}`, fontSize: '13px', background: t.card, color: t.text }} />
            </div>

            <div style={{ fontSize: '13px', fontWeight: 800, color: t.text, marginBottom: '7px' }}>Vuoi aggiungere qualcosa? (facoltativo)</div>
            <input value={reqNote} onChange={(e) => setReqNote(e.target.value)} placeholder="Es. dopo cena, se non sei stanca..." style={{ width: '100%', padding: '11px', borderRadius: '11px', border: `1px solid ${t.line}`, fontSize: '14px', marginBottom: '18px', fontFamily: 'inherit', background: t.card, color: t.text }} />

            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setRequesting(null)} style={btn('transparent', t.textSoft)}>Annulla</button>
              <button onClick={confirmRequest} style={btn(t.coral, '#fff')}><Gift size={16} /> Chiedi per {giftDayLabel(reqDate)}</button>
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
            <input value={declineNote} onChange={(e) => setDeclineNote(e.target.value)} placeholder="Es. quel giorno lavoro, facciamo sabato?" style={{ width: '100%', padding: '11px', borderRadius: '11px', border: `1px solid ${t.line}`, fontSize: '14px', marginBottom: '16px', fontFamily: 'inherit', background: t.card, color: t.text }} />
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
