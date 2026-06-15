import React, { useRef, useState, useEffect } from 'react';
import { X, Download, Share2 } from 'lucide-react';
import { pointsForEntry, startOfWeek, getLevel } from './helpers';

// Genera un'immagine PNG (stile Instagram Story) con le statistiche settimanali.
export default function ShareCard({ data, choresById, totals, streaks, t, season, onClose }) {
  const canvasRef = useRef(null);
  const [dataUrl, setDataUrl] = useState(null);

  const users = data.users;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = 1080, H = 1920;
    canvas.width = W; canvas.height = H;

    // dati settimana
    const ws = startOfWeek();
    const weekPts = {};
    users.forEach((u) => { weekPts[u.id] = 0; });
    let weekCount = 0;
    data.log.forEach((e) => {
      if (new Date(e.timestamp) >= ws) {
        weekPts[e.userId] = (weekPts[e.userId] || 0) + pointsForEntry(e, choresById);
        weekCount++;
      }
    });

    // Sfondo gradiente
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, season.colors.coral);
    grad.addColorStop(1, season.colors.accent);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Card bianca centrale
    const cardX = 90, cardY = 320, cardW = W - 180, cardH = 1280;
    ctx.fillStyle = '#FFFFFF';
    roundRect(ctx, cardX, cardY, cardW, cardH, 60);
    ctx.fill();

    // Titolo
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 70px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🏠 Casa Points', W / 2, 180);
    ctx.font = '40px sans-serif';
    ctx.fillText('La nostra settimana', W / 2, 250);

    // Contenuto card
    ctx.fillStyle = '#2D2A4A';
    ctx.font = 'bold 48px sans-serif';
    ctx.fillText(`${weekCount} lavori completati`, W / 2, cardY + 110);

    // Punteggi utenti
    let y = cardY + 240;
    const sorted = [...users].sort((a, b) => (weekPts[b.id] || 0) - (weekPts[a.id] || 0));
    sorted.forEach((u, i) => {
      ctx.font = '90px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(u.emoji, cardX + 80, y + 30);

      ctx.fillStyle = '#2D2A4A';
      ctx.font = 'bold 56px sans-serif';
      ctx.fillText(u.name, cardX + 220, y);

      const lvl = getLevel(totals[u.id] || 0);
      ctx.fillStyle = '#6B6789';
      ctx.font = '36px sans-serif';
      ctx.fillText(`${lvl.emoji} ${lvl.title}`, cardX + 220, y + 50);

      ctx.fillStyle = u.color;
      ctx.font = 'bold 80px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${weekPts[u.id] || 0}`, cardX + cardW - 80, y + 20);
      ctx.font = '32px sans-serif';
      ctx.fillStyle = '#6B6789';
      ctx.fillText('punti', cardX + cardW - 80, y + 60);

      if (i === 0 && (weekPts[u.id] || 0) > 0) {
        ctx.font = '70px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('👑', cardX + 80, y - 90);
      }

      y += 260;
    });

    // Streak
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FF6B6B';
    ctx.font = 'bold 44px sans-serif';
    const maxStreak = Math.max(...users.map((u) => streaks[u.id] || 0));
    if (maxStreak > 0) {
      ctx.fillText(`🔥 Serie record: ${maxStreak} giorni`, W / 2, y + 20);
    }

    // Footer
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.font = 'bold 44px sans-serif';
    ctx.fillText('#CasaPoints', W / 2, H - 120);

    setDataUrl(canvas.toDataURL('image/png'));
  }, []);

  const handleDownload = () => {
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `casa-points-settimana.png`;
    a.click();
  };

  const handleShare = async () => {
    if (!dataUrl) return;
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], 'casa-points.png', { type: 'image/png' });
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Casa Points', text: 'La nostra settimana su Casa Points!' });
      } else {
        handleDownload();
      }
    } catch (e) {
      handleDownload();
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(45,42,74,0.6)', zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }} onClick={onClose}>
      <div className="pop-card" style={{ background: t.card, borderRadius: '24px', padding: '20px', maxWidth: '340px', width: '100%', position: 'relative' }} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} style={{ position: 'absolute', top: '12px', right: '12px', background: 'transparent', border: 'none', color: t.textSoft, cursor: 'pointer', zIndex: 2 }}><X size={20} /></button>
        <div className="display" style={{ fontSize: '17px', fontWeight: 700, color: t.text, marginBottom: '12px', textAlign: 'center' }}>Condividi la settimana</div>
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        {dataUrl && <img src={dataUrl} alt="Anteprima" style={{ width: '100%', borderRadius: '16px', marginBottom: '14px' }} />}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={handleDownload} style={{ flex: 1, background: t.card, border: `1px solid ${t.line}`, color: t.text, borderRadius: '12px', padding: '12px', fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer' }}><Download size={16} /> Salva</button>
          <button onClick={handleShare} style={{ flex: 1, background: t.coral, border: 'none', color: '#fff', borderRadius: '12px', padding: '12px', fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer' }}><Share2 size={16} /> Condividi</button>
        </div>
      </div>
    </div>
  );
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
