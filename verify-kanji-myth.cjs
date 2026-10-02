'use strict';
// v1.5 source integrity, category balance, finite batches and UI transactions.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const data=require('./data/kanji-myth-v1.5.json');
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
const source=html.match(/<script>([\s\S]*?)<\/script>/)[1].replace(/\binit\(\);\s*$/,'');
let random=()=>.25,manual='',rendered=null;
const error={hidden:true,textContent:'',focus(){}};
const math=Object.create(Math);math.random=()=>random();
const ctx=vm.createContext({console,Math:math,document:{getElementById:id=>id==='nameInput'?{value:manual}:id==='generationError'?error:{scrollIntoView(){}}},setTimeout:()=>{}});
vm.runInContext(source,ctx);
const a=vm.runInContext(`({nameData,kanjiMythData,nameSources,moodDefs,kanjiEligibleGroups,mythEligibleEntities,generateName,generateMultiple,generateFullCharacter,rememberName,nameHistory,buildNameText,buildDetailText,renderNameInfo,runGenerate,
 configure(system,mode='nameOnly',world='modern',gender='male',reading='standard',type='deity',tradition='auto'){selectedNameSystem=system;currentMode=mode;selectedWorld=world;selectedGender=gender;selectedMoods=[];selectedRoles=[];selectedRelationships=[];selectedKanjiReadingMode=reading;selectedMythType=type;selectedMythTradition=tradition;},
 setRender(fn){renderResults=fn;}, results(){return generatedResults;}})`,ctx);
