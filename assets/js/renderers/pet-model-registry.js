(function(global){
"use strict";
const UT=global.UT=global.UT||{};
if(UT.PetModelRegistry)return;

const MODULES=Object.freeze({
  forest_pup:{url:'data/inventory/pet/forest_pup/model.js',active:true},
  copper_golem:{url:'data/inventory/pet/copper_golem/model.js',active:true},
  crystal_axolotl:{url:'data/inventory/pet/crystal_axolotl/model.js',active:false},
  arcane_owl:{url:'data/inventory/pet/arcane_owl/model.js',active:false},
  storm_wolf:{url:'data/inventory/pet/storm_wolf/model.js',active:false},
  inferno_dragon:{url:'data/inventory/pet/inferno_dragon/model.js',active:false},
  celestial_kitsune:{url:'data/inventory/pet/celestial_kitsune/model.js',active:false}
});
const KEYS=Object.freeze(Object.keys(MODULES));
const builders=Object.create(null),pending=Object.create(null);
const isKnownKey=key=>Object.prototype.hasOwnProperty.call(MODULES,key);

function createSelectionGuard(){
  let generation=0;
  return Object.freeze({
    begin(){return ++generation},
    isCurrent(token){return token===generation}
  });
}

function register(key,builder){
  if(!isKnownKey(key))throw new Error('Unknown Pet model key: '+key);
  if(!MODULES[key].active)throw new Error('Pet model module is not active: '+key);
  if(typeof builder!=='function')throw new TypeError('Pet model builder must be a function: '+key);
  if(builders[key])throw new Error('Pet model already registered: '+key);
  if(!pending[key])throw new Error('Pet model registration without an active load: '+key);
  builders[key]=builder;
}

function load(key){
  if(!isKnownKey(key))return Promise.reject(new Error('Unknown Pet model key: '+key));
  if(!MODULES[key].active)return Promise.reject(new Error('Pet model module is not active: '+key));
  if(builders[key])return Promise.resolve(builders[key]);
  if(pending[key])return pending[key];
  if(!global.document||!global.document.head||typeof global.document.createElement!=='function'){
    return Promise.reject(new Error('Pet model script loader is unavailable'));
  }

  let script;
  try{script=global.document.createElement('script')}
  catch(error){return Promise.reject(error)}
  script.async=true;
  script.src=MODULES[key].url;

  let resolveLoad,rejectLoad;
  const request=new Promise((resolve,reject)=>{resolveLoad=resolve;rejectLoad=reject});
  pending[key]=request;
  const cleanup=()=>{
    if(pending[key]===request)delete pending[key];
    if(script.parentNode)script.parentNode.removeChild(script);
  };
  script.onload=()=>{
    const builder=builders[key];
    cleanup();
    if(typeof builder!=='function'){
      rejectLoad(new Error('Pet model module did not register the requested key: '+key));
      return;
    }
    resolveLoad(builder);
  };
  script.onerror=()=>{
    cleanup();
    rejectLoad(new Error('Failed to load Pet model module: '+key+' ('+MODULES[key].url+')'));
  };
  try{global.document.head.appendChild(script)}
  catch(error){cleanup();rejectLoad(error)}
  return request;
}

UT.PetModelRegistry=Object.freeze({
  keys(){return KEYS.slice()},
  isKnownKey,
  hasModule(key){return isKnownKey(key)&&MODULES[key].active},
  createSelectionGuard,
  register,
  load
});
})(window);
