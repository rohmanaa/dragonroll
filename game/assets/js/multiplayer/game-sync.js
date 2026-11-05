// Host-authoritative gameplay transport. Guests broadcast intents; host persists snapshots.
import './room-service.js';
const MP=window.UT.Multiplayer;
async function connect(options){
 const identity=await MP.RoomService.ensurePlayer(),client=await MP.getClient();
 let revision=Number(options.roomConfig.roomRevision)||0,channel=client.channel('game-sync:'+options.roomId,{config:{broadcast:{self:false}}});
 let resolveReady,rejectReady;const ready=new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject});
 channel.on('broadcast',{event:'roll_request'},({payload})=>{if(options.isHost&&options.onRollRequest)options.onRollRequest(payload||{})});
 channel.on('broadcast',{event:'power_request'},({payload})=>{if(options.isHost&&options.onPowerRequest)options.onPowerRequest(payload||{})});
 channel.on('broadcast',{event:'loadout'},({payload})=>{if(options.isHost&&options.onLoadout&&payload)options.onLoadout(payload)});
 channel.on('broadcast',{event:'cue'},({payload})=>{if(!options.isHost&&options.onCue&&payload)options.onCue(payload)});
 channel.on('broadcast',{event:'snapshot'},({payload})=>{if(!options.isHost&&options.onSnapshot&&payload)options.onSnapshot(payload)});
 channel.subscribe(async status=>{
  if(status==='SUBSCRIBED'){try{const {data,error}=await client.from('game_rooms').select('revision,game_state').eq('id',options.roomId).maybeSingle();if(error)throw error;
   if(data){revision=Number(data.revision)||revision;if(data.game_state&&data.game_state.snapshot&&!options.isHost&&options.onSnapshot)options.onSnapshot(data.game_state.snapshot)}
   resolveReady(data||null);
  }catch(e){rejectReady(e)}}else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')rejectReady(new Error('Realtime channel '+status));
 });
 const row=await ready;
 return {
  identity:identity,revision:revision,
  initialSnapshot:row&&row.game_state&&row.game_state.snapshot||null,
  publish:async gameState=>{if(!options.isHost)throw new Error('HOST_ONLY');const {data,error}=await client.rpc('update_game_state',{p_room_id:options.roomId,p_game_state:gameState,p_expected_revision:revision});if(error)throw error;revision=Number(data.revision)||revision+1;await channel.send({type:'broadcast',event:'snapshot',payload:gameState.snapshot});return revision},
  sendLoadout:payload=>{if(options.isHost)return Promise.resolve('skipped');return channel.send({type:'broadcast',event:'loadout',payload})},
  sendCue:payload=>{if(!options.isHost)return Promise.resolve('skipped');return channel.send({type:'broadcast',event:'cue',payload})},
  requestRoll:async payload=>{if(options.isHost)throw new Error('HOST_DOES_NOT_REQUEST_REMOTE_ROLL');const result=await channel.send({type:'broadcast',event:'roll_request',payload});if(result==='error')throw new Error('ROLL_REQUEST_FAILED');return result},
  requestPower:async payload=>{if(options.isHost)throw new Error('HOST_DOES_NOT_REQUEST_REMOTE_POWER');const result=await channel.send({type:'broadcast',event:'power_request',payload});if(result==='error')throw new Error('POWER_REQUEST_FAILED');return result},
  close:()=>client.removeChannel(channel)
 };
}
MP.GameSync={connect};
