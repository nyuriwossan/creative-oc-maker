'use strict';
// Run: node verify-word-naming.cjs — 「言葉から名付け」のデータと検索・記録ロジックの検証
const assert=require('node:assert/strict'),fs=require('fs');
const W=require('./js/word-naming-core.js'),C=require('./js/studio/core.js');
const data=JSON.parse(fs.readFileSync('./data/word-naming-v1.json','utf8'));
const checks=[],ok=n=>checks.push(n);
const clone=o=>JSON.parse(JSON.stringify(o));

// スキーマ・ID・言語分類・出典
assert.deepEqual(W.validate(data),[]);
assert.equal(data.schema,'oc-word-naming');assert.equal(data.schemaVersion,1);
assert.equal(new Set(data.words.map(w=>w.id)).size,data.words.length);
const candIds=data.words.flatMap(w=>w.candidates.map(c=>c.id));assert.equal(new Set(candIds).size,candIds.length);
assert.deepEqual(Object.keys(data.languages).sort(),['de','en','fr','it','pt']);
for(const lang of Object.keys(data.languages))assert.ok(data.words.filter(w=>w.lang===lang).length>=4,lang);
for(const w of data.words){
  const u=new URL(w.source.url);assert.equal(u.protocol,'https:');assert.equal(u.hostname,data.languages[w.lang].host,w.id);
  assert.ok(decodeURIComponent(u.pathname).toLowerCase().includes(w.lemma.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase()),w.id+' URL must point at the headword');
  assert.equal(w.verification.status,'verified');assert.match(w.verification.date,/^\d{4}-\d{2}-\d{2}$/);
  assert.ok(w.meaningJa.length<=80,w.id+' meaning must stay a short edited note');assert.ok(w.nuanceNote.length<=90,w.id);
  assert.equal(w.kana.basis,w.pronunciation.ipa?'ipa':'unconfirmed');
}
ok('schema, unique word/candidate IDs, five languages, dictionary host per language, short notes');

// 既存の名前辞典データとは別物で、IDも衝突しない
const dict=JSON.parse(fs.readFileSync('./data/dictionary-v1.7.json','utf8'));
assert.equal(dict.entries.length,675);
const dictIds=new Set(dict.entries.map(e=>e.id));assert.ok(data.words.every(w=>!dictIds.has(w.id)));
assert.notEqual(W.FAVORITE_KEY,require('./js/dictionary-core.js').favoriteKey);
ok('separate from the 675-entry dictionary: no shared IDs, separate favorites key');

// 検証が実際に不正を検出すること
const bad=(mutate,pattern)=>{const d=clone(data);mutate(d);const e=W.validate(d);assert.ok(e.some(x=>pattern.test(x)),String(pattern)+' not detected: '+e.join(' / '));};
bad(d=>{d.words[1].id=d.words[0].id;},/ID が重複/);
bad(d=>{d.words[0].candidates[1].id=d.words[0].candidates[0].id;},/候補ID が重複/);
bad(d=>{d.words[0].lang='es';},/未定義の言語/);
bad(d=>{d.words[0].lang='de';},/ID と言語が一致しません/);
bad(d=>{d.words[0].source.url='https://example.com/oui';},/辞書（www\.larousse\.fr）ではありません/);
bad(d=>{d.words[0].source.url='';},/確認済みなのに出典URLがありません/);
bad(d=>{d.words[0].source.url='javascript:alert(1)';},/出典URLがありません/);
bad(d=>{delete d.words[0].verification.date;},/確認日がありません/);
bad(d=>{d.words[6].kana.basis='ipa';},/発音が未確認なのにカタカナ読みを確認済み扱い/);
bad(d=>{d.words[0].categories=['hope'];},/準備中のカテゴリ/);
bad(d=>{d.words[0].categories=['nope'];},/未定義のカテゴリ/);
bad(d=>{d.words[0].candidates[0].name='oui';},/候補名が原語そのもの/);
bad(d=>{d.words[0].candidates[0].method='free';},/加工方法が不正/);
bad(d=>{d.words[0].candidates[0].name='ウイイ';},/カタカナ読みと一致/);
bad(d=>{d.words.push(clone(d.words[0]));},/ID が重複/);
bad(d=>{d.schemaVersion=2;},/schemaVersion/);
assert.ok(W.validate(null).length);assert.ok(W.validate({}).length);
ok('validator rejects duplicate IDs, wrong language/host, unverified-as-verified, planned categories, real words as coined names');

