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
async function addFriend(id,friendName,myName){await ensurePlayer();return rpc('add_friend',{p_friend_id:id,p_friend_name:friendName,p_my_name:myName})}
async function removeFriend(id){await ensurePlayer();return rpc('remove_friend',{p_friend_id:id})}
async function listFriends(){await ensurePlayer();const c=await MP.getClient();const {data,error}=await c.from('friendships').select('friend_id,friend_name').order('friend_name');if(error)throw error;return data||[]}
async function setSlots(roomId,max){await ensurePlayer();return rpc('set_game_room_slots',{p_room_id:roomId,p_max_players:max})}
async function exitRoom(roomId){await ensurePlayer();return rpc('exit_game_room',{p_room_id:roomId})}
async function heartbeat(roomId){await ensurePlayer();return rpc('heartbeat_game_room',{p_room_id:roomId})}
async function startRoom(roomId,gameState){await ensurePlayer();return rpc('start_game_room',{p_room_id:roomId,p_game_state:gameState||{}})}
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
Object.assign(MP,{RoomService:{addFriend,removeFriend,listFriends,setSlots,exitRoom,ensurePlayer,createRoom,joinRoom,setReady,setVisibility,quickJoin,leaveRoom,startRoom,getRoom,heartbeat,subscribe}});
