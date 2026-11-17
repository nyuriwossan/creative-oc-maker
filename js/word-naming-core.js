/* 言葉から名付け — データの検証・検索・創作名の記録（DOM非依存。Nodeでも検証可能）
   既存の名前辞典（OCDictionary）とは別のスキーマ・別の保存キーを使う。
   schemaVersion 1（v2.1・20語）、2（v2.2・明の11カテゴリ）、3（v2.3・明／陰／両義の33カテゴリと対比）を検証できる。画面が読むのは v3。 */
(function(root,factory){
  if(typeof module==="object"&&module.exports)module.exports=factory();
  else root.OCWordNaming=factory();
})(typeof self!=="undefined"?self:this,function(){
"use strict";
const SCHEMA="oc-word-naming",SCHEMA_VERSION=3,SUPPORTED_VERSIONS=[1,2,3];
const DATA_URL="./data/word-naming-v3.json";
const CONTRAST_KINDS={lexical:"辞書の対義語欄に例がある対比",narrative:"物語上の対照（辞書上の対義語ではありません）"};
const FAVORITE_KEY="ocWordNamingFavoritesV1";
const LENGTHS={short:"短い（〜3音）",mid:"ふつう（4〜5音）",long:"長い（6音〜）"};
const SCOPES={all:"すべて",lemma:"原語（意味・綴り・読み）だけ",name:"創作名だけ"};
const OVERLAP_UNCHECKED="未確認";
const str=v=>v==null?"":String(v);

function normalize(text){
  return str(text).normalize("NFKC").toLowerCase()
    .replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-0x60)) // カタカナ→ひらがな
    .replace(/[̀-ͯ]/g,"").trim();
}
/* 検索用：アクセント記号を外した形でも当たるようにする（sì→si、Güte→gute、ß はそのまま）。
   v2.1 では NFKC が結合文字を戻してしまい外れていなかったので、分解した直後に取り除く。 */
function fold(text){return normalize(str(text).normalize("NFD").replace(/[\u0300-\u036f]/g,""));}

/* 音の数（拗音の小書きは前の字と合わせて1音、促音・長音・撥音は1音） */
function moraCount(name){
  let n=0;
  for(const ch of str(name).normalize("NFKC")){
    if(/[ゃゅょぁぃぅぇぉゎャュョァィゥェォヮ]/.test(ch))continue;
    if(/[ぁ-ゖァ-ヺー]/.test(ch))n++;
    else if(/[A-Za-zÀ-ɏ]/.test(ch))n+=0.5;
    else if(/\S/.test(ch)&&!/[・＝=\-\s]/.test(ch))n++;
  }
  return Math.max(0,Math.round(n));
}
function lengthBucket(name){const n=moraCount(name);return n<=3?"short":n<=5?"mid":"long";}

