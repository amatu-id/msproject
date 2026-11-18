// Amatu Project — penyimpanan IndexedDB `amatu-msproject` (meta, projects, versions). /amatu.js (Portal AMATU)
// menyinkronkan basis data ini ke akun secara otomatis; store `versions` tidak memicu muat ulang di perangkat lain.
(() => {
'use strict';
const AP = window.AP, U = AP.U, M = AP.M;
const Store = AP.Store = {};
const NAME = 'amatu-msproject', VER = 1, MAX_VERSIONS = 15;
let dbp = null;
Store.open = () => dbp || (dbp = new Promise((res, rej) => {
  const r = indexedDB.open(NAME, VER);
  r.onupgradeneeded = () => {
    const db = r.result;
    if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'id' });
    if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'id' });
    if (!db.objectStoreNames.contains('versions')) { const s = db.createObjectStore('versions', { keyPath: 'vid' }); s.createIndex('pid', 'pid'); }
  };
  r.onsuccess = () => { const db = r.result; db.onversionchange = () => { db.close(); dbp = null; }; res(db); };
  r.onerror = () => rej(r.error);
  r.onblocked = () => rej(new Error('Basis data diblokir oleh tab lain'));
}));
const tx = async (stores, mode, fn) => {
  const db = await Store.open();
  return new Promise((res, rej) => {
    const t = db.transaction(stores, mode);
    let out;
    t.oncomplete = () => res(out);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error || new Error('Transaksi dibatalkan'));
    out = fn(...(Array.isArray(stores) ? stores : [stores]).map(s => t.objectStore(s)));
  });
};
const req = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
Store.list = async () => {
  const db = await Store.open();
  const all = await req(db.transaction('meta').objectStore('meta').getAll());
  return all.filter(m => !m.deleted).sort((a, b) => (b.updated || 0) - (a.updated || 0));
};
Store.get = async id => { const db = await Store.open(); return req(db.transaction('projects').objectStore('projects').get(id)); };
Store.getMeta = async id => { const db = await Store.open(); return req(db.transaction('meta').objectStore('meta').get(id)); };
// mini Gantt for the home page card: up to 12 rows [x0, x1, lvl, kind]
Store.thumb = P => {
  const T = P.tasks.filter(t => !t.inact && t.start != null).slice(0, 12);
  const R = P.root || {};
  const a = R.start, b = R.finish;
  if (!T.length || !(b > a)) return [];
  const span = b - a;
  return T.map(t => [+((t.start - a) / span).toFixed(3), +((t.finish - a) / span).toFixed(3), t.lvl, t.sum ? 's' : (t.ms || t.dur === 0) ? 'm' : t.crit ? 'c' : 't']);
};
Store.metaOf = P => ({
  id: P.id, name: P.name, updated: P.updated || Date.now(), created: P.created || Date.now(),
  start: P.root ? P.root.start : P.start, finish: P.root ? P.root.finish : P.finish, pct: P.root ? P.root.pct : 0,
  n: P.tasks.length, nr: P.res.length, cost: P.root ? P.root.cost : 0, starred: !!P.starred, locked: !!P.lock, thumb: P.lock ? [] : Store.thumb(P), rev: P.rev || 0,
});
Store.put = async P => {
  const data = M.clean(P);
  const meta = Store.metaOf(P);
  await tx(['projects', 'meta'], 'readwrite', (ps, ms) => { ps.put(data); ms.put(meta); });
  return meta;
};
Store.putMeta = async meta => tx('meta', 'readwrite', ms => { ms.put(meta); });
Store.del = async id => {
  const vs = await Store.versions(id);
  await tx(['projects', 'meta', 'versions'], 'readwrite', (ps, ms, vv) => { ps.delete(id); ms.delete(id); for (const v of vs) vv.delete(v.vid); });
};
Store.versions = async pid => {
  const db = await Store.open();
  const all = await req(db.transaction('versions').objectStore('versions').index('pid').getAll(pid));
  return all.sort((a, b) => b.at - a.at);
};
Store.addVersion = async (P, label = '', auto = true) => {
  const v = { vid: U.uid('v'), pid: P.id, at: Date.now(), label, auto, name: P.name, n: P.tasks.length, data: M.clean(P) };
  const list = await Store.versions(P.id);
  // keep named versions; drop oldest automatic ones beyond the limit
  const autos = list.filter(x => x.auto);
  const drop = autos.length + 1 > MAX_VERSIONS ? autos.slice(MAX_VERSIONS - 1) : [];
  await tx('versions', 'readwrite', vv => { vv.put(v); for (const d of drop) vv.delete(d.vid); });
  return v;
};
Store.delVersion = async vid => tx('versions', 'readwrite', vv => { vv.delete(vid); });
Store.renameVersion = async (vid, label) => {
  const db = await Store.open();
  const v = await req(db.transaction('versions').objectStore('versions').get(vid));
  if (!v) return;
  v.label = label; v.auto = false;
  await tx('versions', 'readwrite', vv => { vv.put(v); });
};
// device-only UI preferences (pt.* is never synced by /amatu.js) and synced preferences
Store.ui = (k, v) => {
  const key = 'pt.msproject.' + k;
  try {
    if (v === undefined) { const s = localStorage.getItem(key); return s == null ? null : JSON.parse(s); }
    if (v === null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(v));
  } catch { return null; }
};
Store.pref = (k, v) => {
  const key = 'msproject.' + k;
  try {
    if (v === undefined) { const s = localStorage.getItem(key); return s == null ? null : JSON.parse(s); }
    if (v === null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(v));
  } catch { return null; }
};
})();
