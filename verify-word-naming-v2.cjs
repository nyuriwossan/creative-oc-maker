'use strict';
// Run: node verify-word-naming-v2.cjs — 「言葉から名付け」v2.2（11カテゴリ・命名コレクション・複数キャラ命名・利用先）のデータとロジックの検証
const assert=require('node:assert/strict'),fs=require('fs');
const W=require('./js/word-naming-core.js'),C=require('./js/studio/core.js');
const data=JSON.parse(fs.readFileSync('./data/word-naming-v2.json','utf8'));
const v1=JSON.parse(fs.readFileSync('./data/word-naming-v1.json','utf8'));
const checks=[],ok=n=>checks.push(n);
const clone=o=>JSON.parse(JSON.stringify(o));
const strip=s=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
const CATS=['affirm','recognize','accept','harmony','hope','bless','trust','love','courage','freedom','thanks'];

// ---- スキーマ・11カテゴリ・5言語・ID ----
assert.deepEqual(W.validate(data),[]);assert.deepEqual(W.validate(v1),[],'v2.1 data must still validate');
assert.equal(data.schemaVersion,2);assert.equal(data.dataVersion,'2.0.0');assert.equal(W.SCHEMA_VERSION,2);assert.ok(W.DATA_URL.endsWith('word-naming-v2.json'));
assert.deepEqual(data.categories.map(c=>c.id),CATS);assert.ok(data.categories.every(c=>c.status==='available'&&c.aliases.length>=5));
assert.deepEqual(data.categories.map(c=>c.label),['肯定・同意','承認・認知','受容・寛容','調和・平和','希望・未来','祝福・幸福','信頼・誠実','慈愛・優しさ','勇気・意志','自由・解放','感謝・称賛']);
assert.deepEqual(Object.keys(data.languages).sort(),['de','en','fr','it','pt']);
assert.equal(new Set(data.words.map(w=>w.id)).size,data.words.length);
const cands=data.words.flatMap(w=>w.candidates);assert.equal(new Set(cands.map(c=>c.id)).size,cands.length);
assert.ok(data.words.length>=190,'word count '+data.words.length);assert.ok(cands.length>=570,'candidate count '+cands.length);
for(const cat of CATS)for(const lang of Object.keys(data.languages))
  assert.ok(data.words.filter(w=>w.lang===lang&&w.categories.includes(cat)).length>=2,cat+'/'+lang+' needs at least 2 words');
for(const w of data.words)assert.ok(w.candidates.length>=2,w.id+' needs at least two coined-name candidates');
ok('schema v2, all 11 categories available, every category×language has ≥2 words, unique word/candidate IDs ('+data.words.length+' words, '+cands.length+' candidates)');

// ---- v2.1 の20語・候補・IDを保っている ----
const byId=new Map(data.words.map(w=>[w.id,w]));
for(const o of v1.words){
  const n=byId.get(o.id);assert.ok(n,o.id+' missing');
  for(const k of ['lemma','lang','pos','meaningJa','nuances','nuanceNote','tags'])assert.deepEqual(n[k],o[k],o.id+'.'+k);
  assert.deepEqual(n.pronunciation,o.pronunciation);assert.deepEqual(n.kana,o.kana);assert.deepEqual(n.source,o.source);
  assert.deepEqual(n.candidates.map(c=>[c.id,c.name,c.method,c.impressions,c.note]),o.candidates.map(c=>[c.id,c.name,c.method,c.impressions,c.note]),o.id+' candidates');
  assert.ok(o.categories.every(c=>n.categories.includes(c)),o.id+' keeps its v2.1 categories');assert.equal(n.since,'2.1');
}
assert.equal(data.words.filter(w=>w.since==='2.1').length,20);assert.deepEqual(data.words.slice(0,20).map(w=>w.id),v1.words.map(w=>w.id));
const dict=JSON.parse(fs.readFileSync('./data/dictionary-v1.7.json','utf8'));
assert.equal(dict.entries.length,675);const dictIds=new Set(dict.entries.map(e=>e.id));assert.ok(data.words.every(w=>!dictIds.has(w.id)));
ok('the 20 words and 63 candidates of v2.1 keep their IDs and content; the 675-entry dictionary is untouched and shares no IDs');