function safeUrl(url){
  try{const u=new URL(str(url));return u.protocol==="https:"?u.href:"";}catch(e){return "";}
}
/* 言語ごとの辞書。主な辞書のほかに、追加の辞書（also）を持てる（v2.3 の英語：主の辞書のページを取得できなかった語のため） */
function dictionariesOf(lang){return [{dictionary:lang.dictionary,host:lang.host}].concat(Array.isArray(lang.also)?lang.also:[]);}
function validate(data){
  const errors=[],E=m=>errors.push(m);
  if(!data||typeof data!=="object")return ["データを読み取れません"];
  if(data.schema!==SCHEMA)E("schema が違います");
  if(!SUPPORTED_VERSIONS.includes(data.schemaVersion))E("schemaVersion が未対応です");
  if(!/^\d+\.\d+\.\d+$/.test(str(data.dataVersion)))E("dataVersion が不正です");
  const v2=data.schemaVersion>=2,v3=data.schemaVersion===3;
  if(v2&&parseInt(str(data.dataVersion),10)<data.schemaVersion)E("schemaVersion "+data.schemaVersion+" のデータは dataVersion "+data.schemaVersion+".x 以上が必要です");
  const langs=data.languages&&typeof data.languages==="object"?data.languages:{};
  const cats=new Map((Array.isArray(data.categories)?data.categories:[]).map(c=>[c&&c.id,c]));
  for(const key of ["nuances","methods","impressions"])if(!data[key]||typeof data[key]!=="object")E(key+" がありません");
  if(v2&&(!data.access||typeof data.access!=="object"))E("access（確認方法の一覧）がありません");
  if(v3){
    if(!data.groups||typeof data.groups!=="object"||!Object.keys(data.groups).length)E("groups（大分類）がありません");
    else for(const c of cats.values())if(!c||!data.groups[c.group])E("カテゴリ "+str(c&&c.id)+" の大分類（group）が未定義です");
    if(!Array.isArray(data.contrasts))E("contrasts（テーマの対比）がありません");
  }
  if(!Array.isArray(data.words)){E("words がありません");return errors;}
  if(errors.length)return errors;
  const ids=new Set(),candIds=new Set(),lemmas=new Set();
  for(const w of data.words){
    const at="["+str(w&&w.id)+"] ";
    if(!w||typeof w!=="object"){E("語のデータが壊れています");continue;}
    if(!/^WN-[A-Z]{2}-\d{4}$/.test(str(w.id)))E(at+"ID の形式が不正");
    if(ids.has(w.id))E(at+"ID が重複");ids.add(w.id);
    if(!langs[w.lang])E(at+"未定義の言語 "+w.lang);
    else if(!str(w.id).startsWith("WN-"+w.lang.toUpperCase()+"-"))E(at+"ID と言語が一致しません");
    const key=w.lang+"|"+w.lemma;if(lemmas.has(key))E(at+"同じ言語に同じ見出し語があります");lemmas.add(key);
    for(const f of ["lemma","pos","meaningJa","nuanceNote"])if(!str(w[f]).trim())E(at+f+" が空");
    if(!Array.isArray(w.categories)||!w.categories.length)E(at+"categories が空");
    else for(const c of w.categories){if(!cats.has(c))E(at+"未定義のカテゴリ "+c);else if(cats.get(c).status!=="available")E(at+"準備中のカテゴリ "+c+" に語があります");}
    for(const n of Array.isArray(w.nuances)?w.nuances:[])if(!data.nuances[n])E(at+"未定義のニュアンス "+n);
    const p=w.pronunciation,k=w.kana;
    if(!p||typeof p!=="object"||!k||typeof k!=="object"){E(at+"pronunciation / kana がありません");}
    else{
      if(!["ipa","unconfirmed"].includes(k.basis))E(at+"kana.basis が不正");
      if(k.basis==="ipa"&&!str(p.ipa).trim())E(at+"発音が未確認なのにカタカナ読みを確認済み扱いにしています");
      if(k.basis==="unconfirmed"&&str(p.ipa).trim())E(at+"発音記号があるのに kana.basis が unconfirmed");
      if(!str(k.text).trim())E(at+"kana.text が空");
    }
    const v=w.verification,s=w.source;
    if(!v||!["verified","unverified"].includes(v.status))E(at+"verification.status が不正");
    else if(v.status==="verified"){
      const url=s&&safeUrl(s.url);
      if(!url)E(at+"確認済みなのに出典URLがありません");
      else if(langs[w.lang]&&!dictionariesOf(langs[w.lang]).some(d=>d.host===new URL(url).hostname&&(!s.dictionary||d.dictionary===s.dictionary)))E(at+"出典URLがその言語の辞書（"+langs[w.lang].host+"）ではありません");
      if(!/^\d{4}-\d{2}-\d{2}$/.test(str(v.date)))E(at+"確認日がありません");
      if(!str(v.scope).trim())E(at+"確認範囲がありません");
      if(s&&langs[w.lang]&&!dictionariesOf(langs[w.lang]).some(d=>d.dictionary===s.dictionary))E(at+"辞書名が言語の設定と一致しません");
      if(v2&&!data.access[v.access])E(at+"確認方法（access）が未定義です");
    }
    if(!Array.isArray(w.candidates)||!w.candidates.length){E(at+"candidates が空");continue;}
    const names=new Set();
    for(const c of w.candidates){
      if(!c||!str(c.id).startsWith(w.id+"-"))E(at+"候補ID が不正 "+str(c&&c.id));
      if(candIds.has(c.id))E(at+"候補ID が重複 "+c.id);candIds.add(c.id);
      if(!str(c.name).trim()||!str(c.note).trim())E(at+"候補の名前または印象が空");
      if(names.has(c.name))E(at+"同じ語の中で候補名が重複 "+c.name);names.add(c.name);
      if(!data.methods[c.method]||c.method==="free")E(at+"候補の加工方法が不正 "+c.method);
      if(c.method==="kana"&&normalize(c.name)!==normalize(k&&k.text))E(at+"「カタカナ化」の候補はカタカナ読みと一致させてください "+c.name);
      if(normalize(c.name)===normalize(w.lemma))E(at+"候補名が原語そのものです");
      for(const i of Array.isArray(c.impressions)?c.impressions:[])if(!data.impressions[i])E(at+"未定義の印象 "+i);
      if(v2&&typeof c.overlap!=="string")E(at+"候補の overlap（実在の人名・単語との重なり）は文字列で指定してください "+c.name);
    }
  }
  if(v3){
    const byId=new Map(data.words.map(w=>[w&&w.id,w])),seen=new Set();
    for(const c of data.contrasts){
      const at="[対比 "+str(c&&c.id)+"] ";
      if(!c||typeof c!=="object"||!str(c.id)){E("対比のデータが壊れています");continue;}
      if(seen.has(c.id))E(at+"ID が重複");seen.add(c.id);
      if(!CONTRAST_KINDS[c.kind])E(at+"種類（kind）が不正");
      if(c.kind==="lexical"&&!str(c.evidence).trim())E(at+"辞書上の対義関係とするには、確認した例（evidence）が必要です");
      for(const side of [c.a,c.b]){
        if(!side||!cats.has(side.category)){E(at+"未定義のカテゴリ "+str(side&&side.category));continue;}
        if(!str(side.label).trim())E(at+"ラベルが空");
        if(side.ids!==undefined){
          if(!Array.isArray(side.ids)||!side.ids.length)E(at+"ids が空");
          else for(const id of side.ids){const w=byId.get(id);if(!w)E(at+"未定義の語 "+id);else if(!w.categories.includes(side.category))E(at+id+" はカテゴリ "+side.category+" に入っていません");}
        }
      }
      if(c.a&&c.b&&c.a.category===c.b.category&&!c.a.ids&&!c.b.ids)E(at+"同じカテゴリどうしの対比には ids が必要です");
    }
  }
  return errors;
}
async function load(fetcher){
  const res=await (fetcher||fetch)(DATA_URL,{cache:"no-cache"});
  if(!res.ok)throw new Error("HTTP "+res.status);
  const data=await res.json(),errors=validate(data);
  if(errors.length)throw new Error("言葉データの検証に失敗: "+errors[0]);
  return data;
}

