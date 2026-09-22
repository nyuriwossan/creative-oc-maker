'use strict';
// Independent v1.3 distribution, history, source-data and UI transaction regressions.
// Run: node verify-naming.cjs [report.json]
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
const source=html.match(/<script>([\s\S]*?)<\/script>/)[1].replace(/\binit\(\);\s*$/,'');
function seeded(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
let rng=seeded(0x31337),manual='',rendered=null;
const error={hidden:true,textContent:'',focus(){}};
const math=Object.create(Math);math.random=()=>rng();
const ctx=vm.createContext({console,Math:math,document:{getElementById:id=>id==='nameInput'?{value:manual}:id==='generationError'?error:{scrollIntoView(){}}},setTimeout:()=>{}});
vm.runInContext(source,ctx);
const a=vm.runInContext(`({nameData,nameRecords,nameSources,modernPools,fantasyPools,namingSystems,namingCultures,namingMotifs,nameHistory,namingWeight,pickFromPool,generateName,generateMultiple,generateFullCharacter,rememberName,avoidRecent,uniqueRecords,buildNameText,buildDetailText,renderNameInfo,runGenerate,
 configure(system,culture='auto',motifs=[],world='modern',gender='male',mode='nameOnly'){selectedNameSystem=system;selectedNameCulture=culture;selectedNameMotifs=motifs;selectedWorld=world;selectedGender=gender;currentMode=mode;selectedMoods=['気だるい'];selectedRoles=[];selectedRelationships=[];},
 results(){return generatedResults;},setRender(fn){renderResults=fn;}})`,ctx);
const report={version:'1.3',passed:false,distribution:{},data:{},checks:[],samples:0};
const check=(name,fn)=>{fn();report.checks.push(name);console.log('PASS',name);};
function summarize(counts){const sorted=[...counts].sort((a,b)=>b[1]-a[1]),n=sorted.reduce((s,x)=>s+x[1],0);return {trials:n,unique:counts.size,maxShare:sorted[0][1]/n,top10:sorted.slice(0,10).map(([name,count])=>({name,count,share:count/n}))};}
function sample(pool,moods,legacy,history){const r=seeded(0x51f7),counts=new Map(),h=new Map();for(let i=0;i<30000;i++){
 let n;if(legacy){const matched=pool.filter(x=>(x.tags||[]).some(t=>moods.includes(t)));const list=matched.length&&r()<.75?matched:pool;n=list[Math.floor(r()*list.length)].kanji;}
 else if(history){const c=a.generateName('modern','male',moods,{system:'japanese',rng:r,history:h});n=c.nameParts.given.display;a.rememberName(h,c);}
 else n=a.pickFromPool(pool,moods,r).kanji;
 counts.set(n,(counts.get(n)||0)+1);
 }report.samples+=30000;return summarize(counts);}
check('bounded weights use unique selected tags',()=>{
 assert.equal(a.namingWeight({tags:['知的','知的']},['知的','知的']),1.75);
 assert.equal(a.namingWeight({tags:['知的']},['知的','穏やか','穏やか']),1.375);
 assert.equal(a.namingWeight({tags:['知的']},[]),1);
 assert.equal(a.namingWeight({tags:['知的']},['お任せ']),1);
 assert.equal(a.pickFromPool([],['知的']),null);
 assert.throws(()=>a.pickFromPool([{}],[],()=>NaN),/乱数/);
 assert.throws(()=>a.pickFromPool([{}],[],()=>1),/乱数/);
});
check('190 candidates / one match follows 1.75 ÷ 190.75',()=>{
 const pool=Array.from({length:190},(_,i)=>({id:i,tags:i===0?['知的']:[]})),r=seeded(8462);let hits=0;
 for(let i=0;i<100000;i++)if(a.pickFromPool(pool,['知的'],r).id===0)hits++;
 const expected=1.75/190.75;assert.ok(Math.abs(hits/100000-expected)<.002);report.distribution.singleMatch={expected,actual:hits/100000,trials:100000};report.samples+=100000;
});
check('Ren no longer receives a 75% fixed quota; compare before/after/history',()=>{
 const pool=a.nameData.japanese.givenNames.male;
 assert.equal(pool.filter(n=>n.tags.includes('気だるい')).length,1);
 for(const [key,old,history]of [['before',true,false],['after',false,false],['afterWithHistory',false,true]])report.distribution[key]=sample(pool,['気だるい'],old,history);
 assert.ok(report.distribution.before.maxShare>.73&&report.distribution.before.maxShare<.77);
 assert.ok(report.distribution.after.maxShare<.015);assert.ok(report.distribution.afterWithHistory.maxShare<.015);
 assert.equal(report.distribution.after.unique,190);assert.equal(report.distribution.afterWithHistory.unique,190);
});
check('multiple real single-match conditions remain varied',()=>{
 const conditions=[];for(const [group,data]of Object.entries(a.nameData))if(data.givenNames&&!Array.isArray(data.givenNames))for(const [gender,pool]of Object.entries(data.givenNames)){
  const counts={};for(const n of pool)for(const t of n.tags||[])counts[t]=(counts[t]||0)+1;
  for(const [tag,count]of Object.entries(counts))if(count===1)conditions.push({group,gender,pool,tag});
 }
 assert.ok(conditions.length>=3);report.distribution.otherSingleMatches=[];
 for(const c of conditions.filter(x=>!(x.group==='japanese'&&x.gender==='male'&&x.tag==='気だるい')).slice(0,4)){
  const r=seeded(15),item=c.pool.find(n=>n.tags.includes(c.tag));let hits=0;
  for(let i=0;i<10000;i++)if(a.pickFromPool(c.pool,[c.tag],r)===item)hits++;
  assert.ok(Math.abs(hits/10000-1.75/(c.pool.length+.75))<.015);
  report.distribution.otherSingleMatches.push({pool:c.group+'.'+c.gender,tag:c.tag,expected:1.75/(c.pool.length+.75),actual:hits/10000});report.samples+=10000;
 }
});
check('modern records are deduplicated by exact spelling and have per-culture sources',()=>{
 const modern=[...a.nameRecords.values()].filter(n=>n.systems.includes('modernWestern'));
 const counts={};for(const [culture,p]of Object.entries(a.modernPools)){
  assert.equal(p.given.length,new Set(p.given).size);assert.equal(p.family.length,new Set(p.family).size);assert.ok(p.given.length>=60);assert.equal(p.family.length,30);
  const given=p.given.map(id=>a.nameRecords.get(id));counts[culture]={given:p.given.length,family:p.family.length,neutral:given.filter(n=>['m','f'].every(g=>n.modernUsage[culture].genders.includes(g))).length};
  for(const id of p.given.concat(p.family)){const n=a.nameRecords.get(id);assert.ok(n.modernUsage[culture].sources.length);for(const key of n.modernUsage[culture].sources)assert.ok(a.nameSources[key]?.url.startsWith('https://'));}
 }
 report.data.modern={byCulture:counts,uniqueRecords:modern.length,legacyReused:modern.filter(n=>n.legacyPaths.length).length,newRecords:modern.filter(n=>!n.legacyPaths.length).length,memberships:Object.values(counts).reduce((s,n)=>s+n.given+n.family,0)};
 assert.equal(modern.filter(n=>n.original==='Daniel'&&n.roles.includes('given')).length,1);
 assert.ok(modern.some(n=>n.original==='Müller'));assert.ok(modern.some(n=>n.original==='Lefèvre'));assert.ok(modern.some(n=>n.original==='García'));
});
check('all systems / cultures / themes / genders generate five distinct names',()=>{
 const scenarios=Object.keys(a.namingSystems).filter(k=>!['auto','fantasy','modernWestern'].includes(k)).map(system=>({system}));
 for(const culture of Object.keys(a.namingCultures))scenarios.push({system:'modernWestern',culture});
 for(const motifs of [[],['german'],['gemstone'],['constellation'],['german','gemstone','constellation']])scenarios.push({system:'fantasy',motifs});
 for(const s of scenarios)for(const gender of ['male','female','neutral','unspecified'])for(const mode of ['nameOnly','full']){
  a.configure(s.system,s.culture||'auto',s.motifs||[],'modern',gender,mode);
  for(let i=0;i<20;i++){const results=a.generateMultiple(5);assert.equal(new Set(results.map(c=>c.name)).size,5);
   for(const c of results){assert.equal(c.worldKey,'modern');assert.equal(c.naming.system,s.system);assert.ok(!/undefined|名無し/.test(a.buildDetailText(c)));if(mode==='full')assert.ok(c.imagePrompt.includes('modern Japanese setting'));
    if(s.system==='modernWestern'){assert.ok(c.nameParts.family);for(const part of Object.values(c.nameParts)){assert.equal(part.originType,'attested_name');assert.ok(a.nameRecords.get(part.id).cultures.includes(c.naming.culture));}assert.ok(!c.codename);if(gender==='neutral'&&['de','it','es'].includes(c.naming.culture))assert.ok(c.naming.notice);}
    if(s.system==='fantasy'&&c.naming.motif!=='legacy')assert.ok(Object.values(c.nameParts).some(p=>p.motifs.includes(c.naming.motif)));
   }report.samples+=5;
  }
 }
});
check('categories are balanced before sampling; multi-membership is one ticket',()=>{
 const r=seeded(799),themes={},cultures={};
 for(let i=0;i<12000;i++){
  const f=a.generateName('western','neutral',[],{system:'fantasy',motifs:['german','gemstone','constellation','german'],rng:r});themes[f.naming.motif]=(themes[f.naming.motif]||0)+1;
  const m=a.generateName('modern','female',[],{system:'modernWestern',culture:'auto',rng:r});cultures[m.naming.culture]=(cultures[m.naming.culture]||0)+1;
 }
 for(const n of Object.values(themes))assert.ok(n>3500&&n<4500);for(const n of Object.values(cultures))assert.ok(n>2100&&n<2700);
 const bern=[...a.nameRecords.values()].filter(n=>n.original==='Bernstein');assert.equal(bern.length,1);assert.ok(bern[0].motifs.includes('german')&&bern[0].motifs.includes('gemstone'));
 assert.equal(a.uniqueRecords([bern[0],bern[0]]).length,1);
 report.distribution.themeCounts=themes;report.distribution.cultureCounts=cultures;report.samples+=24000;
});
check('legacy SF codes remain available; all motif records have valid roles and sources',()=>{
 for(const word of ['Beryl','Spinel']){const raw=a.nameData.scifi.codenames.find(n=>n.roman===word);assert.ok(raw);const record=[...a.nameRecords.values()].find(n=>n.original===word&&n.legacyPaths.includes('scifi.codenames'));assert.ok(record.motifs.includes('gemstone'));assert.ok(record.roles.includes('codename'));}
 const counts={};for(const motif of ['german','gemstone','constellation']){const pool=a.fantasyPools[motif];counts[motif]={memberships:pool.length,legacyReused:pool.filter(n=>n.legacyPaths.length).length};assert.equal(pool.length,new Set(pool.map(n=>n.id)).size);for(const n of pool){assert.ok(n.motifUsage[motif].meaningJa);assert.ok(n.motifUsage[motif].sources.every(s=>a.nameSources[s]));}}
 const words=[...a.nameRecords.values()].filter(n=>n.motifs.length);report.data.fantasy={byMotif:counts,uniqueRecords:words.length,legacyReused:words.filter(n=>n.legacyPaths.length).length,newRecords:words.filter(n=>!n.legacyPaths.length).length,coined:0};
});
check('name RNG is reproducible and independent of world/settings RNG when injected',()=>{
 const r1=seeded(333),r2=seeded(333);for(let i=0;i<50;i++)assert.equal(a.generateName('modern','male',['知的'],{system:'modernWestern',rng:r1}).display,a.generateName('modern','male',['知的'],{system:'modernWestern',rng:r2}).display);
 a.configure('japanese','auto',[],'modern','male','full');rng=seeded(31);const first=a.generateFullCharacter({rng:seeded(99)});
 a.configure('modernWestern','de',[],'modern','male','full');rng=seeded(31);const second=a.generateFullCharacter({rng:seeded(99)});
 for(const key of ['worldKey','occupation','appearance','age','imagePrompt'])assert.equal(first[key],second[key]);
 a.configure('auto','auto',[],'modernWestern','male','full');const c=a.generateFullCharacter();assert.equal(c.naming.system,'modernWestern');assert.ok(!/Japanese|Japan/.test(c.imagePrompt));
});
check('session history records only displayed results; failed batches preserve results/history',()=>{
 a.configure('japanese');a.setRender(next=>{rendered=next;});a.nameHistory.clear();
 for(let i=0;i<30;i++){a.runGenerate(1);assert.equal(error.hidden,true);}
 const h=[...a.nameHistory.values()][0];assert.equal(h.given.length,20);assert.equal(new Set(h.given).size,20);
 const previous=a.results(),before=JSON.stringify([...a.nameHistory]);
 a.configure('modernWestern','en');const pool=a.modernPools.en.given;a.modernPools.en.given=[];a.runGenerate(5);a.modernPools.en.given=pool;
 assert.equal(a.results(),previous);assert.equal(JSON.stringify([...a.nameHistory]),before);assert.equal(error.hidden,false);assert.match(error.textContent,/以前の結果は保持/);
 // One possible display name cannot satisfy five results; keep previous render.
 a.configure('japanese');const j=a.nameData.japanese,gs=j.givenNames.male,ss=j.surnames;j.givenNames.male=gs.slice(0,1);j.surnames=ss.slice(0,1);
 a.runGenerate(5);assert.equal(a.results(),previous);assert.equal(JSON.stringify([...a.nameHistory]),before);assert.match(error.textContent,/候補不足/);
 a.runGenerate(1);assert.equal(error.hidden,true);a.runGenerate(1);assert.equal(error.hidden,true);j.givenNames.male=gs;j.surnames=ss;
 vm.runInContext(`{const real=generateFullCharacter;generateFullCharacter=()=>({name:'same'});try{runGenerate(5);}finally{generateFullCharacter=real;}}`,ctx);assert.equal(error.hidden,false);assert.match(error.textContent,/128/);
});
check('history isolation and oldest-first relaxation',()=>{
 const h=new Map(),r=seeded(4);for(let i=0;i<25;i++){const n=a.generateName('modern','male',[],{system:'japanese',history:h,rng:r});a.rememberName(h,n);}
 const before=JSON.stringify([...h]);a.generateName('modern','female',[],{system:'modernWestern',culture:'fr',history:h,rng:r});assert.equal(JSON.stringify([...h]),before);
 assert.equal(a.avoidRecent([{id:'a'},{id:'b'}],['a','b'],n=>n.id)[0].id,'a');
});
check('empty family/code pools fail explicitly; rejected rerolls are not remembered',()=>{
 const f=a.nameData.western.familyNames,n=a.nameData.western.nobleNames,codes=a.nameData.scifi.codenames;
 a.nameData.western.familyNames=[];a.nameData.western.nobleNames=[];
 assert.throws(()=>a.generateName('western','male',[],{system:'fantasy',motifs:['legacy']}),/家名/);
 a.nameData.western.familyNames=f;a.nameData.western.nobleNames=n;a.nameData.scifi.codenames=[];
 assert.throws(()=>a.generateName('scifi','male',[],{system:'scifi'}),/候補/);a.nameData.scifi.codenames=codes;
 const history=vm.runInContext(`(()=>{const original=generateFullCharacter;let call=0;generateFullCharacter=()=>{const id=++call<12?'first':'name-'+call;return {name:id,nameParts:{given:{id}},naming:{historyKey:'test'}};};try{return generateMultiple(5).nextHistory.get('test');}finally{generateFullCharacter=original;}})()`,ctx);
 assert.equal(history.given.length,5);assert.equal(new Set(history.given).size,5);
});
check('setting-only/manual modes and legacy saves do not require nameParts',()=>{
 manual='指定名';a.configure('modernWestern','en',[],'modern','neutral','settingOnly');const batch=a.generateMultiple(5);assert.ok(batch.every(c=>c.name===manual&&c.manualName&&!c.nameParts));
 manual='';assert.ok(a.generateMultiple(1).every(c=>!c.name&&c.catch));
 const old={id:'legacy',mode:'nameOnly',name:'旧 名',reading:'きゅう な',roman:'Old Name',worldLabel:'現代',nameImpression:'穏やか',suitedFor:'教師'};assert.ok(a.buildDetailText(old).includes('旧 名'));assert.equal(a.renderNameInfo(old),'');
 a.configure('fantasy','auto',['german']);const c=a.generateFullCharacter();const name=a.buildNameText(c);assert.ok(!name.includes('Duden'));assert.ok(!name.includes('原語'));assert.ok(a.renderNameInfo(c).includes('原語の意味'));assert.ok(a.buildDetailText(c).includes('名前の系統'));
});
report.passed=true;const output=process.argv[2];if(output)fs.writeFileSync(output,JSON.stringify(report,null,2));console.log(JSON.stringify({passed:true,checks:report.checks.length,samples:report.samples,data:report.data}));