// 検索・絞り込み
const lem=r=>r.results.map(x=>x.word.lemma);
assert.equal(W.filter(data,{}).results.length,20);
assert.deepEqual(lem(W.filter(data,{langs:['fr']})),['oui','accord','assentiment','reconnaissance']);
assert.equal(W.filter(data,{langs:['fr','pt']}).results.length,8);
assert.ok(W.filter(data,{categories:['recognize']}).results.every(x=>x.word.categories.includes('recognize')));
assert.deepEqual(lem(W.filter(data,{query:'accord'})),['accord','accord']);
assert.deepEqual(lem(W.filter(data,{query:'アコール'})),['accord']);assert.deepEqual(lem(W.filter(data,{query:'あこーる'})),['accord']);
assert.deepEqual(lem(W.filter(data,{query:'si'})),['sì','sim']);assert.deepEqual(lem(W.filter(data,{query:'SÌ'})),['sì']);
assert.deepEqual(lem(W.filter(data,{query:'拍手'})),['Beifall']);
// 自由入力のテーマは登録済みカテゴリに結びつく
const praise=W.filter(data,{query:'ほめる'});assert.deepEqual(praise.themeCategories,['recognize']);assert.ok(praise.results.length>=5&&praise.results.every(x=>x.word.categories.includes('recognize')));
assert.deepEqual(W.filter(data,{query:'賛成'}).themeCategories,['affirm']);
assert.deepEqual(W.filter(data,{query:'賛成 ドイツ語'}).results.map(x=>x.word.lang).filter((v,i,a)=>a.indexOf(v)===i),['de']);
// 未登録の言葉を「翻訳」して当てたりしない
assert.equal(W.filter(data,{query:'りんご'}).results.length,0);assert.deepEqual(W.filter(data,{query:'りんご'}).themeCategories,[]);
assert.ok(W.filter(data,{nuances:['formal','official']}).results.every(x=>x.word.nuances.includes('formal')&&x.word.nuances.includes('official')));
const short=W.filter(data,{lengths:['short']});assert.ok(short.results.length&&short.results.every(x=>x.candidates.length&&x.candidates.every(c=>W.moraCount(c.name)<=3)));
const noble=W.filter(data,{impressions:['noble'],lengths:['long']});assert.ok(noble.results.every(x=>x.candidates.every(c=>c.impressions.includes('noble')&&W.moraCount(c.name)>=6)));
assert.deepEqual(lem(W.filter(data,{ids:new Set(['WN-IT-0002'])})),['assenso']);
assert.deepEqual([['ウィ',1],['シュティム',3],['アッセンソ',5],['レコニェ',3],['ツーシュティムング',7],['',0]].map(([n])=>W.moraCount(n)),[1,3,5,3,7,0]);
assert.equal(W.lengthBucket('アコール'),'mid');
ok('search by meaning/theme/lemma/kana, accent-insensitive, multi-language, nuance, coined-name length and impression, no fake translation');