/* 自由入力のテーマは、まず登録済みの意味カテゴリ（別名つき）に結びつける。翻訳はしない。 */
function categoryNames(c){return [c.label].concat(c.label.split("・"),c.aliases||[]).map(fold);}
function matchedCategories(data,query){
  const tokens=fold(query).split(/\s+/).filter(Boolean),out=new Set();
  for(const t of tokens)for(const c of data.categories){
    if(c.status!=="available")continue;
    if(categoryNames(c).some(n=>n===t||(t.length>=2&&(n.includes(t)||t.includes(n)))))out.add(c.id);
  }
  return [...out];
}
/* 0件のときの案内用：検索語と同じ漢字を含むテーマ（翻訳ではなく、登録済みの語との字面の近さ） */
function nearCategories(data,query){
  const kanji=new Set([...fold(query)].filter(ch=>/[一-鿿]/.test(ch)));
  if(!kanji.size)return [];
  return data.categories.filter(c=>c.status==="available"&&categoryNames(c).some(n=>[...n].some(ch=>kanji.has(ch)))).map(c=>c.id).slice(0,4);
}
function categoryLabel(data,id){return (data.categories.find(x=>x.id===id)||{}).label||"";}
function lemmaTexts(data,w){
  return [w.lemma,w.kana.text,w.meaningJa,w.nuanceNote,w.pos,data.languages[w.lang].label].concat(w.tags||[],
    w.categories.map(c=>categoryLabel(data,c)),(w.nuances||[]).map(n=>data.nuances[n]));
}
/* アクセント記号つきで入力された語はそのまま（sì は sì だけ）、記号なしで入力された語は記号を無視して（si は sì にも sim にも）探す */
function hayOf(texts){return {plain:texts.map(normalize).join("\n"),folded:texts.map(fold).join("\n")};}
function hayHas(hay,token){const f=fold(token);return hay.plain.includes(token)||(token===f&&hay.folded.includes(f));}
/* 戻り値：{results:[{word, candidates}], themeCategories}。
   創作名の条件（長さ・印象・創作名だけの検索）があるときは、合う候補だけを candidates に入れる。
   opts.categoryMode: "or"（既定。選んだカテゴリのいずれか）／"and"（すべて）
   opts.scope: "all"（既定）／"lemma"（原語側だけ）／"name"（創作名だけ） */
