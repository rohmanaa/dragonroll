// Pemain online (Supabase Realtime Presence) + undangan langsung lewat broadcast.
// status: 'lobby' = bisa diundang; 'room' / 'game' = sedang sibuk (tampil, tapi tidak bisa diundang).
import './room-service.js';
const MP=window.UT.Multiplayer;
let ch=null,inbox=null,me=null,client=null,starting=null,status='lobby';
const subs=new Set(),lastSent={};
function players(){
 if(!ch)return[];const st=ch.presenceState(),out=[];
 Object.keys(st).forEach(k=>{if(me&&k===me.id)return;const m=st[k][st[k].length-1]||{};out.push({id:k,name:String(m.name||'Player').slice(0,24),status:m.status||'lobby'})});
 return out.sort((a,b)=>(a.status==='lobby'?0:1)-(b.status==='lobby'?0:1)||a.name.localeCompare(b.name));
}
function notify(){const l=players();subs.forEach(f=>{try{f(l)}catch(e){console.error(e)}})}
function track(){if(ch&&me)ch.track({id:me.id,name:me.name,status:status}).catch(()=>{})}
/* Undangan teman: bunyi notif + muncul lagi tiap INV_GAP bila belum dijawab, total INV_MAX kali. TOLAK menghentikan pengingat untuk undangan itu saja
   (tidak memblokir pengirim: undangan baru dari dia tetap muncul dengan hitungan baru). Pengirim tetap dibatasi 8 dtk per target (lihat invite()). */
const INV_GAP=10000,INV_MAX=3,INV_VISIBLE=7000;
let invState=null;
function invSfx(){ /* aset: assets/sfx/notification.mp3 via UT.Audio (nama 'notif' di app.js; ikut mute). Halaman tanpa app.js: putar langsung, hormati pengaturan suara */
 try{const A=window.UT&&window.UT.Audio;if(A&&A.sources&&A.sources.notif){A.play('notif');return}
  const PD=window.PlayerData,st=PD&&PD.settings&&PD.settings();if(st&&st.sound===false)return;
  const a=new Audio('assets/sfx/notification.mp3');a.volume=.8;const r=a.play();if(r&&r.catch)r.catch(()=>{});}catch(e){}
}
function clearInvite(){if(invState){clearTimeout(invState.tShow);clearTimeout(invState.tHide);invState=null}const o=document.getElementById('ut-invite');if(o)o.remove()}
function showInvite(p){
 if(status!=='lobby'||!p||!/^[A-Z0-9]{6,8}$/.test(String(p.code||'')))return;
 clearInvite();invState={p:p,n:0,tShow:0,tHide:0};popInvite();
}
function popInvite(){
 const s=invState;if(!s||status!=='lobby'){clearInvite();return} /* sudah masuk room / sibuk -> pengingat batal */
 const p=s.p;s.n++;
 const old=document.getElementById('ut-invite');if(old)old.remove();
 const box=document.createElement('div');box.id='ut-invite';
 box.style.cssText='position:fixed;left:50%;bottom:max(1.5rem,env(safe-area-inset-bottom));transform:translateX(-50%);z-index:9999;display:flex;align-items:center;gap:12px;max-width:92vw;padding:12px 14px;border-radius:16px;background:linear-gradient(#3f93f4,#1d58c6);color:#fff;font:800 16px/1.2 "Baloo 2",Arial,sans-serif;box-shadow:0 0 0 3px #0b1530,0 6px 0 3px #0b1530';
 const t=document.createElement('span');t.textContent=String(p.from||'Pemain').slice(0,24)+' mengundangmu main!';
 const mk=(txt,bg,fn)=>{const b=document.createElement('button');b.textContent=txt;b.style.cssText='border:0;border-radius:10px;padding:8px 14px;font:inherit;color:#fff;cursor:pointer;background:'+bg+';box-shadow:0 0 0 2px #0b1530';b.onclick=fn;return b};

 const go=mk('GABUNG','linear-gradient(#75ed46,#19a32d)',()=>{const f=p.format==='team'?'team':'solo';clearInvite();location.href='room.html?mode=online&format='+f+'&count=4&role=guest&code='+p.code});
 const no=mk('TOLAK','linear-gradient(#ff7777,#bd1828)',()=>clearInvite());
 box.append(t,go,no);document.body.appendChild(box);invSfx();
 s.tHide=setTimeout(()=>box.remove(),INV_VISIBLE);
 if(s.n<INV_MAX)s.tShow=setTimeout(popInvite,INV_GAP);else s.tShow=setTimeout(clearInvite,INV_VISIBLE);
}
async function start(opts){
 status=(opts&&opts.status)||status;
 if(ch){track();return}
 if(starting)return starting;
 starting=(async()=>{
  if(opts&&opts.requireSession){const c0=await MP.getClient();const r0=await c0.auth.getSession();if(!r0.data||!r0.data.session)return}
  me=await MP.RoomService.ensurePlayer();client=await MP.getClient();
  ch=client.channel('online-players',{config:{presence:{key:me.id}}});
  ch.on('presence',{event:'sync'},notify);
  ch.subscribe(s=>{if(s==='SUBSCRIBED')track()});
  inbox=client.channel('invite:'+me.id);
  inbox.on('broadcast',{event:'invite'},({payload})=>showInvite(payload)).subscribe();
 })().catch(e=>{console.warn('[presence] gagal',e);ch=null}).finally(()=>{starting=null});
 return starting;
}
function setStatus(s){status=s;track()}
async function invite(targetId,payload){
 if(!client||!me)throw new Error('PRESENCE_NOT_READY');
 const now=Date.now();if(lastSent[targetId]&&now-lastSent[targetId]<8000)throw new Error('TUNGGU_SEBENTAR');lastSent[targetId]=now;
 const c=client.channel('invite:'+targetId);
 await new Promise((res,rej)=>{const t=setTimeout(()=>rej(new Error('TIMEOUT')),6000);c.subscribe(s=>{if(s==='SUBSCRIBED'){clearTimeout(t);res()}else if(s==='CHANNEL_ERROR'){clearTimeout(t);rej(new Error('CHANNEL_ERROR'))}})});
 try{await c.send({type:'broadcast',event:'invite',payload:Object.assign({from:me.name},payload)})}finally{client.removeChannel(c)}
}
MP.Presence={start,setStatus,invite,list:players,onChange:f=>{subs.add(f);return()=>subs.delete(f)}};
