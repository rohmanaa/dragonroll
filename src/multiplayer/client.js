// Supabase browser client bootstrap for the static Ular Tangga frontend.
// Tahap 3b: hanya akun login (username+password, lihat auth.js); sesi anonim tidak dibuat lagi.
import { createClient } from '../vendor/supabase-js-2.119.0.mjs'; // lokal, versi dikunci (bundle esbuild dari @supabase/supabase-js@2.119.0)

let clientPromise = null;

async function getClient() {
  if (clientPromise) return clientPromise;
  clientPromise = (async function () {
    const config = await import('./config.example.js');
    const url = String(config.SUPABASE_URL || '').trim();
    const key = String(config.SUPABASE_ANON_KEY || '').trim();
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url) || !key || key.indexOf('YOUR_') === 0) {
      throw new Error('Supabase belum dikonfigurasi. Isi URL dan anon key publik di config.example.js.');
    }
    return createClient(url, key, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      },
      realtime: { params: { eventsPerSecond: 10 } }
    });
  })();
  try { return await clientPromise; }
  catch (error) { clientPromise = null; throw error; }
}

// Nama pemain: akun login (username+password) memakai username-nya.
function resolvePlayerName(user, displayName) {
  const meta = (user && user.user_metadata) || {};
  const isGuest = !user || !!user.is_anonymous;
  const account = isGuest ? '' : (meta.username || String(user.email || '').split('@')[0]);
  return String(account || displayName || '').trim().slice(0, 24) || ('Player-' + String((user && user.id) || '0000').slice(0, 4).toUpperCase());
}

async function ensureAnonymousPlayer(displayName) {
  const supabase = await getClient();
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  /* Tahap 3b: wajib login. Tidak ada lagi sesi anonim otomatis (sesi habis tidak boleh diam-diam
     berganti identitas). Layar login ada di splash.html (UT.Auth.signIn/signUp). */
  if (!session || !session.user || session.user.is_anonymous) throw new Error('AUTH_REQUIRED: belum login');
  const name = resolvePlayerName(session.user, displayName);
  return { id: session.user.id, name: name, isAnonymous: false };
}

window.UT = window.UT || {};
window.UT.Multiplayer = window.UT.Multiplayer || {};
Object.assign(window.UT.Multiplayer, {
  getClient: getClient,
  ensureAnonymousPlayer: ensureAnonymousPlayer,
  resolvePlayerName: resolvePlayerName
});