function filter(data,opts){
  opts=opts||{};
  const scope=SCOPES[opts.scope]?opts.scope:"all";
  const tokens=normalize(opts.query).split(/\s+/).filter(Boolean);
  const themeCats=scope==="name"?[]:matchedCategories(data,opts.query);
  const has=a=>Array.isArray(a)&&a.length>0;
  const and=opts.categoryMode==="and";
  const groupCats=opts.group&&data.groups&&data.groups[opts.group]?new Set(data.categories.filter(c=>c.group===opts.group).map(c=>c.id)):null;
  const out=[];
  for(const w of data.words){
    if(opts.ids&&!opts.ids.has(w.id))continue;
    if(groupCats&&!w.categories.some(c=>groupCats.has(c)))continue;
    if(has(opts.langs)&&!opts.langs.includes(w.lang))continue;
    if(has(opts.categories)&&!(and?opts.categories.every(c=>w.categories.includes(c)):opts.categories.some(c=>w.categories.includes(c))))continue;
    if(has(opts.nuances)&&!opts.nuances.every(n=>(w.nuances||[]).includes(n)))continue;
    let cands=w.candidates,narrowed=false;
    if(tokens.length){
      if(scope==="name"){
        cands=cands.filter(c=>{const hay=hayOf([c.name]);return tokens.every(t=>hayHas(hay,t));});narrowed=true;
      }else{
        const hay=hayOf(scope==="lemma"?lemmaTexts(data,w):lemmaTexts(data,w).concat(w.candidates.map(c=>c.name)));
        if(!tokens.every(t=>hayHas(hay,t)||matchedCategories(data,t).some(c=>w.categories.includes(c))))continue;
      }
    }
    if(has(opts.lengths)){cands=cands.filter(c=>opts.lengths.includes(lengthBucket(c.name)));narrowed=true;}
    if(has(opts.impressions)){cands=cands.filter(c=>opts.impressions.some(i=>(c.impressions||[]).includes(i)));narrowed=true;}
    if(narrowed&&!cands.length)continue;
    out.push({word:w,candidates:cands});
  }
  return {results:out,themeCategories:themeCats};
}
/* 0件のときに、条件をひとつ緩めると何件になるかを調べる。戻り値：{relax:[{key,label,count}], themes:[categoryId]} */
function suggest(data,opts){
  opts=opts||{};
  const has=a=>Array.isArray(a)&&a.length>0,relax=[];
  const tries=[
    ["query","検索語を消す",!!fold(opts.query),o=>{o.query="";}],
    ["scope","検索の対象を「すべて」に戻す",!!opts.scope&&opts.scope!=="all",o=>{o.scope="all";}],
    ["categoryMode","カテゴリを「いずれかを含む」にする",opts.categoryMode==="and"&&has(opts.categories)&&opts.categories.length>1,o=>{o.categoryMode="or";}],
    ["categories","意味カテゴリの選択を外す",has(opts.categories),o=>{o.categories=[];}],
    ["group","大分類を「すべて」に戻す",!!opts.group,o=>{o.group="";}],
    ["langs","言語の選択を外す",has(opts.langs),o=>{o.langs=[];}],
    ["nuances","ニュアンスの選択を外す",has(opts.nuances),o=>{o.nuances=[];}],
    ["lengths","名前の長さの選択を外す",has(opts.lengths),o=>{o.lengths=[];}],
    ["impressions","音の印象の選択を外す",has(opts.impressions),o=>{o.impressions=[];}],
    ["ids","「お気に入りだけ」を外す",!!opts.ids,o=>{o.ids=null;}]
  ];
  for(const [key,label,active,apply] of tries){
    if(!active)continue;
    const o=Object.assign({},opts);apply(o);
    const count=filter(data,o).results.length;
    if(count>0)relax.push({key,label,count});
  }
  return {relax,themes:opts.scope==="name"?[]:nearCategories(data,opts.query)};
}