// ---- 出典・確認範囲・発音：未確認のものを確認済みに見せない ----
const DE={'ß':'sz','ä':'ae','ö':'oe','ü':'ue'};
for(const w of data.words){
  const u=new URL(w.source.url);assert.equal(u.protocol,'https:');assert.equal(u.hostname,data.languages[w.lang].host,w.id);
  const p=strip(decodeURIComponent(u.pathname+u.search)),lemma=strip(w.lemma),alt=lemma.replace(/[ßäöü]/g,c=>DE[c]),altNFC=w.lemma.toLowerCase().replace(/[ßäöü]/g,c=>DE[c]);
  assert.ok(p.includes(lemma)||p.includes(alt)||p.includes(altNFC)||w.id==='WN-DE-0008'&&p.endsWith('/friede'),w.id+' URL must point at the headword: '+p);
  assert.equal(w.verification.status,'verified');assert.match(w.verification.date,/^\d{4}-\d{2}-\d{2}$/);
  assert.equal(w.verification.access,'search-excerpt');assert.ok(data.access[w.verification.access].includes('直接開いての全文確認ではない'));
  assert.ok(w.verification.scope.startsWith('見出し語の表記・品詞・語義'));
  assert.ok(w.meaningJa.length<=90,w.id+' meaning must stay a short edited note');assert.ok(w.nuanceNote.length<=100,w.id);
  assert.equal(w.kana.basis,w.pronunciation.ipa?'ipa':'unconfirmed',w.id);
  if(!w.pronunciation.ipa)assert.ok(/未確認|まで。/.test(w.pronunciation.note),w.id+' must say the pronunciation is unconfirmed: '+w.pronunciation.note);
  assert.ok(/^[゠-ヿ]+$/.test(w.kana.text),w.id+' kana');
  for(const c of w.candidates){
    assert.ok(/^[゠-ヿ]+$/.test(c.name),w.id+' candidate must be katakana: '+c.name);assert.ok(!/^[ンーッ]/.test(c.name),c.name);
    assert.equal(typeof c.overlap,'string');assert.ok(['kana','short','adjust'].includes(c.method));assert.ok(c.impressions.length>=1);
  }
}
assert.ok(data.words.filter(w=>w.pronunciation.ipa).length>=50);
assert.ok(data.notice.includes('重複は確認していません')&&!data.notice.includes('実在する人名・単語ではありません'));
assert.ok(cands.filter(c=>c.overlap).length>=80,'known overlaps should be noted where we know them');
ok('each word links to its language’s dictionary headword, records date + scope + “search excerpt, not full page”; unconfirmed pronunciation carries no IPA; coined names never claim to be non-existent');

// ---- 検証が不正を検出する（v2 固有） ----
const bad=(mutate,pattern)=>{const d=clone(data);mutate(d);const e=W.validate(d);assert.ok(e.some(x=>pattern.test(x)),String(pattern)+' not detected: '+e.slice(0,3).join(' / '));};
bad(d=>{d.words[30].id=d.words[29].id;},/ID が重複/);
bad(d=>{d.words[30].verification.access='direct';},/確認方法（access）が未定義/);
bad(d=>{delete d.words[30].candidates[0].overlap;},/overlap/);
bad(d=>{d.words[30].source.url='https://ja.wiktionary.org/wiki/x';},/ではありません/);
bad(d=>{d.words[25].kana.basis='ipa';d.words[25].pronunciation.ipa=null;},/発音が未確認なのに/);
bad(d=>{d.words[30].categories=['luck'];},/未定義のカテゴリ/);
bad(d=>{d.categories[4].status='planned';},/準備中のカテゴリ/);
bad(d=>{d.words[30].nuances=['slang'];},/未定義のニュアンス/);
bad(d=>{d.dataVersion='1.0.0';},/schemaVersion 2/);bad(d=>{d.schemaVersion=3;},/schemaVersion が未対応/);bad(d=>{delete d.access;},/access/);
ok('validator rejects duplicate IDs, unknown verification method, missing overlap field, wrong dictionary host, unverified pronunciation, unknown/planned categories');

