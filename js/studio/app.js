/* 創作OCメーカー v2.0 — 画面の土台（タブ・作品管理・共通UI・保存状態） */
(function(){
"use strict";
const C=window.OCStudioCore,DB=window.OCStudioDB;
const CURRENT_KEY="ocMakerStudioCurrentV2";
const TAB_KEYS=["create","zukan","height","relation","world"];
const S={projects:[],project:null,chars:[],ready:false,tab:"create"};
const urls=new Map(),imgs=new Map(),listeners={},tabs={};
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

function on(evt,fn){(listeners[evt]=listeners[evt]||[]).push(fn);}
function emit(evt,data){(listeners[evt]||[]).forEach(fn=>{try{fn(data);}catch(e){console.error(e);}});}
function toast(msg){
  if(typeof showToast==="function"){showToast(msg);return;}
  const t=$("toast");if(!t)return;t.textContent=msg;t.classList.add("show");
  clearTimeout(t._timer);t._timer=setTimeout(()=>t.classList.remove("show"),1800);
}
function copy(text,msg){
  if(typeof copyToClipboard==="function")copyToClipboard(text,msg);
  else if(navigator.clipboard)navigator.clipboard.writeText(text).then(()=>toast(msg||"コピーしました"));
}

/* ---------- 保存状態 ---------- */
let pending=0,failed=false;
function setStatus(){
  const el=$("saveStatus");if(!el)return;
  el.className="st-status"+(failed?" err":pending?" busy":"");
  el.textContent=!DB.isPersistent()?"この端末には保存されません":failed?"保存エラー":pending?"保存中…":"保存済み";
}
async function guard(work){
  pending++;setStatus();
  try{const r=await work();failed=false;return r;}
  catch(e){failed=true;console.error(e);toast("保存できませんでした。空き容量を確認してください");throw e;}
  finally{pending--;setStatus();}
}
const timers=new Map();
function debounce(key,fn,ms){
  clearTimeout(timers.get(key));
  timers.set(key,setTimeout(()=>{timers.delete(key);pendingFlush.delete(key);fn();},ms==null?400:ms));
  pendingFlush.set(key,fn);
}
const pendingFlush=new Map();
async function flush(){
  const jobs=[];
  for(const [key,t] of timers){clearTimeout(t);const fn=pendingFlush.get(key);if(fn)jobs.push(fn());}
  timers.clear();pendingFlush.clear();
  await Promise.allSettled(jobs);
}
function saveProject(){
  const p=S.project;if(!p)return;
  p.updatedAt=Date.now();
  debounce("prj:"+p.id,()=>guard(()=>DB.put("projects",p)).catch(()=>{}));
}
function saveChar(c){
  c.updatedAt=Date.now();
  debounce("chr:"+c.id,()=>guard(()=>DB.put("characters",c)).catch(()=>{}));
}
window.addEventListener("pagehide",()=>{flush();});
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden")flush();});

/* ---------- 画像 ---------- */
function loadImg(src){
  return new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=()=>rej(new Error("画像を読み込めませんでした。"));im.src=src;});
}
async function imageURL(imageId){
  if(!imageId)return null;
  if(urls.has(imageId))return urls.get(imageId);
  const rec=await DB.get("images",imageId);
  if(!rec)return null;
  const url=URL.createObjectURL(new Blob([rec.buffer],{type:rec.type}));
  urls.set(imageId,url);return url;
}
async function imageEl(imageId){
  if(!imageId)return null;
  if(imgs.has(imageId))return imgs.get(imageId);
  const url=await imageURL(imageId);if(!url)return null;
  try{const im=await loadImg(url);imgs.set(imageId,im);return im;}catch(e){return null;}
}
function forgetImages(){
  for(const u of urls.values())URL.revokeObjectURL(u);
  urls.clear();imgs.clear();
}
async function importImage(file){
  if(!file||!/^image\//.test(file.type))throw new Error("画像ファイルを選んでください。");
  const src=URL.createObjectURL(file);
  try{
    const im=await loadImg(src);
    if(!im.naturalWidth||!im.naturalHeight)throw new Error("画像の大きさを読み取れませんでした。");
    const k=Math.min(1,1600/Math.max(im.naturalWidth,im.naturalHeight));
    const w=Math.max(1,Math.round(im.naturalWidth*k)),h=Math.max(1,Math.round(im.naturalHeight*k));
    const cv=document.createElement("canvas");cv.width=w;cv.height=h;
    cv.getContext("2d").drawImage(im,0,0,w,h);
    const type=/png|webp|gif|svg/.test(file.type)?"image/png":"image/jpeg"; // 透過の可能性がある形式はPNGで保持
    const blob=await new Promise(r=>cv.toBlob(r,type,0.9));
    if(!blob)throw new Error("画像を変換できませんでした。");
    const rec={id:C.uid("img"),projectId:S.project.id,type,w,h,buffer:await blob.arrayBuffer()};
    await guard(()=>DB.put("images",rec));
    if(navigator.storage&&navigator.storage.persist)navigator.storage.persist().catch(()=>{});
    return rec;
  }finally{URL.revokeObjectURL(src);}
}
/* 複製キャラと画像を共有していることがあるので、参照が残っていなければ消す */
async function releaseImage(imageId){
  if(!imageId)return;
  if(S.chars.some(c=>c.variants.some(v=>v.imageId===imageId)))return;
  await guard(()=>DB.del("images",imageId));
  const u=urls.get(imageId);if(u)URL.revokeObjectURL(u);
  urls.delete(imageId);imgs.delete(imageId);
}

/* ---------- 共通UI：シート・確認・入力 ---------- */
let sheetCount=0;
function sheet(opts){
  const wrap=document.createElement("div");
  wrap.className="st-sheet"+(opts.full?" full":"");
  wrap.setAttribute("role","dialog");wrap.setAttribute("aria-modal","true");wrap.setAttribute("aria-label",opts.title);
  wrap.innerHTML='<div class="st-sheet-box"><div class="st-sheet-head"><h3>'+esc(opts.title)+'</h3>'+
    '<button type="button" class="st-x" aria-label="閉じる">×</button></div><div class="st-sheet-body"></div></div>';
  const body=wrap.querySelector(".st-sheet-body");
  body.innerHTML=opts.html||"";
  const opener=document.activeElement;
  let closed=false;
  function close(result){
    if(closed)return;closed=true;
    wrap.remove();sheetCount--;
    if(sheetCount<=0){sheetCount=0;document.body.classList.remove("st-lock");}
    if(opener&&opener.focus&&document.contains(opener))opener.focus({preventScroll:true});
    if(opts.onClose)opts.onClose(result);
  }
  wrap.querySelector(".st-x").addEventListener("click",()=>close());
  wrap.addEventListener("click",e=>{if(e.target===wrap&&!opts.modal)close();});
  wrap.addEventListener("keydown",e=>{if(e.key==="Escape"){e.stopPropagation();close();}});
  document.body.appendChild(wrap);sheetCount++;document.body.classList.add("st-lock");
  wrap.querySelector(".st-x").focus({preventScroll:true});
  return {el:wrap,body,close,setTitle:t=>{wrap.querySelector("h3").textContent=t;}};
}
function confirmBox(message,opts){
  opts=opts||{};
  return new Promise(resolve=>{
    const s=sheet({title:opts.title||"確認",modal:true,onClose:r=>resolve(!!r),
      html:'<p class="st-msg">'+esc(message).replace(/\n/g,"<br>")+'</p><div class="st-actions end">'+
        '<button type="button" class="btn-sm" data-r="0">やめる</button>'+
        '<button type="button" class="btn-sm '+(opts.danger?"btn-danger":"copy")+'" data-r="1">'+esc(opts.ok||"OK")+'</button></div>'});
    s.body.querySelector('[data-r="0"]').addEventListener("click",()=>s.close(false));
    s.body.querySelector('[data-r="1"]').addEventListener("click",()=>s.close(true));
  });
}
function promptBox(title,value,opts){
  opts=opts||{};
  return new Promise(resolve=>{
    const s=sheet({title,modal:true,onClose:r=>resolve(r==null?null:r),
      html:(opts.note?'<p class="st-note">'+esc(opts.note)+'</p>':"")+
        '<input type="text" class="st-input" maxlength="80" value="'+esc(value||"")+'" placeholder="'+esc(opts.placeholder||"")+'" aria-label="'+esc(title)+'">'+
        (opts.extra||"")+
        '<div class="st-actions end"><button type="button" class="btn-sm" data-r="0">やめる</button>'+
        '<button type="button" class="btn-sm copy" data-r="1">'+esc(opts.ok||"決定")+'</button></div>'});
    const input=s.body.querySelector("input.st-input");
    const done=()=>s.close(opts.collect?opts.collect(s.body,input.value.trim()):input.value.trim());
    input.focus();input.select();
    input.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.isComposing)done();});
    s.body.querySelector('[data-r="0"]').addEventListener("click",()=>s.close(null));
    s.body.querySelector('[data-r="1"]').addEventListener("click",done);
  });
}
function download(blob,filename){
  const url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
}
/* PNGは画面に表示してから保存させる（iPhoneでは長押しで写真に保存できる） */
function showPng(canvas,filename,title){
  canvas.toBlob(blob=>{
    if(!blob){toast("画像を作れませんでした");return;}
    const url=URL.createObjectURL(blob);
    const s=sheet({title:title||"画像を保存",onClose:()=>URL.revokeObjectURL(url),
      html:'<p class="st-note">「ダウンロード」を押すか、画像を長押しして保存できます。</p>'+
        '<div class="st-png"><img alt="出力画像" src="'+url+'"></div>'+
        '<div class="st-actions end"><a class="btn-sm copy st-dl" href="'+url+'" download="'+esc(filename)+'">ダウンロード</a></div>'});
    s.el.dataset.png=filename;
  },"image/png");
}
function safeFileName(name){return String(name||"oc").replace(/[\\/:*?"<>|\s]+/g,"_").slice(0,40)||"oc";}
function stamp(){const d=new Date(),p=n=>String(n).padStart(2,"0");return d.getFullYear()+p(d.getMonth()+1)+p(d.getDate())+"-"+p(d.getHours())+p(d.getMinutes());}

/* ---------- タブ ---------- */
function showTab(key,opts){
  if(!TAB_KEYS.includes(key))key="create";
  S.tab=key;
  document.body.dataset.tab=key;
  for(const k of TAB_KEYS){
    const panel=$("tab-"+k),btn=document.querySelector('#studioTabs [data-tab="'+k+'"]');
    if(panel)panel.hidden=k!==key;
    if(btn){btn.setAttribute("aria-selected",String(k===key));btn.tabIndex=k===key?0:-1;}
  }
  if(!(opts&&opts.silent)){
    try{const u=new URL(location.href);u.hash=key==="create"?"":key;history.replaceState(null,"",u);}catch(e){}
    const bar=$("studioTabs");
    if(bar&&window.scrollY>bar.offsetTop-6)window.scrollTo(0,bar.offsetTop-6);
  }
  if(S.ready&&tabs[key]&&tabs[key].render)tabs[key].render();
}
function refresh(){if(S.ready&&tabs[S.tab]&&tabs[S.tab].render)tabs[S.tab].render();}
function initTabs(){
  const nav=$("studioTabs");
  nav.addEventListener("click",e=>{const b=e.target.closest("[data-tab]");if(b)showTab(b.dataset.tab);});
  nav.addEventListener("keydown",e=>{
    if(e.key!=="ArrowRight"&&e.key!=="ArrowLeft")return;
    const i=TAB_KEYS.indexOf(S.tab),n=TAB_KEYS[(i+(e.key==="ArrowRight"?1:TAB_KEYS.length-1))%TAB_KEYS.length];
    showTab(n);nav.querySelector('[data-tab="'+n+'"]').focus();
  });
  window.addEventListener("hashchange",()=>showTab(location.hash.slice(1),{silent:true}));
}

/* ---------- 作品 ---------- */
function renderProjectSelect(){
  const sel=$("projectSelect");
  sel.innerHTML=S.projects.map(p=>'<option value="'+esc(p.id)+'"'+(S.project&&p.id===S.project.id?" selected":"")+'>'+esc(p.name)+'</option>').join("");
}
async function openProject(id){
  await flush();
  const p=S.projects.find(x=>x.id===id)||S.projects[0];
  forgetImages();
  S.project=p;
  S.chars=(await DB.byProject("characters",p.id)).sort((a,b)=>a.createdAt-b.createdAt);
  C.repairProject(p,S.chars);
  try{localStorage.setItem(CURRENT_KEY,p.id);}catch(e){}
  renderProjectSelect();
  emit("project");
  refresh();
}
async function createProject(name,template){
  const p=C.newProject(name,template);
  await guard(()=>DB.put("projects",p));
  S.projects.push(p);await openProject(p.id);return p;
}
async function exportProject(){
  await flush();
  const images=await DB.byProject("images",S.project.id);
  const bundle=C.exportBundle(S.project,S.chars,images);
  download(new Blob([JSON.stringify(bundle)],{type:"application/json"}),"oc-project_"+safeFileName(S.project.name)+"_"+stamp()+".json");
  toast("バックアップを書き出しました");
}
async function importProjectFile(file,name){
  let data;
  try{data=JSON.parse(await file.text());}catch(e){throw new Error("JSONとして読み取れませんでした。");}
  const bundle=C.importBundle(data,name);
  if(S.projects.some(p=>p.name===bundle.project.name))bundle.project.name+="（復元）";
  await guard(()=>DB.putBundle(bundle));
  S.projects.push(bundle.project);
  await openProject(bundle.project.id);
  return bundle;
}
async function duplicateProject(){
  await flush();
  const images=await DB.byProject("images",S.project.id);
  const bundle=C.importBundle(C.exportBundle(S.project,S.chars,images),S.project.name+"（コピー）");
  await guard(()=>DB.putBundle(bundle));
  S.projects.push(bundle.project);await openProject(bundle.project.id);
  toast("作品を複製しました");
}
function legacySaved(){
  try{return typeof savedResults!=="undefined"&&Array.isArray(savedResults)?savedResults:[];}catch(e){return [];}
}
async function registerFromGacha(g,opts){
  if(!S.ready){toast("準備中です。少し待ってからもう一度押してください");return null;}
  if(g&&g.id&&S.chars.some(c=>c.origin&&c.origin.gachaId===String(g.id))){
    if(!(opts&&opts.quiet))toast("この作品の図鑑に登録済みです");return null;
  }
  let text="";
  try{text=typeof buildDetailText==="function"?buildDetailText(g):"";}catch(e){}
  const c=C.fromGacha(S.project.id,g,text);
  await guard(()=>DB.put("characters",c));
  S.chars.push(c);emit("chars");
  if(!(opts&&opts.quiet))toast("「"+S.project.name+"」の図鑑に登録しました");
  return c;
}
function openProjectMenu(){
  const legacy=legacySaved();
  const s=sheet({title:"作品の管理",html:
    '<p class="st-note">キャラ・身長比較・相関図・世界観・画像は、作品ごとにまとめて保存されます。</p>'+
    '<p class="st-current">いまの作品：<strong>'+esc(S.project.name)+'</strong>（キャラ '+S.chars.length+'人）</p>'+
    '<div class="st-menu">'+
      '<button type="button" data-a="new">＋ 新しい作品を作る</button>'+
      '<button type="button" data-a="rename">名前を変える</button>'+
      '<button type="button" data-a="dup">この作品を複製する</button>'+
      '<button type="button" data-a="export">バックアップを書き出す（画像つき）</button>'+
      '<button type="button" data-a="import">バックアップから復元する</button>'+
      (legacy.length?'<button type="button" data-a="legacy">保存リストの'+legacy.length+'件を図鑑へ取り込む</button>':"")+
      '<button type="button" data-a="delete" class="danger">この作品を削除する</button>'+
    '</div>'+
    '<input type="file" id="projectImportFile" accept="application/json,.json" hidden>'+
    '<p class="st-note" id="storageNote"></p>'});
  if(navigator.storage&&navigator.storage.estimate)navigator.storage.estimate().then(e=>{
    const n=s.body.querySelector("#storageNote");
    if(n&&e&&e.usage!=null)n.textContent="このサイトの使用量：約"+(e.usage/1048576).toFixed(1)+"MB。ブラウザのデータを消すと作品も消えるので、定期的にバックアップを書き出してください。";
  }).catch(()=>{});
  const file=s.body.querySelector("#projectImportFile");
  file.addEventListener("change",async()=>{
    const f=file.files[0];if(!f)return;
    try{const b=await importProjectFile(f);s.close();toast("「"+b.project.name+"」を復元しました（キャラ"+b.characters.length+"人・画像"+b.images.length+"枚）");}
    catch(e){toast(e.message||"復元できませんでした");}
    file.value="";
  });
  s.body.addEventListener("click",async e=>{
    const a=e.target.closest("[data-a]");if(!a)return;
    const act=a.dataset.a;
    if(act==="new"){
      const opt=Object.entries(C.TEMPLATES).map(([k,t])=>'<option value="'+k+'">'+esc(t.label)+'</option>').join("");
      const r=await promptBox("新しい作品","",{placeholder:"作品名",ok:"作る",
        extra:'<label class="st-field"><span>世界観テンプレート</span><select id="newPrjTpl">'+opt+'</select></label>',
        collect:(body,name)=>({name,template:body.querySelector("#newPrjTpl").value})});
      if(!r)return;
      await createProject(r.name||"新しい作品",r.template==="blank"?"":r.template);
      s.close();toast("作品を作りました");
    }else if(act==="rename"){
      const name=await promptBox("作品の名前を変える",S.project.name,{ok:"変更"});
      if(!name)return;
      S.project.name=name;saveProject();renderProjectSelect();
      s.body.querySelector(".st-current strong").textContent=name;toast("名前を変更しました");
    }else if(act==="dup"){await duplicateProject();s.close();}
    else if(act==="export"){await exportProject();}
    else if(act==="import"){file.click();}
    else if(act==="legacy"){
      let n=0;for(const g of legacy){if(await registerFromGacha(g,{quiet:true}))n++;}
      toast(n?n+"件を図鑑へ取り込みました（保存リストはそのまま残ります）":"すべて登録済みでした");
      if(n)refresh();
    }else if(act==="delete"){
      const ok=await confirmBox("作品「"+S.project.name+"」を削除します。\nキャラ"+S.chars.length+"人と、その画像・身長比較・相関図・世界観がすべて消えます。元に戻せません。",{ok:"削除する",danger:true,title:"作品の削除"});
      if(!ok)return;
      const id=S.project.id;
      await flush();
      await guard(()=>DB.deleteProject(id));
      S.projects=S.projects.filter(p=>p.id!==id);
      if(!S.projects.length){const p=C.newProject("マイ作品");await DB.put("projects",p);S.projects.push(p);}
      await openProject(S.projects[0].id);
      s.close();toast("作品を削除しました");
    }
  });
}

async function init(){
  initTabs();
  showTab(location.hash.slice(1),{silent:true});
  await DB.init();
  S.projects=(await DB.all("projects")).sort((a,b)=>a.createdAt-b.createdAt);
  if(!S.projects.length){const p=C.newProject("マイ作品");await DB.put("projects",p);S.projects.push(p);}
  let current=null;try{current=localStorage.getItem(CURRENT_KEY);}catch(e){}
  $("projectSelect").addEventListener("change",e=>openProject(e.target.value));
  $("projectMenuBtn").addEventListener("click",openProjectMenu);
  S.ready=true;
  await openProject(current);
  setStatus();
  if(!DB.isPersistent()){
    const n=$("studioNotice");
    if(n){n.hidden=false;n.textContent="この環境ではブラウザ保存が使えないため、図鑑などのデータはページを閉じると消えます（プライベートブラウズを解除すると保存できます）。";}
  }
  document.documentElement.dataset.studio="ready";
}

window.OCStudio={S,C,$,esc,on,emit,toast,copy,tabs,showTab,refresh,sheet,confirmBox,promptBox,download,showPng,safeFileName,stamp,
  saveProject,saveChar,flush,guard,imageURL,imageEl,importImage,releaseImage,registerFromGacha,init,
  putChar:c=>guard(()=>DB.put("characters",c)),delChar:id=>guard(()=>DB.del("characters",id))};
})();