/* ---------- テーマの対比 ----------
   対比の両側を、同じ絞り込み条件（言語・長さ・印象・検索語・お気に入り）で探す。カテゴリと大分類の指定は対比の側が決める。
   戻り値：{contrast, a:{label,category,results}, b:{…}}。未定義のIDなら null。 */
function contrastById(data,id){return (data.contrasts||[]).find(c=>c.id===id)||null;}
function contrastResults(data,id,opts){
  const c=contrastById(data,id);if(!c)return null;
  const side=s=>{
    let ids=opts&&opts.ids?opts.ids:null;
    if(s.ids){const own=new Set(s.ids);ids=ids?new Set([...own].filter(x=>ids.has(x))):own;}
    const o=Object.assign({},opts,{categories:[s.category],categoryMode:"or",group:"",ids});
    return {label:s.label,category:s.category,results:filter(data,o).results};
  };
  return {contrast:c,a:side(c.a),b:side(c.b)};
}
function contrastTitle(c){return c.a.label+" ↔ "+c.b.label;}
/* 語の大分類（その語が入っているカテゴリの大分類を、定義順に重複なく） */
function wordGroups(data,w){
  if(!data.groups)return [];
  const set=new Set(w.categories.map(c=>(data.categories.find(x=>x.id===c)||{}).group));
  return Object.keys(data.groups).filter(g=>set.has(g));
}

/* ---------- 複数キャラへの割り当て ---------- */
/* 検索結果を「語ごとに1候補ずつ」の順に並べ直す（同じ語の候補が続かないようにする） */
function candidatePool(results){
  const pool=[],max=results.reduce((m,r)=>Math.max(m,r.candidates.length),0);
  for(let i=0;i<max;i++)for(const r of results)if(r.candidates[i])pool.push({word:r.word,candidate:r.candidates[i]});
  return pool;
}
/* pool から n 件、名前が重ならないように選ぶ。taken は避けたい名前（既存キャラ名など）。足りないぶんは null。 */
function pickAssignments(pool,n,taken){
  const used=new Set((taken||[]).map(normalize).filter(Boolean)),out=[];
  for(const item of pool){
    if(out.length>=n)break;
    const key=normalize(item.candidate.name);
    if(used.has(key))continue;
    used.add(key);out.push(item);
  }
  while(out.length<n)out.push(null);
  return out;
}
/* 同じ名前（かな・カナ、大文字小文字、前後の空白の違いは同一視）が2回以上あるものを返す：[{name, indexes}] */
function findDuplicates(names){
  const map=new Map();
  names.forEach((n,i)=>{const k=normalize(n);if(!k)return;if(!map.has(k))map.set(k,{name:str(n).trim(),indexes:[]});map.get(k).indexes.push(i);});
  return [...map.values()].filter(x=>x.indexes.length>1);
}