// 創作名の記録：原語の情報を保持し、原語の意味と創作上の意図を分ける
const word=data.words.find(w=>w.id==='WN-FR-0002'),cand=word.candidates[0];
const asIs=W.newIdea(data,word,{candidateId:cand.id,name:cand.name,method:cand.method});
assert.equal(asIs.edited,false);assert.equal(asIs.method,'kana');assert.equal(asIs.wordId,'WN-FR-0002');assert.equal(asIs.baseName,'アコール');
const edited=W.newIdea(data,word,{candidateId:cand.id,name:'アコリエ',method:cand.method,intent:'調停役の少女に。'});
assert.equal(edited.edited,true);assert.equal(edited.method,'free');
assert.equal(W.newIdea(data,word,{candidateId:cand.id,name:'アコリエ',method:'adjust',methodChosen:true}).method,'adjust');
const own=W.newIdea(data,word,{name:'コルデ',method:'free'});assert.equal(own.candidateId,null);assert.equal(own.edited,true);
assert.deepEqual(edited.source,{lemma:'accord',lang:'fr',langLabel:'フランス語',pos:'名詞（男性）',meaningJa:word.meaningJa,dictionary:'Larousse',url:word.source.url,verified:'2026-11-17'});
const text=W.ideaToText(data,edited).split('\n');
assert.ok(text.includes('創作名：アコリエ'));assert.ok(text.includes('原語の意味：'+word.meaningJa));assert.ok(text.includes('創作上の意図：調停役の少女に。'));
assert.ok(text.some(l=>l.includes('候補「アコール」から編集')));assert.ok(text.some(l=>l.includes('実在する人名・単語であることを示しません')));
assert.notEqual(text.findIndex(l=>l.startsWith('原語の意味')),text.findIndex(l=>l.startsWith('創作上の意図')));
ok('coined names keep the source word, method and edit trail; source meaning and creative intent stay separate');

// 作品への保存 → バックアップ → 復元
const p=C.newProject('検証');assert.deepEqual(p.nameIdeas,[]);
p.nameIdeas.push(edited,own);
const legacy=C.repairProject({id:'x',name:'旧作品',charts:[],heightCompare:{items:[]},world:C.defaultWorld()},[]);assert.deepEqual(legacy.nameIdeas,[]);
const restored=C.importBundle(JSON.parse(JSON.stringify(C.exportBundle(p,[],[]))));
assert.equal(restored.project.nameIdeas.length,2);
const r=restored.project.nameIdeas[0];assert.notEqual(r.id,edited.id);
assert.deepEqual({...r,id:0,updatedAt:0},{...edited,id:0,updatedAt:0});
const hostile=C.importBundle({format:C.FORMAT,version:2,project:{name:'x',nameIdeas:[null,{name:''},{name:'  名  ',method:'zzz',source:{url:'javascript:alert(1)',lemma:5},intent:{}},'str']},characters:[],images:[]});
assert.equal(hostile.project.nameIdeas.length,1);
assert.deepEqual([hostile.project.nameIdeas[0].name,hostile.project.nameIdeas[0].method,hostile.project.nameIdeas[0].source.url,hostile.project.nameIdeas[0].source.lemma],['名','free','','5']);
assert.ok(C.nameIdeaNote(edited).includes('原語の意味：')&&C.nameIdeaNote(edited).includes('創作上の意図：調停役の少女に。'));
ok('name ideas live in the project: survive backup/restore, old projects get an empty list, hostile input sanitized');

// お気に入り（辞典とは別キー）
const store={};const ls={getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=v;}};
const f=W.favorites(()=>ls);assert.equal(f.toggle('WN-FR-0001'),true);assert.equal(f.toggle('WN-DE-0001'),true);assert.equal(f.toggle('WN-FR-0001'),false);
assert.deepEqual(JSON.parse(store[W.FAVORITE_KEY]),{version:1,ids:['WN-DE-0001']});
assert.deepEqual(W.favorites(()=>ls).ids(),['WN-DE-0001']);
let warned='';store[W.FAVORITE_KEY]='{broken';const fb=W.favorites(()=>ls,m=>{warned=m;});assert.ok(warned);assert.deepEqual(fb.ids(),[]);fb.toggle('a');assert.equal(store[W.FAVORITE_KEY],'{broken');
ok('favorites persist under their own key; corrupt storage is reported and never overwritten');

console.log('PASS '+checks.length+' groups: '+checks.join('; '));
