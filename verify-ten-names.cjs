'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
const source=html.match(/<script>([\s\S]*?)<\/script>/)[1].replace(/\binit\(\);\s*$/,'');
let seed=17;
const math=Object.create(Math);math.random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
const ctx=vm.createContext({console,Math:math,document:{getElementById:()=>({value:''})},setTimeout:()=>{}});
vm.runInContext(source,ctx);
const api=vm.runInContext(`({
  systems:Object.keys(namingSystems).filter(s=>s!=='auto'),
  configure(system,mode='nameOnly'){currentMode=mode;selectedNameSystem=system;selectedWorld='modern';selectedGender='male';selectedMoods=[];selectedRoles=[];selectedRelationships=[];selectedNameCulture='auto';selectedNameMotifs=[];selectedKanjiReadingMode='standard';selectedMythType='deity';selectedMythTradition='auto';},
  batch(count,opts){return generateMultiple(count,opts);},
  setMyth(type,tradition){selectedMythType=type;selectedMythTradition=tradition;},
  setGender(gender){selectedGender=gender;},
  setCulture(culture){selectedNameCulture=culture;},
  setMotifs(motifs){selectedNameMotifs=motifs;},
  setWorld(world){selectedWorld=world;},
  groups(){return kanjiEligibleGroups('standard').length;},
  entities(type,tradition){return mythEligibleEntities(type,tradition).length;}
})`,ctx);
for(const system of api.systems){
  api.configure(system);
  const batch=api.batch(10);
  assert.equal(batch.length,10,system);
  assert.equal(new Set(batch.map(c=>c.name)).size,10,system);
  assert.ok(batch.every(c=>c.naming.system===system),system);
  if(system==='kanjiSingle')assert.equal(new Set(batch.map(c=>c.nameParts.single.variantGroup)).size,10);
  if(system==='mythology')assert.equal(new Set(batch.map(c=>c.nameParts.single.canonicalEntityId)).size,10);
  console.log('PASS 10',system);
}
for(const system of api.systems.filter(s=>!['kanjiSingle','mythology'].includes(s))){
  for(const gender of ['male','female','neutral','unspecified']){
    const cultures=system==='modernWestern'?['auto','en','de','fr','it','es']:['auto'];
    const motifs=system==='fantasy'?[[],['legacy'],['german'],['gemstone'],['constellation']]:[[]];
    for(const culture of cultures)for(const motif of motifs){
      api.configure(system);api.setGender(gender);api.setCulture(culture);api.setMotifs(motif);
      const batch=api.batch(10);
      assert.equal(batch.length,10,[system,gender,culture,motif].join('/'));
      assert.equal(new Set(batch.map(c=>c.name)).size,10,[system,gender,culture,motif].join('/'));
    }
  }
}
console.log('PASS gender, language and motif variants');
api.configure('mythology');api.setMyth('hero','arthur');
assert.equal(api.entities('hero','arthur'),1);
assert.equal(api.batch(10).length,1);
api.setMyth('deity','mesopotamia');
const small=api.batch(10);assert.equal(small.length,6);
assert.equal(new Set(small.map(c=>c.nameParts.single.canonicalEntityId)).size,6);
const repeated=api.batch(10,{history:small.nextHistory});
assert.equal(repeated.length,6);
assert.equal(new Set(repeated.map(c=>c.nameParts.single.canonicalEntityId)).size,6);
api.setMyth('deity','arthur');assert.equal(api.batch(10).length,0);
console.log('PASS short pools');
api.configure('japanese','full');assert.equal(api.batch(5).length,5);
api.configure('japanese','settingOnly');assert.equal(api.batch(5).length,5);
console.log('PASS other modes five');
