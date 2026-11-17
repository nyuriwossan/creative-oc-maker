/* 言葉から名付け — 複数キャラ命名。登録済みのキャラクターを選び、共通テーマの候補を横並びで比べてから図鑑へ反映する。
   確定の操作と確認画面を経るまで、キャラクターの名前は変更しない。 */
(function(){
"use strict";
const P=window.OCWordNamingPage;if(!P)return;
const {W,A,el,button,field,status}=P,$=id=>document.getElementById(id);
const st={selected:new Set(),source:"theme",group:"light",cats:new Set(),langs:new Set(),collectionId:"",contrastId:"",theme:"",saveCollection:true,rows:[],pools:{a:[],b:[]},labels:null,message:""};

function chars(){return P.studioReady()?A().S.chars:[];}
function shuffle(list){const a=list.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function itemName(item){return item?(item.idea?item.idea.name:item.candidate.name):"";}
function itemSource(item){
  if(!item)return null;
  if(item.idea)return {lemma:item.idea.source.lemma,langLabel:item.idea.source.langLabel,meaningJa:item.idea.source.meaningJa};
  return {lemma:item.word.lemma,langLabel:P.data().languages[item.word.lang].label,meaningJa:item.word.meaningJa};
}
/* 候補の出どころごとに {a, b} の2つの山を作る。対比のときだけ b を使い、A・Bを交互に割り当てる */
function buildPools(){
  const data=P.data(),p=P.project();st.labels=null;
  if(st.source==="collection"){
    const col=p.nameCollections.find(c=>c.id===st.collectionId);
    return {a:col?col.items.map(i=>P.ideas().find(x=>x.id===i.ideaId)).filter(Boolean).map(idea=>({idea})):[],b:[]};
  }
  if(st.source==="contrast"){
    const r=W.contrastResults(data,st.contrastId,{langs:[...st.langs]});
    if(!r)return {a:[],b:[]};
    st.labels={a:r.a.label,b:r.b.label};
    return {a:W.candidatePool(shuffle(r.a.results)),b:W.candidatePool(shuffle(r.b.results))};
  }
  const out=W.filter(data,{categories:[...st.cats],group:st.cats.size?"":st.group,langs:[...st.langs]});
  return {a:W.candidatePool(shuffle(out.results)),b:[]};
}
function assign(){
  const data=P.data();if(!data){status("言葉のデータを読み込めていません");return;}
  const picked=chars().filter(c=>st.selected.has(c.id));
  if(!picked.length){st.message="キャラクターを1人以上選んでください。";st.rows=[];renderTable();return;}
  if(st.source==="collection"&&!st.collectionId){st.message="コレクションを選んでください。";st.rows=[];renderTable();return;}
  if(st.source==="contrast"&&!W.contrastById(data,st.contrastId)){st.message="対比を選んでください。";st.rows=[];renderTable();return;}
  st.pools=buildPools();
  const others=chars().filter(c=>!st.selected.has(c.id)).map(c=>c.name);
  // 名前の重なりを避けて割り当てる（山の中の同名、選んでいないキャラの名前、もう一方の山で使った名前）
  const two=st.source==="contrast",sideOf=i=>two&&i%2?"b":"a";
  const wrap=list=>list.map(it=>({candidate:{name:itemName(it)},item:it}));
  const nA=picked.filter((c,i)=>sideOf(i)==="a").length,gotA=W.pickAssignments(wrap(st.pools.a),nA,others);
  const gotB=W.pickAssignments(wrap(st.pools.b),picked.length-nA,others.concat(gotA.filter(Boolean).map(x=>x.candidate.name)));
  let ia=0,ib=0;
  st.rows=picked.map((c,i)=>{const side=sideOf(i),g=side==="a"?gotA[ia++]:gotB[ib++],it=g?g.item:null;return {charId:c.id,side,apply:!!it,item:it,name:itemName(it)};});
  const missing=st.rows.filter(r=>!r.item).length;
  st.message=!(st.pools.a.length+st.pools.b.length)?"条件に合う候補がありません。テーマやコレクションを変えてください。"
    :missing?missing+"人ぶんの候補が足りません。テーマを広げるか、名前を直接入力してください。":"";
  renderTable();
}
/* 別の候補に替える。ほかの行で使っている名前は飛ばす */
function cycle(row,dir){
  const pool=st.pools[row.side||"a"];
  if(!pool.length)return;
  const used=new Set(st.rows.filter(r=>r!==row).map(r=>W.normalize(r.name)).filter(Boolean));
  let i=pool.indexOf(row.item);
  for(let n=0;n<pool.length;n++){
    i=(i+dir+pool.length)%pool.length;
    const it=pool[i];
    if(!used.has(W.normalize(itemName(it)))){row.item=it;row.name=itemName(it);row.apply=true;return;}
  }
}
function warnings(){
  const active=st.rows.filter(r=>r.apply&&r.name.trim()),out=[];
  for(const d of W.findDuplicates(active.map(r=>r.name)))out.push("「"+d.name+"」が"+d.indexes.length+"人に割り当てられています。");
  const targets=new Set(active.map(r=>r.charId));
  for(const r of active){
    const clash=chars().find(c=>!targets.has(c.id)&&W.normalize(c.name)===W.normalize(r.name));
    if(clash)out.push("「"+r.name.trim()+"」は、この作品の別のキャラクターがすでに使っています。");
  }
  return [...new Set(out)];
}
function renderWarnings(){
  const box=$("wnBatchWarn");if(!box)return;
  const list=warnings();box.replaceChildren();box.hidden=!list.length;
  if(list.length){box.append(el("p","名前の重複があります","wn-label"));for(const t of list)box.append(el("p",t));}
  const n=st.rows.filter(r=>r.apply&&r.name.trim()).length;
  const apply=$("wnBatchApply");if(apply){apply.disabled=!n;apply.textContent=n?"確定して"+n+"人の名前を図鑑へ反映":"確定してキャラ図鑑へ反映";}
}
function renderTable(){
  const box=$("wnBatchTable"),msg=$("wnBatchMsg");if(!box)return;
  box.replaceChildren();msg.textContent=st.message;
  $("wnBatchResult").hidden=!st.rows.length;
  if(!st.rows.length){renderWarnings();return;}
  const C=A().C,head=el("div",undefined,"wn-brow wn-bhead");head.setAttribute("aria-hidden","true");
  for(const t of ["キャラクター","新しい名前","原語","原語の意味","候補の変更"])head.append(el("span",t));
  box.append(head);
  st.rows.forEach((r,index)=>{
    const c=chars().find(x=>x.id===r.charId);if(!c)return;
    const rowEl=el("div",undefined,"wn-brow"+(r.apply?"":" off"));rowEl.dataset.row=c.id;
    const cur=el("div",undefined,"wn-bcell");cur.dataset.label="キャラクター";cur.append(el("strong",C.displayName(c)));
    if(st.labels){const tag=el("span",(r.side==="b"?"B":"A")+"：「"+st.labels[r.side]+"」の側","wn-bside");tag.dataset.side=r.side;cur.append(el("br"),tag);}
    const nameCell=el("div",undefined,"wn-bcell");nameCell.dataset.label="新しい名前";
    const input=el("input");input.type="text";input.maxLength=60;input.value=r.name;input.setAttribute("aria-label",C.displayName(c)+"の新しい名前");input.dataset.b="name";
    const len=el("span","","wn-blen");
    const syncLen=()=>{const n=input.value.trim();len.textContent=n?W.moraCount(n)+"音":"";};
    input.addEventListener("input",()=>{r.name=input.value;syncLen();renderWarnings();});syncLen();
    nameCell.append(input,len);
    const src=itemSource(r.item);
    const lemma=el("div",undefined,"wn-bcell");lemma.dataset.label="原語";lemma.append(document.createTextNode(src?src.lemma+"（"+src.langLabel+"）":"—"));
    const mean=el("div",undefined,"wn-bcell wn-bmean");mean.dataset.label="原語の意味";mean.append(document.createTextNode(src?src.meaningJa:"候補がありません。名前を直接入力する場合は、由来は記録されません。"));
    const acts=el("div",undefined,"wn-bcell wn-bacts");acts.dataset.label="候補の変更";
    const prev=button("前の候補"),next=button("次の候補");prev.dataset.b="prev";next.dataset.b="next";
    prev.disabled=next.disabled=st.pools[r.side||"a"].length<2;
    const refocus=act=>{const b=document.querySelector('[data-row="'+CSS.escape(c.id)+'"] [data-b="'+act+'"]');if(b)b.focus({preventScroll:true});};
    prev.addEventListener("click",()=>{cycle(r,-1);renderTable();refocus("prev");});
    next.addEventListener("click",()=>{cycle(r,1);renderTable();refocus("next");});
    const lab=el("label",undefined,"check"),chk=el("input");chk.type="checkbox";chk.checked=r.apply;chk.dataset.b="apply";
    chk.addEventListener("change",()=>{r.apply=chk.checked;rowEl.classList.toggle("off",!r.apply);renderWarnings();});
    lab.append(chk,document.createTextNode("反映する"));
    acts.append(prev,next,lab);
    rowEl.append(cur,nameCell,lemma,mean,acts);box.append(rowEl);
  });
  renderWarnings();
}
async function apply(){
  const a=A(),C=a.C,p=P.project(),data=P.data();
  const rows=st.rows.filter(r=>r.apply&&r.name.trim()).map(r=>({r,c:chars().find(x=>x.id===r.charId)})).filter(x=>x.c);
  if(!rows.length){status("反映する名前がありません");return;}
  const lines=rows.map(({r,c})=>C.displayName(c)+" → "+r.name.trim());
  const warn=warnings();
  const ok=await a.confirmBox("次の"+rows.length+"人の名前を、キャラ図鑑に反映します。\n\n"+lines.join("\n")+
    (warn.length?"\n\n【注意】"+warn.join(" "):"")+"\n\n読み・ローマ字は変更しません。必要なら図鑑で直してください。",{ok:"名前を変更する",title:"名前の変更の確認"});
  if(!ok){status("変更しませんでした");return;}
  const theme=st.theme.trim(),contrastOf=W.contrastById(data,st.source==="contrast"?st.contrastId:""),saved=[];
  const label=theme||(contrastOf?contrastOf.a.label+"と"+contrastOf.b.label:"");
  for(const {r,c} of rows){
    const name=r.name.trim();let idea=null;
    const intent=contrastOf?"対比テーマ「"+label+"」の「"+st.labels[r.side]+"」の側":(theme?"共通テーマ「"+theme+"」":"");
    if(r.item&&r.item.idea)idea=r.item.idea;
    else if(r.item){idea=W.newIdea(data,r.item.word,{candidateId:r.item.candidate.id,name,method:r.item.candidate.method,intent});p.nameIdeas.push(idea);}
    if(idea){P.applyNameToCharacter(c,idea,name,intent);saved.push(idea);}
    else{ // 候補なしで直接入力した名前：由来は付けず、名前だけ変える
      const had=String(c.name||"").trim();
      if(had&&had!==name)c.profile.nameNote=("以前の名前："+had+(c.profile.nameNote?"\n\n"+c.profile.nameNote:"")).slice(0,3000);
      c.name=name;p.nameUses=p.nameUses.filter(u=>!(u.targetType==="character"&&u.targetId===c.id));a.saveChar(c);
    }
  }
  if(st.saveCollection&&saved.length&&st.source!=="collection"){
    const col=C.newCollection(label||"一括命名");col.theme=contrastOf?"対比："+W.contrastTitle(contrastOf):theme;col.memo="複数キャラ命名で作成（"+rows.map(x=>x.r.name.trim()).join("、")+"）";
    col.items=[...new Set(saved.map(i=>i.id))].map(id=>({ideaId:id,note:""}));p.nameCollections.push(col);
  }
  a.saveProject();
  st.rows=[];st.pools={a:[],b:[]};st.labels=null;st.message="";st.selected.clear();
  P.emit("ideas");
  status(rows.length+"人の名前を図鑑に反映しました");
}

/* ---------- 画面 ---------- */
function render(){
  const box=$("wnBatch");if(!box||$("wnPane-batch").hidden)return;
  box.replaceChildren();
  box.append(el("h2","複数キャラ命名"),el("p","登録済みのキャラクターに、共通のテーマに沿った名前を付けます。確定して確認するまで、図鑑の名前は変わりません。","wn-help"));
  if(!P.studioReady()){box.append(el("p","作品を読み込んでいます…","wn-empty"));return;}
  const data=P.data(),list=chars(),p=P.project();
  if(!data){box.append(el("p","言葉のデータを読み込んでいます…","wn-empty"));return;}
  if(!list.length){
    const e=el("p",undefined,"wn-empty");e.append(document.createTextNode("「"+p.name+"」の図鑑にキャラクターがいません。"));
    const l=el("a","キャラ作成・図鑑へ");l.href="./index.html";e.append(el("br"),l);box.append(e);return;
  }
  for(const id of [...st.selected])if(!list.some(c=>c.id===id))st.selected.delete(id);
  st.rows=st.rows.filter(r=>list.some(c=>c.id===r.charId));

  const f1=el("fieldset",undefined,"wn-step"),lg1=el("legend","");f1.append(lg1);
  const syncLegend=()=>{lg1.textContent="1. キャラクターを選ぶ（"+st.selected.size+"人）";};
  const checks=el("div",undefined,"wn-checks");checks.id="wnBatchChars";
  for(const c of list){
    const l=el("label",undefined,"check"),i=el("input");i.type="checkbox";i.value=c.id;i.checked=st.selected.has(c.id);
    i.addEventListener("change",()=>{if(i.checked)st.selected.add(c.id);else st.selected.delete(c.id);syncLegend();});
    l.append(i,document.createTextNode(A().C.displayName(c)));checks.append(l);
  }
  const quick=el("div",undefined,"actions"),all=button("全員を選ぶ"),none=button("選択を解除");all.dataset.b="all";none.dataset.b="none";
  all.addEventListener("click",()=>{list.forEach(c=>st.selected.add(c.id));render();});
  none.addEventListener("click",()=>{st.selected.clear();render();});
  quick.append(all,none);f1.append(checks,quick);syncLegend();box.append(f1);

  const f2=el("fieldset",undefined,"wn-step");f2.append(el("legend","2. 共通テーマを決める"));
  const theme=el("input");theme.type="text";theme.maxLength=60;theme.id="wnBatchTheme";theme.value=st.theme;theme.placeholder="例：全肯定する兄弟、北の騎士団";
  theme.addEventListener("input",()=>{st.theme=theme.value;});
  f2.append(field("テーマの名前（任意。名前の由来メモに残ります）",theme));
  const src=el("select");src.id="wnBatchSource";
  src.append(new Option("意味カテゴリから候補を出す","theme"),new Option("テーマの対比から（A・Bを交互に割り当てる）","contrast"),new Option("命名コレクションの名前を使う","collection"));
  src.value=st.source;src.addEventListener("change",()=>{st.source=src.value;render();});
  f2.append(field("候補の出どころ",src));
  const langBox=()=>{
    const g2=el("fieldset");g2.append(el("legend","言語（複数可・未選択なら全言語）"));
    const c2=el("div",undefined,"chips");c2.id="wnBatchLangs";g2.append(c2);
    P.chipGroup(c2,Object.entries(data.languages).map(([k,v])=>[k,v.label]),st.langs,()=>{});return g2;
  };
  if(st.source==="theme"){
    if(data.groups){
      if(!data.groups[st.group])st.group=Object.keys(data.groups)[0];
      const gs=el("select");gs.id="wnBatchGroup";
      for(const [k,v] of Object.entries(data.groups))gs.append(new Option(v.label,k));
      gs.value=st.group;gs.addEventListener("change",()=>{st.group=gs.value;st.cats.clear();render();});
      f2.append(field("テーマの大分類",gs));
    }
    const g1=el("fieldset");g1.append(el("legend","意味カテゴリ（複数可・未選択ならこの大分類の全カテゴリ）"));
    const c1=el("div",undefined,"chips");c1.id="wnBatchCats";g1.append(c1);
    P.chipGroup(c1,P.catsOf(data.groups?st.group:"").map(c=>[c.id,c.label]),st.cats,()=>{});
    f2.append(g1,langBox());
  }else if(st.source==="contrast"){
    const sel=el("select");sel.id="wnBatchContrast";sel.append(new Option("選んでください",""));
    for(const [kind,label] of Object.entries(W.CONTRAST_KINDS)){
      const list=(data.contrasts||[]).filter(c=>c.kind===kind);if(!list.length)continue;
      const og=document.createElement("optgroup");og.label=label;for(const c of list)og.append(new Option(W.contrastTitle(c),c.id));sel.append(og);
    }
    sel.value=W.contrastById(data,st.contrastId)?st.contrastId:"";sel.addEventListener("change",()=>{st.contrastId=sel.value;});
    f2.append(field("対比",sel),el("p","選んだ順に、1人目はA、2人目はB、3人目はA…と交互に割り当てます。対比は創作上のもので、辞書上の対義語とは限りません。","wn-note"),langBox());
  }else{
    const sel=el("select");sel.id="wnBatchCollection";
    sel.append(new Option(p.nameCollections.length?"選んでください":"コレクションがありません",""),...p.nameCollections.map(c=>new Option(c.name+"（"+c.items.length+"件）",c.id)));
    if(!p.nameCollections.some(c=>c.id===st.collectionId))st.collectionId="";
    sel.value=st.collectionId;sel.addEventListener("change",()=>{st.collectionId=sel.value;});
    f2.append(field("コレクション",sel));
  }
  box.append(f2);
  const go=button("候補を割り当てる","wn-primary");go.id="wnBatchAssign";go.addEventListener("click",assign);
  const msg=el("p","","wn-note");msg.id="wnBatchMsg";msg.setAttribute("role","status");
  box.append(go,msg);

  const res=el("section",undefined,"wn-step");res.id="wnBatchResult";res.setAttribute("aria-label","候補の比較");
  res.append(el("h3","3. 候補を比べて、確定する"),el("p","名前は自由に書き換えられます。「反映する」を外したキャラクターは変更しません。","wn-help"));
  const table=el("div",undefined,"wn-btable");table.id="wnBatchTable";
  const warn=el("div",undefined,"wn-bwarn");warn.id="wnBatchWarn";warn.setAttribute("role","alert");warn.hidden=true;
  const keep=el("label",undefined,"check"),k=el("input");k.type="checkbox";k.id="wnBatchSaveCol";k.checked=st.saveCollection;
  k.addEventListener("change",()=>{st.saveCollection=k.checked;});
  keep.append(k,document.createTextNode("この組み合わせを命名コレクションとして残す"));keep.hidden=st.source==="collection";
  const again=button("候補を割り当て直す");again.dataset.b="again";again.addEventListener("click",assign);
  const applyBtn=button("確定してキャラ図鑑へ反映","wn-primary");applyBtn.id="wnBatchApply";applyBtn.addEventListener("click",apply);
  const acts=el("div",undefined,"actions");acts.append(again,applyBtn);
  res.append(table,warn,keep,acts);box.append(res);
  renderTable();
}
P.on("ideas",render);P.on("data",render);
window.OCWordNamingBatch={render,state:()=>st};
})();
