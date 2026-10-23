/* ===== Acceptance test suite (engine-level). Runs in Node and in the app. ===== */
function runEngineTests(E) {
  const results = [];
  const t = (name, fn) => { try { const r = fn(); results.push({ name, ok: r === true, detail: r === true ? '' : String(r) }); } catch (e) { results.push({ name, ok: false, detail: e.message }); } };
  const eq = (a, b, msg) => JSON.stringify(a) === JSON.stringify(b) ? true : `${msg || ''} متوقع ${JSON.stringify(b)} والفعلي ${JSON.stringify(a)}`;
  const R = { ...E.DEFAULT_RULES };
  const res = (ch, op, extra = {}) => ({ status: 'finished', ch, op, firstScorer: 'Cole Palmer', ...extra });

  t('النتيجة الدقيقة مع الهداف = 5 نقاط', () => eq(E.scorePrediction({ ch: 3, op: 1, scorer: 'cole palmer' }, res(3, 1), R).total, 5));
  t('النتيجة الدقيقة تمنح نقاط الفائز والنتيجة معا', () => { const s = E.scorePrediction({ ch: 3, op: 1, scorer: 'x' }, res(3, 1), R); return eq([s.w, s.e, s.s], [2, 2, 0]); });
  t('توقع الفائز دون النتيجة الدقيقة = 2', () => eq(E.scorePrediction({ ch: 2, op: 0, scorer: 'x' }, res(3, 1), R).total, 2));
  t('توقع خاطئ = 0', () => eq(E.scorePrediction({ ch: 0, op: 1, scorer: 'x' }, res(3, 1), R).total, 0));
  t('التعادل نتيجة مستقلة', () => eq(E.scorePrediction({ ch: 1, op: 1 }, res(2, 2), R).total, 2));
  t('تعادل دقيق = نقاط التعادل + النتيجة', () => eq(E.scorePrediction({ ch: 2, op: 2 }, res(2, 2), R).total, 4));
  t('مباراة 0-0 مع "لا يوجد هدف" = 5', () => eq(E.scorePrediction({ ch: 0, op: 0, scorer: E.NONE }, { status: 'finished', ch: 0, op: 0 }, R).total, 5));
  t('مباراة 0-0 مع اختيار لاعب = 4', () => eq(E.scorePrediction({ ch: 0, op: 0, scorer: 'Palmer' }, { status: 'finished', ch: 0, op: 0 }, R).total, 4));
  t('هدف عكسي أول: خيار "هدف عكسي" صحيح (سياسة: أي منهما)', () => eq(E.scorePrediction({ ch: 1, op: 0, scorer: E.OG }, res(1, 0, { firstScorer: 'Saliba', firstScorerOG: true }), R).s, 1));
  t('هدف عكسي أول: اسم اللاعب المسجل صحيح (سياسة: أي منهما)', () => eq(E.scorePrediction({ ch: 1, op: 0, scorer: 'saliba' }, res(1, 0, { firstScorer: 'Saliba', firstScorerOG: true }), R).s, 1));
  t('هدف عكسي أول: سياسة "هدف عكسي فقط" ترفض الاسم', () => eq(E.scorePrediction({ ch: 1, op: 0, scorer: 'saliba' }, res(1, 0, { firstScorer: 'Saliba', firstScorerOG: true }), { ...R, ogPolicy: 'og_only' }).s, 0));
  t('التفريق بين أول هداف في المباراة وأول هداف لتشلسي', () => {
    const r = res(2, 1, { firstScorer: 'Saka', firstChelseaScorer: 'Jackson' });
    const a = E.scorePrediction({ ch: 2, op: 1, scorer: 'Jackson' }, r, R).s;
    const b = E.scorePrediction({ ch: 2, op: 1, scorer: 'Jackson' }, r, { ...R, scorerScope: 'chelsea' }).s;
    return eq([a, b], [0, 1]);
  });
  t('الأشواط الإضافية: سياسة الوقت الأصلي', () => eq(E.scorePrediction({ ch: 1, op: 1 }, res(2, 1, { extraTime: true, ch90: 1, op90: 1 }), R).total, 4));
  t('الأشواط الإضافية: سياسة احتساب الأشواط', () => eq(E.scorePrediction({ ch: 2, op: 1 }, res(2, 1, { extraTime: true, ch90: 1, op90: 1 }), { ...R, etPolicy: 'aet' }).total, 4));
  t('عدم وجود توقع = 0', () => eq(E.scorePrediction(undefined, res(1, 0), R).total, 0));
  t('الهداف غير مسجل = بانتظار التحقق دون منح أو خصم', () => { const s = E.scorePrediction({ ch: 1, op: 0, scorer: 'Palmer' }, { status: 'finished', ch: 1, op: 0, firstScorer: '' }, R); return eq([s.scorerStatus, s.s, s.total], ['pending', 0, 4]); });
  t('مطابقة الأسماء العربية دون حساسية للهمزات', () => eq(E.scorePrediction({ ch: 1, op: 0, scorer: 'إنزو' }, res(1, 0, { firstScorer: 'انزو' }), R).s, 1));
  t('المباراة الملغاة لا تمنح نقاطا', () => { const c = E.calcMatch({ result: { status: 'cancelled' }, predictions: { a: { ch: 1, op: 0 } } }, R, ['a']); return eq(c.a.total, 0); });
  t('رفض نتيجة غير صالحة', () => E.validateResult({ status: 'finished', ch: -1, op: 2 }).length > 0 || 'تم قبول نتيجة سالبة');
  t('رفض اعتماد مباراة لم تبدأ', () => E.validateResult({ status: 'finished', ch: 1, op: 0 }, { kickoff: new Date(Date.now() + 864e5).toISOString() }).length > 0 || 'تم القبول');
  t('الاحتساب قابل لإعادة التنفيذ دون مضاعفة', () => {
    const md = { result: res(2, 0), predictions: { a: { ch: 2, op: 0, scorer: 'Cole Palmer' } } };
    const c1 = E.calcMatch(md, R, ['a']), c2 = E.calcMatch(md, R, ['a']);
    return eq([c1.a.total, c2.a.total], [5, 5]);
  });
  t('نسخ القواعد حسب تاريخ السريان', () => {
    const v = [{ id: 'v1', effectiveFrom: '2026-08-01', winner: 2 }, { id: 'v2', effectiveFrom: '2026-12-01', winner: 3 }];
    return eq([E.ruleForDate(v, '2026-10-01').id, E.ruleForDate(v, '2027-01-05').id], ['v1', 'v2']);
  });

  // Season-level scenario
  const members = Array.from({ length: 12 }, (_, i) => ({ pid: 'p' + i, name: 'مشارك ' + (i + 1) }));
  const rounds = Array.from({ length: 7 }, (_, i) => ({ id: 'r' + (i + 1), no: i + 1 }));
  const season = { rounds, matches: [{ id: 'm6', roundId: 'r6', compId: 'pl', opponent: 'Arsenal', kickoff: '2026-10-10T16:30:00Z', status: 'finished' }, { id: 'm7', roundId: 'r7', compId: 'pl', opponent: 'Spurs', kickoff: '2099-01-01T00:00:00Z', status: 'scheduled' }], histMode: 'opening', startRound: 6, tiebreakers: ['exact', 'winner', 'scorer'], tbFair: true };
  const opening = Object.fromEntries(members.map((m, i) => [m.pid, { points: [18, 16, 15, 15, 12, 11, 10, 9, 9, 7, 5, 3][i] }]));
  const preds = Object.fromEntries(members.map((m, i) => [m.pid, [{ ch: 3, op: 1, scorer: 'Cole Palmer' }, { ch: 1, op: 0, scorer: 'Jackson' }, { ch: 2, op: 2, scorer: 'Saka' }][i % 3]]));
  const md6 = { approved: true, result: res(3, 1), predictions: preds };
  md6.calc = E.calcMatch(md6, R, members.map(m => m.pid));
  const out = E.computeSeason({ season, members, md: { m6: md6 }, hist: { opening } });
  const by = Object.fromEntries(out.rows.map(r => [r.pid, r]));

  t('سيناريو: جمع الرصيد الافتتاحي مع نقاط الجولة 6', () => eq([by.p0.total, by.p1.total, by.p2.total], [23, 18, 15]));
  t('سيناريو: النقاط الافتتاحية لا تضخم النتائج الدقيقة', () => eq([by.p0.stats.exact, by.p1.stats.exact, by.p4.stats.exact], [1, 0, 0]));
  t('سيناريو: بطل الجولة 6', () => eq(out.champions[6].pids, ['p0', 'p3', 'p6', 'p9']));
  t('سيناريو: تغير المراكز مقارنة بالرصيد الافتتاحي', () => eq([by.p3.change, by.p2.change], [by.p3.change > 0 ? by.p3.change : 'صعود', -1]));
  t('سيناريو: مجموع الترتيب = مجموع التفاصيل', () => { const a = out.rows.reduce((s, r) => s + r.total, 0); const b = Object.values(opening).reduce((s, x) => s + x.points, 0) + Object.values(md6.calc).reduce((s, c) => s + c.total, 0); return eq(a, b); });
  t('سيناريو: الجولة 7 غير المكتملة لا تنشئ لقطة ترتيب', () => eq(out.snapshots.map(s => s.roundNo), [5, 6]));

  t('منع الازدواج: سجل جولة سابق لا يحتسب مع الرصيد الافتتاحي', () => {
    const o = E.computeSeason({ season, members, md: { m6: md6 }, hist: { opening, rounds: [{ roundNo: 3, pid: 'p0', points: 5 }] } });
    return eq([o.rows.find(r => r.pid === 'p0').total, o.conflicts.length], [23, 1]);
  });
  t('منع الازدواج: الجولة المحتسبة آليا تتقدم على السجل اليدوي', () => {
    const s2 = { ...season, histMode: 'rounds', startRound: 7 };
    const o = E.computeSeason({ season: s2, members, md: { m6: md6 }, hist: { rounds: [{ roundNo: 6, pid: 'p0', points: 2 }, { roundNo: 2, pid: 'p0', points: 4 }] } });
    return eq([o.rows.find(r => r.pid === 'p0').total, o.conflicts[0].diff], [9, 3]);
  });
  t('تساوي النقاط: الفصل بالنتائج الدقيقة', () => {
    const rows = E.rankRows([{ pid: 'a', name: 'أ', total: 10, undetailed: 0, stats: { exact: 1, winner: 3, scorer: 0 } }, { pid: 'b', name: 'ب', total: 10, undetailed: 0, stats: { exact: 2, winner: 2, scorer: 0 } }], ['exact', 'winner', 'scorer'], true);
    return eq(rows.map(r => [r.pid, r.pos]), [['b', 1], ['a', 2]]);
  });
  t('تساوي النقاط: مركز مشترك عند استمرار التساوي', () => {
    const rows = E.rankRows([{ pid: 'a', name: 'أ', total: 10, undetailed: 0, stats: { exact: 1, winner: 2, scorer: 0 } }, { pid: 'b', name: 'ب', total: 10, undetailed: 0, stats: { exact: 1, winner: 2, scorer: 0 } }, { pid: 'c', name: 'ج', total: 8, undetailed: 0, stats: {} }], ['exact', 'winner', 'scorer'], true);
    return eq(rows.map(r => r.pos), [1, 1, 3]);
  });
  t('تساوي النقاط: عدم الفصل بإحصاءات ناقصة تاريخيا', () => {
    const rows = E.rankRows([{ pid: 'a', name: 'أ', total: 10, undetailed: 8, stats: { exact: 0 } }, { pid: 'b', name: 'ب', total: 10, undetailed: 0, stats: { exact: 2 } }], ['exact'], true);
    return eq(rows.map(r => r.pos), [1, 1]);
  });
  t('تحليل نص واتساب', () => {
    const txt = '[10/10/2026, 6:01 م] أبو فهد: 2-1 بالمر\n[10/10/2026, 6:05 م] Sultan: ٣ - ١ جاكسون\n[10/10/2026, 6:09 م] أبو فهد: تعديل 3-1 بالمر';
    const r = E.parseChat(txt, [{ id: 'a', name: 'أبو فهد' }, { id: 'b', name: 'سلطان', alias: 'Sultan' }], ['Cole Palmer|بالمر'.split('|')[1], 'جاكسون']);
    const live = r.filter(x => !x.superseded);
    return eq(live.map(x => [x.pid, x.ch, x.op, x.scorer]), [['b', 3, 1, 'جاكسون'], ['a', 3, 1, 'بالمر']]);
  });
  t('تحليل CSV بفواصل عربية وعلامات اقتباس', () => eq(E.parseCSV('الاسم,النقاط\n"أحمد، الأول",18\n'), [['الاسم', 'النقاط'], ['أحمد، الأول', '18']]));
  return results;
}
if (typeof module !== 'undefined') module.exports = runEngineTests;
