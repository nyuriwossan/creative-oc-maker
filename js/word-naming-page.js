/* 言葉から名付け — 画面。データ由来・利用者由来の文字列はすべてテキストノードとして入れる（HTMLとして解釈しない）。 */
(function(){
"use strict";
const W=window.OCWordNaming,$=id=>document.getElementById(id);
const A=()=>window.OCStudio;                       // 作品管理（共通ナビ）。読み込めなくても検索と閲覧は動かす
let data=null,favorites=null,loading=false;
const state={langs:new Set(),categories:new Set(),nuances:new Set(),lengths:new Set(),impressions:new Set()};

function el(tag,text,cls){const e=document.createElement(tag);if(text!==undefined&&text!==null)e.textContent=text;if(cls)e.className=cls;return e;}
function button(text,cls){const b=el("button",text,cls);b.type="button";return b;}
function status(text){const s=$("wnStatus");if(s)s.textContent=text;const a=A();if(a&&text)a.toast(text);}
function studioReady(){const a=A();return !!(a&&a.S.ready&&a.S.project);}
function ideas(){return studioReady()?A().S.project.nameIdeas:[];}

/* ---------- モード切り替え（名前を探す／言葉から名付け） ---------- */
function setMode(mode,opts){
  const words=mode==="words";
  $("modeFind").hidden=words;$("modeWords").hidden=!words;
  $("modeFindBtn").setAttribute("aria-selected",String(!words));$("modeWordsBtn").setAttribute("aria-selected",String(words));
  $("modeFindBtn").tabIndex=words?-1:0;$("modeWordsBtn").tabIndex=words?0:-1;
  if(!(opts&&opts.silent)){
    try{const u=new URL(location.href);u.hash=words?"words":"";history.replaceState(null,"",u);}catch(e){}
  }
  if(words&&!data&&!loading)start();
}
function initModes(){
  $("modeFindBtn").addEventListener("click",()=>setMode("find"));
  $("modeWordsBtn").addEventListener("click",()=>setMode("words"));
  $("wnModes").addEventListener("keydown",e=>{
    if(e.key!=="ArrowRight"&&e.key!=="ArrowLeft")return;
    const next=$("modeWords").hidden?"words":"find";setMode(next);$(next==="words"?"modeWordsBtn":"modeFindBtn").focus();
  });
  window.addEventListener("hashchange",()=>setMode(location.hash==="#words"?"words":"find",{silent:true}));
  setMode(location.hash==="#words"?"words":"find",{silent:true});
}

/* ---------- 絞り込み ---------- */
function chipGroup(hostId,entries,set,onChange){
  const host=$(hostId);host.replaceChildren();
  for(const [value,label,disabled] of entries){
    const b=button(label);b.dataset.value=value;b.setAttribute("aria-pressed",String(set.has(value)));
    if(disabled){b.disabled=true;b.title="準備中";}
    b.addEventListener("click",()=>{
      if(set.has(value))set.delete(value);else set.add(value);
      b.setAttribute("aria-pressed",String(set.has(value)));onChange();
    });
    host.append(b);
  }
}
function buildFilters(){
  chipGroup("wnLangs",Object.entries(data.languages).map(([k,v])=>[k,v.label]),state.langs,render);
  chipGroup("wnCategories",data.categories.map(c=>[c.id,c.label+(c.status==="available"?"":"（準備中）"),c.status!=="available"]),state.categories,render);
  chipGroup("wnNuances",Object.entries(data.nuances),state.nuances,render);
  chipGroup("wnLengths",Object.entries(W.LENGTHS),state.lengths,render);
  chipGroup("wnImpressions",Object.entries(data.impressions),state.impressions,render);
}
function clearFilters(){
  $("wnSearch").value="";$("wnFavoritesOnly").checked=false;
  for(const s of Object.values(state))s.clear();
  buildFilters();render();$("wnSearch").focus();
}

/* ---------- 語のカード ---------- */
function row(label,value,cls){
  const p=el("p",undefined,"wn-row"+(cls?" "+cls:""));p.append(el("span",label,"wn-label"),document.createTextNode(value));return p;
}
function favoriteButton(id){
  const b=button("");
  const refresh=()=>{const on=favorites.has(id);b.textContent=on?"★ お気に入り解除":"☆ お気に入り";b.setAttribute("aria-pressed",String(on));};
  refresh();
  b.addEventListener("click",()=>{
    const on=favorites.toggle(id);refresh();status(on?"お気に入りに登録しました":"お気に入りから解除しました");
    if($("wnFavoritesOnly").checked)render();
  });
  return b;
}
function card(item){
  const w=item.word,lang=data.languages[w.lang];
  const article=el("article",undefined,"wn-card");article.dataset.id=w.id;
  const head=el("div",undefined,"wn-head"),h=el("h2",w.lemma);h.lang=w.lang;
  const meta=el("p",lang.label+" ／ "+w.pos,"wn-meta");
  head.append(h,meta);article.append(head);

  const origin=el("section",undefined,"wn-origin");
  origin.append(el("h3","原語（辞書で確認した実在語）"));
  origin.append(row("意味",w.meaningJa),row("ニュアンス・注意",w.nuanceNote));
  const cats=w.categories.map(c=>data.categories.find(x=>x.id===c).label).concat((w.nuances||[]).map(n=>data.nuances[n]));
  origin.append(row("分類",cats.join("、")));
  if(w.pronunciation.ipa)origin.append(row("発音","["+w.pronunciation.ipa+"]"+(w.pronunciation.note?"（"+w.pronunciation.note+"）":"")));
  else origin.append(row("発音","未確認"+(w.pronunciation.note?"（"+w.pronunciation.note+"）":""),"wn-warn"));
  origin.append(row(w.kana.basis==="ipa"?"カタカナ読み（発音記号からの近似）":"カタカナ読み（目安・発音は未確認）",w.kana.text,w.kana.basis==="ipa"?"":"wn-warn"));
  const src=el("p",undefined,"wn-row"),url=W.safeUrl(w.source.url);
  src.append(el("span","出典","wn-label"));
  if(url){const a=el("a",w.source.dictionary+" で確認する");a.href=url;a.target="_blank";a.rel="noopener noreferrer";src.append(a);}
  else src.append(document.createTextNode(w.source.dictionary));
  origin.append(src);
  origin.append(row("確認状況",w.verification.status==="verified"?"確認済み（"+w.verification.date+"）— "+w.verification.scope:"未確認",w.verification.status==="verified"?"":"wn-warn"));
  origin.append(el("p","ID："+w.id,"wn-id"));
  article.append(origin);

  const made=el("section",undefined,"wn-made");
  made.append(el("h3","創作名の候補（造語）"));
  made.append(el("p","原語を加工して作った名前です。原語に実在する人名・単語ではありません。","wn-caution"));
  const list=el("div",undefined,"wn-cands");
  const shown=new Set(item.candidates.map(c=>c.id));
  for(const c of w.candidates){
    const b=button(undefined,"wn-cand"+(shown.has(c.id)?"":" dim"));b.dataset.cand=c.id;
    b.append(el("strong",c.name),el("span",data.methods[c.method],"wn-method"),el("span","印象："+c.note,"wn-note"));
    b.addEventListener("click",()=>openEditor(w,{candidateId:c.id,name:c.name,method:c.method}));
    list.append(b);
  }
  made.append(list);
  const actions=el("div",undefined,"actions");
  const own=button("この言葉から自分で作る");own.dataset.act="own";
  own.addEventListener("click",()=>openEditor(w,{name:"",method:"free"}));
  actions.append(own,favoriteButton(w.id));made.append(actions);
  article.append(made);
  return article;
}
function render(){
  if(!data)return;
  const out=W.filter(data,{query:$("wnSearch").value,langs:[...state.langs],categories:[...state.categories],nuances:[...state.nuances],
    lengths:[...state.lengths],impressions:[...state.impressions],ids:$("wnFavoritesOnly").checked?new Set(favorites.ids()):null});
  const box=$("wnResults");box.replaceChildren();
  $("wnCount").textContent="全"+data.words.length+"語 ／ 表示"+out.results.length+"語";
  const q=$("wnSearch").value.trim(),theme=$("wnTheme");
  if(q&&out.themeCategories.length)theme.textContent="「"+q+"」を、登録済みのテーマ「"+out.themeCategories.map(c=>data.categories.find(x=>x.id===c).label).join("」「")+"」に結びつけて探しました。";
  else if(q&&!out.results.length)theme.textContent="入力した言葉を翻訳して探す機能ではありません。登録済みの意味・テーマ・原語・読みから探します。";
  else theme.textContent="";
  if(!out.results.length)box.append(el("p","条件に合う言葉がありません。「条件をクリア」から探し直せます。","wn-empty"));
  const frag=document.createDocumentFragment();
  for(const item of out.results)frag.append(card(item));
  box.append(frag);box.setAttribute("aria-busy","false");
}

/* ---------- 創作名の編集・保存・連携 ---------- */
function ideaText(idea){return W.ideaToText(data,idea);}
async function copyText(text,message){
  try{await navigator.clipboard.writeText(text);status(message);}
  catch(e){$("wnCopyFallback").hidden=false;$("wnCopyText").value=text;$("wnCopyText").focus();$("wnCopyText").select();}
}
function sendToCreate(idea){
  try{sessionStorage.setItem("ocNameIdeaPending",JSON.stringify({name:idea.name,note:ideaText(idea)}));}catch(e){}
  location.href="./index.html?nameIdea="+encodeURIComponent(idea.name);
}
function sendToGlossary(idea){
  if(!studioReady()){status("作品を読み込めていないため、用語集へ送れません");return false;}
  const a=A(),world=a.S.project.world;
  let sec=world.sections.find(s=>s.key==="glossary");
  if(!sec){sec={id:a.C.uid("sec"),key:"glossary",title:"用語集",custom:false,entries:[]};world.sections.push(sec);}
  if(sec.entries.some(e=>e.title===idea.name)){status("用語集に同じ名前の項目があります");return false;}
  const entry=a.C.newEntry(idea.name,"固有名詞","");
  entry.body=ideaText(idea);sec.entries.push(entry);a.saveProject();
  status("「"+a.S.project.name+"」の用語集に追加しました");return true;
}
function saveIdea(idea){
  if(!studioReady()){status("作品を読み込めていないため、保存できません");return false;}
  const a=A(),list=a.S.project.nameIdeas,i=list.findIndex(x=>x.id===idea.id);
  if(i>=0)list[i]=idea;else list.push(idea);
  a.saveProject();renderIdeas();
  status("「"+a.S.project.name+"」の名前候補に保存しました");return true;
}
function wordOf(idea){return data&&data.words.find(w=>w.id===idea.wordId);}
function openEditor(word,init,existing){
  const a=A();
  if(!a){status("画面の準備ができていません");return;}
  const cand=word.candidates.find(c=>c.id===init.candidateId)||null;
  const sheet=a.sheet({title:existing?"名前候補を編集":"創作名を作る",html:""});
  const body=sheet.body;body.classList.add("wn-editor");
  const src=el("div",undefined,"wn-src");
  src.append(el("p","もとにした言葉（原語）","wn-label"),el("p",word.lemma+"（"+data.languages[word.lang].label+"・"+word.pos+"）","wn-src-lemma"),
    el("p","原語の意味："+word.meaningJa,"wn-src-meaning"));
  body.append(src);
  const f1=el("label",undefined,"st-field");f1.append(el("span","創作名（自由に編集できます）"));
  const name=el("input");name.type="text";name.maxLength=60;name.value=init.name||"";name.placeholder="例："+(word.candidates[0]?word.candidates[0].name:"");name.id="wnName";
  f1.append(name);body.append(f1);
  const lenNote=el("p","","st-note");lenNote.id="wnLen";body.append(lenNote);
  const f2=el("label",undefined,"st-field");f2.append(el("span","加工方法"));
  const method=el("select");method.id="wnMethod";
  for(const [k,v] of Object.entries(data.methods))method.append(new Option(v,k));
  method.value=init.method||"free";f2.append(method);body.append(f2);
  const f3=el("label",undefined,"st-field");f3.append(el("span","名前の意味・創作上の意図（原語の意味とは別に書きます）"));
  const intent=el("textarea");intent.rows=3;intent.id="wnIntent";intent.value=init.intent||"";
  intent.placeholder=cand?"候補の印象："+cand.note:"この名前に込めたいこと、どんな人物・組織に付けるか。";
  f3.append(intent);body.append(f3);
  body.append(el("p","この名前は創作上の造語です。原語に実在する人名・単語であることを示しません。","wn-caution"));
  const acts=el("div",undefined,"st-actions");
  const bSave=button(existing?"変更を保存":"この作品の名前候補に保存","btn-sm copy"),bCopy=button("名前をコピー","btn-sm"),
    bCreate=button("キャラ作成に送る","btn-sm"),bGloss=button("世界観の用語集へ送る","btn-sm");
  bSave.dataset.e="save";bCopy.dataset.e="copy";bCreate.dataset.e="create";bGloss.dataset.e="glossary";
  acts.append(bSave,bCopy,bCreate,bGloss);body.append(acts);
  let methodChosen=!!existing;
  function current(){
    return W.newIdea(data,word,{id:existing&&existing.id,createdAt:existing&&existing.createdAt,candidateId:init.candidateId,
      name:name.value,method:method.value,methodChosen,intent:intent.value});
  }
  function sync(){
    const n=name.value.trim();
    lenNote.textContent=n?W.moraCount(n)+"音・"+W.LENGTHS[W.lengthBucket(n)]:"名前を入力してください。";
    if(cand&&!methodChosen)method.value=W.normalize(n)===W.normalize(cand.name)?cand.method:"free"; // 候補から書き換えたら「自由編集」
    for(const b of [bSave,bCopy,bCreate,bGloss])b.disabled=!n;
  }
  name.addEventListener("input",sync);
  method.addEventListener("change",()=>{methodChosen=true;});
  bSave.addEventListener("click",()=>{if(saveIdea(current()))sheet.close();});
  bCopy.addEventListener("click",()=>copyText(name.value.trim(),"名前をコピーしました"));
  bGloss.addEventListener("click",()=>{sendToGlossary(current());});
  bCreate.addEventListener("click",async()=>{const idea=current();if(studioReady())await A().flush();sendToCreate(idea);});
  sync();name.focus();
}
function renderIdeas(){
  const box=$("wnIdeas"),title=$("wnIdeasTitle");if(!box)return;
  box.replaceChildren();
  if(!studioReady()){title.textContent="この作品の名前候補";box.append(el("p","作品を読み込んでいます…","wn-empty"));return;}
  const a=A(),list=ideas();
  title.textContent="「"+a.S.project.name+"」の名前候補（"+list.length+"件）";
  if(!list.length){box.append(el("p","まだありません。上の候補を選ぶか「この言葉から自分で作る」で作り、「この作品の名前候補に保存」を押すと、ここに残ります。作品のバックアップにも含まれます。","wn-empty"));return;}
  for(const idea of list.slice().sort((x,y)=>y.updatedAt-x.updatedAt)){
    const item=el("article",undefined,"wn-idea");item.dataset.idea=idea.id;
    item.append(el("h3",idea.name));
    const s=idea.source;
    item.append(row("もとにした言葉",s.lemma+"（"+s.langLabel+"・"+s.pos+"）"),row("原語の意味",s.meaningJa),
      row("加工方法",W.methodLabel(data,idea)+(idea.baseName&&idea.edited?"（候補「"+idea.baseName+"」から編集）":"")));
    if(idea.intent)item.append(row("創作上の意図",idea.intent));
    const acts=el("div",undefined,"actions");
    const mk=(label,act,fn)=>{const b=button(label);b.dataset.i=act;b.addEventListener("click",fn);acts.append(b);};
    const word=wordOf(idea);
    if(word)mk("編集","edit",()=>openEditor(word,{candidateId:idea.candidateId,name:idea.name,method:idea.method,intent:idea.intent},idea));
    mk("コピー","copy",()=>copyText(ideaText(idea),"名前と由来をコピーしました"));
    mk("キャラ作成に送る","create",async()=>{await a.flush();sendToCreate(idea);});
    mk("用語集へ送る","glossary",()=>sendToGlossary(idea));
    mk("削除","delete",async()=>{
      if(!(await a.confirmBox("名前候補「"+idea.name+"」を削除します。",{ok:"削除する",danger:true})))return;
      const l=a.S.project.nameIdeas,i=l.findIndex(x=>x.id===idea.id);if(i>=0)l.splice(i,1);
      a.saveProject();renderIdeas();status("削除しました");
    });
    item.append(acts);box.append(item);
  }
}

/* ---------- 起動 ---------- */
async function start(){
  loading=true;$("wnLoadError").hidden=true;$("wnLoadStatus").hidden=false;$("wnFilterControls").disabled=true;
  try{
    data=await W.load();
    favorites=W.favorites(()=>localStorage,msg=>{const w=$("wnStorageWarning");w.hidden=false;w.textContent=msg;});
    $("wnNotice").textContent=data.notice+" 現在は第"+data.stage+"段階（「"+data.categories.filter(c=>c.status==="available").map(c=>c.label).join("」「")+"」の"+data.words.length+"語）です。";
    buildFilters();$("wnFilterControls").disabled=false;$("wnLoadStatus").hidden=true;
    render();renderIdeas();
  }catch(e){
    console.error(e);$("wnLoadStatus").hidden=true;$("wnLoadError").hidden=false;$("wnResults").setAttribute("aria-busy","false");
  }finally{loading=false;}
}
function init(){
  initModes();
  $("wnSearch").addEventListener("input",render);
  $("wnFavoritesOnly").addEventListener("change",render);
  $("wnClear").addEventListener("click",clearFilters);
  $("wnRetry").addEventListener("click",start);
  $("wnCloseCopy").addEventListener("click",()=>{$("wnCopyFallback").hidden=true;});
  $("wnFilters").addEventListener("submit",e=>e.preventDefault());
  const a=A();
  if(a){a.on("project",renderIdeas);}
  document.addEventListener("ocstudio:ready",renderIdeas);
}
window.OCWordNamingPage={state:()=>({data,mode:$("modeWords").hidden?"find":"words"})};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
