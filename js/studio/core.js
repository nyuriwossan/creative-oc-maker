/* 創作OCメーカー v2.0 — 共通データ構造（DOM非依存・Nodeでも検証可能） */
(function(root,factory){
  if(typeof module==="object"&&module.exports)module.exports=factory();
  else root.OCStudioCore=factory();
})(typeof self!=="undefined"?self:this,function(){
"use strict";

const FORMAT="creative-oc-maker-project";
const FORMAT_VERSION=3; // 3: 命名コレクション・名前の利用先（v2.2）。2以下のバックアップもそのまま読める

let seq=0;
function uid(prefix){
  seq=(seq+1)%1679616;
  return (prefix||"id")+"_"+Date.now().toString(36)+seq.toString(36).padStart(4,"0")+Math.random().toString(36).slice(2,8);
}
const str=v=>v==null?"":String(v);
const clone=o=>JSON.parse(JSON.stringify(o));

/* ---------- 世界観 ---------- */
const SECTION_DEFS=[
  {key:"geography",title:"地理",hint:"国家・地域・都市・施設",kinds:["国家","地域","都市","施設"]},
  {key:"society",title:"社会",hint:"身分・法律・政治・文化・宗教",kinds:["身分","法律","政治","文化","宗教"]},
  {key:"organization",title:"組織",hint:"家系・学校・軍・企業・派閥",kinds:["家系","学校","軍","企業","派閥"]},
  {key:"special",title:"特殊設定",hint:"魔法・能力・種族・独自の世界法則",kinds:["魔法","能力","種族","世界法則"]},
  {key:"history",title:"歴史",hint:"事件・年表・伝承",kinds:["事件","年表","伝承"]},
  {key:"glossary",title:"用語集",hint:"固有名詞・独自用語・解説",kinds:["固有名詞","独自用語"]}
];
const TEMPLATES={
  blank:{label:"白紙",genre:"",note:"何も入れずに自由に書き始めます。",entries:{}},
  modern:{label:"現代",genre:"現代",note:"学校・職場・街など、身近な舞台向け。",entries:{
    geography:[["主な舞台の街","都市","どんな街か。都会か地方か、雰囲気や季節感。"],["よく行く場所","施設","学校、職場、店、家など物語でよく出る場所。"]],
    society:[["この世界の常識","文化","現実と同じ点・少し違う点。"]],
    organization:[["学校・職場","学校","登場人物が所属する場所。"]],
    special:[["現実と違う点","世界法則","無ければ空欄でかまいません。"]],
    history:[["物語が始まる前の出来事","事件","登場人物に影響している過去。"]]}},
  fantasy:{label:"ファンタジー",genre:"ファンタジー",note:"国・魔法・種族などを持つ世界向け。",entries:{
    geography:[["中心となる国","国家","統治者、気候、特色。"],["辺境・未踏の地","地域","危険や謎のある場所。"]],
    society:[["身分制度","身分","王族・貴族・平民など。"],["信仰・宗教","宗教","神々や教会、禁忌。"]],
    organization:[["王家・貴族の家系","家系","家名、当主、家同士の関係。"],["ギルド・騎士団","派閥","目的と序列。"]],
    special:[["魔法のしくみ","魔法","誰が使えるか、代償や限界。"],["種族","種族","人間以外の種族と特徴。"]],
    history:[["建国と大きな戦い","事件","今の情勢を作った出来事。"],["伝承・神話","伝承","語り継がれている話。"]]}},
  scifi:{label:"SF",genre:"SF",note:"未来・宇宙・技術が中心の世界向け。",entries:{
    geography:[["拠点となる都市・コロニー","都市","人口、階層、環境。"],["宇宙・惑星","地域","行き来できる範囲。"]],
    society:[["統治体制","政治","誰が支配しているか。"],["技術と暮らし","文化","技術が日常をどう変えたか。"]],
    organization:[["企業・政府機関","企業","力を持つ組織と目的。"],["軍・治安組織","軍","装備と役割。"]],
    special:[["中核となる技術","世界法則","物語の鍵になる技術とその限界。"],["AI・人造生命","種族","権利や扱われ方。"]],
    history:[["転換点となった事件","事件","現在の社会を決めた出来事。"]]}},
  wafu:{label:"和風・歴史",genre:"和風",note:"都・家・しきたりのある世界向け。",entries:{
    geography:[["都","都市","政の中心。"],["里・領地","地域","登場人物の故郷や所領。"]],
    society:[["身分と家","身分","家格、継承、婚姻の決まり。"],["しきたり・年中行事","文化","儀礼や禁忌。"]],
    organization:[["家系・一族","家系","本家と分家、家紋など。"],["朝廷・寺社","派閥","権力を持つ集団。"]],
    special:[["あやかし・呪術","能力","存在するか、どう扱われるか。"]],
    history:[["戦・政変","事件","世を変えた出来事。"],["言い伝え","伝承","土地に残る話。"]]}}
};
function newEntry(title,kind,hint){
  return {id:uid("ent"),title:str(title),kind:str(kind),when:"",reading:"",body:"",hint:str(hint)};
}
function defaultWorld(templateKey){
  const world={template:"",overview:{title:"",genre:"",era:"",stage:"",summary:""},
    sections:SECTION_DEFS.map(d=>({id:uid("sec"),key:d.key,title:d.title,custom:false,entries:[]}))};
  if(templateKey)applyTemplate(world,templateKey);
  return world;
}
/* テンプレートは「足りない項目を足す」だけ。既存の記述は書き換えない。 */
function applyTemplate(world,templateKey){
  const t=TEMPLATES[templateKey];if(!t)return 0;
  let added=0;
  world.template=templateKey;
  if(!world.overview.genre&&t.genre)world.overview.genre=t.genre;
  for(const [key,rows] of Object.entries(t.entries)){
    const sec=world.sections.find(s=>s.key===key);if(!sec)continue;
    for(const [title,kind,hint] of rows){
      if(sec.entries.some(e=>e.title===title))continue;
      sec.entries.push(newEntry(title,kind,hint));added++;
    }
  }
  return added;
}
function allEntries(world){
  const out=[];
  for(const sec of (world&&world.sections)||[])for(const e of sec.entries)out.push({section:sec,entry:e});
  return out;
}
function worldToText(world,chars){
  const lines=[],o=world.overview||{};
  lines.push("【世界の概要】");
  for(const [k,l] of [["title","作品名"],["genre","ジャンル"],["era","時代"],["stage","舞台"],["summary","概要"]])if(str(o[k]).trim())lines.push(l+"："+o[k]);
  for(const sec of world.sections){
    const filled=sec.entries.filter(e=>e.title.trim()||e.body.trim());
    if(!filled.length)continue;
    lines.push("","【"+sec.title+"】");
    for(const e of filled){
      const head=[e.when,e.title,e.reading?"（"+e.reading+"）":"",e.kind?"［"+e.kind+"］":""].filter(Boolean).join(" ");
      lines.push("■ "+head.trim());
      if(e.body.trim())lines.push(e.body.trim());
      const members=(chars||[]).filter(c=>(c.affiliations||[]).includes(e.id)).map(c=>displayName(c));
      if(members.length)lines.push("関連キャラ："+members.join("、"));
    }
  }
  return lines.join("\n");
}

/* ---------- 作品 ---------- */
function newProject(name,templateKey){
  const now=Date.now();
  return {id:uid("prj"),name:str(name).trim()||"マイ作品",createdAt:now,updatedAt:now,
    world:defaultWorld(templateKey),
    heightCompare:{items:[],bg:"#F7F5F0",showScale:true,showNames:true},
    charts:[],nameIdeas:[],nameCollections:[],nameUses:[]};
}
/* 「言葉から名付け」で作品に保存した創作名。作品レコードの中に持つので、バックアップ・復元・複製の対象になる。 */
function sanitizeNameIdeas(list){
  return (Array.isArray(list)?list:[]).filter(x=>x&&typeof x==="object"&&str(x.name).trim()).map(x=>{
    const s=x.source&&typeof x.source==="object"?x.source:{};
    return {id:str(x.id)||uid("idea"),name:str(x.name).trim().slice(0,60),wordId:str(x.wordId),dataVersion:str(x.dataVersion),
      candidateId:x.candidateId?str(x.candidateId):null,baseName:str(x.baseName),
      method:["kana","short","adjust","free"].includes(x.method)?x.method:"free",edited:!!x.edited,intent:typeof x.intent==="string"?x.intent.slice(0,2000):"",
      overlap:typeof x.overlap==="string"?x.overlap.slice(0,200):"",
      createdAt:Number.isFinite(x.createdAt)?x.createdAt:Date.now(),updatedAt:Number.isFinite(x.updatedAt)?x.updatedAt:Date.now(),
      source:{lemma:str(s.lemma),lang:str(s.lang),langLabel:str(s.langLabel),pos:str(s.pos),meaningJa:str(s.meaningJa),
        dictionary:str(s.dictionary),url:/^https:\/\//.test(str(s.url))?str(s.url):"",verified:str(s.verified)}};
  });
}
function nameIdeaNote(idea){
  const s=idea.source||{},L=[];
  L.push("もとにした言葉："+s.lemma+"（"+s.langLabel+"・"+s.pos+"）","原語の意味："+s.meaningJa);
  if(idea.intent)L.push("創作上の意図："+idea.intent);
  L.push("※"+NAME_CAUTION);
  if(s.url)L.push("出典："+s.dictionary+" "+s.url);
  return L.join("\n");
}
const NAME_CAUTION="創作向けに加工した名前です。実在する人名・単語との重複は確認していません。";

/* ---------- 命名コレクション（v2.2） ----------
   作品の中に持つ。項目は nameIdeas のIDを参照するので、ひとつの名前を複数のコレクションに入れられる。言語は混在してよい。 */
function newCollection(name){
  const now=Date.now();
  return {id:uid("col"),name:str(name).trim().slice(0,60)||"命名コレクション",theme:"",memo:"",items:[],createdAt:now,updatedAt:now};
}
function sanitizeCollections(list){
  return (Array.isArray(list)?list:[]).filter(c=>c&&typeof c==="object").map(c=>{
    const seen=new Set();
    return {id:str(c.id)||uid("col"),name:str(c.name).trim().slice(0,60)||"命名コレクション",
      theme:typeof c.theme==="string"?c.theme.slice(0,200):"",memo:typeof c.memo==="string"?c.memo.slice(0,4000):"",
      items:(Array.isArray(c.items)?c.items:[]).filter(i=>i&&typeof i==="object"&&typeof i.ideaId==="string"&&i.ideaId&&!seen.has(i.ideaId)&&seen.add(i.ideaId))
        .map(i=>({ideaId:i.ideaId,note:typeof i.note==="string"?i.note.slice(0,1000):""})),
      createdAt:Number.isFinite(c.createdAt)?c.createdAt:Date.now(),updatedAt:Number.isFinite(c.updatedAt)?c.updatedAt:Date.now()};
  });
}
/* 並び替え：index の項目を delta（-1／+1）だけ動かす。動かせたら true。 */
function moveCollectionItem(col,index,delta){
  const to=index+delta;
  if(!col||index<0||to<0||index>=col.items.length||to>=col.items.length)return false;
  const [item]=col.items.splice(index,1);col.items.splice(to,0,item);col.updatedAt=Date.now();return true;
}
function collectionToText(col,ideas){
  const byId=new Map((ideas||[]).map(i=>[i.id,i])),L=["コレクション："+col.name];
  if(col.theme)L.push("共通テーマ："+col.theme);
  if(col.memo)L.push("メモ："+col.memo);
  const items=col.items.filter(i=>byId.has(i.ideaId));
  L.push("（"+items.length+"件）","");
  items.forEach((it,n)=>{
    const idea=byId.get(it.ideaId),s=idea.source||{};
    L.push((n+1)+". "+idea.name+"："+s.lemma+"（"+s.langLabel+"）／"+s.meaningJa);
    if(idea.intent)L.push("   創作上の意図："+idea.intent);
    if(it.note)L.push("   メモ："+it.note);
  });
  L.push("","※"+NAME_CAUTION+"「／」のあとは原語の意味で、創作名そのものの意味ではありません。");
  return L.join("\n");
}

/* ---------- 名前の利用先（v2.2） ----------
   同じ創作名を、キャラ名・家名・地名・組織名・用語として使ったときの記録。語彙データは書き換えず、
   利用先ごとに「実際に使った名前」と「命名意図」を持つ。 */
const NAME_USE_KINDS=[
  {key:"character",label:"キャラクター名",target:"character"},
  {key:"family",label:"姓・家名",target:"entry",section:"organization",entryKind:"家系"},
  {key:"nation",label:"国家名",target:"entry",section:"geography",entryKind:"国家"},
  {key:"region",label:"地域名",target:"entry",section:"geography",entryKind:"地域"},
  {key:"city",label:"都市名",target:"entry",section:"geography",entryKind:"都市"},
  {key:"organization",label:"組織・派閥名",target:"entry",section:"organization",entryKind:"派閥"},
  {key:"glossary",label:"用語集（固有名詞）",target:"entry",section:"glossary",entryKind:"固有名詞"}
];
function nameUseKind(key){return NAME_USE_KINDS.find(k=>k.key===key)||null;}
function newNameUse(idea,kindKey,name,intent,targetId){
  const kind=nameUseKind(kindKey);if(!kind)throw new Error("利用先の種類が不正です");
  return {id:uid("use"),ideaId:str(idea&&idea.id),kind:kind.key,name:str(name).trim().slice(0,80),intent:str(intent).trim().slice(0,2000),
    targetType:kind.target,targetId:str(targetId),createdAt:Date.now()};
}
function sanitizeNameUses(list){
  return (Array.isArray(list)?list:[]).filter(u=>u&&typeof u==="object"&&nameUseKind(u.kind)&&str(u.name).trim()&&typeof u.targetId==="string"&&u.targetId).map(u=>({
    id:str(u.id)||uid("use"),ideaId:typeof u.ideaId==="string"?u.ideaId:"",kind:u.kind,name:str(u.name).trim().slice(0,80),
    intent:typeof u.intent==="string"?u.intent.slice(0,2000):"",targetType:nameUseKind(u.kind).target,targetId:u.targetId,
    createdAt:Number.isFinite(u.createdAt)?u.createdAt:Date.now()}));
}
/* 利用先に書き込む説明文。原語の意味と、その利用先での命名意図を別の行にする。 */
function nameUseBody(idea,name,intent){
  const s=(idea&&idea.source)||{},L=["名前の由来（言葉から名付け）"];
  if(idea&&str(name).trim()&&str(name).trim()!==idea.name)L.push("もとにした創作名："+idea.name);
  L.push("もとにした言葉："+s.lemma+"（"+s.langLabel+"・"+s.pos+"）","原語の意味："+s.meaningJa);
  if(str(intent).trim())L.push("命名意図："+str(intent).trim());
  L.push("※"+NAME_CAUTION);
  if(s.url)L.push("出典："+s.dictionary+" "+s.url);
  return L.join("\n");
}
/* 名前候補を消すときに、どこから参照されているか */
function ideaImpact(project,ideaId){
  return {collections:(project.nameCollections||[]).filter(c=>c.items.some(i=>i.ideaId===ideaId)).map(c=>c.name),
    uses:(project.nameUses||[]).filter(u=>u.ideaId===ideaId).length};
}
function removeIdeaRefs(project,ideaId){
  for(const c of project.nameCollections||[])c.items=c.items.filter(i=>i.ideaId!==ideaId);
  for(const u of project.nameUses||[])if(u.ideaId===ideaId)u.ideaId=""; // 利用先の名前と命名意図は残す
}
function newChart(name){
  return {id:uid("cht"),name:str(name).trim()||"相関図",bg:"#FFFFFF",nodes:[],edges:[]};
}

/* ---------- キャラクター ---------- */
const PROFILE_FIELDS=[
  ["age","年齢","basic"],["genderImp","性別・印象","basic"],["occupation","職業・立場","basic"],["worldLabel","世界観","basic"],
  ["appearance","外見","look"],
  ["personality","性格","person"],["speech","話し方","person"],["first","一人称","person"],["second","二人称","person"],
  ["likes","好きなもの","person"],["dislikes","苦手なもの","person"],["strength","強み","person"],["weakness","弱み","person"],["secret","秘密","person"],
  ["relationSeed","関係性の種","hook"],["storyRole","物語での役割","hook"],["catch","キャッチコピー","hook"],
  ["imagePrompt","画像生成用英語プロンプト素材","prompt"],["nameNote","名前のメモ","prompt"]
];
function newVariant(label,kind){
  return {id:uid("var"),label:str(label)||"基本",kind:kind||"outfit",imageId:null,headY:0.04,footY:0.97};
}
function newCharacter(projectId,name){
  const now=Date.now(),v=newVariant("基本","outfit");
  const profile={};for(const [k] of PROFILE_FIELDS)profile[k]="";
  return {id:uid("chr"),projectId,createdAt:now,updatedAt:now,
    name:str(name),reading:"",roman:"",codename:"",height:null,
    profile,customFields:[],memo:"",affiliations:[],
    variants:[v],mainVariantId:v.id,origin:null};
}
/* ガチャの生成結果（v1系のオブジェクト）を図鑑キャラへ変換。元データは origin に保持する。 */
function fromGacha(projectId,g,detailText){
  const c=newCharacter(projectId,g&&g.name);
  if(!g||typeof g!=="object")return c;
  c.reading=g.manualName?"":str(g.reading);
  c.roman=g.manualName?"":str(g.roman);
  c.codename=str(g.codename);
  for(const [k] of PROFILE_FIELDS)if(k!=="nameNote"&&g[k]!=null)c.profile[k]=str(g[k]);
  if(g.mode==="nameOnly")c.profile.nameNote=[g.nameImpression?"名前の印象："+g.nameImpression:"",g.suitedFor?"向いているキャラ像："+g.suitedFor:""].filter(Boolean).join("\n");
  c.origin={source:"gacha",gachaId:str(g.id),mode:str(g.mode),detailText:str(detailText),raw:clone(g)};
  return c;
}
function duplicateCharacter(c){
  const d=clone(c),now=Date.now();
  d.id=uid("chr");d.createdAt=now;d.updatedAt=now;
  d.name=(c.name||"名前なし")+"（コピー）";
  const map={};
  d.variants=d.variants.map(v=>{const id=uid("var");map[v.id]=id;return Object.assign({},v,{id});});
  d.mainVariantId=map[c.mainVariantId]||d.variants[0].id;
  if(d.origin)d.origin=Object.assign({},d.origin,{gachaId:""});
  return d; // 画像は同じimageIdを共有（削除時は参照数を確認する）
}
function displayName(c){return str(c&&c.name).trim()||"（名前なし）";}
function parseHeight(v){
  if(v==null||v==="")return null;
  const text=String(v).normalize("NFKC");
  if(/[-−ー]\s*\d/.test(text))return null;
  const m=text.match(/\d+(?:\.\d+)?/),n=m?parseFloat(m[0]):NaN;
  return Number.isFinite(n)&&n>0&&n<1000?Math.round(n*10)/10:null;
}
function mainVariant(c){return c.variants.find(v=>v.id===c.mainVariantId)||c.variants[0]||null;}
function characterToText(c,world){
  const p=c.profile||{},L=[];
  L.push("【名前】","名前："+displayName(c));
  if(c.reading)L.push("読み："+c.reading);
  if(c.roman)L.push("英字表記："+c.roman);
  if(c.codename)L.push("コードネーム："+c.codename);
  const groups=[["basic","【基本設定】"],["look","【外見】"],["person","【人物像】"],["hook","【創作フック】"],["prompt","【補足】"]];
  for(const [g,head] of groups){
    const rows=PROFILE_FIELDS.filter(f=>f[2]===g&&str(p[f[0]]).trim()).map(f=>f[1]+"："+p[f[0]]);
    if(g==="basic"&&c.height!=null)rows.unshift("身長："+c.height+"cm");
    if(g==="basic"&&world){
      const names=allEntries(world).filter(x=>(c.affiliations||[]).includes(x.entry.id)).map(x=>x.entry.title||"（無題）");
      if(names.length)rows.push("所属・関連："+names.join("、"));
    }
    if(rows.length)L.push("",head,...rows);
  }
  const custom=(c.customFields||[]).filter(f=>str(f.label).trim()||str(f.value).trim());
  if(custom.length)L.push("","【独自項目】",...custom.map(f=>f.label+"："+f.value));
  if(str(c.memo).trim())L.push("","【メモ】",c.memo);
  return L.join("\n");
}
function matchesQuery(c,q){
  q=str(q).normalize("NFKC").toLowerCase().trim();
  if(!q)return true;
  const hay=[c.name,c.reading,c.roman,c.codename,c.memo,c.profile&&c.profile.occupation,c.profile&&c.profile.worldLabel]
    .concat((c.variants||[]).map(v=>v.label)).map(str).join("\n").normalize("NFKC").toLowerCase();
  return q.split(/\s+/).every(w=>hay.includes(w));
}

/* ---------- 連携：削除の影響と参照の掃除 ---------- */
function deleteImpact(project,charId){
  const charts=(project.charts||[]).filter(ch=>ch.nodes.some(n=>n.charId===charId));
  return {
    heightCompare:(project.heightCompare.items||[]).some(i=>i.charId===charId),
    charts:charts.map(ch=>ch.name),
    edges:(project.charts||[]).reduce((n,ch)=>n+ch.edges.filter(e=>e.from===charId||e.to===charId).length,0)
  };
}
function removeCharacterRefs(project,charId){
  project.heightCompare.items=project.heightCompare.items.filter(i=>i.charId!==charId);
  for(const ch of project.charts){
    ch.nodes=ch.nodes.filter(n=>n.charId!==charId);
    ch.edges=ch.edges.filter(e=>e.from!==charId&&e.to!==charId);
  }
}
function removeEntryRefs(chars,entryIds){
  const set=new Set(entryIds),changed=[];
  for(const c of chars){
    const next=(c.affiliations||[]).filter(id=>!set.has(id));
    if(next.length!==(c.affiliations||[]).length){c.affiliations=next;changed.push(c);}
  }
  return changed;
}
function allEntryIds(world){
  const out=[];
  for(const s of (world&&Array.isArray(world.sections)?world.sections:[]))for(const e of (s&&Array.isArray(s.entries)?s.entries:[]))if(e&&typeof e.id==="string")out.push(e.id);
  return out;
}
/* 存在しないキャラ・差分への参照を取り除く（復元や手編集で壊れたデータへの保険） */
function repairProject(project,chars){
  const ids=new Set(chars.map(c=>c.id));
  const hc=project.heightCompare=Object.assign({items:[],bg:"#F7F5F0",showScale:true,showNames:true},project.heightCompare||{});
  hc.items=(hc.items||[]).filter(i=>i&&ids.has(i.charId));
  project.charts=(project.charts||[]).filter(ch=>ch&&typeof ch==="object");
  for(const ch of project.charts){
    ch.nodes=(ch.nodes||[]).filter(n=>n&&ids.has(n.charId));
    const inChart=new Set(ch.nodes.map(n=>n.charId));
    ch.edges=(ch.edges||[]).filter(e=>e&&inChart.has(e.from)&&inChart.has(e.to)&&e.from!==e.to);
  }
  if(!project.world||!Array.isArray(project.world.sections))project.world=defaultWorld();
  if(!Array.isArray(project.nameIdeas))project.nameIdeas=[];
  const ideaIds=new Set(project.nameIdeas.map(i=>i&&i.id));
  project.nameCollections=sanitizeCollections(project.nameCollections);
  for(const c of project.nameCollections)c.items=c.items.filter(i=>ideaIds.has(i.ideaId));
  const entryIds=new Set(allEntryIds(project.world));
  project.nameUses=sanitizeNameUses(project.nameUses).filter(u=>u.targetType==="character"?ids.has(u.targetId):entryIds.has(u.targetId));
  for(const u of project.nameUses)if(u.ideaId&&!ideaIds.has(u.ideaId))u.ideaId="";
  return project;
}

/* ---------- 身長比較 ---------- */
const ASSUMED_HEIGHT=160;
function sortByHeight(items,chars,desc){
  const h=id=>{const c=chars.find(x=>x.id===id);return c&&c.height!=null?c.height:ASSUMED_HEIGHT;};
  return items.map((it,i)=>({it,i})).sort((a,b)=>((h(a.it.charId)-h(b.it.charId))*(desc?-1:1))||(a.i-b.i)).map(x=>x.it);
}
/* 画像上の頭頂(headY)と足元(footY)（0〜1の割合）を身長に合わせる。戻り値は地面基準の描画矩形。 */
function imagePlacement(imgW,imgH,headY,footY,heightCm,pxPerCm){
  let top=Math.min(headY,footY),bottom=Math.max(headY,footY);
  if(!(bottom-top>0.02)){top=0;bottom=1;}
  const bodyPx=(bottom-top)*imgH;
  const scale=heightCm*pxPerCm/bodyPx;
  return {scale,width:imgW*scale,height:imgH*scale,
    above:bottom*imgH*scale,          // 地面より上にはみ出す量（帽子なども含む）
    below:(1-bottom)*imgH*scale};     // 地面より下（影など）
}
function scaleMax(heights){
  const max=Math.max(ASSUMED_HEIGHT,...heights);
  return Math.ceil((max+8)/10)*10;
}

/* ---------- 相関図 ---------- */
const RELATION_TYPES=[
  {key:"family",label:"家族",color:"#2E7D6B"},
  {key:"love",label:"恋愛",color:"#C2416C"},
  {key:"friend",label:"友情",color:"#2F6FB0"},
  {key:"rival",label:"敵対",color:"#B3402E"},
  {key:"master",label:"主従",color:"#7A5AA8"},
  {key:"work",label:"仕事・所属",color:"#8A6D1B"},
  {key:"other",label:"その他",color:"#5F5A68"}
];
function relationType(key){return RELATION_TYPES.find(t=>t.key===key)||RELATION_TYPES[RELATION_TYPES.length-1];}
function newEdge(from,to,type){
  const t=relationType(type);
  return {id:uid("edg"),from,to,type:t.key,label:"",dir:"one",color:t.color,style:"solid"};
}
function edgeLabel(e){return str(e.label).trim()||relationType(e.type).label;}
/* 同じ二人の間の複数の線を、重ならないよう湾曲させるためのずれ量を返す。 */
function edgeOffsets(edges,gap){
  const groups=new Map(),out=new Map();
  for(const e of edges){
    const key=e.from<e.to?e.from+"|"+e.to:e.to+"|"+e.from;
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(e);
  }
  for(const list of groups.values()){
    list.forEach((e,i)=>{
      const base=(i-(list.length-1)/2)*(gap||46);
      out.set(e.id,e.from<e.to?base:-base); // 向きが逆でも同じ側に曲がらないよう正規化
    });
  }
  return out;
}
function curvePoints(a,b,offset,r){
  const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1;
  const nx=-dy/len,ny=dx/len;
  const c={x:(a.x+b.x)/2+nx*offset*2,y:(a.y+b.y)/2+ny*offset*2};
  const at=t=>({x:(1-t)*(1-t)*a.x+2*(1-t)*t*c.x+t*t*b.x,y:(1-t)*(1-t)*a.y+2*(1-t)*t*c.y+t*t*b.y});
  let t0=0,t1=1;
  for(let t=0;t<=0.5;t+=0.02){if(Math.hypot(at(t).x-a.x,at(t).y-a.y)>=r){t0=t;break;}}
  for(let t=1;t>=0.5;t-=0.02){if(Math.hypot(at(t).x-b.x,at(t).y-b.y)>=r){t1=t;break;}}
  const start=at(t0),end=at(t1),mid=at(0.5);
  const tan=(t,sign)=>{const p=at(t),q=at(Math.min(1,Math.max(0,t+sign*0.04)));return Math.atan2(p.y-q.y,p.x-q.x);};
  return {start,end,mid,control:c,t0,t1,at,endAngle:tan(t1,-1),startAngle:tan(t0,1)};
}

/* ---------- バックアップ ---------- */
function bufToB64(buf){
  const bytes=new Uint8Array(buf);let s="";
  for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode.apply(null,bytes.subarray(i,i+0x8000));
  return btoa(s);
}
function b64ToBuf(b64){
  const s=atob(b64),bytes=new Uint8Array(s.length);
  for(let i=0;i<s.length;i++)bytes[i]=s.charCodeAt(i);
  return bytes.buffer;
}
function usedImageIds(chars){
  const ids=new Set();
  for(const c of chars)for(const v of c.variants||[])if(v.imageId)ids.add(v.imageId);
  return ids;
}
function exportBundle(project,chars,images){
  const used=usedImageIds(chars);
  return {format:FORMAT,version:FORMAT_VERSION,app:"2.2",exportedAt:new Date().toISOString(),
    project:clone(project),characters:clone(chars),
    images:images.filter(im=>used.has(im.id)).map(im=>({id:im.id,type:im.type,w:im.w,h:im.h,data:bufToB64(im.buffer)}))};
}
function validateBundle(b){
  if(!b||typeof b!=="object")return "ファイルの中身を読み取れませんでした。";
  if(b.format!==FORMAT)return "創作OCメーカーの作品バックアップではありません。";
  if(typeof b.version!=="number"||b.version>FORMAT_VERSION)return "このバックアップは新しい版で作られています。アプリを更新してください。";
  if(!b.project||typeof b.project!=="object"||!Array.isArray(b.characters)||!Array.isArray(b.images))return "バックアップの構造が壊れています。";
  for(const c of b.characters)if(!c||typeof c!=="object"||typeof c.id!=="string")return "キャラクターデータが壊れています。";
  for(const im of b.images)if(!im||typeof im.id!=="string"||typeof im.data!=="string")return "画像データが壊れています。";
  return "";
}
/* 復元は常に「新しい作品」として取り込む。IDを振り直すので既存の作品を上書きしない。 */
function importBundle(b,nameOverride){
  const err=validateBundle(b);if(err)throw new Error(err);
  const now=Date.now(),charMap={},imgMap={},varMap={};
  const src=clone(b.project);
  const project=newProject(nameOverride||src.name||"復元した作品");
  project.world=src.world&&Array.isArray(src.world.sections)?src.world:defaultWorld();
  project.heightCompare=Object.assign(project.heightCompare,src.heightCompare||{});
  project.charts=Array.isArray(src.charts)?src.charts:[];
  const ideaMap={};
  project.nameIdeas=sanitizeNameIdeas(src.nameIdeas).map(x=>{const id=uid("idea");ideaMap[x.id]=id;return Object.assign(x,{id});});
  project.nameCollections=sanitizeCollections(src.nameCollections).map(c=>Object.assign(c,{id:uid("col"),
    items:c.items.filter(i=>ideaMap[i.ideaId]).map(i=>({ideaId:ideaMap[i.ideaId],note:i.note}))}));
  const rawUses=sanitizeNameUses(src.nameUses);
  const images=b.images.map(im=>{
    const id=uid("img");imgMap[im.id]=id;
    return {id,projectId:project.id,type:str(im.type)||"image/png",w:im.w||0,h:im.h||0,buffer:b64ToBuf(im.data)};
  });
  const characters=b.characters.map(raw=>{
    const base=newCharacter(project.id,raw.name),blank=base.profile,fallback=base.variants;
    const c=Object.assign(base,clone(raw));
    c.profile=blank;
    if(raw.profile&&typeof raw.profile==="object")for(const k of Object.keys(blank))c.profile[k]=str(raw.profile[k]);
    for(const k of ["name","reading","roman","codename","memo"])c[k]=str(c[k]);
    const id=uid("chr");charMap[raw.id]=id;c.id=id;c.projectId=project.id;c.updatedAt=now;
    c.createdAt=Number.isFinite(c.createdAt)?c.createdAt:now;
    c.customFields=(Array.isArray(c.customFields)?c.customFields:[]).filter(f=>f&&typeof f==="object").map(f=>({id:uid("cf"),label:str(f.label),value:str(f.value)}));
    c.affiliations=(Array.isArray(c.affiliations)?c.affiliations:[]).filter(x=>typeof x==="string");
    c.origin=c.origin&&typeof c.origin==="object"?c.origin:null;
    const rawVariants=Array.isArray(raw.variants)?raw.variants.filter(v=>v&&typeof v==="object"):[];
    c.variants=(rawVariants.length?clone(rawVariants):fallback).map(v=>{
      const vid=uid("var"),nv=newVariant(v.label,["outfit","expression","other"].includes(v.kind)?v.kind:"outfit");varMap[v.id]=vid;
      const num=(x,dflt)=>Number.isFinite(x)&&x>=0&&x<=1?x:dflt;
      return Object.assign(nv,{id:vid,headY:num(v.headY,nv.headY),footY:num(v.footY,nv.footY),imageId:v.imageId&&imgMap[v.imageId]?imgMap[v.imageId]:null});
    });
    c.mainVariantId=varMap[raw.mainVariantId]||c.variants[0].id;
    c.height=parseHeight(c.height);
    return c;
  });
  project.heightCompare.items=(project.heightCompare.items||[]).filter(i=>i&&charMap[i.charId])
    .map(i=>({charId:charMap[i.charId],variantId:varMap[i.variantId]||null}));
  for(const ch of project.charts){
    ch.id=uid("cht");
    ch.nodes=(ch.nodes||[]).filter(n=>n&&charMap[n.charId]).map(n=>Object.assign({},n,{charId:charMap[n.charId]}));
    ch.edges=(ch.edges||[]).filter(e=>e&&charMap[e.from]&&charMap[e.to]).map(e=>Object.assign({},e,{id:uid("edg"),from:charMap[e.from],to:charMap[e.to]}));
  }
  // 世界観の項目はIDを保つので、利用先のうちキャラへの参照だけを付け替える。行き先が無いものは repairProject が外す
  project.nameUses=rawUses.map(u=>Object.assign(u,{id:uid("use"),ideaId:ideaMap[u.ideaId]||"",
    targetId:u.targetType==="character"?(charMap[u.targetId]||"missing"):u.targetId}));
  const w0=project.world;
  for(const s of w0.sections)if(s&&Array.isArray(s.entries))for(const e of s.entries)if(e&&typeof e==="object"&&!str(e.id))e.id=uid("ent");
  repairProject(project,characters);
  const color=(x,dflt)=>/^#[0-9a-fA-F]{6}$/.test(x)?x:dflt;
  project.heightCompare.bg=color(project.heightCompare.bg,"#F7F5F0");
  for(const ch of project.charts){
    ch.name=str(ch.name)||"相関図";ch.bg=color(ch.bg,"#FFFFFF");delete ch.view;
    for(const n of ch.nodes){n.x=Number.isFinite(n.x)?n.x:0;n.y=Number.isFinite(n.y)?n.y:0;}
    for(const e of ch.edges){
      e.type=relationType(e.type).key;e.label=str(e.label);e.color=color(e.color,relationType(e.type).color);
      e.dir=["one","both","none"].includes(e.dir)?e.dir:"one";e.style=["solid","dashed","dotted"].includes(e.style)?e.style:"solid";
    }
  }
  const w=project.world;
  w.overview=Object.assign({title:"",genre:"",era:"",stage:"",summary:""},w.overview&&typeof w.overview==="object"?w.overview:{});
  for(const k of Object.keys(w.overview))w.overview[k]=str(w.overview[k]);
  w.sections=w.sections.filter(s=>s&&typeof s==="object").map(s=>({id:str(s.id)||uid("sec"),key:str(s.key)||"custom",title:str(s.title)||"カテゴリ",custom:!!s.custom,
    entries:(Array.isArray(s.entries)?s.entries:[]).filter(e=>e&&typeof e==="object").map(e=>({id:str(e.id)||uid("ent"),title:str(e.title),kind:str(e.kind),when:str(e.when),reading:str(e.reading),body:str(e.body),hint:str(e.hint)}))}));
  delete project.currentChartId;
  return {project,characters,images};
}

return {FORMAT,FORMAT_VERSION,uid,clone,SECTION_DEFS,TEMPLATES,newEntry,defaultWorld,applyTemplate,allEntries,worldToText,
  newProject,sanitizeNameIdeas,nameIdeaNote,NAME_CAUTION,newCollection,sanitizeCollections,moveCollectionItem,collectionToText,
  NAME_USE_KINDS,nameUseKind,newNameUse,sanitizeNameUses,nameUseBody,ideaImpact,removeIdeaRefs,allEntryIds,newChart,PROFILE_FIELDS,newVariant,newCharacter,fromGacha,duplicateCharacter,displayName,parseHeight,mainVariant,
  characterToText,matchesQuery,deleteImpact,removeCharacterRefs,removeEntryRefs,repairProject,
  ASSUMED_HEIGHT,sortByHeight,imagePlacement,scaleMax,
  RELATION_TYPES,relationType,newEdge,edgeLabel,edgeOffsets,curvePoints,
  bufToB64,b64ToBuf,usedImageIds,exportBundle,validateBundle,importBundle};
});