// ---- 逆引き検索：テーマ語・OR/AND・言語・ニュアンス・長さ・印象・原語／創作名の別 ----
const lem=r=>r.results.map(x=>x.word.lemma),idsOf=r=>r.results.map(x=>x.word.id);
assert.equal(W.filter(data,{}).results.length,data.words.length);
for(const [q,cat] of [['肯定','affirm'],['祝福','bless'],['希望','hope'],['優しさ','love'],['勇気','courage'],['自由','freedom'],['感謝','thanks'],['信頼','trust'],['平和','harmony'],['寛容','accept'],['承認','recognize'],['やさしい','love'],['ありがとう','thanks']]){
  const r=W.filter(data,{query:q});assert.ok(r.themeCategories.includes(cat),q+' → '+cat+' got '+r.themeCategories);
  assert.ok(r.results.length>=10,q+' results '+r.results.length);
  assert.ok(data.words.filter(w=>w.categories.includes(cat)).every(w=>idsOf(r).includes(w.id)),q+' must list every word of '+cat);
}
const or=W.filter(data,{categories:['hope','trust']}),and=W.filter(data,{categories:['hope','trust'],categoryMode:'and'});
assert.ok(or.results.every(x=>x.word.categories.includes('hope')||x.word.categories.includes('trust')));
assert.ok(and.results.length>=2&&and.results.length<or.results.length&&and.results.every(x=>x.word.categories.includes('hope')&&x.word.categories.includes('trust')));
assert.equal(or.results.length,new Set(data.words.filter(w=>w.categories.includes('hope')||w.categories.includes('trust')).map(w=>w.id)).size);
assert.deepEqual(lem(and).sort(),['Zuversicht','fiducia']);
assert.equal(W.filter(data,{categories:['courage'],categoryMode:'and'}).results.length,W.filter(data,{categories:['courage']}).results.length);
const frit=W.filter(data,{langs:['fr','it'],categories:['bless']});assert.ok(frit.results.length>=8&&frit.results.every(x=>['fr','it'].includes(x.word.lang)&&x.word.categories.includes('bless')));
assert.ok(W.filter(data,{nuances:['religious'],categories:['bless']}).results.every(x=>x.word.nuances.includes('religious')));
assert.ok(W.filter(data,{nuances:['religious','literary']}).results.every(x=>x.word.nuances.includes('religious')&&x.word.nuances.includes('literary')));
const short=W.filter(data,{lengths:['short'],impressions:['soft']});
assert.ok(short.results.length>20&&short.results.every(x=>x.candidates.length&&x.candidates.every(c=>W.moraCount(c.name)<=3&&c.impressions.includes('soft'))));
const elegant=W.filter(data,{impressions:['elegant'],lengths:['long']});assert.ok(elegant.results.length>5&&elegant.results.every(x=>x.candidates.every(c=>c.impressions.includes('elegant')&&W.moraCount(c.name)>=6)));
// 原語と創作名の個別検索
assert.deepEqual(lem(W.filter(data,{query:'espoir'})),['espoir']);assert.deepEqual(lem(W.filter(data,{query:'エスポワール'})),['espoir']);
assert.deepEqual(lem(W.filter(data,{query:'Güte'})),['Güte','Herzensgüte']);for(const l of ['Güte','Herzensgüte'])assert.ok(lem(W.filter(data,{query:'gute'})).includes(l),'accent-insensitive: '+l);
assert.deepEqual(lem(W.filter(data,{query:'felicite'})),['félicité']);assert.deepEqual(lem(W.filter(data,{query:'GRATIDAO'})),['gratidão']);assert.equal(W.fold('Zärtlichkeit'),'zartlichkeit');assert.deepEqual(lem(W.filter(data,{query:'SÌ'})),['sì'],'an accented query stays exact');assert.ok(lem(W.filter(data,{query:'si'})).includes('sì')&&lem(W.filter(data,{query:'si'})).includes('sim'));assert.equal(W.fold('ガ'),'が');
assert.deepEqual(lem(W.filter(data,{query:'liberta'})),['libertà']);
const nameOnly=W.filter(data,{query:'リベラ',scope:'name'});
assert.ok(nameOnly.results.length>=2&&nameOnly.results.every(x=>x.candidates.length&&x.candidates.every(c=>c.name.includes('リベラ'))));assert.deepEqual(nameOnly.themeCategories,[]);
assert.equal(W.filter(data,{query:'希望',scope:'name'}).results.length,0,'a meaning word must not match coined names');
assert.ok(W.filter(data,{query:'希望',scope:'lemma'}).results.length>=15);
assert.equal(W.filter(data,{query:'ウィエル',scope:'lemma'}).results.length,0,'a coined-only name must not match the source side');
assert.deepEqual(lem(W.filter(data,{query:'ウィエル',scope:'all'})),['oui']);assert.deepEqual(W.filter(data,{query:'ウィエル',scope:'name'}).results[0].candidates.map(c=>c.name),['ウィエル']);
const de=W.filter(data,{query:'朝焼け ドイツ語'});assert.ok(lem(de).includes('Morgenrot')&&de.results.every(x=>x.word.lang==='de'&&x.word.categories.includes('hope')));
assert.deepEqual(lem(W.filter(data,{query:'登山'})),[],'notes about overlaps are not searched');assert.deepEqual(lem(W.filter(data,{query:'曙'})),['aurora']);
ok('reverse lookup: theme words map to categories, OR vs AND across categories, multi-language, nuance, length × impression, separate search of source words and coined names');

