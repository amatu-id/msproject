// Amatu Project — tautan berbagi langsung (sama dengan Amatu Docs / Sheets / Slides): satu salinan proyek di server
// (tabel amt_share Supabase amatu-id), dibuka lewat tautan rahasia:
//   vkey "Lihat saja"   – hanya melihat
//   ekey "Bisa mengedit" – mengedit penuh
// Klien memeriksa amt_share_get(key, rev) tiap 3 detik; editor menyimpan seluruh proyek terhadap revisi dasar dan, bila
// orang lain menyimpan di antaranya, menggabungkan tiga arah (dasar, milik saya, milik mereka) lalu menyimpan lagi.
(() => {
'use strict';
const AP = window.AP;
const L = AP.Live = {};
const SB_URL = 'https://ieyqxmzztoxgpvwexbkj.supabase.co';
const SB_KEY = 'sb_publishable_o-PQxhkJJ8FG4mHYTUqEBw_uXv9n-eG';

L.rpc = async (fn, args) => {
  if (window.AMATU && window.AMATU.rpc) return window.AMATU.rpc(fn, args);
  const r = await fetch(SB_URL + '/rest/v1/rpc/' + fn, {
    method: 'POST',
    headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(args || {}),
  });
  const txt = await r.text();
  let j = null; try { j = txt ? JSON.parse(txt) : null; } catch { /* ignore */ }
  if (!r.ok) { const e = new Error((j && j.message) || ('HTTP ' + r.status)); e.code = (j && j.message) || 'net'; throw e; }
  return j;
};
// signed-in AMATU account on this device (owner side); link guests have none
L.account = () => { const A = window.AMATU; if (!A || (A.guest && A.guest())) return null; const s = A.sess && A.sess(); return s && s.t ? s : null; };
L.shareKey = () => new URLSearchParams(location.search).get('share');
L.linkFor = key => `${location.origin}${location.pathname.replace(/[^/]*$/, '')}?share=${encodeURIComponent(key)}`;
L.errText = e => {
  const c = (e && (e.code || e.message)) || '';
  return {
    notfound: 'Tautan tidak berlaku lagi (dimatikan atau diganti pemilik).',
    denied: 'Anda tidak punya izin untuk perubahan ini.',
    big: 'Proyek terlalu besar untuk dibagikan (maks. 8 MB).',
    quota: 'Kuota berbagi akun penuh (maks. 60 MB / 200 dokumen).',
    auth: 'Sesi AMATU berakhir. Masuk lagi lewat Portal AMATU.',
    net: 'Tidak ada koneksi internet.',
  }[c] || ('Gagal: ' + c);
};

/* ---------------- gabung tiga arah ---------------- */
const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const eq = L.eq = (a, b) => {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) { if (a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (!eq(a[i], b[i])) return false; return true; }
  const ka = Object.keys(a).filter(k => a[k] !== undefined), kb = Object.keys(b).filter(k => b[k] !== undefined);
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (!eq(a[k], b[k])) return false;
  return true;
};
// objects merge per key; anything else changed on both sides keeps mine. custom[key](b, m, t) overrides a top-level key.
const merge3 = L.merge3 = (b, m, t, custom = null) => {
  if (eq(m, t)) return m;
  if (eq(b, m)) return t;
  if (eq(b, t)) return m;
  if (isObj(m) && isObj(t)) {
    const o = {}, bb = isObj(b) ? b : {};
    for (const k of new Set([...Object.keys(m), ...Object.keys(t)])) {
      const v = custom && custom[k] ? custom[k](bb[k], m[k], t[k]) : merge3(bb[k], m[k], t[k]);
      if (v !== undefined) o[k] = v;
    }
    return o;
  }
  return m;
};
// ordered lists of objects with an id merge per item; order follows mine, new items of theirs keep their place after
L.mergeList = (key, bb, mm, tt) => {
  const byId = a => Object.fromEntries((a || []).map(x => [x[key], x]));
  const r = merge3(byId(bb), byId(mm), byId(tt));
  const order = [];
  const tl = tt || [], ml = mm || [];
  for (const x of ml) if (r[x[key]] && !order.includes(x[key])) order.push(x[key]);
  tl.forEach((x, i) => { if (r[x[key]] && !order.includes(x[key])) { const prev = tl[i - 1]; const at = prev ? order.indexOf(prev[key]) + 1 : 0; order.splice(at, 0, x[key]); } });
  return order.map(id => r[id]);
};

/* ---------------- sesi sinkron ---------------- */
// opts: payload(), apply(doc, info), merge(b, m, t), busy(), status(st, info, e), role(info), name(), by(), persist(state), same(a, b)
class Live {
  constructor(key, opts, state = {}) {
    this.key = key; this.o = opts;
    this.rev = state.rev || 0; this.clean = state.clean !== false;
    this.base = null; this.same = opts.same || eq;
    this.info = null; this.role = null;
    this.timer = 0; this.saving = null; this.dead = false; this.fails = 0;
    this.saveSoon = AP.U.debounce(() => this.save(), 900);
    this.onVis = () => { if (document.visibilityState === 'visible') this.poll(); else if (!this.clean) this.save(); };
    document.addEventListener('visibilitychange', this.onVis);
  }
  async start() {
    const r = await L.rpc('amt_share_get', { p_key: this.key, p_rev: 0 });
    this.info = r; this.role = r.role; this.o.role && this.o.role(r);
    const mine = this.o.payload();
    const remote = r.data;
    if (mine && !this.clean && this.rev === r.rev) { this.setBase(remote, r.rev); this.markDirty(); this.saveSoon(); }
    else if (mine && !this.clean && this.role === 'edit') { const m = this.o.merge({}, mine, remote); this.setBase(remote, r.rev); this.o.apply(m, r); this.markDirty(); this.saveSoon(); }
    else { this.setBase(remote, r.rev); this.o.apply(remote, r); this.markClean(); }
    this.loop();
    return r;
  }
  setBase(doc, rev) { this.base = doc; this.rev = rev; }
  markClean() { this.clean = true; this.o.persist && this.o.persist({ rev: this.rev, clean: true }); this.o.status && this.o.status('synced', this.info); }
  markDirty() { this.clean = false; this.o.persist && this.o.persist({ rev: this.rev, clean: false }); this.o.status && this.o.status('pending', this.info); }
  loop() {
    clearTimeout(this.timer);
    if (this.dead) return;
    const ms = document.visibilityState === 'visible' ? (this.fails ? Math.min(30000, 3000 * 2 ** this.fails) : 3000) : 20000;
    this.timer = setTimeout(() => this.poll().finally(() => this.loop()), ms);
  }
  changed() { if (this.role !== 'edit' || this.dead) return; if (this.clean) this.markDirty(); this.saveSoon(); }
  async poll() {
    if (this.dead || this.saving || (this.o.busy && this.o.busy())) return;
    try {
      const r = await L.rpc('amt_share_get', { p_key: this.key, p_rev: this.rev });
      this.fails = 0;
      const roleChanged = r.role !== this.role;
      this.info = r; this.role = r.role;
      if (roleChanged && this.o.role) this.o.role(r);
      if (!('data' in r) || this.dead) { if (this.clean) this.o.status && this.o.status('synced', r); return; }
      const mine = this.o.payload();
      if (this.same(mine, this.base) || this.role !== 'edit') { this.setBase(r.data, r.rev); this.o.apply(r.data, r); this.markClean(); return; }
      const merged = this.o.merge(this.base, mine, r.data);
      this.setBase(r.data, r.rev);
      this.o.apply(merged, r);
      if (!this.same(merged, r.data)) { this.markDirty(); this.saveSoon(); } else this.markClean();
    } catch (e) {
      this.fails = Math.min(4, this.fails + 1);
      if (e.code === 'notfound') { this.o.status && this.o.status('revoked', this.info); this.stop(); }
      else this.o.status && this.o.status('offline', this.info);
    }
  }
  save() { return this.saving || (this.saving = this.doSave().finally(() => { this.saving = null; })); }
  async doSave() {
    if (this.dead || this.role !== 'edit') return;
    for (let attempt = 0; attempt < 4; attempt++) {
      const mine = this.o.payload();
      if (!mine || this.same(mine, this.base)) { this.markClean(); return; }
      this.o.status && this.o.status('saving', this.info);
      try {
        const r = await L.rpc('amt_share_save', { p_key: this.key, p_base: this.rev, p_data: mine, p_name: (this.o.name && this.o.name()) || '', p_by: (this.o.by && this.o.by()) || '' });
        this.fails = 0;
        if (r.conflict) {
          const merged = this.o.merge(this.base, mine, r.data);
          this.setBase(r.data, r.rev);
          this.o.apply(merged, { ...this.info, by: r.by });
          continue;
        }
        this.setBase(mine, r.rev);
        if (this.same(this.o.payload(), mine)) this.markClean(); else this.saveSoon();
        return;
      } catch (e) {
        this.fails = Math.min(4, this.fails + 1);
        if (e.code === 'notfound') { this.o.status && this.o.status('revoked', this.info); this.stop(); }
        else if (e.code === 'denied') this.o.status && this.o.status('denied', this.info);
        else { this.o.status && this.o.status(e.code === 'big' || e.code === 'quota' ? 'error' : 'offline', this.info, e); setTimeout(() => !this.dead && this.saveSoon(), 5000); }
        return;
      }
    }
  }
  stop() { this.dead = true; clearTimeout(this.timer); this.saveSoon.cancel(); document.removeEventListener('visibilitychange', this.onVis); }
}
L.Live = Live;
})();
