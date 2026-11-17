/* 言葉から名付け — 画面の土台と「言葉を探す」。
   データ由来・利用者由来の文字列はすべてテキストノードとして入れる（HTMLとして解釈しない）。
   命名コレクションは word-naming-collections.js、複数キャラ命名は word-naming-batch.js。 */
(function(){
"use strict";
const W=window.OCWordNaming,$=id=>document.getElementById(id);
const A=()=>window.OCStudio;                       // 作品管理（共通ナビ）。読み込めなくても検索と閲覧は動かす
const PAGE=24;
let data=null,favorites=null,loading=false,limit=PAGE,leaving=false,group="",contrast="";
const SIDE_PAGE=6,sideLimit={a:SIDE_PAGE,b:SIDE_PAGE};
const state={langs:new Set(),categories:new Set(),nuances:new Set(),lengths:new Set(),impressions:new Set()};
const listeners={data:[],ideas:[]};
const SUBS=["find","collections","batch"];

function el(tag,text,cls){const e=document.createElement(tag);if(text!==undefined&&text!==null)e.textContent=text;if(cls)e.className=cls;return e;}
function button(text,cls){const b=el("button",text,cls);b.type="button";return b;}
function row(label,value,cls){
  const p=el("p",undefined,"wn-row"+(cls?" "+cls:""));p.append(el("span",label,"wn-label"),document.createTextNode(value));return p;
}
function field(label,control){const f=el("label",undefined,"st-field");f.append(el("span",label),control);return f;}
function status(text){const s=$("wnStatus");if(s)s.textContent=text;const a=A();if(a&&text)a.toast(text);}
/* 作品が開かれ、名前まわりの欄がそろっている（＝補修済み）ときだけ「準備できた」とみなす */
function studioReady(){
  const a=A(),p=a&&a.S.ready&&a.S.project;
  return !!(p&&Array.isArray(p.nameIdeas)&&Array.isArray(p.nameCollections)&&Array.isArray(p.nameUses));
}
function project(){return studioReady()?A().S.project:null;}
function ideas(){return studioReady()?A().S.project.nameIdeas:[];}
function emit(evt){listeners[evt].forEach(fn=>{try{fn();}catch(e){console.error(e);}});}

/* ---------- モード切り替え（名前を探す／言葉から名付け）と、その中の3機能 ---------- */
function currentSub(){const m=/^#words\/(\w+)$/.exec(location.hash);return m&&SUBS.includes(m[1])?m[1]:"find";}
function setHash(hash){try{const u=new URL(location.href);u.hash=hash;history.replaceState(null,"",u);}catch(e){}}
function setSub(sub,opts){
  if(!SUBS.includes(sub))sub="find";
  for(const s of SUBS){
    const on=s===sub,btn=$("wnTab-"+s);
    $("wnPane-"+s).hidden=!on;btn.setAttribute("aria-selected",String(on));btn.tabIndex=on?0:-1;
  }
  if(!(opts&&opts.silent))setHash(sub==="find"?"words":"words/"+sub);
  emit("ideas");
}
function setMode(mode,opts){
  const words=mode==="words";
  $("modeFind").hidden=words;$("modeWords").hidden=!words;
  $("modeFindBtn").setAttribute("aria-selected",String(!words));$("modeWordsBtn").setAttribute("aria-selected",String(words));
  $("modeFindBtn").tabIndex=words?-1:0;$("modeWordsBtn").tabIndex=words?0:-1;
  if(!(opts&&opts.silent))setHash(words?"words":"");
  if(words){setSub(currentSub(),{silent:true});if(!data&&!loading)start();}
}
function arrowKeys(host,order,current,go){
  host.addEventListener("keydown",e=>{
    if(e.key!=="ArrowRight"&&e.key!=="ArrowLeft")return;
    const i=order.indexOf(current()),next=order[(i+(e.key==="ArrowRight"?1:order.length-1))%order.length];
    go(next);e.preventDefault();
  });
}
function initModes(){
  $("modeFindBtn").addEventListener("click",()=>setMode("find"));
  $("modeWordsBtn").addEventListener("click",()=>setMode("words"));
  arrowKeys($("wnModes"),["find","words"],()=>$("modeWords").hidden?"find":"words",next=>{setMode(next);$(next==="words"?"modeWordsBtn":"modeFindBtn").focus();});
  for(const s of SUBS)$("wnTab-"+s).addEventListener("click",()=>setSub(s));
  arrowKeys($("wnSubtabs"),SUBS,currentSub,next=>{setSub(next);$("wnTab-"+next).focus();});
  const fromHash=()=>setMode(location.hash.startsWith("#words")?"words":"find",{silent:true});
  window.addEventListener("hashchange",fromHash);fromHash();
}

/* ---------- 絞り込み ---------- */
function chipGroup(host,entries,set,onChange){
  host=typeof host==="string"?$(host):host;host.replaceChildren();
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
function changed(){limit=PAGE;sideLimit.a=sideLimit.b=SIDE_PAGE;render();}
/* 大分類（すべて／明／陰／両義）。色だけに頼らず、必ず文字のラベルを出す */
function groupBadge(g,long){const b=el("span",long?data.groups[g].label:data.groups[g].short,"wn-badge");b.dataset.group=g;return b;}
function catsOf(g){return data.categories.filter(c=>c.status==="available"&&(!g||c.group===g));}
function setGroup(g){
  group=g;
  if(g)for(const id of [...state.categories])if((data.categories.find(c=>c.id===id)||{}).group!==g)state.categories.delete(id);
  buildGroups();buildCategories();changed();
}
function buildGroups(){
  const host=$("wnGroups");host.replaceChildren();
  for(const [value,label] of [["","すべて"]].concat(Object.entries(data.groups||{}).map(([k,v])=>[k,v.label]))){
    const b=button(label);b.dataset.value=value;b.setAttribute("role","radio");b.setAttribute("aria-checked",String(group===value));if(value)b.dataset.group=value;
    b.addEventListener("click",()=>setGroup(value));host.append(b);
  }
  $("wnGroupNote").textContent=group?data.groups[group].note:"明・陰・両義の分類は創作上のテーマによるものです。語の意味を善悪に断定するものではありません。";
}
function catEntries(g){return catsOf(g).map(c=>[c.id,c.label]);}
/* 33カテゴリを一度に並べない。「すべて」のときは大分類ごとに折りたたみ、大分類を選んだらその分だけ並べる */
function buildCategories(){
  const host=$("wnCategories");host.replaceChildren();
  if(!data.groups){const d=el("div",undefined,"chips");host.append(d);chipGroup(d,catEntries(""),state.categories,changed);return;}
  if(group){
    const d=el("div",undefined,"chips");d.dataset.group=group;host.append(d);chipGroup(d,catEntries(group),state.categories,changed);
  }else for(const g of Object.keys(data.groups)){
    const det=el("details",undefined,"wn-catgroup");det.dataset.group=g;
    const picked=catsOf(g).filter(c=>state.categories.has(c.id)).length;
    const sum=el("summary"),txt=el("span");sum.append(groupBadge(g),txt);
    const label=()=>{const n=catsOf(g).filter(c=>state.categories.has(c.id)).length;txt.textContent=" "+data.groups[g].label+"（"+catsOf(g).length+"カテゴリ"+(n?"・"+n+"件選択中":"")+"）";};label();
    const d=el("div",undefined,"chips");d.dataset.group=g;det.append(sum,d);if(picked||g===Object.keys(data.groups)[0])det.open=true;host.append(det);
    chipGroup(d,catEntries(g),state.categories,()=>{label();changed();});
  }
}
function renderSelected(){
  const p=$("wnCatSelected"),ids=[...state.categories];p.hidden=!ids.length;
  p.querySelector("span").textContent=ids.length?"選択中："+ids.map(id=>W.categoryLabel(data,id)).join("、"):"";
}
function buildContrasts(){
  const sel=$("wnContrast");sel.replaceChildren(new Option("対比しない",""));
  for(const [kind,label] of Object.entries(W.CONTRAST_KINDS)){
    const list=(data.contrasts||[]).filter(c=>c.kind===kind);if(!list.length)continue;
    const og=document.createElement("optgroup");og.label=label;
    for(const c of list)og.append(new Option(W.contrastTitle(c),c.id));
    sel.append(og);
  }
  sel.value=contrast;$("wnContrastBox").hidden=!(data.contrasts||[]).length;
}
function setContrast(id){
  contrast=W.contrastById(data,id)?id:"";$("wnContrast").value=contrast;
  if(contrast)$("wnContrastBox").open=true;
  changed();
}
function buildFilters(){
  chipGroup("wnLangs",Object.entries(data.languages).map(([k,v])=>[k,v.label]),state.langs,changed);
  buildGroups();buildCategories();buildContrasts();
  chipGroup("wnNuances",Object.entries(data.nuances),state.nuances,changed);
  chipGroup("wnLengths",Object.entries(W.LENGTHS),state.lengths,changed);
  chipGroup("wnImpressions",Object.entries(data.impressions),state.impressions,changed);
  const scope=$("wnScope");scope.replaceChildren(...Object.entries(W.SCOPES).map(([k,v])=>new Option(v,k)));
}
function categoryMode(){const r=document.querySelector('input[name="wnCatMode"]:checked');return r&&r.value==="and"?"and":"or";}
function options(){
  return {query:$("wnSearch").value,scope:$("wnScope").value||"all",langs:[...state.langs],group,categories:[...state.categories],categoryMode:categoryMode(),
    nuances:[...state.nuances],lengths:[...state.lengths],impressions:[...state.impressions],ids:$("wnFavoritesOnly").checked?new Set(favorites.ids()):null};
}
function clearFilters(){
  $("wnSearch").value="";$("wnFavoritesOnly").checked=false;$("wnScope").value="all";
  document.querySelector('input[name="wnCatMode"][value="or"]').checked=true;
  for(const s of Object.values(state))s.clear();
  group="";contrast="";
  buildFilters();changed();$("wnSearch").focus();
}
/* 0件の案内から呼ぶ：条件をひとつ緩める */
function relax(key){
  if(key==="query")$("wnSearch").value="";
  else if(key==="scope")$("wnScope").value="all";
  else if(key==="categoryMode")document.querySelector('input[name="wnCatMode"][value="or"]').checked=true;
  else if(key==="ids")$("wnFavoritesOnly").checked=false;
  else if(key==="group"){setGroup("");return;}
  else if(state[key]){state[key].clear();buildFilters();}
  changed();
}
function useTheme(id){
  $("wnSearch").value="";state.categories.clear();state.categories.add(id);
  const g=(data.categories.find(c=>c.id===id)||{}).group;if(group&&g!==group)group="";contrast="";
  document.querySelector('input[name="wnCatMode"][value="or"]').checked=true;buildFilters();changed();
}

/* ---------- 語のカード ---------- */
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
  head.append(h,el("p",lang.label+" ／ "+w.pos,"wn-meta"));article.append(head);
  const groups=W.wordGroups(data,w);
  if(groups.length){
    article.dataset.group=groups[0];
    const themes=el("p",undefined,"wn-themes");
    for(const g of groups){themes.append(groupBadge(g,true));themes.append(document.createTextNode(w.categories.filter(c=>(data.categories.find(x=>x.id===c)||{}).group===g).map(c=>W.categoryLabel(data,c)).join("、")+" "));}
    article.append(themes);
  }

  const origin=el("section",undefined,"wn-origin");
  origin.append(el("h3","原語（辞書で確認した実在語）"));
  origin.append(row("意味",w.meaningJa),row("ニュアンス・注意",w.nuanceNote));
  origin.append(row(w.kana.basis==="ipa"?"カタカナ読み（発音記号からの近似）":"カタカナ読み（目安・発音は未確認）",w.kana.text,w.kana.basis==="ipa"?"":"wn-warn"));
  const more=el("details",undefined,"wn-detail");more.append(el("summary","発音・分類・出典・確認状況"));
  if(w.pronunciation.ipa)more.append(row("発音","["+w.pronunciation.ipa+"]"+(w.pronunciation.note?"（"+w.pronunciation.note+"）":"")));
  else more.append(row("発音","未確認"+(w.pronunciation.note?"（"+w.pronunciation.note+"）":""),"wn-warn"));
  more.append(row("分類",w.categories.map(c=>W.categoryLabel(data,c)).concat((w.nuances||[]).map(n=>data.nuances[n])).join("、")));
  const src=el("p",undefined,"wn-row"),url=W.safeUrl(w.source.url);
  src.append(el("span","出典","wn-label"));
  if(url){const a=el("a",w.source.dictionary+" で確認する");a.href=url;a.target="_blank";a.rel="noopener noreferrer";src.append(a);}
  else src.append(document.createTextNode(w.source.dictionary));
  more.append(src);
  const verified=w.verification.status==="verified";
  more.append(row("確認状況",verified?"確認済み（"+w.verification.date+"）— "+w.verification.scope:"未確認",verified?"":"wn-warn"));
  if(verified&&data.access&&data.access[w.verification.access])more.append(row("確認方法",data.access[w.verification.access]));
  more.append(el("p","ID："+w.id,"wn-id"));
  origin.append(more);article.append(origin);

  const made=el("section",undefined,"wn-made");
  made.append(el("h3","創作名の候補"));
  made.append(el("p","創作向けに加工した候補です。実在する人名・単語との重複は未確認です。","wn-caution"));
  const list=el("div",undefined,"wn-cands");
  const shown=new Set(item.candidates.map(c=>c.id));
  for(const c of w.candidates){
    const b=button(undefined,"wn-cand"+(shown.has(c.id)?"":" dim"));b.dataset.cand=c.id;
    b.append(el("strong",c.name),el("span",data.methods[c.method],"wn-method"),el("span","印象："+c.note,"wn-note"),
      el("span","実在の人名・単語との重なり："+W.overlapText(c.overlap),"wn-overlap"+(c.overlap?" known":"")));
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
function renderSuggest(opts,out){
  const box=$("wnSuggest");box.replaceChildren();
  if(out.results.length){box.hidden=true;return;}
  box.hidden=false;
  box.append(el("p","条件に合う言葉がありません。","wn-suggest-lead"));
  const q=opts.query.trim(),s=W.suggest(data,opts);
  if(q&&!out.themeCategories.length)box.append(el("p","入力した言葉を翻訳して探す機能ではありません。登録済みの意味・テーマ・原語・読み・創作名から探します。","wn-note"));
  if(s.themes.length){
    box.append(el("p","近いテーマから探す","wn-label"));
    const g=el("div",undefined,"chips");
    for(const id of s.themes){const b=button(W.categoryLabel(data,id));b.dataset.theme=id;b.addEventListener("click",()=>useTheme(id));g.append(b);}
    box.append(g);
  }
  if(s.relax.length){
    box.append(el("p","条件をゆるめる","wn-label"));
    const g=el("div",undefined,"chips");
    for(const r of s.relax){const b=button(r.label+"（"+r.count+"語）");b.dataset.relax=r.key;b.addEventListener("click",()=>relax(r.key));g.append(b);}
    box.append(g);
  }
  const all=button("条件をすべてクリア");all.dataset.relax="all";all.addEventListener("click",clearFilters);box.append(all);
}
/* テーマの対比：A側とB側を、同じ絞り込み条件で並べて見せる */
function renderContrast(opts){
  const r=W.contrastResults(data,contrast,opts),c=r.contrast,box=$("wnResults");box.replaceChildren();
  $("wnCount").textContent="対比："+W.contrastTitle(c)+" ／ "+c.a.label+" "+r.a.results.length+"語・"+c.b.label+" "+r.b.results.length+"語";
  $("wnTheme").textContent="";$("wnSuggest").hidden=true;$("wnMore").hidden=true;
  for(const key of ["a","b"]){
    const side=r[key],sec=el("section",undefined,"wn-side");sec.dataset.side=key;sec.dataset.group=(data.categories.find(x=>x.id===side.category)||{}).group||"";
    const h=el("h2",undefined,"wn-side-title");h.append(groupBadge(sec.dataset.group),document.createTextNode(" "+(key==="a"?"A":"B")+"：「"+side.label+"」の言葉（"+W.categoryLabel(data,side.category)+"・"+side.results.length+"語）"));
    sec.append(h);
    if(!side.results.length)sec.append(el("p","この条件では見つかりません。言語や名前の長さ・印象の絞り込みをゆるめてください。","wn-empty"));
    for(const item of side.results.slice(0,sideLimit[key]))sec.append(card(item));
    if(side.results.length>sideLimit[key]){
      const more=button("「"+side.label+"」をもっと見る（残り"+(side.results.length-sideLimit[key])+"語）","wn-side-more");more.dataset.more=key;
      more.addEventListener("click",()=>{sideLimit[key]+=SIDE_PAGE;render();});sec.append(more);
    }
    box.append(sec);
  }
  box.setAttribute("aria-busy","false");
}
function renderContrastControls(){
  const c=contrast&&W.contrastById(data,contrast),note=$("wnContrastNote");
  $("wnThemeBox").disabled=!!c;$("wnContrastOff").hidden=!c;$("wnContrastCollect").hidden=!c;note.hidden=!c;
  note.replaceChildren();
  if(c){
    note.dataset.kind=c.kind;
    note.append(el("strong",W.CONTRAST_KINDS[c.kind]),el("br"),document.createTextNode(c.kind==="lexical"
      ?c.evidence+" ただし、ここに並ぶ語のすべてが互いに対義語というわけではありません（テーマどうしの対比です）。"
      :c.note+" 創作上の対照として並べています。辞書で対義語とされているわけではありません。"));
  }
}
function contrastCollection(){
  const c=W.contrastById(data,contrast);if(!c)return;
  if(!studioReady()){status("作品を読み込めていないため、作れません");return;}
  const a=A(),p=a.S.project,name=c.a.label+"と"+c.b.label;
  if(p.nameCollections.some(x=>x.name===name)){status("コレクション「"+name+"」はすでにあります。名前を保存するときに選べます");return;}
  const col=a.C.newCollection(name);
  col.theme="対比："+c.a.label+"（"+W.categoryLabel(data,c.a.category)+"）↔ "+c.b.label+"（"+W.categoryLabel(data,c.b.category)+"）";
  col.memo=W.CONTRAST_KINDS[c.kind]+"。A：「"+c.a.label+"」を表す名前／B：「"+c.b.label+"」を表す名前。";
  p.nameCollections.push(col);a.saveProject();emit("ideas");
  status("コレクション「"+name+"」を作りました。名前を保存するときに、このコレクションを選べます");
}
function render(){
  if(!data)return;
  $("wnCatModeBox").hidden=state.categories.size<2;renderSelected();renderContrastControls();
  const opts=options();
  if(contrast&&W.contrastById(data,contrast)){renderContrast(opts);return;}
  const out=W.filter(data,opts);
  const box=$("wnResults");box.replaceChildren();
  const shown=Math.min(limit,out.results.length);
  $("wnCount").textContent="全"+data.words.length+"語 ／ 該当"+out.results.length+"語"+(shown<out.results.length?"（"+shown+"語を表示中）":"");
  const q=opts.query.trim(),theme=$("wnTheme");
  if(q&&out.themeCategories.length)theme.textContent="「"+q+"」を、登録済みのテーマ「"+out.themeCategories.map(c=>W.categoryLabel(data,c)).join("」「")+"」に結びつけて探しました。";
  else theme.textContent="";
  renderSuggest(opts,out);
  const frag=document.createDocumentFragment();
  for(const item of out.results.slice(0,shown))frag.append(card(item));
  box.append(frag);box.setAttribute("aria-busy","false");
  $("wnMore").hidden=shown>=out.results.length;
}
function showMore(){
  const old=$("wnResults").querySelectorAll("article.wn-card").length;
  limit+=PAGE;render();
  const h=$("wnResults").querySelectorAll("article.wn-card")[old];
  if(h){const t=h.querySelector("h2");t.tabIndex=-1;t.focus({preventScroll:true});}
}
function renderIdeasLink(){
  const p=$("wnIdeasLink");if(!p)return;
  const n=ideas().length,cols=project()?project().nameCollections.length:0;
  p.hidden=!studioReady();
  p.querySelector("span").textContent=studioReady()?"「"+A().S.project.name+"」に保存した名前候補："+n+"件 ／ コレクション："+cols+"件":"";
}

/* ---------- 創作名の編集・保存・連携 ---------- */
function ideaText(idea){return W.ideaToText(data,idea);}
async function copyText(text,message){
  try{await navigator.clipboard.writeText(text);status(message);}
  catch(e){$("wnCopyFallback").hidden=false;$("wnCopyText").value=text;$("wnCopyText").focus();$("wnCopyText").select();}
}
function sendToCreate(idea){
  try{sessionStorage.setItem("ocNameIdeaPending",JSON.stringify({name:idea.name,note:ideaText(idea)}));}catch(e){}
  leaving=true;
  location.href="./index.html?nameIdea="+encodeURIComponent(idea.name);
}
function saveIdea(idea,opts){
  if(!studioReady()){status("作品を読み込めていないため、保存できません");return false;}
  const a=A(),list=a.S.project.nameIdeas,i=list.findIndex(x=>x.id===idea.id);
  if(i>=0)list[i]=idea;else list.push(idea);
  a.saveProject();emit("ideas");
  if(!(opts&&opts.quiet))status("「"+a.S.project.name+"」の名前候補に保存しました");
  return true;
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
  const name=el("input");name.type="text";name.maxLength=60;name.value=init.name||"";name.placeholder="例："+(word.candidates[0]?word.candidates[0].name:"");name.id="wnName";
  body.append(field("創作名（自由に編集できます）",name));
  const lenNote=el("p","","st-note");lenNote.id="wnLen";body.append(lenNote);
  const method=el("select");method.id="wnMethod";
  for(const [k,v] of Object.entries(data.methods))method.append(new Option(v,k));
  method.value=init.method||"free";body.append(field("加工方法",method));
  const intent=el("textarea");intent.rows=3;intent.id="wnIntent";intent.value=init.intent||"";
  intent.placeholder=cand?"候補の印象："+cand.note:"この名前に込めたいこと、どんな人物・組織に付けるか。";
  body.append(field("名前の意味・創作上の意図（原語の意味とは別に書きます）",intent));
  const col=el("select");col.id="wnCollection";
  const fillCollections=()=>{
    col.replaceChildren(new Option("入れない",""),...(project()?project().nameCollections:[]).map(c=>new Option(c.name,c.id)),new Option("＋ 新しいコレクションを作る","__new"));
  };
  fillCollections();
  const colName=el("input");colName.type="text";colName.maxLength=60;colName.id="wnCollectionName";colName.placeholder="例：全肯定する兄弟";
  const colNameField=field("新しいコレクションの名前",colName);colNameField.hidden=true;
  if(!existing){body.append(field("命名コレクションに入れる（任意）",col),colNameField);col.addEventListener("change",()=>{colNameField.hidden=col.value!=="__new";if(!colNameField.hidden)colName.focus();});}
  const overlap=el("p","","wn-caution");overlap.id="wnOverlap";body.append(overlap);
  const acts=el("div",undefined,"st-actions");
  const bSave=button(existing?"変更を保存":"この作品の名前候補に保存","btn-sm copy"),bCopy=button("名前をコピー","btn-sm"),
    bCreate=button("キャラ作成に送る","btn-sm"),bUse=button("使う先を選ぶ（家名・地名・用語など）","btn-sm");
  bSave.dataset.e="save";bCopy.dataset.e="copy";bCreate.dataset.e="create";bUse.dataset.e="use";
  acts.append(bSave,bCopy,bCreate,bUse);body.append(acts);
  let methodChosen=!!existing;
  function current(){
    return W.newIdea(data,word,{id:existing&&existing.id,createdAt:existing&&existing.createdAt,candidateId:init.candidateId,
      name:name.value,method:method.value,methodChosen,intent:intent.value});
  }
  function sync(){
    const n=name.value.trim(),same=cand&&W.normalize(n)===W.normalize(cand.name);
    lenNote.textContent=n?W.moraCount(n)+"音・"+W.LENGTHS[W.lengthBucket(n)]:"名前を入力してください。";
    if(cand&&!methodChosen)method.value=same?cand.method:"free"; // 候補から書き換えたら「自由編集」
    overlap.textContent="実在の人名・単語との重なり："+W.overlapText(same?cand.overlap:"")+"。"+W.CAUTION;
    for(const b of [bSave,bCopy,bCreate,bUse])b.disabled=!n;
  }
  /* 保存し、指定があればコレクションに入れる。成功したら保存した候補を返す */
  function commit(){
    const idea=current();
    if(!saveIdea(idea))return null;
    if(!existing&&col.value){
      const C=a.C,p=a.S.project;let target=p.nameCollections.find(c=>c.id===col.value);
      if(col.value==="__new"){target=C.newCollection(colName.value||"命名コレクション");p.nameCollections.push(target);}
      if(target&&!target.items.some(i=>i.ideaId===idea.id)){target.items.push({ideaId:idea.id,note:""});target.updatedAt=Date.now();}
      a.saveProject();emit("ideas");
      if(target)status("名前候補に保存し、コレクション「"+target.name+"」に入れました");
    }
    return idea;
  }
  name.addEventListener("input",sync);
  method.addEventListener("change",()=>{methodChosen=true;});
  bSave.addEventListener("click",()=>{if(commit())sheet.close();});
  bCopy.addEventListener("click",()=>copyText(name.value.trim(),"名前をコピーしました"));
  bUse.addEventListener("click",()=>{
    const idea=commit();if(!idea)return;
    sheet.close();
    if(window.OCWordNamingCollections)window.OCWordNamingCollections.openUse(idea);
  });
  bCreate.addEventListener("click",async()=>{const idea=current();if(studioReady())await A().flush();sendToCreate(idea);});
  sync();name.focus();
}

/* 登録済みキャラクターに名前を付ける。確認はここでは行わない（呼び出し側が確認画面を出してから呼ぶ）。 */
function applyNameToCharacter(c,idea,name,intent){
  const a=A(),C=a.C,p=a.S.project,old=C.displayName(c),had=!!String(c.name||"").trim();
  name=String(name).trim();
  const note=C.nameUseBody(idea,name,intent)+(had&&c.name!==name?"\n以前の名前："+old:"");
  const prev=String(c.profile.nameNote||"").trim();
  c.profile.nameNote=(note+(prev?"\n\n（以前のメモ）\n"+prev:"")).slice(0,3000);
  c.name=name;
  p.nameUses=p.nameUses.filter(u=>!(u.targetType==="character"&&u.targetId===c.id));
  p.nameUses.push(C.newNameUse(idea,"character",name,intent,c.id));
  a.saveChar(c);a.saveProject();
}

/* ---------- 起動 ---------- */
async function start(){
  loading=true;$("wnLoadError").hidden=true;$("wnLoadStatus").hidden=false;$("wnFilterControls").disabled=true;
  try{
    data=await W.load();
    favorites=W.favorites(()=>localStorage,msg=>{const w=$("wnStorageWarning");w.hidden=false;w.textContent=msg;});
    $("wnNotice").textContent=data.notice+" 収録："+data.categories.filter(c=>c.status==="available").length+"カテゴリ・"+data.words.length+"語・創作名の候補"+
      data.words.reduce((n,w)=>n+w.candidates.length,0)+"件。語義の確認は、辞書サイトの検索結果の抜粋、または取得した辞書ページの読み取りによるもので、人がページ全文を読んだ確認ではありません（確認方法は語ごとに「確認状況」に記載）。";
    buildFilters();$("wnFilterControls").disabled=false;$("wnLoadStatus").hidden=true;
    render();emit("data");emit("ideas");
  }catch(e){
    // ページを離れる途中で読み込みが打ち切られたときは、失敗として扱わない（エラーも出さない）
    if(leaving)return;
    console.error(e);$("wnLoadStatus").hidden=true;$("wnLoadError").hidden=false;$("wnResults").setAttribute("aria-busy","false");
  }finally{loading=false;}
}
function init(){
  listeners.ideas.push(renderIdeasLink);
  initModes();
  $("wnSearch").addEventListener("input",changed);
  $("wnScope").addEventListener("change",changed);
  $("wnFavoritesOnly").addEventListener("change",changed);
  for(const r of document.querySelectorAll('input[name="wnCatMode"]'))r.addEventListener("change",changed);
  $("wnClear").addEventListener("click",clearFilters);
  $("wnCatClear").addEventListener("click",()=>{state.categories.clear();buildCategories();changed();});
  $("wnContrast").addEventListener("change",e=>setContrast(e.target.value));
  $("wnContrastOff").addEventListener("click",()=>setContrast(""));
  $("wnContrastCollect").addEventListener("click",contrastCollection);
  $("wnMore").addEventListener("click",showMore);
  $("wnRetry").addEventListener("click",start);
  $("wnGoCollections").addEventListener("click",()=>{setSub("collections");$("wnTab-collections").focus();});
  $("wnCloseCopy").addEventListener("click",()=>{$("wnCopyFallback").hidden=true;});
  $("wnFilters").addEventListener("submit",e=>e.preventDefault());
  window.addEventListener("pagehide",()=>{leaving=true;});
  window.addEventListener("pageshow",()=>{leaving=false;});
  const a=A();
  if(a){a.on("project",()=>emit("ideas"));}
  document.addEventListener("ocstudio:ready",()=>emit("ideas"));
}
window.OCWordNamingPage={W,A,el,button,row,field,status,studioReady,project,ideas,chipGroup,
  data:()=>data,state:()=>({data,mode:$("modeWords").hidden?"find":"words",sub:currentSub()}),
  on:(evt,fn)=>{listeners[evt].push(fn);},emit,setSub,groupBadge,catsOf,ideaText,copyText,sendToCreate,saveIdea,wordOf,openEditor,applyNameToCharacter};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
