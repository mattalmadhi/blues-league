/* ===== Chelsea Prediction League — application ===== */
(() => {
'use strict';
const E = Engine;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = (p = '') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const clone = o => JSON.parse(JSON.stringify(o ?? null));
const debounce = (f, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => f(...a), ms); }; };
const lsGet = k => { try { return JSON.parse(localStorage.getItem('cpl:' + k)); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem('cpl:' + k, JSON.stringify(v)); } catch { } };

/* ---------- state ---------- */
const S = {
  db: null, user: null, canEdit: false, uid: null, memory: false, ready: false,
  core: null, season: null, md: {}, hist: { opening: {}, rounds: [] }, imgs: {}, imgEls: {},
  view: lsGet('view') || 'home', param: null, tab: null, draft: {}, lateMode: {}, ver: 0,
  subs: {}, audit: null, member: null, mine: {}, mineDraft: {}, submitted: {}, codes: null, email: '', setupMissing: false, histRound: null, studioPage: 0, studioPages: 1, compFilter: '', extStats: false, h2h: [null, null]
};
const mem = {}; // memory-mode store

/* ---------- formatting ---------- */
const tz = () => S.core?.tz || 'Asia/Riyadh';
const nu = () => S.core?.numerals === 'arab' ? 'arab' : 'latn';
const fmt = n => n == null || n === '' ? '' : (typeof n === 'number' ? new Intl.NumberFormat('ar-SA-u-nu-' + nu(), { maximumFractionDigits: 2 }).format(n) : String(n).replace(/\d/g, d => nu() === 'arab' ? '٠١٢٣٤٥٦٧٨٩'[d] : d));
function fmtDate(iso, o = { dateStyle: 'medium', timeStyle: 'short' }) {
  if (!iso) return '—';
  try { return new Intl.DateTimeFormat(`ar-SA-u-ca-gregory-nu-${nu()}`, { timeZone: tz(), ...o }).format(new Date(iso)); } catch { return iso; }
}
function tzParts(ms, z) { const f = new Intl.DateTimeFormat('en-US', { timeZone: z, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }); return Object.fromEntries(f.formatToParts(new Date(ms)).map(x => [x.type, x.value])); }
function tzOffset(ms, z) { const p = tzParts(ms, z); return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - Math.floor(ms / 1000) * 1000; }
function localToISO(v) { if (!v) return ''; const [d, t = '00:00'] = v.split('T'); const [Y, M, D] = d.split('-').map(Number); const [h, m] = t.split(':').map(Number); const g = Date.UTC(Y, M - 1, D, h, m); return new Date(g - tzOffset(g, tz())).toISOString(); }
function isoToLocal(iso) { if (!iso) return ''; const p = tzParts(Date.parse(iso), tz()); return `${p.year}-${p.month}-${p.day}T${p.hour === '24' ? '00' : p.hour}:${p.minute}`; }
const todayISO = () => new Date().toISOString().slice(0, 10);
const scorerLabel = s => s === E.NONE ? 'لا يوجد هدف' : s === E.OG ? 'هدف عكسي' : (s || '—');

/* ---------- icons ---------- */
const I = (d, s = 22) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const IC = {
  home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>',
  ball: '<circle cx="12" cy="12" r="9"/><path d="M12 7l4 3-1.5 4.5h-5L8 10z"/><path d="M12 3v4M21 10l-5 0M3 10h5M7 20l2-5.5M17 20l-2-5.5"/>',
  table: '<path d="M4 6h16M4 12h16M4 18h16"/><path d="M8 4v16"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
  more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.5-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 010 7M18 14.8c1.8.8 3 2.6 3.5 5.2"/>',
  history: '<path d="M3 12a9 9 0 109-9 9.5 9.5 0 00-6.5 2.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>', back: '<path d="M9 6l6 6-6 6"/>', download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 01-8 0z"/><path d="M8 6H5a3 3 0 003 4M16 6h3a3 3 0 01-3 4M12 13v4M8 20h8"/>',
  test: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 002 3h10a2 2 0 002-3l-5-9V3"/>', book: '<path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2z"/><path d="M4 19V5"/>',
  log: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>', lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/>'
};

