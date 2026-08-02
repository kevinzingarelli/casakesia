import React from 'react';

// Rete di sicurezza: senza questo, un errore in un qualsiasi componente
// (anche minore, es. una card di condivisione) manda in schermata bianca
// tutta l'app invece di mostrare solo un avviso.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, info) {
    console.error('Errore non gestito', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', padding: '24px', fontFamily: 'sans-serif', textAlign: 'center', background: '#FFF9F0' }}>
          <div style={{ fontSize: '40px' }}>😬</div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: '#2D2A4A' }}>Qualcosa è andato storto.</div>
          <div style={{ fontSize: '13px', color: '#6B6789' }}>I tuoi dati sono al sicuro sul server. Prova a ricaricare.</div>
          <button onClick={() => window.location.reload()} style={{ background: '#FF6B6B', border: 'none', color: '#fff', borderRadius: '12px', padding: '12px 24px', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}>Ricarica</button>
        </div>
      );
    }
    return this.props.children;
  }
}
