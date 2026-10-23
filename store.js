/* ===== Supabase storage adapter =====
   Exposes the same document API the app was written against
   (doc().get/set/delete/onSnapshot, collection().where().orderBy().limit().get/onSnapshot)
   on top of the Supabase tables in supabase.sql.
   md/<matchId> documents are split: predictions live in their own table so the
   server can keep them hidden until kickoff. */
const Store = (() => {
  let sb = null, ready = null, isAdmin = false, uid = null;
  const rows = new Map();          // path -> data (frozen)
  const preds = new Map();         // matchId -> { pid: pred }
  const views = new Map();         // path -> merged view (identity changes only when content changes)
  const stamps = new Map();        // path -> updated_at
  const docL = new Map();          // path -> Set(fn)
  const colL = new Set();          // { col, field, val, fn, last: Map }
  let pollTimer = null, syncing = null, dirty = false, lastPredSig = '';

  const err = (e, fallback = 'unavailable') => {
    const m = (e && (e.message || e.error_description)) || String(e);
    let code = fallback;
    if (e && (e.code === '42501' || /row-level security|permission denied/i.test(m))) code = 'invalid_argument';
    else if (e && (e.code === '23514' || e.code === '22P02')) code = 'invalid_argument';
    else if (/payload too large|413/i.test(m)) code = 'quota_exceeded';
    else if (/fetch|network|Failed to/i.test(m)) code = 'unavailable';
    return { code, message: m };
  };
  const colOf = p => p.split('/')[0];
  const idOf = p => p.split('/').slice(1).join('/');
  const deepFreeze = o => { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(deepFreeze); } return o; };

  const predSeason = new Map();    // matchId -> seasonId (for matches that only have predictions so far)
  const allPaths = () => new Set([...rows.keys(), ...[...preds.keys()].map(m => 'md/' + m)]);
  function viewOf(path) {
    if (views.has(path)) return views.get(path);
    let v = rows.get(path);
    if (colOf(path) === 'md') {
      const id = idOf(path), p = preds.get(id);
      if (v) v = { ...v, predictions: { ...(p || {}) } };
      else if (p && Object.keys(p).length) v = { seasonId: predSeason.get(id) || null, matchId: id, predictions: { ...p }, result: null, approved: false, calc: null, history: [] };
    }
    v = v ? deepFreeze(v) : undefined;
    views.set(path, v);
    return v;
  }
  const docSnap = path => { const v = viewOf(path); return { id: idOf(path), exists: !!v, data: () => v, metadata: { fromCache: false, hasPendingWrites: false } }; };

  /* ---------- notify ---------- */
  function notify(paths) {
    for (const p of paths) {
      views.delete(p);
      const ls = docL.get(p); if (ls) { const s = docSnap(p); ls.forEach(fn => { try { fn(s); } catch (e) { console.error(e); } }); }
    }
    const cols = new Set([...paths].map(colOf));
    for (const L of colL) if (cols.has(L.col)) emitCol(L);
  }
  function matching(L) {
    const out = [];
    for (const p of allPaths()) {
      if (colOf(p) !== L.col) continue;
      const v = viewOf(p);
      if (!v) continue;
      if (L.field && v?.[L.field] !== L.val) continue;
      out.push(p);
    }
    return out.sort();
  }
  function emitCol(L, first = false) {
    const cur = new Map(matching(L).map(p => [p, viewOf(p)]));
    const changes = [];
    for (const [p, v] of cur) { const old = L.last.get(p); if (!L.last.has(p)) changes.push({ type: 'added', doc: docSnap(p) }); else if (old !== v) changes.push({ type: 'modified', doc: docSnap(p) }); }
    for (const [p, v] of L.last) if (!cur.has(p)) changes.push({ type: 'removed', doc: { id: idOf(p), exists: true, data: () => v } });
    L.last = cur;
    if (!first && !changes.length) return;
    const docs = [...cur.keys()].map(docSnap);
    try { L.fn({ docs, size: docs.length, empty: !docs.length, docChanges: () => changes, metadata: { fromCache: false, hasPendingWrites: false } }); } catch (e) { console.error(e); }
  }

  /* ---------- sync from server ---------- */
  async function loadAll() {
    const { data, error } = await sb.from('docs').select('path,data,updated_at');
    if (error) throw err(error);
    rows.clear(); views.clear(); stamps.clear();
    for (const r of data) { rows.set(r.path, deepFreeze(r.data)); stamps.set(r.path, r.updated_at); }
    await loadPreds();
  }
  async function loadPreds() {
    const { data, error } = await sb.from('predictions').select('match_id,pid,season_id,ch,op,scorer,late,source,at');
    if (error) throw err(error);
    const sig = JSON.stringify(data.map(r => [r.match_id, r.pid, r.ch, r.op, r.scorer, r.late, r.at]).sort());
    if (sig === lastPredSig) return [];
    lastPredSig = sig;
    const before = new Map([...preds].map(([k, v]) => [k, JSON.stringify(v)]));
    preds.clear();
    for (const r of data) if (r.season_id) predSeason.set(r.match_id, r.season_id);
    for (const r of data) (preds.get(r.match_id) || preds.set(r.match_id, {}).get(r.match_id))[r.pid] = { ch: r.ch, op: r.op, scorer: r.scorer || '', late: !!r.late, at: r.at, source: r.source };
    const changed = new Set([...before.keys(), ...preds.keys()].filter(k => before.get(k) !== JSON.stringify(preds.get(k))));
    return [...changed].map(m => 'md/' + m);
  }
  async function sync() {
    if (syncing) { dirty = true; return syncing; }
    syncing = (async () => {
      try {
        const { data, error } = await sb.from('docs').select('path,updated_at');
        if (error) throw error;
        const live = new Map(data.map(r => [r.path, r.updated_at]));
        const changed = [...live].filter(([p, t]) => stamps.get(p) !== t).map(([p]) => p);
        const removed = [...rows.keys()].filter(p => !live.has(p));
        const touched = new Set(removed);
        removed.forEach(p => { rows.delete(p); stamps.delete(p); });
        for (let i = 0; i < changed.length; i += 50) {
          const chunk = changed.slice(i, i + 50);
          const r = await sb.from('docs').select('path,data,updated_at').in('path', chunk);
          if (r.error) throw r.error;
          for (const x of r.data) { rows.set(x.path, deepFreeze(x.data)); stamps.set(x.path, x.updated_at); touched.add(x.path); }
        }
        (await loadPreds()).forEach(p => touched.add(p));
        if (touched.size) notify(touched);
      } catch (e) { console.warn('sync failed', e); }
      finally { syncing = null; if (dirty) { dirty = false; sync(); } }
    })();
    return syncing;
  }
  function startLive() {
    const kick = () => { if (document.visibilityState === 'visible') sync(); };
    try {
      sb.channel('cpl-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'docs' }, () => sync())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'predictions' }, () => sync())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'match_locks' }, () => sync())
        .subscribe();
    } catch (e) { console.warn('realtime unavailable', e); }
    clearInterval(pollTimer);
    pollTimer = setInterval(kick, 20000);
    document.addEventListener('visibilitychange', kick);
    window.addEventListener('online', kick);
  }

  /* ---------- writes ---------- */
  function predRow(matchId, pid, p, seasonId) {
    return { match_id: matchId, pid, season_id: seasonId || null, ch: p.ch, op: p.op, scorer: p.scorer || '', late: !!p.late, source: p.source || 'admin', at: p.at || new Date().toISOString() };
  }
  async function setDoc(path, data) {
    const col = colOf(path), id = idOf(path);
    if (col === 'audit') {
      const { error } = await sb.from('audit_logs').insert({ action: data.action, detail: data.detail || null, season_id: data.seasonId || null });
      if (error) throw err(error);
      return;
    }
    let body = data;
    const touched = new Set([path]);
    if (col === 'md') {
      const next = data.predictions || {}, cur = preds.get(id) || {};
      const ups = [], dels = [];
      for (const [pid, p] of Object.entries(next)) { const c = cur[pid]; if (!c || c.ch !== p.ch || c.op !== p.op || (c.scorer || '') !== (p.scorer || '') || !!c.late !== !!p.late) ups.push(predRow(id, pid, { ...p, source: c && c.ch === p.ch && c.op === p.op && (c.scorer || '') === (p.scorer || '') ? c.source : 'admin' }, data.seasonId)); }
      for (const pid of Object.keys(cur)) if (!next[pid]) dels.push(pid);
      if (ups.length) { const { error } = await sb.from('predictions').upsert(ups); if (error) throw err(error); }
      if (dels.length) { const { error } = await sb.from('predictions').delete().eq('match_id', id).in('pid', dels); if (error) throw err(error); }
      const np = {}; for (const [pid, p] of Object.entries(next)) np[pid] = { ch: p.ch, op: p.op, scorer: p.scorer || '', late: !!p.late, at: p.at, source: ups.find(u => u.pid === pid)?.source || cur[pid]?.source || 'admin' };
      preds.set(id, np);
      const { predictions, ...rest } = data; body = rest;
    }
    const { data: saved, error } = await sb.from('docs').upsert({ path, col, season_id: data.seasonId || (col === 'seasons' || col === 'hist' ? id : null), data: body }).select('updated_at').single();
    if (error) throw err(error);
    rows.set(path, deepFreeze(JSON.parse(JSON.stringify(body)))); stamps.set(path, saved.updated_at);
    if (col === 'seasons') await syncLocks(id, body);
    notify(touched);
  }
  async function syncLocks(seasonId, s) {
    const ms = (s.matches || []).filter(m => m.kickoff);
    const up = ms.map(m => ({ match_id: m.id, season_id: seasonId, lock_at: m.lockAt || m.kickoff, open: m.status === 'scheduled' }));
    if (up.length) { const { error } = await sb.from('match_locks').upsert(up); if (error) throw err(error); }
    const keep = ms.map(m => m.id);
    let q = sb.from('match_locks').delete().eq('season_id', seasonId);
    if (keep.length) q = q.not('match_id', 'in', `(${keep.map(k => `"${k}"`).join(',')})`);
    const { error } = await q; if (error) throw err(error);
  }
  async function deleteDoc(path) {
    const col = colOf(path), id = idOf(path);
    if (col === 'md') { const { error } = await sb.from('predictions').delete().eq('match_id', id); if (error) throw err(error); preds.delete(id); }
    if (col === 'seasons') { const { error } = await sb.from('match_locks').delete().eq('season_id', id); if (error) throw err(error); }
    const { error } = await sb.from('docs').delete().eq('path', path);
    if (error) throw err(error);
    rows.delete(path); stamps.delete(path);
    notify([path]);
  }

  /* ---------- document API used by the app ---------- */
  function doc(path) {
    return {
      id: idOf(path), path,
      async get() { await ready; return docSnap(path); },
      set: data => setDoc(path, JSON.parse(JSON.stringify(data))),
      async update(data) { const cur = rows.get(path); if (!cur) throw { code: 'invalid_argument', message: 'missing' }; return setDoc(path, { ...viewOf(path), ...data }); },
      delete: () => deleteDoc(path),
      onSnapshot(fn) {
        (docL.get(path) || docL.set(path, new Set()).get(path)).add(fn);
        ready.then(() => { if (docL.get(path)?.has(fn)) fn(docSnap(path)); });
        return () => docL.get(path)?.delete(fn);
      }
    };
  }
  function query(col, field, val, order, lim) {
    const q = {
      where: (f, op, v) => query(col, f, v, order, lim),
      orderBy: (f, dir = 'asc') => query(col, field, val, [f, dir], lim),
      limit: n => query(col, field, val, order, n),
      async get() {
        if (col === 'audit') {
          const { data, error } = await sb.from('audit_logs').select('*').order('ts', { ascending: false }).limit(lim || 200);
          if (error) throw err(error);
          const docs = data.map(r => ({ id: String(r.id), exists: true, data: () => ({ ts: r.ts, action: r.action, detail: r.detail, seasonId: r.season_id }) }));
          return { docs, size: docs.length, empty: !docs.length, docChanges: () => [] };
        }
        await ready;
        const docs = matching({ col, field, val }).map(docSnap);
        return { docs, size: docs.length, empty: !docs.length, docChanges: () => [] };
      },
      onSnapshot(fn) {
        const L = { col, field, val, fn, last: new Map() };
        colL.add(L);
        ready.then(() => { if (colL.has(L)) emitCol(L, true); });
        return () => colL.delete(L);
      },
      doc: id => doc(col + '/' + (id || ('d' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)))),
      async add(data) { const d = q.doc(); await d.set(data); return d; }
    };
    return q;
  }
  const db = { doc, collection: col => query(col) };

  /* ---------- auth & members ---------- */
  async function refreshRole() {
    const { data: { session } } = await sb.auth.getSession();
    uid = session?.user?.id || null;
    isAdmin = false;
    if (uid) { const { data } = await sb.rpc('is_admin'); isAdmin = !!data; }
    return { uid, isAdmin, email: session?.user?.email || '' };
  }
  const authMsg = e => {
    const m = (e?.message || '').toLowerCase();
    if (m.includes('invalid login')) return 'البريد أو كلمة المرور غير صحيحة';
    if (m.includes('email not confirmed')) return 'البريد غير مؤكد. أكد البريد من الرسالة المرسلة أو عطل تأكيد البريد في Supabase';
    if (m.includes('already registered')) return 'هذا البريد مسجل. استخدم تسجيل الدخول';
    if (m.includes('password')) return 'كلمة المرور قصيرة. استخدم 8 أحرف على الأقل';
    if (m.includes('signups not allowed') || m.includes('signup is disabled')) return 'إنشاء الحسابات معطل في Supabase';
    return e?.message || 'تعذر الاتصال';
  };

  return {
    db,
    async init(cfg) {
      const opts = { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'cpl-auth' } };
      if (cfg.__testAccessToken) { opts.global = { headers: { Authorization: 'Bearer ' + cfg.__testAccessToken } }; opts.auth.persistSession = false; }
      sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, opts);
      ready = loadAll();
      await ready;
      const role = cfg.__testAccessToken ? await (async () => { const { data } = await sb.rpc('is_admin'); isAdmin = !!data; uid = 'test'; return { uid, isAdmin, email: 'test' }; })() : await refreshRole();
      startLive();
      return role;
    },
    role: () => ({ uid, isAdmin }),
    async signIn(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw new Error(authMsg(error));
      const r = await refreshRole();
      if (!r.isAdmin) {
        const { data: exists } = await sb.rpc('admin_exists');
        if (!exists) { const { data } = await sb.rpc('claim_admin'); isAdmin = !!data; }
      }
      await loadAll(); notify(new Set(rows.keys()));
      return { uid, isAdmin };
    },
    async signUpAdmin(email, password) {
      const { data: exists } = await sb.rpc('admin_exists');
      if (exists) throw new Error('يوجد مدير للمسابقة. استخدم تسجيل الدخول');
      const { data, error } = await sb.auth.signUp({ email, password });
      if (error) throw new Error(authMsg(error));
      if (!data.session) throw new Error('أنشئ الحساب لكن البريد يحتاج تأكيدا. أكد من رسالة البريد ثم سجل الدخول، أو عطل تأكيد البريد في Supabase');
      const { data: ok, error: e2 } = await sb.rpc('claim_admin');
      if (e2 || !ok) throw new Error('تعذر تعيين الحساب مديرا');
      isAdmin = true; uid = data.user.id;
      await loadAll(); notify(new Set(rows.keys()));
      return { uid, isAdmin };
    },
    async adminExists() { const { data } = await sb.rpc('admin_exists'); return !!data; },
    async signOut() { await sb.auth.signOut(); isAdmin = false; uid = null; await loadAll(); notify(new Set(rows.keys())); },
    async memberLogin(code) { const { data, error } = await sb.rpc('member_login', { p_code: code }); if (error) throw err(error); return data || null; },
    async memberPredictions(code) { const { data, error } = await sb.rpc('member_predictions', { p_code: code }); if (error) throw err(error); return data || []; },
    async memberSubmit(code, matchId, ch, op, scorer) {
      const { data, error } = await sb.rpc('member_submit', { p_code: code, p_match: matchId, p_ch: ch, p_op: op, p_scorer: scorer });
      if (error) {
        const m = error.message || '';
        const map = { locked: 'أغلق باب التوقع لهذه المباراة', invalid_code: 'الرمز الشخصي غير صحيح. اطلب رابطا جديدا من مدير المسابقة', not_member: 'حسابك غير مفعل في هذا الموسم', unknown_match: 'المباراة غير متاحة للتوقع', invalid_score: 'أدخل نتيجة صحيحة' };
        throw new Error(map[Object.keys(map).find(k => m.includes(k))] || 'تعذر الحفظ. تحقق من الاتصال وحاول مرة أخرى');
      }
      sync();
      return data;
    },
    async submittedList(seasonId) { const { data, error } = await sb.rpc('submitted_list', { p_season: seasonId }); if (error) return []; return data || []; },
    async codes() { const { data, error } = await sb.from('member_codes').select('pid,code'); if (error) throw err(error); return Object.fromEntries(data.map(r => [r.pid, r.code])); },
    async setCode(pid) {
      const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const rnd = crypto.getRandomValues(new Uint32Array(8));
      const code = [...rnd].map(n => abc[n % abc.length]).join('');
      const { error } = await sb.from('member_codes').upsert({ pid, code });
      if (error) throw err(error);
      return code;
    },
    async dropCode(pid) { const { error } = await sb.from('member_codes').delete().eq('pid', pid); if (error) throw err(error); },
    sync
  };
})();
