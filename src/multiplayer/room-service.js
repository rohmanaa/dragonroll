// Supabase room operations for the static room page. No profile/shop data is accessed.
import './client.js';
const MP=window.UT.Multiplayer;
async function rpc(name,args){const c=await MP.getClient();const {data,error}=await c.rpc(name,args);if(error)throw error;return data}
async function ensurePlayer(){if(!MP._identity)MP._identity=await MP.ensureAnonymousPlayer();return MP._identity}
async function createRoom(o){await ensurePlayer();return rpc('create_game_room',{p_code:o.code,p_name:o.name,p_is_public:!!o.isPublic,p_format:o.format||'solo',p_max_players:o.maxPlayers||4,p_config:o.config||{}})}
async function joinRoom(o){await ensurePlayer();return rpc('join_game_room',{p_code:o.code,p_name:o.name})}
async function setReady(roomId,ready){await ensurePlayer();return rpc('set_game_player_ready',{p_room_id:roomId,p_ready:!!ready})}
async function setVisibility(roomId,isPublic){await ensurePlayer();return rpc('set_game_room_visibility',{p_room_id:roomId,p_is_public:!!isPublic})}
async function quickJoin(o){await ensurePlayer();return rpc('quick_join_game_room',{p_name:o.name,p_format:o.format||'solo'})}
async function leaveRoom(roomId){await ensurePlayer();return rpc('leave_game_room',{p_room_id:roomId})}
async function sendFriendRequest(o){await ensurePlayer();return rpc('send_friend_request',{p_target_id:o.id||null,p_username:o.username||null,p_my_name:o.myName,p_target_name:o.name||null})}
async function acceptFriendRequest(id,myName){await ensurePlayer();return rpc('accept_friend_request',{p_from_id:id,p_my_name:myName})}
async function declineFriendRequest(id){await ensurePlayer();return rpc('decline_friend_request',{p_from_id:id})}
async function listRequests(){await ensurePlayer();const c=await MP.getClient();const {data,error}=await c.from('friend_requests').select('from_id,from_name').eq('to_id',MP._identity.id).order('created_at',{ascending:false});if(error)throw error;return data||[]}
async function removeFriend(id){await ensurePlayer();return rpc('remove_friend',{p_friend_id:id})}
async function listFriends(){await ensurePlayer();const c=await MP.getClient();let r=await c.rpc('list_my_friends'); /* nama = username akun saat ini (202611100004); migrasi belum diterapkan -> pakai salinan lama */
 if(r.error)r=await c.from('friendships').select('friend_id,friend_name').order('friend_name');if(r.error)throw r.error;return r.data||[]}
/* Profil publik = hanya ID kosmetik yang sedang dipakai (characterSkinId, diceId, frameId, effectId; string <=48). Server menyaring kunci lain dan menolak non-anggota room. */
async function setPublicProfile(roomId,profile){await ensurePlayer();return rpc('set_game_public_profile',{p_room_id:roomId,p_profile:profile||{}})}
async function setSlots(roomId,max){await ensurePlayer();return rpc('set_game_room_slots',{p_room_id:roomId,p_max_players:max})}
async function exitRoom(roomId){await ensurePlayer();return rpc('exit_game_room',{p_room_id:roomId})}
async function heartbeat(roomId){await ensurePlayer();return rpc('heartbeat_game_room',{p_room_id:roomId})}
async function startRoom(roomId,gameState){await ensurePlayer();return rpc('start_game_room',{p_room_id:roomId,p_game_state:gameState||{}})}
/* Resume: room 'playing' terbaru (<6 jam) milik pemain ini. RLS membatasi game_rooms ke room yang memuat id pemain, jadi tak perlu key lokal. null bila tidak ada. */
async function activeRoom(){await ensurePlayer();const c=await MP.getClient();const since=new Date(Date.now()-6*3600*1000).toISOString();const {data,error}=await c.from('game_rooms').select('id,code,format,status,players,updated_at').eq('status','playing').gte('updated_at',since).order('updated_at',{ascending:false}).limit(1);if(error)throw error;const r=data&&data[0];return (r&&(r.players||[]).some(p=>p.id===MP._identity.id))?r:null}
async function getRoom(roomId){await ensurePlayer();const c=await MP.getClient();const {data,error}=await c.from('game_rooms').select('*').eq('id',roomId).maybeSingle();if(error)throw error;if(!data)throw new Error('ROOM_NOT_FOUND');return data}
function subscribe(roomId,onRoom){
 let channel,closed=false,heartbeatTimer=null;
 (async()=>{try{const c=await MP.getClient(),p=await ensurePlayer();if(closed)return;
  channel=c.channel('game-room:'+roomId,{config:{presence:{key:p.id}}});
  const syncHeartbeat=row=>{if(row&&row.host_id===p.id&&!heartbeatTimer){heartbeatTimer=setInterval(()=>heartbeat(roomId).catch(e=>console.warn('[multiplayer] heartbeat failed',e)),30000)}else if((!row||row.host_id!==p.id)&&heartbeatTimer){clearInterval(heartbeatTimer);heartbeatTimer=null}};
  channel.on('postgres_changes',{event:'*',schema:'public',table:'game_rooms',filter:'id=eq.'+roomId},payload=>{if(payload.eventType!=='DELETE'&&payload.new){syncHeartbeat(payload.new);onRoom(payload.new)}});
  channel.subscribe(async status=>{if(status==='SUBSCRIBED'){try{await channel.track({player_id:p.id,online_at:new Date().toISOString()})}catch(_){}
   const {data,error}=await c.from('game_rooms').select('*').eq('id',roomId).maybeSingle();if(!error&&data&&!closed){syncHeartbeat(data);onRoom(data)}}});
 }catch(e){console.error('[multiplayer] subscription failed',e)}})();
 return ()=>{closed=true;if(heartbeatTimer)clearInterval(heartbeatTimer);if(channel)MP.getClient().then(c=>c.removeChannel(channel)).catch(()=>{})};
}
async function submitMatchResult(o){await ensurePlayer();return rpc('submit_match_result',{p_match_id:o.matchId,p_won:!!o.won,p_name:o.name,p_xp_total:Math.max(0,Math.floor(+o.xpTotal||0)),p_room_id:o.roomId||null,p_mode:o.mode||null,p_players:o.players||null,p_stats:o.stats||null})}
async function getLeaderboard(scope,limit){await ensurePlayer();return rpc('get_leaderboard',{p_scope:scope,p_limit:limit||50})}
Object.assign(MP,{RoomService:{setPublicProfile,activeRoom,submitMatchResult,getLeaderboard,sendFriendRequest,acceptFriendRequest,declineFriendRequest,listRequests,removeFriend,listFriends,setSlots,exitRoom,ensurePlayer,createRoom,joinRoom,setReady,setVisibility,quickJoin,leaveRoom,startRoom,getRoom,heartbeat,subscribe}});
