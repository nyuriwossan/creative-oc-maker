'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const D=require('./js/dictionary-core.js'),entries=require('./data/dictionary-v1.7.json').entries;
const html=fs.readFileSync('index.html','utf8');
if(!process.argv[2])throw Error('Usage: node verify-dictionary-gacha.cjs /path/to/v1.6-index.html');
const baseline=fs.readFileSync(process.argv[2],'utf8');
function create(html){
 let seed=0x731942,manual='';const math=Object.create(Math);math.random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
 const ctx=vm.createContext({OCDictionary:D,console,Math:math,document:{getElementById:()=>({value:manual})},setTimeout:()=>{},entriesFixture:entries});
 vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1].replace(/\binit\(\);\s*$/,''),ctx);
 return {ctx,api:vm.runInContext(`({generateFullCharacter,generateMultiple,buildNameText,buildDetailText,buildImagePrompt,renderNameInfo,
  configure(system,mode='full',world='modern',gender='unspecified'){selectedNameSystem=system;currentMode=mode;selectedWorld=world;selectedGender=gender;selectedMoods=['神秘的'];selectedRoles=['student'];selectedRelationships=['ライバル'];},
  systems:Object.keys(namingSystems),worlds:worldOrder,genders:genderOrder,
  manual(value){document.getElementById=()=>({value});}})`,ctx)};
}
const old=create(baseline),now=create(html);
// Ignore only wall-clock IDs: every generated field (including name provenance) must match.
let comparisons=0;
for(const system of old.api.systems)for(const mode of ['nameOnly','settingOnly','full'])for(const world of old.api.worlds)for(const gender of ['male','female','neutral','unspecified']){
 old.api.configure(system,mode,world,gender);now.api.configure(system,mode,world,gender);
 const a=JSON.parse(JSON.stringify(old.api.generateFullCharacter())),b=JSON.parse(JSON.stringify(now.api.generateFullCharacter()));delete a.id;delete b.id;
 assert.deepEqual(b,a,[system,mode,world,gender].join('/'));comparisons++;
}
vm.runInContext('dictionaryEntries=entriesFixture;fixedDictionaryEntry=dictionaryEntries.find(e=>e.id==="SUP-001");',now.ctx);
for(const system of now.api.systems)for(const gender of ['male','female','neutral','unspecified']){
 now.api.configure(system,'full','modern',gender);const batch=now.api.generateMultiple(5);
 assert.equal(batch.length,5);assert.ok(batch.every(c=>c.name==='花鶏'&&c.reading==='あとり'&&c.roman===''&&c.age&&c.personality&&c.relationSeed&&c.imagePrompt));
 assert.equal(batch.nextHistory.size,0);
 assert.ok(batch.some(c=>c.personality!==batch[0].personality||c.appearance!==batch[0].appearance));
 assert.match(now.api.buildDetailText(batch[0]),/個別出典確認待ち/);assert.match(now.api.renderNameInfo(batch[0]),/SUP-001/);
 assert.doesNotMatch(now.api.renderNameInfo(batch[0]),/確認済/);
}
now.api.configure('natureClassic','nameOnly');assert.equal(now.api.generateMultiple(10).filter(c=>c.name==='花鶏').length,10);
now.api.configure('natureClassic','settingOnly');now.api.manual('手入力');assert.ok(now.api.generateMultiple(5).every(c=>c.name==='手入力'&&c.manualName));
vm.runInContext('fixedDictionaryEntry=null;',now.ctx);
now.api.configure('natureClassic','nameOnly');
for(const category of D.categories)for(const usage of ['all','name','family','code','place']){
 const opts={dictionaryCategories:[category],dictionaryUsage:usage};
 const size=vm.runInContext(`natureEligible(${JSON.stringify(opts)}).length`,now.ctx);
 if(!size){assert.throws(()=>now.api.generateMultiple(10,opts),/0個/);continue;}
 const b=now.api.generateMultiple(10,opts);assert.equal(b.length,Math.min(10,new Set(entries.filter(e=>e.majorCategory===category&&(usage==='all'||e.usageFlags[usage])).map(e=>e.display)).size));assert.equal(new Set(b.map(c=>c.name)).size,b.length);
 assert.ok(b.every(c=>c.nameParts.single.majorCategory===category&&c.roman===''));
}
const first=now.api.generateMultiple(10),second=now.api.generateMultiple(10,{history:first.nextHistory});assert.ok(second.every(c=>!first.some(a=>a.name===c.name)));
assert.throws(()=>now.api.generateMultiple(5,{dictionaryCategories:['不存在']}),/0個/);
vm.runInContext('dictionaryEntries=entriesFixture.slice(0,2);',now.ctx);assert.equal(now.api.generateMultiple(10).length,2);assert.throws(()=>now.api.generateMultiple(5),/2人分/);
vm.runInContext('dictionaryEntries=[];',now.ctx);assert.throws(()=>now.api.generateMultiple(1),/未読み込み/);
console.log('PASS fixed-name batches, all modes, nature filters/history/short and empty pools; '+comparisons+' deterministic legacy outputs identical to main');
fs.writeFileSync('reports/v1.7/gacha-regression.json',JSON.stringify({passed:true,baseline:'83cd24b18eec84468bc2793e6d634b6731920a01',identicalLegacyOutputs:comparisons,fixedName:'SUP-001 花鶏（あとり）',categoriesTested:12,usagesTested:5},null,2)+'\n');
