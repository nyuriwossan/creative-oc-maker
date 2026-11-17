'use strict';
// Run: node verify-word-naming-v3.cjs — 「言葉から名付け」v2.3（明・陰・両義の33カテゴリ、テーマの対比）のデータとロジックの検証
const assert=require('node:assert/strict'),fs=require('fs');
const W=require('./js/word-naming-core.js'),C=require('./js/studio/core.js');
const data=JSON.parse(fs.readFileSync('./data/word-naming-v3.json','utf8'));
const v2=JSON.parse(fs.readFileSync('./data/word-naming-v2.json','utf8'));
const checks=[],ok=n=>checks.push(n);
const clone=o=>JSON.parse(JSON.stringify(o));
const LIGHT=['affirm','recognize','accept','harmony','hope','bless','trust','love','courage','freedom','thanks'];
const SHADE=['hatred','envy','obsession','solitude','grief','despair','fear','remorse','shame','wrath','deceit','refusal'];
const AMBI=['fate','eternity','secret','sacrifice','desire','order','change','silence','memory','power'];
const LANGS=['fr','de','it','en','pt'];
const groupOf=id=>data.categories.find(c=>c.id===id).group;

// ---- 1. スキーマ・大分類・33カテゴリ ----
assert.deepEqual(W.validate(data),[]);
assert.equal(data.schemaVersion,3);assert.equal(W.SCHEMA_VERSION,3);assert.ok(W.DATA_URL.endsWith('word-naming-v3.json'));
assert.deepEqual(Object.keys(data.groups),['light','shade','ambi']);
assert.deepEqual(Object.values(data.groups).map(g=>g.short),['明','陰','両義']);
assert.ok(Object.values(data.groups).every(g=>g.label&&g.note));
assert.deepEqual(data.categories.map(c=>c.id),[...LIGHT,...SHADE,...AMBI]);
assert.deepEqual(data.categories.filter(c=>c.group==='shade').map(c=>c.label),['憎悪・敵意','嫉妬・羨望','執着・依存','孤独・疎外','喪失・悲嘆','絶望・諦念','恐怖・不安','後悔・罪悪感','羞恥・屈辱','怒り・怨恨','欺瞞・裏切り','拒絶・否認']);
assert.deepEqual(data.categories.filter(c=>c.group==='ambi').map(c=>c.label),['運命・宿命','永遠・無限','秘密・隠蔽','犠牲・献身','欲望・渇望','秩序・支配','変化・変容','沈黙・静寂','記憶・忘却','力・権威']);
assert.ok(data.categories.every(c=>c.status==='available'&&c.aliases.length>=4));
assert.ok(/善悪/.test(data.notice),'the notice must say the grouping is not a moral judgement');
ok('schema v3: 3 groups (明／陰／両義) and 33 categories (11 + 12 + 10), all available; the notice says the grouping is a creative theme, not a judgement of good and evil');

// ---- 2. v2.2 の192語・579候補・ID を保っている ----
const byId=new Map(data.words.map(w=>[w.id,w]));
for(const o of v2.words){
  const n=byId.get(o.id);assert.ok(n,o.id+' missing');
  for(const k of ['lemma','lang','pos','meaningJa','nuances','nuanceNote','tags','pronunciation','kana','source','verification','since','candidates'])assert.deepEqual(n[k],o[k],o.id+'.'+k);
  assert.deepEqual(n.categories.slice(0,o.categories.length),o.categories,o.id+' keeps its v2.2 categories first');
}
assert.deepEqual(data.words.slice(0,v2.words.length).map(w=>w.id),v2.words.map(w=>w.id));
const oldCands=v2.words.flatMap(w=>w.candidates).length;assert.equal(v2.words.length,192);assert.equal(oldCands,579);
const reTagged=v2.words.filter(o=>byId.get(o.id).categories.length>o.categories.length).map(o=>o.id);
const dict=JSON.parse(fs.readFileSync('./data/dictionary-v1.7.json','utf8'));
assert.equal(dict.entries.length,675);const dictIds=new Set(dict.entries.map(e=>e.id));assert.ok(data.words.every(w=>!dictIds.has(w.id)));
ok('the 192 words and 579 candidates of v2.2 keep their IDs, content and order ('+reTagged.length+' of them gained a new category); the 675-entry dictionary is untouched');

// ---- 3. ID・見出し語の重複なし ----
assert.equal(new Set(data.words.map(w=>w.id)).size,data.words.length);
const cands=data.words.flatMap(w=>w.candidates);assert.equal(new Set(cands.map(c=>c.id)).size,cands.length);
const lemmaKey=w=>w.lang+'|'+w.lemma;assert.equal(new Set(data.words.map(lemmaKey)).size,data.words.length,'no headword is registered twice in one language');
for(const w of data.words){assert.match(w.id,new RegExp('^WN-'+w.lang.toUpperCase()+'-\\d{4}$'));w.candidates.forEach((c,i)=>assert.equal(c.id,w.id+'-'+'abcdefgh'[i]));}
ok('word IDs and candidate IDs are unique; no headword appears twice within a language');

