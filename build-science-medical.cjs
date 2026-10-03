'use strict';
// Keep index.html standalone; data/science-medical-v1.6.json is the source of truth.
// node build-science-medical.cjs [--check]
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const data=require('./data/science-medical-v1.6.json'),file=path.join(__dirname,'index.html');
const begin='/* BEGIN v1.6 SCIENCE MEDICAL DATA */',end='/* END v1.6 SCIENCE MEDICAL DATA */';
const ids=new Set(),canon=new Set(),displays=new Set();
assert.equal(data.version,'1.6');
for(const t of data.terms){
 assert.ok(t.id&&t.canonicalTermId&&t.kana&&t.original&&t.meaning&&t.kind);
 assert.ok(!ids.has(t.id)&&!canon.has(t.canonicalTermId)&&!displays.has(t.kana),'duplicate term '+t.id);
 ids.add(t.id);canon.add(t.canonicalTermId);displays.add(t.kana);
 assert.ok(t.fields.length&&t.fields.every(f=>data.fields[f]));
 assert.ok(t.uses.length&&t.uses.every(u=>['name','code'].includes(u)));
 assert.ok(t.gates.every(g=>['disease','pathogen','drugToxin'].includes(g)));
 assert.ok(data.sources[t.source]&&(data.sources[t.source].url||data.sources[t.source].baseUrl));
 assert.ok(['new','reused'].includes(t.tracking));
 assert.equal(t.decision,'adopt');assert.ok(t.decisionReason);
 assert.ok(Array.isArray(t.aliases)&&Array.isArray(t.moodTags));
 assert.ok(t.aliases.every(a=>a.kana&&a.original));
}
assert.ok(data.candidateLedger.every(item=>['hold','exclude','merge'].includes(item.decision)&&item.reason));
const block=[begin,'// Source of truth: data/science-medical-v1.6.json.',
 'const scienceMedicalData = '+JSON.stringify(data)+';',end].join('\n');
const html=fs.readFileSync(file,'utf8'),start=html.indexOf(begin),finish=html.indexOf(end);
assert.ok(start>=0&&finish>start,'data markers missing');
const updated=html.slice(0,start)+block+html.slice(finish+end.length);
if(process.argv.includes('--check'))assert.equal(html.replace(/\r\n/g,'\n'),updated.replace(/\r\n/g,'\n'),'embedded data is stale');
else fs.writeFileSync(file,updated);
console.log('PASS standalone science data:',data.terms.length,'canonical terms');
