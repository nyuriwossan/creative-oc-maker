/* 創作OCメーカー v2.0 — 相関図 */
(function(){
"use strict";
const A=window.OCStudio,C=A.C,S=A.S,esc=A.esc;
const R=34;
const FONT='"Hiragino Kaku Gothic ProN","Hiragino Sans","Yu Gothic","Noto Sans JP",sans-serif';
const SERIF='"Hiragino Mincho ProN","Yu Mincho","Noto Serif JP",serif';
const DASH={solid:[],dashed:[10,7],dotted:[1,7]};
const DIRS=[["one","→ 一方通行"],["both","↔ 双方向"],["none","― 向きなし"]];
const STYLES=[["solid","実線"],["dashed","破線"],["dotted","点線"]];
const BG=["#FFFFFF","#F7F5F0","#EEF3F8","#2D2A33"];
const st={mode:"move",linkFrom:null,selected:null,labels:[],imgs:new Map(),size:{w:320,h:380}};
const pointers=new Map();let gesture=null,token=0;

function panel(){return A.$("tab-relation");}
function charts(){return S.project.charts;}
function chart(){
  const list=charts();
  if(!list.length){list.push(C.newChart("相関図1"));A.saveProject();}
  let ch=list.find(c=>c.id===S.project.currentChartId);
  if(!ch){ch=list[0];S.project.currentChartId=ch.id;}
  if(!ch.view)ch.view={x:st.size.w/2,y:st.size.h/2,k:1};
  return ch;
}
function charOf(id){return S.chars.find(c=>c.id===id);}
function nameOf(id){const c=charOf(id);return c?C.displayName(c):"（削除済み）";}
function isDark(hex){const n=parseInt(String(hex||"#ffffff").slice(1),16);return (((n>>16)&255)*299+((n>>8)&255)*587+(n&255)*114)/1000<128;}

function build(){
  const p=panel();if(p.dataset.built)return;
  p.dataset.built="1";
  p.innerHTML='<h2 class="st-h">相関図</h2>'+
    '<p class="st-lead">図鑑のキャラを置いて、関係を線でつなぎます。名前を変えると図にも反映されます。</p>'+
    '<div class="st-toolbar"><select id="rlChart" aria-label="相関図を選ぶ"></select><button type="button" class="btn-sm" id="rlChartMenu">図の管理</button></div>'+
    '<div class="st-actions">'+
      '<button type="button" class="btn-sm copy" id="rlAdd">人物を追加</button>'+
      '<span class="st-seg" role="group" aria-label="操作モード"><button type="button" data-mode="move" aria-pressed="true">動かす</button><button type="button" data-mode="link" aria-pressed="false">線を引く</button></span>'+
      '<button type="button" class="btn-sm" id="rlNewEdge">＋ 関係を追加</button>'+
      '<button type="button" class="btn-sm save" id="rlPng">PNGで保存</button></div>'+
    '<div class="rl-stage" id="rlStage"><canvas id="rlCanvas" role="img" aria-label="相関図"></canvas>'+
      '<p class="rl-guide" id="rlGuide" role="status" aria-live="polite"></p>'+
      '<div class="rl-zoom"><button type="button" data-z="in" aria-label="拡大">＋</button><button type="button" data-z="out" aria-label="縮小">－</button><button type="button" data-z="fit" aria-label="全体を表示">全体</button></div></div>'+
    '<div class="rl-sel" id="rlSel"></div>'+
    '<h3 class="st-h3">関係の一覧</h3><div id="rlEdges" class="rl-edges"></div>';
  A.$("rlChart").addEventListener("change",e=>{S.project.currentChartId=e.target.value;A.saveProject();st.selected=st.linkFrom=null;render();});
  A.$("rlChartMenu").addEventListener("click",openChartMenu);
  A.$("rlAdd").addEventListener("click",openPicker);
  A.$("rlNewEdge").addEventListener("click",()=>{
    const ch=chart();
    if(ch.nodes.length<2){A.toast("先に人物を2人以上追加してください");return;}
    openEdge(C.newEdge(st.selected||ch.nodes[0].charId,ch.nodes.find(n=>n.charId!==(st.selected||ch.nodes[0].charId)).charId,"friend"),true);
  });
  A.$("rlPng").addEventListener("click",exportPng);
  p.querySelector(".st-seg").addEventListener("click",e=>{const b=e.target.closest("[data-mode]");if(b)setMode(b.dataset.mode);});
  p.querySelector(".rl-zoom").addEventListener("click",e=>{
    const b=e.target.closest("[data-z]");if(!b)return;
    if(b.dataset.z==="fit")fit();else zoomAt(st.size.w/2,st.size.h/2,b.dataset.z==="in"?1.25:0.8);
    A.saveProject();paint();
  });
  A.$("rlSel").addEventListener("click",async e=>{
    const b=e.target.closest("[data-s]");if(!b||!st.selected)return;
    const id=st.selected;
    if(b.dataset.s==="link"){st.linkFrom=id;setMode("link");}
    else if(b.dataset.s==="open")A.tabs.zukan.openChar(id);
    else if(b.dataset.s==="remove"){if(await removeNodes([id])){st.selected=null;render();}}
  });
  A.$("rlEdges").addEventListener("click",e=>{
    const b=e.target.closest("[data-edge]");if(!b)return;
    const ed=chart().edges.find(x=>x.id===b.dataset.edge);if(ed)openEdge(ed,false);
  });
  bindCanvas();
  window.addEventListener("resize",()=>{if(S.tab==="relation"){resize();paint();}});
}
function setMode(mode){
  st.mode=mode;if(mode==="move")st.linkFrom=null;
  panel().querySelectorAll(".st-seg [data-mode]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.mode===mode)));
  guide();paint();
}
function guide(){
  const ch=chart(),g=A.$("rlGuide");
  g.textContent=!ch.nodes.length?"「人物を追加」から、図に置くキャラを選んでください。"
    :st.mode==="link"?(st.linkFrom?"「"+nameOf(st.linkFrom)+"」から線を引きます。相手をタップしてください。":"1人目をタップ → 2人目をタップで線を引きます。")
    :"人物をドラッグで配置。ラベルをタップで編集。余白ドラッグで全体を移動。";
}

/* ---------- 描画 ---------- */
function rr(ctx,x,y,w,h,r){
  ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();
}
function arrow(ctx,p,angle,color){
  ctx.save();ctx.translate(p.x,p.y);ctx.rotate(angle);ctx.fillStyle=color;
  ctx.beginPath();ctx.moveTo(1,0);ctx.lineTo(-13,6.5);ctx.lineTo(-10,0);ctx.lineTo(-13,-6.5);ctx.closePath();ctx.fill();ctx.restore();
}
function drawChart(ctx,ch,view,W,H,o){
  const dark=isDark(ch.bg),ink=dark?"#FFFFFF":"#2D2A33",labels=[];
  ctx.save();
  ctx.fillStyle=ch.bg||"#FFFFFF";ctx.fillRect(0,0,W,H);
  ctx.translate(view.x,view.y);ctx.scale(view.k,view.k);
  const pos=new Map(ch.nodes.map(n=>[n.charId,n])),offs=C.edgeOffsets(ch.edges,44),curves=[];
  for(const e of ch.edges){
    const a=pos.get(e.from),b=pos.get(e.to);if(!a||!b)continue;
    const cp=C.curvePoints(a,b,offs.get(e.id)||0,R+8);
    ctx.strokeStyle=e.color;ctx.lineWidth=2.6;ctx.lineCap="round";ctx.setLineDash(DASH[e.style]||[]);
    ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.quadraticCurveTo(cp.control.x,cp.control.y,b.x,b.y);ctx.stroke();ctx.setLineDash([]);
    curves.push({e,cp});
  }
  for(const n of ch.nodes){
    const c=charOf(n.charId),img=o.imgs.get(n.charId);
    const hot=!o.exporting&&(st.linkFrom===n.charId||st.selected===n.charId);
    ctx.beginPath();ctx.arc(n.x,n.y,R+3,0,Math.PI*2);ctx.fillStyle=ch.bg||"#FFFFFF";ctx.fill();
    ctx.beginPath();ctx.arc(n.x,n.y,R,0,Math.PI*2);ctx.fillStyle="#EEEBF7";ctx.fill();
    if(img){
      const v=c&&C.mainVariant(c),w=img.naturalWidth,h=img.naturalHeight,s=Math.min(w,h*0.46);
      const sy=Math.max(0,Math.min(h-s,(v?Math.min(v.headY,v.footY):0)*h-s*0.06));
      ctx.save();ctx.beginPath();ctx.arc(n.x,n.y,R,0,Math.PI*2);ctx.clip();
      ctx.drawImage(img,(w-s)/2,sy,s,s,n.x-R,n.y-R,R*2,R*2);ctx.restore();
    }else{
      ctx.fillStyle="#5A4B8B";ctx.font="600 26px "+SERIF;ctx.textAlign="center";ctx.textBaseline="middle";
      ctx.fillText(Array.from(c?C.displayName(c).replace(/^（/,""):"？")[0]||"？",n.x,n.y+1);
    }
    ctx.beginPath();ctx.arc(n.x,n.y,R,0,Math.PI*2);
    ctx.strokeStyle=hot?"#8E4257":(dark?"rgba(255,255,255,.75)":"#5A4B8B");ctx.lineWidth=hot?4.5:2;ctx.stroke();
  }
  for(const {e,cp} of curves){
    if(e.dir!=="none")arrow(ctx,cp.end,cp.endAngle,e.color);
    if(e.dir==="both")arrow(ctx,cp.start,cp.startAngle,e.color);
  }
  ctx.textAlign="center";ctx.textBaseline="middle";
  for(const n of ch.nodes){
    const name=nameOf(n.charId);
    ctx.font="600 13px "+FONT;
    const w=Math.min(150,ctx.measureText(name).width)+12;
    ctx.fillStyle=dark?"rgba(45,42,51,.82)":"rgba(255,255,255,.9)";rr(ctx,n.x-w/2,n.y+R+5,w,20,6);ctx.fill();
    ctx.fillStyle=ink;ctx.fillText(name,n.x,n.y+R+15.5,150);
  }
  for(const {e,cp} of curves){
    const text=C.edgeLabel(e);
    ctx.font="600 12px "+FONT;
    const w=ctx.measureText(text).width+16,h=22,x=cp.mid.x-w/2,y=cp.mid.y-h/2;
    ctx.fillStyle="#FFFFFF";rr(ctx,x,y,w,h,11);ctx.fill();
    ctx.strokeStyle=e.color;ctx.lineWidth=1.6;rr(ctx,x,y,w,h,11);ctx.stroke();
    ctx.fillStyle=e.color;ctx.fillText(text,cp.mid.x,cp.mid.y+0.5);
    labels.push({id:e.id,x,y,w,h});
  }
  ctx.restore();
  return labels;
}
async function prepare(ch){
  const my=++token,map=new Map();
  for(const n of ch.nodes){
    const c=charOf(n.charId),v=c&&(C.mainVariant(c).imageId?C.mainVariant(c):c.variants.find(x=>x.imageId));
    map.set(n.charId,v&&v.imageId?await A.imageEl(v.imageId):null);
  }
  if(my===token)st.imgs=map;
  return map;
}
function resize(){
  const stage=A.$("rlStage"),cv=A.$("rlCanvas");if(!stage||!stage.clientWidth)return;
  const w=stage.clientWidth,h=Math.round(Math.max(340,Math.min(560,window.innerHeight*0.56)));
  st.size={w,h};
  const dpr=Math.min(3,window.devicePixelRatio||1);
  cv.style.width=w+"px";cv.style.height=h+"px";cv.width=Math.round(w*dpr);cv.height=Math.round(h*dpr);
}
function paint(){
  const cv=A.$("rlCanvas");if(!cv||!cv.width)return;
  const ch=chart(),dpr=cv.width/st.size.w,ctx=cv.getContext("2d");
  ctx.setTransform(dpr,0,0,dpr,0,0);
  st.labels=drawChart(ctx,ch,ch.view,st.size.w,st.size.h,{imgs:st.imgs});
  cv.setAttribute("aria-label","相関図「"+ch.name+"」："+ch.nodes.length+"人、関係"+ch.edges.length+"本。詳細は下の一覧を参照。");
}
function bounds(ch){
  if(!ch.nodes.length)return null;
  let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
  const grow=(x,y,m,mb)=>{x0=Math.min(x0,x-m);x1=Math.max(x1,x+m);y0=Math.min(y0,y-m);y1=Math.max(y1,y+(mb||m));};
  const pos=new Map(ch.nodes.map(n=>[n.charId,n])),offs=C.edgeOffsets(ch.edges,44);
  for(const n of ch.nodes)grow(n.x,n.y,R+44,R+34);
  for(const e of ch.edges){const a=pos.get(e.from),b=pos.get(e.to);if(a&&b){const m=C.curvePoints(a,b,offs.get(e.id)||0,R).mid;grow(m.x,m.y,60,20);}}
  return {x:x0,y:y0,w:x1-x0,h:y1-y0};
}
function fit(){
  const ch=chart(),b=bounds(ch);
  if(!b){ch.view={x:st.size.w/2,y:st.size.h/2,k:1};return;}
  const k=Math.max(0.3,Math.min(1.4,Math.min(st.size.w/b.w,st.size.h/b.h)));
  ch.view={k,x:st.size.w/2-(b.x+b.w/2)*k,y:st.size.h/2-(b.y+b.h/2)*k};
}
function zoomAt(sx,sy,f){
  const v=chart().view,k=Math.max(0.3,Math.min(2.5,v.k*f)),wx=(sx-v.x)/v.k,wy=(sy-v.y)/v.k;
  v.k=k;v.x=sx-wx*k;v.y=sy-wy*k;
}

/* ---------- ポインター操作（マウス・タッチ共通） ---------- */
function toWorld(sx,sy){const v=chart().view;return {x:(sx-v.x)/v.k,y:(sy-v.y)/v.k};}
function hit(sx,sy){
  const ch=chart(),p=toWorld(sx,sy);
  for(const l of st.labels)if(p.x>=l.x-4&&p.x<=l.x+l.w+4&&p.y>=l.y-6&&p.y<=l.y+l.h+6)return {edge:l.id};
  for(let i=ch.nodes.length-1;i>=0;i--){const n=ch.nodes[i];if(Math.hypot(p.x-n.x,p.y-n.y)<=R+8)return {node:n};}
  return {};
}
function bindCanvas(){
  const cv=A.$("rlCanvas");
  const local=e=>{const r=cv.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};};
  cv.addEventListener("pointerdown",e=>{
    if(e.button>0)return;
    cv.setPointerCapture(e.pointerId);
    const p=local(e);pointers.set(e.pointerId,p);
    if(pointers.size===2){
      const [a,b]=[...pointers.values()],v=chart().view;
      gesture={type:"pinch",dist:Math.hypot(a.x-b.x,a.y-b.y)||1,k:v.k,moved:true};
    }else if(pointers.size===1){
      const h=hit(p.x,p.y),v=chart().view;
      gesture={type:h.node&&st.mode==="move"?"node":"pan",hit:h,sx:p.x,sy:p.y,moved:false,
        ox:h.node?h.node.x:v.x,oy:h.node?h.node.y:v.y};
    }
  });
  cv.addEventListener("pointermove",e=>{
    if(!pointers.has(e.pointerId)||!gesture)return;
    const p=local(e),prev=pointers.get(e.pointerId);pointers.set(e.pointerId,p);
    const v=chart().view;
    if(gesture.type==="pinch"&&pointers.size>=2){
      const [a,b]=[...pointers.values()],d=Math.hypot(a.x-b.x,a.y-b.y)||1;
      v.x+=(p.x-prev.x)/2;v.y+=(p.y-prev.y)/2;
      zoomAt((a.x+b.x)/2,(a.y+b.y)/2,(gesture.k*d/gesture.dist)/v.k);
      paint();return;
    }
    const dx=p.x-gesture.sx,dy=p.y-gesture.sy;
    if(!gesture.moved&&Math.hypot(dx,dy)<6)return;
    gesture.moved=true;
    if(gesture.type==="node"){gesture.hit.node.x=gesture.ox+dx/v.k;gesture.hit.node.y=gesture.oy+dy/v.k;}
    else if(gesture.type==="pan"){v.x=gesture.ox+dx;v.y=gesture.oy+dy;}
    paint();
  });
  const up=e=>{
    if(!pointers.has(e.pointerId))return;
    pointers.delete(e.pointerId);
    try{cv.releasePointerCapture(e.pointerId);}catch(_){}
    const g=gesture;
    if(pointers.size>0){if(g&&g.type==="pinch"&&pointers.size===1){const [q]=[...pointers.values()],v=chart().view;gesture={type:"pan",hit:{},sx:q.x,sy:q.y,moved:true,ox:v.x,oy:v.y};}return;}
    gesture=null;
    if(!g)return;
    if(g.moved){A.saveProject();return;}
    if(e.type==="pointercancel")return;
    tap(g.hit);
  };
  cv.addEventListener("pointerup",up);cv.addEventListener("pointercancel",up);
  cv.addEventListener("wheel",e=>{
    if(!e.ctrlKey&&!e.metaKey)return;
    e.preventDefault();const p=local(e);zoomAt(p.x,p.y,e.deltaY<0?1.1:0.9);A.saveProject();paint();
  },{passive:false});
}
function tap(h){
  const ch=chart();
  if(h.edge){const ed=ch.edges.find(x=>x.id===h.edge);if(ed)openEdge(ed,false);return;}
  if(h.node){
    const id=h.node.charId;
    if(st.mode==="link"){
      if(!st.linkFrom)st.linkFrom=id;
      else if(st.linkFrom===id)st.linkFrom=null;
      else{const from=st.linkFrom;st.linkFrom=null;openEdge(C.newEdge(from,id,"friend"),true);}
    }else st.selected=st.selected===id?null:id;
  }else{st.selected=null;st.linkFrom=null;}
  guide();renderSel();paint();
}

/* ---------- 関係の編集 ---------- */
function openEdge(edge,isNew){
  const ch=chart(),w=C.clone(edge);
  const opts=sel=>ch.nodes.map(n=>'<option value="'+esc(n.charId)+'"'+(n.charId===sel?" selected":"")+'>'+esc(nameOf(n.charId))+'</option>').join("");
  const s=A.sheet({title:isNew?"関係を追加":"関係を編集",html:
    '<div class="rl-pair"><select data-e="from" aria-label="誰から">'+opts(w.from)+'</select>'+
      '<button type="button" class="btn-sm" data-e="swap" aria-label="向きを入れ替える">⇄</button>'+
      '<select data-e="to" aria-label="誰へ">'+opts(w.to)+'</select></div>'+
    '<p class="st-sub">分類</p><div class="chip-box st-chips" id="rlTypes"></div>'+
    '<label class="st-field"><span>ラベル（自由入力・空欄なら分類名）</span><input type="text" data-e="label" maxlength="30" value="'+esc(w.label)+'" placeholder="例：幼なじみ／片想い／師匠"></label>'+
    '<p class="st-sub">向き</p><div class="chip-box st-chips" id="rlDirs"></div>'+
    '<p class="st-sub">線の種類</p><div class="chip-box st-chips" id="rlStyles"></div>'+
    '<p class="st-sub">線の色</p><div class="hc-bg" id="rlColors"></div>'+
    '<div class="st-actions end">'+(isNew?"":'<button type="button" class="btn-sm btn-danger" data-e="delete">この関係を削除</button>')+
      '<button type="button" class="btn-sm" data-e="cancel">やめる</button><button type="button" class="btn-sm copy" data-e="save">'+(isNew?"追加する":"保存")+'</button></div>'});
  const b=s.body;
  function chips(){
    b.querySelector("#rlTypes").innerHTML=C.RELATION_TYPES.map(t=>'<button type="button" class="chip'+(w.type===t.key?" on":"")+'" aria-pressed="'+(w.type===t.key)+'" data-type="'+t.key+'">'+esc(t.label)+'</button>').join("");
    b.querySelector("#rlDirs").innerHTML=DIRS.map(d=>'<button type="button" class="chip'+(w.dir===d[0]?" on":"")+'" aria-pressed="'+(w.dir===d[0])+'" data-dir="'+d[0]+'">'+d[1]+'</button>').join("");
    b.querySelector("#rlStyles").innerHTML=STYLES.map(d=>'<button type="button" class="chip'+(w.style===d[0]?" on":"")+'" aria-pressed="'+(w.style===d[0])+'" data-style="'+d[0]+'">'+d[1]+'</button>').join("");
    b.querySelector("#rlColors").innerHTML=C.RELATION_TYPES.map(t=>'<button type="button" class="hc-sw'+(w.color.toUpperCase()===t.color?" on":"")+'" data-color="'+t.color+'" style="background:'+t.color+'" aria-label="'+esc(t.label)+'の色"></button>').join("")+
      '<input type="color" data-e="color" value="'+esc(w.color)+'" aria-label="線の色を自由に選ぶ">';
    b.querySelector('[data-e="label"]').placeholder="例："+C.relationType(w.type).label;
  }
  chips();
  b.addEventListener("input",e=>{
    const k=e.target.dataset.e;
    if(k==="label")w.label=e.target.value;
    else if(k==="from"||k==="to")w[k]=e.target.value;
    else if(k==="color"){w.color=e.target.value;}
  });
  b.addEventListener("click",e=>{
    const t=e.target.closest("button");if(!t)return;
    if(t.dataset.type){const prev=C.relationType(w.type);if(w.color.toUpperCase()===prev.color)w.color=C.relationType(t.dataset.type).color;w.type=t.dataset.type;chips();}
    else if(t.dataset.dir){w.dir=t.dataset.dir;chips();}
    else if(t.dataset.style){w.style=t.dataset.style;chips();}
    else if(t.dataset.color){w.color=t.dataset.color;chips();}
    else if(t.dataset.e==="swap"){[w.from,w.to]=[w.to,w.from];b.querySelector('[data-e="from"]').value=w.from;b.querySelector('[data-e="to"]').value=w.to;}
    else if(t.dataset.e==="cancel")s.close();
    else if(t.dataset.e==="delete"){ch.edges=ch.edges.filter(x=>x.id!==edge.id);A.saveProject();s.close();render();A.toast("関係を削除しました");}
    else if(t.dataset.e==="save"){
      if(w.from===w.to){A.toast("別々の人物を選んでください");return;}
      w.label=w.label.trim();
      if(isNew)ch.edges.push(w);else Object.assign(edge,w);
      A.saveProject();s.close();render();A.toast(isNew?"関係を追加しました":"関係を保存しました");
    }
  });
}
function renderEdges(){
  const ch=chart(),box=A.$("rlEdges");
  if(!ch.edges.length){box.innerHTML='<div class="empty-msg">まだ関係がありません。「線を引く」で2人を順にタップするか、「＋ 関係を追加」を押してください。</div>';return;}
  const mark={one:"→",both:"↔",none:"―"};
  box.innerHTML=ch.edges.map(e=>'<button type="button" class="rl-edge" data-edge="'+esc(e.id)+'">'+
    '<span class="rl-dot" style="background:'+esc(e.color)+'"></span>'+
    '<span class="rl-who">'+esc(nameOf(e.from))+' '+mark[e.dir]+' '+esc(nameOf(e.to))+'</span>'+
    '<span class="rl-lab" style="color:'+esc(e.color)+'">'+esc(C.edgeLabel(e))+'</span></button>').join("");
}
function renderSel(){
  const box=A.$("rlSel");
  if(!st.selected||!chart().nodes.some(n=>n.charId===st.selected)){box.innerHTML="";st.selected=null;return;}
  box.innerHTML='<span class="rl-sel-name">'+esc(nameOf(st.selected))+'</span>'+
    '<button type="button" class="btn-sm copy" data-s="link">ここから線を引く</button>'+
    '<button type="button" class="btn-sm" data-s="open">図鑑で開く</button>'+
    '<button type="button" class="btn-sm btn-danger" data-s="remove">図から外す</button>';
}

/* ---------- 人物の追加・削除 ---------- */
function place(ch){
  const v=ch.view,cx=(st.size.w/2-v.x)/v.k,cy=(st.size.h/2-v.y)/v.k;
  for(let i=0;i<400;i++){
    const r=i===0?0:95*Math.sqrt(i),a=i*2.4,x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r;
    if(!ch.nodes.some(n=>Math.hypot(n.x-x,n.y-y)<R*2+38))return {x,y};
  }
  return {x:cx,y:cy};
}
function addChar(charId){
  const ch=chart();
  if(ch.nodes.some(n=>n.charId===charId)){A.toast("この相関図に追加済みです");return false;}
  if(!charOf(charId))return false;
  const p=place(ch);ch.nodes.push({charId,x:p.x,y:p.y});
  A.saveProject();A.toast("相関図「"+ch.name+"」に追加しました");return true;
}
async function removeNodes(ids){
  const ch=chart(),set=new Set(ids),lost=ch.edges.filter(e=>set.has(e.from)||set.has(e.to)).length;
  if(lost&&!(await A.confirmBox("図から外すと、その人物につながる関係線"+lost+"本も消えます。よろしいですか？\n（図鑑のキャラは消えません）",{ok:"外す",danger:true})))return false;
  ch.nodes=ch.nodes.filter(n=>!set.has(n.charId));
  ch.edges=ch.edges.filter(e=>!set.has(e.from)&&!set.has(e.to));
  A.saveProject();return true;
}
function openPicker(){
  if(!S.chars.length){A.toast("先にキャラ図鑑へキャラを登録してください");return;}
  const ch=chart(),chosen=new Set(ch.nodes.map(n=>n.charId));
  const s=A.sheet({title:"相関図に置く人物",html:
    '<input type="search" class="st-input" id="rlPickQ" placeholder="名前で検索" aria-label="名前で検索">'+
    '<div class="st-picklist" id="rlPickList"></div>'+
    '<div class="st-actions end"><button type="button" class="btn-sm" data-p="all">全員</button><button type="button" class="btn-sm copy" data-p="ok">決定</button></div>'});
  const box=s.body.querySelector("#rlPickList"),q=s.body.querySelector("#rlPickQ");
  const draw=()=>{box.innerHTML=S.chars.filter(c=>C.matchesQuery(c,q.value)).map(c=>
    '<label class="st-pick"><input type="checkbox" value="'+esc(c.id)+'"'+(chosen.has(c.id)?" checked":"")+'><span>'+esc(C.displayName(c))+'</span></label>').join("")||'<p class="st-note">見つかりません。</p>';};
  draw();q.addEventListener("input",draw);
  box.addEventListener("change",e=>{if(e.target.checked)chosen.add(e.target.value);else chosen.delete(e.target.value);});
  s.body.addEventListener("click",async e=>{
    const b=e.target.closest("[data-p]");if(!b)return;
    if(b.dataset.p==="all"){S.chars.forEach(c=>chosen.add(c.id));draw();return;}
    const gone=ch.nodes.filter(n=>!chosen.has(n.charId)).map(n=>n.charId);
    if(gone.length&&!(await removeNodes(gone)))return;
    for(const c of S.chars)if(chosen.has(c.id)&&!ch.nodes.some(n=>n.charId===c.id)){const p=place(ch);ch.nodes.push({charId:c.id,x:p.x,y:p.y});}
    A.saveProject();s.close();render();
  });
}
function openChartMenu(){
  const ch=chart();
  const s=A.sheet({title:"相関図の管理",html:
    '<p class="st-current">いまの図：<strong>'+esc(ch.name)+'</strong>（'+ch.nodes.length+'人・関係'+ch.edges.length+'本）</p>'+
    '<div class="st-menu"><button type="button" data-a="new">＋ 新しい相関図を作る</button><button type="button" data-a="rename">名前を変える</button>'+
    '<button type="button" data-a="dup">この図を複製する</button><button type="button" data-a="delete" class="danger">この図を削除する</button></div>'+
    '<p class="st-sub">背景色</p><div class="hc-bg">'+BG.map(c=>'<button type="button" class="hc-sw'+(c===(ch.bg||"#FFFFFF").toUpperCase()?" on":"")+'" data-bg="'+c+'" style="background:'+c+'" aria-label="背景色 '+c+'"></button>').join("")+'</div>'});
  s.body.addEventListener("click",async e=>{
    const t=e.target.closest("button");if(!t)return;
    if(t.dataset.bg){ch.bg=t.dataset.bg;A.saveProject();s.close();render();return;}
    const act=t.dataset.a;
    if(act==="new"){
      const name=await A.promptBox("新しい相関図","",{placeholder:"例：第1章の関係",ok:"作る"});if(name==null)return;
      const n=C.newChart(name||"相関図"+(charts().length+1));charts().push(n);S.project.currentChartId=n.id;
    }else if(act==="rename"){
      const name=await A.promptBox("相関図の名前を変える",ch.name,{ok:"変更"});if(!name)return;ch.name=name;
    }else if(act==="dup"){
      const n=C.clone(ch);n.id=C.uid("cht");n.name=ch.name+"（コピー）";n.edges.forEach(x=>{x.id=C.uid("edg");});
      charts().push(n);S.project.currentChartId=n.id;
    }else if(act==="delete"){
      if(!(await A.confirmBox("相関図「"+ch.name+"」を削除します。配置と関係線が消えます（図鑑のキャラは消えません）。",{ok:"削除する",danger:true})))return;
      S.project.charts=charts().filter(x=>x.id!==ch.id);S.project.currentChartId=null;
    }else return;
    st.selected=st.linkFrom=null;A.saveProject();s.close();render();
  });
}
async function exportPng(){
  const ch=chart(),b=bounds(ch);
  if(!b){A.toast("先に人物を追加してください");return;}
  const imgs=await prepare(ch),pad=28,head=44,W=Math.max(320,b.w+pad*2),H=b.h+pad*2+head;
  let k=2;if(W*k*H*k>12000000)k=1;
  const cv=document.createElement("canvas");cv.width=Math.round(W*k);cv.height=Math.round(H*k);
  const ctx=cv.getContext("2d");ctx.setTransform(k,0,0,k,0,0);
  drawChart(ctx,ch,{k:1,x:pad-b.x+(W-pad*2-b.w)/2,y:pad+head-b.y},W,H,{imgs,exporting:true});
  ctx.fillStyle=isDark(ch.bg)?"#FFFFFF":"#463A70";ctx.font="600 17px "+SERIF;ctx.textAlign="left";ctx.textBaseline="middle";
  ctx.fillText(ch.name,pad,pad+8,W-pad*2);
  A.showPng(cv,"relation_"+A.safeFileName(ch.name)+"_"+A.stamp()+".png","相関図を保存");
}
async function render(){
  build();
  const ch=chart(),sel=A.$("rlChart");
  sel.innerHTML=charts().map(c=>'<option value="'+esc(c.id)+'"'+(c.id===ch.id?" selected":"")+'>'+esc(c.name)+'</option>').join("");
  resize();guide();renderSel();renderEdges();
  paint();await prepare(ch);paint();
}
A.tabs.relation={render,addChar,debug:()=>({chart:chart(),labels:st.labels,size:st.size,mode:st.mode})};
A.on("project",()=>{st.selected=st.linkFrom=null;st.imgs=new Map();});
})();
