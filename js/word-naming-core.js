/* 言葉から名付け — データの検証・検索・創作名の記録（DOM非依存。Nodeでも検証可能）
   既存の名前辞典（OCDictionary）とは別のスキーマ・別の保存キーを使う。 */
(function(root,factory){
  if(typeof module==="object"&&module.exports)module.exports=factory();
  else root.OCWordNaming=factory();
})(typeof self!=="undefined"?self:this,function(){
"use strict";
const SCHEMA="oc-word-naming",SCHEMA_VERSION=1;
const DATA_URL="./data/word-naming-v1.json";
const FAVORITE_KEY="ocWordNamingFavoritesV1";
const LENGTHS={short:"短い（〜3音）",mid:"ふつう（4〜5音）",long:"長い（6音〜）"};
const str=v=>v==null?"":String(v);

function normalize(text){
  return str(text).normalize("NFKC").toLowerCase()
    .replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-0x60)) // カタカナ→ひらがな
    .replace(/[̀-ͯ]/g,"").trim();
}
/* 検索用：アクセント記号を外した形でも当たるようにする（sì→si、ß はそのまま） */
function fold(text){return normalize(str(text).normalize("NFD"));}

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
function validate(data){
  const errors=[],E=m=>errors.push(m);
  if(!data||typeof data!=="object")return ["データを読み取れません"];
  if(data.schema!==SCHEMA)E("schema が違います");
  if(data.schemaVersion!==SCHEMA_VERSION)E("schemaVersion が未対応です");
  if(!/^\d+\.\d+\.\d+$/.test(str(data.dataVersion)))E("dataVersion が不正です");
  const langs=data.languages&&typeof data.languages==="object"?data.languages:{};
  const cats=new Map((Array.isArray(data.categories)?data.categories:[]).map(c=>[c&&c.id,c]));
  for(const key of ["nuances","methods","impressions"])if(!data[key]||typeof data[key]!=="object")E(key+" がありません");
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
      else if(langs[w.lang]&&new URL(url).hostname!==langs[w.lang].host)E(at+"出典URLがその言語の辞書（"+langs[w.lang].host+"）ではありません");
      if(!/^\d{4}-\d{2}-\d{2}$/.test(str(v.date)))E(at+"確認日がありません");
      if(!str(v.scope).trim())E(at+"確認範囲がありません");
      if(s&&langs[w.lang]&&s.dictionary!==langs[w.lang].dictionary)E(at+"辞書名が言語の設定と一致しません");
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
function matchedCategories(data,query){
  const tokens=fold(query).split(/\s+/).filter(Boolean),out=new Set();
  for(const t of tokens)for(const c of data.categories){
    if(c.status!=="available")continue;
    const names=[c.label].concat(c.label.split("・"),c.aliases||[]).map(fold);
    if(names.some(n=>n===t||(t.length>=2&&(n.includes(t)||t.includes(n)))))out.add(c.id);
  }
  return [...out];
}
function haystack(data,w){
  return [w.lemma,w.kana.text,w.meaningJa,w.nuanceNote,w.pos,data.languages[w.lang].label].concat(w.tags||[],
    w.categories.map(c=>(data.categories.find(x=>x.id===c)||{}).label),
    (w.nuances||[]).map(n=>data.nuances[n]),w.candidates.map(c=>c.name)).map(fold).join("\n");
}
/* 戻り値：[{word, candidates}]。創作名の条件（長さ・印象）があるときは、合う候補だけを candidates に入れる。 */
function filter(data,opts){
  opts=opts||{};
  const tokens=fold(opts.query).split(/\s+/).filter(Boolean);
  const themeCats=matchedCategories(data,opts.query);
  const has=a=>Array.isArray(a)&&a.length>0;
  const out=[];
  for(const w of data.words){
    if(opts.ids&&!opts.ids.has(w.id))continue;
    if(has(opts.langs)&&!opts.langs.includes(w.lang))continue;
    if(has(opts.categories)&&!opts.categories.some(c=>w.categories.includes(c)))continue;
    if(has(opts.nuances)&&!opts.nuances.every(n=>(w.nuances||[]).includes(n)))continue;
    if(tokens.length){
      const hay=haystack(data,w);
      const ok=tokens.every(t=>hay.includes(t)||matchedCategories(data,t).some(c=>w.categories.includes(c)));
      if(!ok)continue;
    }
    let cands=w.candidates;
    if(has(opts.lengths))cands=cands.filter(c=>opts.lengths.includes(lengthBucket(c.name)));
    if(has(opts.impressions))cands=cands.filter(c=>opts.impressions.some(i=>(c.impressions||[]).includes(i)));
    if((has(opts.lengths)||has(opts.impressions))&&!cands.length)continue;
    out.push({word:w,candidates:cands});
  }
  return {results:out,themeCategories:themeCats};
}

/* 創作名の記録。参照した原語の情報を写しとして持つので、データが更新されても由来を失わない。 */
function newIdea(data,word,input){
  input=input||{};
  const cand=word.candidates.find(c=>c.id===input.candidateId)||null;
  const name=str(input.name).trim();
  const edited=!cand||normalize(name)!==normalize(cand.name);
  let method=data.methods[input.method]?input.method:(cand?cand.method:"free");
  if(edited&&cand&&method===cand.method&&!input.methodChosen)method="free";
  return {id:input.id||("idea_"+Date.now().toString(36)+Math.random().toString(36).slice(2,8)),
    name,wordId:word.id,dataVersion:data.dataVersion,candidateId:cand?cand.id:null,baseName:cand?cand.name:"",
    method,edited,intent:str(input.intent).trim(),createdAt:input.createdAt||Date.now(),updatedAt:Date.now(),
    source:{lemma:word.lemma,lang:word.lang,langLabel:data.languages[word.lang].label,pos:word.pos,meaningJa:word.meaningJa,
      dictionary:word.source.dictionary,url:word.source.url,verified:word.verification.status==="verified"?word.verification.date:""}};
}
function methodLabel(data,idea){return (data&&data.methods[idea.method])||{kana:"カタカナ化",short:"短縮形",adjust:"音の調整",free:"自由編集"}[idea.method]||"自由編集";}
/* 原語の意味と、創作名としての意図は必ず別の行にする */
function ideaToText(data,idea){
  const s=idea.source||{},L=[];
  L.push("創作名："+idea.name);
  L.push("もとにした言葉："+s.lemma+"（"+s.langLabel+"・"+s.pos+"）");
  L.push("原語の意味："+s.meaningJa);
  L.push("加工方法："+methodLabel(data,idea)+(idea.baseName&&idea.edited?"（候補「"+idea.baseName+"」から編集）":""));
  if(idea.intent)L.push("創作上の意図："+idea.intent);
  L.push("※創作名は造語です。原語に実在する人名・単語であることを示しません。");
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
return {SCHEMA,SCHEMA_VERSION,DATA_URL,FAVORITE_KEY,LENGTHS,normalize,fold,moraCount,lengthBucket,safeUrl,validate,load,
  matchedCategories,filter,newIdea,methodLabel,ideaToText,favorites};
});
