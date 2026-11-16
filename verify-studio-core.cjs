'use strict';
// Run: node verify-studio-core.cjs — v2.0 共通データ構造（DOM非依存部分）の検証
const assert=require('node:assert/strict');
const C=require('./js/studio/core.js');
const checks=[];const ok=name=>checks.push(name);

// ガチャ結果 → 図鑑キャラ（元データを保持し、元オブジェクトを書き換えない）
const g={id:'g1',mode:'full',name:'佐伯 丞',reading:'さえき じょう',roman:'Saeki Jo',codename:null,age:'24歳',genderImp:'男性',occupation:'探偵',worldLabel:'現代日本',
  appearance:'黒髪。',personality:'冷静',speech:'丁寧',first:'僕',second:'君',likes:'珈琲',dislikes:'雨',strength:'観察力',weakness:'朝',secret:'秘密',relationSeed:'種',storyRole:'探偵役',catch:'静かな人',imagePrompt:'1boy',naming:{system:'auto'}};
const frozen=JSON.stringify(g);
const p=C.newProject('検証作品','fantasy');
const a=C.fromGacha(p.id,g,'詳細テキスト');
assert.equal(JSON.stringify(g),frozen);
assert.equal(a.name,'佐伯 丞');assert.equal(a.profile.occupation,'探偵');assert.equal(a.height,null);
assert.equal(a.origin.gachaId,'g1');assert.deepEqual(a.origin.raw,g);assert.equal(a.origin.detailText,'詳細テキスト');
const n=C.fromGacha(p.id,{id:'g2',mode:'nameOnly',name:'瑠璃',nameImpression:'澄んだ印象の名前。',suitedFor:'巫女などに向く。'},'');
assert.ok(n.profile.nameNote.includes('澄んだ'));assert.equal(n.profile.age,'');
const manual=C.fromGacha(p.id,{id:'g3',mode:'settingOnly',name:'固定名',manualName:true,reading:'x',age:'10歳'},'');
assert.equal(manual.reading,'');
assert.equal(C.fromGacha(p.id,null,'').name,'');
ok('gacha conversion keeps source, handles name-only/manual/null');

// 身長の解釈
assert.equal(C.parseHeight('165'),165);assert.equal(C.parseHeight('１７２．５cm'),172.5);
for(const bad of ['','abc','0','-5','1000',null])assert.equal(C.parseHeight(bad),null);
ok('height parsing');

// 縮尺：頭頂と足元の指定が身長に一致すること
const ppc=2,pl=C.imagePlacement(200,400,0.1,0.9,180,ppc);
assert.ok(Math.abs((0.9-0.1)*400*pl.scale-180*ppc)<1e-9);          // 頭〜足 = 身長
assert.ok(Math.abs(pl.above-0.9*400*pl.scale)<1e-9);                // 足元が地面
assert.ok(Math.abs((pl.above-0.1*400*pl.scale)-180*ppc)<1e-9);      // 頭頂が身長の高さ
const swapped=C.imagePlacement(200,400,0.9,0.1,180,ppc);assert.ok(Math.abs(swapped.scale-pl.scale)<1e-9);
assert.ok(Number.isFinite(C.imagePlacement(200,400,0.5,0.5,180,ppc).scale));
const tall=C.imagePlacement(100,1000,0,1,150,ppc),wide=C.imagePlacement(1000,100,0,1,150,ppc);
assert.equal(tall.height,wide.height);                              // 縦横比ではなく指定範囲で決まる
assert.equal(C.scaleMax([150,183]),200);assert.equal(C.scaleMax([]),170);
ok('image scale follows head/foot markers, not aspect ratio');

// 並べ替え
const b=C.newCharacter(p.id,'B');b.height=150;const c=C.newCharacter(p.id,'C');a.height=180;
const items=[{charId:a.id},{charId:c.id},{charId:b.id}];
assert.deepEqual(C.sortByHeight(items,[a,b,c],false).map(i=>i.charId),[b.id,c.id,a.id]);
assert.deepEqual(C.sortByHeight(items,[a,b,c],true).map(i=>i.charId),[a.id,c.id,b.id]);
assert.equal(items[0].charId,a.id);
ok('height sort is stable and non-mutating');

// 相関図：同じ二人の複数関係は別々のずれ量になる
const e1=C.newEdge(a.id,b.id,'love'),e2=C.newEdge(b.id,a.id,'rival'),e3=C.newEdge(a.id,b.id,'friend'),e4=C.newEdge(a.id,c.id,'family');
const off=C.edgeOffsets([e1,e2,e3,e4],44);
assert.equal(off.get(e4.id)+0,0);
const A={x:0,y:0},B={x:200,y:0};
const mids=[e1,e2,e3].map(e=>{const from=e.from===a.id?A:B,to=e.to===a.id?A:B;return C.curvePoints(from,to,off.get(e.id),40).mid.y;});
assert.equal(new Set(mids.map(m=>Math.round(m))).size,3);
assert.ok(Math.min(...[mids[0]-mids[1],mids[1]-mids[2],mids[0]-mids[2]].map(Math.abs))>=40);
const cp=C.curvePoints(A,B,0,40);assert.ok(Math.abs(cp.end.x-160)<5&&Math.abs(cp.start.x-40)<5);assert.ok(Math.abs(cp.endAngle)<0.01);
assert.equal(C.edgeLabel(e1),'恋愛');e1.label='片想い';assert.equal(C.edgeLabel(e1),'片想い');
ok('parallel relations curve apart; arrows end at node edge');

