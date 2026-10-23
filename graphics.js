/* ===== CHELSEA GRAPHICS STUDIO — canvas renderer ===== */
const Studio = (() => {
  const SIZES = {
    story: { w: 1080, h: 1920, label: 'قصة 1080×1920' },
    portrait: { w: 1080, h: 1350, label: 'منشور رأسي 1080×1350' },
    square: { w: 1080, h: 1080, label: 'مربع 1080×1080' },
    landscape: { w: 1920, h: 1080, label: 'أفقي 1920×1080' },
    custom: { w: 1200, h: 1500, label: 'مقاس مخصص' }
  };
  const TEMPLATES = [
    { id: 'leaderboard', no: '01', name: 'الترتيب العام' },
    { id: 'matchday', no: '02', name: 'نتائج المباراة' },
    { id: 'podium', no: '03', name: 'منصة التتويج' },
    { id: 'champion', no: '04', name: 'بطل الجولة' },
    { id: 'stats', no: '05', name: 'إحصاءات الموسم' },
    { id: 'predictions', no: '06', name: 'توقعات المباراة' }
  ];
  const PRESETS = [
    { id: 'royal', name: 'الليل الملكي', bg1: '#020a1e', bg2: '#0b2f78', primary: '#0a4fb5', accent: '#d9b44a', leader: '#e8c25a', text: '#ffffff', muted: '#a9bde3', style: 'stadium' },
    { id: 'stamford', name: 'ستامفورد الذهبي', bg1: '#050c1a', bg2: '#16305c', primary: '#1b56b8', accent: '#f0cf78', leader: '#f0cf78', text: '#fffaf0', muted: '#b9c6de', style: 'chevron' },
    { id: 'silver', name: 'النسخة الفضية', bg1: '#08101f', bg2: '#27344f', primary: '#3b6fc7', accent: '#cfd8e6', leader: '#e9eef6', text: '#ffffff', muted: '#a7b4c9', style: 'minimal' },
    { id: 'matchnight', name: 'ليلة المباراة', bg1: '#00040f', bg2: '#03276b', primary: '#0057d9', accent: '#5fd0ff', leader: '#ffd166', text: '#ffffff', muted: '#9cc0f0', style: 'pitch' }
  ];
  const F = {
    display: '"Cairo", "IBM Plex Sans Arabic", "Segoe UI", Tahoma, sans-serif',
    body: '"IBM Plex Sans Arabic", "Segoe UI", Tahoma, sans-serif',
    num: '"Barlow Condensed", "IBM Plex Sans Arabic", "Arial Narrow", sans-serif'
  };
  const MEDAL = ['#e8c25a', '#cfd6e2', '#d08a52'];

  let fontsReady = null;
  function ensureFonts() {
    if (fontsReady) return fontsReady;
    const s = 'دوري توقعات البلوز 0123456789';
    const list = ['700 40px "Cairo"', '500 40px "Cairo"', '400 40px "IBM Plex Sans Arabic"', '500 40px "IBM Plex Sans Arabic"', '700 40px "IBM Plex Sans Arabic"', '700 40px "Barlow Condensed"', '800 40px "Barlow Condensed"', '600 40px "Barlow Condensed"'];
    fontsReady = Promise.race([
      Promise.all(list.map(f => document.fonts.load(f, s).catch(() => null))).then(() => document.fonts.ready),
      new Promise(r => setTimeout(r, 4000))
    ]);
    return fontsReady;
  }

  /* ---------- primitives ---------- */
  const setFont = (c, w, size, fam) => { c.font = `${w} ${Math.round(size)}px ${fam}`; };
  function fit(c, text, maxW, w, size, fam, minRatio = 0.55) {
    let s = size; setFont(c, w, s, fam);
    while (c.measureText(text).width > maxW && s > size * minRatio) { s -= Math.max(1, size * 0.03); setFont(c, w, s, fam); }
    if (c.measureText(text).width <= maxW) return text;
    let t = text; while (t.length > 2 && c.measureText(t + '…').width > maxW) t = t.slice(0, -1);
    return t + '…';
  }
  function txt(c, t, x, y, o = {}) {
    c.save();
    c.direction = o.dir || 'rtl';
    c.textAlign = o.align || 'right';
    c.textBaseline = o.base || 'middle';
    c.fillStyle = o.color || '#fff';
    if (o.font) setFont(c, o.font[0], o.font[1], o.font[2]);
    let s = String(t ?? '');
    if (o.maxW) s = fit(c, s, o.maxW, o.font[0], o.font[1], o.font[2], o.minRatio);
    if (o.spacing && 'letterSpacing' in c) c.letterSpacing = o.spacing + 'px';
    if (o.shadow) { c.shadowColor = 'rgba(0,0,0,.45)'; c.shadowBlur = o.shadow; c.shadowOffsetY = o.shadow / 3; }
    c.fillText(s, x, y);
    c.restore();
  }
  function rr(c, x, y, w, h, r) { c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, r) : c.rect(x, y, w, h); }
  function skew(c, x, y, w, h, k) { c.beginPath(); c.moveTo(x + k, y); c.lineTo(x + w, y); c.lineTo(x + w - k, y + h); c.lineTo(x, y + h); c.closePath(); }
  const alpha = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; };

  /* ---------- background ---------- */
  function background(c, W, H, P, u) {
    const g = c.createLinearGradient(0, 0, W * 0.35, H);
    g.addColorStop(0, P.bg2); g.addColorStop(0.55, P.bg1); g.addColorStop(1, P.bg1);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.save();
    if (P.style === 'stadium' || P.style === 'pitch') {
      [[0.08, -0.02], [0.92, -0.02]].forEach(([fx, fy]) => {
        const x = W * fx, y = H * fy;
        const rg = c.createRadialGradient(x, y, 0, x, y, W * 0.75);
        rg.addColorStop(0, 'rgba(255,255,255,.20)'); rg.addColorStop(0.25, 'rgba(160,200,255,.07)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = rg; c.fillRect(0, 0, W, H);
        c.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 3; i++) {
          const a = (fx < 0.5 ? 1 : -1) * (0.28 + i * 0.16);
          const bg = c.createLinearGradient(x, y, x + Math.sin(a) * H, y + H);
          bg.addColorStop(0, 'rgba(190,220,255,.10)'); bg.addColorStop(1, 'rgba(190,220,255,0)');
          c.fillStyle = bg; c.beginPath(); c.moveTo(x, y);
          c.lineTo(x + Math.sin(a - 0.06) * H * 1.2, y + H * 1.2); c.lineTo(x + Math.sin(a + 0.06) * H * 1.2, y + H * 1.2); c.closePath(); c.fill();
        }
        c.globalCompositeOperation = 'source-over';
      });
    }
    if (P.style === 'pitch' || P.style === 'stadium') {
      c.strokeStyle = 'rgba(255,255,255,.045)'; c.lineWidth = 3 * u;
      c.beginPath(); c.arc(W / 2, H * 1.02, W * 0.33, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.moveTo(0, H * 1.02); c.lineTo(W, H * 1.02); c.stroke();
      c.strokeRect(W * 0.2, H * 0.86, W * 0.6, H * 0.3);
    }
    if (P.style === 'chevron') {
      c.fillStyle = alpha(P.primary, 0.12);
      for (let i = -4; i < 14; i++) { const x = i * 150 * u; c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 60 * u, 0); c.lineTo(x + 60 * u + H * 0.45, H); c.lineTo(x + H * 0.45, H); c.closePath(); c.fill(); }
      const rg = c.createRadialGradient(W * 0.8, 0, 0, W * 0.8, 0, W);
      rg.addColorStop(0, alpha(P.accent, 0.16)); rg.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = rg; c.fillRect(0, 0, W, H);
    }
    if (P.style === 'minimal') {
      c.fillStyle = 'rgba(255,255,255,.05)';
      for (let y = 40 * u; y < H; y += 44 * u) for (let x = 40 * u; x < W; x += 44 * u) { c.beginPath(); c.arc(x, y, 1.6 * u, 0, 7); c.fill(); }
    }
    // geometric corner cut
    c.fillStyle = alpha(P.primary, 0.35);
    c.beginPath(); c.moveTo(W, H * 0.62); c.lineTo(W, H * 0.62 + 220 * u); c.lineTo(W - 220 * u, H); c.lineTo(W - 360 * u, H); c.closePath(); c.fill();
    const v = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.78);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.45)'); c.fillStyle = v; c.fillRect(0, 0, W, H);
    c.restore();
  }

  /* original emblem (not the club crest) */
  function crest(c, x, y, s, P, logo) {
    c.save();
    if (logo) {
      c.beginPath(); c.arc(x + s / 2, y + s / 2, s / 2, 0, 7); c.fillStyle = 'rgba(255,255,255,.08)'; c.fill();
      const r = Math.min(s / logo.width, s / logo.height) * 0.86;
      c.drawImage(logo, x + (s - logo.width * r) / 2, y + (s - logo.height * r) / 2, logo.width * r, logo.height * r);
      c.restore(); return;
    }
    const sh = () => { c.beginPath(); c.moveTo(x + s * 0.5, y); c.lineTo(x + s * 0.94, y + s * 0.14); c.lineTo(x + s * 0.9, y + s * 0.6); c.quadraticCurveTo(x + s * 0.84, y + s * 0.86, x + s * 0.5, y + s); c.quadraticCurveTo(x + s * 0.16, y + s * 0.86, x + s * 0.1, y + s * 0.6); c.lineTo(x + s * 0.06, y + s * 0.14); c.closePath(); };
    sh(); const g = c.createLinearGradient(x, y, x + s, y + s); g.addColorStop(0, P.primary); g.addColorStop(1, P.bg1); c.fillStyle = g; c.fill();
    c.lineWidth = s * 0.045; c.strokeStyle = P.accent; c.stroke();
    c.save(); sh(); c.clip();
    c.fillStyle = 'rgba(255,255,255,.08)'; c.fillRect(x, y + s * 0.62, s, s * 0.1);
    c.restore();
    // ball
    const cx = x + s * 0.5, cy = y + s * 0.44, r = s * 0.2;
    c.beginPath(); c.arc(cx, cy, r, 0, 7); c.fillStyle = '#fff'; c.fill();
    c.fillStyle = P.bg1; c.beginPath();
    for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * 2 * Math.PI / 5; c.lineTo(cx + Math.cos(a) * r * 0.42, cy + Math.sin(a) * r * 0.42); }
    c.closePath(); c.fill();
    c.strokeStyle = P.bg1; c.lineWidth = s * 0.018;
    for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * 2 * Math.PI / 5; c.beginPath(); c.moveTo(cx + Math.cos(a) * r * 0.42, cy + Math.sin(a) * r * 0.42); c.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); c.stroke(); }
    // three stars
    c.fillStyle = P.accent;
    [-1, 0, 1].forEach(k => star(c, cx + k * s * 0.13, y + s * 0.8, s * 0.045));
    c.restore();
  }
  function star(c, x, y, r) { c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.closePath(); c.fill(); }

  /* ---------- shared header / footer ---------- */
  function header(c, W, H, u, d, o, P, ctx) {
    const pad = ctx.pad, cs = (ctx.compact ? 104 : 132) * u;
    const y0 = pad;
    crest(c, W - pad - cs, y0, cs, P, d.logo);
    const tx = W - pad - cs - 30 * u, maxW = tx - pad;
    txt(c, (o.groupName || d.groupName || '').toUpperCase(), tx, y0 + 20 * u, { font: ['600', 25 * u, F.body], color: P.muted, maxW, spacing: 2 * u });
    txt(c, ctx.title || o.title || d.leagueName, tx, y0 + cs * 0.52, { font: ['700', (ctx.compact ? 56 : 68) * u, F.display], color: P.text, maxW, shadow: 12 * u });
    const sub = [d.seasonName && `موسم ${d.fmtSeason(d.seasonName)}`, ctx.sub].filter(Boolean).join('   •   ');
    txt(c, sub, tx, y0 + cs - 14 * u, { font: ['600', 27 * u, F.body], color: P.accent, maxW });
    return y0 + cs + 30 * u;
  }

  function matchStrip(c, x, y, w, h, m, d, P, u) {
    c.save();
    skew(c, x, y, w, h, 22 * u);
    const g = c.createLinearGradient(x, y, x + w, y); g.addColorStop(0, alpha(P.bg1, 0.85)); g.addColorStop(0.5, alpha(P.primary, 0.9)); g.addColorStop(1, alpha(P.bg1, 0.85));
    c.fillStyle = g; c.fill(); c.lineWidth = 2 * u; c.strokeStyle = alpha(P.accent, 0.6); c.stroke();
    const cx = x + w / 2, cy = y + h / 2, box = h * 0.74;
    const nameW = w / 2 - box * 1.4 - 40 * u;
    txt(c, 'تشلسي', x + w - 46 * u, cy, { font: ['700', h * 0.36, F.display], color: P.text, maxW: nameW });
    txt(c, m.opponent, x + 46 * u, cy, { font: ['700', h * 0.36, F.display], color: P.text, align: 'left', maxW: nameW });
    const finished = m.status === 'finished' && m.ch != null;
    if (finished) {
      [[cx + box * 0.72, m.ch], [cx - box * 0.72, m.op]].forEach(([bx, v]) => {
        rr(c, bx - box / 2, cy - box / 2, box, box, 10 * u); c.fillStyle = '#fff'; c.fill();
        txt(c, d.fmt(v), bx, cy + 2 * u, { font: ['800', box * 0.78, F.num], color: P.bg1, align: 'center', dir: 'ltr' });
      });
      txt(c, '–', cx, cy, { font: ['800', box * 0.42, F.num], color: P.accent, align: 'center', dir: 'ltr' });
      if (m.note) txt(c, m.note, cx, y + h + 22 * u, { font: ['600', 22 * u, F.body], color: P.muted, align: 'center' });
    } else {
      txt(c, m.status === 'postponed' ? 'مؤجلة' : m.status === 'cancelled' ? 'ملغاة' : 'ضد', cx, cy, { font: ['700', h * 0.34, F.display], color: P.accent, align: 'center' });
    }
    c.restore();
  }

  function footer(c, W, H, u, d, o, P, ctx, page, pages) {
    const pad = ctx.pad, y = H - pad * 0.62;
    c.save(); c.strokeStyle = alpha(P.text, 0.14); c.lineWidth = 2 * u; c.beginPath(); c.moveTo(pad, y - 34 * u); c.lineTo(W - pad, y - 34 * u); c.stroke(); c.restore();
    txt(c, d.updatedLabel, W - pad, y, { font: ['500', 22 * u, F.body], color: P.muted, maxW: W * 0.4 });
    if (o.footer) txt(c, o.footer, W / 2, y, { font: ['600', 23 * u, F.body], color: P.accent, align: 'center', maxW: W * 0.34 });
    if (pages > 1) txt(c, `${d.fmt(page + 1)}/${d.fmt(pages)}`, pad, y, { font: ['800', 30 * u, F.num], color: P.text, align: 'left', dir: 'ltr' });
    return y - 34 * u;
  }

  function arrow(c, x, y, s, up, color) { c.beginPath(); if (up) { c.moveTo(x, y - s * 0.6); c.lineTo(x + s * 0.6, y + s * 0.4); c.lineTo(x - s * 0.6, y + s * 0.4); } else { c.moveTo(x, y + s * 0.6); c.lineTo(x + s * 0.6, y - s * 0.4); c.lineTo(x - s * 0.6, y - s * 0.4); } c.closePath(); c.fillStyle = color; c.fill(); }

  function avatar(c, x, y, r, img, name, P) {
    c.save(); c.beginPath(); c.arc(x, y, r, 0, 7); c.closePath();
    if (img) { c.clip(); c.drawImage(img, x - r, y - r, r * 2, r * 2); }
    else { c.fillStyle = alpha(P.primary, 0.9); c.fill(); txt(c, (name || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join(' '), x, y + r * 0.04, { font: ['700', r * 0.8, F.display], color: '#fff', align: 'center' }); }
    c.restore();
    c.beginPath(); c.arc(x, y, r, 0, 7); c.lineWidth = Math.max(2, r * 0.08); c.strokeStyle = P.accent; c.stroke();
  }

  /* ---------- pagination helper ---------- */
  function paginate(n, avail, minRH, firstPageExtra = 0) {
    const per = Math.max(1, Math.floor(avail / minRH));
    if (n <= per) return { per, pages: 1 };
    return { per, pages: Math.ceil(n / per) };
  }

  /* ---------- 01 leaderboard ---------- */
  function drawLeaderboard(c, W, H, u, d, o, P, ctx, page) {
    let y = header(c, W, H, u, d, o, P, { ...ctx, sub: d.roundLabel });
    if (d.match) { matchStrip(c, ctx.pad, y, W - ctx.pad * 2, 92 * u, d.match, d, P, u); y += 92 * u + (d.match.note ? 50 : 30) * u; }
    const all = d.rows.slice(0, o.limit || d.rows.length);
    const bottom = H - ctx.pad * 0.62 - 54 * u;
    const headH = 42 * u;
    const cols = ctx.landscape && all.length > 8 ? 2 : 1;
    const avail = bottom - y - headH;
    const minRH = (o.detail === 'compact' ? 50 : 60) * u;
    const perCol = Math.max(1, Math.floor(avail / minRH));
    const per = perCol * cols;
    const pages = Math.max(1, Math.ceil(all.length / per));
    const pg = Math.min(page, pages - 1);
    const rows = all.slice(pg * per, pg * per + per);
    const rowsPerCol = Math.ceil(rows.length / cols);
    const rh = Math.min(108 * u, avail / Math.max(rowsPerCol, ctx.landscape ? 6 : 8));
    const gap = 24 * u, colW = (W - ctx.pad * 2 - gap * (cols - 1)) / cols;
    for (let k = 0; k < cols; k++) {
      const x0 = W - ctx.pad - k * (colW + gap), part = rows.slice(k * rowsPerCol, (k + 1) * rowsPerCol);
      table(c, x0, y, colW, headH, rh, part, d, o, P, u);
    }
    footer(c, W, H, u, d, o, P, ctx, pg, pages);
    return pages;
  }
  function table(c, xr, y, w, headH, rh, rows, d, o, P, u) {
    const showRound = o.showRound !== false, showChange = o.showChange !== false;
    const cPos = 92 * u, cChg = showChange ? 92 * u : 0, cRound = showRound ? 116 * u : 0, cTot = 140 * u;
    const xPos = xr - cPos / 2, xChg = xr - cPos - cChg / 2, xName = xr - cPos - cChg - 14 * u;
    const xTot = xr - w + cTot / 2, xRound = xr - w + cTot + cRound / 2;
    const nameW = xName - (xr - w + cTot + cRound) - 18 * u;
    const lab = { font: ['600', 21 * u, F.body], color: P.muted };
    txt(c, 'المركز', xPos, y + headH / 2, { ...lab, align: 'center' });
    if (showChange) txt(c, 'التغير', xChg, y + headH / 2, { ...lab, align: 'center' });
    txt(c, 'المشارك', xName, y + headH / 2, lab);
    if (showRound) txt(c, d.roundShort || 'الجولة', xRound, y + headH / 2, { ...lab, align: 'center' });
    txt(c, 'المجموع', xTot, y + headH / 2, { ...lab, align: 'center' });
    let ry = y + headH;
    rows.forEach((r, i) => {
      const top = r.pos <= 3 && r.total > 0, mc = MEDAL[r.pos - 1];
      const inset = 4 * u;
      skew(c, xr - w, ry + inset, w, rh - inset * 2, 14 * u);
      if (top) { const g = c.createLinearGradient(xr, 0, xr - w, 0); g.addColorStop(0, alpha(mc, r.pos === 1 ? 0.42 : 0.28)); g.addColorStop(0.7, alpha(P.primary, 0.32)); g.addColorStop(1, alpha(P.primary, 0.18)); c.fillStyle = g; }
      else c.fillStyle = i % 2 ? 'rgba(255,255,255,.055)' : 'rgba(255,255,255,.09)';
      c.fill();
      if (r.pos === 1 && r.total > 0) { c.lineWidth = 2.5 * u; c.strokeStyle = o.leaderColor || P.leader; c.stroke(); }
      const cy = ry + rh / 2;
      // position badge
      const bs = Math.min(rh - inset * 2 - 10 * u, 62 * u);
      skew(c, xPos - bs * 0.62, cy - bs / 2, bs * 1.24, bs, 10 * u);
      c.fillStyle = top ? mc : 'rgba(255,255,255,.12)'; c.fill();
      txt(c, (r.tied ? '=' : '') + d.fmt(r.pos), xPos, cy + 2 * u, { font: ['800', bs * 0.62, F.num], color: top ? P.bg1 : P.text, align: 'center', dir: 'ltr' });
      if (showChange) {
        if (r.change == null) txt(c, '—', xChg, cy, { font: ['700', 26 * u, F.num], color: P.muted, align: 'center' });
        else if (r.change === 0) { c.beginPath(); c.arc(xChg, cy, 7 * u, 0, 7); c.fillStyle = P.muted; c.fill(); }
        else { const up = r.change > 0; arrow(c, xChg + 16 * u, cy, 15 * u, up, up ? '#3ddc84' : '#ff5c6c'); txt(c, d.fmt(Math.abs(r.change)), xChg - 2 * u, cy + 1 * u, { font: ['800', 32 * u, F.num], color: up ? '#3ddc84' : '#ff5c6c', align: 'right', dir: 'ltr' }); }
      }
      let nx = xName;
      if (o.avatars && rh > 56 * u) { const ar = Math.min(rh * 0.34, 30 * u); avatar(c, nx - ar, cy, ar, r.img, r.name, P); nx -= ar * 2 + 14 * u; }
      const nameSize = Math.min(rh * 0.42, 38 * u);
      if (o.detail === 'full' && r.alias && rh > 74 * u) {
        txt(c, r.name, nx, cy - rh * 0.13, { font: ['700', nameSize, F.body], color: P.text, maxW: nameW - (xName - nx), minRatio: 0.5 });
        txt(c, r.alias, nx, cy + rh * 0.2, { font: ['500', nameSize * 0.6, F.body], color: P.muted, maxW: nameW - (xName - nx) });
      } else txt(c, r.name, nx, cy + 2 * u, { font: ['700', nameSize, F.body], color: P.text, maxW: nameW - (xName - nx), minRatio: 0.5 });
      if (showRound) txt(c, r.roundPts ? '+' + d.fmt(r.roundPts) : d.fmt(0), xRound, cy + 2 * u, { font: ['700', Math.min(rh * 0.48, 40 * u), F.num], color: r.roundPts ? P.accent : P.muted, align: 'center', dir: 'ltr' });
      txt(c, d.fmt(r.total), xTot, cy + 2 * u, { font: ['800', Math.min(rh * 0.62, 56 * u), F.num], color: P.text, align: 'center', dir: 'ltr' });
      ry += rh;
    });
  }

  /* ---------- 02 matchday results ---------- */
  function drawMatchday(c, W, H, u, d, o, P, ctx, page) {
    let y = header(c, W, H, u, d, o, P, { ...ctx, sub: d.roundLabel, title: 'نتائج التوقعات' });
    if (d.match) { matchStrip(c, ctx.pad, y, W - ctx.pad * 2, 92 * u, d.match, d, P, u); y += 92 * u + (d.match.note ? 50 : 26) * u; }
    const res = d.results || [];
    if (d.matchChampion?.names?.length) {
      const h = 64 * u; skew(c, ctx.pad, y, W - ctx.pad * 2, h, 16 * u); c.fillStyle = alpha(P.accent, 0.16); c.fill();
      txt(c, 'بطل المباراة', W - ctx.pad - 30 * u, y + h / 2, { font: ['600', 24 * u, F.body], color: P.accent });
      txt(c, d.matchChampion.names.join('، '), W - ctx.pad - 200 * u, y + h / 2, { font: ['700', 32 * u, F.display], color: P.text, maxW: W - ctx.pad * 2 - 360 * u });
      txt(c, d.fmt(d.matchChampion.pts) + ' نقاط', ctx.pad + 30 * u, y + h / 2, { font: ['700', 28 * u, F.body], color: P.accent, align: 'left' });
      y += h + 18 * u;
    }
    const bottom = H - ctx.pad * 0.62 - 54 * u, headH = 40 * u;
    const avail = bottom - y - headH, minRH = 58 * u;
    const per = Math.max(1, Math.floor(avail / minRH)), pages = Math.max(1, Math.ceil(res.length / per));
    const pg = Math.min(page, pages - 1), rows = res.slice(pg * per, pg * per + per);
    const rh = Math.min(96 * u, avail / Math.max(rows.length, 7));
    const xr = W - ctx.pad, w = W - ctx.pad * 2;
    const xPred = xr - w * 0.5, xSc = xr - w * 0.66, xPts = ctx.pad + w * 0.14, xTot = ctx.pad + 50 * u;
    const lab = { font: ['600', 21 * u, F.body], color: P.muted };
    txt(c, 'المشارك', xr - 20 * u, y + headH / 2, lab);
    txt(c, 'التوقع', xPred, y + headH / 2, { ...lab, align: 'center' });
    txt(c, 'الهداف الأول', xSc, y + headH / 2, lab);
    txt(c, 'التفصيل', xPts, y + headH / 2, { ...lab, align: 'center' });
    txt(c, 'النقاط', xTot, y + headH / 2, { ...lab, align: 'center' });
    let ry = y + headH;
    rows.forEach((r, i) => {
      skew(c, ctx.pad, ry + 3 * u, w, rh - 6 * u, 12 * u);
      c.fillStyle = r.perfect ? alpha(P.accent, 0.26) : i % 2 ? 'rgba(255,255,255,.05)' : 'rgba(255,255,255,.09)'; c.fill();
      if (r.perfect) { c.lineWidth = 2 * u; c.strokeStyle = P.accent; c.stroke(); }
      const cy = ry + rh / 2, fs = Math.min(rh * 0.4, 34 * u);
      let nx = xr - 20 * u;
      if (r.perfect) { c.fillStyle = P.accent; star(c, nx - 12 * u, cy, 13 * u); nx -= 34 * u; }
      txt(c, r.name, nx, cy + 2 * u, { font: ['700', fs, F.body], color: P.text, maxW: nx - (xPred + 70 * u), minRatio: 0.5 });
      txt(c, r.pred, xPred, cy + 2 * u, { font: ['800', fs * 1.15, F.num], color: r.pred === '—' ? P.muted : P.text, align: 'center', dir: 'ltr' });
      txt(c, r.scorer, xSc, cy + 2 * u, { font: ['500', fs * 0.82, F.body], color: r.sOk ? P.accent : P.muted, maxW: xSc - (xPts + 110 * u) });
      const chips = [['ف', r.w], ['ن', r.e], ['ه', r.s]];
      chips.forEach(([l, v], k) => {
        const cx = xPts + (1 - k) * 46 * u, on = v > 0;
        c.beginPath(); c.arc(cx, cy, 18 * u, 0, 7); c.fillStyle = on ? P.accent : 'rgba(255,255,255,.08)'; c.fill();
        txt(c, l, cx, cy + 1 * u, { font: ['700', 17 * u, F.body], color: on ? P.bg1 : P.muted, align: 'center' });
      });
      txt(c, r.pending ? d.fmt(r.total) + '*' : d.fmt(r.total), xTot, cy + 2 * u, { font: ['800', fs * 1.4, F.num], color: r.total ? P.text : P.muted, align: 'center', dir: 'ltr' });
      ry += rh;
    });
    if (res.some(r => r.pending)) txt(c, '* معيار الهداف الأول بانتظار التحقق', W / 2, ry + 26 * u, { font: ['500', 21 * u, F.body], color: P.muted, align: 'center' });
    footer(c, W, H, u, d, { ...o, footer: o.footer || 'ف: الفائز  ·  ن: النتيجة الدقيقة  ·  ه: الهداف الأول' }, P, ctx, pg, pages);
    return pages;
  }

  /* ---------- 03 podium ---------- */
  function drawPodium(c, W, H, u, d, o, P, ctx) {
    let y = header(c, W, H, u, d, o, P, { ...ctx, sub: d.roundLabel, title: o.title || 'منصة التتويج' });
    const groups = [1, 2, 3].map(p => d.rows.filter(r => r.pos === p && r.total > 0));
    const bottom = footer(c, W, H, u, d, o, P, ctx, 0, 1) - 40 * u;
    const avail = bottom - y;
    const bw = Math.min((W - ctx.pad * 2) / 3.2, 340 * u), gap = 22 * u, cx = W / 2;
    const order = [[0, cx], [1, cx + bw + gap], [2, cx - bw - gap]]; // index into groups: 2nd right, 1st center, 3rd left
    const heights = [avail * 0.42, avail * 0.31, avail * 0.23];
    // light burst behind 1st
    const rg = c.createRadialGradient(cx, bottom - heights[0], 0, cx, bottom - heights[0], bw * 1.8);
    rg.addColorStop(0, alpha(P.leader, 0.35)); rg.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = rg; c.fillRect(0, y, W, avail);
    order.forEach(([gi, x]) => {
      const g = groups[gi], h = heights[gi], top = bottom - h, mc = MEDAL[gi];
      // block
      c.beginPath(); c.moveTo(x - bw / 2, top); c.lineTo(x + bw / 2, top); c.lineTo(x + bw / 2 - 10 * u, bottom); c.lineTo(x - bw / 2 + 10 * u, bottom); c.closePath();
      const lg = c.createLinearGradient(0, top, 0, bottom); lg.addColorStop(0, alpha(P.primary, 0.95)); lg.addColorStop(1, alpha(P.bg1, 0.95)); c.fillStyle = lg; c.fill();
      c.fillStyle = mc; c.fillRect(x - bw / 2, top, bw, 10 * u);
      txt(c, d.fmt(gi + 1), x, top + h * 0.38, { font: ['800', Math.min(h * 0.5, 190 * u), F.num], color: alpha(mc, 0.95), align: 'center', dir: 'ltr' });
      if (!g.length) { txt(c, '—', x, top - 60 * u, { font: ['700', 40 * u, F.num], color: P.muted, align: 'center' }); return; }
      const total = g[0].total;
      txt(c, d.fmt(total) + ' نقطة', x, top + h * 0.78, { font: ['700', 34 * u, F.body], color: P.text, align: 'center', maxW: bw - 20 * u });
      const ar = (gi === 0 ? 86 : 68) * u;
      const names = g.map(r => r.name);
      const showAv = g.length === 1;
      let ny = top - 34 * u;
      if (names.length > 1) {
        names.slice(0, 4).reverse().forEach((n, k) => txt(c, n, x, ny - k * 40 * u, { font: ['700', 30 * u, F.body], color: P.text, align: 'center', maxW: bw + gap }));
        if (names.length > 4) txt(c, `+${d.fmt(names.length - 4)}`, x, ny - 4 * 40 * u, { font: ['700', 26 * u, F.body], color: P.accent, align: 'center' });
      } else {
        txt(c, names[0], x, ny, { font: ['700', (gi === 0 ? 44 : 36) * u, F.display], color: P.text, align: 'center', maxW: bw + gap, shadow: 10 * u });
        if (showAv) avatar(c, x, ny - 40 * u - ar, ar, g[0].img, names[0], { ...P, accent: mc });
      }
    });
    return 1;
  }

  /* ---------- 04 round champion ---------- */
  function drawChampion(c, W, H, u, d, o, P, ctx) {
    header(c, W, H, u, d, o, P, { ...ctx, sub: d.roundLabel });
    const ch = d.champion || { names: [], pts: 0 };
    const bottom = footer(c, W, H, u, d, o, P, ctx, 0, 1);
    const cy = (ctx.pad + 200 * u + bottom) / 2, cx = W / 2;
    // rays
    c.save(); c.translate(cx, cy - 60 * u);
    for (let i = 0; i < 24; i++) { c.rotate(Math.PI / 12); c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.min(W, H) * 0.9, -26 * u); c.lineTo(Math.min(W, H) * 0.9, 26 * u); c.closePath(); c.fillStyle = i % 2 ? alpha(P.accent, 0.05) : 'rgba(255,255,255,.025)'; c.fill(); }
    c.restore();
    // confetti
    let seed = 7; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    for (let i = 0; i < 70; i++) { c.save(); c.translate(rnd() * W, ctx.pad + 160 * u + rnd() * (bottom - ctx.pad - 200 * u)); c.rotate(rnd() * 6); c.fillStyle = [P.accent, '#fff', P.primary][i % 3]; c.globalAlpha = 0.5 + rnd() * 0.4; c.fillRect(0, 0, 14 * u, 5 * u); c.restore(); }
    const names = ch.names.length ? ch.names : ['لا يوجد بطل بعد'];
    const shown = names.slice(0, 3), nameSize = (shown.length > 1 ? 66 : 104) * u, lh = nameSize * 1.18;
    const parts = [['trophy', 230 * u], ['title', 70 * u], ...shown.map(n => ['name', lh, n]), ...(names.length > 3 ? [['more', 46 * u]] : []), ['num', 200 * u], ['label', 50 * u], ['msg', 70 * u]];
    const need = parts.reduce((t, x) => t + x[1], 0);
    const top0 = ctx.pad + (ctx.compact ? 104 : 132) * u + 40 * u, avail = bottom - 30 * u - top0;
    const k = Math.min(1, avail / need);
    let y = top0 + Math.max(0, (avail - need * k) / 2);
    for (const [kind, h, n] of parts) {
      const mid = y + h * k / 2;
      if (kind === 'trophy') trophy(c, cx, mid, 100 * u * k, P);
      if (kind === 'title') txt(c, `بطل الجولة ${d.fmt(ch.roundNo ?? '')}`, cx, mid, { font: ['700', 46 * u * Math.max(k, 0.8), F.display], color: P.accent, align: 'center' });
      if (kind === 'name') txt(c, n, cx, mid, { font: ['700', nameSize * k, F.display], color: P.text, align: 'center', maxW: W - ctx.pad * 2, shadow: 18 * u });
      if (kind === 'more') txt(c, `ومعهم ${d.fmt(names.length - 3)} آخرون`, cx, mid, { font: ['600', 30 * u * Math.max(k, 0.8), F.body], color: P.muted, align: 'center' });
      if (kind === 'num') txt(c, d.fmt(ch.pts), cx, mid, { font: ['800', 190 * u * k, F.num], color: P.leader, align: 'center', dir: 'ltr', shadow: 20 * u });
      if (kind === 'label') txt(c, 'نقطة في الجولة', cx, mid, { font: ['600', 34 * u * Math.max(k, 0.8), F.body], color: P.muted, align: 'center' });
      if (kind === 'msg') txt(c, o.message || d.championMessage || 'قراءة دقيقة للمباراة.. أداء يليق بالبلوز', cx, mid, { font: ['600', 36 * u * Math.max(k, 0.8), F.body], color: P.text, align: 'center', maxW: W - ctx.pad * 2 });
      y += h * k;
    }
    return 1;
  }
  function trophy(c, x, y, s, P) {
    c.save();
    const g = c.createLinearGradient(x - s, y - s, x + s, y + s); g.addColorStop(0, '#fff3c4'); g.addColorStop(0.45, P.leader); g.addColorStop(1, '#8a6a1d');
    c.fillStyle = g; c.strokeStyle = g; c.lineWidth = s * 0.09;
    c.beginPath(); c.moveTo(x - s * 0.55, y - s * 0.7); c.lineTo(x + s * 0.55, y - s * 0.7); c.quadraticCurveTo(x + s * 0.52, y + s * 0.05, x, y + s * 0.2); c.quadraticCurveTo(x - s * 0.52, y + s * 0.05, x - s * 0.55, y - s * 0.7); c.fill();
    c.beginPath(); c.arc(x - s * 0.56, y - s * 0.42, s * 0.24, Math.PI * 0.5, Math.PI * 1.5); c.stroke();
    c.beginPath(); c.arc(x + s * 0.56, y - s * 0.42, s * 0.24, -Math.PI * 0.5, Math.PI * 0.5); c.stroke();
    c.fillRect(x - s * 0.08, y + s * 0.18, s * 0.16, s * 0.28);
    rr(c, x - s * 0.36, y + s * 0.44, s * 0.72, s * 0.14, s * 0.03); c.fill();
    rr(c, x - s * 0.46, y + s * 0.58, s * 0.92, s * 0.16, s * 0.03); c.fill();
    c.fillStyle = P.bg1; star(c, x, y - s * 0.32, s * 0.16);
    c.restore();
  }

  /* ---------- 05 season stats ---------- */
  function drawStats(c, W, H, u, d, o, P, ctx) {
    let y = header(c, W, H, u, d, o, P, { ...ctx, title: o.title || 'إحصاءات الموسم', sub: d.roundLabel });
    const tiles = (d.stats || []).filter(t => t.value != null);
    const bottom = footer(c, W, H, u, d, o, P, ctx, 0, 1) - 30 * u;
    if (d.statsNote) { txt(c, d.statsNote, W / 2, bottom - 4 * u, { font: ['500', 21 * u, F.body], color: P.muted, align: 'center', maxW: W - ctx.pad * 2 }); }
    const area = bottom - y - 40 * u;
    const cols = ctx.landscape ? 3 : 2, rowsN = Math.max(1, Math.ceil(tiles.length / cols));
    const gap = 22 * u, tw = (W - ctx.pad * 2 - gap * (cols - 1)) / cols, th = Math.min(300 * u, (area - gap * (rowsN - 1)) / rowsN);
    if (!tiles.length) txt(c, 'لا توجد بيانات كافية لعرض الإحصاءات بعد', W / 2, y + area / 2, { font: ['600', 36 * u, F.body], color: P.muted, align: 'center' });
    tiles.forEach((t, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const x = W - ctx.pad - (col + 1) * tw - col * gap, ty = y + row * (th + gap);
      rr(c, x, ty, tw, th, 18 * u);
      const g = c.createLinearGradient(x, ty, x + tw, ty + th); g.addColorStop(0, alpha(P.primary, 0.55)); g.addColorStop(1, alpha(P.bg1, 0.7)); c.fillStyle = g; c.fill();
      c.lineWidth = 1.5 * u; c.strokeStyle = alpha(P.text, 0.14); c.stroke();
      const xr = x + tw - 28 * u;
      txt(c, t.label, xr, ty + 42 * u, { font: ['600', 25 * u, F.body], color: P.accent, maxW: tw - 56 * u });
      txt(c, t.valueText ?? d.fmt(t.value), xr, ty + th * 0.52, { font: ['800', Math.min(th * 0.42, 110 * u), F.num], color: P.text, dir: 'ltr', align: 'right' });
      if (t.who) txt(c, t.who, xr, ty + th - 40 * u, { font: ['700', 28 * u, F.body], color: P.text, maxW: tw - 56 * u });
    });
    return 1;
  }

  /* ---------- 06 pre-match predictions ---------- */
  function drawPredictions(c, W, H, u, d, o, P, ctx, page) {
    let y = header(c, W, H, u, d, o, P, { ...ctx, title: o.title || 'توقعات المباراة', sub: d.roundLabel });
    if (d.match) { matchStrip(c, ctx.pad, y, W - ctx.pad * 2, 92 * u, { ...d.match, status: 'scheduled' }, d, P, u); y += 92 * u + 20 * u; }
    const pr = d.predictions || { submitted: [], missing: [], rows: null };
    txt(c, pr.kickoffLabel || '', W / 2, y + 22 * u, { font: ['600', 26 * u, F.body], color: P.text, align: 'center' });
    txt(c, pr.lockLabel || '', W / 2, y + 60 * u, { font: ['700', 26 * u, F.body], color: P.accent, align: 'center' });
    y += 96 * u;
    const bottom = H - ctx.pad * 0.62 - 54 * u;
    let pages = 1, pg = 0;
    if (pr.rows && pr.rows.length) {
      const avail = bottom - y - 80 * u, minRH = 56 * u;
      const per = Math.max(1, Math.floor(avail / minRH)); pages = Math.ceil(pr.rows.length / per); pg = Math.min(page, pages - 1);
      const rows = pr.rows.slice(pg * per, pg * per + per), rh = Math.min(84 * u, avail / Math.max(rows.length, 8));
      const xr = W - ctx.pad, w = W - ctx.pad * 2;
      rows.forEach((r, i) => {
        skew(c, ctx.pad, y + 3 * u, w, rh - 6 * u, 12 * u); c.fillStyle = i % 2 ? 'rgba(255,255,255,.05)' : 'rgba(255,255,255,.09)'; c.fill();
        const cy = y + rh / 2, fs = Math.min(rh * 0.42, 32 * u);
        txt(c, r.name, xr - 24 * u, cy, { font: ['700', fs, F.body], color: P.text, maxW: w * 0.42 });
        txt(c, r.pred, xr - w * 0.55, cy, { font: ['800', fs * 1.2, F.num], color: P.text, align: 'center', dir: 'ltr' });
        txt(c, r.scorer, ctx.pad + 24 * u, cy, { font: ['500', fs * 0.85, F.body], color: P.muted, align: 'left', maxW: w * 0.3 });
        y += rh;
      });
    } else {
      txt(c, `قدم توقعاته ${d.fmt(pr.submitted.length)} من ${d.fmt(pr.submitted.length + pr.missing.length)}`, W - ctx.pad, y, { font: ['700', 30 * u, F.display], color: P.text });
      y += 40 * u;
      y = chips(c, pr.submitted, W, y, u, P, true, ctx, bottom - 160 * u);
      if (pr.missing.length) { txt(c, 'بانتظار توقعات', W - ctx.pad, y + 24 * u, { font: ['700', 28 * u, F.display], color: P.muted }); y = chips(c, pr.missing, W, y + 56 * u, u, P, false, ctx, bottom - 80 * u); }
    }
    txt(c, o.message || 'أرسل توقعك قبل صافرة البداية', W / 2, bottom - 30 * u, { font: ['700', 38 * u, F.display], color: P.accent, align: 'center', maxW: W - ctx.pad * 2 });
    footer(c, W, H, u, d, o, P, ctx, pg, pages);
    return pages;
  }
  function chips(c, names, W, y, u, P, on, ctx, maxY) {
    let x = W - ctx.pad; const h = 52 * u, gap = 12 * u;
    setFont(c, '600', 26 * u, F.body);
    let shown = 0;
    for (const n of names) {
      const t = fit(c, n, 360 * u, '600', 26 * u, F.body); setFont(c, '600', 26 * u, F.body);
      const w = c.measureText(t).width + 40 * u;
      if (x - w < ctx.pad) { x = W - ctx.pad; y += h + gap; }
      if (y + h > maxY) { txt(c, `+${names.length - shown}`, x - 10 * u, y - h / 2, { font: ['700', 26 * u, F.body], color: P.accent }); break; }
      rr(c, x - w, y, w, h, h / 2); c.fillStyle = on ? alpha(P.primary, 0.8) : 'rgba(255,255,255,.07)'; c.fill();
      if (on) { c.lineWidth = 1.5 * u; c.strokeStyle = alpha(P.accent, 0.7); c.stroke(); }
      txt(c, t, x - 20 * u, y + h / 2 + 1 * u, { font: ['600', 26 * u, F.body], color: on ? '#fff' : P.muted });
      x -= w + gap; shown++;
    }
    return y + h + 24 * u;
  }

  /* ---------- entry ---------- */
  function render(canvas, template, d, o = {}, page = 0) {
    const sz = o.size === 'custom' ? { w: Math.max(600, Math.min(4000, o.cw || 1200)), h: Math.max(600, Math.min(4000, o.ch || 1500)) } : SIZES[o.size || 'portrait'];
    const W = sz.w, H = sz.h;
    canvas.width = W; canvas.height = H;
    const c = canvas.getContext('2d');
    const u = Math.min(W, H) / 1080;
    const P = { ...PRESETS[0], ...(o.palette || {}) };
    const ctx = { pad: 64 * u, landscape: W > H * 1.2, compact: H < W * 1.1 };
    c.clearRect(0, 0, W, H);
    background(c, W, H, P, u);
    const fn = { leaderboard: drawLeaderboard, matchday: drawMatchday, podium: drawPodium, champion: drawChampion, stats: drawStats, predictions: drawPredictions }[template] || drawLeaderboard;
    return fn(c, W, H, u, d, o, P, ctx, page) || 1;
  }

  return { SIZES, TEMPLATES, PRESETS, render, ensureFonts };
})();
if (typeof module !== 'undefined') module.exports = Studio;