// ---- 4. 新しい語：出典・確認範囲・発音・創作名 ----
const fresh=data.words.filter(w=>w.since==='2.3');assert.equal(fresh.length,data.words.length-192);
const KATA=/^[ァ-ヺー]+$/;
for(const w of fresh){
  const lang=data.languages[w.lang],dics=W.dictionariesOf?W.dictionariesOf(lang):[lang].concat(lang.also||[]);
  const u=new URL(w.source.url);assert.equal(u.protocol,'https:');
  const d=dics.find(x=>x.dictionary===w.source.dictionary);assert.ok(d&&d.host===u.hostname,w.id+' source host/dictionary mismatch');
  assert.ok(!/search|suchen|ricerca|pesquisar|thesaurus|synonym/i.test(u.pathname),w.id+' must link to a headword page');
  assert.equal(w.verification.status,'verified');assert.match(w.verification.date,/^2026-\d\d-\d\d$/);assert.ok(['page-fetch','search-excerpt'].includes(w.verification.access)&&data.access[w.verification.access]&&w.verification.scope.length>10);
  if(w.pronunciation.ipa===null){assert.equal(w.kana.basis,'unconfirmed',w.id);assert.ok(w.pronunciation.note,w.id+' needs a note when IPA is not recorded');}
  else{assert.equal(w.kana.basis,'ipa');assert.ok(!/[\[\]\/]/.test(w.pronunciation.ipa));}
  assert.match(w.kana.text,KATA,w.id);assert.ok(w.pos&&w.meaningJa&&w.nuanceNote);assert.ok(w.meaningJa.length<=90&&w.nuanceNote.length<=100,w.id+' text too long');
  assert.ok(w.categories.length>=1&&w.categories.some(c=>groupOf(c)!=='light'),w.id+' must belong to a shade/ambi category');
  assert.ok(w.candidates.length>=2&&w.candidates.length<=4,w.id+' candidates');
  const names=w.candidates.map(c=>c.name);assert.equal(new Set(names).size,names.length,w.id+' duplicate candidate');
  for(const c of w.candidates){assert.match(c.name,KATA,c.id);assert.ok(!/^[ンーッ]/.test(c.name));assert.ok(['kana','short','adjust'].includes(c.method));
    assert.ok(c.impressions.length&&c.impressions.every(i=>data.impressions[i]),c.id);assert.equal(typeof c.overlap,'string');assert.ok(c.note);
    if(c.method==='kana')assert.equal(c.name,w.kana.text,c.id+' “kana” must be the reading itself');}
}
assert.ok(data.impressions.dark&&data.impressions.cold);
const en=data.languages.en;
if(fresh.some(w=>w.lang==='en'&&w.source.dictionary!==en.dictionary))assert.ok(Array.isArray(en.also)&&en.also.length===1,'the second English dictionary must be declared');
ok('each of the '+fresh.length+' new words links to a headword page of its declared dictionary, records date + how it was checked (page-fetch / search-excerpt) + scope; no IPA unless recorded; candidates are katakana, unique, with impressions and an overlap field');

// ---- 5. 収録数（水増しの検出を含む） ----
const count=(pred)=>data.words.filter(pred).length;
const inGroup=g=>w=>w.categories.some(c=>groupOf(c)===g);
const nShade=count(inGroup('shade')),nAmbi=count(inGroup('ambi'));
for(const c of [...SHADE,...AMBI]){
  const n=count(w=>w.categories.includes(c));assert.ok(n>=4,c+' has only '+n+' words');
  assert.ok(new Set(data.words.filter(w=>w.categories.includes(c)).map(w=>w.lang)).size>=3,c+' needs words from at least 3 languages');
}
for(const l of LANGS)assert.ok(fresh.filter(w=>w.lang===l).length>=20,l+' has too few new words');
// 同じ語に機械的な派生形を並べていないか：新語の候補は語あたり平均4件未満、同名候補が多数の語にまたがらない
assert.ok(fresh.flatMap(w=>w.candidates).length/fresh.length<4);
const nameUse=new Map();for(const w of data.words)for(const c of w.candidates)nameUse.set(c.name,(nameUse.get(c.name)||0)+1);
assert.ok([...nameUse.values()].every(n=>n<=6),'a coined name is repeated across too many words');
ok('coverage: every shade/ambi category has ≥4 words from ≥3 languages; every language has ≥20 new words (陰 '+nShade+'語・両義 '+nAmbi+'語・新規 '+fresh.length+'語・全 '+data.words.length+'語・候補 '+cands.length+'件)');