// 連携：削除の影響と掃除
const chart=C.newChart('図');chart.nodes=[{charId:a.id,x:0,y:0},{charId:b.id,x:1,y:1},{charId:c.id,x:2,y:2}];chart.edges=[e1,e2,e3,e4];
p.charts=[chart];p.heightCompare.items=items.slice();
const impact=C.deleteImpact(p,a.id);
assert.deepEqual(impact,{heightCompare:true,charts:['図'],edges:4});
C.removeCharacterRefs(p,a.id);
assert.equal(chart.nodes.length,2);assert.equal(chart.edges.length,0);assert.equal(p.heightCompare.items.length,2);
ok('delete impact and reference cleanup');

// 世界観：テンプレートは追記のみ、紐付け解除
const org=p.world.sections.find(s=>s.key==='organization').entries[0];
org.body='書いた内容';b.affiliations=[org.id];
const before=C.allEntries(p.world).length;
assert.equal(C.applyTemplate(p.world,'fantasy'),0);assert.equal(C.allEntries(p.world).length,before);
assert.ok(C.applyTemplate(p.world,'scifi')>0);assert.equal(org.body,'書いた内容');
assert.ok(C.worldToText(p.world,[b]).includes('関連キャラ：B'));
assert.ok(C.characterToText(b,p.world).includes('所属・関連：'+org.title));
assert.deepEqual(C.removeEntryRefs([b,c],[org.id]),[b]);assert.deepEqual(b.affiliations,[]);
ok('templates only append; world links resolve by id');

// バックアップ → 復元（IDを振り直し、参照と画像を保つ）
b.affiliations=[org.id];
const png=new Uint8Array([137,80,78,71,13,10,26,10,0,255,1,2,3]).buffer;
b.variants[0].imageId='img_x';b.variants.push(Object.assign(C.newVariant('笑顔','expression'),{imageId:'img_y',headY:0.2,footY:0.8}));
p.heightCompare.items=[{charId:b.id,variantId:b.variants[1].id},{charId:c.id,variantId:null}];
chart.edges=[C.newEdge(b.id,c.id,'master')];
const bundle=C.exportBundle(p,[b,c],[{id:'img_x',type:'image/png',w:1,h:1,buffer:png},{id:'img_y',type:'image/png',w:1,h:1,buffer:png},{id:'img_orphan',type:'image/png',w:1,h:1,buffer:png}]);
assert.equal(bundle.images.length,2);
const round=JSON.parse(JSON.stringify(bundle));
assert.equal(C.validateBundle(round),'');
const r=C.importBundle(round);
assert.notEqual(r.project.id,p.id);assert.equal(r.characters.length,2);assert.equal(r.images.length,2);
const rb=r.characters.find(x=>x.name==='B'),rc=r.characters.find(x=>x.name==='C');
assert.notEqual(rb.id,b.id);assert.equal(rb.projectId,r.project.id);
assert.ok(r.images.some(i=>i.id===rb.variants[1].imageId));assert.notEqual(rb.variants[1].imageId,'img_y');
assert.deepEqual([...new Uint8Array(r.images[0].buffer)],[...new Uint8Array(png)]);
assert.equal(rb.variants[1].headY,0.2);
assert.deepEqual(r.project.heightCompare.items,[{charId:rb.id,variantId:rb.variants[1].id},{charId:rc.id,variantId:null}]);
assert.equal(r.project.charts[0].edges[0].from,rb.id);assert.equal(r.project.charts[0].edges[0].to,rc.id);
assert.deepEqual(rb.affiliations,[org.id]);
assert.ok(C.allEntries(r.project.world).some(x=>x.entry.id===org.id));
ok('backup round trip remaps ids and keeps images, links, charts');

// 壊れた・悪意のある入力
for(const bad of [null,{},{format:C.FORMAT,version:99,project:{},characters:[],images:[]},{format:'x',version:2},{format:C.FORMAT,version:2,project:{},characters:[{}],images:[]},{format:C.FORMAT,version:2,project:{},characters:[],images:[{id:'a'}]}])
  assert.ok(C.validateBundle(bad));
assert.throws(()=>C.importBundle({format:'x'}));
const hostile=C.importBundle({format:C.FORMAT,version:2,project:{name:'<img src=x onerror=1>',charts:[{nodes:[{charId:'ghost'}],edges:[{from:'ghost',to:'c1'}]}],heightCompare:{items:[{charId:'ghost'},null]},world:null},
  characters:[{id:'c1',name:'<b>x</b>',variants:[{id:'v',imageId:'missing'}],height:'abc',profile:null,affiliations:'no'}],images:[]});
assert.equal(hostile.project.charts[0].nodes.length,0);assert.equal(hostile.project.charts[0].edges.length,0);
assert.equal(hostile.project.heightCompare.items.length,0);assert.equal(hostile.characters[0].variants[0].imageId,null);
assert.equal(hostile.characters[0].height,null);assert.deepEqual(hostile.characters[0].affiliations,[]);assert.equal(hostile.characters[0].profile.age,'');
assert.equal(hostile.project.world.sections.length,C.SECTION_DEFS.length);
ok('invalid and hostile backups are rejected or sanitized');

// 複製・検索
const d=C.duplicateCharacter(b);assert.notEqual(d.id,b.id);assert.notEqual(d.variants[0].id,b.variants[0].id);assert.equal(d.variants[0].imageId,b.variants[0].imageId);
assert.ok(C.matchesQuery(b,'笑顔'));assert.ok(!C.matchesQuery(b,'いない'));assert.ok(C.matchesQuery(a,'さえき 探偵'));
assert.equal(new Set(Array.from({length:5000},()=>C.uid('t'))).size,5000);
ok('duplicate, search, unique ids');

console.log('PASS '+checks.length+' groups: '+checks.join('; '));
