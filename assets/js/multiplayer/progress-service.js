// Progres pemain (profil, riwayat, achievement, login harian). Memanggil RPC dari 202611090001_player_progress.sql.
// Semua fungsi melempar error bila offline / belum login; pemanggil WAJIB menangkapnya (UI tetap jalan tanpa server).
import './client.js';
const MP=window.UT.Multiplayer;
async function rpc(name,args){const c=await MP.getClient();const {data,error}=await c.rpc(name,args||{});if(error)throw error;return data}
async function ensurePlayer(){if(!MP._identity)MP._identity=await MP.ensureAnonymousPlayer();return MP._identity}
/* Profil: JANGAN membuat sesi baru (pemain yang belum pernah main tetap melihat data kosong). */
async function hasSession(){const c=await MP.getClient(),{data}=await c.auth.getSession();return !!(data&&data.session)}
async function getMyProfile(){if(!await hasSession())return null;return rpc('get_my_profile')}
async function getHistory(limit){if(!await hasSession())return [];return rpc('get_match_history',{p_limit:limit||20})}
async function claimAchievement(id,clientValue){await ensurePlayer();return rpc('claim_achievement',{p_id:id,p_client_value:clientValue==null?null:Math.max(0,Math.floor(+clientValue)||0)})}
async function dailyLogin(){if(!await hasSession())return null;return rpc('record_daily_login')} /* hanya pemain yang sudah punya sesi (sudah pernah main) */
async function bumpCounter(kind,amount){await ensurePlayer();return rpc('bump_player_counter',{p_kind:kind,p_amount:amount||1})}
Object.assign(MP,{Progress:{getMyProfile,getHistory,claimAchievement,dailyLogin,bumpCounter}});
