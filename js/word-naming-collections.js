/* 言葉から名付け — 命名コレクションと、保存した名前候補の一覧・利用先への送信。
   利用者由来の文字列はすべてテキストノードとして入れる。 */
(function(){
"use strict";
const P=window.OCWordNamingPage;if(!P)return;
const {W,A,el,button,row,field,status}=P,$=id=>document.getElementById(id);
const project=()=>P.project(),C=()=>A().C;
function save(){A().saveProject();P.emit("ideas");}
function ideaById(id){return P.ideas().find(i=>i.id===id)||null;}
function sourceLine(idea){const s=idea.source||{};return s.lemma+"（"+s.langLabel+"・"+s.pos+"）";}

/* ---------- 利用先（キャラ名・家名・地名・組織名・用語集） ---------- */
function useLabel(u){
  const p=project(),kind=C().nameUseKind(u.kind);
  let where="";
  if(u.targetType==="character"){const c=A().S.chars.find(x=>x.id===u.targetId);where=c?"図鑑「"+C().displayName(c)+"」":"";}
  else{const sec=p.world.sections.find(s=>s.entries.some(e=>e.id===u.targetId));where=sec?"世界観・"+sec.title:"";}
  return (kind?kind.label:"")+"「"+u.name+"」"+(where?"（"+where+"）":"");
}
function sendToWorld(idea,kindKey,name,intent){
  const a=A(),p=project(),kind=a.C.nameUseKind(kindKey);
  if(!p||!kind||kind.target!=="entry"){status("送り先を確認できませんでした");return false;}
  name=String(name).trim();if(!name){status("名前を入力してください");return false;}
  let sec=p.world.sections.find(s=>s.key===kind.section);
  if(!sec){
    const def=a.C.SECTION_DEFS.find(d=>d.key===kind.section);
    sec={id:a.C.uid("sec"),key:kind.section,title:def?def.title:"用語集",custom:false,entries:[]};p.world.sections.push(sec);
  }
  if(sec.entries.some(e=>e.title===name)){status("「"+sec.title+"」に同じ名前の項目があります");return false;}
  const entry=a.C.newEntry(name,kind.entryKind,"");
  entry.body=a.C.nameUseBody(idea,name,intent);
  sec.entries.push(entry);
  p.nameUses.push(a.C.newNameUse(idea,kind.key,name,intent,entry.id));
  save();
  status("「"+p.name+"」の世界観（"+sec.title+"）に「"+name+"」を追加しました");return true;
}
function openUse(idea){
  const a=A();if(!P.studioReady()){status("作品を読み込めていないため、送れません");return;}
  const sheet=a.sheet({title:"名前の使い道を選ぶ",html:""}),body=sheet.body;body.classList.add("wn-editor");
  const src=el("div",undefined,"wn-src");
  src.append(el("p","創作名","wn-label"),el("p",idea.name,"wn-src-lemma"),el("p","もとにした言葉："+sourceLine(idea),"wn-src-meaning"),
    el("p","原語の意味："+idea.source.meaningJa,"wn-src-meaning"));
  body.append(src);
  const kind=el("select");kind.id="wnUseKind";
  for(const k of a.C.NAME_USE_KINDS)kind.append(new Option(k.label,k.key));
  kind.value="family";body.append(field("使い道",kind));
  const who=el("select");who.id="wnUseChar";
  who.append(new Option("新しく作る（キャラ作成へ）",""),...a.S.chars.map(c=>new Option("登録済み：「"+a.C.displayName(c)+"」に付ける",c.id)));
  const whoField=field("どのキャラクターに",who);body.append(whoField);
  const name=el("input");name.type="text";name.maxLength=80;name.id="wnUseName";name.value=idea.name;
  body.append(field("実際に使う名前（「〜家」「〜王国」などを足せます）",name));
  const intent=el("textarea");intent.rows=3;intent.id="wnUseIntent";intent.value=idea.intent||"";
  intent.placeholder="この使い道での命名意図。例：建国の誓いにちなむ。";
  body.append(field("命名意図（原語の意味とは別に書きます）",intent));
  const note=el("p","","st-note");note.id="wnUseNote";body.append(note);
  const acts=el("div",undefined,"st-actions end"),go=button("送る","btn-sm copy");go.dataset.e="send";acts.append(go);body.append(acts);
  function sync(){
    const k=a.C.nameUseKind(kind.value);whoField.hidden=k.target!=="character";
    note.textContent=k.target==="character"
      ?(who.value?"図鑑のキャラクターの名前を変更します。次の画面で確認してから反映します。":"キャラ作成画面に移り、この名前に設定をつけます。")
      :"世界観の「"+(a.C.SECTION_DEFS.find(d=>d.key===k.section)||{title:""}).title+"」に、種類「"+k.entryKind+"」の項目として追加します。語彙データは変更しません。";
    go.disabled=!name.value.trim();
  }
  kind.addEventListener("change",sync);who.addEventListener("change",sync);name.addEventListener("input",sync);sync();
  go.addEventListener("click",async()=>{
    const k=a.C.nameUseKind(kind.value),n=name.value.trim();
    if(k.target!=="character"){if(sendToWorld(idea,k.key,n,intent.value))sheet.close();return;}
    if(!who.value){await a.flush();P.sendToCreate(Object.assign({},idea,{name:n}));return;}
    const c=a.S.chars.find(x=>x.id===who.value);if(!c)return;
    const ok=await a.confirmBox("図鑑のキャラクターの名前を変更します。\n"+a.C.displayName(c)+" → "+n+"\n\n読み・ローマ字は変更しません。必要なら図鑑で直してください。",{ok:"名前を変更する",title:"名前の変更の確認"});
    if(!ok)return;
    P.applyNameToCharacter(c,idea,n,intent.value);P.emit("ideas");
    status("「"+n+"」を図鑑に反映しました");sheet.close();
  });
  kind.focus();
}

/* ---------- 保存した名前候補 ---------- */
function addToCollectionSheet(idea){
  const a=A(),p=project(),sheet=a.sheet({title:"コレクションに追加",html:""}),body=sheet.body;body.classList.add("wn-editor");
  body.append(el("p","「"+idea.name+"」を入れるコレクションを選びます。ひとつの名前を複数のコレクションに入れられます。","st-note"));
  const sel=el("select");sel.id="wnAddCol";
  sel.append(...p.nameCollections.map(c=>new Option(c.name+(c.items.some(i=>i.ideaId===idea.id)?"（追加済み）":""),c.id)),new Option("＋ 新しいコレクションを作る","__new"));
  body.append(field("コレクション",sel));
  const nm=el("input");nm.type="text";nm.maxLength=60;nm.id="wnAddColName";nm.placeholder="例：全肯定する兄弟";
  const nmField=field("新しいコレクションの名前",nm);body.append(nmField);
  const acts=el("div",undefined,"st-actions end"),go=button("追加する","btn-sm copy");go.dataset.e="add";acts.append(go);body.append(acts);
  const sync=()=>{nmField.hidden=sel.value!=="__new";};sel.addEventListener("change",sync);sync();
  go.addEventListener("click",()=>{
    let col=p.nameCollections.find(c=>c.id===sel.value);
    if(sel.value==="__new"){col=a.C.newCollection(nm.value||"命名コレクション");p.nameCollections.push(col);}
    if(!col)return;
    if(col.items.some(i=>i.ideaId===idea.id)){status("すでに「"+col.name+"」に入っています");return;}
    col.items.push({ideaId:idea.id,note:""});col.updatedAt=Date.now();save();
    status("コレクション「"+col.name+"」に追加しました");sheet.close();
  });
}
function renderIdeas(){
  const box=$("wnIdeas"),title=$("wnIdeasTitle");if(!box)return;
  box.replaceChildren();
  if(!P.studioReady()){title.textContent="この作品の名前候補";box.append(el("p","作品を読み込んでいます…","wn-empty"));return;}
  const a=A(),p=project(),list=P.ideas(),data=P.data();
  title.textContent="「"+p.name+"」の名前候補（"+list.length+"件）";
  if(!list.length){box.append(el("p","まだありません。「言葉を探す」で候補を選ぶか「この言葉から自分で作る」で作り、「この作品の名前候補に保存」を押すと、ここに残ります。作品のバックアップにも含まれます。","wn-empty"));return;}
  for(const idea of list.slice().sort((x,y)=>y.updatedAt-x.updatedAt)){
    const item=el("article",undefined,"wn-idea");item.dataset.idea=idea.id;
    item.append(el("h3",idea.name));
    item.append(row("もとにした言葉",sourceLine(idea)),row("原語の意味",idea.source.meaningJa),
      row("加工方法",W.methodLabel(data,idea)+(idea.baseName&&idea.edited?"（候補「"+idea.baseName+"」から編集）":"")));
    if(idea.intent)item.append(row("創作上の意図",idea.intent));
    item.append(row("実在の人名・単語との重なり",W.overlapText(idea.overlap)));
    const cols=p.nameCollections.filter(c=>c.items.some(i=>i.ideaId===idea.id)).map(c=>c.name);
    if(cols.length)item.append(row("コレクション",cols.join("、")));
    const uses=p.nameUses.filter(u=>u.ideaId===idea.id);
    if(uses.length)item.append(row("使っている場所",uses.map(useLabel).join("、")));
    const acts=el("div",undefined,"actions");
    const mk=(label,act,fn)=>{const b=button(label);b.dataset.i=act;b.addEventListener("click",fn);acts.append(b);};
    const word=data&&P.wordOf(idea);
    if(word)mk("編集","edit",()=>P.openEditor(word,{candidateId:idea.candidateId,name:idea.name,method:idea.method,intent:idea.intent},idea));
    mk("コピー","copy",()=>P.copyText(P.ideaText(idea),"名前と由来をコピーしました"));
    mk("使う先を選ぶ","use",()=>openUse(idea));
    mk("コレクションに追加","collect",()=>addToCollectionSheet(idea));
    mk("キャラ作成に送る","create",async()=>{await a.flush();P.sendToCreate(idea);});
    mk("削除","delete",async()=>{
      const impact=a.C.ideaImpact(p,idea.id);
      const extra=(impact.collections.length?"\nコレクション「"+impact.collections.join("」「")+"」からも外れます。":"")+
        (impact.uses?"\nすでに送った図鑑・世界観の名前（"+impact.uses+"件）は消えません。":"");
      if(!(await a.confirmBox("名前候補「"+idea.name+"」を削除します。"+extra,{ok:"削除する",danger:true})))return;
      const l=p.nameIdeas,i=l.findIndex(x=>x.id===idea.id);if(i>=0)l.splice(i,1);
      a.C.removeIdeaRefs(p,idea.id);save();status("削除しました");
    });
    item.append(acts);box.append(item);
  }
}

/* ---------- 命名コレクション ---------- */
function editCollectionSheet(col){
  const a=A(),p=project(),isNew=!col;
  const sheet=a.sheet({title:isNew?"新しいコレクション":"コレクションを編集",html:""}),body=sheet.body;body.classList.add("wn-editor");
  const nm=el("input");nm.type="text";nm.maxLength=60;nm.id="wnColName";nm.value=col?col.name:"";nm.placeholder="例：全肯定する兄弟";
  const th=el("input");th.type="text";th.maxLength=200;th.id="wnColTheme";th.value=col?col.theme:"";th.placeholder="例：肯定・同意の言葉で揃える";
  const memo=el("textarea");memo.rows=4;memo.id="wnColMemo";memo.value=col?col.memo:"";memo.placeholder="名前の由来や命名意図、使う作品・場面など。";
  body.append(field("コレクションの名前",nm),field("共通テーマ",th),field("メモ（名前の由来・命名意図）",memo));
  const acts=el("div",undefined,"st-actions end"),go=button(isNew?"作成する":"保存する","btn-sm copy");go.dataset.e="save";acts.append(go);body.append(acts);
  const sync=()=>{go.disabled=!nm.value.trim();};nm.addEventListener("input",sync);sync();
  go.addEventListener("click",()=>{
    const target=col||a.C.newCollection(nm.value);
    target.name=nm.value.trim().slice(0,60);target.theme=th.value.trim();target.memo=memo.value.trim();target.updatedAt=Date.now();
    if(isNew)p.nameCollections.push(target);
    save();status(isNew?"コレクション「"+target.name+"」を作りました":"コレクションを保存しました");sheet.close();
  });
  nm.focus();
}
function pickIdeasSheet(col){
  const a=A(),rest=P.ideas().filter(i=>!col.items.some(x=>x.ideaId===i.id));
  const sheet=a.sheet({title:"「"+col.name+"」に名前を追加",html:""}),body=sheet.body;body.classList.add("wn-editor");
  if(!rest.length){body.append(el("p","追加できる名前候補がありません。「言葉を探す」で名前を保存すると、ここから選べます。","wn-empty"));return;}
  const list=el("div",undefined,"wn-checks");
  for(const idea of rest){
    const l=el("label",undefined,"check"),c=el("input");c.type="checkbox";c.value=idea.id;
    l.append(c,document.createTextNode(idea.name+"："+idea.source.lemma+"（"+idea.source.langLabel+"）"));list.append(l);
  }
  body.append(list);
  const acts=el("div",undefined,"st-actions end"),go=button("選んだ名前を追加","btn-sm copy");go.dataset.e="add";acts.append(go);body.append(acts);
  go.addEventListener("click",()=>{
    const ids=[...list.querySelectorAll("input:checked")].map(c=>c.value);
    if(!ids.length){status("追加する名前を選んでください");return;}
    for(const id of ids)col.items.push({ideaId:id,note:""});
    col.updatedAt=Date.now();save();status(ids.length+"件を追加しました");sheet.close();
  });
}
function renderCollections(){
  const box=$("wnCollections");if(!box)return;
  box.replaceChildren();
  if(!P.studioReady()){box.append(el("p","作品を読み込んでいます…","wn-empty"));return;}
  const a=A(),p=project(),cols=p.nameCollections;
  $("wnColTitle").textContent="命名コレクション（"+cols.length+"件）";
  if(!cols.length){box.append(el("p","まだありません。「新しいコレクション」で作り、保存した名前をテーマごとにまとめられます。言語が違う名前も一緒に入れられます。","wn-empty"));return;}
  for(const col of cols){
    const art=el("article",undefined,"wn-col");art.dataset.col=col.id;
    art.append(el("h3",col.name));
    if(col.theme)art.append(row("共通テーマ",col.theme));
    if(col.memo)art.append(row("メモ",col.memo));
    const ol=el("ol",undefined,"wn-col-items");
    col.items.forEach((it,index)=>{
      const idea=ideaById(it.ideaId);if(!idea)return;
      const li=el("li");li.dataset.item=idea.id;
      const text=el("p",undefined,"wn-col-name");
      text.append(el("strong",idea.name),document.createTextNode("："+idea.source.lemma+"（"+idea.source.langLabel+"）／"+idea.source.meaningJa));
      li.append(text);
      if(idea.intent)li.append(el("p","創作上の意図："+idea.intent,"wn-col-note"));
      if(it.note)li.append(el("p","メモ："+it.note,"wn-col-note"));
      const acts=el("div",undefined,"wn-col-acts");
      const mk=(label,act,aria,fn,disabled)=>{const b=button(label);b.dataset.c=act;b.setAttribute("aria-label",aria);b.disabled=!!disabled;b.addEventListener("click",fn);acts.append(b);};
      mk("↑","up","「"+idea.name+"」を上へ",()=>{if(a.C.moveCollectionItem(col,index,-1)){save();focusItem(col.id,idea.id,"up");}},index===0);
      mk("↓","down","「"+idea.name+"」を下へ",()=>{if(a.C.moveCollectionItem(col,index,1)){save();focusItem(col.id,idea.id,"down");}},index===col.items.length-1);
      mk("メモ","note","「"+idea.name+"」のメモ",async()=>{
        const v=await a.promptBox("「"+idea.name+"」のメモ",it.note,{placeholder:"このコレクションでの役割や由来",ok:"保存"});
        if(v==null)return;it.note=v.slice(0,1000);col.updatedAt=Date.now();save();
      });
      mk("外す","remove","「"+idea.name+"」をコレクションから外す",()=>{col.items.splice(index,1);col.updatedAt=Date.now();save();status("コレクションから外しました（名前候補は残ります）");});
      li.append(acts);ol.append(li);
    });
    if(col.items.length)art.append(ol);else art.append(el("p","まだ名前が入っていません。","wn-empty"));
    const acts=el("div",undefined,"actions");
    const mk=(label,act,fn)=>{const b=button(label);b.dataset.c=act;b.addEventListener("click",fn);acts.append(b);};
    mk("名前を追加","add",()=>pickIdeasSheet(col));
    mk("編集","edit",()=>editCollectionSheet(col));
    mk("コピー","copy",()=>P.copyText(a.C.collectionToText(col,P.ideas()),"コレクションをコピーしました"));
    mk("書き出し","export",()=>{
      a.download(new Blob([a.C.collectionToText(col,P.ideas())+"\n"],{type:"text/plain;charset=utf-8"}),"naming-collection_"+a.safeFileName(col.name)+"_"+a.stamp()+".txt");
      status("テキストファイルを書き出しました");
    });
    mk("削除","delete",async()=>{
      if(!(await a.confirmBox("コレクション「"+col.name+"」を削除します。\n中の名前候補（"+col.items.length+"件）は削除されません。",{ok:"削除する",danger:true})))return;
      const i=cols.findIndex(c=>c.id===col.id);if(i>=0)cols.splice(i,1);save();status("コレクションを削除しました");
    });
    art.append(acts);box.append(art);
  }
}
function focusItem(colId,ideaId,act){
  const b=document.querySelector('[data-col="'+CSS.escape(colId)+'"] [data-item="'+CSS.escape(ideaId)+'"] [data-c="'+act+'"]');
  const alt=document.querySelector('[data-col="'+CSS.escape(colId)+'"] [data-item="'+CSS.escape(ideaId)+'"] [data-c="'+(act==="up"?"down":"up")+'"]');
  const t=b&&!b.disabled?b:alt;if(t)t.focus({preventScroll:true});
}
function render(){
  if($("wnPane-collections").hidden)return; // 表示しているときだけ描く
  renderCollections();renderIdeas();
}
$("wnColNew").addEventListener("click",()=>{if(!P.studioReady()){status("作品を読み込めていません");return;}editCollectionSheet(null);});
P.on("ideas",render);P.on("data",render);
window.OCWordNamingCollections={openUse,sendToWorld,render};
})();
