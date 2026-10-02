'use strict';
// Keep index.html standalone. Only this delimited data block is generated.
// node build-kanji-myth.cjs [--check]
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const data=require('./data/kanji-myth-v1.5.json'),file=path.join(__dirname,'index.html');
const begin='/* BEGIN v1.5 KANJI AND MYTH DATA */',end='/* END v1.5 KANJI AND MYTH DATA */';
const ids=new Set(),entities=new Set(),displays=new Set();
for(const k of data.kanji){
  assert.match(k.display,/^\p{Script=Han}[\uFE00-\uFE0F\u{E0100}-\u{E01EF}]*$/u);
  assert.ok(k.variantGroup&&k.readings.length);
  assert.ok(!ids.has(k.id));ids.add(k.id);
  assert.ok(!displays.has(k.display));displays.add(k.display);
  for(const r of k.readings){assert.ok(r.text&&['dictionary','creative'].includes(r.kind));assert.ok(r.sources.every(s=>data.sources[s]));}
}
for(const m of data.myth){
  assert.ok(!entities.has(m.canonicalEntityId));entities.add(m.canonicalEntityId);
  assert.ok(['deity','hero','namedCreature','namedSpirit'].includes(m.entityType));
  assert.ok(m.traditions.length&&m.sources.every(s=>data.sources[s]));
  for(const a of m.aliases)assert.ok(a.sources.every(s=>data.sources[s]));
}
const block=[begin,'// Source of truth: data/kanji-myth-v1.5.json.',
  'const kanjiMythData = '+JSON.stringify(data)+';',end].join('\n');
const html=fs.readFileSync(file,'utf8'),start=html.indexOf(begin),finish=html.indexOf(end);
assert.ok(start>=0&&finish>start,'data markers missing');
const updated=html.slice(0,start)+block+html.slice(finish+end.length);
if(process.argv.includes('--check'))assert.equal(html.replace(/\r\n/g,'\n'),updated.replace(/\r\n/g,'\n'),'embedded data is stale; run node build-kanji-myth.cjs');
else fs.writeFileSync(file,updated);
console.log('PASS standalone v1.5 data:',data.kanji.length,'kanji displays,',data.myth.length,'myth entities');