/* ---------- 創作名の記録 ---------- */
/* 参照した原語の情報を写しとして持つので、データが更新されても由来を失わない。 */
function newIdea(data,word,input){
  input=input||{};
  const cand=word.candidates.find(c=>c.id===input.candidateId)||null;
  const name=str(input.name).trim();
  const edited=!cand||normalize(name)!==normalize(cand.name);
  let method=data.methods[input.method]?input.method:(cand?cand.method:"free");
  if(edited&&cand&&method===cand.method&&!input.methodChosen)method="free";
  return {id:input.id||("idea_"+Date.now().toString(36)+Math.random().toString(36).slice(2,8)),
    name,wordId:word.id,dataVersion:data.dataVersion,candidateId:cand?cand.id:null,baseName:cand?cand.name:"",
    method,edited,intent:str(input.intent).trim(),overlap:cand&&!edited?str(cand.overlap):"",
    createdAt:input.createdAt||Date.now(),updatedAt:Date.now(),
    source:{lemma:word.lemma,lang:word.lang,langLabel:data.languages[word.lang].label,pos:word.pos,meaningJa:word.meaningJa,
      dictionary:word.source.dictionary,url:word.source.url,verified:word.verification.status==="verified"?word.verification.date:""}};
}
function methodLabel(data,idea){return (data&&data.methods[idea.method])||{kana:"カタカナ化",short:"短縮形",adjust:"音の調整",free:"自由編集"}[idea.method]||"自由編集";}
/* 実在する人名・単語との重なり。分かっているものだけを記し、それ以外は「未確認」と表示する（重複がないことは保証しない）。 */
function overlapText(overlap){
  const o=str(overlap).trim();
  return o?o+"（ほかの重複は未確認）":OVERLAP_UNCHECKED;
}
const CAUTION="創作向けに加工した名前です。実在する人名・単語との重複は確認していません。";
/* 原語の意味と、創作名としての意図は必ず別の行にする */
function ideaToText(data,idea){
  const s=idea.source||{},L=[];
  L.push("創作名："+idea.name);
  L.push("もとにした言葉："+s.lemma+"（"+s.langLabel+"・"+s.pos+"）");
  L.push("原語の意味："+s.meaningJa);
  L.push("加工方法："+methodLabel(data,idea)+(idea.baseName&&idea.edited?"（候補「"+idea.baseName+"」から編集）":""));
  if(idea.intent)L.push("創作上の意図："+idea.intent);
  L.push("実在の人名・単語との重なり："+overlapText(idea.overlap));
  L.push("※"+CAUTION);
  if(s.url)L.push("出典："+s.dictionary+" "+s.url);
  return L.join("\n");
}
function favorites(getStorage,onWarning){
  let ids=[],usable=true;
  try{
    const raw=getStorage().getItem(FAVORITE_KEY);
    if(raw){const v=JSON.parse(raw);if(!v||v.version!==1||!Array.isArray(v.ids)||!v.ids.every(x=>typeof x==="string"))throw new Error("invalid");ids=[...new Set(v.ids)];}
  }catch(e){usable=false;if(onWarning)onWarning("お気に入りを読み込めませんでした。この画面では保存されません。");}
  function save(){
    if(!usable)return;
    try{getStorage().setItem(FAVORITE_KEY,JSON.stringify({version:1,ids}));}catch(e){usable=false;if(onWarning)onWarning("お気に入りを保存できませんでした。");}
  }
  return {ids:()=>ids.slice(),has:id=>ids.includes(id),
    toggle(id){const i=ids.indexOf(id);if(i>=0)ids.splice(i,1);else ids.push(id);save();return i<0;}};
}
return {SCHEMA,SCHEMA_VERSION,SUPPORTED_VERSIONS,DATA_URL,dictionariesOf,FAVORITE_KEY,LENGTHS,SCOPES,CAUTION,CONTRAST_KINDS,contrastById,contrastResults,contrastTitle,wordGroups,normalize,fold,moraCount,lengthBucket,safeUrl,validate,load,
  matchedCategories,nearCategories,categoryLabel,filter,suggest,candidatePool,pickAssignments,findDuplicates,
  newIdea,methodLabel,overlapText,ideaToText,favorites};
});