function seeded(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
const report={version:'1.5',passed:false,counts:{},distribution:{},checks:[]};
function check(label,fn){fn();report.checks.push(label);console.log('PASS',label);}
check('records, one-Han names, provenance and separate entity identity',()=>{
 const ids=new Set(),displays=new Set(),groups=new Set(),spelling=new Set();
 for(const k of data.kanji){
  assert.match(k.display,/^\p{Script=Han}[\uFE00-\uFE0F\u{E0100}-\u{E01EF}]*$/u);
  assert.ok(!ids.has(k.id)&&!displays.has(k.display));ids.add(k.id);displays.add(k.display);groups.add(k.variantGroup);
  assert.ok(k.moodTags.every(t=>a.moodDefs[t]));
  for(const r of k.readings)assert.ok(r.sources.every(s=>data.sources[s]));
 }
 const entityIds=new Set();for(const m of data.myth){
  assert.ok(!entityIds.has(m.canonicalEntityId));entityIds.add(m.canonicalEntityId);
  assert.ok(m.description&&m.sources.length&&m.traditions.length&&m.sources.every(s=>a.nameSources[s]?.url));
  assert.ok(!spelling.has(m.display));spelling.add(m.display);
  for(const alias of m.aliases){assert.ok(!spelling.has(alias.display));spelling.add(alias.display);assert.ok(alias.sources.length);}
 }
 assert.notEqual(data.myth.find(m=>m.id==='greek:zeus').canonicalEntityId,data.myth.find(m=>m.id==='roman:jupiter').canonicalEntityId);
 const previous=[];function walk(node){if(Array.isArray(node)){previous.push(...node);return;}if(node&&typeof node==='object')for(const value of Object.values(node))walk(value);}walk(a.nameData);
 const oldSingle=new Set(previous.filter(n=>n.kanji&&Array.from(n.kanji).length===1).map(n=>n.kanji));
 const oldNames=new Set(previous.flatMap(n=>[n.kanji,n.kana]).filter(Boolean));
 const reusedKanji=data.kanji.filter(k=>oldSingle.has(k.display)).map(k=>k.display);
 const reusedMyth=data.myth.filter(m=>[m.display,...m.aliases.map(a=>a.display)].some(n=>oldNames.has(n))).map(m=>m.id);
 report.counts={kanjiDisplays:data.kanji.length,kanjiReadings:data.kanji.reduce((n,k)=>n+k.readings.length,0),kanjiGroups:groups.size,
  standardGroups:a.kanjiEligibleGroups('standard').length,creativeReadings:data.kanji.reduce((n,k)=>n+k.readings.filter(r=>r.kind==='creative').length,0),
  mythEntities:data.myth.length,mythAliases:data.myth.reduce((n,m)=>n+m.aliases.length,0),traditionMemberships:data.myth.reduce((n,m)=>n+m.traditions.length,0),
  byType:Object.fromEntries(['deity','hero','namedCreature','namedSpirit'].map(t=>[t,data.myth.filter(m=>m.entityType===t).length])),
  byTradition:Object.fromEntries(['greek','roman','norse','egypt','japan','mesopotamia','arthur'].map(t=>[t,data.myth.filter(m=>m.traditions.some(x=>x.id===t)).length])),
  reusedKanjiDisplays:reusedKanji.length,newKanjiDisplays:data.kanji.length-reusedKanji.length,reusedKanji,reusedMythEntities:reusedMyth.length,newMythEntities:data.myth.length-reusedMyth.length,reusedMyth,
  held:data.candidateLedger.filter(x=>x.decision==='hold').length,excluded:data.candidateLedger.filter(x=>x.decision==='exclude').length};
});
check('kanji reading mode and variant group selection',()=>{
 a.configure('kanjiSingle');
 assert.equal(a.kanjiEligibleGroups('standard').some(g=>g.variants.some(v=>v.display==='永')),false);
 assert.equal(a.kanjiEligibleGroups('creative').some(g=>g.variants.some(v=>v.display==='永')),true);
 assert.equal(a.kanjiEligibleGroups('standard').find(g=>g.id==='rin').variants.length,2);
 const standard=seeded(125),creative=seeded(125);
 for(let i=0;i<5000;i++){
  const x=a.generateName('modern','male',[],{system:'kanjiSingle',rng:standard,kanjiReadingMode:'standard'});
  assert.equal(x.nameParts.single.readingKind,'dictionary');assert.equal(x.display,x.nameParts.single.display);
  assert.ok(!x.nameParts.family);assert.equal(x.reading,x.nameParts.single.reading);
  const y=a.generateName('modern','male',[],{system:'kanjiSingle',rng:creative,kanjiReadingMode:'creative'});
  assert.ok(y.nameParts.single.readingKind==='dictionary'||y.nameParts.single.readingKind==='creative');
 }
 let rin=0,sakura=0,tetsu=0;const r=seeded(882);for(let i=0;i<60000;i++){
  const n=a.generateName('modern','male',[],{system:'kanjiSingle',rng:r});
  const group=n.nameParts.single.variantGroup;if(group==='rin')rin++;if(group==='sakura')sakura++;if(group==='tetsu')tetsu++;
 }
 const expected=60000/a.kanjiEligibleGroups('standard').length;
 for(const n of [rin,sakura,tetsu])assert.ok(Math.abs(n-expected)/expected<.16);
 report.distribution.variantGroups={trials:60000,expected,rin,sakura,tetsu};
});
check('creative reading and Japanese myth alias retain explicit reading labels',()=>{
 a.configure('kanjiSingle','nameOnly','modern','male','creative');
 const k=a.generateFullCharacter({rng:()=>.999});
 assert.equal(k.name,'永');assert.equal(k.reading,'とわ');assert.equal(k.nameParts.single.readingKind,'creative');
 assert.match(a.buildDetailText(k),/創作読み/);
 a.configure('mythology','nameOnly','modern','male','standard','deity','japan');
 const m=a.generateFullCharacter({rng:()=>.999});
 assert.equal(m.name,'大国主');assert.equal(m.reading,'おおくにぬし');
 assert.match(a.buildDetailText(m),/元の綴り/);
});
check('myth categories and aliases do not change selection tickets',()=>{
 a.configure('mythology','nameOnly','modern','male','standard','auto','auto');
 const types={},traditions={},r=seeded(555);for(let i=0;i<30000;i++){
  const n=a.generateName('modern','male',[],{system:'mythology',mythType:'auto',mythTradition:'auto',rng:r});
  types[n.naming.entityType]=(types[n.naming.entityType]||0)+1;
  if(n.naming.entityType==='deity')traditions[n.naming.tradition]=(traditions[n.naming.tradition]||0)+1;
 }
 assert.deepEqual(Object.keys(types).sort(),['deity','hero','namedCreature']);
 for(const n of Object.values(types))assert.ok(n>9000&&n<11000);
 for(const n of Object.values(traditions))assert.ok(n>1250&&n<2050);
 const counts={},m=seeded(921);for(let i=0;i<24000;i++){
  const n=a.generateName('modern','male',[],{system:'mythology',mythType:'deity',mythTradition:'mesopotamia',rng:m});
  counts[n.nameParts.single.canonicalEntityId]=(counts[n.nameParts.single.canonicalEntityId]||0)+1;
 }
 assert.equal(Object.keys(counts).length,6);
 for(const n of Object.values(counts))assert.ok(n>3500&&n<4500);
 report.distribution.myth={trials:30000,types,traditions,mesopotamia:counts};
});
check('five unique groups or entities, all modes and independent world settings',()=>{
 for(const [system,reading,type,tradition] of [['kanjiSingle','standard','deity','auto'],['kanjiSingle','creative','deity','auto'],['mythology','standard','deity','auto'],['mythology','standard','hero','auto'],['mythology','standard','namedCreature','auto'],['mythology','standard','auto','auto']]){
  a.configure(system,'nameOnly','modern','male',reading,type,tradition);
  for(let i=0;i<30;i++){
   const batch=a.generateMultiple(system==='mythology'&&type==='namedCreature'?4:system==='mythology'&&type==='hero'?4:5);
   assert.equal(new Set(batch.map(c=>c.name)).size,batch.length);
   assert.equal(new Set(batch.map(c=>c.nameParts.single.historyId)).size,batch.length);
   assert.ok(batch.every(c=>c.nameParts.single.role==='single'&&!c.nameParts.family));
  }
  a.configure(system,'full','western','female',reading,type,tradition);
  const c=a.generateMultiple(1)[0];assert.equal(c.worldKey,'western');assert.ok(c.imagePrompt.includes('fantasy'));
  assert.ok(a.buildDetailText(c).includes('出典：'));
 }
 a.configure('kanjiSingle','settingOnly');manual='固定名';const c=a.generateMultiple(5);assert.ok(c.every(x=>x.name==='固定名'&&!x.naming));
 a.configure('kanjiSingle','full','modern','male');random=seeded(151);const one=a.generateFullCharacter({rng:seeded(30)});
 a.configure('mythology','full','modern','male');random=seeded(151);const two=a.generateFullCharacter({rng:seeded(30)});
 for(const k of ['worldKey','occupation','appearance','age','imagePrompt'])assert.equal(one[k],two[k]);
});
check('candidate shortage and mid-batch failure preserve displayed results and history',()=>{
 a.configure('mythology','nameOnly','modern','male','standard','hero','arthur');
 assert.equal(a.generateMultiple(1).length,1);
 assert.throws(()=>a.generateMultiple(5),/1人分まで/);
 a.setRender(next=>{rendered=next;});a.nameHistory.clear();a.runGenerate(1);
 const previous=a.results(),history=JSON.stringify([...a.nameHistory]);
 a.runGenerate(5);assert.equal(a.results(),previous);assert.equal(JSON.stringify([...a.nameHistory]),history);
 assert.equal(error.hidden,false);assert.match(error.textContent,/以前の結果は保持/);
 a.configure('kanjiSingle');const sequence=[.1,.1,.1,.1,NaN];let i=0;
 assert.throws(()=>a.generateMultiple(5,{history:a.nameHistory,rng:()=>sequence[i++]??NaN}),/乱数/);
 assert.equal(JSON.stringify([...a.nameHistory]),history);
});
report.passed=true;
const out=process.argv[2];if(out)fs.writeFileSync(out,JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
