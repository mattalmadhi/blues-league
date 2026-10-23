/* ===== Scoring & standings engine (pure, no DOM) ===== */
const Engine = (() => {
  const NONE = '__none__', OG = '__og__';
  const DEFAULT_RULES = {
    winner: 2, exact: 2, scorer: 1, perfectBonus: 0,
    scorerScope: 'match',      // match | chelsea
    ogPolicy: 'either',        // og_only | player_only | either
    etPolicy: 'regular',       // regular (90') | aet (incl. extra time); penalties never count
    cancelledPolicy: 'none',   // none | count
    postponedPolicy: 'carry'   // carry: predictions stay with the match until it is played
  };

  const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩', FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
  function toLatinDigits(s) {
    return String(s ?? '').replace(/[٠-٩]/g, d => AR_DIGITS.indexOf(d)).replace(/[۰-۹]/g, d => FA_DIGITS.indexOf(d));
  }
  function norm(s) {
    return toLatinDigits(s).trim().toLowerCase()
      .replace(/[ً-ٰٟـ]/g, '')
      .replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  }
  const outcome = (a, b) => a > b ? 1 : a < b ? -1 : 0;
  const isInt = v => Number.isInteger(v) && v >= 0 && v <= 30;

  function effectiveScore(r, rules) {
    if (r.extraTime && rules.etPolicy === 'regular') return { ch: r.ch90, op: r.op90 };
    return { ch: r.ch, op: r.op };
  }

  function validateResult(r, match) {
    const e = [];
    if (!r) return ['لا توجد نتيجة'];
    if (r.status !== 'finished') return e;
    if (!isInt(r.ch) || !isInt(r.op)) e.push('أدخل نتيجة صحيحة للفريقين (أعداد صحيحة من 0 إلى 30)');
    if (r.extraTime) {
      if (!isInt(r.ch90) || !isInt(r.op90)) e.push('أدخل نتيجة نهاية الوقت الأصلي عند وجود أشواط إضافية');
      else {
        if (r.ch90 !== r.op90) e.push('الأشواط الإضافية تقام فقط إذا انتهى الوقت الأصلي بالتعادل');
        if (isInt(r.ch) && (r.ch < r.ch90 || r.op < r.op90)) e.push('نتيجة ما بعد الأشواط الإضافية لا يمكن أن تقل عن نتيجة الوقت الأصلي');
      }
    }
    if (match && match.kickoff && Date.parse(match.kickoff) > Date.now() + 5 * 60000)
      e.push('لا يمكن اعتماد نتيجة مباراة لم يحن موعدها بعد. عدل موعد المباراة إن كان خاطئا');
    return e;
  }

  /* actual first scorer according to scope: returns {kind:'none'|'pending'|'player'|'og', name} */
  function actualScorer(r, rules) {
    const s = effectiveScore(r, rules);
    if (rules.scorerScope === 'chelsea') {
      if (!s.ch) return { kind: 'none' };
      if (!r.firstChelseaScorer && !r.firstChelseaOG) return { kind: 'pending' };
      return { kind: r.firstChelseaOG ? 'og' : 'player', name: r.firstChelseaScorer || '' };
    }
    if (!(s.ch + s.op)) return { kind: 'none' };
    if (!r.firstScorer && !r.firstScorerOG) return { kind: 'pending' };
    if (r.firstScorerOG) return { kind: 'og', name: r.firstScorer || '' };
    return { kind: 'player', name: r.firstScorer };
  }

  function scorerStatus(pred, r, rules) {
    const a = actualScorer(r, rules);
    if (a.kind === 'pending') return 'pending';
    const p = (pred.scorer || '').trim();
    if (!p) return 'miss';
    if (a.kind === 'none') return p === NONE ? 'ok' : 'miss';
    if (p === NONE) return 'miss';
    if (a.kind === 'og') {
      const byOg = p === OG, byName = a.name && p !== OG && norm(p) === norm(a.name);
      if (rules.ogPolicy === 'og_only') return byOg ? 'ok' : 'miss';
      if (rules.ogPolicy === 'player_only') return byName ? 'ok' : (a.name ? 'miss' : 'pending');
      return byOg || byName ? 'ok' : 'miss';
    }
    if (p === OG) return 'miss';
    return norm(p) === norm(a.name) ? 'ok' : 'miss';
  }

  function scorePrediction(pred, r, rules) {
    rules = { ...DEFAULT_RULES, ...rules };
    const out = { w: 0, e: 0, s: 0, b: 0, total: 0, outcomeOk: false, exactOk: false, scorerStatus: 'none', submitted: !!pred, late: !!pred?.late };
    if (!pred || !isInt(pred.ch) || !isInt(pred.op)) { out.submitted = !!pred && isInt(pred?.ch); return out; }
    const s = effectiveScore(r, rules);
    out.outcomeOk = outcome(pred.ch, pred.op) === outcome(s.ch, s.op);
    out.exactOk = pred.ch === s.ch && pred.op === s.op;
    if (out.outcomeOk) out.w = rules.winner;
    if (out.exactOk) out.e = rules.exact;
    out.scorerStatus = scorerStatus(pred, r, rules);
    if (out.scorerStatus === 'ok') out.s = rules.scorer;
    if (rules.perfectBonus && out.exactOk && out.scorerStatus === 'ok') out.b = rules.perfectBonus;
    out.total = out.w + out.e + out.s + out.b;
    return out;
  }

  /* Calculate one match. Returns calc map keyed by participant id. Pure & idempotent. */
  function calcMatch(md, rules, memberIds) {
    const r = md.result, calc = {};
    if (!r) return calc;
    const counts = r.status === 'finished' || (r.status === 'cancelled' && rules.cancelledPolicy === 'count');
    for (const pid of memberIds) {
      const pred = md.predictions?.[pid];
      if (!counts) { calc[pid] = { w: 0, e: 0, s: 0, b: 0, total: 0, submitted: !!pred, scorerStatus: 'na', void: true }; continue; }
      calc[pid] = scorePrediction(pred, r, rules);
    }
    return calc;
  }

  function ruleForDate(versions, iso) {
    const list = (versions || []).slice().sort((a, b) => (a.effectiveFrom || '').localeCompare(b.effectiveFrom || ''));
    const t = (iso || '').slice(0, 10);
    let pick = list[0];
    for (const v of list) if (!v.effectiveFrom || v.effectiveFrom <= t) pick = v;
    return pick ? { ...DEFAULT_RULES, ...pick } : { ...DEFAULT_RULES, id: 'default', name: 'افتراضي' };
  }

  /* ===== Standings ===== */
  function rankRows(rows, tiebreakers, tbFair) {
    rows.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'ar'));
    let i = 0;
    const out = [];
    while (i < rows.length) {
      let j = i;
      while (j < rows.length && rows[j].total === rows[i].total) j++;
      const group = rows.slice(i, j);
      const skip = tbFair && group.length > 1 && group.some(g => g.undetailed > 0);
      const cmp = (a, b) => { for (const k of tiebreakers) { const d = (b.stats[k] || 0) - (a.stats[k] || 0); if (d) return d; } return 0; };
      if (!skip && tiebreakers.length) group.sort((a, b) => cmp(a, b) || a.name.localeCompare(b.name, 'ar'));
      group.forEach((g, k) => {
        if (k === 0) g.pos = i + 1;
        else g.pos = (skip || cmp(group[k - 1], g) === 0) ? group[k - 1].pos : i + k + 1;
        g.tieSkipped = skip;
        out.push(g);
      });
      i = j;
    }
    return out;
  }

  /*
    input: { season, members:[{pid,name}], md:{matchId:doc}, hist:{opening:{pid:{points}}, rounds:[{roundNo,pid,points}]}, compId? }
  */
  function computeSeason(input) {
    const { season, members, md = {}, hist = {}, compId = null } = input;
    const tiebreakers = season.tiebreakers || ['exact', 'winner', 'scorer'];
    const tbFair = season.tbFair !== false;
    const hmode = season.histMode || 'none';
    const startRound = Number(season.startRound || 1);
    const useHist = !compId;
    const pids = members.map(m => m.pid);
    const name = Object.fromEntries(members.map(m => [m.pid, m.name]));
    const rounds = (season.rounds || []).slice().sort((a, b) => a.no - b.no);
    const roundOf = Object.fromEntries(rounds.map(r => [r.id, r]));
    const matches = (season.matches || []).filter(m => !compId || m.compId === compId);

    const per = {}; // pid -> aggregates
    for (const p of pids) per[p] = { pid: p, name: name[p], total: 0, sys: 0, histPts: 0, undetailed: 0, played: 0, stats: { exact: 0, winner: 0, scorer: 0, pending: 0 }, roundPts: {}, matchSeq: [] };
    const roundData = {}; // roundNo -> {pts:{pid}, sources:Set, complete:bool, hasData:bool}
    const ensureRound = no => roundData[no] ||= { no, pts: {}, sys: {}, hasData: false, complete: true, kinds: new Set() };
    const excluded = [], reconcile = [];

    // system matches
    const sortedMatches = matches.slice().sort((a, b) => (a.kickoff || '').localeCompare(b.kickoff || ''));
    for (const m of sortedMatches) {
      const r = roundOf[m.roundId]; if (!r) continue;
      const doc = md[m.id];
      const rd = ensureRound(r.no);
      const approved = doc && doc.approved && doc.calc;
      const voided = m.status === 'cancelled' || m.status === 'postponed';
      if (!approved) { if (!voided) rd.complete = false; continue; }
      const histCovered = useHist && r.no < startRound && hmode === 'opening';
      if (histCovered) { excluded.push({ matchId: m.id, roundNo: r.no, reason: 'مشمولة بالرصيد الافتتاحي' }); reconcile.push({ matchId: m.id, roundNo: r.no, calc: doc.calc }); continue; }
      rd.hasData = true; rd.kinds.add('system');
      for (const p of pids) {
        const c = doc.calc[p]; if (!c) continue;
        rd.sys[p] = (rd.sys[p] || 0) + (c.total || 0);
        per[p].matchSeq.push({ matchId: m.id, kickoff: m.kickoff, total: c.total || 0, submitted: c.submitted, void: c.void });
        if (c.void) continue;
        if (c.submitted) per[p].played++;
        if (c.outcomeOk) per[p].stats.winner++;
        if (c.exactOk) per[p].stats.exact++;
        if (c.scorerStatus === 'ok') per[p].stats.scorer++;
        if (c.scorerStatus === 'pending') per[p].stats.pending++;
        per[p].sys += c.total || 0;
      }
    }
    for (const rd of Object.values(roundData)) for (const p of pids) rd.pts[p] = rd.sys[p] || 0;

    // historical
    const histRows = useHist ? (hist.rounds || []) : [];
    const conflicts = [];
    if (useHist && hmode === 'opening') {
      const base = ensureRound(startRound - 1); base.opening = true; base.hasData = true; base.complete = true; base.kinds.add('opening');
      for (const p of pids) {
        const v = Number(hist.opening?.[p]?.points || 0);
        base.pts[p] = (base.pts[p] || 0) + v; per[p].histPts += v; per[p].undetailed += v;
      }
      for (const h of histRows) conflicts.push({ ...h, reason: 'سجل جولة سابق غير محتسب لأن نمط الاستيراد هو الرصيد الافتتاحي' });
    } else if (useHist && hmode === 'rounds') {
      for (const h of histRows) {
        if (!pids.includes(h.pid)) continue;
        if (h.roundNo >= startRound) { conflicts.push({ ...h, reason: 'الجولة تقع ضمن فترة تشغيل النظام' }); continue; }
        const rd = ensureRound(h.roundNo);
        if (rd.kinds.has('system') && rd.sys[h.pid] != null) {
          conflicts.push({ ...h, reason: 'الجولة محتسبة آليا من التوقعات؛ السجل للمقارنة فقط', diff: (rd.sys[h.pid] || 0) - Number(h.points || 0) });
          continue;
        }
        rd.hasData = true; rd.kinds.add('historical');
        rd.pts[h.pid] = (rd.pts[h.pid] || 0) + Number(h.points || 0);
        per[h.pid].histPts += Number(h.points || 0); per[h.pid].undetailed += Number(h.points || 0);
      }
    } else if (useHist) for (const h of histRows) conflicts.push({ ...h, reason: 'لم يتم اختيار نمط استيراد' });

    // reconciliation diff for opening mode: computed (option C) vs opening
    const recon = {};
    if (reconcile.length) for (const p of pids) {
      const computed = reconcile.reduce((s, x) => s + (x.calc[p]?.total || 0), 0);
      recon[p] = { computed, recorded: Number(hist.opening?.[p]?.points || 0), diff: computed - Number(hist.opening?.[p]?.points || 0) };
    }

    // cumulative snapshots per completed round
    const roundNos = Object.keys(roundData).map(Number).sort((a, b) => a - b);
    const cum = Object.fromEntries(pids.map(p => [p, 0]));
    const cumStats = Object.fromEntries(pids.map(p => [p, { exact: 0, winner: 0, scorer: 0 }]));
    const cumUnd = Object.fromEntries(pids.map(p => [p, 0]));
    const snapshots = [];
    const statsByRound = {};
    // per-round stat increments
    for (const m of sortedMatches) {
      const r = roundOf[m.roundId]; const doc = md[m.id];
      if (!r || !doc?.approved || !doc.calc) continue;
      if (useHist && r.no < startRound && hmode === 'opening') continue;
      const s = statsByRound[r.no] ||= {};
      for (const p of pids) { const c = doc.calc[p]; if (!c || c.void) continue; const t = s[p] ||= { exact: 0, winner: 0, scorer: 0 }; if (c.exactOk) t.exact++; if (c.outcomeOk) t.winner++; if (c.scorerStatus === 'ok') t.scorer++; }
    }
    for (const no of roundNos) {
      const rd = roundData[no]; if (!rd.hasData) continue;
      for (const p of pids) {
        cum[p] += rd.pts[p] || 0; per[p].roundPts[no] = rd.pts[p] || 0;
        const s = statsByRound[no]?.[p]; if (s) for (const k in s) cumStats[p][k] += s[k];
        if (rd.kinds.has('opening') || rd.kinds.has('historical')) cumUnd[p] += (rd.kinds.has('system') ? 0 : rd.pts[p] || 0);
      }
      if (!rd.complete) continue;
      const rows = rankRows(pids.map(p => ({ pid: p, name: name[p], total: cum[p], undetailed: cumUnd[p], stats: { ...cumStats[p] } })), tiebreakers, tbFair);
      snapshots.push({ roundNo: no, opening: !!rd.opening, pos: Object.fromEntries(rows.map(r => [r.pid, r.pos])), totals: { ...cum } });
    }

    for (const p of pids) per[p].total = cum[p];
    const rows = rankRows(pids.map(p => per[p]), tiebreakers, tbFair);

    // latest data round & comparison baseline
    const dataRounds = roundNos.filter(n => roundData[n].hasData);
    const lastRound = dataRounds.length ? dataRounds[dataRounds.length - 1] : null;
    const prev = snapshots.filter(s => lastRound != null && s.roundNo < lastRound).pop() || null;
    for (const r of rows) {
      r.roundLast = lastRound != null ? (roundData[lastRound].pts[r.pid] || 0) : 0;
      r.change = prev && prev.pos[r.pid] != null ? prev.pos[r.pid] - r.pos : null;
      r.posHistory = snapshots.map(s => ({ roundNo: s.roundNo, pos: s.pos[r.pid] }));
      r.bestPos = r.posHistory.length ? Math.min(...r.posHistory.map(x => x.pos), r.pos) : r.pos;
      const sysRounds = Object.entries(r.roundPts).filter(([n]) => roundData[n].kinds.has('system'));
      const best = sysRounds.sort((a, b) => b[1] - a[1])[0];
      r.bestRound = best ? { no: Number(best[0]), pts: best[1] } : null;
      r.avg = r.played ? r.sys / r.played : null;
    }

    // round champions (rounds with data, excluding opening baseline)
    const champions = {};
    for (const no of dataRounds) {
      const rd = roundData[no]; if (rd.opening) continue;
      const max = Math.max(...pids.map(p => rd.pts[p] || 0));
      if (max <= 0) { champions[no] = { pts: 0, pids: [] }; continue; }
      champions[no] = { pts: max, pids: pids.filter(p => (rd.pts[p] || 0) === max), complete: rd.complete, system: rd.kinds.has('system') };
    }

    return { rows, snapshots, lastRound, prevRound: prev?.roundNo ?? null, champions, roundData, conflicts, excluded, recon };
  }

  /* ===== Achievements (no effect on points) ===== */
  function achievements(res, season, md) {
    const out = [];
    const { rows, lastRound, champions } = res;
    if (!rows.length) return out;
    const byPid = Object.fromEntries(rows.map(r => [r.pid, r]));
    const ch = lastRound != null ? champions[lastRound] : null;
    if (ch && ch.pids.length) out.push({ key: 'king', title: 'King of the Round', ar: 'ملك الجولة', pids: ch.pids, value: ch.pts, crit: `أعلى نقاط في الجولة ${lastRound}` });
    // perfect predictions in last round
    if (lastRound != null) {
      const round = (season.rounds || []).find(r => r.no === lastRound);
      const perfect = new Set();
      for (const m of season.matches || []) if (round && m.roundId === round.id) {
        const d = md[m.id]; if (!d?.approved) continue;
        for (const [p, c] of Object.entries(d.calc || {})) if (c.exactOk && c.scorerStatus === 'ok' && byPid[p]) perfect.add(p);
      }
      if (perfect.size) out.push({ key: 'perfect', title: 'Perfect Prediction', ar: 'التوقع المثالي', pids: [...perfect], crit: 'نتيجة دقيقة وهداف أول صحيح' });
    }
    const top = (key, f, label, ar, crit) => {
      const vals = rows.map(r => ({ p: r.pid, v: f(r) })).filter(x => x.v != null && x.v > 0);
      if (!vals.length) return;
      const max = Math.max(...vals.map(x => x.v));
      out.push({ key, title: label, ar, pids: vals.filter(x => x.v === max).map(x => x.p), value: max, crit });
    };
    top('sharp', r => r.stats.exact, 'Sharpshooter', 'القناص', 'أكثر النتائج الدقيقة المسجلة في النظام');
    top('streak', r => { let best = 0, cur = 0; for (const s of r.matchSeq) { if (s.void) continue; if (s.total > 0) { cur++; best = Math.max(best, cur); } else cur = 0; } return best; }, 'Blue Streak', 'السلسلة الزرقاء', 'أطول سلسلة مباريات متتالية بنقاط');
    if (res.prevRound != null) top('climber', r => r.change, 'Biggest Climber', 'الأكثر صعودا', 'أكبر تقدم في الترتيب مقارنة بالجولة المعتمدة السابقة');
    const leaders = rows.filter(r => r.pos === 1 && r.total > 0);
    if (leaders.length) out.push({ key: 'leader', title: 'Season Leader', ar: 'متصدر الموسم', pids: leaders.map(r => r.pid), value: leaders[0].total, crit: 'المركز الأول في الترتيب العام' });
    const sysMatches = new Set(); rows.forEach(r => r.matchSeq.forEach(s => !s.void && sysMatches.add(s.matchId)));
    const minPlayed = Math.max(3, Math.ceil(sysMatches.size * 0.5));
    top('oracle', r => r.played >= minPlayed ? Math.round(r.avg * 100) / 100 : null, 'Chelsea Oracle', 'عراف تشلسي', `أعلى متوسط نقاط للمباراة بحد أدنى ${minPlayed} توقعات`);
    return out;
  }

  /* ===== WhatsApp text parser ===== */
  function parseChat(text, participants, squad) {
    const lines = String(text || '').split(/\r?\n/);
    const rx = /^\s*\[?\s*([\d٠-٩]{1,4}[\/.\-][\d٠-٩]{1,2}[\/.\-][\d٠-٩]{2,4})[,،]?\s*([\d٠-٩]{1,2}[:.][\d٠-٩]{2}(?::[\d٠-٩]{2})?\s*(?:[APap][Mm]|ص|م)?)\s*\]?\s*[-–]?\s*([^:]{1,60}):\s*(.*)$/;
    const out = [];
    const findP = sender => {
      const n = norm(sender);
      return participants.find(p => norm(p.name) === n || (p.alias && norm(p.alias) === n))
        || participants.find(p => n && (norm(p.name).includes(n) || n.includes(norm(p.name)) || (p.alias && (n.includes(norm(p.alias)) || norm(p.alias).includes(n)))));
    };
    let cur = null;
    const msgs = [];
    for (const ln of lines) {
      const m = ln.match(rx);
      if (m) { cur = { sender: m[3].replace(/^~\s*/, '').trim(), text: m[4] }; msgs.push(cur); }
      else if (cur && ln.trim()) cur.text += ' ' + ln.trim();
      else if (!cur && ln.includes(':')) { const i = ln.indexOf(':'); cur = { sender: ln.slice(0, i).trim(), text: ln.slice(i + 1) }; msgs.push(cur); }
    }
    for (const msg of msgs) {
      const t = toLatinDigits(msg.text);
      const sm = t.match(/(\d{1,2})\s*[-–:×x]\s*(\d{1,2})/);
      if (!sm) continue;
      let ch = +sm[1], op = +sm[2];
      const rest = (t.slice(0, sm.index) + ' ' + t.slice(sm.index + sm[0].length)).trim();
      const rn = norm(rest);
      let scorer = '';
      if (/(لا (يوجد|احد)|بدون اهداف|no goal|ما في)/.test(rn)) scorer = NONE;
      else if (/(عكسي|own goal|\bog\b)/.test(rn)) scorer = OG;
      else {
        const hit = (squad || []).map(s => ({ s, n: norm(s) })).filter(x => x.n && rn.includes(x.n)).sort((a, b) => b.n.length - a.n.length)[0]
          || (squad || []).map(s => ({ s, last: norm(s).split(' ').pop() })).find(x => x.last && x.last.length > 2 && rn.split(' ').includes(x.last));
        scorer = hit ? hit.s : rest.replace(/[^\p{L}\s]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
      }
      const p = findP(msg.sender);
      out.push({ sender: msg.sender, pid: p?.id || '', ch, op, scorer, raw: msg.text.trim().slice(0, 120) });
    }
    // keep last message per participant
    const last = {};
    out.forEach((x, i) => { last[x.pid || ('?' + x.sender)] = i; });
    return out.map((x, i) => ({ ...x, superseded: last[x.pid || ('?' + x.sender)] !== i }));
  }

  /* ===== CSV ===== */
  function parseCSV(text) {
    const rows = []; let row = [], f = '', q = false;
    text = String(text).replace(/^﻿/, '');
    const sep = (text.split('\n')[0].match(/;/g) || []).length > (text.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
      else if (c === '"') q = true;
      else if (c === sep || c === '\t') { row.push(f); f = ''; }
      else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
      else if (c !== '\r') f += c;
    }
    if (f || row.length) { row.push(f); rows.push(row); }
    return rows.filter(r => r.some(c => c.trim() !== ''));
  }

  return { NONE, OG, DEFAULT_RULES, norm, toLatinDigits, outcome, validateResult, scorePrediction, calcMatch, ruleForDate, computeSeason, rankRows, achievements, parseChat, parseCSV, effectiveScore, actualScorer };
})();
if (typeof module !== 'undefined') module.exports = Engine;