// ---- 0件のとき：翻訳せず、近いテーマと条件緩和を案内 ----
const none={query:'りんご'};assert.equal(W.filter(data,none).results.length,0);assert.deepEqual(W.filter(data,none).themeCategories,[]);
let s=W.suggest(data,none);assert.deepEqual(s.themes,[]);assert.deepEqual(s.relax.map(r=>r.key),['query']);assert.equal(s.relax[0].count,data.words.length);
s=W.suggest(data,{query:'望郷'});assert.ok(s.themes.includes('hope'),'shares a kanji with 希望: '+s.themes);assert.equal(W.filter(data,{query:'望郷'}).results.length,0);
const tight={query:'',categories:['affirm','freedom'],categoryMode:'and',langs:['en']};assert.equal(W.filter(data,tight).results.length,0);
s=W.suggest(data,tight);assert.deepEqual(s.relax.map(r=>r.key),['categoryMode','categories'],'only relaxations that actually produce results are offered');assert.ok(s.relax.every(r=>r.count>0&&r.label));
s=W.suggest(data,{query:'アコール',ids:new Set()});assert.deepEqual(s.relax,[{key:'ids',label:'「お気に入りだけ」を外す',count:1}]);
s=W.suggest(data,{query:'アコール',lengths:['long']});assert.deepEqual(s.relax.map(r=>[r.key,r.count]),[['query',W.filter(data,{lengths:['long']}).results.length],['lengths',1]]);
assert.deepEqual(W.suggest(data,{query:'りんご',scope:'name'}).themes,[]);
assert.deepEqual(W.nearCategories(data,'apple'),[]);
ok('zero results: unknown words are not “translated”; near themes come only from shared kanji with registered labels; each relaxable condition reports how many words it would show');