/* ---------- toast & modal ---------- */
function toast(msg, kind = 'ok') {
  const el = document.createElement('div'); el.className = 'toast ' + kind; el.textContent = msg; el.setAttribute('role', 'status');
  $('#toasts').appendChild(el); setTimeout(() => el.classList.add('out'), 3800); setTimeout(() => el.remove(), 4300);
}
function ask(title, bodyHtml, ok = 'تأكيد', danger = false) {
  return new Promise(res => {
    const m = $('#modal');
    m.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="mt"><h3 id="mt">${esc(title)}</h3><div class="sheet-body">${bodyHtml}</div><div class="row end"><button class="btn ghost" data-m="0">إلغاء</button><button class="btn ${danger ? 'danger' : 'primary'}" data-m="1">${esc(ok)}</button></div></div>`;
    m.hidden = false;
    const done = v => { m.hidden = true; m.innerHTML = ''; m.onclick = null; res(v); };
    m.onclick = e => { const b = e.target.closest('[data-m]'); if (b) done(b.dataset.m === '1'); else if (e.target === m) done(false); };
    setTimeout(() => $('[data-m="1"]', m)?.focus(), 30);
  });
}
function sheet(title, html) {
  const m = $('#modal');
  m.innerHTML = `<div class="sheet wide" role="dialog" aria-modal="true"><div class="row between"><h3>${esc(title)}</h3><button class="btn ghost sm" data-m="x">إغلاق</button></div><div class="sheet-body">${html}</div></div>`;
  m.hidden = false; m.onclick = e => { if (e.target === m || e.target.closest('[data-m="x"]')) { m.hidden = true; m.innerHTML = ''; } };
}

/* ---------- store ---------- */
const queues = {};
async function save(path, data) {
  setLocal(path, data);
  if (S.memory) { mem[path] = clone(data); return; }
  queues[path] = (queues[path] || Promise.resolve()).then(async () => {
    try { await S.db.doc(path).set(data); }
    catch (e) {
      if (e.code === 'unavailable') { await new Promise(r => setTimeout(r, 600 + Math.random() * 600)); await S.db.doc(path).set(data); }
      else throw e;
    }
  }).catch(e => { toast(e.code === 'quota_exceeded' ? 'امتلأت مساحة التخزين. احذف بيانات قديمة أو صور ثم أعد المحاولة' : e.code === 'invalid_argument' ? 'لا تملك صلاحية التعديل أو أن البيانات أكبر من المسموح' : 'تعذر الحفظ: ' + (e.message || e.code), 'err'); throw e; });
  return queues[path];
}
async function remove(path) {
  if (path.startsWith('md/')) delete S.md[path.slice(3)];
  if (path.startsWith('img/')) delete S.imgs[path.slice(4)];
  if (S.memory) { delete mem[path]; return; }
  await S.db.doc(path).delete();
}
function setLocal(path, data) {
  const [col, id] = path.split('/');
  if (col === 'league') S.core = clone(data);
  else if (col === 'seasons' && id === S.core?.currentSeasonId) S.season = clone(data);
  else if (col === 'md') S.md[id] = clone(data);
  else if (col === 'hist' && id === S.core?.currentSeasonId) S.hist = clone(data);
  else if (col === 'img') { S.imgs[id] = data.data; delete S.imgEls[id]; }
  S.ver++;
}
async function audit(action, detail = {}) {
  const doc = { ts: new Date().toISOString(), action, detail, seasonId: S.core?.currentSeasonId || null, by: S.uid || 'local' };
  if (S.memory) { (mem.audit ||= []).unshift(doc); return; }
  try { await S.db.collection('audit').doc(uid('a')).set(doc); } catch { }
}
async function getDoc(path) {
  if (S.memory) return clone(mem[path]);
  const s = await S.db.doc(path).get(); return s.exists ? s.data() : null;
}
async function getCol(col, field, val) {
  if (S.memory) return Object.entries(mem).filter(([k, v]) => k.startsWith(col + '/') && (!field || v?.[field] === val)).map(([k, v]) => ({ id: k.split('/')[1], data: clone(v) }));
  let q = S.db.collection(col); if (field) q = q.where(field, '==', val);
  const s = await q.limit(1000).get(); return s.docs.map(d => ({ id: d.id, data: d.data() }));
}

function subscribe() {
  if (S.memory) { S.ready = true; render(); return; }
  S.subs.core = S.db.doc('league/core').onSnapshot(s => {
    const prevSid = S.core?.currentSeasonId;
    S.core = s.exists ? clone(s.data()) : null; S.ver++;
    if (S.core?.currentSeasonId !== prevSid || !S.subs.season) subscribeSeason();
    S.ready = true; schedule();
  }, dbErr);
  S.subs.img = S.db.collection('img').onSnapshot(s => { s.docChanges().forEach(ch => { if (ch.type === 'removed') delete S.imgs[ch.doc.id]; else S.imgs[ch.doc.id] = ch.doc.data().data; delete S.imgEls[ch.doc.id]; }); S.ver++; schedule(); }, dbErr);
}
function subscribeSeason() {
  ['season', 'md', 'hist'].forEach(k => { S.subs[k]?.(); S.subs[k] = null; });
  S.season = null; S.md = {}; S.hist = { opening: {}, rounds: [] };
  const sid = S.core?.currentSeasonId; if (!sid) return;
  S.subs.season = S.db.doc('seasons/' + sid).onSnapshot(s => { S.season = s.exists ? clone(s.data()) : null; S.ver++; schedule(); }, dbErr);
  S.subs.md = S.db.collection('md').where('seasonId', '==', sid).onSnapshot(s => { s.docChanges().forEach(ch => { if (ch.type === 'removed') delete S.md[ch.doc.id]; else S.md[ch.doc.id] = clone(ch.doc.data()); }); S.ver++; schedule(); }, dbErr);
  S.subs.hist = S.db.doc('hist/' + sid).onSnapshot(s => { S.hist = s.exists ? clone(s.data()) : { opening: {}, rounds: [] }; S.ver++; schedule(); }, dbErr);
}
function dbErr(e) { if (e.code === 'revoked') { S.canEdit = false; toast('انتهت صلاحية الوصول لهذه الصفحة', 'err'); } else toast('انقطع الاتصال بالتخزين. أعد تحميل الصفحة', 'err'); }

/* re-render without destroying focused inputs */
let pendingRender = false;
function schedule() {
  const a = document.activeElement;
  if (a && $('#main')?.contains(a) && /INPUT|SELECT|TEXTAREA/.test(a.tagName) && !a.dataset.live) { pendingRender = true; return; }
  render();
}
document.addEventListener('focusout', () => setTimeout(() => { if (pendingRender) { const a = document.activeElement; if (!(a && $('#main')?.contains(a) && /INPUT|SELECT|TEXTAREA/.test(a.tagName))) { pendingRender = false; render(); } } }, 60));

/* ---------- derived ---------- */
const P = () => S.core?.participants || [];
const pById = id => P().find(p => p.id === id);
const pName = id => pById(id)?.name || 'مشارك محذوف';
const members = () => (S.season?.members || []).map(m => ({ ...pById(m.pid), ...m, pid: m.pid })).filter(m => m.name);
const activeMembers = () => members().filter(m => m.active !== false && pById(m.pid)?.active !== false);
const rounds = () => (S.season?.rounds || []).slice().sort((a, b) => a.no - b.no);
const roundById = id => S.season?.rounds?.find(r => r.id === id);
const comps = () => S.season?.comps || [];
const compName = id => comps().find(c => c.id === id)?.name || '';
const matchesSorted = () => (S.season?.matches || []).slice().sort((a, b) => (roundById(a.roundId)?.no ?? 0) - (roundById(b.roundId)?.no ?? 0) || (a.kickoff || '').localeCompare(b.kickoff || ''));
const matchById = id => S.season?.matches?.find(m => m.id === id);
const archived = () => S.core?.seasons?.find(s => s.id === S.season?.id)?.status === 'archived';
const canWrite = () => S.canEdit && !archived();
const lockTime = m => m.lockAt || m.kickoff;
const isLocked = m => !!lockTime(m) && Date.now() >= Date.parse(lockTime(m));

let compCache = { ver: -1 };
function compute(compId = '') {
  const key = S.ver + '|' + compId;
  if (compCache.key === key) return compCache.res;
  const res = S.season ? E.computeSeason({ season: S.season, members: members().map(m => ({ pid: m.pid, name: m.name })), md: S.md, hist: S.hist, compId: compId || null }) : { rows: [], snapshots: [], champions: {}, roundData: {}, conflicts: [], excluded: [], recon: {} };
  compCache = { key, res };
  return res;
}
function imgEl(id) {
  if (!id || !S.imgs[id]) return null;
  if (S.imgEls[id]?.complete) return S.imgEls[id];
  if (!S.imgEls[id]) { const im = new Image(); im.onload = () => { if (S.view === 'studio') drawStudio(); }; im.src = S.imgs[id]; S.imgEls[id] = im; }
  return S.imgEls[id].complete ? S.imgEls[id] : null;
}

/* ---------- defaults ---------- */
function defaultRules() { return { id: uid('rv'), name: 'القواعد الأساسية', effectiveFrom: '', ...E.DEFAULT_RULES, latePolicy: 'count' }; }
function newSeasonDoc(name, scope = 'pl') {
  const comps = scope === 'pl' ? [{ id: 'pl', name: 'الدوري الإنجليزي' }] : [{ id: 'pl', name: 'الدوري الإنجليزي' }, { id: 'ucl', name: 'دوري أبطال أوروبا' }, { id: 'fa', name: 'كأس الاتحاد' }, { id: 'lc', name: 'كأس الرابطة' }];
  return { id: uid('s'), name, scope, rankingScope: 'overall', comps, rounds: [], matches: [], members: [], rules: [defaultRules()], tiebreakers: ['exact', 'winner', 'scorer'], tbFair: true, histMode: 'none', startRound: 1, createdAt: new Date().toISOString() };
}
function defaultCore() {
  return { v: 1, leagueName: 'دوري توقعات البلوز', leagueNameEn: 'CHELSEA PREDICTION LEAGUE', groupName: '', tz: 'Asia/Riyadh', numerals: 'latn', reveal: 'afterLock', currentSeasonId: null, seasons: [], participants: [], squad: [], studio: null, presets: [], lastImage: null };
}

/* ---------- write helpers ---------- */
const saveCore = () => save('league/core', S.core);
const saveSeason = () => save('seasons/' + S.season.id, S.season);
const saveHist = () => save('hist/' + S.season.id, S.hist);
function mdOf(mid) { return S.md[mid] || { seasonId: S.season.id, matchId: mid, predictions: {}, result: null, approved: false, calc: null, history: [] }; }

/* ---------- views ---------- */
function layout(inner) {
  const nav = S.canEdit
    ? [['home', 'الرئيسية', IC.home], ['matches', 'المباريات', IC.ball], ['table', 'الترتيب', IC.table], ['studio', 'الاستوديو', IC.image], ['more', 'المزيد', IC.more]]
    : [['home', 'الرئيسية', IC.home], ['mine', 'توقعي', IC.edit], ['table', 'الترتيب', IC.table], ['matches', 'المباريات', IC.ball], ['more', 'المزيد', IC.more]];
  const moreViews = ['more', 'participants', 'profile', 'history', 'settings', 'audit', 'tests', 'guide', 'h2h', ...(S.canEdit ? [] : ['studio'])];
  const cur = moreViews.includes(S.view) ? 'more' : S.view === 'match' ? 'matches' : S.view;
  const s = S.core?.seasons?.find(x => x.id === S.core.currentSeasonId);
  return `
  <header class="top">
    <div class="brand"><span class="mark">${crestSVG()}</span><div><b>${esc(S.core?.leagueName || 'دوري توقعات البلوز')}</b><small>${esc(S.core?.groupName || S.core?.leagueNameEn || 'CHELSEA PREDICTION LEAGUE')}${s ? ' · ' + esc(fmt(s.name)) : ''}${s?.demo ? ' · تجريبي' : ''}</small></div></div>
    <div class="top-tools">${S.memory ? '<span class="pill warn" title="البيانات لا تحفظ في هذا العرض">عرض مؤقت</span>' : ''}${S.member && !S.canEdit ? `<span class="pill gold">${esc(pName(S.member.pid))}</span>` : ''}${archived() ? '<span class="pill">موسم مؤرشف</span>' : ''}
      ${S.memory ? '' : S.canEdit ? `<button class="icon-btn" data-act="logout" aria-label="تسجيل خروج المدير" title="تسجيل الخروج">${I('<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>', 20)}</button>` : `<button class="btn ghost sm" data-act="login">دخول المدير</button>`}
      <button class="icon-btn" data-act="theme" aria-label="تبديل المظهر">${I('<path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/>', 20)}</button></div>
  </header>
  <nav class="rail" aria-label="التنقل">${nav.map(([v, l, ic]) => `<button class="nav-i ${cur === v ? 'on' : ''}" data-go="${v}" ${cur === v ? 'aria-current="page"' : ''}>${I(ic)}<span>${l}</span></button>`).join('')}</nav>
  <main id="main" tabindex="-1">${inner}</main>`;
}
function crestSVG() { return `<svg viewBox="0 0 40 44" width="34" height="37" aria-hidden="true"><path d="M20 1l17 5-1.5 18C34 36 26 41 20 43 14 41 6 36 4.5 24L3 6z" fill="var(--blue)" stroke="var(--gold)" stroke-width="2"/><circle cx="20" cy="19" r="8" fill="#fff"/><path d="M20 14.5l4 2.9-1.5 4.6h-5L16 17.4z" fill="var(--blue-ink)"/><g fill="var(--gold)"><circle cx="14" cy="34" r="1.6"/><circle cx="20" cy="35" r="1.6"/><circle cx="26" cy="34" r="1.6"/></g></svg>`; }

function emptyState() {
  if (!S.canEdit) return `<section class="empty"><h1>لم تبدأ المسابقة بعد</h1><p>سيظهر الترتيب والنتائج هنا عندما ينشئ مدير المسابقة الموسم.</p></section>`;
  return `<section class="onboard">
    <h1 class="display">دوري توقعات البلوز</h1>
    <p class="lead">أنشئ الموسم، أضف المشاركين، أدخل رصيد الجولات السابقة، ثم اعتمد نتيجة كل مباراة لتحصل على الترتيب وصورة جاهزة للنشر.</p>
    <form class="card form" id="f-setup">
      <h2>إنشاء الموسم</h2>
      <label>اسم المسابقة<input id="su-name" value="دوري توقعات البلوز" required maxlength="60"></label>
      <label>اسم مجموعة المشجعين<input id="su-group" placeholder="مثال: رابطة البلوز - الرياض" maxlength="60"></label>
      <div class="grid2"><label>الموسم<input id="su-season" value="2026/2027" required maxlength="20"></label>
      <label>نطاق المباريات<select id="su-scope"><option value="pl">الدوري الإنجليزي فقط</option><option value="all">كل البطولات المختارة</option></select></label></div>
      <div class="grid2"><label>بداية الموسم<input type="date" id="su-start" value="2026-08-15"></label><label>نهاية الموسم<input type="date" id="su-end" value="2027-05-30"></label></div>
      <button class="btn primary lg" type="submit">${I(IC.check)} إنشاء الموسم</button>
    </form>
    <div class="card"><h2>تجربة سريعة</h2><p class="muted">تحميل موسم تجريبي فيه 12 مشاركا وخمس جولات سابقة ومباراة معتمدة. يحمل علامة "تجريبي" ويمكن حذفه بالكامل من الإعدادات.</p><button class="btn" data-act="demo-load">تحميل البيانات التجريبية</button></div>
  </section>`;
}

/* ----- home ----- */
function vHome() {
  const res = compute();
  const ms = matchesSorted();
  const done = ms.filter(m => S.md[m.id]?.approved);
  const last = done.slice().sort((a, b) => (b.kickoff || '').localeCompare(a.kickoff || ''))[0];
  const next = ms.filter(m => !S.md[m.id]?.approved && m.status === 'scheduled').sort((a, b) => (a.kickoff || '').localeCompare(b.kickoff || ''))[0];
  const leader = res.rows.filter(r => r.pos === 1 && r.total > 0);
  const ch = res.lastRound != null ? res.champions[res.lastRound] : null;
  const curRound = next ? roundById(next.roundId) : rounds().slice(-1)[0];
  const li = S.core.lastImage;
  const act = (a, l, ic, extra = '') => `<button class="qa" data-act="${a}" ${extra}>${I(ic)}<span>${l}</span></button>`;
  const memberCta = !S.canEdit && next && !isLocked(next) ? `<section class="cta card"><div><b>${S.member && S.mine[next.id] ? 'توقعك محفوظ' : 'سجل توقعك قبل صافرة البداية'}</b><span class="muted">تشلسي ضد ${esc(next.opponent)} · <span data-countdown="${lockTime(next)}">${countdown(lockTime(next))}</span></span></div><button class="btn primary" data-go="mine">${S.member && S.mine[next.id] ? 'تعديل توقعي' : 'توقعي'}</button></section>` : '';
  return `${memberCta}
  <section class="hero-strip">
    ${last ? matchCard(last, 'آخر مباراة') : `<div class="mcard empty-m"><span class="eyebrow">آخر مباراة</span><p>لا توجد مباراة معتمدة بعد</p></div>`}
    ${next ? matchCard(next, 'المباراة المقبلة') : `<div class="mcard empty-m"><span class="eyebrow">المباراة المقبلة</span><p>${canWrite() ? '<button class="btn sm" data-act="match-new">إضافة مباراة</button>' : 'لا توجد مباراة مجدولة'}</p></div>`}
  </section>
  ${canWrite() ? `<section class="quick" aria-label="إجراءات سريعة">
    ${act('match-new', 'إضافة مباراة', IC.plus)}${act('go-predict', 'إدخال توقعات', IC.edit)}${act('go-result', 'اعتماد نتيجة', IC.check)}
    ${act('go-history', 'إدخال نقاط سابقة', IC.history)}${act('go-table', 'عرض الترتيب', IC.table)}${act('go-studio', 'إنشاء صورة', IC.image)}
  </section>` : ''}
  <section class="kpis">
    <div class="kpi"><span>الجولة الحالية</span><b>${curRound ? fmt(curRound.no) : '—'}</b></div>
    <div class="kpi"><span>المشاركون</span><b>${fmt(activeMembers().length)}</b></div>
    <div class="kpi"><span>مباريات معتمدة</span><b>${fmt(done.length)}</b></div>
    <div class="kpi wide"><span>المتصدر</span><b class="name">${leader.length ? esc(leader.map(r => r.name).join('، ')) : '—'}</b>${leader.length ? `<em>${fmt(leader[0].total)} نقطة</em>` : ''}</div>
    <div class="kpi wide"><span>أعلى نقاط في آخر جولة</span><b class="name">${ch?.pids?.length ? esc(ch.pids.map(pName).join('، ')) : '—'}</b>${ch?.pids?.length ? `<em>${fmt(ch.pts)} نقاط · الجولة ${fmt(res.lastRound)}</em>` : ''}</div>
  </section>
  <section class="split">
    <div class="card"><div class="row between"><h2>الترتيب المختصر</h2><button class="btn ghost sm" data-go="table">الترتيب الكامل</button></div>${miniTable(res.rows.slice(0, 5))}</div>
    <div class="card"><h2>آخر صورة</h2>${li ? `<button class="thumb" data-go="studio"><img src="${li.thumb}" alt="معاينة آخر صورة"></button><p class="muted">${esc(Studio.TEMPLATES.find(t => t.id === li.template)?.name || '')} · ${fmtDate(li.at)}</p>` : '<p class="muted">لم تنشأ أي صورة بعد. افتح الاستوديو بعد اعتماد أول نتيجة.</p>'}</div>
  </section>`;
}
function matchCard(m, label) {
  const d = S.md[m.id], r = d?.result, ap = d?.approved;
  const n = S.canEdit || isLocked(m) ? Object.keys(d?.predictions || {}).length : (S.submitted[m.id] || []).length;
  return `<button class="mcard" data-open-match="${m.id}"><span class="eyebrow">${label} · ${esc(compName(m.compId))} · الجولة ${fmt(roundById(m.roundId)?.no)}</span>
    <div class="vs"><span>تشلسي</span><b class="score">${ap && r?.status === 'finished' ? `${fmt(r.ch)}<i>–</i>${fmt(r.op)}` : '<i>ضد</i>'}</b><span>${esc(m.opponent)}</span></div>
    <small>${m.home ? 'على أرضه' : 'خارج أرضه'} · ${fmtDate(m.kickoff)}${!ap ? ` · ${fmt(n)} توقعات` : ''}${statusPill(m)}</small></button>`;
}
function statusPill(m) {
  const d = S.md[m.id];
  if (m.status === 'postponed') return ' <span class="pill warn">مؤجلة</span>';
  if (m.status === 'cancelled') return ' <span class="pill">ملغاة</span>';
  if (d?.approved) return ' <span class="pill ok">معتمدة</span>';
  if (isLocked(m)) return ' <span class="pill warn">بانتظار النتيجة</span>';
  return ' <span class="pill">مفتوحة للتوقع</span>';
}
function miniTable(rows) {
  if (!rows.length) return '<p class="muted">يظهر الترتيب بعد إضافة المشاركين وإدخال النقاط.</p>';
  return `<ol class="mini">${rows.map(r => `<li><span class="pos p${r.pos}">${fmt(r.pos)}</span><span class="nm">${esc(r.name)}</span>${chg(r.change)}<b class="num">${fmt(r.total)}</b></li>`).join('')}</ol>`;
}
function chg(c) {
  if (c == null) return '<span class="chg flat" title="لا توجد جولة سابقة للمقارنة">—</span>';
  if (c === 0) return '<span class="chg flat" title="ثبات">●</span>';
  return c > 0 ? `<span class="chg up" title="صعود ${c}">▲${fmt(c)}</span>` : `<span class="chg down" title="هبوط ${-c}">▼${fmt(-c)}</span>`;
}

/* ----- matches ----- */
function vMatches() {
  const f = S.compFilter;
  const list = matchesSorted().filter(m => !f || m.compId === f);
  const byRound = {};
  list.forEach(m => (byRound[roundById(m.roundId)?.no ?? 0] ||= []).push(m));
  const rs = rounds();
  return `<div class="row between wrap"><h1>المباريات</h1>${canWrite() ? `<div class="row"><button class="btn" data-act="rounds-bulk">إنشاء جولات</button><button class="btn primary" data-act="match-new">${I(IC.plus, 18)} مباراة</button></div>` : ''}</div>
  ${comps().length > 1 ? `<div class="chips" role="tablist">${['', ...comps().map(c => c.id)].map(id => `<button class="chip ${f === id ? 'on' : ''}" data-comp="${id}">${id ? esc(compName(id)) : 'كل البطولات'}</button>`).join('')}</div>` : ''}
  ${!list.length ? `<div class="empty card"><p>لا توجد مباريات${rs.length ? '' : ' أو جولات'} بعد.</p>${canWrite() ? '<button class="btn primary" data-act="match-new">إضافة أول مباراة</button>' : ''}</div>` : ''}
  ${Object.keys(byRound).sort((a, b) => a - b).map(no => {
    const r = rs.find(x => x.no == no); const champ = compute().champions[no];
    return `<section class="round"><div class="row between"><h2>الجولة ${fmt(+no)}${r?.name ? ' · ' + esc(r.name) : ''}</h2>${champ?.pids?.length ? `<span class="pill gold">${I(IC.trophy, 14)} ${esc(champ.pids.map(pName).join('، '))} · ${fmt(champ.pts)}</span>` : ''}</div>
    <div class="mlist">${byRound[no].map(m => { const d = S.md[m.id]; const rr = d?.result; return `<button class="mrow" data-open-match="${m.id}"><span class="mr-comp">${esc(compName(m.compId))}</span><span class="mr-vs">تشلسي <b>${d?.approved && rr?.status === 'finished' ? `${fmt(rr.ch)} – ${fmt(rr.op)}` : 'ضد'}</b> ${esc(m.opponent)}</span><span class="mr-meta">${fmtDate(m.kickoff, { dateStyle: 'medium', timeStyle: 'short' })}${statusPill(m)}</span></button>`; }).join('')}</div></section>`;
  }).join('')}`;
}

function matchForm(m) {
  m = m || { roundId: '', compId: comps()[0]?.id, opponent: '', home: true, kickoff: '', status: 'scheduled' };
  const rs = rounds(), nextNo = (rs.slice(-1)[0]?.no || 0) + 1;
  const defRound = m.roundId || rs.find(r => !(S.season.matches || []).some(x => x.roundId === r.id))?.id || '__new';
  return `<form id="f-match" class="form" data-id="${m.id || ''}">
    <div class="grid2"><label>الجولة<select id="fm-round">${rs.map(r => `<option value="${r.id}" ${r.id === defRound ? 'selected' : ''}>الجولة ${fmt(r.no)}${r.name ? ' · ' + esc(r.name) : ''}</option>`).join('')}<option value="__new" ${defRound === '__new' ? 'selected' : ''}>جولة جديدة رقم ${fmt(nextNo)}</option></select></label>
    <label>رقم الجولة الجديدة<input id="fm-roundno" type="number" min="1" max="99" value="${nextNo}" inputmode="numeric"></label></div>
    <label>البطولة<select id="fm-comp">${comps().map(c => `<option value="${c.id}" ${c.id === m.compId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
    <label>الفريق المنافس<input id="fm-opp" value="${esc(m.opponent)}" required maxlength="40" placeholder="مثال: أرسنال"></label>
    <div class="grid2"><label>الملعب<select id="fm-home"><option value="1" ${m.home ? 'selected' : ''}>تشلسي على أرضه</option><option value="0" ${!m.home ? 'selected' : ''}>تشلسي خارج أرضه</option></select></label>
    <label>الحالة<select id="fm-status">${[['scheduled', 'مجدولة'], ['finished', 'انتهت'], ['postponed', 'مؤجلة'], ['cancelled', 'ملغاة']].map(([v, l]) => `<option value="${v}" ${m.status === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
    <div class="grid2"><label>موعد الانطلاق (${esc(tz())})<input id="fm-ko" type="datetime-local" value="${isoToLocal(m.kickoff)}" required></label>
    <label>إغلاق التوقعات<input id="fm-lock" type="datetime-local" value="${isoToLocal(m.lockAt)}" aria-describedby="lock-h"><small id="lock-h" class="muted">اتركه فارغا للإغلاق عند الانطلاق</small></label></div>
    <div class="row end">${m.id ? `<button type="button" class="btn danger ghost" data-act="match-del" data-id="${m.id}">${I(IC.trash, 18)} حذف</button>` : ''}<button class="btn primary" type="submit">${I(IC.check, 18)} حفظ المباراة</button></div>
  </form>`;
}

function vMatch() {
  const m = matchById(S.param);
  if (!m) return `<p>المباراة غير موجودة.</p><button class="btn" data-go="matches">العودة</button>`;
  const d = mdOf(m.id), tab = S.tab || (d.approved ? 'calc' : isLocked(m) ? 'result' : 'preds');
  const r = d.result;
  return `<button class="back" data-go="matches">${I(IC.back, 18)} المباريات</button>
  <section class="match-head">
    <span class="eyebrow">${esc(compName(m.compId))} · الجولة ${fmt(roundById(m.roundId)?.no)} · ${m.home ? 'على أرضه' : 'خارج أرضه'}</span>
    <div class="vs big"><span>تشلسي</span><b class="score">${d.approved && r?.status === 'finished' ? `${fmt(r.ch)}<i>–</i>${fmt(r.op)}` : '<i>ضد</i>'}</b><span>${esc(m.opponent)}</span></div>
    <small>${fmtDate(m.kickoff, { dateStyle: 'full', timeStyle: 'short' })} ${statusPill(m)} ${d.approved && d.appliedRules ? `<span class="pill">القواعد: ${esc(d.appliedRules.name || '')}</span>` : ''}</small>
  </section>
  <div class="tabs" role="tablist">${[['preds', 'التوقعات'], ['result', 'النتيجة والاعتماد'], ['calc', 'تفاصيل النقاط'], ...(canWrite() ? [['edit', 'بيانات المباراة']] : [])].map(([k, l]) => `<button role="tab" class="tab ${tab === k ? 'on' : ''}" aria-selected="${tab === k}" data-tab="${k}">${l}</button>`).join('')}</div>
  <div class="tabpanel">${tab === 'preds' ? predsPanel(m, d) : tab === 'result' ? resultPanel(m, d) : tab === 'calc' ? calcPanel(m, d) : matchForm(m)}</div>`;
}

function predsPanel(m, d) {
  if (!S.canEdit && !isLocked(m) && !d.approved) {
    const sub = (S.submitted[m.id] || []).filter(p => activeMembers().some(x => x.pid === p));
    const missing = activeMembers().filter(x => !sub.includes(x.pid));
    return `<div class="card"><p>تظهر التوقعات للجميع بعد إغلاق باب التوقع (${fmtDate(lockTime(m))}).</p><p class="muted">قدم توقعاته ${fmt(sub.length)} من ${fmt(activeMembers().length)}.</p>${missing.length ? `<p class="muted">بانتظار: ${esc(missing.map(x => x.name).join('، '))}</p>` : ''}${S.member ? `<button class="btn primary" data-go="mine">${I(IC.edit, 18)} توقعي لهذه المباراة</button>` : ''}</div>`;
  }
  const locked = isLocked(m), late = S.lateMode[m.id];
  const draft = S.draft[m.id] || {};
  const list = (d.approved ? members() : activeMembers());
  const editable = canWrite() && (!locked || late);
  const val = (pid, k) => { const v = draft[pid]?.[k] ?? d.predictions?.[pid]?.[k]; return v ?? ''; };
  const filled = list.filter(p => d.predictions?.[p.pid]).length;
  return `
  ${locked && canWrite() ? `<div class="banner ${late ? 'warn' : ''}">${I(IC.lock, 18)}<div><b>${late ? 'وضع الإدخال بعد الإغلاق مفعل' : 'أغلق باب التوقعات ' + fmtDate(lockTime(m))}</b><p>${late ? 'كل تعديل يسجل في سجل التدقيق. علّم التوقع "متأخر" إذا وصلك بعد الإغلاق، واتركه دون علامة إذا وصلك في الوقت عبر المجموعة.' : 'يمكنك إدخال توقعات وصلت في الوقت ولم تسجل بعد.'}</p></div>${late ? '' : `<button class="btn sm" data-act="late-on" data-id="${m.id}">إدخال بعد الإغلاق</button>`}</div>` : ''}
  ${canWrite() ? `<div class="row between wrap"><p class="muted">${fmt(filled)} من ${fmt(list.length)} توقعات مسجلة. ${d.approved ? 'المباراة معتمدة: الحفظ يعيد احتساب نقاطها.' : 'يحفظ تلقائيا بعد التوقف عن الكتابة.'}</p>
    <div class="row"><button class="btn sm" data-act="wa-open" data-id="${m.id}" ${editable ? '' : 'disabled'}>لصق من واتساب</button><button class="btn sm" data-act="pred-import" data-id="${m.id}" ${editable ? '' : 'disabled'}>استيراد CSV/Excel</button></div></div>` : ''}
  <div class="table-wrap"><table class="grid pred-grid" data-mid="${m.id}">
    <thead><tr><th scope="col">المشارك</th><th scope="col">تشلسي</th><th scope="col">${esc(m.opponent)}</th><th scope="col">الهداف الأول</th>${canWrite() ? '<th scope="col">متأخر</th>' : ''}${d.approved ? '<th scope="col">النقاط</th>' : ''}</tr></thead>
    <tbody>${list.map((p, i) => {
      const pr = d.predictions?.[p.pid]; const c = d.calc?.[p.pid];
      if (!editable) return `<tr><th scope="row">${esc(p.name)}</th><td class="num">${pr ? fmt(pr.ch) : '—'}</td><td class="num">${pr ? fmt(pr.op) : '—'}</td><td>${pr ? esc(scorerLabel(pr.scorer)) : '<span class="muted">لم يتوقع</span>'}</td>${canWrite() ? `<td>${pr?.late ? '<span class="pill warn">متأخر</span>' : ''}</td>` : ''}${d.approved ? `<td class="num"><b>${fmt(c?.total ?? 0)}</b></td>` : ''}</tr>`;
      return `<tr data-pid="${p.pid}" ${draft[p.pid] ? 'data-dirty="1"' : ''}><th scope="row">${esc(p.name)}${pr?.source === 'member' ? ' <span class="pill ok" title="أرسله العضو بنفسه">من العضو</span>' : ''}</th>
        <td><input class="sc" id="pc-${m.id}-${p.pid}" data-k="ch" inputmode="numeric" pattern="[0-9٠-٩]*" maxlength="2" value="${esc(val(p.pid, 'ch'))}" aria-label="أهداف تشلسي - ${esc(p.name)}" data-row="${i}" data-col="0"></td>
        <td><input class="sc" id="po-${m.id}-${p.pid}" data-k="op" inputmode="numeric" pattern="[0-9٠-٩]*" maxlength="2" value="${esc(val(p.pid, 'op'))}" aria-label="أهداف ${esc(m.opponent)} - ${esc(p.name)}" data-row="${i}" data-col="1"></td>
        <td><input class="scorer" id="ps-${m.id}-${p.pid}" data-k="scorer" list="squad-list" value="${esc(scorerLabelEdit(val(p.pid, 'scorer')))}" aria-label="الهداف الأول - ${esc(p.name)}" data-row="${i}" data-col="2" placeholder="اسم اللاعب"></td>
        <td><input type="checkbox" id="pl-${m.id}-${p.pid}" data-k="late" ${(draft[p.pid]?.late ?? pr?.late) ? 'checked' : ''} aria-label="توقع متأخر - ${esc(p.name)}"></td>
        ${d.approved ? `<td class="num"><b>${fmt(c?.total ?? 0)}</b></td>` : ''}</tr>`;
    }).join('')}</tbody></table></div>
  ${squadDatalist()}
  ${editable ? `<div class="row end sticky-actions"><button class="btn ghost" data-act="pred-clear" data-id="${m.id}">مسح غير المحفوظ</button><button class="btn primary" data-act="pred-save" data-id="${m.id}">${I(IC.check, 18)} ${d.approved ? 'حفظ وإعادة الاحتساب' : 'حفظ التوقعات'}</button></div>` : ''}`;
}
const scorerLabelEdit = v => v === E.NONE ? 'لا يوجد هدف' : v === E.OG ? 'هدف عكسي' : v;
const scorerFromInput = v => { const n = E.norm(v); if (!n) return ''; if (n === E.norm('لا يوجد هدف') || n === 'لا يوجد' || n === 'none') return E.NONE; if (n === E.norm('هدف عكسي') || n === 'og') return E.OG; return v.trim(); };
function squadDatalist() { return `<datalist id="squad-list"><option value="لا يوجد هدف"></option><option value="هدف عكسي"></option>${(S.core.squad || []).map(s => `<option value="${esc(s)}"></option>`).join('')}</datalist>`; }

function resultPanel(m, d) {
  const r = d.result || { status: 'finished', ch: '', op: '', extraTime: false, firstScorer: '', firstScorerOG: false, firstChelseaScorer: '', firstChelseaOG: false };
  const rules = E.ruleForDate(S.season.rules, m.kickoff);
  const dis = canWrite() ? '' : 'disabled';
  const v = x => x ?? '';
  return `<form id="f-result" class="form card" data-id="${m.id}">
    <div class="grid3"><label>الحالة<select id="fr-status" ${dis}>${[['finished', 'انتهت'], ['postponed', 'تأجلت'], ['cancelled', 'ألغيت']].map(([k, l]) => `<option value="${k}" ${r.status === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <label>أهداف تشلسي<input id="fr-ch" inputmode="numeric" value="${v(r.ch)}" ${dis}></label><label>أهداف ${esc(m.opponent)}<input id="fr-op" inputmode="numeric" value="${v(r.op)}" ${dis}></label></div>
    <label class="check"><input type="checkbox" id="fr-et" ${r.extraTime ? 'checked' : ''} ${dis}> امتدت المباراة لأشواط إضافية</label>
    <div class="grid2 et" ${r.extraTime ? '' : 'hidden'}><label>تشلسي نهاية الوقت الأصلي<input id="fr-ch90" inputmode="numeric" value="${v(r.ch90)}" ${dis}></label><label>${esc(m.opponent)} نهاية الوقت الأصلي<input id="fr-op90" inputmode="numeric" value="${v(r.op90)}" ${dis}></label>
    <label>الفائز بركلات الترجيح<select id="fr-pens" ${dis}><option value="">لم تحدث</option><option value="ch" ${r.pens === 'ch' ? 'selected' : ''}>تشلسي</option><option value="op" ${r.pens === 'op' ? 'selected' : ''}>${esc(m.opponent)}</option></select></label><p class="muted">ركلات الترجيح لا تدخل في احتساب النتيجة. السياسة الحالية: ${rules.etPolicy === 'regular' ? 'نتيجة الوقت الأصلي' : 'النتيجة بعد الأشواط الإضافية'}.</p></div>
    <div class="grid2"><label>أول لاعب سجل في المباراة<input id="fr-fs" list="squad-list" value="${esc(r.firstScorer || '')}" placeholder="اتركه فارغا إن لم يتأكد بعد" ${dis}></label>
    <label class="check"><input type="checkbox" id="fr-fsog" ${r.firstScorerOG ? 'checked' : ''} ${dis}> الهدف الأول عكسي</label></div>
    <div class="grid2"><label>أول لاعب سجل لتشلسي<input id="fr-fcs" list="squad-list" value="${esc(r.firstChelseaScorer || '')}" ${dis}></label>
    <label class="check"><input type="checkbox" id="fr-fcsog" ${r.firstChelseaOG ? 'checked' : ''} ${dis}> أول هدف لتشلسي عكسي</label></div>
    <label>تاريخ المباراة الفعلي<input type="datetime-local" id="fr-date" value="${isoToLocal(r.playedAt || m.kickoff)}" ${dis}></label>
    <p class="muted">القواعد المطبقة: ${esc(rules.name)} · الفائز ${fmt(rules.winner)} · النتيجة الدقيقة ${fmt(rules.exact)} · الهداف ${fmt(rules.scorer)} (${rules.scorerScope === 'chelsea' ? 'أول هداف لتشلسي' : 'أول هداف في المباراة'}). إن بقي الهداف فارغا يبقى معياره بانتظار التحقق دون منح أو خصم.</p>
    ${squadDatalist()}
    ${canWrite() ? `<div class="row end wrap">${d.approved ? `<button type="button" class="btn ghost danger" data-act="unapprove" data-id="${m.id}">إلغاء الاعتماد</button>` : ''}<button class="btn primary lg" type="submit">${I(IC.check)} ${d.approved ? 'تحديث النتيجة وإعادة الاحتساب' : 'اعتماد النتيجة واحتساب النقاط'}</button></div>` : ''}
  </form>
  ${d.history?.length ? `<details class="card"><summary>سجل تعديلات النتيجة (${fmt(d.history.length)})</summary><ul class="log">${d.history.slice().reverse().map(h => `<li>${fmtDate(h.at)} · كانت ${h.prev ? `${fmt(h.prev.ch)}–${fmt(h.prev.op)} · الهداف: ${esc(h.prev.firstScorer || 'غير محدد')}` : 'بلا نتيجة'}</li>`).join('')}</ul></details>` : ''}`;
}

function calcPanel(m, d) {
  if (!d.approved) return `<div class="card"><p>لم تعتمد نتيجة هذه المباراة بعد.</p>${canWrite() ? `<button class="btn primary" data-tab="result">اعتماد النتيجة</button>` : ''}</div>`;
  const rows = members().map(p => ({ p, c: d.calc?.[p.pid], pr: d.predictions?.[p.pid] })).sort((a, b) => (b.c?.total || 0) - (a.c?.total || 0));
  const R = d.appliedRules || {};
  const sc = s => ({ ok: '<span class="pill ok">صحيح</span>', miss: '<span class="pill">خطأ</span>', pending: '<span class="pill warn">بانتظار التحقق</span>', none: '—', na: '—' }[s] || '—');
  return `<p class="muted">اعتمدت ${fmtDate(d.approvedAt)} وفق "${esc(R.name || '')}": الفائز ${fmt(R.winner)} · النتيجة ${fmt(R.exact)} · الهداف ${fmt(R.scorer)}${R.perfectBonus ? ` · مكافأة التوقع المثالي ${fmt(R.perfectBonus)}` : ''}.</p>
  <div class="row"><button class="btn sm" data-act="studio-match" data-id="${m.id}">${I(IC.image, 16)} صورة نتائج المباراة</button></div>
  <div class="table-wrap"><table class="grid"><thead><tr><th>المشارك</th><th>التوقع</th><th>الهداف</th><th>الفائز</th><th>النتيجة</th><th>الهداف</th><th>المجموع</th></tr></thead>
  <tbody>${rows.map(({ p, c, pr }) => `<tr><th scope="row">${esc(p.name)}${pr?.late ? ' <span class="pill warn">متأخر</span>' : ''}</th><td class="num">${pr ? `${fmt(pr.ch)}–${fmt(pr.op)}` : '<span class="muted">لم يتوقع</span>'}</td><td>${pr ? esc(scorerLabel(pr.scorer)) : '—'}</td>
  <td class="num">${c?.w ? '+' + fmt(c.w) : fmt(0)}</td><td class="num">${c?.e ? '+' + fmt(c.e) : fmt(0)}</td><td>${sc(c?.scorerStatus)}</td><td class="num"><b>${fmt(c?.total ?? 0)}</b></td></tr>`).join('')}</tbody></table></div>`;
}

/* ----- leaderboard ----- */
function vTable() {
  const cf = S.season.rankingScope === 'perComp' ? S.compFilter : '';
  const res = compute(cf);
  const ext = S.extStats;
  return `<div class="row between wrap"><h1>الترتيب</h1><div class="row"><label class="check sm"><input type="checkbox" data-act="ext" ${ext ? 'checked' : ''}> إحصاءات موسعة</label><button class="btn sm" data-go="h2h">مقارنة مشاركين</button><button class="btn primary sm" data-act="go-studio">${I(IC.image, 16)} صورة</button></div></div>
  ${S.season.rankingScope === 'perComp' && comps().length > 1 ? `<div class="chips">${['', ...comps().map(c => c.id)].map(id => `<button class="chip ${cf === id ? 'on' : ''}" data-comp="${id}">${id ? esc(compName(id)) : 'الترتيب العام'}</button>`).join('')}</div>${cf ? '<p class="muted">ترتيب البطولة يشمل المباريات المسجلة فيها فقط، ولا يشمل الأرصدة التاريخية.</p>' : ''}` : ''}
  <p class="muted">${res.lastRound != null ? `حتى الجولة ${fmt(res.lastRound)}.` : ''} ${res.prevRound != null ? `التغير مقارنة بترتيب الجولة ${fmt(res.prevRound)} المعتمدة.` : 'يظهر التغير بعد توفر جولتين معتمدتين للمقارنة.'}</p>
  ${!res.rows.length ? '<div class="empty card"><p>أضف المشاركين لبدء الترتيب.</p></div>' : `<div class="table-wrap"><table class="grid board">
  <thead><tr><th>المركز</th><th>المشارك</th><th>لعب</th><th>نقاط الجولة</th><th>المجموع</th><th>التغير</th>${ext ? '<th>دقيقة</th><th>فائز</th><th>هداف</th><th>متوسط</th><th>تاريخي</th>' : ''}<th><span class="sr">تفاصيل</span></th></tr></thead>
  <tbody>${res.rows.map(r => `<tr class="${r.pos <= 3 && r.total > 0 ? 'top' + r.pos : ''}"><td><span class="pos p${r.pos}">${fmt(r.pos)}</span></td><th scope="row"><button class="link" data-profile="${r.pid}">${esc(r.name)}</button>${r.tieSkipped ? ' <span class="pill" title="تساو لم يفصل لنقص بيانات تاريخية">=</span>' : ''}</th>
  <td class="num">${fmt(r.played)}</td><td class="num">${r.roundLast ? '+' + fmt(r.roundLast) : fmt(0)}</td><td class="num total">${fmt(r.total)}</td><td>${chg(r.change)}</td>
  ${ext ? `<td class="num">${fmt(r.stats.exact)}</td><td class="num">${fmt(r.stats.winner)}</td><td class="num">${fmt(r.stats.scorer)}</td><td class="num">${r.avg != null ? fmt(Math.round(r.avg * 100) / 100) : '—'}</td><td class="num">${fmt(r.histPts)}</td>` : ''}
  <td><button class="btn ghost sm" data-why="${r.pid}">لماذا؟</button></td></tr>`).join('')}</tbody></table></div>`}
  ${rankChart(res)}
  ${achievementsBlock(res)}`;
}
function rankChart(res) {
  const snaps = res.snapshots; if (snaps.length < 2) return '';
  const top = res.rows.slice(0, 5);
  const n = Math.max(...res.rows.map(r => r.pos), 2), W = 640, H = 240, pl = 30, pr = 90, pt = 16, pb = 30;
  const x = i => pl + i * (W - pl - pr) / (snaps.length - 1), y = p => pt + (p - 1) * (H - pt - pb) / Math.max(n - 1, 1);
  const colors = ['var(--gold)', 'var(--blue-hi)', 'var(--fg)', 'var(--sky)', 'var(--muted)'];
  return `<section class="card"><h2>تطور المراكز</h2><div class="table-wrap"><svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="تطور مراكز أول خمسة مشاركين" direction="ltr">
    ${[1, Math.ceil(n / 2), n].map(p => `<line x1="${pl}" x2="${W - pr}" y1="${y(p)}" y2="${y(p)}" class="gl"/><text x="${pl - 8}" y="${y(p) + 4}" class="ax" text-anchor="end">${fmt(p)}</text>`).join('')}
    ${snaps.map((s, i) => `<text x="${x(i)}" y="${H - 8}" class="ax" text-anchor="middle">${s.opening ? 'افتتاحي' : 'ج' + fmt(s.roundNo)}</text>`).join('')}
    ${top.map((r, k) => { const pts = snaps.map((s, i) => [x(i), y(s.pos[r.pid] || n)]); return `<polyline fill="none" stroke="${colors[k]}" stroke-width="2.5" points="${pts.map(p => p.join(',')).join(' ')}"/>${pts.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="${colors[k]}"/>`).join('')}<text x="${W - pr + 8}" y="${pts[pts.length - 1][1] + 4}" fill="${colors[k]}" class="lbl">${esc(r.name.slice(0, 14))}</text>`; }).join('')}
  </svg></div></section>`;
}
function achievementsBlock(res) {
  const a = E.achievements(res, S.season, S.md); if (!a.length) return '';
  return `<section class="card"><h2>الأوسمة</h2><p class="muted">الأوسمة لا تغير النقاط.</p><div class="badges">${a.map(x => `<div class="badge"><span class="eyebrow">${esc(x.title)}</span><b>${esc(x.ar)}</b><span>${esc(x.pids.map(pName).join('، '))}${x.value != null ? ` · ${fmt(x.value)}` : ''}</span><small>${esc(x.crit)}</small></div>`).join('')}</div></section>`;
}
function whySheet(pid) {
  const res = compute(); const r = res.rows.find(x => x.pid === pid); if (!r) return;
  const lines = [];
  const op = S.hist.opening?.[pid];
  if (S.season.histMode === 'opening' && op?.points) lines.push([`رصيد افتتاحي حتى الجولة ${fmt(S.season.startRound - 1)}`, op.points, op.note || '']);
  if (S.season.histMode === 'rounds') (S.hist.rounds || []).filter(h => h.pid === pid && h.roundNo < S.season.startRound).sort((a, b) => a.roundNo - b.roundNo).forEach(h => { const c = res.conflicts.find(x => x.id === h.id); lines.push([`سجل الجولة ${fmt(h.roundNo)}${c ? ' (غير محتسب: ' + c.reason + ')' : ''}`, c ? 0 : h.points, h.note || '']); });
  matchesSorted().forEach(m => { const d = S.md[m.id]; if (!d?.approved) return; const ex = res.excluded.find(x => x.matchId === m.id); const c = d.calc?.[pid]; const pr = d.predictions?.[pid];
    const parts = c ? [c.w && `فائز +${c.w}`, c.e && `نتيجة دقيقة +${c.e}`, c.s && `هداف +${c.s}`, c.b && `مكافأة +${c.b}`, c.scorerStatus === 'pending' && 'الهداف بانتظار التحقق'].filter(Boolean).join(' · ') : '';
    lines.push([`ج${fmt(roundById(m.roundId)?.no)} · ${m.opponent}${ex ? ' (مشمولة بالرصيد الافتتاحي)' : ''}`, ex ? 0 : (c?.total || 0), pr ? `توقع ${fmt(pr.ch)}–${fmt(pr.op)}، ${scorerLabel(pr.scorer)}. ${parts || 'لا نقاط'}` : 'لم يتوقع']); });
  const sum = lines.reduce((s, l) => s + Number(l[1] || 0), 0);
  sheet(`أسباب نقاط ${r.name}`, `<div class="table-wrap"><table class="grid"><thead><tr><th>المصدر</th><th>النقاط</th><th>التفصيل</th></tr></thead><tbody>${lines.map(l => `<tr><td>${esc(l[0])}</td><td class="num">${fmt(Number(l[1]))}</td><td>${esc(l[2])}</td></tr>`).join('')}</tbody><tfoot><tr><th>المجموع</th><td class="num"><b>${fmt(sum)}</b></td><td>${sum === r.total ? '<span class="pill ok">مطابق للترتيب</span>' : '<span class="pill warn">غير مطابق</span>'}</td></tr></tfoot></table></div>`);
}

/* ----- participants ----- */
function vParticipants() {
  const q = E.norm(S.tab || '');
  const res = compute();
  const list = members().filter(m => !q || E.norm(m.name).includes(q) || E.norm(m.alias || '').includes(q));
  if (S.canEdit && !S.memory && S.codes === null) loadCodes();
  return `<div class="row between wrap"><h1>المشاركون</h1>${canWrite() ? `<div class="row wrap">${S.memory ? '' : '<button class="btn" data-act="codes-all">روابط لكل المشاركين</button>'}<button class="btn" data-act="p-bulk">إضافة دفعة</button><button class="btn primary" data-act="p-new">${I(IC.plus, 18)} مشارك</button></div>` : ''}</div>
  ${S.canEdit && !S.memory ? '<p class="muted">لكل مشارك رابط شخصي يسجل منه توقعه قبل المباراة دون حساب. أرسله له في واتساب مرة واحدة، ويبقى محفوظا على جواله.</p>' : ''}
  <label class="search"><span class="sr">بحث</span><input id="p-search" type="search" placeholder="ابحث بالاسم أو اللقب" value="${esc(S.tab || '')}" data-live="1"></label>
  <div class="plist">${list.map(m => { const r = res.rows.find(x => x.pid === m.pid); return `<div class="prow ${m.active === false || pById(m.pid)?.active === false ? 'off' : ''}">
    ${avatarHTML(m)}<button class="link nm" data-profile="${m.pid}"><b>${esc(m.name)}</b>${m.alias ? `<small>${esc(m.alias)}</small>` : ''}</button>
    <span class="num">${r ? fmt(r.pos) + ' · ' + fmt(r.total) + ' نقطة' : ''}</span>
    ${canWrite() ? `<button class="btn ghost sm" data-act="p-edit" data-id="${m.pid}">${I(IC.edit, 16)}<span class="sr">تعديل</span></button>` : ''}
    ${S.canEdit && !S.memory ? codeCell(m) : ''}</div>`; }).join('') || '<p class="muted">لا يوجد مشاركون بعد.</p>'}</div>`;
}
function avatarHTML(p, size = 40) { const src = p.img && S.imgs[p.img]; return src ? `<img class="av" src="${src}" alt="" width="${size}" height="${size}">` : `<span class="av" style="width:${size}px;height:${size}px">${esc((p.name || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join(''))}</span>`; }
function participantForm(p) {
  p = p || { name: '', alias: '', active: true };
  const mem = S.season.members.find(x => x.pid === p.id);
  return `<form id="f-part" class="form" data-id="${p.id || ''}">
    <label>الاسم<input id="fp-name" value="${esc(p.name)}" required maxlength="40"></label>
    <label>اللقب أو الاسم المستعار<input id="fp-alias" value="${esc(p.alias || '')}" maxlength="40"></label>
    <div class="grid2"><label>تاريخ الانضمام<input type="date" id="fp-joined" value="${esc(mem?.joined || todayISO())}"></label>
    <label>الصورة الشخصية<input type="file" id="fp-img" accept="image/*"></label></div>
    <label class="check"><input type="checkbox" id="fp-active" ${p.active !== false && mem?.active !== false ? 'checked' : ''}> مشارك فعال</label>
    <div class="row end">${p.id ? `<button type="button" class="btn ghost danger" data-act="p-del" data-id="${p.id}">حذف</button>` : ''}<button class="btn primary">${I(IC.check, 18)} حفظ</button></div></form>`;
}
function vProfile() {
  const pid = S.param, p = pById(pid); if (!p) return '<p>غير موجود</p>';
  const res = compute(), r = res.rows.find(x => x.pid === pid);
  if (!r) return `<p>${esc(p.name)} ليس مشاركا في هذا الموسم.</p>`;
  const hist = r.histPts > 0;
  const st = (l, v, n = '') => `<div class="kpi"><span>${l}</span><b>${v}</b>${n ? `<em>${n}</em>` : ''}</div>`;
  const ph = r.posHistory;
  return `<button class="back" data-go="table">${I(IC.back, 18)} الترتيب</button>
  <section class="profile-head">${avatarHTML(p, 72)}<div><h1>${esc(p.name)}</h1>${p.alias ? `<p class="muted">${esc(p.alias)}</p>` : ''}</div><span class="pos big p${r.pos}">${fmt(r.pos)}</span></section>
  <section class="kpis">
    ${st('مجموع الموسم', fmt(r.total), hist ? `منها ${fmt(r.histPts)} تاريخية` : '')}${st('المركز الحالي', fmt(r.pos), chg(r.change))}${st('توقعات مسجلة', fmt(r.played))}
    ${st('توقع الفائز', fmt(r.stats.winner))}${st('نتائج دقيقة', fmt(r.stats.exact))}${st('الهداف الأول', fmt(r.stats.scorer), r.stats.pending ? `${fmt(r.stats.pending)} بانتظار التحقق` : '')}
    ${st('متوسط النقاط', r.avg != null ? fmt(Math.round(r.avg * 100) / 100) : '—', 'للمباريات المسجلة')}${st('أفضل جولة', r.bestRound ? `${fmt(r.bestRound.pts)}` : '—', r.bestRound ? `الجولة ${fmt(r.bestRound.no)}` : '')}${st('أعلى مركز', fmt(r.bestPos))}
  </section>
  ${hist ? '<p class="muted">الإحصاءات التفصيلية تشمل المباريات المسجلة في النظام فقط. النقاط التاريخية لا تحمل تفاصيل توقعات.</p>' : ''}
  ${ph.length ? `<section class="card"><h2>سجل المراكز</h2><div class="chips">${ph.map(x => `<span class="chip static">${x.roundNo === S.season.startRound - 1 && S.season.histMode === 'opening' ? 'افتتاحي' : 'ج' + fmt(x.roundNo)}: <b>${fmt(x.pos)}</b></span>`).join('')}</div></section>` : ''}
  <div class="row"><button class="btn" data-why="${pid}">تفصيل النقاط</button></div>`;
}
function vH2H() {
  const res = compute(); const [a, b] = S.h2h;
  const opts = sel => `<option value="">اختر</option>${res.rows.map(r => `<option value="${r.pid}" ${sel === r.pid ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}`;
  const A = res.rows.find(r => r.pid === a), B = res.rows.find(r => r.pid === b);
  let body = '';
  if (A && B) {
    const rowsCmp = [['المجموع', A.total, B.total], ['المركز', A.pos, B.pos, true], ['نتائج دقيقة', A.stats.exact, B.stats.exact], ['توقع الفائز', A.stats.winner, B.stats.winner], ['الهداف الأول', A.stats.scorer, B.stats.scorer], ['توقعات مسجلة', A.played, B.played]];
    let wa = 0, wb = 0; const per = [];
    matchesSorted().forEach(m => { const d = S.md[m.id]; if (!d?.approved || compute().excluded.find(x => x.matchId === m.id)) return; const x = d.calc?.[a]?.total || 0, y = d.calc?.[b]?.total || 0; if (x > y) wa++; else if (y > x) wb++; per.push([m, x, y]); });
    body = `<div class="table-wrap"><table class="grid h2h"><thead><tr><th>${esc(A.name)}</th><th></th><th>${esc(B.name)}</th></tr></thead><tbody>${rowsCmp.map(([l, x, y, low]) => `<tr><td class="num ${(low ? x < y : x > y) ? 'win' : ''}">${fmt(x)}</td><th>${l}</th><td class="num ${(low ? y < x : y > x) ? 'win' : ''}">${fmt(y)}</td></tr>`).join('')}<tr><td class="num">${fmt(wa)}</td><th>مباريات تفوق فيها</th><td class="num">${fmt(wb)}</td></tr></tbody></table></div>
    <div class="table-wrap"><table class="grid"><thead><tr><th>المباراة</th><th>${esc(A.name)}</th><th>${esc(B.name)}</th></tr></thead><tbody>${per.map(([m, x, y]) => `<tr><td>ج${fmt(roundById(m.roundId)?.no)} · ${esc(m.opponent)}</td><td class="num">${fmt(x)}</td><td class="num">${fmt(y)}</td></tr>`).join('')}</tbody></table></div>`;
  }
  return `<button class="back" data-go="table">${I(IC.back, 18)} الترتيب</button><h1>مقارنة مشاركين</h1><div class="grid2"><label>المشارك الأول<select id="h2h-a">${opts(a)}</select></label><label>المشارك الثاني<select id="h2h-b">${opts(b)}</select></label></div>${body}`;
}

/* ----- history migration ----- */
function vHistory() {
  const s = S.season, mode = s.histMode || 'none', res = compute();
  const dis = canWrite() ? '' : 'disabled';
  const rn = S.histRound ?? Math.max(1, (s.startRound || 2) - 1);
  const histRowsFor = no => Object.fromEntries((S.hist.rounds || []).filter(h => h.roundNo === no).map(h => [h.pid, h]));
  const rmap = histRowsFor(rn);
  return `<h1>استيراد السجل السابق</h1><p class="lead sm">للجولات التي سبقت تشغيل التطبيق. كل نقطة تحفظ مع مصدرها، والنظام يمنع احتساب الجولة نفسها مرتين.</p>
  <form id="f-hmode" class="card form"><h2>الإعداد</h2>
    <div class="grid2"><label>طريقة الاستيراد<select id="hm-mode" ${dis}>
      <option value="none" ${mode === 'none' ? 'selected' : ''}>لا يوجد سجل سابق</option>
      <option value="opening" ${mode === 'opening' ? 'selected' : ''}>الخيار A: رصيد افتتاحي لكل مشارك</option>
      <option value="rounds" ${mode === 'rounds' ? 'selected' : ''}>الخيار B: نقاط لكل جولة سابقة</option></select></label>
    <label>الجولة التي يبدأ منها النظام<input id="hm-start" type="number" min="1" max="99" inputmode="numeric" value="${s.startRound || 1}" ${dis}></label></div>
    <p class="muted">${mode === 'opening' ? `الرصيد الافتتاحي يمثل مجموع الجولات 1 إلى ${fmt((s.startRound || 1) - 1)}. أي مباراة مسجلة في تلك الجولات تستخدم للمقارنة فقط ولا تضاف للمجموع.` : mode === 'rounds' ? `تدخل نقاط الجولات 1 إلى ${fmt((s.startRound || 1) - 1)}. إذا أعيد بناء جولة بالتوقعات (الخيار C) تعتمد النقاط المحتسبة آليا ويعرض الفارق.` : 'اختر طريقة إذا بدأت المسابقة قبل استخدام التطبيق.'}</p>
    ${canWrite() ? '<div class="row end"><button class="btn primary">حفظ الإعداد</button></div>' : ''}
  </form>
  ${mode === 'opening' ? `<section class="card"><div class="row between wrap"><h2>الرصيد الافتتاحي</h2>${canWrite() ? '<button class="btn sm" data-act="hist-import" data-kind="opening">استيراد CSV/Excel</button>' : ''}</div>
    <div class="table-wrap"><table class="grid"><thead><tr><th>المشارك</th><th>النقاط قبل الجولة ${fmt(s.startRound)}</th><th>ملاحظة</th></tr></thead><tbody>
    ${members().map(m => { const o = S.hist.opening?.[m.pid] || {}; return `<tr data-pid="${m.pid}"><th scope="row">${esc(m.name)}</th><td><input class="sc wide" id="ho-${m.pid}" data-k="points" inputmode="numeric" value="${o.points ?? ''}" ${dis}></td><td><input id="hn-${m.pid}" data-k="note" value="${esc(o.note || '')}" maxlength="80" ${dis}></td></tr>`; }).join('')}
    </tbody></table></div>${canWrite() ? '<div class="row end"><button class="btn primary" data-act="hist-save-opening">حفظ الأرصدة</button></div>' : ''}</section>` : ''}
  ${mode === 'rounds' ? `<section class="card"><div class="row between wrap"><h2>نقاط الجولات السابقة</h2>${canWrite() ? '<button class="btn sm" data-act="hist-import" data-kind="rounds">استيراد جدول كامل</button>' : ''}</div>
    <div class="chips">${Array.from({ length: Math.max(0, (s.startRound || 1) - 1) }, (_, i) => i + 1).map(n => `<button class="chip ${n === rn ? 'on' : ''}" data-hround="${n}">ج${fmt(n)}${(S.hist.rounds || []).some(h => h.roundNo === n) ? ' ✓' : ''}</button>`).join('') || '<span class="muted">ارفع رقم جولة البداية لإظهار الجولات السابقة.</span>'}</div>
    ${rn < (s.startRound || 1) ? `<div class="table-wrap"><table class="grid"><thead><tr><th>المشارك</th><th>نقاط الجولة ${fmt(rn)}</th><th>ملاحظة</th><th>موثق</th></tr></thead><tbody>
    ${members().map(m => { const h = rmap[m.pid] || {}; return `<tr data-pid="${m.pid}"><th scope="row">${esc(m.name)}</th><td><input class="sc wide" id="hr-${m.pid}" data-k="points" inputmode="numeric" value="${h.points ?? ''}" ${dis}></td><td><input id="hrn-${m.pid}" data-k="note" value="${esc(h.note || '')}" maxlength="80" ${dis}></td><td><input type="checkbox" id="hrv-${m.pid}" data-k="verified" ${h.verified ? 'checked' : ''} ${dis} aria-label="موثق"></td></tr>`; }).join('')}
    </tbody></table></div>${canWrite() ? `<div class="row end"><button class="btn primary" data-act="hist-save-round" data-no="${rn}">حفظ الجولة ${fmt(rn)}</button></div>` : ''}` : ''}</section>` : ''}
  <section class="card"><h2>الخيار C: إعادة بناء سجل التوقعات</h2><p class="muted">أضف مباراة في جولة سابقة، أدخل التوقعات والنتيجة واعتمدها. يطبق عليها محرك النقاط نفسه.</p>${canWrite() ? '<button class="btn" data-act="match-new">إضافة مباراة لجولة سابقة</button>' : ''}</section>
  ${(res.conflicts.length || Object.keys(res.recon).length) ? `<section class="card"><h2>المراجعة والفروقات</h2>
    ${Object.keys(res.recon).length ? `<div class="table-wrap"><table class="grid"><thead><tr><th>المشارك</th><th>الرصيد المسجل</th><th>المحتسب من التوقعات</th><th>الفارق</th></tr></thead><tbody>${Object.entries(res.recon).map(([p, x]) => `<tr><th>${esc(pName(p))}</th><td class="num">${fmt(x.recorded)}</td><td class="num">${fmt(x.computed)}</td><td class="num ${x.diff ? 'warn-t' : ''}">${fmt(x.diff)}</td></tr>`).join('')}</tbody></table></div>` : ''}
    ${res.conflicts.length ? `<ul class="log">${res.conflicts.map(c => `<li>${esc(pName(c.pid))} · الجولة ${fmt(c.roundNo)} · ${fmt(c.points)} نقاط: ${esc(c.reason)}${c.diff != null ? ` (الفارق ${fmt(c.diff)})` : ''}</li>`).join('')}</ul>` : ''}</section>` : ''}`;
}

/* ----- studio ----- */
function studioOpts() {
  const def = { template: 'leaderboard', size: 'portrait', cw: 1200, ch: 1500, presetId: 'royal', palette: {}, limit: 0, detail: 'standard', showRound: true, showChange: true, avatars: false, groupName: '', title: '', footer: '', message: '', matchId: '', roundNo: null, logo: '' };
  return { ...def, ...(S.core?.studio || {}), ...(S.studioLocal || {}) };
}
function vStudio() {
  const o = studioOpts();
  const presets = [...Studio.PRESETS, ...(S.core.presets || [])];
  const ms = matchesSorted();
  const needMatch = ['matchday', 'predictions'].includes(o.template);
  return `<div class="row between wrap"><h1>استوديو الصور</h1><span class="muted">CHELSEA GRAPHICS STUDIO</span></div>
  <div class="studio">
    <div class="stage"><div class="canvas-box ${o.size}"><canvas id="cv" aria-label="معاينة الصورة"></canvas></div>
      <div class="row between pager" ${S.studioPages > 1 ? '' : 'hidden'}><button class="btn sm" data-act="pg" data-d="-1">السابقة</button><span id="pg-l">${fmt(S.studioPage + 1)} / ${fmt(S.studioPages)}</span><button class="btn sm" data-act="pg" data-d="1">التالية</button></div>
      <div class="exports">
        <button class="btn primary" data-act="exp" data-f="png">${I(IC.download, 18)} تحميل PNG</button>
        <button class="btn" data-act="exp" data-f="jpeg">JPEG</button><button class="btn" data-act="exp" data-f="pdf">PDF</button>
        <button class="btn" data-act="exp-all" ${S.studioPages > 1 ? '' : 'hidden'}>تحميل كل الصفحات</button>
        <button class="btn" data-act="share">${I(IC.share, 18)} مشاركة</button><button class="btn" data-act="copy-img">${I(IC.copy, 18)} نسخ الصورة</button><button class="btn" data-act="copy-cap">نسخ العبارة</button>
      </div>
      <p class="muted sm">يصدر الملف من نفس الرسم الظاهر في المعاينة وبالمقاس الكامل.</p>
    </div>
    <form class="controls form" id="f-studio">
      <fieldset><legend>القالب</legend><div class="tpls">${Studio.TEMPLATES.map(t => `<label class="tpl ${o.template === t.id ? 'on' : ''}"><input type="radio" name="template" value="${t.id}" ${o.template === t.id ? 'checked' : ''}><span>${t.no}</span>${t.name}</label>`).join('')}</div></fieldset>
      ${needMatch ? `<label>المباراة<select name="matchId">${ms.map(m => `<option value="${m.id}" ${o.matchId === m.id ? 'selected' : ''}>ج${fmt(roundById(m.roundId)?.no)} · ${esc(m.opponent)}</option>`).join('')}</select></label>` : ''}
      ${['champion'].includes(o.template) ? `<label>الجولة<select name="roundNo">${Object.keys(compute().champions).sort((a, b) => b - a).map(n => `<option value="${n}" ${o.roundNo == n ? 'selected' : ''}>الجولة ${fmt(+n)}</option>`).join('')}</select></label>` : ''}
      <div class="grid2"><label>المقاس<select name="size">${Object.entries(Studio.SIZES).map(([k, v]) => `<option value="${k}" ${o.size === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select></label>
      <label>عدد المشاركين<select name="limit"><option value="0" ${!+o.limit ? 'selected' : ''}>الكل</option><option value="10" ${o.limit == 10 ? 'selected' : ''}>أفضل 10</option><option value="20" ${o.limit == 20 ? 'selected' : ''}>أفضل 20</option></select></label></div>
      ${o.size === 'custom' ? `<div class="grid2"><label>العرض<input name="cw" type="number" min="600" max="4000" value="${o.cw}"></label><label>الارتفاع<input name="ch" type="number" min="600" max="4000" value="${o.ch}"></label></div>` : ''}
      <div class="grid2"><label>مستوى التفاصيل<select name="detail"><option value="compact" ${o.detail === 'compact' ? 'selected' : ''}>مختصر</option><option value="standard" ${o.detail === 'standard' ? 'selected' : ''}>قياسي</option><option value="full" ${o.detail === 'full' ? 'selected' : ''}>كامل مع الألقاب</option></select></label>
      <label>الهوية<select name="presetId">${presets.map(p => `<option value="${p.id}" ${o.presetId === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label></div>
      <div class="checks"><label class="check"><input type="checkbox" name="showRound" ${o.showRound ? 'checked' : ''}> نقاط الجولة</label><label class="check"><input type="checkbox" name="showChange" ${o.showChange ? 'checked' : ''}> تغير الترتيب</label><label class="check"><input type="checkbox" name="avatars" ${o.avatars ? 'checked' : ''}> الصور الشخصية</label></div>
      <details><summary>تخصيص النصوص والألوان</summary>
        <label>اسم المجموعة<input name="groupName" value="${esc(o.groupName)}" placeholder="${esc(S.core.groupName || '')}" maxlength="60"></label>
        <label>العنوان الرئيسي<input name="title" value="${esc(o.title)}" placeholder="${esc(S.core.leagueName)}" maxlength="60"></label>
        <label>العبارة أسفل التصميم<input name="footer" value="${esc(o.footer)}" maxlength="70"></label>
        <label>رسالة التهنئة أو التحفيز<input name="message" value="${esc(o.message)}" maxlength="90"></label>
        <div class="colors">${[['primary', 'الأساسي'], ['accent', 'الإبراز'], ['leader', 'المتصدر'], ['bg1', 'الخلفية 1'], ['bg2', 'الخلفية 2']].map(([k, l]) => `<label class="color"><input type="color" name="pal-${k}" value="${(o.palette?.[k]) || presets.find(p => p.id === o.presetId)?.[k] || '#034694'}">${l}</label>`).join('')}</div>
        <label>نمط الخلفية<select name="pal-style">${[['', 'حسب الهوية'], ['stadium', 'أضواء الملعب'], ['pitch', 'خطوط الملعب'], ['chevron', 'خطوط مائلة'], ['minimal', 'هادئ']].map(([k, l]) => `<option value="${k}" ${(o.palette?.style || '') === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label>الشعار (اختياري، يستخدم فقط إذا كان لديك حق استخدامه)<input type="file" id="st-logo" accept="image/*"></label>
        ${o.logo ? '<button type="button" class="btn sm ghost" data-act="logo-clear">إزالة الشعار</button>' : ''}
        ${S.canEdit ? `<div class="row"><button type="button" class="btn sm" data-act="preset-save">حفظ كهوية جديدة</button><button type="button" class="btn sm ghost" data-act="pal-reset">إعادة ألوان الهوية</button></div>` : ''}
      </details>
    </form>
  </div>`;
}

/* data for studio */
function studioData(o) {
  const res = compute();
  const s = S.core.seasons.find(x => x.id === S.season.id);
  const ms = matchesSorted();
  const lastApproved = ms.filter(m => S.md[m.id]?.approved && S.md[m.id].result?.status === 'finished').sort((a, b) => (b.kickoff || '').localeCompare(a.kickoff || ''))[0];
  let match = ['matchday', 'predictions'].includes(o.template) ? matchById(o.matchId) : null;
  if (!match && o.template === 'matchday') match = lastApproved;
  if (!match && o.template === 'predictions') match = ms.filter(m => !S.md[m.id]?.approved && m.status === 'scheduled').sort((a, b) => (a.kickoff || '').localeCompare(b.kickoff || ''))[0] || ms[ms.length - 1];
  if (!match && o.template === 'leaderboard') match = lastApproved && roundById(lastApproved.roundId)?.no === res.lastRound ? lastApproved : null;
  const mdoc = match ? S.md[match.id] : null;
  const mr = mdoc?.approved ? mdoc.result : null;
  const md = match ? { opponent: match.opponent, home: match.home, status: mr ? mr.status : match.status, ch: mr?.ch, op: mr?.op, kickoff: match.kickoff, note: mr?.extraTime ? `بعد الأشواط الإضافية${mr.pens ? ' · ترجيح ' + (mr.pens === 'ch' ? 'لتشلسي' : 'للخصم') : ''}` : '' } : null;
  const roundNo = match ? roundById(match.roundId)?.no : res.lastRound;
  const rows = res.rows.map(r => ({ pos: r.pos, name: r.name, alias: pById(r.pid)?.alias, total: r.total, roundPts: r.roundLast, change: r.change, img: o.avatars ? imgEl(pById(r.pid)?.img) : null, tied: res.rows.filter(x => x.pos === r.pos).length > 1 }));
  const d = {
    leagueName: S.core.leagueName, groupName: S.core.groupName || S.core.leagueNameEn, seasonName: s?.name, fmt, fmtSeason: v => fmt(v),
    logo: o.logo ? imgEl(o.logo) : null, rows, match: md,
    roundLabel: roundNo != null ? `الجولة ${fmt(roundNo)}${match ? ' · ' + compName(match.compId) : ''}` : '',
    roundShort: 'الجولة',
    updatedLabel: 'آخر تحديث ' + fmtDate(new Date().toISOString(), { dateStyle: 'medium' })
  };
  if (o.template === 'matchday' && mdoc?.approved) {
    const list = members().map(p => { const c = mdoc.calc?.[p.pid] || {}; const pr = mdoc.predictions?.[p.pid]; return { name: p.name, pred: pr ? `${pr.ch}-${pr.op}` : '—', scorer: pr ? scorerLabel(pr.scorer) : 'لم يتوقع', w: c.w || 0, e: c.e || 0, s: c.s || 0, total: c.total || 0, sOk: c.scorerStatus === 'ok', pending: c.scorerStatus === 'pending', perfect: c.exactOk && c.scorerStatus === 'ok' }; }).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'ar'));
    d.results = list.map(x => ({ ...x, pred: x.pred === '—' ? '—' : x.pred.split('-').map(Number).map(fmt).join('-') }));
    const max = Math.max(0, ...list.map(x => x.total));
    d.matchChampion = max > 0 ? { pts: max, names: list.filter(x => x.total === max).map(x => x.name) } : null;
  } else if (o.template === 'matchday') d.results = [];
  if (o.template === 'champion') {
    const no = o.roundNo != null && res.champions[o.roundNo] ? +o.roundNo : res.lastRound;
    const ch = res.champions[no];
    d.champion = { roundNo: no, pts: ch?.pts || 0, names: (ch?.pids || []).map(pName) };
    d.roundLabel = no != null ? `الجولة ${fmt(no)}` : '';
  }
  if (o.template === 'stats') {
    const t = [];
    const best = (f, label, unit = '') => { const v = res.rows.map(r => [r, f(r)]).filter(x => x[1] > 0); if (!v.length) return; const mx = Math.max(...v.map(x => x[1])); t.push({ label, value: mx, who: v.filter(x => x[1] === mx).map(x => x[0].name).join('، ') }); };
    best(r => r.stats.exact, 'أكثر النتائج الدقيقة');
    best(r => r.stats.winner, 'أكثر توقعا للفائز');
    best(r => r.stats.scorer, 'أكثر توقعا للهداف الأول');
    if (res.prevRound != null) best(r => r.change || 0, 'الأكثر صعودا (مراكز)');
    const rd = Object.entries(res.champions).filter(([, c]) => c.system && c.pts > 0).sort((a, b) => b[1].pts - a[1].pts)[0];
    if (rd) t.push({ label: 'أعلى نقاط في جولة', value: rd[1].pts, who: `${rd[1].pids.map(pName).join('، ')} · الجولة ${fmt(+rd[0])}` });
    t.push({ label: 'مباريات معتمدة', value: ms.filter(m => S.md[m.id]?.approved && !res.excluded.find(x => x.matchId === m.id)).length, who: '' });
    const lead = res.rows.filter(r => r.pos === 1 && r.total > 0);
    if (lead.length) t.push({ label: 'المتصدر', value: lead[0].total, who: lead.map(r => r.name).join('، ') });
    d.stats = t;
    if (res.rows.some(r => r.histPts > 0)) d.statsNote = 'الإحصاءات التفصيلية من المباريات المسجلة في النظام فقط';
  }
  if (o.template === 'predictions' && match) {
    const pd = S.md[match.id]?.predictions || {};
    const am = activeMembers();
    const reveal = isLocked(match);
    d.predictions = {
      submitted: am.filter(p => pd[p.pid]).map(p => p.name), missing: am.filter(p => !pd[p.pid]).map(p => p.name),
      rows: reveal ? am.filter(p => pd[p.pid]).map(p => ({ name: p.name, pred: `${fmt(pd[p.pid].ch)}-${fmt(pd[p.pid].op)}`, scorer: scorerLabel(pd[p.pid].scorer) })) : null,
      kickoffLabel: `${match.home ? 'على ملعب تشلسي' : 'خارج الأرض'} · ${fmtDate(match.kickoff, { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })}`,
      lockLabel: `آخر موعد للتوقع: ${fmtDate(lockTime(match), { weekday: 'long', hour: 'numeric', minute: '2-digit' })}`
    };
  }
  return d;
}
function paletteOf(o) { const base = [...Studio.PRESETS, ...(S.core.presets || [])].find(p => p.id === o.presetId) || Studio.PRESETS[0]; const pal = { ...base }; for (const [k, v] of Object.entries(o.palette || {})) if (v) pal[k] = v; return pal; }
let drawChain = Promise.resolve();
function drawStudio() { drawChain = drawChain.then(doDraw).catch(e => console.error(e)); return drawChain; }
async function doDraw() {
  const cv = $('#cv'); if (!cv) return;
  await Studio.ensureFonts();
  const o = studioOpts();
  const d = studioData(o);
  const opts = { ...o, groupName: o.groupName || '', limit: +o.limit || 0, palette: paletteOf(o), leaderColor: paletteOf(o).leader };
  let pages = Studio.render(cv, o.template, d, opts, S.studioPage);
  if (S.studioPage >= pages) { S.studioPage = pages - 1; pages = Studio.render(cv, o.template, d, opts, S.studioPage); }
  S.studioPages = pages;
  const pg = $('.pager'); if (pg) { pg.hidden = pages <= 1; $('#pg-l').textContent = `${fmt(S.studioPage + 1)} / ${fmt(pages)}`; }
  const ea = $('[data-act="exp-all"]'); if (ea) ea.hidden = pages <= 1;
}
function caption() {
  const res = compute(), o = studioOpts();
  const top = res.rows.slice(0, 3).map(r => `${r.pos}. ${r.name} (${r.total})`).join('\n');
  const ch = res.lastRound != null ? res.champions[res.lastRound] : null;
  return `${S.core.leagueName}${S.core.groupName ? ' | ' + S.core.groupName : ''}\nالترتيب بعد الجولة ${res.lastRound ?? ''}\n${top}${ch?.pids?.length ? `\nبطل الجولة: ${ch.pids.map(pName).join('، ')} (${ch.pts} نقاط)` : ''}${o.footer ? '\n' + o.footer : ''}`;
}

/* ----- settings ----- */
function vSettings() {
  const c = S.core, s = S.season, dis = S.canEdit ? '' : 'disabled';
  const tb = s.tiebreakers || [];
  const tbL = { exact: 'النتائج الدقيقة', winner: 'توقع الفائز', scorer: 'الهداف الأول' };
  return `<h1>الإعدادات</h1>
  <form id="f-league" class="card form"><h2>المسابقة والعرض</h2>
    <div class="grid2"><label>اسم المسابقة<input id="sl-name" value="${esc(c.leagueName)}" maxlength="60" ${dis}></label><label>الاسم الإنجليزي<input id="sl-en" value="${esc(c.leagueNameEn || '')}" maxlength="60" dir="ltr" ${dis}></label></div>
    <label>اسم مجموعة المشجعين<input id="sl-group" value="${esc(c.groupName || '')}" maxlength="60" ${dis}></label>
    <div class="grid3"><label>الأرقام<select id="sl-nu" ${dis}><option value="latn" ${c.numerals !== 'arab' ? 'selected' : ''}>1 2 3</option><option value="arab" ${c.numerals === 'arab' ? 'selected' : ''}>١ ٢ ٣</option></select></label>
    <label>المنطقة الزمنية<select id="sl-tz" ${dis}>${['Asia/Riyadh', 'Asia/Dubai', 'Asia/Kuwait', 'Asia/Qatar', 'Africa/Cairo', 'Europe/London', 'UTC'].map(z => `<option ${c.tz === z ? 'selected' : ''}>${z}</option>`).join('')}</select></label>
    <p class="muted">تظهر توقعات الجميع بعد إغلاق باب التوقع، ويفرض ذلك الخادم.</p></div>
    ${S.canEdit ? '<div class="row end"><button class="btn primary">حفظ</button></div>' : ''}</form>

  <section class="card"><h2>المواسم</h2>
    <ul class="seasons">${c.seasons.map(x => `<li class="${x.id === c.currentSeasonId ? 'cur' : ''}"><b>${esc(fmt(x.name))}</b>${x.demo ? ' <span class="pill">تجريبي</span>' : ''} <span class="pill ${x.status === 'archived' ? '' : 'ok'}">${x.status === 'archived' ? 'مؤرشف' : 'نشط'}</span>${x.champion ? ` <span class="pill gold">${I(IC.trophy, 14)} ${esc(x.champion.names.join('، '))} · ${fmt(x.champion.pts)}</span>` : ''}
      <span class="row">${x.id !== c.currentSeasonId ? `<button class="btn sm" data-act="season-switch" data-id="${x.id}">فتح</button>` : '<span class="muted">الحالي</span>'}${S.canEdit && x.status !== 'archived' && x.id === c.currentSeasonId ? `<button class="btn sm ghost" data-act="season-archive">إغلاق وأرشفة</button>` : ''}${S.canEdit && x.status === 'archived' && x.id === c.currentSeasonId ? `<button class="btn sm ghost" data-act="season-reopen">إعادة فتح</button>` : ''}</span></li>`).join('')}</ul>
    ${S.canEdit ? `<form id="f-newseason" class="form inline"><input id="ns-name" placeholder="مثال: 2027/2028" required maxlength="20" aria-label="اسم الموسم الجديد"><select id="ns-scope" aria-label="النطاق"><option value="pl">الدوري الإنجليزي فقط</option><option value="all">كل البطولات</option></select><label class="check sm"><input type="checkbox" id="ns-copy" checked> نقل المشاركين</label><button class="btn">إنشاء موسم</button></form>` : ''}
  </section>

  ${S.canEdit ? `<form id="f-season" class="card form"><h2>إعدادات الموسم الحالي</h2>
    <div class="grid2"><label>نطاق المباريات<select id="ss-scope" ${dis}><option value="pl" ${s.scope === 'pl' ? 'selected' : ''}>الدوري الإنجليزي فقط</option><option value="all" ${s.scope === 'all' ? 'selected' : ''}>كل البطولات المختارة</option></select></label>
    <label>الترتيب<select id="ss-rank" ${dis}><option value="overall" ${s.rankingScope !== 'perComp' ? 'selected' : ''}>ترتيب عام لكل البطولات</option><option value="perComp" ${s.rankingScope === 'perComp' ? 'selected' : ''}>عام مع ترتيب مستقل لكل بطولة</option></select></label></div>
    <label>البطولات (واحدة في كل سطر)<textarea id="ss-comps" rows="3" ${dis}>${esc(comps().map(x => x.name).join('\n'))}</textarea></label>
    <fieldset><legend>معايير كسر التعادل بالترتيب</legend>${['exact', 'winner', 'scorer'].map(k => `<label class="check"><input type="checkbox" data-tb="${k}" ${tb.includes(k) ? 'checked' : ''} ${dis}> ${tbL[k]} <input class="sc" type="number" min="1" max="3" data-tbo="${k}" value="${tb.indexOf(k) + 1 || ''}" aria-label="الترتيب" ${dis}></label>`).join('')}
    <label class="check"><input type="checkbox" id="ss-tbfair" ${s.tbFair !== false ? 'checked' : ''} ${dis}> لا تفصل بين متساوين إذا كان لأحدهم نقاط تاريخية بلا تفاصيل (مركز مشترك)</label></fieldset>
    <label>قائمة اللاعبين للهداف الأول (لاعب في كل سطر)<textarea id="ss-squad" rows="5" placeholder="اكتب أسماء لاعبي تشلسي كما تريد ظهورها" ${dis}>${esc((c.squad || []).join('\n'))}</textarea></label>
    <div class="row end"><button class="btn primary">حفظ إعدادات الموسم</button></div></form>` : ''}

  <section class="card"><div class="row between wrap"><h2>قواعد احتساب النقاط</h2>${S.canEdit ? '<div class="row"><button class="btn sm" data-act="rule-new">نسخة جديدة</button><button class="btn sm ghost" data-act="recalc">إعادة احتساب تاريخية</button></div>' : ''}</div>
    <p class="muted">كل مباراة معتمدة تحتفظ بنسخة القواعد التي طبقت عليها. تعديل القواعد لا يغير الماضي إلا بإعادة احتساب تاريخية مؤكدة.</p>
    ${(s.rules || []).map(r => ruleForm(r)).join('')}
  </section>

  <section class="card"><h2>البيانات</h2>
    <div class="row wrap"><button class="btn" data-act="backup">${I(IC.download, 18)} تصدير نسخة احتياطية</button>${S.canEdit ? `<label class="btn file">استيراد نسخة احتياطية<input type="file" id="restore" accept="application/json,.json" hidden></label>` : ''}</div>
    ${S.canEdit ? `<div class="row wrap">${c.seasons.some(x => x.demo) ? '<button class="btn danger ghost" data-act="demo-del">حذف البيانات التجريبية</button>' : '<button class="btn ghost" data-act="demo-load">تحميل بيانات تجريبية</button>'}</div>` : ''}
  </section>
  <nav class="row wrap"><button class="btn ghost" data-go="audit">${I(IC.log, 18)} سجل التدقيق</button><button class="btn ghost" data-go="tests">${I(IC.test, 18)} الاختبارات</button><button class="btn ghost" data-go="guide">${I(IC.book, 18)} تعليمات التشغيل</button></nav>`;
}
function ruleForm(r) {
  const dis = S.canEdit ? '' : 'disabled';
  const used = Object.values(S.md).filter(d => d.approved && d.appliedRules?.id === r.id).length;
  const sel = (k, opts) => `<select data-rk="${k}" ${dis}>${opts.map(([v, l]) => `<option value="${v}" ${r[k] === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
  return `<form class="rule form" data-rid="${r.id}"><div class="row between wrap"><input data-rk="name" value="${esc(r.name)}" class="h3in" aria-label="اسم النسخة" ${dis}><span class="muted">مطبقة على ${fmt(used)} مباراة</span></div>
    <div class="grid4"><label>سارية من<input type="date" data-rk="effectiveFrom" value="${esc(r.effectiveFrom || '')}" ${dis}></label><label>الفائز أو التعادل<input type="number" min="0" max="10" data-rk="winner" value="${r.winner}" ${dis}></label><label>النتيجة الدقيقة<input type="number" min="0" max="10" data-rk="exact" value="${r.exact}" ${dis}></label><label>الهداف الأول<input type="number" min="0" max="10" data-rk="scorer" value="${r.scorer}" ${dis}></label></div>
    <div class="grid3"><label>مكافأة التوقع المثالي<input type="number" min="0" max="10" data-rk="perfectBonus" value="${r.perfectBonus || 0}" ${dis}></label>
      <label>الهداف المعتمد${sel('scorerScope', [['match', 'أول هداف في المباراة'], ['chelsea', 'أول هداف لتشلسي']])}</label>
      <label>الهدف العكسي الأول${sel('ogPolicy', [['either', 'يقبل "هدف عكسي" أو اسم المسجل'], ['og_only', '"هدف عكسي" فقط'], ['player_only', 'اسم اللاعب المسجل فقط']])}</label>
      <label>الأشواط الإضافية${sel('etPolicy', [['regular', 'نتيجة الوقت الأصلي'], ['aet', 'تشمل الأشواط الإضافية']])}</label>
      <label>المباراة الملغاة${sel('cancelledPolicy', [['none', 'لا تمنح نقاطا'], ['count', 'تحتسب بالنتيجة المسجلة']])}</label>
      <label>المباراة المؤجلة${sel('postponedPolicy', [['carry', 'تبقى التوقعات حتى تقام'], ['reset', 'تفتح التوقعات من جديد']])}</label>
      <label>التوقع المتأخر${sel('latePolicy', [['count', 'يحتسب مع علامة متأخر'], ['zero', 'لا يمنح نقاطا']])}</label></div>
    ${S.canEdit ? `<div class="row end">${(S.season.rules || []).length > 1 && !used ? `<button type="button" class="btn sm ghost danger" data-act="rule-del" data-id="${r.id}">حذف</button>` : ''}<button class="btn sm primary">حفظ النسخة</button></div>` : ''}</form>`;
}

function vAudit() {
  if (!S.audit) { loadAudit(); return '<h1>سجل التدقيق</h1><p class="muted">جار التحميل…</p>'; }
  const lab = { approve: 'اعتماد نتيجة', reapprove: 'تحديث نتيجة معتمدة', unapprove: 'إلغاء اعتماد', preds: 'حفظ توقعات', late: 'إدخال بعد الإغلاق', match_add: 'إضافة مباراة', match_edit: 'تعديل مباراة', match_del: 'حذف مباراة', p_add: 'إضافة مشارك', p_edit: 'تعديل مشارك', p_del: 'حذف مشارك', hist: 'سجل تاريخي', hist_mode: 'إعداد الاستيراد', rules: 'قواعد النقاط', recalc: 'إعادة احتساب تاريخية', season: 'المواسم', restore: 'استعادة نسخة', demo: 'بيانات تجريبية', settings: 'الإعدادات' };
  return `<button class="back" data-go="settings">${I(IC.back, 18)} الإعدادات</button><div class="row between"><h1>سجل التدقيق</h1><button class="btn sm" data-act="audit-reload">تحديث</button></div>
  ${S.audit.length ? `<ul class="log big">${S.audit.map(a => `<li><time>${fmtDate(a.ts)}</time><b>${esc(lab[a.action] || a.action)}</b><span>${esc(a.detail?.text || '')}</span></li>`).join('')}</ul>` : '<p class="muted">لا توجد عمليات مسجلة.</p>'}`;
}
async function loadAudit() {
  try {
    if (S.memory) S.audit = (mem.audit || []).slice(0, 200);
    else { const s = await S.db.collection('audit').orderBy('ts', 'desc').limit(200).get(); S.audit = s.docs.map(d => d.data()); }
  } catch { S.audit = []; }
  if (S.view === 'audit') render();
}

function vTests() {
  const r = S.testResults;
  return `<button class="back" data-go="settings">${I(IC.back, 18)} الإعدادات</button><div class="row between wrap"><h1>اختبارات القبول</h1><button class="btn primary" data-act="tests-run">تشغيل الاختبارات</button></div>
  <p class="muted">تختبر محرك النقاط والترتيب والاستيراد التاريخي وتوليد الصور على بيانات مستقلة دون المساس ببيانات المسابقة.</p>
  ${r ? `<p><b>${fmt(r.filter(x => x.ok).length)} / ${fmt(r.length)}</b> ناجح</p><ul class="tests">${r.map(x => `<li class="${x.ok ? 'ok' : 'bad'}"><span>${x.ok ? '✓' : '✗'}</span>${esc(x.name)}${x.detail ? `<small>${esc(x.detail)}</small>` : ''}</li>`).join('')}</ul>` : ''}`;
}
async function runAppTests() {
  const out = runEngineTests(E);
  const add = (name, ok, detail = '') => out.push({ name, ok, detail });
  try {
    await Studio.ensureFonts();
    const cv = document.createElement('canvas');
    const longNames = ['عبدالرحمن بن عبدالعزيز الشمري الطويل جدا', 'Muhammad Abdullah Al-Qahtani Jr.', 'سلطان', 'أبو فهد'];
    const rows = Array.from({ length: 30 }, (_, i) => ({ pos: i + 1, name: longNames[i % 4] + ' ' + (i + 1), total: 60 - i, roundPts: i % 6, change: (i % 5) - 2 }));
    const d = { leagueName: 'دوري توقعات البلوز', groupName: 'اختبار', seasonName: '2026/2027', fmt: n => String(n), fmtSeason: v => v, rows, match: { opponent: 'نوتنغهام فورست', status: 'finished', ch: 2, op: 1 }, roundLabel: 'الجولة 6', updatedLabel: 'اختبار' };
    const sizes = ['portrait', 'story', 'square', 'landscape'];
    const pc = sizes.map(sz => { let pages = Studio.render(cv, 'leaderboard', d, { size: sz }, 0); for (let p = 1; p < pages; p++) Studio.render(cv, 'leaderboard', d, { size: sz }, p); return pages; });
    add('صورة ترتيب 30 مشاركا بكل المقاسات', pc.every(x => x >= 1), 'عدد الصفحات: ' + pc.join(' / '));
    const per = sizes.map((sz, i) => Math.ceil(30 / pc[i]));
    add('عدم فقدان أي مشارك عند التقسيم', per.every((n, i) => n * pc[i] >= 30));
    ['matchday', 'podium', 'champion', 'stats', 'predictions'].forEach(t => { Studio.render(cv, t, { ...d, results: [], champion: { names: [], pts: 0 }, stats: [], predictions: { submitted: [], missing: [], rows: null } }, { size: 'portrait' }, 0); });
    add('القوالب تعمل مع بيانات ناقصة', true);
    const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
    add('توليد ملف PNG حقيقي', !!blob && blob.size > 1000, blob ? Math.round(blob.size / 1024) + ' كيلوبايت' : 'فشل');
  } catch (e) { add('اختبارات الصور', false, e.message); }
  if (!S.memory && S.canEdit) {
    try { const k = 'probe/' + uid('t'); await S.db.doc(k).set({ ok: true }); const back = await S.db.doc(k).get(); await S.db.doc(k).delete(); add('الحفظ الدائم في قاعدة البيانات', back.exists && back.data().ok === true); }
    catch (e) { add('الحفظ الدائم في قاعدة البيانات', false, e.message); }
  } else add('الحفظ الدائم في قاعدة البيانات', S.memory ? false : true, S.memory ? 'هذا العرض لا يتيح التخزين' : 'يتطلب صلاحية المدير');
  S.testResults = out; render();
}

function vGuide() {
  return `<button class="back" data-go="more">${I(IC.back, 18)} المزيد</button><h1>تعليمات التشغيل</h1>
  <ol class="guide">
    <li><b>أنشئ الموسم</b> من الشاشة الأولى أو من الإعدادات، وأضف قائمة لاعبي تشلسي لتسهيل اختيار الهداف الأول.</li>
    <li><b>أضف المشاركين</b> فرادى أو دفعة واحدة (اسم في كل سطر، ويمكن إضافة اللقب بعد فاصلة).</li>
    <li><b>أدخل السجل السابق</b> من "السجل السابق": اختر الرصيد الافتتاحي إن كان لديك مجموع كل مشارك فقط، أو نقاط كل جولة إن كانت متوفرة، وحدد الجولة التي يبدأ منها النظام.</li>
    <li><b>أضف المباراة</b> مع الجولة والبطولة والموعد بتوقيت ${esc(tz())}. يغلق باب التوقع عند الانطلاق تلقائيا.</li>
    <li><b>سجل التوقعات</b> في الجدول الجماعي، أو الصق رسائل المجموعة في "لصق من واتساب" وراجع النتائج قبل الحفظ، أو استورد ملف CSV/Excel بأعمدة: الاسم، تشلسي، الخصم، الهداف.</li>
    <li><b>اعتمد النتيجة</b>: أدخل النتيجة والهداف الأول واضغط "اعتماد النتيجة واحتساب النقاط". يمكن إعادة الاعتماد أو التصحيح دون مضاعفة النقاط، وكل تعديل يسجل.</li>
    <li><b>أنشئ الصورة</b> من الاستوديو، اختر القالب والمقاس، ثم "تحميل PNG". على الهاتف يفتح التحميل قائمة المشاركة.</li>
    <li><b>روابط الأعضاء</b>: من "المشاركون" اضغط "روابط لكل المشاركين" ثم "واتساب" بجوار كل اسم. يفتح العضو رابطه مرة واحدة فيبقى مسجلا على جواله، ويرسل توقعه بنفسه حتى صافرة البداية.</li>
    <li><b>الصلاحيات</b>: حساب المدير وحده يعدل. أي شخص يفتح رابط الموقع يرى الترتيب والنتائج، وتظهر توقعات الجميع بعد إغلاق باب التوقع فقط.</li>
    <li><b>النسخ الاحتياطي</b>: صدر نسخة من الإعدادات بعد كل جولة مهمة.</li>
  </ol>`;
}
function vMore() {
  const it = (v, l, ic, d) => `<button class="more-i" data-go="${v}">${I(ic)}<span><b>${l}</b><small>${d}</small></span></button>`;
  return `<h1>المزيد</h1><div class="more">
    ${S.canEdit ? '' : it('studio', 'الاستوديو', IC.image, 'صور الترتيب والنتائج')}
    ${it('participants', 'المشاركون', IC.users, S.canEdit ? 'الإضافة والتعديل والروابط الشخصية' : 'قائمة المشاركين وصفحاتهم')}
    ${S.canEdit ? it('history', 'السجل السابق', IC.history, 'الأرصدة الافتتاحية ونقاط الجولات السابقة') : ''}
    ${it('h2h', 'مقارنة مشاركين', IC.table, 'مواجهة مباشرة في النقاط والدقة')}
    ${it('settings', 'الإعدادات', IC.gear, 'المواسم والقواعد والنسخ الاحتياطي')}
    ${S.canEdit ? it('audit', 'سجل التدقيق', IC.log, 'كل التعديلات المسجلة') + it('tests', 'الاختبارات', IC.test, 'اختبارات القبول الأساسية') : ''}
    ${it('guide', 'تعليمات التشغيل', IC.book, 'الخطوات من البداية للنهاية')}
  </div>`;
}

/* ---------- standalone: login, members ---------- */
function setupMissingView() {
  return `<section class="onboard" style="padding-top:24px"><h1 class="display">دوري توقعات البلوز</h1>
    <div class="card"><h2>الإعداد غير مكتمل</h2><p>لم تضف بيانات قاعدة البيانات بعد. افتح ملف <b dir="ltr">config.js</b> وضع فيه رابط مشروع Supabase والمفتاح العام، ثم أعد رفع الموقع. الخطوات في ملف <b dir="ltr">README.md</b>.</p>
    <button class="btn" data-act="local-trial">تجربة محلية دون حفظ</button></div></section>`;
}
async function loginSheet() {
  let exists = true; try { exists = await Store.adminExists(); } catch { }
  sheet(exists ? 'دخول مدير المسابقة' : 'إنشاء حساب المدير', `<form id="f-login" class="form" data-mode="${exists ? 'in' : 'up'}">
    ${exists ? '' : '<p class="muted">لا يوجد مدير بعد. أول حساب ينشأ هنا يصبح مدير المسابقة الوحيد.</p>'}
    <label>البريد الإلكتروني<input id="lg-email" type="email" autocomplete="username" required dir="ltr"></label>
    <label>كلمة المرور<input id="lg-pass" type="password" autocomplete="${exists ? 'current-password' : 'new-password'}" minlength="8" required dir="ltr"></label>
    <p class="err" id="lg-err" role="alert" hidden></p>
    <button class="btn primary lg" type="submit">${exists ? 'دخول' : 'إنشاء الحساب والدخول'}</button></form>`);
}
const joinLink = code => `${location.origin}${location.pathname}?code=${code}`;
function inviteText(pid) {
  const code = S.codes?.[pid];
  return `مرحبا ${pName(pid)}\nهذا رابطك الشخصي في ${S.core.leagueName}. سجل منه توقعك قبل كل مباراة:\n${joinLink(code)}\nالرابط خاص بك، لا تشاركه.`;
}
function waBtn(pid) {
  const code = S.codes?.[pid];
  if (!code) return `<button class="btn sm" data-act="code-new" data-id="${pid}">إنشاء رابط</button>`;
  return `<a class="btn sm wa" href="https://wa.me/?text=${encodeURIComponent(inviteText(pid))}" target="_blank" rel="noopener">واتساب</a>`;
}
function codeCell(m) {
  if (S.codes === null) return '<span class="muted sm">…</span>';
  const code = S.codes[m.pid];
  if (!code) return `<button class="btn sm" data-act="code-new" data-id="${m.pid}">رابط شخصي</button>`;
  return `<span class="row code-cell">${waBtn(m.pid)}<button class="btn ghost sm" data-act="code-copy" data-id="${m.pid}" title="نسخ رسالة الدعوة">${I(IC.copy, 16)}<span class="sr">نسخ</span></button><button class="btn ghost sm" data-act="code-new" data-id="${m.pid}" title="رابط جديد يلغي القديم">جديد</button></span>`;
}
async function loadCodes() { try { S.codes = await Store.codes(); } catch { S.codes = {}; } if (S.view === 'participants') render(); }
async function loadSubmitted() {
  if (S.memory || !S.season) return;
  const list = await Store.submittedList(S.season.id);
  const m = {}; list.forEach(r => (m[r.match_id] ||= []).push(r.pid));
  if (JSON.stringify(m) !== JSON.stringify(S.submitted)) { S.submitted = m; schedule(); }
}
async function loadMine() {
  if (!S.member) return;
  try { const rows = await Store.memberPredictions(S.member.code); S.mine = Object.fromEntries(rows.map(r => [r.match_id, r])); } catch { }
  schedule();
}
const mineVal = mid => { const r = S.mine[mid]; return r ? { ch: r.ch, op: r.op, scorer: r.scorer || '' } : { ch: '', op: '', scorer: '' }; };
function countdown(iso) {
  const ms = Date.parse(iso) - Date.now(); if (ms <= 0) return 'أغلق';
  const d = Math.floor(ms / 864e5), h = Math.floor(ms % 864e5 / 36e5), m = Math.floor(ms % 36e5 / 6e4);
  return d ? `يغلق بعد ${fmt(d)} يوم و${fmt(h)} ساعة` : h ? `يغلق بعد ${fmt(h)} ساعة و${fmt(m)} دقيقة` : `يغلق بعد ${fmt(Math.max(1, m))} دقيقة`;
}
function vMine() {
  if (!S.member) return `<h1>توقعي</h1><form id="f-code" class="card form"><p>افتح رابطك الشخصي الذي أرسله لك مدير المسابقة، أو اكتب الرمز الموجود في آخر الرابط.</p>
    <label>الرمز الشخصي<input id="mc-code" maxlength="12" autocomplete="one-time-code" dir="ltr" style="text-transform:uppercase;letter-spacing:.2em" required></label>
    <button class="btn primary lg">دخول</button></form>`;
  const open = matchesSorted().filter(m => m.status === 'scheduled' && !isLocked(m) && !S.md[m.id]?.approved).sort((a, b) => (a.kickoff || '').localeCompare(b.kickoff || ''));
  const past = matchesSorted().filter(m => S.mine[m.id] && !open.includes(m)).reverse();
  const squad = S.core.squad || [];
  const card = m => {
    const v = { ...mineVal(m.id), ...(S.mineDraft[m.id] || {}) }, saved = S.mine[m.id];
    const custom = v.scorer && v.scorer !== E.NONE && v.scorer !== E.OG && !squad.includes(v.scorer);
    const step = (k, label) => `<div class="stepper"><span>${label}</span><div><button type="button" class="st" data-act="mine-step" data-id="${m.id}" data-k="${k}" data-d="1" aria-label="زيادة ${label}">+</button><output id="mv-${k}-${m.id}">${v[k] === '' ? '–' : fmt(+v[k])}</output><button type="button" class="st" data-act="mine-step" data-id="${m.id}" data-k="${k}" data-d="-1" aria-label="إنقاص ${label}">−</button></div></div>`;
    return `<section class="card mine-card"><span class="eyebrow">${esc(compName(m.compId))} · الجولة ${fmt(roundById(m.roundId)?.no)} · ${fmtDate(m.kickoff, { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })}</span>
      <div class="steppers">${step('ch', 'تشلسي')}<b class="dash">–</b>${step('op', esc(m.opponent))}</div>
      <label>الهداف الأول<select id="ms-${m.id}" data-mine-scorer="${m.id}"><option value="">اختر</option><option value="${E.NONE}" ${v.scorer === E.NONE ? 'selected' : ''}>لا يوجد هدف</option>${squad.map(x => `<option ${v.scorer === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}<option value="${E.OG}" ${v.scorer === E.OG ? 'selected' : ''}>هدف عكسي</option><option value="__other" ${custom ? 'selected' : ''}>لاعب آخر</option></select></label>
      <input id="mo-${m.id}" data-mine-other="${m.id}" placeholder="اسم اللاعب" value="${custom ? esc(v.scorer) : ''}" ${custom ? '' : 'hidden'} maxlength="40">
      <div class="row between wrap"><span class="pill warn" data-countdown="${lockTime(m)}">${countdown(lockTime(m))}</span>${saved ? `<span class="pill ok">محفوظ ${fmtDate(saved.at, { hour: 'numeric', minute: '2-digit' })}</span>` : '<span class="pill">لم ترسل بعد</span>'}</div>
      <button class="btn primary lg" data-act="mine-submit" data-id="${m.id}">${saved ? 'تحديث توقعي' : 'إرسال توقعي'}</button></section>`;
  };
  return `<div class="row between wrap"><h1>توقعي</h1><button class="btn ghost sm" data-act="member-forget">ليس أنا</button></div>
    <p class="muted">مرحبا ${esc(pName(S.member.pid))}. يمكنك تعديل توقعك حتى إغلاق الباب عند صافرة البداية.</p>
    ${open.length ? open.map(card).join('') : '<div class="card empty"><p>لا توجد مباراة مفتوحة للتوقع الآن.</p></div>'}
    ${past.length ? `<section class="card"><h2>توقعاتي السابقة</h2><div class="table-wrap"><table class="grid"><thead><tr><th>المباراة</th><th>توقعي</th><th>الهداف</th><th>النقاط</th></tr></thead><tbody>${past.map(m => { const r = S.mine[m.id], c = S.md[m.id]?.calc?.[S.member.pid]; return `<tr><td>ج${fmt(roundById(m.roundId)?.no)} · ${esc(m.opponent)}</td><td class="num">${fmt(r.ch)}–${fmt(r.op)}</td><td>${esc(scorerLabel(r.scorer))}</td><td class="num">${S.md[m.id]?.approved ? `<b>${fmt(c?.total ?? 0)}</b>` : '<span class="muted">بانتظار النتيجة</span>'}</td></tr>`; }).join('')}</tbody></table></div></section>` : ''}`;
}
async function submitMine(mid) {
  const v = { ...mineVal(mid), ...(S.mineDraft[mid] || {}) };
  if (v.ch === '' || v.op === '') return toast('حدد نتيجة الفريقين', 'err');
  if (!v.scorer) return toast('اختر الهداف الأول أو "لا يوجد هدف"', 'err');
  if (+v.ch + +v.op === 0 && v.scorer !== E.NONE && !await ask('تأكيد', '<p>توقعت مباراة دون أهداف لكن اخترت هدافا. هل تريد الإرسال هكذا؟</p>', 'إرسال')) return;
  try {
    await Store.memberSubmit(S.member.code, mid, +v.ch, +v.op, v.scorer);
    delete S.mineDraft[mid];
    await loadMine(); loadSubmitted();
    toast('وصل توقعك');
  } catch (e) { toast(e.message, 'err'); }
}
setInterval(() => {
  let expired = false;
  $$('[data-countdown]').forEach(el => { const t = countdown(el.dataset.countdown); el.textContent = t; if (t === 'أغلق') expired = true; });
  if (expired) schedule();
}, 30000);

/* ---------- render ---------- */
function render() {
  const root = $('#app');
  if (!S.ready) { root.innerHTML = `<div class="boot"><span class="mark">${crestSVG()}</span><p>جار تحميل المسابقة…</p></div>`; return; }
  if (S.setupMissing) { root.innerHTML = setupMissingView(); return; }
  if (!S.core || !S.core.currentSeasonId || !S.season) {
    if (S.core?.currentSeasonId && !S.season) { root.innerHTML = layout('<p class="muted">جار تحميل الموسم…</p>'); return; }
    root.innerHTML = layout(emptyState()); return;
  }
  const views = { home: vHome, matches: vMatches, match: vMatch, table: vTable, participants: vParticipants, profile: vProfile, h2h: vH2H, history: vHistory, studio: vStudio, settings: vSettings, audit: vAudit, tests: vTests, guide: vGuide, more: vMore, mine: vMine };
  const scroll = window.scrollY;
  root.innerHTML = layout((views[S.view] || vHome)());
  window.scrollTo(0, scroll);
  if (S.view === 'studio') drawStudio();
}
function go(v, param = null, tab = null) {
  S.view = v; S.param = param; S.tab = tab; if (v !== 'studio') S.studioPage = 0;
  if (v === 'audit') S.audit = null;
  lsSet('view', ['match', 'profile'].includes(v) ? 'home' : v);
  render(); window.scrollTo(0, 0); $('#main')?.focus({ preventScroll: true });
}

/* ---------- actions ---------- */
async function approve(m, form) {
  const val = id => E.toLatinDigits($(id, form)?.value ?? '').trim();
  const num = id => val(id) === '' ? null : Number(val(id));
  const r = {
    status: $('#fr-status', form).value, ch: num('#fr-ch'), op: num('#fr-op'), extraTime: $('#fr-et', form).checked,
    ch90: num('#fr-ch90'), op90: num('#fr-op90'), pens: $('#fr-pens', form).value || null,
    firstScorer: scorerFromInput($('#fr-fs', form).value) === E.NONE ? '' : $('#fr-fs', form).value.trim(), firstScorerOG: $('#fr-fsog', form).checked,
    firstChelseaScorer: $('#fr-fcs', form).value.trim(), firstChelseaOG: $('#fr-fcsog', form).checked,
    playedAt: localToISO($('#fr-date', form).value) || m.kickoff
  };
  if (!r.extraTime) { r.ch90 = null; r.op90 = null; r.pens = null; }
  if (r.status !== 'finished') {
    if (r.status === 'postponed') { if (!await ask('تأجيل المباراة', '<p>ستتحول المباراة إلى مؤجلة دون احتساب نقاط. عدل موعدها لاحقا من "بيانات المباراة".</p>')) return; m.status = 'postponed'; await saveSeason(); await audit('match_edit', { text: `تأجيل ${m.opponent}` }); toast('سجلت المباراة مؤجلة'); render(); return; }
    m.status = 'cancelled';
  }
  const errs = E.validateResult(r, { kickoff: r.playedAt });
  if (r.status === 'finished' && errs.length) { toast(errs[0], 'err'); return; }
  const d = clone(mdOf(m.id));
  const rules = { ...E.ruleForDate(S.season.rules, r.playedAt || m.kickoff) };
  const ids = members().map(x => x.pid);
  const wasApproved = d.approved, prev = d.result;
  if (wasApproved && JSON.stringify(prev) !== JSON.stringify(r)) { d.history = [...(d.history || []), { at: new Date().toISOString(), prev }].slice(-20); }
  const keepRules = wasApproved && d.appliedRules ? d.appliedRules : rules;
  d.result = r; d.approved = true; d.appliedRules = keepRules; d.calc = applyLate(E.calcMatch(d, keepRules, ids), d, keepRules); d.approvedAt = new Date().toISOString(); d.seasonId = S.season.id; d.matchId = m.id;
  if (r.status === 'finished' && m.status !== 'finished') m.status = 'finished';
  try {
    await save('md/' + m.id, d);
    await saveSeason();
  } catch { return; }
  const total = Object.values(d.calc).reduce((s, c) => s + (c.total || 0), 0);
  await audit(wasApproved ? 'reapprove' : 'approve', { text: `${m.opponent} ${r.ch ?? ''}-${r.op ?? ''} · الهداف: ${r.firstScorer || (r.ch + r.op === 0 ? 'لا يوجد' : 'بانتظار التحقق')} · مجموع النقاط الموزعة ${total}` });
  const max = Math.max(0, ...Object.values(d.calc).map(c => c.total || 0));
  const champs = Object.entries(d.calc).filter(([, c]) => c.total === max && max > 0).map(([p]) => pName(p));
  toast(wasApproved ? 'حدثت النتيجة وأعيد الاحتساب' : `اعتمدت النتيجة${champs.length ? ' · الأعلى: ' + champs.join('، ') + ' (' + max + ')' : ''}`);
  S.tab = 'calc'; render();
}
function applyLate(calc, d, rules) {
  if (rules.latePolicy !== 'zero') return calc;
  for (const [p, c] of Object.entries(calc)) if (d.predictions?.[p]?.late) calc[p] = { ...c, w: 0, e: 0, s: 0, b: 0, total: 0, lateZero: true };
  return calc;
}
function collectPredDraft(mid) {
  const tbl = $(`.pred-grid[data-mid="${mid}"]`); if (!tbl) return;
  const d = S.draft[mid] ||= {};
  $$('tr[data-pid]', tbl).forEach(tr => {
    if (!tr.dataset.dirty) return;
    const pid = tr.dataset.pid, g = k => $(`[data-k="${k}"]`, tr);
    d[pid] = { ch: E.toLatinDigits(g('ch').value).trim(), op: E.toLatinDigits(g('op').value).trim(), scorer: scorerFromInput(g('scorer').value), late: g('late').checked };
  });
}
async function savePreds(mid, silent = false) {
  collectPredDraft(mid);
  const m = matchById(mid), d = clone(mdOf(mid)), draft = S.draft[mid] || {};
  const locked = isLocked(m);
  let changed = [], bad = [];
  for (const [pid, v] of Object.entries(draft)) {
    const cur = d.predictions?.[pid];
    if (v.ch === '' && v.op === '' && !v.scorer) { if (cur) { delete d.predictions[pid]; changed.push(pid); } continue; }
    if (!/^\d{1,2}$/.test(v.ch) || !/^\d{1,2}$/.test(v.op)) { bad.push(pName(pid)); continue; }
    const nv = { ch: +v.ch, op: +v.op, scorer: v.scorer || '', late: !!v.late, at: cur && cur.ch === +v.ch && cur.op === +v.op && cur.scorer === v.scorer ? cur.at : new Date().toISOString() };
    if (!cur || cur.ch !== nv.ch || cur.op !== nv.op || cur.scorer !== nv.scorer || !!cur.late !== nv.late) { (d.predictions ||= {})[pid] = nv; changed.push(pid); }
  }
  if (bad.length && !silent) toast('أكمل نتيجة الفريقين لـ: ' + bad.slice(0, 3).join('، '), 'err');
  if (!changed.length) { if (!silent && !bad.length) toast('لا توجد تغييرات'); return; }
  if (d.approved) { d.calc = applyLate(E.calcMatch(d, d.appliedRules, members().map(x => x.pid)), d, d.appliedRules); }
  d.seasonId = S.season.id; d.matchId = mid;
  try { await save('md/' + mid, d); } catch { return; }
  changed.forEach(p => delete draft[p]);
  if (bad.length === 0) delete S.draft[mid];
  await audit(locked ? 'late' : 'preds', { text: `${m.opponent}: ${changed.length} توقع (${changed.map(pName).slice(0, 6).join('، ')}${changed.length > 6 ? '…' : ''})${d.approved ? ' · أعيد الاحتساب' : ''}` });
  if (!silent) toast(d.approved ? 'حفظت التوقعات وأعيد احتساب المباراة' : `حفظ ${changed.length} توقع`);
  else { const st = $('.pred-grid')?.closest('.tabpanel')?.querySelector('.muted'); if (st) st.textContent = `حفظ تلقائي ${new Date().toLocaleTimeString('ar-SA-u-nu-' + nu(), { hour: '2-digit', minute: '2-digit' })}`; }
}
const autosave = debounce(mid => { const m = matchById(mid); if (m && !S.md[mid]?.approved && (!isLocked(m) || S.lateMode[mid])) savePreds(mid, true); }, 1500);

async function saveMatchForm(f) {
  const id = f.dataset.id;
  let roundId = $('#fm-round', f).value;
  const opp = $('#fm-opp', f).value.trim(), ko = localToISO($('#fm-ko', f).value);
  if (!opp || !ko) { toast('أدخل الفريق المنافس وموعد الانطلاق', 'err'); return; }
  if (roundId === '__new') {
    const no = +$('#fm-roundno', f).value;
    if (!no || no < 1) { toast('أدخل رقم جولة صحيحا', 'err'); return; }
    const ex = S.season.rounds.find(r => r.no === no);
    if (ex) roundId = ex.id; else { roundId = uid('r'); S.season.rounds.push({ id: roundId, no, name: '' }); }
  }
  const data = { roundId, compId: $('#fm-comp', f).value, opponent: opp, home: $('#fm-home', f).value === '1', kickoff: ko, lockAt: localToISO($('#fm-lock', f).value) || '', status: $('#fm-status', f).value };
  if (data.status === 'finished' && Date.parse(ko) > Date.now()) { toast('لا يمكن تحديد مباراة لم يحن موعدها كمنتهية', 'err'); return; }
  let m;
  if (id) {
    m = matchById(id);
    const reset = m.status === 'postponed' && data.status === 'scheduled' && E.ruleForDate(S.season.rules, ko).postponedPolicy === 'reset';
    Object.assign(m, data);
    if (reset && S.md[id] && !S.md[id].approved) { const d = clone(S.md[id]); d.predictions = {}; await save('md/' + id, d); }
  } else { m = { id: uid('m'), ...data }; S.season.matches.push(m); }
  try { await saveSeason(); } catch { return; }
  await audit(id ? 'match_edit' : 'match_add', { text: `ج${roundById(roundId)?.no} · ${opp} · ${fmtDate(ko)}` });
  toast(id ? 'حدثت المباراة' : 'أضيفت المباراة');
  $('#modal').hidden = true; $('#modal').innerHTML = '';
  go('match', m.id, 'preds');
}

async function saveParticipant(f) {
  const id = f.dataset.id, name = $('#fp-name', f).value.trim(), alias = $('#fp-alias', f).value.trim();
  if (!name) return;
  const dup = P().find(p => p.id !== id && (E.norm(p.name) === E.norm(name)));
  if (dup) { const inSeason = S.season.members.some(m => m.pid === dup.id); if (!inSeason && !id && await ask('مشارك موجود', `<p>"${esc(dup.name)}" موجود من موسم سابق. هل تريد إضافته لهذا الموسم بسجله نفسه؟</p>`, 'إضافة')) { S.season.members.push({ pid: dup.id, joined: todayISO(), active: true }); await saveSeason(); closeModal(); render(); return; } toast('يوجد مشارك بالاسم نفسه. أضف لقبا أو اسما مميزا', 'err'); return; }
  const file = $('#fp-img', f).files[0];
  let img = id ? pById(id)?.img : '';
  if (file) img = await storeImage(file, 160, img);
  const active = $('#fp-active', f).checked, joined = $('#fp-joined', f).value || todayISO();
  if (id) { const p = pById(id); Object.assign(p, { name, alias, img, active }); const mm = S.season.members.find(m => m.pid === id); if (mm) Object.assign(mm, { joined, active }); }
  else { const p = { id: uid('p'), name, alias, img, active: true, createdAt: new Date().toISOString() }; S.core.participants.push(p); S.season.members.push({ pid: p.id, joined, active: true }); }
  try { await saveCore(); await saveSeason(); } catch { return; }
  await audit(id ? 'p_edit' : 'p_add', { text: name });
  toast(id ? 'حدث المشارك' : 'أضيف المشارك'); closeModal(); render();
}
function closeModal() { $('#modal').hidden = true; $('#modal').innerHTML = ''; }
async function storeImage(file, max, replaceId) {
  const url = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(file); });
  const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
  const s = Math.min(1, max / Math.max(im.width, im.height));
  const cv = document.createElement('canvas'); cv.width = Math.round(im.width * s); cv.height = Math.round(im.height * s);
  const c = cv.getContext('2d');
  if (max <= 200) { const side = Math.min(im.width, im.height); cv.width = cv.height = max; c.drawImage(im, (im.width - side) / 2, (im.height - side) / 2, side, side, 0, 0, max, max); }
  else c.drawImage(im, 0, 0, cv.width, cv.height);
  const data = max <= 200 ? cv.toDataURL('image/jpeg', 0.85) : cv.toDataURL('image/png');
  const id = replaceId || uid('i');
  await save('img/' + id, { data });
  return id;
}

async function exportImage(fmtType, all = false) {
  const cv = $('#cv'); if (!cv) return;
  const o = studioOpts();
  const t = Studio.TEMPLATES.find(x => x.id === o.template);
  const base = `cpl-${t.no}-${t.id}-${new Date().toISOString().slice(0, 10)}`;
  const pages = all ? [...Array(S.studioPages).keys()] : [S.studioPage];
  if (fmtType === 'pdf') {
    try { await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'); }
    catch { toast('تعذر تحميل مكتبة PDF. استخدم PNG', 'err'); return; }
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: cv.width > cv.height ? 'l' : 'p', unit: 'px', format: [cv.width, cv.height], hotfixes: ['px_scaling'] });
    for (let i = 0; i < S.studioPages; i++) { await renderPage(i); if (i) pdf.addPage([cv.width, cv.height], cv.width > cv.height ? 'l' : 'p'); pdf.addImage(cv.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, cv.width, cv.height); }
    await renderPage(S.studioPage);
    await saveFile(base + '.pdf', pdf.output('blob'));
    return;
  }
  for (const p of pages) {
    await renderPage(p);
    const blob = await new Promise(r => cv.toBlob(r, fmtType === 'jpeg' ? 'image/jpeg' : 'image/png', 0.95));
    const ok = await saveFile(`${base}${S.studioPages > 1 ? `-${p + 1}of${S.studioPages}` : ''}.${fmtType === 'jpeg' ? 'jpg' : 'png'}`, blob);
    if (!ok) break;
  }
  if (all) await renderPage(S.studioPage);
  recordLastImage();
}
async function renderPage(p) { S.studioPage = p; await drawStudio(); }
async function saveFile(name, blob) {
  let dl = null; try { dl = await window.claude?.use?.('downloads'); } catch { }
  if (dl) {
    try { let r; try { r = await dl.save({ filename: name, data: blob }); } catch (e1) { if (e1.code !== 'rate_limited') throw e1; await new Promise(z => setTimeout(z, 1500)); r = await dl.save({ filename: name, data: blob }); } if (r?.status === 'saved') toast('حفظ الملف: ' + name); return true; }
    catch (e) { if (e.code === 'declined') return false; toast('لم يحفظ الملف: ' + (e.message || e.code), 'err'); return false; }
  }
  try { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000); toast('بدأ التحميل: ' + name); return true; }
  catch { toast('التحميل غير متاح في هذا العرض', 'err'); return false; }
}
async function recordLastImage() {
  if (!S.canEdit) return;
  const cv = $('#cv'); const t = document.createElement('canvas'); const r = 240 / cv.width; t.width = 240; t.height = Math.round(cv.height * r);
  t.getContext('2d').drawImage(cv, 0, 0, t.width, t.height);
  S.core.lastImage = { template: studioOpts().template, at: new Date().toISOString(), thumb: t.toDataURL('image/jpeg', 0.7) };
  try { await saveCore(); } catch { }
}
const scriptCache = {};
function loadScript(src) { return scriptCache[src] ||= new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => { delete scriptCache[src]; rej(); }; document.head.appendChild(s); }); }
async function readTable(file) {
  if (/\.(xlsx|xls)$/i.test(file.name)) {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
    const wb = window.XLSX.read(await file.arrayBuffer(), { type: 'array' });
    return window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' }).filter(r => r.some(c => String(c).trim()));
  }
  return E.parseCSV(await file.text());
}
function matchP(name) { const n = E.norm(name); return members().find(m => E.norm(m.name) === n || (m.alias && E.norm(m.alias) === n)); }

/* import flows */
function importSheet(title, hint, onRows) {
  sheet(title, `<p class="muted">${hint}</p><input type="file" id="imp-file" accept=".csv,.xlsx,.xls,text/csv"><div id="imp-prev"></div>`);
  $('#imp-file').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try { const rows = await readTable(f); onRows(rows, $('#imp-prev')); } catch { toast('تعذر قراءة الملف. تأكد أنه CSV أو Excel', 'err'); }
  };
}
const isHeader = row => row.some(c => /اسم|name|مشارك|نقاط|points|جولة|round/i.test(String(c)));

function waSheet(mid) {
  const m = matchById(mid);
  sheet('لصق التوقعات من واتساب', `<p class="muted">انسخ رسائل التوقعات من المجموعة (أو صدر المحادثة نصيا) والصقها هنا. سيبحث التحليل عن نتيجة مثل 2-1 واسم الهداف، ويطابق المرسل مع المشاركين. افترض أن الرقم الأول لتشلسي، وراجع قبل الحفظ.</p>
    <textarea id="wa-text" rows="8" placeholder="[18/10/2026, 6:01 م] أبو فهد: 2-1 بالمر"></textarea><div class="row end"><button class="btn" id="wa-parse">تحليل</button></div><div id="wa-prev"></div>`);
  $('#wa-parse').onclick = () => {
    const rows = E.parseChat($('#wa-text').value, members(), S.core.squad || []).filter(r => !r.superseded);
    if (!rows.length) { $('#wa-prev').innerHTML = '<p class="muted">لم يعثر على توقعات. تأكد أن كل رسالة تحتوي نتيجة مثل 2-1.</p>'; return; }
    $('#wa-prev').innerHTML = `<div class="table-wrap"><table class="grid"><thead><tr><th>المرسل</th><th>المشارك</th><th>تشلسي</th><th>${esc(m.opponent)}</th><th>الهداف</th><th>اعتماد</th></tr></thead><tbody>${rows.map((r, i) => `<tr data-i="${i}"><td>${esc(r.sender)}<small class="muted d">${esc(r.raw)}</small></td><td><select data-k="pid"><option value="">غير مطابق</option>${members().map(p => `<option value="${p.pid}" ${r.pid === p.pid ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></td><td><input class="sc" data-k="ch" value="${r.ch}" inputmode="numeric"></td><td><input class="sc" data-k="op" value="${r.op}" inputmode="numeric"></td><td><input data-k="scorer" list="squad-list" value="${esc(scorerLabelEdit(r.scorer))}"></td><td><input type="checkbox" data-k="ok" ${r.pid ? 'checked' : ''}></td></tr>`).join('')}</tbody></table></div>${squadDatalist()}<div class="row end"><button class="btn primary" id="wa-apply">إضافة إلى الجدول</button></div>`;
    $('#wa-apply').onclick = () => {
      const dr = S.draft[mid] ||= {}; let n = 0;
      $$('#wa-prev tr[data-i]').forEach(tr => { const g = k => $(`[data-k="${k}"]`, tr); if (!g('ok').checked || !g('pid').value) return; dr[g('pid').value] = { ch: E.toLatinDigits(g('ch').value), op: E.toLatinDigits(g('op').value), scorer: scorerFromInput(g('scorer').value), late: false }; n++; });
      closeModal(); S.tab = 'preds'; render(); toast(`أضيف ${n} توقع للجدول. راجع ثم اضغط حفظ`);
    };
  };
}

/* demo data */
async function loadDemo() {
  if (!await ask('تحميل البيانات التجريبية', '<p>سينشأ موسم تجريبي منفصل مع 12 مشاركا تجريبيا. لن تتأثر بياناتك، ويمكن حذفه بالكامل لاحقا.</p>', 'تحميل')) return;
  if (!S.core) S.core = defaultCore();
  const names = [['أبو فهد', 'الكابتن'], ['سلطان', ''], ['عبدالله', 'دروغبا'], ['تركي', ''], ['ماجد', 'العراف'], ['نواف', ''], ['فيصل', 'لامبارد'], ['خالد', ''], ['بندر', ''], ['ريان', 'الأزرق'], ['عمر', ''], ['يزيد', '']];
  const parts = names.map(([n, a]) => ({ id: uid('p'), name: n + ' (تجريبي)', alias: a, img: '', active: true, demo: true, createdAt: new Date().toISOString() }));
  const s = newSeasonDoc('2026/2027', 'all'); s.demo = true; s.histMode = 'opening'; s.startRound = 6;
  s.members = parts.map(p => ({ pid: p.id, joined: '2026-08-15', active: true }));
  s.rounds = [6, 7].map(no => ({ id: uid('r'), no, name: '' }));
  const now = Date.now();
  const m6 = { id: uid('m'), roundId: s.rounds[0].id, compId: 'pl', opponent: 'أرسنال', home: true, kickoff: new Date(now - 3 * 864e5).toISOString(), status: 'finished', lockAt: '' };
  const m7 = { id: uid('m'), roundId: s.rounds[1].id, compId: 'pl', opponent: 'توتنهام', home: false, kickoff: new Date(now + 4 * 864e5).toISOString(), status: 'scheduled', lockAt: '' };
  s.matches = [m6, m7];
  const opening = {}; [18, 16, 15, 15, 12, 11, 10, 9, 9, 7, 5, 3].forEach((v, i) => opening[parts[i].id] = { points: v, note: 'مجموع الجولات 1-5 من جدول المجموعة' });
  const pool = [[3, 1, 'بالمر'], [2, 1, 'جاكسون'], [1, 1, 'ساكا'], [3, 1, 'جاكسون'], [2, 0, 'بالمر'], [0, 1, 'ساكا'], [3, 1, 'بالمر'], [1, 2, 'أوديغارد'], [2, 2, 'بالمر'], [3, 0, 'نكونكو'], [1, 0, 'بالمر'], [3, 2, 'جاكسون']];
  const preds = {}; parts.forEach((p, i) => { const [ch, op, sc] = pool[i]; preds[p.id] = { ch, op, scorer: sc, late: false, at: new Date(now - 3.2 * 864e5).toISOString() }; });
  const md6 = { seasonId: s.id, matchId: m6.id, predictions: preds, result: { status: 'finished', ch: 3, op: 1, extraTime: false, firstScorer: 'بالمر', firstScorerOG: false, firstChelseaScorer: 'بالمر', firstChelseaOG: false, playedAt: m6.kickoff }, approved: true, history: [] };
  md6.appliedRules = { ...s.rules[0] }; md6.calc = E.calcMatch(md6, md6.appliedRules, parts.map(p => p.id)); md6.approvedAt = new Date().toISOString();
  const md7 = { seasonId: s.id, matchId: m7.id, predictions: Object.fromEntries(parts.slice(0, 7).map((p, i) => [p.id, { ch: [2, 1, 2, 3, 1, 2, 0][i], op: [1, 1, 0, 1, 0, 2, 0][i], scorer: ['بالمر', 'جاكسون', 'بالمر', 'نكونكو', 'بالمر', 'سون', E.NONE][i], late: false, at: new Date().toISOString() }])), result: null, approved: false, history: [] };
  S.core.participants.push(...parts);
  S.core.seasons.push({ id: s.id, name: s.name, start: '2026-08-15', end: '2027-05-30', status: 'active', demo: true });
  S.core.prevSeasonId = S.core.currentSeasonId || null;
  S.core.currentSeasonId = s.id;
  if (!(S.core.squad || []).length) S.core.squad = ['بالمر', 'جاكسون', 'نكونكو', 'إنزو', 'كايسيدو', 'مودريك'];
  S.season = s; S.hist = { opening, rounds: [] };
  try {
    await save('seasons/' + s.id, s); await save('hist/' + s.id, S.hist); await save('md/' + m6.id, md6); await save('md/' + m7.id, md7);
    await saveCore();
  } catch { return; }
  await audit('demo', { text: 'تحميل موسم تجريبي' });
  toast('حملت البيانات التجريبية'); go('home');
}
async function deleteDemo() {
  if (!await ask('حذف البيانات التجريبية', '<p>سيحذف الموسم التجريبي ومشاركوه ومبارياته نهائيا. بياناتك الحقيقية لن تتأثر.</p>', 'حذف', true)) return;
  const demoS = S.core.seasons.filter(s => s.demo).map(s => s.id);
  for (const sid of demoS) {
    const mds = await getCol('md', 'seasonId', sid);
    for (const d of mds) await remove('md/' + d.id);
    await remove('seasons/' + sid); await remove('hist/' + sid);
  }
  S.core.participants = S.core.participants.filter(p => !p.demo);
  S.core.seasons = S.core.seasons.filter(s => !s.demo);
  if (demoS.includes(S.core.currentSeasonId)) S.core.currentSeasonId = S.core.prevSeasonId && S.core.seasons.find(s => s.id === S.core.prevSeasonId) ? S.core.prevSeasonId : (S.core.seasons[0]?.id || null);
  delete S.core.prevSeasonId;
  if (S.memory) { S.season = S.core.currentSeasonId ? clone(mem['seasons/' + S.core.currentSeasonId]) : null; S.md = {}; Object.entries(mem).forEach(([k, v]) => { if (k.startsWith('md/') && v.seasonId === S.core.currentSeasonId) S.md[k.slice(3)] = clone(v); }); S.hist = clone(mem['hist/' + S.core.currentSeasonId]) || { opening: {}, rounds: [] }; }
  await saveCore(); await audit('demo', { text: 'حذف البيانات التجريبية' });
  toast('حذفت البيانات التجريبية'); go('home');
}
async function switchSeason(id) {
  S.core.currentSeasonId = id;
  if (S.memory) { S.season = clone(mem['seasons/' + id]); S.md = {}; Object.entries(mem).forEach(([k, v]) => { if (k.startsWith('md/') && v.seasonId === id) S.md[k.slice(3)] = clone(v); }); S.hist = clone(mem['hist/' + id]) || { opening: {}, rounds: [] }; }
  if (S.canEdit) await saveCore(); else { subscribeSeason(); }
  go('home');
}

/* backup */
async function backup() {
  try {
    const seasons = await getCol('seasons'), mds = await getCol('md'), hist = await getCol('hist'), imgs = await getCol('img');
    const data = { app: 'chelsea-prediction-league', version: 1, exportedAt: new Date().toISOString(), core: S.core, seasons, md: mds, hist, img: imgs };
    await saveFile(`cpl-backup-${new Date().toISOString().slice(0, 10)}.json`, new Blob([JSON.stringify(data)], { type: 'application/json' }));
  } catch (e) { toast('تعذر تصدير النسخة: ' + (e.message || e.code), 'err'); }
}
async function restore(file) {
  let data; try { data = JSON.parse(await file.text()); } catch { toast('الملف ليس نسخة احتياطية صالحة', 'err'); return; }
  if (data.app !== 'chelsea-prediction-league' || !data.core) { toast('الملف ليس نسخة احتياطية من هذا التطبيق', 'err'); return; }
  if (!await ask('استعادة نسخة احتياطية', `<p>ستكتب بيانات النسخة (${fmtDate(data.exportedAt)}): ${fmt(data.seasons.length)} مواسم، ${fmt(data.md.length)} مباريات. البيانات الحالية بالمعرفات نفسها ستستبدل.</p>`, 'استعادة', true)) return;
  try {
    for (const x of data.seasons) await save('seasons/' + x.id, x.data);
    for (const x of data.md) await save('md/' + x.id, x.data);
    for (const x of data.hist) await save('hist/' + x.id, x.data);
    for (const x of data.img || []) await save('img/' + x.id, x.data);
    await save('league/core', data.core);
    if (S.memory) await switchSeason(data.core.currentSeasonId);
  } catch { return; }
  await audit('restore', { text: 'استعادة نسخة ' + data.exportedAt });
  toast('استعيدت النسخة الاحتياطية'); go('home');
}

/* ---------- event delegation ---------- */
document.addEventListener('click', async e => {
  const t = e.target.closest('[data-go],[data-act],[data-open-match],[data-tab],[data-profile],[data-why],[data-comp],[data-hround]');
  if (!t || t.disabled) return;
  if (t.dataset.go) { if (t.dataset.go === 'participants') S.tab = null; return go(t.dataset.go); }
  if (t.dataset.openMatch) return go('match', t.dataset.openMatch);
  if (t.dataset.tab) { if (S.view === 'match') collectPredDraft(S.param); S.tab = t.dataset.tab; return render(); }
  if (t.dataset.profile) return go('profile', t.dataset.profile);
  if (t.dataset.why) return whySheet(t.dataset.why);
  if (t.dataset.comp != null && t.matches('.chip')) { S.compFilter = t.dataset.comp; return render(); }
  if (t.dataset.hround) { S.histRound = +t.dataset.hround; return render(); }
  const a = t.dataset.act, id = t.dataset.id;
  const act = {
    theme() { const r = document.documentElement; const cur = r.dataset.theme || 'dark'; r.dataset.theme = cur === 'dark' ? 'light' : 'dark'; lsSet('theme', r.dataset.theme); },
    'match-new'() { sheet('مباراة جديدة', matchForm()); },
    'go-predict'() { const m = matchesSorted().find(m => !S.md[m.id]?.approved && m.status === 'scheduled'); m ? go('match', m.id, 'preds') : (toast('أضف مباراة أولا'), sheet('مباراة جديدة', matchForm())); },
    'go-result'() { const m = matchesSorted().filter(m => !S.md[m.id]?.approved && m.status !== 'cancelled').sort((a, b) => (a.kickoff || '').localeCompare(b.kickoff || ''))[0]; m ? go('match', m.id, 'result') : toast('لا توجد مباراة بانتظار الاعتماد'); },
    'go-history'() { go('history'); },
    login() { loginSheet(); },
    async logout() { if (!await ask('تسجيل الخروج', '<p>ستتحول إلى وضع المشاهدة على هذا الجهاز.</p>', 'خروج')) return; await Store.signOut(); S.canEdit = false; S.codes = null; go('home'); },
    async 'code-new'() { try { const code = await Store.setCode(id); S.codes = { ...(S.codes || {}), [id]: code }; await audit('p_edit', { text: 'رابط شخصي جديد: ' + pName(id) }); render(); toast('أنشئ الرابط. أرسله للمشارك'); } catch (e) { toast(e.message || 'تعذر إنشاء الرابط', 'err'); } },
    async 'code-drop'() { if (!await ask('إلغاء الرابط', `<p>الرابط الحالي لـ"${esc(pName(id))}" سيتوقف عن العمل فورا.</p>`, 'إلغاء الرابط', true)) return; await Store.dropCode(id); delete S.codes[id]; await audit('p_edit', { text: 'إلغاء رابط: ' + pName(id) }); render(); },
    async 'code-copy'() { const txt = inviteText(id); try { await navigator.clipboard.writeText(txt); toast('نسخت رسالة الدعوة'); } catch { sheet('رسالة الدعوة', `<textarea rows="6" readonly>${esc(txt)}</textarea>`); } },
    async 'codes-all'() {
      const list = activeMembers();
      const missing = list.filter(m => !S.codes?.[m.pid]);
      for (const m of missing) S.codes = { ...(S.codes || {}), [m.pid]: await Store.setCode(m.pid) };
      if (missing.length) await audit('p_edit', { text: `روابط شخصية جديدة: ${missing.length}` });
      sheet('روابط المشاركين', `<p class="muted">اضغط واتساب بجوار كل اسم لإرسال رابطه الشخصي له مباشرة. لا ترسل روابط الأعضاء في المجموعة العامة.</p><div class="plist">${list.map(m => `<div class="prow"><b>${esc(m.name)}</b><span></span><span></span>${waBtn(m.pid)}</div>`).join('')}</div>`);
      render();
    },
    async 'mine-submit'() { await submitMine(id); },
    'mine-step'() { const k = t.dataset.k, dlt = +t.dataset.d; const dr = S.mineDraft[id] ||= { ...mineVal(id) }; dr[k] = Math.max(0, Math.min(20, (+dr[k] || 0) + dlt)); render(); },
    async 'member-forget'() { if (!await ask('تسجيل الخروج', '<p>سيحذف رابطك الشخصي من هذا الجهاز. تحتاج الرابط مرة أخرى للدخول.</p>', 'خروج')) return; lsSet('memberCode', null); S.member = null; S.mine = {}; go('home'); }, 'go-table'() { go('table'); }, 'go-studio'() { S.studioLocal = { ...(S.studioLocal || {}), template: 'leaderboard' }; go('studio'); },
    'studio-match'() { S.studioLocal = { ...(S.studioLocal || {}), template: 'matchday', matchId: id }; go('studio'); },
    async 'match-del'() {
      const d = S.md[id];
      if (!await ask('حذف المباراة', `<p>${d?.approved ? '<b>المباراة معتمدة.</b> حذفها يزيل نقاطها من الترتيب. ' : ''}${Object.keys(d?.predictions || {}).length ? `ستحذف ${fmt(Object.keys(d.predictions).length)} توقعات مرتبطة بها. ` : ''}لا يمكن التراجع.</p>`, 'حذف', true)) return;
      const m = matchById(id); S.season.matches = S.season.matches.filter(x => x.id !== id);
      await saveSeason(); if (d) await remove('md/' + id); await audit('match_del', { text: m.opponent + (d?.approved ? ' (معتمدة)' : '') }); closeModal(); go('matches');
    },
    async 'rounds-bulk'() {
      if (!await ask('إنشاء جولات', `<label>من الجولة<input id="rb-a" type="number" min="1" value="${(rounds().slice(-1)[0]?.no || 0) + 1}"></label><label>إلى الجولة<input id="rb-b" type="number" min="1" value="38"></label>`, 'إنشاء')) return;
    },
    'late-on'() { S.lateMode[id] = true; audit('late', { text: 'تفعيل الإدخال بعد الإغلاق: ' + matchById(id)?.opponent }); render(); },
    'pred-save'() { savePreds(id); }, 'pred-clear'() { delete S.draft[id]; render(); },
    'wa-open'() { collectPredDraft(id); waSheet(id); },
    'pred-import'() {
      collectPredDraft(id);
      importSheet('استيراد التوقعات', 'الأعمدة بالترتيب: اسم المشارك، أهداف تشلسي، أهداف الخصم، الهداف الأول. الصف الأول يمكن أن يكون عناوين.', (rows, box) => {
        const data = (isHeader(rows[0]) ? rows.slice(1) : rows).map(r => ({ p: matchP(r[0]), name: r[0], ch: E.toLatinDigits(r[1]).trim(), op: E.toLatinDigits(r[2]).trim(), scorer: scorerFromInput(String(r[3] || '')) }));
        box.innerHTML = `<p>${fmt(data.filter(x => x.p).length)} مطابق من ${fmt(data.length)}.</p><ul class="log">${data.map(x => `<li>${x.p ? '✓' : '✗ غير مطابق:'} ${esc(x.name)} · ${esc(x.ch)}-${esc(x.op)} · ${esc(scorerLabel(x.scorer))}</li>`).join('')}</ul><div class="row end"><button class="btn primary" id="imp-ok">إضافة المطابق إلى الجدول</button></div>`;
        $('#imp-ok').onclick = () => { const dr = S.draft[id] ||= {}; data.filter(x => x.p).forEach(x => dr[x.p.pid] = { ch: x.ch, op: x.op, scorer: x.scorer, late: false }); closeModal(); render(); toast('أضيفت التوقعات للجدول. راجع ثم اضغط حفظ'); };
      });
    },
    async unapprove() {
      if (!await ask('إلغاء الاعتماد', '<p>تحذف نقاط هذه المباراة من الترتيب حتى يعاد اعتمادها. تبقى التوقعات والنتيجة محفوظة.</p>', 'إلغاء الاعتماد', true)) return;
      const d = clone(S.md[id]); d.approved = false; d.calc = null; d.history = [...(d.history || []), { at: new Date().toISOString(), prev: d.result, unapproved: true }].slice(-20);
      await save('md/' + id, d); await audit('unapprove', { text: matchById(id)?.opponent }); toast('ألغي الاعتماد'); S.tab = 'result'; render();
    },
    ext() { S.extStats = t.checked; render(); },
    'p-new'() { sheet('مشارك جديد', participantForm()); },
    'p-edit'() { sheet('تعديل مشارك', participantForm(pById(id))); },
    async 'p-del'() {
      const hasData = Object.values(S.md).some(d => d.predictions?.[id]) || S.hist.opening?.[id]?.points || (S.hist.rounds || []).some(h => h.pid === id);
      if (hasData) { if (await ask('للمشارك سجلات', '<p>لديه توقعات أو نقاط مسجلة. الحذف يفقد سجله. ننصح بتعطيله بدلا من الحذف ليبقى سجله محفوظا.</p>', 'تعطيله بدلا من الحذف')) { const mm = S.season.members.find(m => m.pid === id); if (mm) mm.active = false; await saveSeason(); await audit('p_edit', { text: 'تعطيل ' + pName(id) }); closeModal(); render(); } return; }
      if (!await ask('حذف المشارك', `<p>حذف "${esc(pName(id))}" نهائيا؟</p>`, 'حذف', true)) return;
      const n = pName(id); S.season.members = S.season.members.filter(m => m.pid !== id);
      const others = await getCol('seasons'); const elsewhere = others.some(x => x.id !== S.season.id && x.data.members?.some(m => m.pid === id)); if (!elsewhere) S.core.participants = S.core.participants.filter(p => p.id !== id);
      await saveSeason(); await saveCore(); await audit('p_del', { text: n }); closeModal(); render();
    },
    'p-bulk'() {
      sheet('إضافة مشاركين دفعة واحدة', `<p class="muted">اسم في كل سطر. لإضافة لقب اكتبه بعد فاصلة: سلطان، الكابتن. ويمكن استيراد ملف CSV/Excel بعمود الاسم ثم اللقب.</p><textarea id="pb-text" rows="8"></textarea><input type="file" id="pb-file" accept=".csv,.xlsx,.xls"><div class="row end"><button class="btn primary" id="pb-ok">إضافة</button></div>`);
      $('#pb-file').onchange = async ev => { const rows = await readTable(ev.target.files[0]); $('#pb-text').value = (isHeader(rows[0]) ? rows.slice(1) : rows).map(r => [r[0], r[1]].filter(Boolean).join('، ')).join('\n'); };
      $('#pb-ok').onclick = async () => {
        const lines = $('#pb-text').value.split('\n').map(l => l.split(/[,،]/).map(x => x.trim())).filter(l => l[0]);
        let added = 0, skipped = [];
        for (const [name, alias = ''] of lines) {
          if (P().some(p => E.norm(p.name) === E.norm(name)) || lines.filter(l => E.norm(l[0]) === E.norm(name)).length > 1 && skipped.includes(name)) { skipped.push(name); continue; }
          const p = { id: uid('p'), name, alias, img: '', active: true, createdAt: new Date().toISOString() };
          S.core.participants.push(p); S.season.members.push({ pid: p.id, joined: todayISO(), active: true }); added++;
        }
        await saveCore(); await saveSeason(); await audit('p_add', { text: `إضافة دفعة: ${added}` });
        closeModal(); render(); toast(`أضيف ${added}${skipped.length ? ` · تخطي ${skipped.length} مكرر: ${skipped.slice(0, 3).join('، ')}` : ''}`);
      };
    },
    async 'hist-save-opening'() {
      const opening = clone(S.hist.opening || {}); let bad = 0;
      $$('tr[data-pid]').forEach(tr => { const v = E.toLatinDigits($('[data-k="points"]', tr).value).trim(); const note = $('[data-k="note"]', tr).value.trim(); if (v === '') { delete opening[tr.dataset.pid]; return; } if (!/^-?\d+$/.test(v)) { bad++; return; } opening[tr.dataset.pid] = { points: +v, note, at: new Date().toISOString() }; });
      if (bad) return toast('النقاط يجب أن تكون أعدادا صحيحة', 'err');
      const prevSum = Object.values(S.hist.opening || {}).reduce((s, x) => s + (x.points || 0), 0), sum = Object.values(opening).reduce((s, x) => s + x.points, 0);
      S.hist.opening = opening; await saveHist(); await audit('hist', { text: `أرصدة افتتاحية: المجموع ${prevSum} ← ${sum}` }); toast('حفظت الأرصدة الافتتاحية'); render();
    },
    async 'hist-save-round'() {
      const no = +t.dataset.no; const list = (S.hist.rounds || []).filter(h => h.roundNo !== no); let bad = 0;
      $$('tr[data-pid]').forEach(tr => { const v = E.toLatinDigits($('[data-k="points"]', tr).value).trim(); if (v === '') return; if (!/^-?\d+$/.test(v)) { bad++; return; } list.push({ id: uid('h'), roundNo: no, pid: tr.dataset.pid, points: +v, note: $('[data-k="note"]', tr).value.trim(), verified: $('[data-k="verified"]', tr).checked }); });
      if (bad) return toast('النقاط يجب أن تكون أعدادا صحيحة', 'err');
      S.hist.rounds = list; await saveHist(); await audit('hist', { text: `نقاط الجولة ${no}` }); toast(`حفظت الجولة ${no}`); render();
    },
    'hist-import'() {
      const kind = t.dataset.kind;
      importSheet(kind === 'opening' ? 'استيراد الأرصدة الافتتاحية' : 'استيراد نقاط الجولات', kind === 'opening' ? 'الأعمدة: اسم المشارك، النقاط، ملاحظة (اختياري).' : 'الأعمدة: اسم المشارك، رقم الجولة، النقاط، ملاحظة (اختياري). أو جدول عريض: الاسم ثم عمود لكل جولة بعنوان رقمها.', (rows, box) => {
        const head = isHeader(rows[0]) ? rows[0] : null, body = head ? rows.slice(1) : rows;
        let items = [];
        if (kind === 'opening') items = body.map(r => ({ p: matchP(r[0]), name: r[0], points: E.toLatinDigits(r[1]).trim(), note: r[2] || '' }));
        else {
          const wide = head && head.slice(1).every(h => /^\D*\d+\D*$/.test(E.toLatinDigits(h)));
          if (wide) body.forEach(r => head.slice(1).forEach((h, k) => { const v = E.toLatinDigits(r[k + 1]).trim(); if (v !== '') items.push({ p: matchP(r[0]), name: r[0], roundNo: +E.toLatinDigits(h).replace(/\D/g, ''), points: v, note: '' }); }));
          else items = body.map(r => ({ p: matchP(r[0]), name: r[0], roundNo: +E.toLatinDigits(r[1]), points: E.toLatinDigits(r[2]).trim(), note: r[3] || '' }));
        }
        const valid = items.filter(x => x.p && /^-?\d+$/.test(x.points) && (kind === 'opening' || (x.roundNo >= 1 && x.roundNo < S.season.startRound)));
        box.innerHTML = `<p>${fmt(valid.length)} صالح من ${fmt(items.length)}. ${kind === 'rounds' ? `الجولات المقبولة أقل من ${fmt(S.season.startRound)}.` : ''}</p><ul class="log">${items.slice(0, 200).map(x => `<li>${valid.includes(x) ? '✓' : '✗'} ${esc(x.name)}${x.roundNo ? ' · ج' + fmt(x.roundNo) : ''} · ${esc(x.points)}</li>`).join('')}</ul><div class="row end"><button class="btn primary" id="imp-ok">اعتماد الاستيراد</button></div>`;
        $('#imp-ok').onclick = async () => {
          if (kind === 'opening') { S.hist.opening = { ...(S.hist.opening || {}) }; valid.forEach(x => S.hist.opening[x.p.pid] = { points: +x.points, note: x.note, at: new Date().toISOString() }); }
          else { const keys = new Set(valid.map(x => x.roundNo + '|' + x.p.pid)); S.hist.rounds = (S.hist.rounds || []).filter(h => !keys.has(h.roundNo + '|' + h.pid)).concat(valid.map(x => ({ id: uid('h'), roundNo: x.roundNo, pid: x.p.pid, points: +x.points, note: x.note, verified: false }))); }
          await saveHist(); await audit('hist', { text: `استيراد ${valid.length} سجل (${kind === 'opening' ? 'أرصدة' : 'جولات'})` }); closeModal(); render(); toast('تم الاستيراد');
        };
      });
    },
    pg() { S.studioPage = Math.max(0, Math.min(S.studioPages - 1, S.studioPage + +t.dataset.d)); drawStudio(); },
    exp() { exportImage(t.dataset.f); }, 'exp-all'() { exportImage('png', true); },
    async share() {
      const cv = $('#cv'); const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
      const file = new File([blob], 'cpl.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], text: caption() }); recordLastImage(); return; } catch (err) { if (err.name === 'AbortError') return; } }
      const ok = await saveFile('cpl-share.png', blob); if (ok) toast('على الهاتف اختر المشاركة من نافذة الحفظ');
    },
    async 'copy-img'() {
      try { const cv = $('#cv'); const blob = await new Promise(r => cv.toBlob(r, 'image/png')); await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); toast('نسخت الصورة'); }
      catch { toast('نسخ الصور غير مدعوم في هذا المتصفح. استخدم تحميل PNG', 'err'); }
    },
    async 'copy-cap'() { const txt = caption(); try { await navigator.clipboard.writeText(txt); toast('نسخت العبارة'); } catch { sheet('العبارة المرافقة', `<textarea rows="7" readonly>${esc(txt)}</textarea>`); } },
    async 'logo-clear'() { S.studioLocal = { ...(S.studioLocal || {}), logo: '' }; await persistStudio(); render(); },
    async 'preset-save'() {
      const o = studioOpts(); const pal = paletteOf(o);
      const name = 'هوية ' + ((S.core.presets || []).length + 1);
      const p = { ...pal, id: uid('pr'), name }; (S.core.presets ||= []).push(p); S.studioLocal = { ...(S.studioLocal || {}), presetId: p.id, palette: {} };
      await persistStudio(); toast('حفظت الهوية: ' + name); render();
    },
    async 'pal-reset'() { S.studioLocal = { ...(S.studioLocal || {}), palette: {} }; await persistStudio(); render(); },
    async 'season-archive'() {
      const res = compute(); const champ = res.rows.filter(r => r.pos === 1 && r.total > 0);
      if (!await ask('إغلاق الموسم وأرشفته', `<p>البطل المسجل: <b>${esc(champ.map(r => r.name).join('، ') || 'لا يوجد')}</b>${champ.length ? ` (${fmt(champ[0].total)} نقطة)` : ''}. يصبح الموسم للقراءة فقط ويمكن إعادة فتحه.</p>`, 'أرشفة')) return;
      const s = S.core.seasons.find(x => x.id === S.season.id); s.status = 'archived'; s.champion = champ.length ? { names: champ.map(r => r.name), pts: champ[0].total } : null; s.archivedAt = new Date().toISOString();
      await saveCore(); await audit('season', { text: 'أرشفة موسم ' + s.name }); render();
    },
    async 'season-reopen'() { const s = S.core.seasons.find(x => x.id === S.season.id); s.status = 'active'; await saveCore(); await audit('season', { text: 'إعادة فتح ' + s.name }); render(); },
    'season-switch'() { switchSeason(id); },
    async 'rule-new'() { const base = clone((S.season.rules || []).slice(-1)[0] || defaultRules()); base.id = uid('rv'); base.name = 'نسخة ' + ((S.season.rules || []).length + 1); base.effectiveFrom = todayISO(); S.season.rules.push(base); await saveSeason(); await audit('rules', { text: 'نسخة قواعد جديدة' }); render(); },
    async 'rule-del'() { S.season.rules = S.season.rules.filter(r => r.id !== id); await saveSeason(); render(); },
    async recalc() {
      const ids = members().map(x => x.pid);
      const before = compute().rows; const sim = clone(S.md); let changedMatches = 0;
      for (const m of S.season.matches) { const d = sim[m.id]; if (!d?.approved) continue; const r = E.ruleForDate(S.season.rules, d.result?.playedAt || m.kickoff); const nc = applyLate(E.calcMatch(d, r, ids), d, r); if (JSON.stringify(nc) !== JSON.stringify(d.calc) || d.appliedRules?.id !== r.id || JSON.stringify(d.appliedRules) !== JSON.stringify(r)) { changedMatches++; d.calc = nc; d.appliedRules = r; d.recalcAt = new Date().toISOString(); } }
      const after = E.computeSeason({ season: S.season, members: members().map(m => ({ pid: m.pid, name: m.name })), md: sim, hist: S.hist }).rows;
      const diffs = after.map(r => ({ name: r.name, a: before.find(b => b.pid === r.pid)?.total || 0, b: r.total })).filter(x => x.a !== x.b);
      if (!changedMatches) return toast('لا يوجد فرق: كل المباريات محتسبة بالقواعد السارية');
      if (!await ask('إعادة احتساب تاريخية', `<p>ستعاد ${fmt(changedMatches)} مباراة معتمدة وفق نسخة القواعد السارية في تاريخ كل مباراة.</p>${diffs.length ? `<div class="table-wrap"><table class="grid"><thead><tr><th>المشارك</th><th>قبل</th><th>بعد</th></tr></thead><tbody>${diffs.map(x => `<tr><td>${esc(x.name)}</td><td class="num">${fmt(x.a)}</td><td class="num">${fmt(x.b)}</td></tr>`).join('')}</tbody></table></div>` : '<p>لن تتغير المجاميع.</p>'}`, 'تأكيد إعادة الاحتساب', true)) return;
      for (const m of S.season.matches) if (sim[m.id]?.recalcAt && sim[m.id].recalcAt !== S.md[m.id]?.recalcAt) await save('md/' + m.id, sim[m.id]);
      await audit('recalc', { text: `${changedMatches} مباراة · ${diffs.length} مشارك تغير مجموعه` }); toast('اكتملت إعادة الاحتساب'); render();
    },
    backup() { backup(); },
    'local-trial'() { S.setupMissing = false; S.memory = true; S.canEdit = true; render(); }, 'demo-load'() { loadDemo(); }, 'demo-del'() { deleteDemo(); },
    'audit-reload'() { S.audit = null; render(); }, 'tests-run'() { t.disabled = true; t.textContent = 'جار التشغيل…'; runAppTests(); }
  }[a];
  if (act) { try { await act(); } catch (err) { console.error(err); } }
});

/* rounds-bulk needs input values before modal closes */
document.addEventListener('click', async e => {
  const b = e.target.closest('#modal [data-m="1"]'); if (!b) return;
  const a = $('#rb-a'), z = $('#rb-b'); if (!a || !z) return;
  const from = +a.value, to = +z.value; if (!from || !to || to < from || to > 99) return toast('أدخل نطاقا صحيحا', 'err');
  let n = 0; for (let no = from; no <= to; no++) if (!S.season.rounds.some(r => r.no === no)) { S.season.rounds.push({ id: uid('r'), no, name: '' }); n++; }
  await saveSeason(); toast(`أنشئت ${n} جولة`); render();
}, true);

document.addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target;
  if (f.id === 'f-setup') {
    const core = S.core || defaultCore();
    core.leagueName = $('#su-name').value.trim() || core.leagueName; core.groupName = $('#su-group').value.trim();
    const s = newSeasonDoc($('#su-season').value.trim(), $('#su-scope').value);
    core.seasons.push({ id: s.id, name: s.name, start: $('#su-start').value, end: $('#su-end').value, status: 'active' });
    core.currentSeasonId = s.id;
    S.core = core; S.season = s;
    try { await save('seasons/' + s.id, s); await save('hist/' + s.id, { opening: {}, rounds: [] }); await saveCore(); } catch { return; }
    await audit('season', { text: 'إنشاء موسم ' + s.name });
    toast('أنشئ الموسم. أضف المشاركين الآن'); go('participants');
  }
  if (f.id === 'f-match') saveMatchForm(f);
  if (f.id === 'f-login') {
    const btn = $('button[type=submit]', f), er = $('#lg-err'); btn.disabled = true; er.hidden = true;
    try {
      const r = f.dataset.mode === 'up' ? await Store.signUpAdmin($('#lg-email').value.trim(), $('#lg-pass').value) : await Store.signIn($('#lg-email').value.trim(), $('#lg-pass').value);
      if (!r.isAdmin) { await Store.signOut(); throw new Error('هذا الحساب ليس مدير المسابقة'); }
      S.canEdit = true; closeModal(); toast('أهلا بك مدير المسابقة'); go('home');
    } catch (e2) { er.textContent = e2.message; er.hidden = false; btn.disabled = false; }
  }
  if (f.id === 'f-code') {
    const code = $('#mc-code').value.trim().toUpperCase();
    const pid = await Store.memberLogin(code).catch(() => null);
    if (!pid) return toast('الرمز غير صحيح', 'err');
    S.member = { pid, code }; lsSet('memberCode', code); await loadMine(); render(); toast('أهلا ' + pName(pid));
  }
  if (f.id === 'f-result') approve(matchById(f.dataset.id), f);
  if (f.id === 'f-part') saveParticipant(f);
  if (f.id === 'f-hmode') {
    const mode = $('#hm-mode').value, start = Math.max(1, +$('#hm-start').value || 1);
    if (mode !== S.season.histMode && ((S.hist.rounds || []).length || Object.keys(S.hist.opening || {}).length)) {
      if (!await ask('تغيير طريقة الاستيراد', '<p>البيانات المدخلة بالطريقة السابقة تبقى محفوظة لكنها لن تحتسب. ستظهر في قسم المراجعة.</p>', 'تغيير')) return;
    }
    S.season.histMode = mode; S.season.startRound = start; await saveSeason(); await audit('hist_mode', { text: `${mode} من الجولة ${start}` }); toast('حفظ الإعداد'); render();
  }
  if (f.id === 'f-league') {
    Object.assign(S.core, { leagueName: $('#sl-name').value.trim() || S.core.leagueName, leagueNameEn: $('#sl-en').value.trim(), groupName: $('#sl-group').value.trim(), numerals: $('#sl-nu').value, tz: $('#sl-tz').value, reveal: 'afterLock' });
    await saveCore(); await audit('settings', { text: 'إعدادات المسابقة' }); toast('حفظت الإعدادات'); render();
  }
  if (f.id === 'f-season') {
    S.season.scope = $('#ss-scope').value; S.season.rankingScope = $('#ss-rank').value;
    const names = $('#ss-comps').value.split('\n').map(x => x.trim()).filter(Boolean);
    const old = comps(); S.season.comps = names.map((n, i) => old.find(c => c.name === n) || { id: old[i] && !names.includes(old[i].name) ? old[i].id : uid('c'), name: n });
    const used = new Set(S.season.matches.map(m => m.compId)); const missing = [...used].filter(id => !S.season.comps.some(c => c.id === id));
    if (missing.length) { toast('لا يمكن حذف بطولة مرتبطة بمباريات', 'err'); S.season.comps = old; return; }
    const tbs = $$('[data-tb]').filter(x => x.checked).map(x => x.dataset.tb).sort((a, b) => (+$(`[data-tbo="${a}"]`).value || 9) - (+$(`[data-tbo="${b}"]`).value || 9));
    S.season.tiebreakers = tbs; S.season.tbFair = $('#ss-tbfair').checked;
    S.core.squad = $('#ss-squad').value.split('\n').map(x => x.trim()).filter(Boolean);
    await saveSeason(); await saveCore(); await audit('settings', { text: 'إعدادات الموسم' }); toast('حفظت إعدادات الموسم'); render();
  }
  if (f.id === 'f-newseason') {
    const name = $('#ns-name').value.trim(); if (!name) return;
    const s = newSeasonDoc(name, $('#ns-scope').value);
    if ($('#ns-copy').checked) s.members = members().filter(m => m.active !== false).map(m => ({ pid: m.pid, joined: todayISO(), active: true }));
    s.rules = clone(S.season.rules).map(r => ({ ...r, id: uid('rv') })); s.tiebreakers = S.season.tiebreakers; s.tbFair = S.season.tbFair;
    S.core.seasons.push({ id: s.id, name, status: 'active' });
    await save('seasons/' + s.id, s); await save('hist/' + s.id, { opening: {}, rounds: [] });
    await audit('season', { text: 'إنشاء موسم ' + name });
    await switchSeason(s.id);
  }
  if (f.classList.contains('rule')) {
    const r = S.season.rules.find(x => x.id === f.dataset.rid);
    $$('[data-rk]', f).forEach(el => { const k = el.dataset.rk; r[k] = el.type === 'number' ? Math.max(0, +el.value || 0) : el.value; });
    await saveSeason(); await audit('rules', { text: `${r.name}: فائز ${r.winner}، نتيجة ${r.exact}، هداف ${r.scorer}` });
    toast('حفظت القواعد. المباريات المعتمدة لم تتغير'); render();
  }
});

/* inputs */
document.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset.mineOther) { const mid = el.dataset.mineOther; (S.mineDraft[mid] ||= { ...mineVal(mid) }).scorer = el.value.trim(); return; }
  if (el.id === 'p-search') { S.tab = el.value; const pos = el.selectionStart; render(); const n = $('#p-search'); n.focus(); n.setSelectionRange(pos, pos); return; }
  const grid = el.closest('.pred-grid');
  if (grid) { const tr = el.closest('tr[data-pid]'); if (tr) tr.dataset.dirty = '1'; if (el.classList.contains('sc')) el.value = E.toLatinDigits(el.value).replace(/\D/g, '').slice(0, 2); collectPredDraft(grid.dataset.mid); autosave(grid.dataset.mid); }
  if (el.closest('#f-studio') && ['text', 'color', 'number'].includes(el.type)) studioChange(el);
});
document.addEventListener('change', async e => {
  const el = e.target;
  if (el.id === 'fr-et') $('.et').hidden = !el.checked;
  if (el.dataset.mineScorer) { const mid = el.dataset.mineScorer, dr = S.mineDraft[mid] ||= { ...mineVal(mid) }; const other = $(`[data-mine-other="${mid}"]`); if (el.value === '__other') { other.hidden = false; dr.scorer = other.value.trim(); other.focus(); } else { other.hidden = true; dr.scorer = el.value; } }
  if (el.closest('#f-studio')) {
    if (el.id === 'st-logo' && el.files[0]) { const id = await storeImage(el.files[0], 400); S.studioLocal = { ...(S.studioLocal || {}), logo: id }; await persistStudio(); render(); return; }
    if (el.type !== 'file') studioChange(el, true);
  }
  if (el.id === 'restore' && el.files[0]) restore(el.files[0]);
  if (el.id === 'h2h-a' || el.id === 'h2h-b') { S.h2h[el.id === 'h2h-a' ? 0 : 1] = el.value; render(); }
  if (el.closest('.pred-grid') && el.type === 'checkbox') { el.closest('tr[data-pid]').dataset.dirty = '1'; const g = el.closest('.pred-grid'); collectPredDraft(g.dataset.mid); autosave(g.dataset.mid); }
});
document.addEventListener('keydown', e => {
  const el = e.target; const grid = el.closest?.('.pred-grid'); if (!grid || e.key !== 'Enter') return;
  e.preventDefault();
  const r = +el.dataset.row, c = +el.dataset.col;
  const nx = grid.querySelector(`[data-row="${c === 2 ? r + 1 : r}"][data-col="${c === 2 ? 0 : c + 1}"]`);
  if (nx) { nx.focus(); nx.select?.(); } else savePreds(grid.dataset.mid);
});
function studioChange(el, structural) {
  const o = { ...(S.studioLocal || {}) };
  const n = el.name;
  if (!n) return;
  if (n.startsWith('pal-')) { o.palette = { ...(studioOpts().palette || {}), [n.slice(4)]: el.value }; }
  else if (el.type === 'checkbox') o[n] = el.checked;
  else o[n] = ['limit', 'cw', 'ch'].includes(n) ? +el.value : el.value;
  if (n === 'presetId') o.palette = {};
  if (n === 'template' || n === 'size' || n === 'limit') S.studioPage = 0;
  S.studioLocal = o;
  if (['template', 'size', 'presetId'].includes(n)) render(); else drawStudio();
  persistStudioDebounced();
}
async function persistStudio() { if (!S.canEdit) return; S.core.studio = { ...(S.core.studio || {}), ...(S.studioLocal || {}) }; try { await saveCore(); } catch { } }
const persistStudioDebounced = debounce(persistStudio, 1200);

/* ---------- boot ---------- */
async function boot() {
  try { const th = lsGet('theme'); document.documentElement.dataset.theme = th || 'dark'; } catch { }
  render();
  const cfg = window.CPL_CONFIG || {};
  if (!cfg.SUPABASE_URL || /YOUR|ضع/.test(cfg.SUPABASE_URL) || !cfg.SUPABASE_ANON_KEY || !window.supabase) { S.setupMissing = true; S.ready = true; render(); return; }
  try {
    const role = await Store.init(cfg);
    S.db = Store.db; S.canEdit = role.isAdmin; S.uid = role.uid; S.email = role.email;
  } catch (e) {
    $('#app').innerHTML = `<section class="empty"><h1>تعذر الاتصال بقاعدة البيانات</h1><p class="muted">${esc(e.message || '')}</p><button class="btn" onclick="location.reload()">إعادة المحاولة</button></section>`;
    return;
  }
  const url = new URL(location.href), fromLink = url.searchParams.has('code'), code = (url.searchParams.get('code') || lsGet('memberCode') || '').trim().toUpperCase();
  if (fromLink) { url.searchParams.delete('code'); history.replaceState(null, '', url.pathname + url.search + url.hash); }
  if (code) {
    const pid = await Store.memberLogin(code).catch(() => null);
    if (pid) { S.member = { pid, code }; lsSet('memberCode', code); if (!S.canEdit && fromLink) S.view = 'mine'; }
    else if (fromLink) toast('الرابط الشخصي غير صالح. اطلب رابطا جديدا من المدير', 'err');
    else if (lsGet('memberCode')) { lsSet('memberCode', null); toast('رابطك الشخصي لم يعد صالحا. اطلب رابطا جديدا من المدير', 'err'); }
  }
  subscribe();
  loadMine(); loadSubmitted();
  setInterval(() => { if (document.visibilityState === 'visible') { loadSubmitted(); loadMine(); } }, 30000);
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => { });
}
window.addEventListener('DOMContentLoaded', boot);
})();
