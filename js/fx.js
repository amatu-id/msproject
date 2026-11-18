// Amatu Project — rumus kolom kustom (gaya Microsoft Project/VBA): [Kolom], IIf, Switch, DateDiff, ProjDateDiff, …
// + indikator grafis (ikon menurut kriteria nilai).
(() => {
'use strict';
const AP = window.AP, U = AP.U, F = AP.F, D = AP.D;
const Fx = AP.Fx = {};
const cache = new Map();

function lex(s) {
  const out = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '[') { const j = s.indexOf(']', i); if (j < 0) throw 'Kurung siku tidak ditutup'; out.push({ t: 'f', v: s.slice(i + 1, j).trim() }); i = j + 1; continue; }
    if (c === '"') { let j = i + 1, v = ''; while (j < s.length) { if (s[j] === '"') { if (s[j + 1] === '"') { v += '"'; j += 2; continue; } break; } v += s[j++]; } if (j >= s.length) throw 'Tanda kutip tidak ditutup'; out.push({ t: 's', v }); i = j + 1; continue; }
    if (/\d/.test(c) || (c === '.' && /\d/.test(s[i + 1]))) { const m = /^\d*\.?\d+(?:e[+-]?\d+)?/i.exec(s.slice(i)); out.push({ t: 'n', v: parseFloat(m[0]) }); i += m[0].length; continue; }
    if (/[A-Za-z_]/.test(c)) { const m = /^[A-Za-z_][\w]*/.exec(s.slice(i)); out.push({ t: 'id', v: m[0] }); i += m[0].length; continue; }
    const two = s.slice(i, i + 2);
    if (['<>', '<=', '>='].includes(two)) { out.push({ t: 'op', v: two }); i += 2; continue; }
    if ('+-*/\\^&=<>(),;'.includes(c)) { out.push({ t: c === '(' || c === ')' ? c : c === ',' || c === ';' ? ',' : 'op', v: c }); i++; continue; }
    throw 'Karakter tidak dikenal: ' + c;
  }
  return out;
}
const PREC = { or: 1, and: 2, '=': 4, '<>': 4, '<': 4, '>': 4, '<=': 4, '>=': 4, '&': 5, '+': 6, '-': 6, mod: 7, '*': 8, '/': 8, '\\': 8, '^': 10 };
function parse(src) {
  const tk = lex(src);
  let p = 0;
  const peek = () => tk[p], next = () => tk[p++];
  const opOf = x => { if (!x) return null; if (x.t === 'op') return x.v; if (x.t === 'id' && /^(and|or|mod)$/i.test(x.v)) return x.v.toLowerCase(); return null; };
  function primary() {
    const x = next();
    if (!x) throw 'Rumus tidak lengkap';
    if (x.t === 'n') return { k: 'n', v: x.v };
    if (x.t === 's') return { k: 's', v: x.v };
    if (x.t === 'f') return { k: 'f', v: x.v };
    if (x.t === '(') { const e = expr(0); if (!peek() || peek().t !== ')') throw 'Kurung tidak ditutup'; next(); return e; }
    if (x.t === 'op' && x.v === '-') return { k: 'neg', a: expr(9) };
    if (x.t === 'op' && x.v === '+') return expr(9);
    if (x.t === 'id') {
      const n = x.v.toLowerCase();
      if (n === 'not') return { k: 'not', a: expr(3) };
      if (n === 'true' || n === 'ya') return { k: 'b', v: true };
      if (n === 'false' || n === 'tidak') return { k: 'b', v: false };
      if (peek() && peek().t === '(') {
        next();
        const args = [];
        if (peek() && peek().t !== ')') { for (;;) { args.push(expr(0)); if (peek() && peek().t === ',') { next(); continue; } break; } }
        if (!peek() || peek().t !== ')') throw 'Kurung fungsi ' + x.v + ' tidak ditutup';
        next();
        return { k: 'call', n, args };
      }
      throw 'Nama tidak dikenal: ' + x.v + ' (tulis kolom dalam [kurung siku])';
    }
    throw 'Rumus tidak valid di dekat "' + x.v + '"';
  }
  function expr(minP) {
    let left = primary();
    for (;;) {
      const o = opOf(peek());
      if (!o || PREC[o] == null || PREC[o] < minP) break;
      next();
      const right = expr(o === '^' ? PREC[o] : PREC[o] + 1);
      left = { k: 'bin', o, a: left, b: right };
    }
    return left;
  }
  const e = expr(0);
  if (p < tk.length) throw 'Sisa rumus tidak dipahami: ' + tk.slice(p).map(x => x.v).join(' ');
  return e;
}
const num = v => (typeof v === 'boolean' ? (v ? -1 : 0) : v == null || v === '' ? 0 : typeof v === 'number' ? v : (isFinite(+v) ? +v : U.parseNum(v) || 0));
const str = v => (v == null ? '' : typeof v === 'boolean' ? (v ? 'Ya' : 'Tidak') : String(v));
const truth = v => (typeof v === 'string' ? /^(ya|yes|true|-?1)$/i.test(v) : !!num(v));
const DAYM = 1440;
function interval(k, P) { k = String(k).toLowerCase(); return { yyyy: 'y', y: 'y', q: 'q', m: 'm', ww: 'w', w: 'w', d: 'd', h: 'h', n: 'n', s: 's' }[k] || 'd'; }
function ev(n, ctx) {
  switch (n.k) {
    case 'n': case 's': case 'b': return n.v;
    case 'f': {
      const k = F.byName('task', n.v) || F.byName('task', n.v.replace(/\s*\(.*\)$/, ''));
      if (!k) throw 'Kolom tidak dikenal: [' + n.v + ']';
      if (ctx.depth > 6) throw 'Rumus saling merujuk terlalu dalam';
      ctx.depth++;
      const v = F.raw('task', k, ctx.t, ctx.P);
      ctx.depth--;
      return v;
    }
    case 'neg': return -num(ev(n.a, ctx));
    case 'not': return !truth(ev(n.a, ctx));
    case 'bin': {
      if (n.o === 'and') return truth(ev(n.a, ctx)) && truth(ev(n.b, ctx));
      if (n.o === 'or') return truth(ev(n.a, ctx)) || truth(ev(n.b, ctx));
      const a = ev(n.a, ctx), b = ev(n.b, ctx);
      switch (n.o) {
        case '+': return typeof a === 'string' && typeof b === 'string' ? a + b : num(a) + num(b);
        case '-': return num(a) - num(b);
        case '*': return num(a) * num(b);
        case '/': { const d = num(b); if (!d) throw 'Pembagian dengan nol'; return num(a) / d; }
        case '\\': { const d = num(b); if (!d) throw 'Pembagian dengan nol'; return Math.trunc(num(a) / d); }
        case 'mod': return num(a) % num(b);
        case '^': return Math.pow(num(a), num(b));
        case '&': return str(a) + str(b);
        default: {
          const cs = typeof a === 'string' || typeof b === 'string';
          const x = cs ? str(a).toLowerCase() : num(a), y = cs ? str(b).toLowerCase() : num(b);
          return n.o === '=' ? x === y : n.o === '<>' ? x !== y : n.o === '<' ? x < y : n.o === '>' ? x > y : n.o === '<=' ? x <= y : x >= y;
        }
      }
    }
    case 'call': return call(n, ctx);
  }
  return null;
}
function call(n, ctx) {
  const A = n.args, a = i => ev(A[i], ctx), P = ctx.P;
  const need = k => { if (A.length < k) throw n.n + ' membutuhkan ' + k + ' argumen'; };
  switch (n.n) {
    case 'iif': need(3); return truth(a(0)) ? a(1) : a(2);
    case 'switch': for (let i = 0; i + 1 < A.length; i += 2) if (truth(a(i))) return a(i + 1); return null;
    case 'choose': { need(2); const i = Math.trunc(num(a(0))); return i >= 1 && i < A.length ? a(i) : null; }
    case 'abs': need(1); return Math.abs(num(a(0)));
    case 'int': need(1); return Math.floor(num(a(0)));
    case 'fix': need(1); return Math.trunc(num(a(0)));
    case 'round': { need(1); const d = A.length > 1 ? num(a(1)) : 0, k = Math.pow(10, d); return Math.round(num(a(0)) * k) / k; }
    case 'sqr': need(1); return Math.sqrt(num(a(0)));
    case 'min': return Math.min(...A.map((_, i) => num(a(i))));
    case 'max': return Math.max(...A.map((_, i) => num(a(i))));
    case 'len': need(1); return str(a(0)).length;
    case 'left': need(2); return str(a(0)).slice(0, num(a(1)));
    case 'right': need(2); { const s = str(a(0)); return s.slice(Math.max(0, s.length - num(a(1)))); }
    case 'mid': { need(2); const s = str(a(0)), st = num(a(1)) - 1; return A.length > 2 ? s.substr(st, num(a(2))) : s.slice(st); }
    case 'instr': need(2); return str(a(0)).toLowerCase().indexOf(str(a(1)).toLowerCase()) + 1;
    case 'ucase': need(1); return str(a(0)).toUpperCase();
    case 'lcase': need(1); return str(a(0)).toLowerCase();
    case 'trim': need(1); return str(a(0)).trim();
    case 'replace': need(3); return str(a(0)).split(str(a(1))).join(str(a(2)));
    case 'cstr': need(1); return str(a(0));
    case 'cdbl': case 'val': case 'cint': need(1); return n.n === 'cint' ? Math.round(num(a(0))) : num(a(0));
    case 'isnull': need(1); { const v = a(0); return v == null || v === ''; }
    case 'now': return U.now();
    case 'date': return U.today();
    case 'year': need(1); return U.ymd(num(a(0))).y;
    case 'month': need(1); return U.ymd(num(a(0))).m + 1;
    case 'day': need(1); return U.ymd(num(a(0))).d;
    case 'weekday': need(1); return U.ymd(num(a(0))).dow + 1;
    case 'dateadd': { need(3); const k = interval(a(0)), v = num(a(1)), d = num(a(2)); if (k === 'm') return U.addMonths(d, v); if (k === 'q') return U.addMonths(d, v * 3); if (k === 'y') return U.addMonths(d, v * 12); return d + v * ({ w: 7 * DAYM, d: DAYM, h: 60, n: 1, s: 1 / 60 }[k]); }
    case 'datediff': {
      need(3);
      const k = interval(a(0)), x = num(a(1)), y = num(a(2)), p = U.ymd(x), q = U.ymd(y);
      if (k === 'm') return (q.y - p.y) * 12 + q.m - p.m;
      if (k === 'q') return Math.trunc(((q.y - p.y) * 12 + q.m - p.m) / 3);
      if (k === 'y') return q.y - p.y;
      if (k === 'w') return Math.trunc((U.dayStart(y) - U.dayStart(x)) / (7 * DAYM));
      if (k === 'd') return Math.round((U.dayStart(y) - U.dayStart(x)) / DAYM);
      if (k === 'h') return Math.trunc((y - x) / 60);
      return Math.round(y - x);
    }
    case 'projdatediff': need(2); return P._ctx.signed(P.calendar, num(a(0)), num(a(1)));
    case 'projdateadd': need(2); return P._ctx.add(P.calendar, num(a(0)), num(a(1)));
    case 'projdursonv': case 'projdurconv': need(1); return D.fmtDur(num(a(0)), 'd', P.opts);
    case 'format': { need(1); const v = a(0), f = A.length > 1 ? str(a(1)).toLowerCase() : ''; if (/d|m|y/.test(f) && typeof v === 'number' && v > 1e6) return U.fmtDate(v, f.replace(/m{1,2}(?=\W|$)/, 'mm')); if (/0\.0|#/.test(f)) { const dec = (f.split('.')[1] || '').length; return U.numFix(num(v), dec); } if (f === 'percent') return U.num(num(v) * 100, 0) + '%'; return str(v); }
  }
  throw 'Fungsi tidak dikenal: ' + n.n;
}
Fx.compile = src => { let e = cache.get(src); if (!e) { e = parse(src); if (cache.size > 300) cache.clear(); cache.set(src, e); } return e; };
Fx.run = (P, src, t, type) => {
  if (!t) return null;
  const v = ev(Fx.compile(src), { P, t, depth: 0 });
  if (type === 'num' || type === 'cost' || type === 'dur') return num(v);
  if (type === 'flag') return truth(v);
  if (type === 'date') return v == null || v === '' ? null : num(v);
  return str(v);
};
Fx.evalField = (P, f, t) => {
  const type = (Object.keys(F.T).find(k => F.T[k].custom && P.fields[F.T[k].custom] === f) || 'text').replace(/\d+$/, '');
  try { return Fx.run(P, f.formula, t, type); } catch (e) { return '#ERROR'; }
};
Fx.show = (v, type, P) => (type === 'flag' ? (v ? 'Ya' : 'Tidak') : type === 'date' ? U.fmtDate(v, P.opts.dateFmt) : type === 'cost' ? U.money(v, P) : type === 'num' ? U.num(v, 4) : type === 'dur' ? D.fmtDur(v, 'd', P.opts) : String(v));
Fx.ICONS = [['g', 'Lingkaran hijau', 'circle', 'ok'], ['y', 'Lingkaran kuning', 'circle', 'warn'], ['r', 'Lingkaran merah', 'circle', 'bad'], ['flag_g', 'Bendera hijau', 'flag', 'ok'], ['flag_r', 'Bendera merah', 'flag', 'bad'], ['up', 'Panah naik', 'arrow_upward', 'ok'], ['down', 'Panah turun', 'arrow_downward', 'bad'], ['check', 'Centang', 'check_circle', 'ok'], ['x', 'Silang', 'cancel', 'bad'], ['warn', 'Peringatan', 'warning', 'warn'], ['star', 'Bintang', 'star', 'warn'], ['smile', 'Wajah senyum', 'sentiment_satisfied', 'ok'], ['sad', 'Wajah sedih', 'sentiment_dissatisfied', 'bad']];
const matchRule = (rule, v, type, P) => {
  let a = v, b = rule.v;
  if (type === 'num' || type === 'cost' || type === 'dur') { a = num(v); b = U.parseNum(String(rule.v).replace('%', '')); }
  else if (type === 'flag') { a = !!v; b = /^(ya|yes|true|1)$/i.test(String(rule.v)); }
  else if (type === 'date') { a = v == null ? null : U.dayStart(v); b = U.dayStart(U.parseDate(rule.v, 0)); }
  else { a = str(v).toLowerCase(); b = str(rule.v).toLowerCase(); }
  switch (rule.op) {
    case 'eq': return a === b; case 'ne': return a !== b; case 'gt': return a > b; case 'ge': return a >= b; case 'lt': return a < b; case 'le': return a <= b;
    case 'empty': return v == null || v === ''; case 'nempty': return !(v == null || v === '');
  }
  return false;
};
// icon HTML for a custom field value, or null
Fx.iconFor = (P, key, v, type) => {
  const f = P.fields[key];
  if (!f || !f.ind || !f.ind.length) return null;
  for (const r of f.ind) if (matchRule(r, v, type, P)) { const ic = Fx.ICONS.find(x => x[0] === r.ic) || Fx.ICONS[0]; return { ic: ic[2], cls: ic[3], name: ic[1] }; }
  return null;
};
// indicators shown in the Indicators column (fields with "showInd")
Fx.indicatorsFor = (P, t) => {
  const out = [];
  for (const [key, f] of Object.entries(P.fields || {})) {
    if (!f.showInd || !f.ind || !f.ind.length) continue;
    const fk = Object.keys(F.T).find(k => F.T[k].custom === key);
    if (!fk) continue;
    const type = key.replace(/\d+$/, '');
    const v = F.raw('task', fk, t, P);
    const hit = Fx.iconFor(P, key, v, type);
    if (hit) out.push([hit.ic, (f.name || F.T[fk].t) + ': ' + F.text('task', fk, t, P), hit.cls]);
  }
  return out;
};
})();
