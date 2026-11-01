'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const D=require('./js/dictionary-core.js');
assert.equal(require('node:crypto').createHash('sha256').update(fs.readFileSync('data/raw/name-dictionary/03_master_675_reconstructed.csv')).digest('hex'),'b1601520f6cab12d5f10cea2abd1507fe127d93824e395580ba9d0f3759512e9');
const data=JSON.parse(fs.readFileSync('data/dictionary-v1.7.json','utf8')),es=D.validate(data);
assert.equal(es.length,675);assert.equal(new Set(es.map(e=>e.id)).size,675);
for(const [prefix,count] of [['ND-',389],['NEW-',264],['SUP-',22]])assert.equal(es.filter(e=>e.id.startsWith(prefix)).length,count);
assert.equal(new Set(es.map(e=>e.majorCategory)).size,12);
assert.ok(es.every(e=>e.reviewRequired&&e.readingNormalized&&e.reading));
assert.equal(D.filter(es).length,675);
assert.equal(es.filter(e=>e.id.startsWith('ND-')&&e.usageFlags.name===0).length,389);
for(const [query,word] of [['花鶏','花鶏'],['あとり','花鶏'],['アトリ','花鶏'],[' ｱ ﾄ･ﾘ ','花鶏'],['鶫','鶫'],['ツグミ','鶫']])assert.ok(D.filter(es,{query}).some(e=>e.display===word),query);
for(const [input,expected] of [['ガラス','か'],['ぱぴぷ','は'],['ヴェール','あ'],['ゃく','や'],['っき','た'],['ーコート','か'],['ギョク','か'],['ワヲン','わ']])assert.equal(D.gojuon(input),expected,input);
assert.equal(D.normalize(' ギョク・ローズ '),D.normalize('ｷﾞｮｸ ﾛｰｽﾞ'));assert.notEqual(D.normalize('コート'),D.normalize('コト')); // Keep long vowel mark, never guess its reading.
assert.equal(D.filter(es,{query:'青海波'}).length,2);assert.equal(D.filter(es,{query:'霰'}).filter(e=>e.display==='霰').length,2);
assert.equal(es.filter(e=>e.display==='時雨').length,2);
assert.ok(es.filter(e=>e.id.startsWith('SUP-')).every(e=>!e.aliases.length&&e.canonicalGroup===e.id));
for(let n=17;n<=22;n++){const e=es.find(e=>e.id===`SUP-${n.toString().padStart(3,'0')}`);assert.equal(e.source.url,'');assert.ok(e.rawSource.url.includes('ornithology'));}
assert.equal(D.safeUrl('javascript:alert(1)'),'');assert.equal(D.safeUrl('data:text/html,test'),'');
const storage=new Map(),adapter={getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)};
let f=D.favorites(()=>adapter);f.toggle('SUP-001');f=D.favorites(()=>adapter);assert.equal(f.has('SUP-001'),true);f.toggle('SUP-001');assert.equal(D.favorites(()=>adapter).has('SUP-001'),false);
f.toggle('removed-id');assert.ok(D.favorites(()=>adapter).has('removed-id'));
let warning='';const memory=D.favorites(()=>{throw Error('blocked')},s=>warning=s);memory.toggle('SUP-002');assert.ok(memory.has('SUP-002')&&warning&&!memory.persistent());
storage.set(D.favoriteKey,'broken');assert.equal(D.favorites(()=>adapter).persistent(),false);
for(const value of [null,{}, {...data,entries:[es[0],es[0]]}, {...data,entries:[{...es[0],reviewRequired:false}]}, {...data,entries:[{...es[0],usageFlags:null}]}])assert.throws(()=>D.validate(value));
console.log('PASS dictionary: 675 IDs, 12 categories, normalization/search/gojuon, independent meanings, review/source safety, favorites/storage failures');
