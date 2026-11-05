// Akun DRAGON ROLL: username + password (minimal 6) lewat Supabase Auth.
// Supabase Auth butuh email, jadi username dipetakan ke email internal <username>@EMAIL_DOMAIN (tidak pernah dikirimi email).
// Syarat dashboard Supabase: Authentication > Providers > Email aktif dan "Confirm email" DIMATIKAN.
import './multiplayer/client.js';
const MP = window.UT.Multiplayer;
const EMAIL_DOMAIN = 'dragonroll-game.com';
const CACHE_KEY = 'ut-auth';
const USER_RE = /^[A-Za-z0-9_]{3,16}$/;

function emailOf(username) { return username.toLowerCase() + '@' + EMAIL_DOMAIN; }
function readCache() { try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch (e) { return null; } }
function writeCache(u) { try { u ? localStorage.setItem(CACHE_KEY, JSON.stringify(u)) : localStorage.removeItem(CACHE_KEY); } catch (e) {} }
function applyName(username) { try { if (window.PlayerData && username) PlayerData.setName(username); } catch (e) {} }
function userFrom(session) {
  if (!session || !session.user || session.user.is_anonymous) return null;
  const m = session.user.user_metadata || {};
  const name = m.username || (session.user.email || '').split('@')[0];
  return name ? { id: session.user.id, username: name } : null;
}
function friendly(err) {
  const m = String((err && err.message) || err || '').toLowerCase();
  if (m.indexOf('already registered') >= 0 || m.indexOf('already been registered') >= 0) return 'Username sudah dipakai. Silakan login.';
  if (m.indexOf('invalid login') >= 0) return 'Username atau password salah.';
  if (m.indexOf('confirm') >= 0) return 'Pendaftaran butuh konfirmasi email. Matikan "Confirm email" di Supabase.';
  if (m.indexOf('invalid') >= 0 && m.indexOf('email') >= 0) return 'Username ditolak server. Coba username lain.';
  if (m.indexOf('rate') >= 0) return 'Terlalu banyak percobaan. Coba lagi sebentar.';
  if (m.indexOf('failed to fetch') >= 0 || m.indexOf('network') >= 0 || m.indexOf('dikonfigurasi') >= 0) return 'Tidak dapat terhubung ke server. Periksa koneksi.';
  return 'Gagal: ' + ((err && err.message) || 'coba lagi');
}
function validate(username, password) {
  if (!USER_RE.test(username)) return 'Username 3-16 karakter: huruf, angka, atau underscore.';
  if (String(password).length < 6) return 'Password minimal 6 karakter.';
  return null;
}
function finish(session) {
  const u = userFrom(session);
  if (!u) throw new Error('Sesi tidak valid');
  writeCache(u); applyName(u.username);
  return u;
}
async function check() { // sesi tersimpan? (tidak membuat akun anonim)
  try {
    const c = await MP.getClient();
    const { data, error } = await c.auth.getSession();
    if (error) throw error;
    const u = userFrom(data.session);
    if (u) { writeCache(u); applyName(u.username); return u; }
    writeCache(null); return null;
  } catch (e) { const c = readCache(); return c || null; }
}
async function signUp(username, password) {
  username = String(username || '').trim(); const bad = validate(username, password); if (bad) throw new Error(bad);
  try {
    const c = await MP.getClient();
    const { data, error } = await c.auth.signUp({ email: emailOf(username), password: password, options: { data: { username: username, display_name: username } } });
    if (error) throw error;
    if (!data.session) throw new Error('confirm email');
    return finish(data.session);
  } catch (e) { const err = new Error(friendly(e)); throw err; }
}
async function signIn(username, password) {
  username = String(username || '').trim(); const bad = validate(username, password); if (bad) throw new Error(bad);
  try {
    const c = await MP.getClient();
    const { data, error } = await c.auth.signInWithPassword({ email: emailOf(username), password: password });
    if (error) throw error;
    return finish(data.session);
  } catch (e) { throw new Error(friendly(e)); }
}
async function signOut() {
  try { const c = await MP.getClient(); await c.auth.signOut(); } catch (e) {}
  writeCache(null);
}
window.UT.Auth = { check, signUp, signIn, signOut, cached: readCache, USER_RE };
window.dispatchEvent(new Event('ut:auth-module-ready'));