// ---- 創作名の記録：重なりの扱いと文言 ----
const word=byId.get('WN-FR-0010'),cand=word.candidates[0];
const asIs=W.newIdea(data,word,{candidateId:cand.id,name:cand.name,method:cand.method});
assert.equal(asIs.overlap,cand.overlap);assert.ok(asIs.overlap.includes('超音速旅客機'));assert.equal(asIs.dataVersion,'2.0.0');
const edited=W.newIdea(data,word,{candidateId:cand.id,name:'コンコルデ',method:cand.method,intent:'双子の姉に。'});
assert.equal(edited.overlap,'','an edited name loses the known-overlap note');assert.equal(edited.method,'free');
assert.equal(W.overlapText(''),'未確認');assert.equal(W.overlapText('x'),'x（ほかの重複は未確認）');
const text=W.ideaToText(data,asIs).split('\n');
assert.ok(text.includes('原語の意味：'+word.meaningJa));assert.ok(text.some(l=>l.startsWith('実在の人名・単語との重なり：超音速旅客機')&&l.endsWith('（ほかの重複は未確認）')));
assert.ok(text.includes('※創作向けに加工した名前です。実在する人名・単語との重複は確認していません。'));
assert.ok(W.ideaToText(data,edited).includes('実在の人名・単語との重なり：未確認'));
assert.deepEqual(Object.keys(C.sanitizeNameIdeas([asIs])[0]).sort(),Object.keys(asIs).sort());assert.equal(C.sanitizeNameIdeas([asIs])[0].overlap,asIs.overlap);
ok('saved names carry a known-overlap note only while unedited; everything else is labelled “未確認”, never “not a real name”');

// ---- 複数キャラへの割り当て ----
const pool=W.candidatePool(W.filter(data,{categories:['affirm'],langs:['fr','de']}).results);
assert.equal(pool.length,W.filter(data,{categories:['affirm'],langs:['fr','de']}).results.reduce((n,r)=>n+r.candidates.length,0));
const nWords=W.filter(data,{categories:['affirm'],langs:['fr','de']}).results.length;assert.equal(nWords,6);
assert.equal(new Set(pool.slice(0,nWords).map(x=>x.word.id)).size,nWords,'first pass takes one candidate per word');assert.equal(pool[nWords].word.id,pool[0].word.id);
const picked=W.pickAssignments(pool,5,['アコール','やー']);
assert.equal(picked.length,5);assert.equal(new Set(picked.map(x=>W.normalize(x.candidate.name))).size,5);
assert.ok(picked.every(x=>!['アコール','ヤー'].includes(x.candidate.name)),'names already used by other characters are skipped');
assert.deepEqual(W.pickAssignments(pool.slice(0,2),4,[]).map(x=>!!x),[true,true,false,false]);
const dupPool=[{candidate:{name:'トレランス'}},{candidate:{name:'トレランス'}},{candidate:{name:'リベラ'}}];
assert.deepEqual(W.pickAssignments(dupPool,3,[]).map(x=>x&&x.candidate.name),['トレランス','リベラ',null]);
assert.deepEqual(W.findDuplicates(['アコール',' あこーる ','ヤー','','リベラ','']),[{name:'アコール',indexes:[0,1]}]);
assert.deepEqual(W.findDuplicates(['a','b']),[]);
ok('batch assignment: one candidate per word first, no duplicate names, skips names taken by other characters, reports shortfall; duplicate detection ignores kana/width/space differences');