// ---- 6. 明・陰・両義の検索 ----
for(const g of ['light','shade','ambi']){
  const r=W.filter(data,{group:g}).results;assert.equal(r.length,count(inGroup(g)));
  assert.ok(r.every(x=>W.wordGroups(data,x.word).includes(g)));
}
assert.equal(W.filter(data,{}).results.length,data.words.length);assert.equal(W.filter(data,{group:'nope'}).results.length,data.words.length,'unknown group is ignored');
const shadeFr=W.filter(data,{group:'shade',langs:['fr']}).results;assert.ok(shadeFr.length>0&&shadeFr.every(x=>x.word.lang==='fr'));
// 大分類とカテゴリの組み合わせ（AND は「両方に入っている語」）
const both=W.filter(data,{categories:['despair','accept'],categoryMode:'and'}).results;
assert.equal(both.length,count(w=>w.categories.includes('despair')&&w.categories.includes('accept')));
const either=W.filter(data,{categories:['despair','hope'],categoryMode:'or'}).results;
assert.equal(either.length,count(w=>w.categories.includes('despair')||w.categories.includes('hope')));
// 横断：複数の大分類にまたがる語は、どの大分類からも見つかる
const multi=data.words.filter(w=>W.wordGroups(data,w).length>1);assert.ok(multi.length>=5);
for(const w of multi.slice(0,10))for(const g of W.wordGroups(data,w))assert.ok(W.filter(data,{group:g}).results.some(x=>x.word.id===w.id));
// テーマ語（別名）から新カテゴリが引ける
for(const [q,cat] of [['絶望','despair'],['嫉妬','envy'],['裏切り','deceit'],['運命','fate'],['沈黙','silence'],['孤独','solitude'],['復讐','wrath'],['秘密','secret']])
  assert.ok(W.matchedCategories(data,q).includes(cat),q+' → '+cat);
// 長さ・印象・言語・お気に入りは従来どおり併用できる
const dark=W.filter(data,{group:'shade',impressions:['dark']}).results;assert.ok(dark.length>0&&dark.every(x=>x.candidates.every(c=>c.impressions.includes('dark'))));
const short=W.filter(data,{group:'ambi',lengths:['short']}).results;assert.ok(short.every(x=>x.candidates.every(c=>W.lengthBucket(c.name)==='short')));
const favIds=new Set([fresh[0].id,v2.words[0].id]);assert.deepEqual(W.filter(data,{ids:favIds,group:'light'}).results.map(x=>x.word.id),[v2.words[0].id]);
// 0件のときの案内に「大分類を戻す」が出る
const none=W.filter(data,{group:'shade',categories:['hope'],categoryMode:'and',query:''});
if(!none.results.length){const sg=W.suggest(data,{group:'shade',categories:['hope'],categoryMode:'and'});assert.ok(sg.relax.some(x=>x.key==='group'&&x.count>0),'suggest should offer to clear the group');}
ok('light / shade / ambi filter: each returns exactly its words; combines with language, OR/AND categories, length, impression and favourites; multi-group words are found from every group; theme words reach the new categories');

// ---- 7. テーマの対比：辞書上の対義関係と、物語上の対照を区別する ----
assert.ok(data.contrasts.length>=12);assert.equal(new Set(data.contrasts.map(c=>c.id)).size,data.contrasts.length);
const lex=data.contrasts.filter(c=>c.kind==='lexical'),nar=data.contrasts.filter(c=>c.kind==='narrative');
assert.ok(lex.length>=4&&nar.length>=8);assert.equal(lex.length+nar.length,data.contrasts.length);
assert.ok(lex.every(c=>c.evidence&&/(Larousse|Treccani|Duden)/.test(c.evidence)),'a lexical contrast must cite the dictionary entry that lists the antonym');
assert.ok(nar.every(c=>!c.evidence),'a narrative contrast must not carry dictionary evidence');
assert.notEqual(W.CONTRAST_KINDS.lexical,W.CONTRAST_KINDS.narrative);assert.ok(/対義語ではありません/.test(W.CONTRAST_KINDS.narrative));
const titles=data.contrasts.map(W.contrastTitle);
for(const t of ['希望 ↔ 絶望','信頼 ↔ 疑念','自由 ↔ 束縛','受容 ↔ 拒絶','祝福 ↔ 呪い'])assert.ok(titles.includes(t),'missing contrast '+t);
for(const c of data.contrasts){
  const r=W.contrastResults(data,c.id,{});assert.ok(r.a.results.length>=2&&r.b.results.length>=2,c.id+' needs words on both sides');
  assert.ok(r.a.results.every(x=>x.word.categories.includes(c.a.category))&&r.b.results.every(x=>x.word.categories.includes(c.b.category)));
  for(const s of [c.a,c.b])if(s.ids)assert.ok(s.ids.every(id=>byId.get(id).categories.includes(s.category)));
  const ia=new Set(r.a.results.map(x=>x.word.id));assert.ok(!r.b.results.some(x=>ia.has(x.word.id))||c.a.category!==c.b.category,c.id+' sides of a same-category contrast must not overlap');
  const fr=W.contrastResults(data,c.id,{langs:['fr']});assert.ok(fr.a.results.every(x=>x.word.lang==='fr')&&fr.b.results.every(x=>x.word.lang==='fr'));
}
assert.equal(W.contrastResults(data,'nope',{}),null);
const mem=data.contrasts.find(c=>c.id==='memory-oblivion');assert.ok(mem&&mem.a.ids&&mem.b.ids&&!mem.a.ids.some(i=>mem.b.ids.includes(i)));
ok('contrast search: '+lex.length+' lexical (with the dictionary entry cited) and '+nar.length+' narrative contrasts are labelled differently; both sides have words; language filter applies; same-category contrasts are split by headword');

