'use strict';
// Keep index.html standalone. Only this delimited data block is generated.
// node build-names.cjs [--check]
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const data=require('./data/names-v1.4.json'),file=path.join(__dirname,'index.html');
const begin='/* BEGIN v1.4 NAME EXPANSION */',end='/* END v1.4 NAME EXPANSION */';
const pools=new Map();
for(const {pool,...entry}of data.entries){assert.match(pool,/^(?:japanese|wafu|western|scifi)\.[A-Za-z.]+$/);assert.ok(data.sources[entry.source]);if(!pools.has(pool))pools.set(pool,[]);pools.get(pool).push(entry);}
const block=[begin,'// Reviewed additions; source of truth: data/names-v1.4.json.',
 'const expansionSourcesV14 = '+JSON.stringify(data.sources,null,2)+';',
 ...[...pools].map(([pool,items])=>'nameData.'+pool+'.push(\n'+items.map(n=>'  '+JSON.stringify(n)).join(',\n')+'\n);'),end].join('\n');
const html=fs.readFileSync(file,'utf8'),start=html.indexOf(begin),finish=html.indexOf(end);
assert.ok(start>=0&&finish>start,'data markers missing');
const updated=html.slice(0,start)+block+html.slice(finish+end.length);
if(process.argv.includes('--check'))assert.equal(html.replace(/\r\n/g,'\n'),updated.replace(/\r\n/g,'\n'),'embedded data is stale; run node build-names.cjs');
else fs.writeFileSync(file,updated);
console.log('PASS standalone data block:',data.entries.length,'additions');
