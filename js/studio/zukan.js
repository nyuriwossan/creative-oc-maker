/* 創作OCメーカー v2.0 — キャラ図鑑 */
(function(){
"use strict";
const A=window.OCStudio,C=A.C,S=A.S,esc=A.esc;
const KINDS=[["outfit","衣装"],["expression","表情"],["other","その他"]];
const PERSON_SVG='<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="22" r="11"/><path d="M12 60c0-13 9-22 20-22s20 9 20 22z"/></svg>';
const state={q:"",filter:"all",sort:"created"};

function panel(){return A.$("tab-zukan");}
function build(){
  const p=panel();if(p.dataset.built)return;
  p.dataset.built="1";
  p.innerHTML='<h2 class="st-h">キャラ図鑑</h2>'+
    '<p class="st-lead">作ったキャラを作品ごとに保管します。画像がなくても使えます。</p>'+
    '<div class="st-toolbar">'+
      '<input type="search" id="zkSearch" class="st-input" placeholder="名前・読み・メモ・差分名で検索" aria-label="キャラを検索">'+
      '<select id="zkFilter" aria-label="絞り込み"><option value="all">すべて</option><option value="img">画像あり</option><option value="noimg">画像なし</option><option value="noheight">身長が未設定</option></select>'+
      '<select id="zkSort" aria-label="並び順"><option value="created">登録順</option><option value="recent">更新が新しい順</option><option value="name">名前順</option><option value="height">身長順</option></select>'+
    '</div>'+
    '<div class="st-actions"><button type="button" class="btn-sm copy" id="zkNew">＋ 白紙から作る</button><span class="st-count" id="zkCount" role="status"></span></div>'+
    '<div id="zkGrid" class="zk-grid"></div>';
  A.$("zkSearch").addEventListener("input",e=>{state.q=e.target.value;renderGrid();});
  A.$("zkFilter").addEventListener("change",e=>{state.filter=e.target.value;renderGrid();});
  A.$("zkSort").addEventListener("change",e=>{state.sort=e.target.value;renderGrid();});
  A.$("zkNew").addEventListener("click",async()=>{
    const c=C.newCharacter(S.project.id,"");
    await A.putChar(c);S.chars.push(c);A.emit("chars");renderGrid();openChar(c.id);
  });
  A.$("zkGrid").addEventListener("click",e=>{const b=e.target.closest("[data-id]");if(b)openChar(b.dataset.id);});
}
function hasImage(c){return c.variants.some(v=>v.imageId);}
function visible(){
  let list=S.chars.filter(c=>C.matchesQuery(c,state.q));
  if(state.filter==="img")list=list.filter(hasImage);
  else if(state.filter==="noimg")list=list.filter(c=>!hasImage(c));
  else if(state.filter==="noheight")list=list.filter(c=>c.height==null);
  const name=c=>(c.reading||c.name||"");
  if(state.sort==="recent")list=list.slice().sort((a,b)=>b.updatedAt-a.updatedAt);
  else if(state.sort==="name")list=list.slice().sort((a,b)=>name(a).localeCompare(name(b),"ja"));
  else if(state.sort==="height")list=list.slice().sort((a,b)=>(b.height||0)-(a.height||0));
  return list;
}
function thumbHTML(c){
  const v=C.mainVariant(c),withImg=v&&v.imageId?v:c.variants.find(x=>x.imageId);
  return '<span class="zk-thumb"'+(withImg?' data-img="'+esc(withImg.imageId)+'"':"")+'>'+PERSON_SVG+'</span>';
}
function fillThumbs(root){
  root.querySelectorAll("[data-img]").forEach(el=>{
    A.imageURL(el.dataset.img).then(url=>{
      if(!url||!el.isConnected)return;
      el.innerHTML='<img alt="" src="'+url+'">';el.classList.add("has");
    });
  });
}
function renderGrid(){
  const grid=A.$("zkGrid");if(!grid)return;
  const list=visible();
  A.$("zkCount").textContent=S.chars.length?list.length+"人を表示（全"+S.chars.length+"人）":"";
  if(!S.chars.length){
    grid.innerHTML='<div class="empty-msg">まだキャラが登録されていません。<br>「作成」タブで生成したカードの「図鑑へ登録」を押すか、「白紙から作る」で追加できます。</div>';return;
  }
  if(!list.length){grid.innerHTML='<div class="empty-msg">条件に合うキャラがいません。</div>';return;}
  grid.innerHTML=list.map(c=>{
    const p=c.profile,meta=[p.age,p.occupation].filter(x=>String(x||"").trim()).join("・");
    const extra=c.variants.length>1?'<span class="zk-badge">差分'+c.variants.length+'</span>':"";
    return '<button type="button" class="zk-card" data-id="'+esc(c.id)+'">'+thumbHTML(c)+
      '<span class="zk-name">'+esc(C.displayName(c))+'</span>'+
      (c.reading?'<span class="zk-read">'+esc(c.reading)+'</span>':"")+
      '<span class="zk-meta">'+esc([c.height!=null?c.height+"cm":"",meta].filter(Boolean).join("／")||"設定はこれから")+'</span>'+extra+'</button>';
  }).join("");
  fillThumbs(grid);
}

/* ---------- 頭頂部・足元の指定 ---------- */
async function openCalibrator(c,v,onDone){
  const url=await A.imageURL(v.imageId);
  if(!url){A.toast("先に画像を登録してください");return;}
  let head=Math.min(v.headY,v.footY),foot=Math.max(v.headY,v.footY);
  const s=A.sheet({title:"頭と足元を合わせる",modal:true,html:
    '<p class="st-note">身長は「頭のてっぺん」から「足の裏」までで測ります。<b class="cal-c1">上の線</b>を頭頂部に、<b class="cal-c2">下の線</b>を足元に合わせてください。帽子・角・髪飾りは線の外にはみ出してかまいません。</p>'+
    '<div class="cal-wrap"><div class="cal-stage"><img alt="'+esc(C.displayName(c))+'の画像" src="'+url+'" draggable="false">'+
      '<div class="cal-line head" data-line="head" role="slider" tabindex="0" aria-label="頭頂部の位置" aria-valuemin="0" aria-valuemax="100"><span>頭頂部</span></div>'+
      '<div class="cal-line foot" data-line="foot" role="slider" tabindex="0" aria-label="足元の位置" aria-valuemin="0" aria-valuemax="100"><span>足元</span></div>'+
    '</div></div>'+
    '<div class="cal-nudge"><span>頭頂部</span><button type="button" class="btn-sm" data-n="head:-1" aria-label="頭頂部を上へ">▲</button><button type="button" class="btn-sm" data-n="head:1" aria-label="頭頂部を下へ">▼</button>'+
      '<span>足元</span><button type="button" class="btn-sm" data-n="foot:-1" aria-label="足元を上へ">▲</button><button type="button" class="btn-sm" data-n="foot:1" aria-label="足元を下へ">▼</button></div>'+
    '<div class="st-actions end"><button type="button" class="btn-sm" data-c="reset">画像の上下いっぱいに戻す</button><button type="button" class="btn-sm copy" data-c="ok">決定</button></div>'});
  const stage=s.body.querySelector(".cal-stage");
  const lines={head:s.body.querySelector(".cal-line.head"),foot:s.body.querySelector(".cal-line.foot")};
  const clamp=x=>Math.max(0,Math.min(1,x));
  function draw(){
    lines.head.style.top=(head*100)+"%";lines.foot.style.top=(foot*100)+"%";
    lines.head.setAttribute("aria-valuenow",Math.round(head*100));lines.foot.setAttribute("aria-valuenow",Math.round(foot*100));
  }
  function set(which,y){
    if(which==="head")head=clamp(Math.min(y,foot-0.03));else foot=clamp(Math.max(y,head+0.03));
    draw();
  }
  for(const which of ["head","foot"]){
    const el=lines[which];
    el.addEventListener("pointerdown",e=>{e.preventDefault();el.setPointerCapture(e.pointerId);el.classList.add("drag");});
    el.addEventListener("pointermove",e=>{
      if(!el.hasPointerCapture(e.pointerId))return;
      const r=stage.getBoundingClientRect();set(which,(e.clientY-r.top)/r.height);
    });
    const end=e=>{el.classList.remove("drag");try{el.releasePointerCapture(e.pointerId);}catch(_){}};
    el.addEventListener("pointerup",end);el.addEventListener("pointercancel",end);
    el.addEventListener("keydown",e=>{
      const d=e.key==="ArrowUp"?-1:e.key==="ArrowDown"?1:0;if(!d)return;
      e.preventDefault();set(which,(which==="head"?head:foot)+d*(e.shiftKey?0.02:0.005));
    });
  }
  s.body.addEventListener("click",e=>{
    const n=e.target.closest("[data-n]"),b=e.target.closest("[data-c]");
    if(n){const [w,d]=n.dataset.n.split(":");set(w,(w==="head"?head:foot)+Number(d)*0.005);}
    if(b&&b.dataset.c==="reset"){head=0;foot=1;draw();}
    if(b&&b.dataset.c==="ok"){v.headY=head;v.footY=foot;A.saveChar(c);s.close();A.toast("位置を保存しました");if(onDone)onDone();}
  });
  draw();
}

/* ---------- 詳細・編集 ---------- */
function field(label,key,value,opts){
  opts=opts||{};
  const attr='data-f="'+esc(key)+'" aria-label="'+esc(label)+'"'+(opts.placeholder?' placeholder="'+esc(opts.placeholder)+'"':"");
  return '<label class="st-field'+(opts.half?" half":"")+'"><span>'+esc(label)+'</span>'+
    (opts.area?'<textarea rows="'+(opts.rows||2)+'" '+attr+'>'+esc(value)+'</textarea>'
      :'<input type="text" '+(opts.mode?'inputmode="'+opts.mode+'" ':"")+attr+' value="'+esc(value)+'">')+'</label>';
}
function profileGroup(c,group,areas){
  return C.PROFILE_FIELDS.filter(f=>f[2]===group).map(f=>field(f[1],"p:"+f[0],c.profile[f[0]]||"",{area:areas.includes(f[0])||areas==="all",half:!(areas.includes(f[0])||areas==="all")})).join("");
}
function sec(title,html,open,id){
  return '<details class="cond st-sec"'+(open?" open":"")+(id?' id="'+id+'"':"")+'><summary>'+esc(title)+'</summary><div class="st-sec-body">'+html+'</div></details>';
}
function openChar(id){
  const c=S.chars.find(x=>x.id===id);if(!c)return;
  const s=A.sheet({title:C.displayName(c),full:true,onClose:()=>{renderGrid();A.refresh();},html:
    '<div class="st-actions zk-acts">'+
      '<button type="button" class="btn-sm copy" data-a="height">身長比較に追加</button>'+
      '<button type="button" class="btn-sm copy" data-a="relation">相関図に追加</button>'+
      '<button type="button" class="btn-sm" data-a="copy">設定をコピー</button>'+
      '<button type="button" class="btn-sm" data-a="dup">複製</button>'+
      '<button type="button" class="btn-sm btn-danger" data-a="delete">削除</button></div>'+
    sec("画像・差分（衣装や表情）",'<div id="zkVariants"></div><button type="button" class="btn-sm" data-a="addvar">＋ 差分を追加</button>',true)+
    sec("基本",
      field("名前","name",c.name,{placeholder:"例：佐伯 丞"})+field("読み","reading",c.reading,{half:true})+field("英字表記","roman",c.roman,{half:true})+
      field("コードネーム・異名","codename",c.codename,{half:true})+
      '<label class="st-field half"><span>身長（cm）</span><input type="text" inputmode="decimal" data-f="height" aria-label="身長（cm）" placeholder="例：165" value="'+esc(c.height==null?"":c.height)+'"><small id="zkHeightNote" class="st-hint"></small></label>'+
      profileGroup(c,"basic",[]),true)+
    sec("外見",profileGroup(c,"look","all"),false)+
    sec("人物像",profileGroup(c,"person",["personality","speech","secret"]),false)+
    sec("創作フック",profileGroup(c,"hook","all"),false)+
    sec("所属・関連（世界観とつなぐ）",'<div id="zkAff"></div>',false)+
    sec("独自項目",'<div id="zkCustom"></div><button type="button" class="btn-sm" data-a="addcustom">＋ 項目を追加</button>',false)+
    sec("メモ",'<textarea rows="4" data-f="memo" aria-label="メモ" placeholder="思いついたことを自由に。">'+esc(c.memo)+'</textarea>',true)+
    sec("補足（画像プロンプト・名前の由来）",profileGroup(c,"prompt","all")+
      (c.origin&&c.origin.detailText?'<details class="st-origin"><summary>生成したときの原文を見る</summary><pre>'+esc(c.origin.detailText)+'</pre></details>':""),false)});
  const body=s.body;
  s.el.dataset.char=c.id;

  function renderVariants(){
    const box=body.querySelector("#zkVariants");
    box.innerHTML=c.variants.map(v=>
      '<div class="zk-var" data-vid="'+esc(v.id)+'">'+
        '<span class="zk-thumb big"'+(v.imageId?' data-img="'+esc(v.imageId)+'"':"")+'>'+PERSON_SVG+'</span>'+
        '<div class="zk-var-main">'+
          '<div class="zk-var-row"><input type="text" data-v="label" aria-label="差分の名前" value="'+esc(v.label)+'" placeholder="例：制服／笑顔">'+
          '<select data-v="kind" aria-label="差分の種類">'+KINDS.map(k=>'<option value="'+k[0]+'"'+(v.kind===k[0]?" selected":"")+'>'+k[1]+'</option>').join("")+'</select></div>'+
          '<div class="st-actions">'+
            '<label class="btn-sm copy st-file">'+(v.imageId?"画像を変更":"画像を登録")+'<input type="file" accept="image/*" data-v="file"></label>'+
            (v.imageId?'<button type="button" class="btn-sm" data-v="calib">頭と足元を合わせる</button><button type="button" class="btn-sm" data-v="rmimg">画像を外す</button>':"")+
            (c.mainVariantId===v.id?'<span class="zk-badge on">メイン</span>':'<button type="button" class="btn-sm" data-v="main">メインにする</button>')+
            (c.variants.length>1?'<button type="button" class="btn-sm btn-danger" data-v="rmvar">差分を削除</button>':"")+
          '</div></div></div>').join("");
    fillThumbs(box);
  }
  function renderAff(){
    const box=body.querySelector("#zkAff");
    const groups=S.project.world.sections.map(sc=>({sc,list:sc.entries.filter(e=>e.title.trim())})).filter(g=>g.list.length);
    if(!groups.length){
      box.innerHTML='<p class="st-note">「世界観」タブで組織や地域を作ると、ここでキャラと紐付けられます。</p><button type="button" class="btn-sm" data-a="toworld">世界観タブを開く</button>';return;
    }
    box.innerHTML=groups.map(g=>'<p class="st-sub">'+esc(g.sc.title)+'</p><div class="chip-box st-chips">'+
      g.list.map(e=>{const onn=c.affiliations.includes(e.id);return '<button type="button" class="chip'+(onn?" on":"")+'" aria-pressed="'+onn+'" data-aff="'+esc(e.id)+'">'+esc(e.title)+'</button>';}).join("")+'</div>').join("");
  }
  function renderCustom(){
    const box=body.querySelector("#zkCustom");
    box.innerHTML=c.customFields.length?c.customFields.map(f=>
      '<div class="zk-custom" data-cid="'+esc(f.id)+'"><input type="text" data-cf="label" aria-label="項目名" placeholder="項目名（例：誕生日）" value="'+esc(f.label)+'">'+
      '<textarea rows="1" data-cf="value" aria-label="内容" placeholder="内容">'+esc(f.value)+'</textarea>'+
      '<button type="button" class="btn-sm btn-danger" data-cf="del" aria-label="この項目を削除">×</button></div>').join("")
      :'<p class="st-note">誕生日・血液型・武器など、好きな項目を足せます。</p>';
  }
  renderVariants();renderAff();renderCustom();

  body.addEventListener("input",e=>{
    const t=e.target;
    if(t.dataset.f){
      const k=t.dataset.f;
      if(k==="height"){
        const h=C.parseHeight(t.value);c.height=h;
        body.querySelector("#zkHeightNote").textContent=t.value.trim()&&h==null?"数字で入力してください（例：165）":"";
      }else if(k.startsWith("p:"))c.profile[k.slice(2)]=t.value;
      else c[k]=t.value;
      if(k==="name")s.setTitle(C.displayName(c));
      A.saveChar(c);
    }else if(t.dataset.v==="label"||t.dataset.v==="kind"){
      const v=c.variants.find(x=>x.id===t.closest("[data-vid]").dataset.vid);
      if(v){v[t.dataset.v]=t.value;A.saveChar(c);}
    }else if(t.dataset.cf==="label"||t.dataset.cf==="value"){
      const f=c.customFields.find(x=>x.id===t.closest("[data-cid]").dataset.cid);
      if(f){f[t.dataset.cf]=t.value;A.saveChar(c);}
    }
  });
  body.addEventListener("change",async e=>{
    const t=e.target;
    if(t.dataset.v!=="file")return;
    const v=c.variants.find(x=>x.id===t.closest("[data-vid]").dataset.vid),f=t.files[0];
    if(!v||!f)return;
    try{
      const rec=await A.importImage(f),old=v.imageId;
      v.imageId=rec.id;v.headY=0.04;v.footY=0.97;
      await A.putChar(c);await A.releaseImage(old);
      renderVariants();A.toast("画像を登録しました。「頭と足元を合わせる」で身長比較の精度が上がります");
    }catch(err){A.toast(err.message||"画像を登録できませんでした");}
    t.value="";
  });
  body.addEventListener("click",async e=>{
    const vb=e.target.closest("button[data-v]"),ab=e.target.closest("[data-a]"),aff=e.target.closest("[data-aff]"),cf=e.target.closest('button[data-cf="del"]');
    if(vb){
      const v=c.variants.find(x=>x.id===vb.closest("[data-vid]").dataset.vid);if(!v)return;
      const act=vb.dataset.v;
      if(act==="calib")openCalibrator(c,v);
      else if(act==="main"){c.mainVariantId=v.id;A.saveChar(c);renderVariants();}
      else if(act==="rmimg"){
        if(!(await A.confirmBox("この差分の画像を外します。よろしいですか？",{ok:"外す",danger:true})))return;
        const old=v.imageId;v.imageId=null;await A.putChar(c);await A.releaseImage(old);renderVariants();
      }else if(act==="rmvar"){
        if(!(await A.confirmBox("差分「"+v.label+"」を削除します。"+(v.imageId?"登録した画像も消えます。":""),{ok:"削除する",danger:true})))return;
        c.variants=c.variants.filter(x=>x.id!==v.id);
        if(c.mainVariantId===v.id)c.mainVariantId=c.variants[0].id;
        for(const it of S.project.heightCompare.items)if(it.variantId===v.id)it.variantId=null;
        A.saveProject();await A.putChar(c);await A.releaseImage(v.imageId);renderVariants();
      }
      return;
    }
    if(aff){
      const eid=aff.dataset.aff,i=c.affiliations.indexOf(eid);
      if(i>=0)c.affiliations.splice(i,1);else c.affiliations.push(eid);
      A.saveChar(c);renderAff();return;
    }
    if(cf){c.customFields=c.customFields.filter(x=>x.id!==cf.closest("[data-cid]").dataset.cid);A.saveChar(c);renderCustom();return;}
    if(!ab)return;
    const act=ab.dataset.a;
    if(act==="addvar"){c.variants.push(C.newVariant("差分"+c.variants.length,"outfit"));A.saveChar(c);renderVariants();}
    else if(act==="addcustom"){c.customFields.push({id:C.uid("cf"),label:"",value:""});A.saveChar(c);renderCustom();}
    else if(act==="copy")A.copy(C.characterToText(c,S.project.world),"設定をコピーしました");
    else if(act==="height"){addToHeight(c.id);}
    else if(act==="relation"){await A.flush();s.close();A.tabs.relation.addChar(c.id);A.showTab("relation");}
    else if(act==="toworld"){s.close();A.showTab("world");}
    else if(act==="dup"){
      await A.flush();
      const d=C.duplicateCharacter(c);await A.putChar(d);S.chars.push(d);A.emit("chars");
      s.close();A.toast("複製しました");openChar(d.id);
    }else if(act==="delete"){
      if(await deleteChar(c.id))s.close();
    }
  });
}
function addToHeight(charId){
  const items=S.project.heightCompare.items;
  if(items.some(i=>i.charId===charId)){A.toast("身長比較に追加済みです");return false;}
  items.push({charId,variantId:null});A.saveProject();A.toast("身長比較に追加しました");return true;
}
async function deleteChar(charId){
  const c=S.chars.find(x=>x.id===charId);if(!c)return false;
  const im=C.deleteImpact(S.project,charId),notes=[];
  if(im.heightCompare)notes.push("・身長比較から外れます");
  if(im.charts.length)notes.push("・相関図「"+im.charts.join("」「")+"」から外れます"+(im.edges?"（関係線"+im.edges+"本も消えます）":""));
  if(c.variants.some(v=>v.imageId))notes.push("・登録した画像も消えます");
  const ok=await A.confirmBox("「"+C.displayName(c)+"」を図鑑から削除します。"+(notes.length?"\n\n"+notes.join("\n"):"")+"\n\n元に戻せません。",{ok:"削除する",danger:true,title:"キャラの削除"});
  if(!ok)return false;
  await A.flush();
  C.removeCharacterRefs(S.project,charId);A.saveProject();
  S.chars.splice(S.chars.indexOf(c),1);
  await A.delChar(charId);
  for(const v of c.variants)await A.releaseImage(v.imageId);
  A.emit("chars");A.toast("削除しました");return true;
}

A.tabs.zukan={render(){build();renderGrid();},openChar,openCalibrator,addToHeight,deleteChar,PERSON_SVG};
A.on("project",()=>{state.q="";const q=A.$("zkSearch");if(q)q.value="";});
})();