// ---- 8. 検証が不正を検出する（v3 固有） ----
const bad=(mutate,pattern)=>{const d=clone(data);mutate(d);const e=W.validate(d);assert.ok(e.some(x=>pattern.test(x)),String(pattern)+' not detected: '+e.slice(0,3).join(' / '));};
bad(d=>{delete d.groups;},/groups（大分類）がありません/);
bad(d=>{d.categories[12].group='evil';},/大分類（group）が未定義/);
bad(d=>{delete d.contrasts;},/contrasts/);
bad(d=>{d.contrasts[1].id=d.contrasts[0].id;},/重複/);
bad(d=>{d.contrasts.find(c=>c.kind==='lexical').evidence='';},/evidence|根拠/);
bad(d=>{d.contrasts[0].kind='opposite';},/kind|種類/);
bad(d=>{d.contrasts[0].a.category='luck';},/カテゴリ/);
bad(d=>{d.words[d.words.length-1].verification.access='human-read';},/確認方法（access）が未定義/);
bad(d=>{d.words[d.words.length-1].source.url='https://ja.wiktionary.org/wiki/x';},/ではありません/);
bad(d=>{d.words[d.words.length-1].id=d.words[0].id;},/ID が重複/);
bad(d=>{d.words[d.words.length-1].categories=['curse'];},/未定義のカテゴリ/);
bad(d=>{d.dataVersion='2.0.0';},/schemaVersion 3/);
ok('validator rejects: missing/unknown group, missing contrasts, duplicate contrast IDs, lexical contrast without evidence, unknown contrast kind/category, unknown verification method, wrong dictionary host, duplicate word IDs');

// ---- 9. 命名コレクション：明・陰・両義の混在、対照テーマ ----
const pick=g=>W.filter(data,{group:g}).results.find(x=>W.wordGroups(data,x.word).length===1);
const p=C.newProject('検証');const col=C.newCollection('自由と束縛');col.theme='自由 ↔ 束縛';
const ideas=['light','shade','ambi'].map(g=>{const x=pick(g),c=x.candidates[0];return W.newIdea(data,x.word,{candidateId:c.id,name:c.name,method:c.method});});
p.nameIdeas.push(...ideas);for(const i of ideas)col.items.push({ideaId:i.id,note:''});p.nameCollections.push(col);
const txt=C.collectionToText(col,p.nameIdeas);assert.ok(txt.startsWith('コレクション：自由と束縛')&&txt.includes('（3件）'));for(const i of ideas)assert.ok(txt.includes(i.name));
assert.equal(C.sanitizeCollections(clone(p.nameCollections))[0].items.length,3);
ok('a collection can mix names from light, shade and ambiguous words; the text export lists all of them');

// ---- 10. 複数キャラ命名：対比の両側から交互に ----
const hd=W.contrastResults(data,'hope-despair',{});
const pa=W.candidatePool(hd.a.results),pb=W.candidatePool(hd.b.results);
assert.ok(pa.length>=3&&pb.length>=3);
const A=W.pickAssignments(pa,3,[]),B=W.pickAssignments(pb,3,A.map(x=>x.candidate.name));
assert.ok(A.every(Boolean)&&B.every(Boolean));assert.equal(new Set([...A,...B].map(x=>W.normalize(x.candidate.name))).size,6);
assert.ok(A.every(x=>x.word.categories.includes('hope'))&&B.every(x=>x.word.categories.includes('despair')));
ok('batch naming from a contrast: each side draws from its own words, with no duplicate names across the two sides');

console.log('PASS '+checks.length+' groups');for(const c of checks)console.log(' - '+c);
