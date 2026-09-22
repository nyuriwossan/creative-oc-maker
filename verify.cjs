'use strict';
// Run: node verify.cjs [index.html] [report.json]
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const file=process.argv[2]||path.join(__dirname,'index.html');
const html=fs.readFileSync(file,'utf8');
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];assert.equal(scripts.length,1);
const script=scripts[0][1].replace(/\binit\(\);\s*$/,'');
let seed=0x12345678;const math=Object.create(Math);math.random=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};
let input='';const ctx=vm.createContext({console,Math:math,document:{getElementById:id=>{assert.equal(id,'nameInput');return {value:input};}}});
vm.runInContext(script,ctx,{timeout:10000});
const api=vm.runInContext(`({nameData,nameRecords,moodDefs,worldDefs,genderDefs,worldOrder,genderOrder,generateName,generateFullCharacter,generateMultiple,buildNameText,buildDetailText,buildImagePrompt,
 configure(world,gender,mode,moods=[]){selectedWorld=world;selectedGender=gender;currentMode=mode;selectedMoods=moods;selectedRoles=[];selectedRelationships=[];}})`,ctx);
const data=api.nameData,normalize=s=>s.normalize('NFKC').toLowerCase().replace(/[\s\-'’]/g,'');
const report={version:'1.3',seed:'0x12345678',data:{pools:[],invalidFields:0,invalidTags:0,displayDuplicates:0,existingHomophones:[]},generation:{singleNames:0,batches:0,charactersInBatches:0,duplicateBatches:0,byWorld:[]},regressions:[]};
function walk(obj,at=''){for(const [k,v] of Object.entries(obj)){const p=at?at+'.'+k:k;if(Array.isArray(v))checkPool(v,p);else walk(v,p);}}
function checkPool(pool,p){
 report.data.pools.push({pool:p,count:pool.length});const fields=['kanji','kana','reading','roman'];
 for(const n of pool){
  for(const [k,v]of Object.entries(n)){assert.notEqual(v,undefined,p+'.'+k);if(typeof v==='string')assert.ok(v.trim(),p+'.'+k);}
  assert.ok(n.roman);assert.ok(n.kanji||n.kana);if(n.kanji)assert.ok(n.reading);
  if(n.g!==undefined)assert.ok(['m','f','n'].includes(n.g),p);
  if(p.endsWith('givenNames'))assert.ok(['m','f','n'].includes(n.g),p);
  for(const tag of n.tags||[])assert.ok(api.moodDefs[tag],p+' '+tag);
 }
 for(const f of fields){const seen=new Map();for(const n of pool){if(!n[f])continue;const val=normalize(n[f]);if(seen.has(val)){
  // Two different Chinese female names are already homophones in v1.1. No new homophones allowed.
  assert.ok(p==='chinese.givenNames.female'&&['roman','reading'].includes(f)&&['wanqing','ワンチン'].includes(val),'duplicate '+p+' '+f+' '+n[f]);
  report.data.existingHomophones.push({pool:p,field:f,value:n[f],names:[seen.get(val).kanji,n.kanji]});
 }else seen.set(val,n);}}
}
walk(data);
const expected={'japanese.surnames':[100,150],'japanese.givenNames.male':[90,100],'japanese.givenNames.female':[90,100],'japanese.givenNames.neutral':[70,100],'wafu.surnames':[30,80],'wafu.givenNames.male':[20,60],'wafu.givenNames.female':[18,60],'wafu.givenNames.neutral':[12,50],'western.givenNames':[62,240],'western.familyNames':[40,150],'western.nobleNames':[20,100],'scifi.givenNames':[30,80],'scifi.codenames':[50,100]};
const at=(p)=>p.split('.').reduce((a,k)=>a[k],data);
const additions=[];
for(const [p,[before,add]] of Object.entries(expected)){const pool=at(p);assert.equal(pool.length,before+add,p);for(const n of pool.slice(before)){assert.ok(n.tags.length>=1&&n.tags.length<=2);assert.ok(n.source&&n.style);additions.push({pool:p,...n});}}
assert.equal(additions.length,1370);
for(const g of ['m','f','n'])assert.equal(data.western.givenNames.slice(62).filter(n=>n.g===g).length,80);
report.data.added=additions.length;
assert.ok(!data.western.nobleNames.some(n=>['Albafica','Sanriole'].includes(n.roman)));
report.data.legacyCorrections={undefinedMoodTags:4,nobleNames:2};
// All new Japanese readings use hiragana; validate romanization independently, allowing ordinary long-vowel conventions.
const basicRows=[['あいうえお','a i u e o'],['かきくけこ','ka ki ku ke ko'],['がぎぐげご','ga gi gu ge go'],['さしすせそ','sa shi su se so'],['ざじずぜぞ','za ji zu ze zo'],['たちつてと','ta chi tsu te to'],['だぢづでど','da ji zu de do'],['なにぬねの','na ni nu ne no'],['はひふへほ','ha hi fu he ho'],['ばびぶべぼ','ba bi bu be bo'],['ぱぴぷぺぽ','pa pi pu pe po'],['まみむめも','ma mi mu me mo'],['やゆよ','ya yu yo'],['らりるれろ','ra ri ru re ro'],['わをん','wa o n']];
const syllables={};for(const [ja,en]of basicRows)Array.from(ja).forEach((c,i)=>syllables[c]=en.split(' ')[i]);
for(const [a,b]of Object.entries({'き':'ky','ぎ':'gy','し':'sh','じ':'j','ち':'ch','に':'ny','ひ':'hy','び':'by','ぴ':'py','み':'my','り':'ry'}))for(const [c,d]of Object.entries({'ゃ':'a','ゅ':'u','ょ':'o'}))syllables[a+c]=b+d;
const romanKey=s=>s.toLowerCase().replace(/ou|oo/g,'o').replace(/uu/g,'u').replace(/ei|ee/g,'e').replace(/n(?=[bmp])/g,'m').replace(/'/g,'');
function romanize(s){let out='';for(let i=0;i<s.length;i++){if(s[i]==='っ'){const next=syllables[s.slice(i+1,i+3)]||syllables[s[i+1]];assert.ok(next);out+=next.startsWith('ch')?'t':next[0];continue;}const two=syllables[s.slice(i,i+2)];if(two){out+=two;i++;}else{assert.ok(syllables[s[i]],'unknown kana '+s);out+=syllables[s[i]];}}return out;}
for(const n of additions.filter(n=>n.kanji)){assert.match(n.reading,/^[ぁ-ゖ]+$/u);assert.equal(romanKey(n.roman),romanKey(romanize(n.reading)),n.kanji+' '+n.reading+' '+n.roman);}
report.data.newJapaneseRomanizationChecks=additions.filter(n=>n.kanji).length;
function allowed(pool,gender){const pg=api.genderDefs[gender].pool;if(pg==='any')return pool;const g={male:'m',female:'f',neutral:'n'}[pg];return pool.filter(n=>n.g===g);}
function jpGiven(d,gender){const pg=api.genderDefs[gender].pool;return pg==='any'?Object.values(d.givenNames).flat():d.givenNames[pg];}
function verifyName(c){
 for(const f of ['name','reading','roman']){assert.ok(typeof c[f]==='string'&&c[f].trim());assert.ok(!/undefined|null|名無し/.test(c[f]),JSON.stringify(c));}
 // v1.3 adds a modern world and source-word fantasy names. Validate their actual
 // components and provenance; all original legacy reconstruction checks stay below.
 assert.ok(c.nameParts&&c.naming);
 if(c.naming.system==='modernWestern'||(c.naming.system==='fantasy'&&c.naming.motif!=='legacy')){
  const g=c.nameParts.given||c.nameParts.single,f=c.nameParts.family;assert.ok(g&&api.nameRecords.has(g.id));
  if(f)assert.ok(api.nameRecords.has(f.id));
  assert.equal(c.name,g.display+(f?'・'+f.display:''));assert.equal(c.reading,g.reading+(f?'・'+f.reading:''));assert.equal(c.roman,g.original+(f?' '+f.original:''));
  if(c.naming.system==='modernWestern'){
   assert.ok(f);assert.ok(!c.codename);for(const part of [g,f]){assert.equal(part.originType,'attested_name');assert.ok(api.nameRecords.get(part.id).cultures.includes(c.naming.culture));}
  }else assert.ok([g,f].some(part=>part?.motifs.includes(c.naming.motif)));
  for(const tag of c.nameTags||[])assert.ok(api.moodDefs[tag]);return;
 }
 const key=api.worldDefs[c.worldKey].nameKey;let sur,giv,fam,expectedRoman,expectedReading;
 if(key==='japanese'||key==='wafu'){
  const parts=c.name.split(' ');assert.equal(parts.length,2);sur=data[key].surnames.find(n=>n.kanji===parts[0]);giv=jpGiven(data[key],c.genderKey).find(n=>n.kanji===parts[1]);assert.ok(sur&&giv);
  expectedRoman=giv.roman+' '+sur.roman;expectedReading=sur.reading+' '+giv.reading;
 }else if(key==='western'){
  const parts=c.name.split('・');giv=allowed(data.western.givenNames,c.genderKey).find(n=>n.kana===parts[0]);assert.ok(giv);
  if(parts.length===1){assert.equal(c.worldKey,'nonhuman');expectedRoman=giv.roman;}else{
   assert.equal(parts.length,2);const fams=c.worldKey==='royal'?data.western.nobleNames:[...data.western.familyNames,...data.western.nobleNames];fam=fams.find(n=>n.kana===parts[1]);assert.ok(fam);expectedRoman=giv.roman+' '+fam.roman;
  }expectedReading=c.name;
 }else if(key==='mixed'){
  const parts=c.name.split(' ');sur=data.japanese.surnames.find(n=>n.kanji===parts[0]);giv=allowed(data.western.givenNames,c.genderKey).find(n=>n.kana===parts[1]);assert.ok(sur&&giv);expectedReading=sur.reading+' '+giv.kana;expectedRoman=giv.roman+' '+sur.roman;
 }else if(key==='scifi'){
  giv=allowed(data.scifi.givenNames,c.genderKey).find(n=>n.kana===c.name);assert.ok(giv);assert.ok(data.scifi.codenames.some(n=>c.codename===n.kana+'（'+n.roman+'）'));expectedReading=giv.kana;expectedRoman=giv.roman;
 }else if(key==='chinese'){
  sur=data.chinese.surnames.find(n=>c.name.startsWith(n.kanji));assert.ok(sur);giv=jpGiven(data.chinese,c.genderKey).find(n=>c.name===sur.kanji+n.kanji);assert.ok(giv);expectedReading=sur.reading+'・'+giv.reading;expectedRoman=sur.roman+' '+giv.roman;
 }else if(key==='desert'){
  giv=allowed(data.desert.givenNames,c.genderKey).find(n=>c.name===n.kana||c.name.startsWith(n.kana+'・'));assert.ok(giv);expectedRoman=giv.roman;expectedReading=c.name;
  if(c.name!==giv.kana){fam=data.desert.familyNames.find(n=>c.name===giv.kana+'・'+n.kana);assert.ok(fam);expectedRoman+=' '+fam.roman;}
 }else assert.fail('world '+key);
 assert.equal(c.roman,expectedRoman);assert.equal(c.reading,expectedReading);
 for(const tag of c.nameTags||[])assert.ok(api.moodDefs[tag]);
}
const moods=Object.keys(api.moodDefs),worlds=[...api.worldOrder],genders=[...api.genderOrder];
for(const world of worlds){
 const identities=new Set();let count=0;
 for(const gender of genders){for(let i=0;i<1000;i++){
  const mood=i%(moods.length+2);api.configure(world,gender,'nameOnly',mood===moods.length?[]:mood>moods.length?['知的','穏やか']:[moods[mood]]);
  const c=api.generateFullCharacter();verifyName(c);identities.add(c.name+(c.codename||''));count++;report.generation.singleNames++;
 }}
 for(const mode of ['nameOnly','full'])for(let i=0;i<1000;i++){
  api.configure(world,genders[i%genders.length],mode,i%3===0?[]:[moods[i%moods.length]]);
  const batch=api.generateMultiple(5);assert.equal(batch.length,5);assert.equal(new Set(batch.map(c=>c.name)).size,5,'duplicate batch '+world+' '+mode+' '+i);
  for(const c of batch){verifyName(c);if(mode==='full'){assert.ok(c.catch&&c.personality&&c.imagePrompt);assert.ok(!/undefined|名無し/.test(api.buildDetailText(c)));}}
  report.generation.batches++;report.generation.charactersInBatches+=5;
 }
 report.generation.byWorld.push({world,singles:count,uniqueIdentities:identities.size,repeatRate:1-identities.size/count,batches:2000});
 console.log('PASS',world,count,'single names, 2000 five-character batches');
}
// Regression: all eight original retries collide, but the ninth is valid.
vm.runInContext(`{
 const original=generateFullCharacter;let call=0;
 generateFullCharacter=()=>({name:++call<=9?'same':'unique-'+call,catch:'same-catch'});
 try{const r=generateMultiple(5);if(new Set(r.map(x=>x.name)).size!==5)throw new Error('retry regression');}finally{generateFullCharacter=original;}
}`,ctx);report.regressions.push('exhausted original eight retries never commits a duplicate name');
// A caller-supplied name in settingOnly is intentionally shared; do not replace it.
input='指定した名前';api.configure('modern','neutral','settingOnly',['穏やか']);const manual=api.generateMultiple(5);assert.equal(manual.length,5);assert.ok(manual.every(c=>c.name===input&&c.manualName));report.regressions.push('manual name remains unchanged in settingOnly');
input='';const unnamed=api.generateMultiple(5);assert.ok(unnamed.every(c=>!c.name&&c.catch));report.regressions.push('settingOnly without a name still generates settings');
// Check the bounded guard explicitly instead of allowing an infinite loop on a broken RNG.
assert.throws(()=>vm.runInContext(`{const original=generateFullCharacter;generateFullCharacter=()=>({name:'same'});try{generateMultiple(5);}finally{generateFullCharacter=original;}}`,ctx),/重複しない名前/);report.regressions.push('broken random source terminates without publishing duplicate results');
const common=/^(?:luna|noct|shadow|silver|raven|moon|dark|night|blood|star|astra|eclipse)/i;
const motifs={};for(const p of ['western.givenNames','western.familyNames','western.nobleNames']){const a=at(p);motifs[p]={total:a.length,matching:a.filter(n=>common.test(n.roman)).length};assert.ok(motifs[p].matching/a.length<0.1);}
let darkHits=0;api.configure('dark','unspecified','nameOnly',['闇がある','ミステリアス']);for(let i=0;i<10000;i++){const c=api.generateFullCharacter();if(c.roman.split(' ').some(s=>common.test(s)))darkHits++;}
assert.ok(darkHits/10000<0.2);report.motifAudit={pools:motifs,darkSample:10000,darkHits,rate:darkHits/10000};
report.generation.additionalDarkSamples=10000;
assert.ok(html.includes('<footer>創作OCメーカー v1.3</footer>'));
report.passed=true;
const output=process.argv[3];if(output)fs.writeFileSync(output,JSON.stringify(report,null,2));console.log(JSON.stringify({passed:true,singles:report.generation.singleNames,batches:report.generation.batches,added:1370,darkMotifRate:darkHits/10000}));
