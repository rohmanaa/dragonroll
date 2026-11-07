// Supabase browser client bootstrap for the static Ular Tangga frontend.
// Uses anonymous Supabase Auth so every browser gets an auth.uid() without a registration UI.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

// Nama pemain: akun login (username+password) memakai username-nya; tamu memakai displayName atau Player-XXXX.
function resolvePlayerName(user, displayName) {
  const meta = (user && user.user_metadata) || {};
  const isGuest = !user || !!user.is_anonymous;
  const account = isGuest ? '' : (meta.username || String(user.email || '').split('@')[0]);
  return String(account || displayName || '').trim().slice(0, 24) || ('Player-' + String((user && user.id) || '0000').slice(0, 4).toUpperCase());
}

async function ensureAnonymousPlayer(displayName) {
  const supabase = await getClient();
  let { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!session) {
    const result = await supabase.auth.signInAnonymously();
    if (result.error) throw result.error;
    session = result.data.session;
  }
  const isGuest = !!session.user.is_anonymous;
  const name = resolvePlayerName(session.user, displayName);
  const current = session.user.user_metadata || {};
  if (isGuest && current.display_name !== name) { // akun login tidak diubah metadata-nya
    const result = await supabase.auth.updateUser({ data: { display_name: name } });
    if (result.error) throw result.error;
  }
  return { id: session.user.id, name: name, isAnonymous: isGuest };
}

window.UT = window.UT || {};
window.UT.Multiplayer = window.UT.Multiplayer || {};
Object.assign(window.UT.Multiplayer, {
  getClient: getClient,
  ensureAnonymousPlayer: ensureAnonymousPlayer,
  resolvePlayerName: resolvePlayerName
});
