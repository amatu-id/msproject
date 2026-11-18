// Amatu Project — kunci proyek dengan kata sandi (PBKDF2, seperti Amatu Docs/Sheets): layar kunci saat dibuka,
// terbuka per tab (sessionStorage), atur/ubah/hapus kata sandi dari Berkas › Info.
(() => {
'use strict';
const AP = window.AP, U = AP.U, UI = AP.UI, { el, icon } = U;
const Lock = AP.Lock = {};
const enc = new TextEncoder();
const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
async function hashOf(pw, salt) {
  const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations: 150000, hash: 'SHA-256' }, key, 256));
}
const KEY = id => 'amp.unlocked.' + id;
Lock.isOpen = P => { try { return sessionStorage.getItem(KEY(P.id)) === (P.lock && P.lock.hash); } catch { return false; } };
Lock.check = async (P, pw) => { if (!P.lock) return true; const h = await hashOf(pw, P.lock.salt); if (h === P.lock.hash) return true; const h2 = await hashOf(pw.trim(), P.lock.salt); return h2 === P.lock.hash; };
Lock.gate = P => new Promise(res => {
  const inp = el('input.inp', { type: 'password', placeholder: 'Kata sandi', autocomplete: 'off' });
  const err = el('div.lk-err');
  const box = el('div.lk-screen', el('div.lk-card', el('div.lk-ic', icon('lock')), el('h2', P.name), el('p', 'Proyek ini dikunci dengan kata sandi.'), P.lock.hint ? el('div.lk-hint', icon('lightbulb'), 'Petunjuk: ' + P.lock.hint) : null, inp, err,
    el('div.lk-btns', el('button.btn', { type: 'button', onclick: () => { box.remove(); res(false); } }, 'Kembali'), el('button.btn.primary', { type: 'button', onclick: go }, icon('lock_open'), 'Buka'))));
  async function go() {
    if (await Lock.check(P, inp.value)) { try { sessionStorage.setItem(KEY(P.id), P.lock.hash); } catch { } box.remove(); res(true); }
    else { err.textContent = 'Kata sandi salah'; inp.select(); }
  }
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
  document.body.append(box);
  setTimeout(() => inp.focus(), 50);
});
Lock.dialog = app => {
  const P = app.P;
  const pw = el('input.inp', { type: 'password', placeholder: 'Kata sandi baru', autocomplete: 'new-password' });
  const pw2 = el('input.inp', { type: 'password', placeholder: 'Ulangi kata sandi', autocomplete: 'new-password' });
  const hint = el('input.inp', { placeholder: 'Petunjuk (opsional)', value: (P.lock && P.lock.hint) || '' });
  const match = el('div.hint');
  const upd = () => { match.textContent = pw.value || pw2.value ? (pw.value === pw2.value ? '✓ Sama (' + pw.value.length + ' karakter)' : 'Belum sama: ' + pw.value.length + ' vs ' + pw2.value.length + ' karakter') : ''; };
  pw.addEventListener('input', upd); pw2.addEventListener('input', upd);
  UI.dialog({ title: P.lock ? 'Ubah Kata Sandi Proyek' : 'Kunci Proyek dengan Kata Sandi', width: '440px', body: el('div', UI.field('Kata sandi', pw), UI.field('Ulangi', pw2), match, UI.field('Petunjuk', hint), el('p.hint', 'Kata sandi diminta saat proyek dibuka di perangkat/tab mana pun. Jangan sampai lupa — kata sandi tidak dapat dipulihkan.')),
    buttons: [...(P.lock ? [{ label: 'Hapus Kunci', left: true, danger: true, run: () => { app.tx('Hapus kata sandi', P2 => { delete P2.lock; }); UI.toast('Kunci dihapus'); } }] : []), { label: 'Batal' }, { label: 'Simpan', primary: true, run: async () => {
      if (pw.value.length < 4) { UI.toast('Minimal 4 karakter'); return false; }
      if (pw.value !== pw2.value) { UI.toast('Kata sandi tidak sama'); return false; }
      const salt = U.uid('s');
      const hash = await hashOf(pw.value, salt);
      app.tx('Kunci proyek', P2 => { P2.lock = { salt, hash, hint: hint.value.trim() }; });
      try { sessionStorage.setItem(KEY(P.id), hash); } catch { }
      UI.toast('Proyek dikunci dengan kata sandi');
    } }] });
};
})();
