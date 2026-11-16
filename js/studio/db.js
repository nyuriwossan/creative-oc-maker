/* 創作OCメーカー v2.0 — 保存層（IndexedDB。使えない環境ではメモリ保存に切り替える） */
(function(){
"use strict";
const DB_NAME="ocMakerStudioV2",DB_VERSION=1;
const STORES=["projects","characters","images"];
let db=null,memory=null,persistent=true;

function open(){
  return new Promise((resolve,reject)=>{
    let req;
    try{req=indexedDB.open(DB_NAME,DB_VERSION);}catch(e){reject(e);return;}
    req.onupgradeneeded=()=>{
      const d=req.result;
      if(!d.objectStoreNames.contains("projects"))d.createObjectStore("projects",{keyPath:"id"});
      if(!d.objectStoreNames.contains("characters"))d.createObjectStore("characters",{keyPath:"id"}).createIndex("projectId","projectId");
      if(!d.objectStoreNames.contains("images"))d.createObjectStore("images",{keyPath:"id"}).createIndex("projectId","projectId");
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
    req.onblocked=()=>reject(new Error("blocked"));
  });
}
async function init(){
  try{
    if(typeof indexedDB==="undefined")throw new Error("no indexedDB");
    db=await open();
    db.onversionchange=()=>{db.close();};
  }catch(e){
    db=null;persistent=false;
    memory={projects:new Map(),characters:new Map(),images:new Map()};
  }
  return persistent;
}
function tx(names,mode,work){
  return new Promise((resolve,reject)=>{
    const t=db.transaction(names,mode);let result;
    t.oncomplete=()=>resolve(result);
    t.onerror=()=>reject(t.error);
    t.onabort=()=>reject(t.error||new Error("保存が中断されました"));
    result=work(t);
  });
}
const reqP=r=>new Promise((res,rej)=>{r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});

async function all(store){
  if(memory)return [...memory[store].values()];
  let r;await tx([store],"readonly",t=>{r=reqP(t.objectStore(store).getAll());});return r;
}
async function byProject(store,projectId){
  if(memory)return [...memory[store].values()].filter(x=>x.projectId===projectId);
  let r;await tx([store],"readonly",t=>{r=reqP(t.objectStore(store).index("projectId").getAll(projectId));});return r;
}
async function get(store,id){
  if(memory)return memory[store].get(id)||null;
  let r;await tx([store],"readonly",t=>{r=reqP(t.objectStore(store).get(id));});return (await r)||null;
}
async function put(store,value){
  if(memory){memory[store].set(value.id,value);return;}
  await tx([store],"readwrite",t=>{t.objectStore(store).put(value);});
}
async function del(store,id){
  if(memory){memory[store].delete(id);return;}
  await tx([store],"readwrite",t=>{t.objectStore(store).delete(id);});
}
/* 作品まるごとの書き込み・削除は1トランザクションで行い、途中で止まっても半端な状態を残さない。 */
async function putBundle(bundle){
  if(memory){
    memory.projects.set(bundle.project.id,bundle.project);
    bundle.characters.forEach(c=>memory.characters.set(c.id,c));
    bundle.images.forEach(i=>memory.images.set(i.id,i));return;
  }
  await tx(STORES,"readwrite",t=>{
    t.objectStore("projects").put(bundle.project);
    bundle.characters.forEach(c=>t.objectStore("characters").put(c));
    bundle.images.forEach(i=>t.objectStore("images").put(i));
  });
}
async function deleteProject(projectId){
  if(memory){
    memory.projects.delete(projectId);
    for(const s of ["characters","images"])for(const [k,v] of memory[s])if(v.projectId===projectId)memory[s].delete(k);
    return;
  }
  await tx(STORES,"readwrite",t=>{
    t.objectStore("projects").delete(projectId);
    for(const s of ["characters","images"]){
      const cur=t.objectStore(s).index("projectId").openKeyCursor(IDBKeyRange.only(projectId));
      cur.onsuccess=()=>{const c=cur.result;if(c){t.objectStore(s).delete(c.primaryKey);c.continue();}};
    }
  });
}
window.OCStudioDB={init,all,byProject,get,put,del,putBundle,deleteProject,isPersistent:()=>persistent};
})();
