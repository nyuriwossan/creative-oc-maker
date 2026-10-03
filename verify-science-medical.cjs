'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const data=require('./data/science-medical-v1.6.json');
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1].replace(/\binit\(\);\s*$/,'');
let seed=73;
const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
const math=Object.create(Math);math.random=random;
const ctx=vm.createContext({console,Math:math,document:{getElementById:()=>({value:''})},setTimeout:()=>{}});
vm.runInContext(script,ctx);
const api=vm.runInContext(`({
 configure(mode='nameOnly'){currentMode=mode;selectedNameSystem='scienceMedical';selectedWorld='modern';selectedGender='unspecified';selectedMoods=[];selectedRoles=[];selectedRelationships=[];selectedScienceFields=[];selectedScienceUsage='name';selectedScienceIncludes=[];},
 eligible(opts){return scienceEligibleTerms(opts).map(t=>({id:t.canonicalTermId,kana:t.kana,fields:t.fields,gates:t.gates}));},
 batch(n,opts){return generateMultiple(n,opts);},
 one(opts){return generateName('modern','unspecified',[],{system:'scienceMedical',...opts});},
 text(c){return [buildNameText(c),buildDetailText(c),namingSummary(c)];},
 total(){return scienceTerms.length;},
 changeGates(id,gates){const t=scienceTerms.find(x=>x.id===id);const previous=t.gates;t.gates=gates;return previous;},
 truncate(n){scienceTerms.length=n;},
 restore(){scienceTerms.splice(0,scienceTerms.length,...scienceMedicalData.terms.map(t=>({...t,recordId:nameRecords.get(t.id)?.id||t.id})));}
})`,ctx);
assert.equal(api.total(),129);
assert.equal(new Set(data.terms.map(t=>t.canonicalTermId)).size,129);
assert.equal(new Set(data.terms.map(t=>t.kana)).size,129);
assert.equal(data.terms.filter(t=>t.tracking==='reused').length,13);
assert.ok(data.terms.some(t=>t.aliases.length));
api.configure();
assert.equal(api.eligible({}).length,115);
const all=data.terms.map(t=>t.canonicalTermId);
for(const field of Object.keys(data.fields)){
 const eligible=api.eligible({scienceFields:[field]});
 assert.ok(eligible.length>=10,field);
 const batch=api.batch(10,{scienceFields:[field]});
 assert.equal(batch.length,10,field);
 assert.equal(new Set(batch.map(c=>c.name)).size,10,field);
 assert.ok(batch.every(c=>c.naming.system==='scienceMedical'&&c.naming.field===field&&c.nameParts.single.fields.includes(field)),field);
 assert.ok(batch.every(c=>!c.nameParts.family&&c.name===c.nameParts.single.display));
 assert.ok(batch.every(c=>!c.nameParts.single.gates));
 const code=api.batch(10,{scienceFields:[field],scienceUsage:'code'});
 assert.equal(code.length,10,field+' code');
 assert.ok(code.every(c=>c.naming.usage==='code'&&c.naming.field===field));
}
assert.equal(api.batch(10).length,10);
console.log('PASS six fields, ten unique standalone names each');
seed=73;
const distribution={fields:{physics:0,astronomy:0},terms:{}};
for(let i=0;i<60000;i++){
 const draw=api.one({scienceFields:['physics','astronomy']});
 distribution.fields[draw.naming.field]++;
 const id=draw.nameParts.single.canonicalTermId;
 distribution.terms[id]=(distribution.terms[id]||0)+1;
}
assert.ok(Math.abs(distribution.fields.physics-30000)<900);
assert.ok(Math.abs(distribution.fields.astronomy-30000)<900);
const multiCount=distribution.terms['science:plasma'];
const singleCount=distribution.terms['science:quark'];
assert.ok(multiCount>singleCount&&multiCount<singleCount*2.7);
console.log('PASS fixed-seed field distribution',JSON.stringify({trials:60000,fields:distribution.fields,plasmaMulti:multiCount,quarkSingle:singleCount}));
const physics=api.eligible({scienceFields:['physics']});
const medicine=api.eligible({scienceFields:['medicine']});
const joined=api.eligible({scienceFields:['physics','medicine']});
assert.equal(joined.length,new Set([...physics,...medicine].map(t=>t.id)).size);
assert.ok(joined.every(t=>t.fields.includes('physics')||t.fields.includes('medicine')));
assert.equal(api.eligible({scienceFields:[]}).length,api.eligible({}).length);
const nameIds=new Set(api.eligible({scienceUsage:'name'}).map(t=>t.id));
const codeIds=new Set(api.eligible({scienceUsage:'code'}).map(t=>t.id));
assert.ok(codeIds.size>nameIds.size);
assert.ok([...nameIds].every(id=>codeIds.has(id)));
for(const gate of ['disease','pathogen','drugToxin']){
 const enabled=api.eligible({scienceIncludes:[gate]});
 assert.ok(enabled.length>115,gate);
 assert.ok(enabled.every(t=>t.gates.every(g=>g===gate)),gate);
}
assert.equal(api.eligible({scienceIncludes:Object.keys({disease:1,pathogen:1,drugToxin:1})}).length,123);
const previousGates=api.changeGates('science:necrosis',['disease','drugToxin']);
try{
 assert.ok(!api.eligible({scienceFields:['life','medicine'],scienceIncludes:['disease']}).some(t=>t.id==='science:necrosis'));
 assert.ok(!api.eligible({scienceFields:['life','medicine'],scienceIncludes:['drugToxin']}).some(t=>t.id==='science:necrosis'));
 assert.ok(api.eligible({scienceFields:['life','medicine'],scienceIncludes:['disease','drugToxin']}).some(t=>t.id==='science:necrosis'));
}finally{api.changeGates('science:necrosis',previousGates);}
console.log('PASS OR fields, usage distinction, and independent gates');
const batch=api.batch(10,{scienceFields:['medicine']});
assert.equal(batch.length,10);
const repeated=api.batch(10,{scienceFields:['medicine'],history:batch.nextHistory});
assert.equal(repeated.length,10,'older history relaxes when the field has exactly ten names');
const first=batch[0],texts=api.text(first);
assert.ok(texts[0].includes(first.nameParts.single.original));
assert.ok(texts[1].includes('用語の説明：'+first.nameParts.single.meaningJa));
assert.ok(texts[1].includes('出典：'));
assert.ok(texts[2].includes('分野：医学・薬学'));
assert.ok(texts.every(s=>!/(?:^|[\s／：])(?:null|undefined)(?:$|[\s／])/i.test(s)));
assert.equal(first.worldLabel,'現代日本');
console.log('PASS history relaxation, world independence, copy/provenance');
try{
 api.truncate(3);
 const short=api.batch(10);
 assert.equal(short.length,3);
 assert.equal(new Set(short.map(c=>c.name)).size,3);
 api.truncate(0);
 assert.throws(()=>api.batch(10),/0個/);
}finally{api.restore();}
api.configure('full');assert.equal(api.batch(5).length,5);
api.configure('settingOnly');assert.equal(api.batch(5).length,5);
assert.equal(all.length,129);
console.log('PASS shortage, zero-candidate error, and five-person modes');
