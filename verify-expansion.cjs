'use strict';
// node verify-expansion.cjs [report.json]
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
const context=vm.createContext({});vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1].replace(/\binit\(\);\s*$/,''),context);
const a=vm.runInContext('({nameData,nameRecords,legacyRecords,nameSources,recordPart,generateName,renderNameInfo,modernPools,fantasyPools})',context);
const addition=require('./data/names-v1.4.json'),baseline=require('./data/baseline-v1.3.json');
const norm=s=>s.normalize('NFKC').toLowerCase().replace(/[\s\-’']/g,'');
const report={version:'1.4',passed:false,byPool:{},totalAdded:addition.entries.length,checks:[],duplicates:[],newHomophones:[],spellingReuse:[],samples:{},motifs:[],languages:[]};
const all=[];
function walk(o,p=[]){for(const[k,v]of Object.entries(o))if(Array.isArray(v)){
 const pool=p.concat(k).join('.'),b=baseline[pool];assert.ok(b);
 assert.equal(crypto.createHash('sha256').update(JSON.stringify(v.slice(0,b.count))).digest('hex'),b.sha256,'old data changed: '+pool);
 for(const n of v)all.push({pool,...n});
 const added=v.slice(b.count);assert.ok(added.every(n=>n.addedVersion==='1.4'));if(added.length)report.byPool[pool]=added.length;
 }else walk(v,p.concat(k));}walk(a.nameData);
report.checks.push('all original 2162 nameData entries retained in original order, with unchanged fields');
assert.equal(all.filter(n=>n.addedVersion).length,addition.entries.length);
for(const {pool,...expected}of addition.entries){const list=pool.split('.').reduce((o,k)=>o[k],a.nameData);const raw=list.find(n=>(n.kanji||n.kana)===(expected.kanji||expected.kana));assert.deepEqual(JSON.parse(JSON.stringify(raw)),expected);
 for(const f of ['language','motif','style','sourceTerm','meaning','derivation','source','roman'])assert.ok(raw[f]?.trim(),f);
 assert.ok(a.nameSources[raw.source]);assert.ok(!/^(?:luna|astra|noct|raven|silver|shadow|night|moon|dark|blood)/i.test(raw.roman));
 const r=a.legacyRecords.get(raw);assert.ok(r);assert.equal(r.originLanguage,raw.language);assert.ok(r.motifs.includes(raw.motif));
 const part=a.recordPart(r,pool.endsWith('codenames')?'codename':pool.includes('givenNames')?'given':'family');assert.equal(part.originType,raw.originType);assert.ok(part.sources.includes(raw.source));assert.ok(part.editorialNote);assert.ok(part.style);
 assert.ok(!Object.values(a.modernPools).some(p=>p.given.includes(r.id)||p.family.includes(r.id)),'fantasy/editorial data leaked into attested modern pools');
 const rendered=a.renderNameInfo({naming:{system:'fantasy',motif:'legacy'},nameParts:{given:part}});assert.ok(!/undefined|null/.test(rendered));assert.ok(rendered.includes('編集上の着想'));
}
report.checks.push('every addition is reachable in its generation pool; metadata survives nameParts and origin rendering; no modern-culture leakage');
// Full global inventory; cross-gender/world reuse is listed, not hidden as a dedup success.
for(const field of ['display','kanji','reading','kana','roman']){
 const map=new Map();for(const n of all){const val=field==='display'?n.kanji||n.kana:n[field];if(!val)continue;const key=norm(val);if(!map.has(key))map.set(key,[]);map.get(key).push(n);}
 for(const [value,items]of map)if(items.length>1){const involved=items.some(n=>n.addedVersion==='1.4');const row={field,value,newlyInvolved:involved,entries:items.map(n=>({pool:n.pool,display:n.kanji||n.kana,reading:n.reading||n.kana,roman:n.roman,added:!!n.addedVersion}))};report.duplicates.push(row);
 if(involved){assert.equal(new Set(items.map(n=>n.pool)).size,items.length,'new same-pool duplicate '+field+' '+value);if(['reading','roman','kana'].includes(field)&&new Set(items.map(n=>n.kanji||n.kana)).size>1)report.newHomophones.push(row);if(field==='display')report.spellingReuse.push(row);}
 }
}
// Array membership and globally unique spellings are deliberately separate counts.
const previous=new Set(all.filter(n=>!n.addedVersion).map(n=>norm(n.kanji||n.kana)));
report.uniqueNewDisplays=new Set(addition.entries.filter(n=>!previous.has(norm(n.kanji||n.kana))).map(n=>norm(n.kanji||n.kana))).size;
report.reusedDisplayMemberships=addition.entries.filter(n=>previous.has(norm(n.kanji||n.kana))).length;
report.motifs=[...new Set(addition.entries.map(n=>n.motif))].sort();report.languages=[...new Set(addition.entries.map(n=>n.language))].sort();
report.checks.push('all display/kanji/reading/kana/roman duplicates across every pool listed; no new same-pool duplicates');
let seed=914;const rng=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const aiJP=/[月夜黒神影零玲凛蒼]/,aiWest=/^(luna|astra|noct|raven|silver|shadow|night|moon|dark|blood)/i;
for(const [system,world]of [['japanese','modern'],['wafu','wafu'],['fantasy','western'],['fantasy','royal']]){
 const samples=[],counts=new Map();let ai=0,newHits=0;
 for(let i=0;i<12000;i++){const n=a.generateName(world,['male','female','neutral'][i%3],[],{system,motifs:['legacy'],rng});samples.push(n);counts.set(n.display,(counts.get(n.display)||0)+1);if(Object.values(n.nameParts).some(p=>system==='japanese'||system==='wafu'?aiJP.test(p.display):aiWest.test(p.original)))ai++;if(Object.values(n.nameParts).some(p=>a.nameRecords.get(p.id).addedVersion))newHits++;}
 const max=Math.max(...counts.values())/samples.length;assert.ok(max<.01);assert.ok(newHits>0);assert.ok(ai/samples.length<.4);
 if(world==='royal'){const noble=new Set(a.nameData.western.nobleNames.map(n=>n.roman));assert.ok(samples.every(n=>noble.has(n.nameParts.family.original)));}
 report.samples[system+':'+world]={trials:samples.length,uniqueFullNames:counts.size,maxFullNameShare:max,repeatRate:1-counts.size/samples.length,aiMotifShare:ai/samples.length,withNewData:newHits,examples:samples.slice(0,6).map(n=>n.display)};
}
report.checks.push('48000 fixed-seed samples: variants reached, low maximum name share, motifs audited, royal legacy family pool preserved');
report.passed=true;fs.writeFileSync(process.argv[2]||path.join(__dirname,'expansion-test-report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,totalAdded:report.totalAdded,byPool:report.byPool,uniqueNewDisplays:report.uniqueNewDisplays,reusedDisplayMemberships:report.reusedDisplayMemberships,newHomophones:report.newHomophones.length}));