// ---- 命名コレクション ----
const p=C.newProject('検証');assert.deepEqual([p.nameIdeas,p.nameCollections,p.nameUses],[[],[],[]]);
const i1=W.newIdea(data,byId.get('WN-FR-0002'),{candidateId:'WN-FR-0002-a',name:'アコール',method:'kana',intent:'兄。'});
const i2=W.newIdea(data,byId.get('WN-DE-0001'),{name:'ヤヴォル',method:'free'});
const i3=W.newIdea(data,byId.get('WN-IT-0013'),{candidateId:'WN-IT-0013-a',name:'スペランツァ',method:'kana'});
p.nameIdeas.push(i1,i2,i3);
const col=C.newCollection('  全肯定する兄弟  ');assert.equal(col.name,'全肯定する兄弟');col.theme='肯定・同意';col.memo='兄弟の名。';
col.items.push({ideaId:i1.id,note:'兄'},{ideaId:i2.id,note:''},{ideaId:i3.id,note:''});p.nameCollections.push(col);
assert.deepEqual([...new Set(col.items.map(i=>p.nameIdeas.find(x=>x.id===i.ideaId).source.lang))],['fr','de','it'],'languages can be mixed');
assert.equal(C.moveCollectionItem(col,0,-1),false);assert.equal(C.moveCollectionItem(col,2,1),false);assert.equal(C.moveCollectionItem(col,9,1),false);
assert.equal(C.moveCollectionItem(col,0,1),true);assert.deepEqual(col.items.map(i=>i.ideaId),[i2.id,i1.id,i3.id]);
assert.equal(C.moveCollectionItem(col,1,-1),true);assert.deepEqual(col.items.map(i=>i.ideaId),[i1.id,i2.id,i3.id]);
const ct=C.collectionToText(col,p.nameIdeas).split('\n');
assert.equal(ct[0],'コレクション：全肯定する兄弟');assert.ok(ct.includes('共通テーマ：肯定・同意'));assert.ok(ct.includes('（3件）'));
assert.ok(ct.includes('1. アコール：accord（フランス語）／'+byId.get('WN-FR-0002').meaningJa));assert.ok(ct.includes('   創作上の意図：兄。'));assert.ok(ct.includes('   メモ：兄'));
assert.ok(ct.includes('2. ヤヴォル：ja（ドイツ語）／'+byId.get('WN-DE-0001').meaningJa));assert.ok(ct[ct.length-1].includes('原語の意味で、創作名そのものの意味ではありません'));
assert.equal(C.sanitizeCollections([null,'x',{name:'',items:[{ideaId:'a'},{ideaId:'a'},{ideaId:5},null,{ideaId:'b',note:{}}],theme:7,memo:'m'}])[0].items.length,2);
assert.deepEqual(C.sanitizeCollections([{name:'',items:'x'}])[0].name,'命名コレクション');
assert.deepEqual(C.ideaImpact(p,i1.id),{collections:['全肯定する兄弟'],uses:0});
ok('collections: create, mixed languages, reorder with bounds, per-item notes, text export keeps source meaning apart from intent, hostile input sanitized');

// ---- 名前の利用先（キャラ名・家名・地名・組織名・用語集）：語彙は書き換えない ----
assert.deepEqual(C.NAME_USE_KINDS.map(k=>k.key),['character','family','nation','region','city','organization','glossary']);
assert.deepEqual(C.NAME_USE_KINDS.filter(k=>k.target==='entry').map(k=>[k.section,k.entryKind]),[['organization','家系'],['geography','国家'],['geography','地域'],['geography','都市'],['organization','派閥'],['glossary','固有名詞']]);
for(const k of C.NAME_USE_KINDS.filter(k=>k.target==='entry'))assert.ok(C.SECTION_DEFS.find(d=>d.key===k.section).kinds.includes(k.entryKind),k.key);
const before=JSON.stringify(data);
const chr=C.newCharacter(p.id,'旧名');const entry=C.newEntry('アコール王国','国家','');p.world.sections.find(s=>s.key==='geography').entries.push(entry);
entry.body=C.nameUseBody(i1,'アコール王国','建国の盟約にちなむ。');
assert.deepEqual(entry.body.split('\n').slice(0,5),['名前の由来（言葉から名付け）','もとにした創作名：アコール','もとにした言葉：accord（フランス語・名詞（男性））','原語の意味：'+i1.source.meaningJa,'命名意図：建国の盟約にちなむ。']);
assert.ok(!C.nameUseBody(i1,'アコール','').includes('もとにした創作名')&&!C.nameUseBody(i1,'アコール','').includes('命名意図'));
p.nameUses.push(C.newNameUse(i1,'nation','アコール王国','建国の盟約にちなむ。',entry.id),C.newNameUse(i1,'character','アコール','兄。',chr.id),C.newNameUse(i2,'glossary','ヤヴォル','', 'ent_missing'));
assert.throws(()=>C.newNameUse(i1,'spaceship','x','','y'));
assert.equal(JSON.stringify(data),before,'using a name must not touch the vocabulary');assert.equal(i1.name,'アコール');
assert.deepEqual(C.ideaImpact(p,i1.id),{collections:['全肯定する兄弟'],uses:2});
C.repairProject(p,[chr]);assert.equal(p.nameUses.length,2,'a use whose world entry no longer exists is dropped');
assert.equal(C.sanitizeNameUses([null,{kind:'x',name:'a',targetId:'t'},{kind:'city',name:' ',targetId:'t'},{kind:'city',name:'町',targetId:''},{kind:'city',name:'町',targetId:'t',intent:5,targetType:'character'}]).length,1);
assert.equal(C.sanitizeNameUses([{kind:'city',name:'町',targetId:'t',targetType:'character'}])[0].targetType,'entry');
ok('a coined name can be used as character / family / nation / region / city / organization / glossary; each use stores its own name and intent; vocabulary untouched; dangling uses removed');

