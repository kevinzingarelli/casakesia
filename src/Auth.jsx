import React, { useState } from 'react';
import { Mail, Lock, Home, Users, Copy, Check, LogIn, UserPlus, ArrowRight, Loader2 } from 'lucide-react';
import { supabase } from './supabaseClient';
import { theme } from './helpers';

// Schermate pre-app: login/registrazione e creazione/adesione a una casa.
// Sono viste rare (una tantum per dispositivo), quindi qui il tema è
// semplificato: segue solo le preferenze di sistema, senza leggere le
// impostazioni salvate dall'app (che esistono solo dopo aver fatto login).
const t = theme(typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches, 'pop');

function Shell({ children }) {
  return (
    <div style={{ minHeight: '100vh', background: t.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: t.font, boxSizing: 'border-box' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@600;700&family=Nunito:wght@400;600;700;800&display=swap');
        @keyframes auth-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .auth-spin { animation: auth-spin 0.8s linear infinite; }
      `}</style>
      <div style={{ width: '100%', maxWidth: '380px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '28px' }}>
          <div style={{ width: 44, height: 44, borderRadius: '12px', background: `linear-gradient(145deg, ${t.coral}, ${t.lavender})`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 10px rgba(0,0,0,0.15)' }}>
            <Home size={24} color="#fff" strokeWidth={2.3} />
          </div>
          <div style={{ fontFamily: t.fontDisplay, fontSize: '22px', fontWeight: t.displayWeight, color: t.text }}>Casa Points</div>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ icon: Icon, ...props }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: t.card, border: `1.5px solid ${t.line}`, borderRadius: t.radiusSm, padding: '12px 14px', marginBottom: '10px' }}>
      <Icon size={17} color={t.textSoft} strokeWidth={2} />
      <input {...props} style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: '15px', color: t.text, fontFamily: t.font }} />
    </div>
  );
}

function PrimaryButton({ children, busy, ...props }) {
  return (
    <button {...props} disabled={busy || props.disabled} style={{ width: '100%', background: busy ? t.textSoft : `linear-gradient(145deg, ${t.coral}, #FF8A5C)`, border: 'none', borderRadius: t.radiusSm, padding: '13px', color: '#fff', fontWeight: 700, fontSize: '15px', cursor: busy ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
      {busy ? <Loader2 size={17} className="auth-spin" /> : children}
    </button>
  );
}

function ErrorBox({ msg }) {
  if (!msg) return null;
  return <div style={{ background: '#FFEBEE', color: '#C62828', fontSize: '13px', borderRadius: '12px', padding: '10px 12px', marginBottom: '12px' }}>{msg}</div>;
}

export function SplashScreen() {
  return (
    <Shell>
      <div style={{ textAlign: 'center', color: t.textSoft, fontSize: '14px' }}>Un attimo…</div>
    </Shell>
  );
}

export function AuthScreen() {
  const [mode, setMode] = useState('login'); // 'login' | 'signup' | 'reset'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setError(null); setInfo(null);
    if (mode === 'reset') {
      if (!email.trim()) { setError('Inserisci la tua email.'); return; }
      setBusy(true);
      try {
        // Il link nell'email riporta qui: supabase-js riconosce il token e
        // AppRoot mostra la schermata "scegli la nuova password".
        const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
        if (err) throw err;
        setInfo('Fatto! Controlla la posta: trovi un link per scegliere una nuova password. Guarda anche nello spam.');
      } catch (err) {
        setError(err.message || 'Non sono riuscito a mandare l\'email.');
      } finally {
        setBusy(false);
      }
      return;
    }
    if (!email.trim() || !password) { setError('Inserisci email e password.'); return; }
    if (mode === 'signup' && password.length < 6) { setError('La password deve avere almeno 6 caratteri.'); return; }
    setBusy(true);
    try {
      if (mode === 'signup') {
        const { data, error: err } = await supabase.auth.signUp({ email: email.trim(), password });
        if (err) throw err;
        if (!data.session) {
          setInfo('Account creato! Controlla la tua email per confermarlo, poi torna qui e accedi.');
          setMode('login');
        }
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (err) throw err;
      }
    } catch (err) {
      setError(err.message === 'Invalid login credentials' ? 'Email o password sbagliati.' : (err.message || 'Qualcosa è andato storto.'));
    } finally {
      setBusy(false);
    }
  };

  const titles = {
    login: ['Bentornato', 'Accedi per ritrovare la tua casa.'],
    signup: ['Crea il tuo account', 'Un account per te: dopo potrai creare una casa nuova o unirti a quella del tuo partner.'],
    reset: ['Password dimenticata', 'Ti mando un\'email con un link per sceglierne una nuova.'],
  };

  return (
    <Shell>
      <div style={{ background: t.card, borderRadius: t.radius, padding: '22px', boxShadow: t.shadow }}>
        <div style={{ fontFamily: t.fontDisplay, fontSize: '17px', fontWeight: 700, color: t.text, marginBottom: '4px' }}>{titles[mode][0]}</div>
        <div style={{ fontSize: '13px', color: t.textSoft, marginBottom: '18px' }}>{titles[mode][1]}</div>
        <ErrorBox msg={error} />
        {info && <div style={{ background: '#E8F5E9', color: '#2E7D32', fontSize: '13px', borderRadius: '12px', padding: '10px 12px', marginBottom: '12px' }}>{info}</div>}
        <form onSubmit={submit}>
          <Field icon={Mail} type="email" autoComplete="email" placeholder="La tua email" value={email} onChange={(e) => setEmail(e.target.value)} />
          {mode !== 'reset' && (
            <Field icon={Lock} type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
          )}
          <div style={{ marginTop: '14px' }}>
            <PrimaryButton type="submit" busy={busy}>
              {mode === 'login' ? <LogIn size={17} /> : mode === 'signup' ? <UserPlus size={17} /> : <Mail size={17} />}
              {mode === 'login' ? 'Accedi' : mode === 'signup' ? 'Registrati' : 'Mandami il link'}
            </PrimaryButton>
          </div>
        </form>
        {mode === 'login' && (
          <button onClick={() => { setMode('reset'); setError(null); setInfo(null); }} style={{ width: '100%', marginTop: '12px', background: 'transparent', border: 'none', color: t.textSoft, fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
            Password dimenticata?
          </button>
        )}
        <button onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null); setInfo(null); }} style={{ width: '100%', marginTop: mode === 'login' ? '6px' : '14px', background: 'transparent', border: 'none', color: t.coral, fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
          {mode === 'login' ? 'Non hai un account? Registrati' : 'Hai già un account? Accedi'}
        </button>
      </div>
    </Shell>
  );
}

/**
 * Schermata "scegli la nuova password": compare quando si arriva dall'email
 * di recupero (AppRoot intercetta l'evento PASSWORD_RECOVERY di Supabase).
 */
export function NewPasswordScreen({ onDone }) {
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (pw1.length < 6) { setError('La password deve avere almeno 6 caratteri.'); return; }
    if (pw1 !== pw2) { setError('Le due password non coincidono.'); return; }
    setBusy(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ password: pw1 });
      if (err) throw err;
      onDone();
    } catch (err) {
      setError(err.message || 'Non sono riuscito a cambiare la password. Riprova dal link nell\'email.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell>
      <div style={{ background: t.card, borderRadius: t.radius, padding: '22px', boxShadow: t.shadow }}>
        <div style={{ fontFamily: t.fontDisplay, fontSize: '17px', fontWeight: 700, color: t.text, marginBottom: '4px' }}>Scegli la nuova password</div>
        <div style={{ fontSize: '13px', color: t.textSoft, marginBottom: '18px' }}>Da adesso entrerai con questa.</div>
        <ErrorBox msg={error} />
        <form onSubmit={submit}>
          <Field icon={Lock} type="password" autoComplete="new-password" placeholder="Nuova password" value={pw1} onChange={(e) => setPw1(e.target.value)} />
          <Field icon={Lock} type="password" autoComplete="new-password" placeholder="Ripeti la nuova password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
          <div style={{ marginTop: '14px' }}>
            <PrimaryButton type="submit" busy={busy}><Check size={17} /> Salva e continua</PrimaryButton>
          </div>
        </form>
      </div>
    </Shell>
  );
}

export function HouseholdSetupScreen() {
  const [choice, setChoice] = useState(null); // null | 'create' | 'join'
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [created, setCreated] = useState(null); // { invite_code }
  const [copied, setCopied] = useState(false);

  const doCreate = async () => {
    setBusy(true); setError(null);
    try {
      const { data, error: err } = await supabase.rpc('create_household');
      if (err) throw err;
      setCreated(data);
    } catch (err) {
      setError(err.message || 'Non sono riuscito a creare la casa.');
    } finally {
      setBusy(false);
    }
  };

  const doJoin = async () => {
    if (!code.trim()) { setError('Inserisci il codice che ti ha dato il tuo partner.'); return; }
    setBusy(true); setError(null);
    try {
      const { error: err } = await supabase.rpc('join_household', { p_code: code.trim() });
      if (err) throw err;
      window.location.reload();
    } catch (err) {
      setError(err.message === 'Codice non valido' ? 'Codice non valido.' : (err.message || 'Non sono riuscito a collegarti a quella casa.'));
    } finally {
      setBusy(false);
    }
  };

  const copyCode = () => {
    if (!created) return;
    navigator.clipboard?.writeText(created.invite_code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }).catch(() => {});
  };

  if (created) {
    return (
      <Shell>
        <div style={{ background: t.card, borderRadius: t.radius, padding: '22px', boxShadow: t.shadow, textAlign: 'center' }}>
          <div style={{ width: 52, height: 52, borderRadius: '16px', background: `linear-gradient(145deg, ${t.mint}, #06B890)`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <Check size={26} color="#fff" strokeWidth={2.5} />
          </div>
          <div style={{ fontFamily: t.fontDisplay, fontSize: '17px', fontWeight: 700, color: t.text, marginBottom: '6px' }}>Casa creata!</div>
          <div style={{ fontSize: '13px', color: t.textSoft, marginBottom: '16px' }}>Dai questo codice al tuo partner: lo userà per unirsi alla tua casa.</div>
          <div onClick={copyCode} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', background: t.bg, border: `1.5px dashed ${t.coral}`, borderRadius: t.radiusSm, padding: '14px', cursor: 'pointer', marginBottom: '16px' }}>
            <div style={{ fontFamily: t.fontDisplay, fontSize: '26px', fontWeight: 800, letterSpacing: '4px', color: t.text }}>{created.invite_code}</div>
            {copied ? <Check size={18} color={t.mint} /> : <Copy size={18} color={t.textSoft} />}
          </div>
          <div style={{ fontSize: '12px', color: t.textSoft, marginBottom: '16px' }}>Lo trovi anche più tardi in Opzioni, se ora non hai modo di condividerlo.</div>
          <PrimaryButton onClick={() => window.location.reload()}>Continua <ArrowRight size={17} /></PrimaryButton>
        </div>
      </Shell>
    );
  }

  if (choice === 'join') {
    return (
      <Shell>
        <div style={{ background: t.card, borderRadius: t.radius, padding: '22px', boxShadow: t.shadow }}>
          <div style={{ fontFamily: t.fontDisplay, fontSize: '17px', fontWeight: 700, color: t.text, marginBottom: '4px' }}>Unisciti a una casa</div>
          <div style={{ fontSize: '13px', color: t.textSoft, marginBottom: '16px' }}>Inserisci il codice che ti ha mandato il tuo partner.</div>
          <ErrorBox msg={error} />
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Es. 3F9A2C" maxLength={12} style={{ width: '100%', textAlign: 'center', letterSpacing: '3px', fontSize: '20px', fontWeight: 700, textTransform: 'uppercase', border: `1.5px solid ${t.line}`, borderRadius: t.radiusSm, padding: '14px', marginBottom: '14px', color: t.text, background: t.card, boxSizing: 'border-box' }} />
          <PrimaryButton onClick={doJoin} busy={busy}>Unisciti <ArrowRight size={17} /></PrimaryButton>
          <button onClick={() => { setChoice(null); setError(null); }} style={{ width: '100%', marginTop: '12px', background: 'transparent', border: 'none', color: t.textSoft, fontSize: '13px', cursor: 'pointer' }}>Indietro</button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div style={{ background: t.card, borderRadius: t.radius, padding: '22px', boxShadow: t.shadow }}>
        <div style={{ fontFamily: t.fontDisplay, fontSize: '17px', fontWeight: 700, color: t.text, marginBottom: '4px' }}>Sei quasi pronto</div>
        <div style={{ fontSize: '13px', color: t.textSoft, marginBottom: '18px' }}>Crea la vostra casa, oppure unisciti a quella che ha già creato il tuo partner.</div>
        <ErrorBox msg={error} />
        <button onClick={doCreate} disabled={busy} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', background: t.bg, border: `1.5px solid ${t.line}`, borderRadius: t.radiusSm, padding: '14px', cursor: 'pointer', marginBottom: '10px', textAlign: 'left' }}>
          <div style={{ width: 38, height: 38, borderRadius: '12px', background: `linear-gradient(145deg, ${t.coral}, #FF8A5C)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Home size={19} color="#fff" /></div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '14px', color: t.text }}>Crea una nuova casa</div>
            <div style={{ fontSize: '12px', color: t.textSoft }}>Sei il primo dei due a registrarti</div>
          </div>
        </button>
        <button onClick={() => setChoice('join')} disabled={busy} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', background: t.bg, border: `1.5px solid ${t.line}`, borderRadius: t.radiusSm, padding: '14px', cursor: 'pointer', textAlign: 'left' }}>
          <div style={{ width: 38, height: 38, borderRadius: '12px', background: `linear-gradient(145deg, ${t.lavender}, #8B5CF6)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Users size={19} color="#fff" /></div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '14px', color: t.text }}>Ho un codice d'invito</div>
            <div style={{ fontSize: '12px', color: t.textSoft }}>Il tuo partner ha già creato la casa</div>
          </div>
        </button>
      </div>
    </Shell>
  );
}
