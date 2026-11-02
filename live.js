/* ===== Live scores from ESPN's public scoreboard API (no key, CORS open) =====
   Read-only: it never approves anything. The admin reviews the pre-filled
   result and approves it, so points are only ever counted from a human check. */
const Live = (() => {
  const BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/';
  const CHE = '363';
  const LEAGUES = { pl: 'eng.1', lc: 'eng.league_cup', fa: 'eng.fa', ucl: 'uefa.champions' };
  // ESPN English name -> the Arabic form fans use. Unknown players fall back to the English name.
  const AR = {
    'Emiliano Martínez': 'مارتينيز', 'Gaga Slonina': 'سلونينا', 'Teddy Sharman-Lowe': 'شارمان لو', 'Mike Penders': 'بيندرز',
    'Reece James': 'ريس جيمس', 'Maxence Lacroix': 'لاكروا', 'Wesley Fofana': 'فوفانا', 'Levi Colwill': 'كولويل',
    'Pep Chavarría': 'تشافاريا', 'Malo Gusto': 'غوستو', 'Jorrel Hato': 'هاتو', 'Marco Palestra': 'باليسترا',
    'Aaron Anselmino': 'أنسيلمينو', 'Josh Acheampong': 'أتشيامبونغ', 'Olutayo Subuloye': 'سوبولويي',
    'Jordan Henderson': 'هندرسون', 'Morgan Rogers': 'روجرز', 'Moisés Caicedo': 'كايسيدو', 'Cole Palmer': 'بالمر',
    'Romeo Lavia': 'لافيا', 'Valentín Barco': 'باركو', 'Geovany Quenda': 'كيندا', 'Mahdi Nicoll-Jazuli': 'نيكول جازولي',
    'Reggie Watson': 'واتسون', 'Danny Welbeck': 'ويلبيك', 'Pedro Neto': 'نيتو', 'João Pedro': 'جواو بيدرو',
    'Emmanuel Emegha': 'إيميغا', 'Jamie Gittens': 'غيتنز', 'Estêvão': 'استيفاو',
    'Enzo Fernández': 'إنزو', 'Nicolas Jackson': 'جاكسون', 'Liam Delap': 'ديلاب'
  };
  const cache = new Map(); // matchId -> { at, data }

  const ymd = ms => new Date(ms).toISOString().slice(0, 10).replace(/-/g, '');
  const get = async url => { const r = await fetch(url, { cache: 'no-store' }); if (!r.ok) throw new Error('espn ' + r.status); return r.json(); };
  const sc = c => c && c.score !== '' && c.score != null && !isNaN(c.score) ? Number(c.score) : null;
  const hasChelsea = e => (e.competitions?.[0]?.competitors || []).some(c => c.id === CHE || c.team?.id === CHE);

  // the ESPN event for one of our matches: same competition, within a day of kickoff
  async function findEvent(m) {
    const lg = LEAGUES[m.compId] || 'eng.1', ko = Date.parse(m.kickoff);
    for (const d of [ko, ko - 864e5, ko + 864e5]) {
      const sb = await get(`${BASE}${lg}/scoreboard?dates=${ymd(d)}`);
      const ev = (sb.events || []).find(e => hasChelsea(e) && Math.abs(Date.parse(e.date) - ko) < 1.5 * 864e5);
      if (ev) return { id: ev.id, lg };
    }
    return null;
  }

  // English name -> squad entry when the admin has one, else the Arabic form, else English
  function localName(en, squad = [], norm = s => s.toLowerCase()) {
    if (!en) return '';
    const ar = AR[en], last = en.split(' ').slice(-1)[0];
    const hit = squad.find(s => [ar, en, last].filter(Boolean).some(x => norm(s) === norm(x)));
    return hit || ar || en;
  }

  function parse(sum, m) {
    const comp = sum.header?.competitions?.[0] || {};
    const st = comp.status?.type || {};
    const us = (comp.competitors || []).find(c => c.id === CHE), them = (comp.competitors || []).find(c => c.id !== CHE);
    const goals = (sum.keyEvents || []).filter(k => k.scoringPlay && (k.period?.number || 1) <= 4)
      .map(k => ({ min: k.clock?.displayValue || '', period: k.period?.number || 1, che: k.team?.id === CHE, og: /own goal/i.test(k.type?.text || ''), pen: /penalty/i.test(k.type?.text || ''), name: k.participants?.[0]?.athlete?.displayName || '' }));
    const name = st.name || '';
    const out = {
      eventId: sum.header?.id, state: st.state || 'pre', // pre | in | post
      detail: st.shortDetail || st.detail || '', name,
      ch: sc(us), op: sc(them), goals,
      finished: st.completed === true && /FULL_TIME|FINAL/.test(name),
      postponed: /POSTPONED/.test(name), cancelled: /CANCEL|ABANDON/.test(name)
    };
    if (out.finished) {
      const et = /AET|PEN/.test(name);
      const reg = goals.filter(g => g.period <= 2);
      const first = goals[0], firstChe = goals.find(g => g.che);
      out.result = {
        status: 'finished', ch: out.ch, op: out.op, extraTime: et,
        ch90: et ? reg.filter(g => g.che).length : null, op90: et ? reg.filter(g => !g.che).length : null,
        pens: /PEN/.test(name) && us && them ? (Number(us.shootoutScore) > Number(them.shootoutScore) ? 'ch' : 'op') : null,
        firstScorerEn: first?.name || '', firstScorerOG: !!first?.og,
        firstChelseaScorerEn: firstChe?.name || '', firstChelseaOG: !!firstChe?.og
      };
      // sanity: the goal list must add up to the final score, otherwise leave scorers for the admin
      out.result.goalsMatch = goals.filter(g => g.che).length === out.ch && goals.filter(g => !g.che).length === out.op;
    }
    return out;
  }

  // ttl keeps polling cheap: live matches refresh every 45s, others every 10 min
  async function fetchMatch(m, { force = false } = {}) {
    const c = cache.get(m.id);
    if (!force && c && Date.now() - c.at < (c.data?.state === 'in' ? 45e3 : 6e5)) return c.data;
    let ref = c?.ref;
    if (!ref) ref = await findEvent(m);
    if (!ref) { cache.set(m.id, { at: Date.now(), data: null }); return null; }
    const data = parse(await get(`${BASE}${ref.lg}/summary?event=${ref.id}`), m);
    cache.set(m.id, { at: Date.now(), ref, data });
    return data;
  }

  // a match is worth polling from 15 min before kickoff until it is approved (max 4h after)
  const inWindow = m => { const ko = Date.parse(m.kickoff), now = Date.now(); return now > ko - 9e5 && now < ko + 4 * 36e5; };

  return { fetchMatch, localName, inWindow, parse, AR };
})();
if (typeof module !== 'undefined') module.exports = Live;