// ---- バックアップ・復元・旧バックアップ ----
assert.equal(C.FORMAT_VERSION,3);
const bundle=JSON.parse(JSON.stringify(C.exportBundle(p,[chr],[])));assert.equal(bundle.version,3);
const r=C.importBundle(bundle);
assert.equal(r.project.nameIdeas.length,3);assert.equal(r.project.nameCollections.length,1);assert.equal(r.project.nameUses.length,2);
const rc=r.project.nameCollections[0],rIdeas=new Map(r.project.nameIdeas.map(i=>[i.id,i]));
assert.notEqual(rc.id,col.id);assert.deepEqual([rc.name,rc.theme,rc.memo],['全肯定する兄弟','肯定・同意','兄弟の名。']);
assert.deepEqual(rc.items.map(i=>[rIdeas.get(i.ideaId).name,i.note]),[['アコール','兄'],['ヤヴォル',''],['スペランツァ','']],'collection items follow the re-issued idea IDs, in order');
const ru=r.project.nameUses,rChar=r.characters[0];
assert.deepEqual(ru.map(u=>[u.kind,u.name,u.intent,rIdeas.get(u.ideaId).name]),[['nation','アコール王国','建国の盟約にちなむ。','アコール'],['character','アコール','兄。','アコール']]);
assert.equal(ru[1].targetId,rChar.id);assert.notEqual(rChar.id,chr.id);
assert.ok(r.project.world.sections.find(s=>s.key==='geography').entries.some(e=>e.id===ru[0].targetId&&e.body.includes('命名意図：建国の盟約')));
// 削除：コレクションから外れ、利用先の記録（名前と意図）は残る
C.removeIdeaRefs(r.project,rc.items[0].ideaId);assert.equal(rc.items.length,2);assert.ok(r.project.nameUses.every(u=>u.ideaId===''&&u.name));
// v2.1（version 2）のバックアップ：新しい欄が無くても読める
const old=clone(bundle);old.version=2;delete old.project.nameCollections;delete old.project.nameUses;old.project.nameIdeas.forEach(i=>{delete i.overlap;});
const ro=C.importBundle(old);assert.equal(ro.project.nameIdeas.length,3);assert.deepEqual([ro.project.nameCollections,ro.project.nameUses],[[],[]]);assert.equal(ro.project.nameIdeas[0].overlap,'');
const legacy=C.repairProject({id:'x',name:'旧作品',charts:[],heightCompare:{items:[]},world:C.defaultWorld(),nameIdeas:[i1]},[]);
assert.deepEqual([legacy.nameCollections,legacy.nameUses],[[],[]]);assert.equal(legacy.nameIdeas.length,1);
assert.equal(C.validateBundle(Object.assign(clone(bundle),{version:4})),'このバックアップは新しい版で作られています。アプリを更新してください。');
const hostile=C.importBundle({format:C.FORMAT,version:3,project:{name:'x',nameIdeas:[{id:'i',name:'名',source:{}}],nameCollections:[{name:'<b>c</b>',items:[{ideaId:'i'},{ideaId:'ghost'}]},7],nameUses:[{kind:'character',name:'名',targetId:'ghost',ideaId:'i'},{kind:'city',name:'町',targetId:'nowhere'}]},characters:[],images:[]});
assert.deepEqual([hostile.project.nameCollections.length,hostile.project.nameCollections[0].items.length,hostile.project.nameCollections[0].name,hostile.project.nameUses.length],[1,1,'<b>c</b>',0]);
ok('collections and uses are part of the per-project backup (format 3): IDs re-issued and re-linked on restore; v2.1 backups and projects still load; dangling references dropped');

console.log('PASS '+checks.length+' groups');checks.forEach(c=>console.log(' - '+c));
