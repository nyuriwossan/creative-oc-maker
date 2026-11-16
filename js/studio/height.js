/* 創作OCメーカー v2.0 — 身長比較 */
(function(){
"use strict";
const A=window.OCStudio,C=A.C,S=A.S,esc=A.esc;
const BG_PRESETS=["#F7F5F0","#FFFFFF","#EEF3F8","#F6ECEF","#2D2A33"];
const STAGE_H=380;
let last=null,token=0;

function panel(){return A.$("tab-height");}
function hc(){return S.project.heightCompare;}
function build(){
  const p=panel();if(p.dataset.built)return;
  p.dataset.built="1";
  p.innerHTML='<h2 class="st-h">身長比較</h2>'+
    '<p class="st-lead">図鑑のキャラを同じ縮尺で並べます。立ち絵がなくても仮のシルエットで比べられます。</p>'+
    '<div class="st-actions">'+
      '<button type="button" class="btn-sm copy" id="hcPick">キャラを選ぶ</button>'+
      '<button type="button" class="btn-sm" id="hcAsc">低い順に並べる</button>'+
      '<button type="button" class="btn-sm" id="hcDesc">高い順に並べる</button>'+
      '<button type="button" class="btn-sm save" id="hcPng">PNGで保存</button></div>'+
    '<div class="st-toolbar hc-opts">'+
      '<span class="hc-bg" id="hcBg" role="group" aria-label="背景色"></span>'+
      '<label class="st-check"><input type="checkbox" id="hcScale">目盛り</label>'+
      '<label class="st-check"><input type="checkbox" id="hcNames">名前</label></div>'+
    '<div class="hc-scroll" id="hcScroll" tabindex="0" aria-label="身長比較の図（横にスクロールできます）"><canvas id="hcCanvas" role="img" aria-label="身長比較の図"></canvas></div>'+
    '<p class="st-note" id="hcHint"></p>'+
    '<div id="hcList" class="hc-list"></div>';
  A.$("hcPick").addEventListener("click",openPicker);
  A.$("hcAsc").addEventListener("click",()=>sortItems(false));
  A.$("hcDesc").addEventListener("click",()=>sortItems(true));
  A.$("hcPng").addEventListener("click",exportPng);
  A.$("hcScale").addEventListener("change",e=>{hc().showScale=e.target.checked;A.saveProject();redraw();});
  A.$("hcNames").addEventListener("change",e=>{hc().showNames=e.target.checked;A.saveProject();redraw();});
  A.$("hcBg").addEventListener("click",e=>{const b=e.target.closest("[data-bg]");if(b)setBg(b.dataset.bg);});
  A.$("hcBg").addEventListener("input",e=>{if(e.target.id==="hcBgCustom")setBg(e.target.value);});
  const list=A.$("hcList");
  list.addEventListener("click",e=>{
    const b=e.target.closest("button[data-h]");if(!b)return;
    const items=hc().items,i=Number(b.closest("[data-i]").dataset.i),act=b.dataset.h;
    if(act==="left"&&i>0){[items[i-1],items[i]]=[items[i],items[i-1]];}
    else if(act==="right"&&i<items.length-1){[items[i+1],items[i]]=[items[i],items[i+1]];}
    else if(act==="remove"){items.splice(i,1);}
    else if(act==="calib"){
      const c=S.chars.find(x=>x.id===items[i].charId),v=c&&pickVariant(c,items[i]);
      if(c&&v)A.tabs.zukan.openCalibrator(c,v,redraw);return;
    }else if(act==="open"){A.tabs.zukan.openChar(items[i].charId);return;}
    else return;
    A.saveProject();renderList();redraw();
    const again=list.querySelector('[data-i="'+(act==="left"?i-1:act==="right"?i+1:-1)+'"] [data-h="'+act+'"]');
    if(again)again.focus({preventScroll:true});
  });
  list.addEventListener("input",e=>{
    const t=e.target,row=t.closest("[data-i]");if(!row)return;
    const it=hc().items[Number(row.dataset.i)],c=S.chars.find(x=>x.id===it.charId);if(!c)return;
    if(t.dataset.h==="cm"){c.height=C.parseHeight(t.value);A.saveChar(c);redraw();}
    else if(t.dataset.h==="variant"){it.variantId=t.value||null;A.saveProject();renderList();redraw();}
  });
  window.addEventListener("resize",()=>{if(S.tab==="height")redraw();});
}
/* 表示する差分：選んだ差分に画像があればそれ、無ければメイン、それも無ければ画像のある差分 */
function pickVariant(c,it){
  const chosen=c.variants.find(x=>x.id===it.variantId),main=C.mainVariant(c);
  if(chosen&&chosen.imageId)return chosen;
  if(main&&main.imageId)return main;
  return c.variants.find(x=>x.imageId)||main;
}
function setBg(color){
  if(!/^#[0-9a-fA-F]{6}$/.test(color))return;
  hc().bg=color;A.saveProject();renderBg();redraw();
}
function renderBg(){
  const cur=hc().bg.toUpperCase();
  A.$("hcBg").innerHTML='<span class="hc-bg-label">背景</span>'+BG_PRESETS.map(c=>
    '<button type="button" class="hc-sw'+(c===cur?" on":"")+'" data-bg="'+c+'" style="background:'+c+'" aria-label="背景色 '+c+'" aria-pressed="'+(c===cur)+'"></button>').join("")+
    '<input type="color" id="hcBgCustom" value="'+esc(hc().bg)+'" aria-label="背景色を自由に選ぶ">';
}
function sortItems(desc){
  if(hc().items.length<2){A.toast("2人以上選ぶと並べ替えできます");return;}
  hc().items=C.sortByHeight(hc().items,S.chars,desc);
  A.saveProject();renderList();redraw();A.toast(desc?"高い順に並べました":"低い順に並べました");
}
function openPicker(){
  if(!S.chars.length){A.toast("先にキャラ図鑑へキャラを登録してください");return;}
  const chosen=new Set(hc().items.map(i=>i.charId));
  const s=A.sheet({title:"身長比較に並べるキャラ",html:
    '<input type="search" class="st-input" id="hcPickQ" placeholder="名前で検索" aria-label="名前で検索">'+
    '<div class="st-picklist" id="hcPickList"></div>'+
    '<div class="st-actions end"><button type="button" class="btn-sm" data-p="all">全員</button><button type="button" class="btn-sm" data-p="none">外す</button><button type="button" class="btn-sm copy" data-p="ok">決定</button></div>'});
  const box=s.body.querySelector("#hcPickList");
  function draw(q){
    box.innerHTML=S.chars.filter(c=>C.matchesQuery(c,q)).map(c=>
      '<label class="st-pick"><input type="checkbox" value="'+esc(c.id)+'"'+(chosen.has(c.id)?" checked":"")+'><span>'+esc(C.displayName(c))+'</span><small>'+(c.height!=null?c.height+"cm":"身長未設定")+'</small></label>').join("")||'<p class="st-note">見つかりません。</p>';
  }
  draw("");
  s.body.querySelector("#hcPickQ").addEventListener("input",e=>draw(e.target.value));
  box.addEventListener("change",e=>{if(e.target.checked)chosen.add(e.target.value);else chosen.delete(e.target.value);});
  s.body.addEventListener("click",e=>{
    const b=e.target.closest("[data-p]");if(!b)return;
    if(b.dataset.p==="all"){S.chars.forEach(c=>chosen.add(c.id));draw(s.body.querySelector("#hcPickQ").value);}
    else if(b.dataset.p==="none"){chosen.clear();draw(s.body.querySelector("#hcPickQ").value);}
    else{
      const items=hc().items.filter(i=>chosen.has(i.charId));
      for(const c of S.chars)if(chosen.has(c.id)&&!items.some(i=>i.charId===c.id))items.push({charId:c.id,variantId:null});
      hc().items=items;A.saveProject();s.close();render();
    }
  });
}
function renderList(){
  const box=A.$("hcList"),items=hc().items;
  if(!items.length){box.innerHTML='<div class="empty-msg">「キャラを選ぶ」から、並べたいキャラを選んでください。</div>';return;}
  box.innerHTML=items.map((it,i)=>{
    const c=S.chars.find(x=>x.id===it.charId);if(!c)return "";
    const v=pickVariant(c,it),withImg=c.variants.filter(x=>x.imageId);
    return '<div class="hc-row" data-i="'+i+'">'+
      '<div class="hc-move"><button type="button" class="btn-sm" data-h="left" aria-label="'+esc(C.displayName(c))+'を左へ"'+(i===0?" disabled":"")+'>◀</button>'+
      '<button type="button" class="btn-sm" data-h="right" aria-label="'+esc(C.displayName(c))+'を右へ"'+(i===items.length-1?" disabled":"")+'>▶</button></div>'+
      '<button type="button" class="hc-name" data-h="open">'+esc(C.displayName(c))+'</button>'+
      '<label class="hc-cm"><input type="text" inputmode="decimal" data-h="cm" value="'+esc(c.height==null?"":c.height)+'" placeholder="'+C.ASSUMED_HEIGHT+'" aria-label="'+esc(C.displayName(c))+'の身長（cm）"><span>cm</span></label>'+
      (withImg.length>1?'<select data-h="variant" aria-label="表示する差分">'+withImg.map(x=>'<option value="'+esc(x.id)+'"'+(x.id===v.id?" selected":"")+'>'+esc(x.label||"差分")+'</option>').join("")+'</select>':"")+
      (v&&v.imageId?'<button type="button" class="btn-sm" data-h="calib">頭と足元</button>':"")+
      '<button type="button" class="btn-sm btn-danger" data-h="remove" aria-label="'+esc(C.displayName(c))+'を外す">×</button></div>';
  }).join("");
}

/* ---------- レイアウトと描画 ---------- */
async function compute(minW){
  const h=hc(),rows=[];
  for(const it of h.items){
    const c=S.chars.find(x=>x.id===it.charId);if(!c)continue;
    const v=pickVariant(c,it);
    const img=v&&v.imageId?await A.imageEl(v.imageId):null;
    rows.push({c,v,img,cm:c.height!=null?c.height:C.ASSUMED_HEIGHT,assumed:c.height==null});
  }
  const maxCm=C.scaleMax(rows.map(r=>r.cm)),ppc=STAGE_H/maxCm;
  let maxAbove=STAGE_H;
  for(const r of rows){
    r.hpx=r.cm*ppc;
    if(r.img){
      r.pl=C.imagePlacement(r.img.naturalWidth,r.img.naturalHeight,r.v.headY,r.v.footY,r.cm,ppc);
      r.w=r.pl.width;maxAbove=Math.max(maxAbove,r.pl.above);
    }else r.w=r.hpx*0.4;
    r.col=Math.max(r.w,78)+22;
  }
  const padTop=Math.min(240,Math.max(26,maxAbove-STAGE_H+14)),axisW=h.showScale?46:12,labelH=h.showNames?50:16;
  const content=rows.reduce((n,r)=>n+r.col,0),inner=Math.max(content,(minW||0)-axisW-16);
  let x=axisW+8+(inner-content)/2;
  for(const r of rows){r.cx=x+r.col/2;x+=r.col;}
  return {rows,maxCm,ppc,padTop,axisW,labelH,ground:padTop+STAGE_H,width:axisW+16+inner,height:padTop+STAGE_H+labelH,bg:h.bg,showScale:h.showScale,showNames:h.showNames};
}
function isDark(hex){
  const n=parseInt(hex.slice(1),16),r=n>>16,g=(n>>8)&255,b=n&255;
  return (r*299+g*587+b*114)/1000<128;
}
function silhouette(ctx,cx,ground,h){
  const top=ground-h,u=h;
  ctx.beginPath();
  ctx.arc(cx,top+u*0.068,u*0.068,0,Math.PI*2);                               // 頭
  ctx.moveTo(cx-u*0.03,top+u*0.13);
  ctx.lineTo(cx-u*0.125,top+u*0.17);ctx.quadraticCurveTo(cx-u*0.16,top+u*0.19,cx-u*0.165,top+u*0.24); // 肩
  ctx.lineTo(cx-u*0.19,top+u*0.5);ctx.lineTo(cx-u*0.15,top+u*0.5);ctx.lineTo(cx-u*0.115,top+u*0.27); // 腕
  ctx.lineTo(cx-u*0.105,top+u*0.53);                                                                  // 腰
  ctx.lineTo(cx-u*0.11,ground);ctx.lineTo(cx-u*0.03,ground);ctx.lineTo(cx-u*0.01,top+u*0.56);        // 脚
  ctx.lineTo(cx+u*0.01,top+u*0.56);ctx.lineTo(cx+u*0.03,ground);ctx.lineTo(cx+u*0.11,ground);
  ctx.lineTo(cx+u*0.105,top+u*0.53);ctx.lineTo(cx+u*0.115,top+u*0.27);
  ctx.lineTo(cx+u*0.15,top+u*0.5);ctx.lineTo(cx+u*0.19,top+u*0.5);
  ctx.lineTo(cx+u*0.165,top+u*0.24);ctx.quadraticCurveTo(cx+u*0.16,top+u*0.19,cx+u*0.125,top+u*0.17);
  ctx.lineTo(cx+u*0.03,top+u*0.13);ctx.closePath();ctx.fill();
}
function fitText(ctx,text,max){
  if(ctx.measureText(text).width<=max)return text;
  let t=text;while(t.length>1&&ctx.measureText(t+"…").width>max)t=t.slice(0,-1);
  return t+"…";
}
function draw(ctx,L){
  const dark=isDark(L.bg),ink=dark?"#FFFFFF":"#2D2A33",sub=dark?"rgba(255,255,255,.72)":"#6E6879";
  const line=dark?"rgba(255,255,255,.16)":"rgba(45,42,51,.10)",strong=dark?"rgba(255,255,255,.34)":"rgba(45,42,51,.26)";
  const font='"Hiragino Kaku Gothic ProN","Hiragino Sans","Yu Gothic","Noto Sans JP",sans-serif';
  ctx.fillStyle=L.bg;ctx.fillRect(0,0,L.width,L.height);
  if(L.showScale){
    ctx.font="11px "+font;ctx.textAlign="right";ctx.textBaseline="middle";
    for(let cm=0;cm<=L.maxCm;cm+=10){
      const y=L.ground-cm*L.ppc,major=cm%50===0;
      ctx.strokeStyle=major?strong:line;ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(L.axisW,Math.round(y)+.5);ctx.lineTo(L.width-6,Math.round(y)+.5);ctx.stroke();
      if(cm>0&&(major||cm%20===0||L.ppc>=1.9)){ctx.fillStyle=major?ink:sub;ctx.fillText(String(cm),L.axisW-6,y);}
    }
    ctx.fillStyle=sub;ctx.textAlign="left";ctx.fillText("cm",4,L.padTop-12);
  }
  for(const r of L.rows){
    const head=L.ground-r.hpx;
    if(r.img){
      ctx.save();ctx.beginPath();ctx.rect(r.cx-r.col/2,0,r.col,L.ground+10);ctx.clip();
      ctx.drawImage(r.img,r.cx-r.pl.width/2,L.ground-r.pl.above,r.pl.width,r.pl.height);ctx.restore();
    }else{
      ctx.fillStyle=dark?"rgba(255,255,255,.34)":"rgba(90,75,139,.3)";
      silhouette(ctx,r.cx,L.ground,r.hpx);
    }
    ctx.strokeStyle=dark?"rgba(255,255,255,.6)":"rgba(142,66,87,.75)";ctx.lineWidth=1;ctx.setLineDash([4,3]);
    ctx.beginPath();ctx.moveTo(r.cx-r.col/2+6,Math.round(head)+.5);ctx.lineTo(r.cx+r.col/2-6,Math.round(head)+.5);ctx.stroke();ctx.setLineDash([]);
  }
  ctx.strokeStyle=ink;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(L.axisW,L.ground+1);ctx.lineTo(L.width-6,L.ground+1);ctx.stroke();
  if(L.showNames){
    ctx.textAlign="center";ctx.textBaseline="top";
    for(const r of L.rows){
      ctx.fillStyle=ink;ctx.font="600 13px "+font;
      ctx.fillText(fitText(ctx,C.displayName(r.c),r.col-6),r.cx,L.ground+9);
      ctx.fillStyle=sub;ctx.font="11px "+font;
      ctx.fillText(r.assumed?"身長未設定（仮"+r.cm+"cm）":r.cm+"cm",r.cx,L.ground+28);
    }
  }
}
async function redraw(){
  const my=++token,cv=A.$("hcCanvas");if(!cv)return;
  const L=await compute(A.$("hcScroll").clientWidth);
  if(my!==token)return;
  const dpr=Math.min(3,window.devicePixelRatio||1);
  cv.style.width=L.width+"px";cv.style.height=L.height+"px";
  cv.width=Math.round(L.width*dpr);cv.height=Math.round(L.height*dpr);
  const ctx=cv.getContext("2d");ctx.setTransform(dpr,0,0,dpr,0,0);
  draw(ctx,L);last=L;
  const assumed=L.rows.filter(r=>r.assumed).length,noCal=L.rows.filter(r=>r.img&&r.v.headY===0.04&&r.v.footY===0.97).length;
  A.$("hcHint").textContent=!L.rows.length?"":[assumed?"身長が未設定のキャラは仮に"+C.ASSUMED_HEIGHT+"cmで表示しています。":"",
    noCal?"立ち絵は「頭と足元」で位置を合わせると、正しい縮尺になります。":""].filter(Boolean).join(" ");
  cv.setAttribute("aria-label","身長比較の図："+(L.rows.map(r=>C.displayName(r.c)+" "+r.cm+"cm").join("、")||"キャラ未選択"));
}
async function exportPng(){
  if(!hc().items.length){A.toast("先にキャラを選んでください");return;}
  const L=await compute(360);
  let k=2;if(L.width*k*L.height*k>12000000)k=1;
  const cv=document.createElement("canvas");cv.width=Math.round(L.width*k);cv.height=Math.round(L.height*k);
  const ctx=cv.getContext("2d");ctx.setTransform(k,0,0,k,0,0);draw(ctx,L);
  A.showPng(cv,"height_"+A.safeFileName(S.project.name)+"_"+A.stamp()+".png","身長比較を保存");
}
function render(){
  build();
  A.$("hcScale").checked=!!hc().showScale;A.$("hcNames").checked=!!hc().showNames;
  renderBg();renderList();return redraw();
}
A.tabs.height={render,redraw,layout:()=>last};
})();
