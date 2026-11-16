/* 創作OCメーカー v2.0 — 世界観設定 */
(function(){
"use strict";
const A=window.OCStudio,C=A.C,S=A.S,esc=A.esc;
const OVERVIEW=[["title","作品名",false],["genre","ジャンル",false],["era","時代",false],["stage","舞台",false],["summary","概要・コンセプト",true]];
const openSecs=new Set(["overview"]),openEnts=new Set();
let query="";

function panel(){return A.$("tab-world");}
function world(){return S.project.world;}
function def(sec){return C.SECTION_DEFS.find(d=>d.key===sec.key)||{hint:"自由に項目を作れます",kinds:[]};}
function isEmpty(){
  const w=world();
  return !w.template&&w.sections.every(s=>!s.entries.length)&&Object.values(w.overview).every(v=>!String(v||"").trim());
}
function build(){
  const p=panel();if(p.dataset.built)return;
  p.dataset.built="1";
  p.innerHTML='<h2 class="st-h">世界観設定</h2>'+
    '<p class="st-lead">物語の舞台をカテゴリごとに書きためます。全部埋めなくて大丈夫。書いた組織や地域はキャラと紐付けられます。</p>'+
    '<div class="st-actions"><button type="button" class="btn-sm" id="wdTpl">テンプレートから項目を足す</button>'+
      '<button type="button" class="btn-sm copy" id="wdCopy">世界観をテキストでコピー</button></div>'+
    '<input type="search" id="wdSearch" class="st-input" placeholder="世界観の中を検索（名前・本文・種別）" aria-label="世界観の中を検索">'+
    '<div id="wdStart"></div><div id="wdBody"></div>'+
    '<div class="st-actions"><button type="button" class="btn-sm" id="wdAddSec">＋ 独自カテゴリを追加</button></div>';
  A.$("wdSearch").addEventListener("input",e=>{query=e.target.value;renderBody();});
  A.$("wdTpl").addEventListener("click",openTemplates);
  A.$("wdCopy").addEventListener("click",()=>A.copy(C.worldToText(world(),S.chars),"世界観をコピーしました"));
  A.$("wdAddSec").addEventListener("click",async()=>{
    const name=await A.promptBox("独自カテゴリを追加","",{placeholder:"例：料理／乗り物／怪異",ok:"追加"});
    if(!name)return;
    const sec={id:C.uid("sec"),key:"custom",title:name,custom:true,entries:[]};
    world().sections.push(sec);openSecs.add(sec.id);A.saveProject();renderBody();
  });
  A.$("wdStart").addEventListener("click",e=>{const b=e.target.closest("[data-tpl]");if(b)useTemplate(b.dataset.tpl);});
  const body=A.$("wdBody");
  body.addEventListener("toggle",e=>{
    const d=e.target;if(!(d instanceof HTMLDetailsElement))return;
    const set=d.dataset.sec?openSecs:d.dataset.eid?openEnts:null,key=d.dataset.sec||d.dataset.eid;
    if(set){if(d.open)set.add(key);else set.delete(key);}
  },true);
  body.addEventListener("input",e=>{
    const t=e.target;
    if(t.dataset.o){world().overview[t.dataset.o]=t.value;A.saveProject();return;}
    if(!t.dataset.k)return;
    const found=findEntry(t.closest("[data-eid]").dataset.eid);if(!found)return;
    found.entry[t.dataset.k]=t.value;A.saveProject();
    const sum=t.closest("[data-eid]").querySelector(".wd-sum");if(sum)sum.innerHTML=summaryHTML(found.section,found.entry);
  });
  body.addEventListener("click",onClick);
}
function findEntry(id){return C.allEntries(world()).find(x=>x.entry.id===id);}
function summaryHTML(sec,e){
  return (e.when?'<span class="wd-when">'+esc(e.when)+'</span>':"")+'<span class="wd-title">'+esc(e.title||"（無題）")+'</span>'+
    (e.reading?'<span class="wd-read">'+esc(e.reading)+'</span>':"")+(e.kind?'<span class="zk-badge">'+esc(e.kind)+'</span>':"");
}
function matches(e){
  const q=query.normalize("NFKC").toLowerCase().trim();if(!q)return true;
  return [e.title,e.body,e.kind,e.reading,e.when].join("\n").normalize("NFKC").toLowerCase().includes(q);
}
function entryHTML(sec,e,i,n){
  const d=def(sec),members=S.chars.filter(c=>c.affiliations.includes(e.id)).length;
  return '<details class="wd-entry" data-eid="'+esc(e.id)+'"'+(openEnts.has(e.id)||query.trim()?" open":"")+'>'+
    '<summary><span class="wd-sum">'+summaryHTML(sec,e)+'</span>'+(members?'<span class="wd-mem">'+members+'人</span>':"")+'</summary>'+
    '<div class="wd-body">'+
      '<label class="st-field"><span>名前・タイトル</span><input type="text" data-k="title" value="'+esc(e.title)+'" placeholder="例：'+esc((d.kinds[0]||"項目")+"の名前")+'"></label>'+
      '<label class="st-field half"><span>種別</span><input type="text" data-k="kind" list="wdKinds-'+esc(sec.id)+'" value="'+esc(e.kind)+'" placeholder="'+esc(d.kinds.join("／")||"自由入力")+'"></label>'+
      (sec.key==="history"?'<label class="st-field half"><span>年代・時期</span><input type="text" data-k="when" value="'+esc(e.when)+'" placeholder="例：王暦312年／10年前"></label>':"")+
      (sec.key==="glossary"?'<label class="st-field half"><span>読み</span><input type="text" data-k="reading" value="'+esc(e.reading)+'" placeholder="よみがな"></label>':"")+
      '<label class="st-field"><span>説明</span><textarea rows="3" data-k="body" placeholder="'+esc(e.hint||"自由に書いてください。")+'">'+esc(e.body)+'</textarea></label>'+
      '<p class="st-sub">関連キャラ</p>'+
      (S.chars.length?'<div class="chip-box st-chips">'+S.chars.map(c=>{const on=c.affiliations.includes(e.id);
        return '<button type="button" class="chip'+(on?" on":"")+'" aria-pressed="'+on+'" data-link="'+esc(c.id)+'">'+esc(C.displayName(c))+'</button>';}).join("")+'</div>'
        :'<p class="st-note">キャラ図鑑に登録すると、ここで紐付けられます。</p>')+
      '<div class="st-actions end">'+
        '<button type="button" class="btn-sm" data-w="up" aria-label="上へ移動"'+(i===0?" disabled":"")+'>↑</button>'+
        '<button type="button" class="btn-sm" data-w="down" aria-label="下へ移動"'+(i===n-1?" disabled":"")+'>↓</button>'+
        '<button type="button" class="btn-sm btn-danger" data-w="delentry">この項目を削除</button></div>'+
    '</div></details>';
}
function renderStart(){
  const box=A.$("wdStart");
  if(!isEmpty()){box.innerHTML="";return;}
  box.innerHTML='<div class="wd-start"><p class="st-sub">はじめに：テンプレートを選ぶ</p>'+
    '<p class="st-note">書き出しのヒントになる項目が入ります。あとから自由に変更・削除でき、ジャンルが混ざってもかまいません。</p><div class="wd-tpls">'+
    Object.entries(C.TEMPLATES).map(([k,t])=>'<button type="button" class="wd-tpl" data-tpl="'+k+'"><strong>'+esc(t.label)+'</strong><small>'+esc(t.note)+'</small></button>').join("")+'</div></div>';
}
function renderBody(){
  const w=world(),q=query.trim();
  let html="";
  if(!q){
    html+='<details class="cond st-sec" data-sec="overview"'+(openSecs.has("overview")?" open":"")+'><summary>世界の概要</summary><div class="st-sec-body">'+
      OVERVIEW.map(([k,l,area])=>'<label class="st-field'+(area?"":" half")+'"><span>'+l+'</span>'+
        (area?'<textarea rows="3" data-o="'+k+'" placeholder="どんな物語の舞台か、ひとことで。">'+esc(w.overview[k]||"")+'</textarea>'
          :'<input type="text" data-o="'+k+'" value="'+esc(w.overview[k]||"")+'"'+(k==="title"?' placeholder="'+esc(S.project.name)+'"':"")+'>')+'</label>').join("")+'</div></details>';
  }
  let hits=0;
  for(const sec of w.sections){
    const d=def(sec),list=sec.entries.map((e,i)=>({e,i})).filter(x=>matches(x.e));
    hits+=list.length;
    if(q&&!list.length)continue;
    html+='<details class="cond st-sec" data-sec="'+esc(sec.id)+'"'+(openSecs.has(sec.id)||q?" open":"")+'>'+
      '<summary>'+esc(sec.title)+'<span class="sel">'+(sec.entries.length?sec.entries.length+"件":"未記入")+'</span></summary><div class="st-sec-body">'+
      '<p class="st-note">'+esc(d.hint)+'</p>'+
      '<datalist id="wdKinds-'+esc(sec.id)+'">'+d.kinds.map(k=>'<option value="'+esc(k)+'">').join("")+'</datalist>'+
      list.map(x=>entryHTML(sec,x.e,x.i,sec.entries.length)).join("")+
      (q?"":'<div class="st-actions"><button type="button" class="btn-sm copy" data-w="addentry">＋ 項目を追加</button>'+
        (sec.custom?'<button type="button" class="btn-sm" data-w="rensec">カテゴリ名を変える</button><button type="button" class="btn-sm btn-danger" data-w="delsec">カテゴリを削除</button>':"")+'</div>')+
      '</div></details>';
  }
  if(q&&!hits)html='<div class="empty-msg">「'+esc(q)+'」に合う項目はありません。</div>';
  A.$("wdBody").innerHTML=html;
  renderStart();
}
async function onClick(e){
  const link=e.target.closest("[data-link]"),b=e.target.closest("button[data-w]");
  if(link){
    const eid=link.closest("[data-eid]").dataset.eid,c=S.chars.find(x=>x.id===link.dataset.link);if(!c)return;
    const i=c.affiliations.indexOf(eid);
    if(i>=0)c.affiliations.splice(i,1);else c.affiliations.push(eid);
    A.saveChar(c);
    const on=i<0;link.classList.toggle("on",on);link.setAttribute("aria-pressed",String(on));
    const det=link.closest("[data-eid]"),n=S.chars.filter(x=>x.affiliations.includes(eid)).length;
    let mem=det.querySelector(".wd-mem");
    if(n){if(!mem){mem=document.createElement("span");mem.className="wd-mem";det.querySelector("summary").appendChild(mem);}mem.textContent=n+"人";}
    else if(mem)mem.remove();
    return;
  }
  if(!b)return;
  const act=b.dataset.w,w=world(),sec=w.sections.find(s=>s.id===b.closest("[data-sec]").dataset.sec);if(!sec)return;
  if(act==="addentry"){
    const en=C.newEntry("","","");sec.entries.push(en);openEnts.add(en.id);openSecs.add(sec.id);
    A.saveProject();renderBody();
    const inp=A.$("wdBody").querySelector('[data-eid="'+en.id+'"] [data-k="title"]');if(inp)inp.focus();
    return;
  }
  if(act==="rensec"){
    const name=await A.promptBox("カテゴリ名を変える",sec.title,{ok:"変更"});if(!name)return;
    sec.title=name;
  }else if(act==="delsec"){
    const linked=S.chars.filter(c=>sec.entries.some(en=>c.affiliations.includes(en.id))).length;
    if(!(await A.confirmBox("カテゴリ「"+sec.title+"」と中の"+sec.entries.length+"件を削除します。"+(linked?"\n"+linked+"人のキャラとの紐付けも外れます。":""),{ok:"削除する",danger:true})))return;
    C.removeEntryRefs(S.chars,sec.entries.map(en=>en.id)).forEach(A.saveChar);
    w.sections=w.sections.filter(s=>s.id!==sec.id);
  }else{
    const eid=b.closest("[data-eid]").dataset.eid,i=sec.entries.findIndex(en=>en.id===eid);if(i<0)return;
    if(act==="up"&&i>0)[sec.entries[i-1],sec.entries[i]]=[sec.entries[i],sec.entries[i-1]];
    else if(act==="down"&&i<sec.entries.length-1)[sec.entries[i+1],sec.entries[i]]=[sec.entries[i],sec.entries[i+1]];
    else if(act==="delentry"){
      const en=sec.entries[i],linked=S.chars.filter(c=>c.affiliations.includes(en.id)).length;
      if((en.title.trim()||en.body.trim()||linked)&&!(await A.confirmBox("「"+(en.title||"（無題）")+"」を削除します。"+(linked?"\n"+linked+"人のキャラとの紐付けも外れます。":""),{ok:"削除する",danger:true})))return;
      C.removeEntryRefs(S.chars,[en.id]).forEach(A.saveChar);
      sec.entries.splice(i,1);
    }else return;
  }
  A.saveProject();renderBody();
}
function useTemplate(key){
  const w=world(),n=C.applyTemplate(w,key);
  w.sections.forEach(s=>{if(s.entries.length)openSecs.add(s.id);});
  A.saveProject();renderBody();
  A.toast(key==="blank"?"白紙で始めます":n?C.TEMPLATES[key].label+"の項目を"+n+"件足しました":"足す項目はありませんでした");
}
function openTemplates(){
  const s=A.sheet({title:"テンプレートから項目を足す",html:
    '<p class="st-note">いま書いてある内容は変えません。足りない項目だけを追加します。複数のジャンルを重ねてもかまいません。</p><div class="wd-tpls">'+
    Object.entries(C.TEMPLATES).filter(([k])=>k!=="blank").map(([k,t])=>'<button type="button" class="wd-tpl" data-tpl="'+k+'"><strong>'+esc(t.label)+'</strong><small>'+esc(t.note)+'</small></button>').join("")+'</div>'});
  s.body.addEventListener("click",e=>{const b=e.target.closest("[data-tpl]");if(b){s.close();useTemplate(b.dataset.tpl);}});
}
A.tabs.world={render(){build();renderBody();}};
A.on("project",()=>{query="";const q=A.$("wdSearch");if(q)q.value="";openSecs.clear();openSecs.add("overview");openEnts.clear();});
})();
