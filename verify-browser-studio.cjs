'use strict';
// Run: node verify-browser-studio.cjs [outdir] — v2.0（図鑑・身長比較・相関図・世界観・作品管理）の実ブラウザ検証
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const repo=__dirname,outdir=process.argv[2]||path.join(repo,'reports/v2.0/studio-browser');fs.mkdirSync(outdir,{recursive:true});
const report={passed:false,checks:[],consoleErrors:[],screenshots:[]};
const legacy=[{id:'old-v12',mode:'nameOnly',name:'旧保存 テスト',reading:'きゅうほぞん てすと',roman:'Old Test',worldLabel:'現代日本',nameImpression:'穏やかな印象の名前。',suitedFor:'現代日本の世界観で、「穏やか」系の人物──たとえば学生などに向く。'}];
(async()=>{
 const server=require('./tests/static-server.cjs')(repo);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port;
 let browser;
 const ok=m=>{report.checks.push(m);};
 try{
  browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
  const context=await browser.newContext({viewport:{width:1100,height:900},acceptDownloads:true,permissions:['clipboard-read','clipboard-write']});
  const page=await context.newPage();
  page.on('pageerror',e=>report.consoleErrors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push(m.text());});
  await page.addInitScript(v=>{if(!localStorage.getItem('qa-fixture')){localStorage.setItem('ocMakerSavedV1',v);localStorage.setItem('qa-fixture','1');}},JSON.stringify(legacy));
  const ready=()=>page.waitForSelector('html[data-studio="ready"]');
  const tab=async k=>{await page.locator('#studioTabs [data-tab="'+k+'"]').click();await page.waitForSelector('#tab-'+k+':not([hidden])');};
  const toast=t=>page.waitForFunction(x=>document.getElementById('toast').textContent.includes(x),t);
  const S=fn=>page.evaluate(fn);
  const settle=()=>page.evaluate(()=>OCStudio.flush());
  const shot=async(name,opts)=>{await page.screenshot({path:path.join(outdir,name),...(opts||{})});report.screenshots.push(name);};
  const sheet=()=>page.locator('.st-sheet').last();
  const closeSheet=async()=>{await sheet().locator('.st-x').click();};

  /* ---- 起動・既存機能・移行 ---- */
  await page.goto(origin);await ready();
  assert.equal(await page.title(),'創作OCメーカー v2.2');
  assert.deepEqual(await page.locator('#studioTabs [role="tab"]').allTextContents(),['作成','図鑑','身長比較','相関図','世界観']);
  assert.ok(await page.locator('#tab-create').isVisible());assert.ok(await page.locator('#btnGen1').isVisible());
  for(const k of ['zukan','height','relation','world'])assert.equal(await page.locator('#tab-'+k).isVisible(),false);
  assert.equal(await page.locator('#savedList .saved-item').count(),1);
  assert.equal(await page.locator('#projectSelect option').count(),1);assert.equal(await page.locator('#projectSelect option').textContent(),'マイ作品');
  await page.waitForFunction(()=>document.getElementById('saveStatus').textContent==='保存済み');
  ok('boots with five tabs, legacy save list intact, default project created');

  await page.locator('[data-mode="full"]').click();await page.locator('#btnGen5').click();
  assert.equal(await page.locator('#results .card').count(),5);
  await page.locator('#results [data-act="detail"]').first().click();
  await page.waitForFunction(async()=>(await navigator.clipboard.readText()).replace(/\r\n/g,'\n')===buildDetailText(generatedResults[0]));
  await page.locator('#results [data-act="zukan"]').nth(0).click();await toast('図鑑に登録しました');
  await page.locator('#results [data-act="zukan"]').nth(1).click();await page.waitForFunction(()=>OCStudio.S.chars.length===2);
  await page.locator('#results [data-act="zukan"]').nth(0).click();await toast('登録済み');
  assert.equal(await S(()=>OCStudio.S.chars.length),2);
  await page.locator('#savedList [data-sact="zukan"]').click();await page.waitForFunction(()=>OCStudio.S.chars.length===3);
  assert.equal(await S(()=>localStorage.getItem('ocMakerSavedV1')),JSON.stringify(legacy));
  const firstGen=await S(()=>({name:generatedResults[0].name,age:generatedResults[0].age,text:buildDetailText(generatedResults[0])}));
  assert.deepEqual(await S(()=>{const c=OCStudio.S.chars[0];return {name:c.name,age:c.profile.age,text:c.origin.detailText};}),firstGen);
  ok('register from result cards and legacy list; duplicates refused; ocMakerSavedV1 byte-identical');

  /* ---- キャラ図鑑 ---- */
  await tab('zukan');
  assert.equal(await page.locator('#zkGrid .zk-card').count(),3);
  await page.locator('#zkSearch').fill('きゅうほぞん');assert.equal(await page.locator('#zkGrid .zk-card').count(),1);
  await page.locator('#zkSearch').fill('');
  await page.locator('#zkFilter').selectOption('img');assert.equal(await page.locator('#zkGrid .zk-card').count(),0);
  await page.locator('#zkFilter').selectOption('all');
  await page.locator('#zkGrid .zk-card').first().click();
  await sheet().locator('[data-f="name"]').fill('検証 太郎');
  assert.equal(await sheet().locator('h3').textContent(),'検証 太郎');
  await sheet().locator('[data-f="height"]').fill('abc');assert.ok((await sheet().locator('#zkHeightNote').textContent()).includes('数字'));
  await sheet().locator('[data-f="height"]').fill('180');
  await sheet().locator('[data-f="memo"]').fill('<script>window.pwned=1</script>メモ');
  // 立ち絵：200x400、体は10%〜90%の位置
  const png=Buffer.from(await S(()=>{const c=document.createElement('canvas');c.width=200;c.height=400;const x=c.getContext('2d');x.fillStyle='#e03030';x.fillRect(60,40,80,320);return c.toDataURL('image/png').split(',')[1];}),'base64');
  await sheet().locator('[data-v="file"]').first().setInputFiles({name:'stand.png',mimeType:'image/png',buffer:png});
  await toast('画像を登録しました');
  await sheet().locator('[data-v="calib"]').click();
  const cal=sheet();const box=await cal.locator('.cal-stage').boundingBox();
  for(const [sel,y] of [['.cal-line.head',0.10],['.cal-line.foot',0.90]]){
   const lb=await cal.locator(sel).boundingBox();
   await page.mouse.move(lb.x+lb.width/2,lb.y);await page.mouse.down();
   await page.mouse.move(lb.x+lb.width/2,box.y+box.height*y,{steps:5});await page.mouse.up();
  }
  await cal.locator('.cal-line.head').focus();await page.keyboard.press('ArrowDown');await page.keyboard.press('ArrowUp');
  await shot('calibrator.png');
  await cal.locator('[data-c="ok"]').click();
  const v0=await S(()=>OCStudio.S.chars[0].variants[0]);
  assert.ok(Math.abs(v0.headY-0.10)<0.012&&Math.abs(v0.footY-0.90)<0.012,JSON.stringify(v0));
  await sheet().locator('[data-a="addvar"]').click();
  await sheet().locator('[data-v="label"]').nth(1).fill('笑顔');await sheet().locator('[data-v="kind"]').nth(1).selectOption('expression');
  // 差分にも別の画像（300x300、体は20%〜80%）。画像の形が違っても同じ身長になることを後で確かめる
  const png2=Buffer.from(await S(()=>{const c=document.createElement('canvas');c.width=300;c.height=300;const x=c.getContext('2d');x.fillStyle='#3050e0';x.fillRect(100,60,100,180);return c.toDataURL('image/png').split(',')[1];}),'base64');
  await sheet().locator('[data-v="file"]').nth(1).setInputFiles({name:'smile.png',mimeType:'image/png',buffer:png2});
  await page.waitForFunction(()=>!!OCStudio.S.chars[0].variants[1].imageId);
  await S(()=>{const c=OCStudio.S.chars[0];c.variants[1].headY=0.2;c.variants[1].footY=0.8;OCStudio.saveChar(c);});
  await sheet().locator('details:has(#zkCustom) > summary').click();
  await sheet().locator('[data-a="addcustom"]').click();
  await sheet().locator('[data-cf="label"]').fill('誕生日');await sheet().locator('[data-cf="value"]').fill('4月1日');
  await sheet().locator('[data-a="copy"]').click();
  await page.waitForFunction(async()=>{const t=await navigator.clipboard.readText();return t.includes('名前：検証 太郎')&&t.includes('身長：180cm')&&t.includes('誕生日：4月1日');});
  await shot('zukan-detail.png');
  await closeSheet();await settle();
  assert.equal(await page.locator('#zkGrid .zk-card').first().locator('.zk-name').textContent(),'検証 太郎');
  await page.waitForSelector('#zkGrid .zk-card .zk-thumb.has img');
  assert.equal(await S(()=>window.pwned),undefined);
  // 複製と白紙作成
  await page.locator('#zkGrid .zk-card').first().click();await sheet().locator('[data-a="dup"]').click();
  await page.waitForFunction(()=>OCStudio.S.chars.length===4);await closeSheet();
  await page.locator('#zkNew').click();await sheet().locator('[data-f="name"]').fill('白紙 花子');await sheet().locator('[data-f="height"]').fill('150');await closeSheet();await settle();
  assert.equal(await page.locator('#zkGrid .zk-card').count(),5);
  await shot('zukan-grid.png');
  await page.reload();await ready();
  assert.equal(await page.locator('#tab-zukan').isVisible(),true);
  assert.deepEqual(await S(()=>OCStudio.S.chars.map(c=>[c.name,c.height,c.variants.length,!!c.variants[0].imageId])),
   [['検証 太郎',180,2,true],[await S(()=>OCStudio.S.chars[1].name),null,1,false],['旧保存 テスト',null,1,false],['検証 太郎（コピー）',180,2,true],['白紙 花子',150,1,false]]);
  await page.waitForSelector('#zkGrid .zk-card .zk-thumb.has img');
  ok('encyclopedia: search/filter, edit, image upload, head/foot markers by drag+keyboard, variants, custom fields, copy, duplicate, blank; survives reload; no HTML injection');

  /* ---- 身長比較 ---- */
  await tab('height');
  await page.locator('#hcPick').click();await sheet().locator('[data-p="all"]').click();await sheet().locator('[data-p="ok"]').click();
  await page.waitForFunction(()=>OCStudio.tabs.height.layout()&&OCStudio.tabs.height.layout().rows.length===5);
  const L=await S(()=>{const l=OCStudio.tabs.height.layout();return {ppc:l.ppc,ground:l.ground,maxCm:l.maxCm,rows:l.rows.map(r=>({name:r.c.name,cm:r.cm,assumed:r.assumed,hpx:r.hpx,cx:r.cx,pl:r.pl||null,headY:r.v.headY,imgH:r.img?r.img.naturalHeight:0}))};});
  assert.equal(L.maxCm,190);
  const r0=L.rows[0];assert.equal(r0.cm,180);
  // 頭頂の線が「身長×縮尺」の高さに来ること（画像の縦横比ではなく指定位置で決まる）
  assert.ok(Math.abs((r0.pl.above-r0.headY*r0.imgH*r0.pl.scale)-180*L.ppc)<0.01);
  // 実際の画素：頭頂の少し下は体の赤、少し上は背景
  const px=await S(()=>{const l=OCStudio.tabs.height.layout(),r=l.rows[0],cv=document.getElementById('hcCanvas'),k=cv.width/l.width,g=cv.getContext('2d');
   const at=(x,y)=>[...g.getImageData(Math.round(x*k),Math.round(y*k),1,1).data];const head=l.ground-r.hpx;
   return {below:at(r.cx,head+6),above:at(r.cx,head-6),foot:at(r.cx,l.ground-6),sil:at(l.rows[4].cx,l.ground-l.rows[4].hpx*0.7)};});
  assert.ok(px.below[0]>200&&px.below[1]<80,JSON.stringify(px));assert.ok(px.above[1]>200,JSON.stringify(px));assert.ok(px.foot[0]>200&&px.foot[1]<80);
  assert.ok(px.sil[2]>px.sil[1],'silhouette drawn for image-less character');
  assert.ok(L.rows[1].assumed&&L.rows[1].cm===160);assert.ok((await page.locator('#hcHint').textContent()).includes('仮に160cm'));
  await page.locator('#hcAsc').click();
  assert.deepEqual(await S(()=>OCStudio.S.project.heightCompare.items.map(i=>OCStudio.S.chars.find(c=>c.id===i.charId).height||160)),[150,160,160,180,180]);
  await page.locator('#hcList [data-i="0"] [data-h="right"]').click();
  assert.equal(await page.locator('#hcList [data-i="1"] .hc-name').textContent(),'白紙 花子');
  // 連携：身長比較で数値を変えると図鑑のキャラに反映
  await page.locator('#hcList [data-i="1"] [data-h="cm"]').fill('148.5');await settle();
  assert.equal(await S(()=>OCStudio.S.chars.find(c=>c.name==='白紙 花子').height),148.5);
  await page.locator('#hcList [data-i="4"] [data-h="variant"]').selectOption({label:'笑顔'});
  await page.waitForFunction(()=>{const r=OCStudio.tabs.height.layout().rows[4];return r.v.label==='笑顔'&&r.img&&r.img.naturalWidth===300;});
  const two=await S(()=>{const l=OCStudio.tabs.height.layout();return [3,4].map(i=>{const r=l.rows[i];return {cm:r.cm,body:(Math.max(r.v.headY,r.v.footY)-Math.min(r.v.headY,r.v.footY))*r.img.naturalHeight*r.pl.scale,w:r.img.naturalWidth};});});
  assert.equal(two[0].cm,180);assert.equal(two[1].cm,180);assert.notEqual(two[0].w,two[1].w);
  assert.ok(Math.abs(two[0].body-two[1].body)<1.5,'different image shapes must render at the same body height: '+JSON.stringify(two));
  await page.locator('#hcBg [data-bg="#2D2A33"]').click();await page.locator('#hcScale').uncheck();await page.locator('#hcScale').check();
  await shot('height-desktop.png');
  await page.locator('#hcPng').click();
  await sheet().locator('.st-png img').waitFor();
  const hp=await sheet().locator('.st-png img').evaluate(async im=>{await im.decode();return {w:im.naturalWidth,h:im.naturalHeight};});
  assert.ok(hp.w>=640&&hp.h>=800,JSON.stringify(hp));
  // ヘッドレス環境は日本語のファイル名を'download'に置き換えるため、名前は属性で確認する
  assert.match(await sheet().locator('.st-dl').getAttribute('download'),/^height_マイ作品_\d{8}-\d{4}\.png$/);
  const [dl1]=await Promise.all([page.waitForEvent('download'),sheet().locator('.st-dl').click()]);
  const hpng=fs.readFileSync(await dl1.path());assert.equal(hpng.subarray(1,4).toString(),'PNG');fs.writeFileSync(path.join(outdir,'export-height.png'),hpng);report.screenshots.push('export-height.png');
  await closeSheet();
  await page.locator('#hcList [data-i="0"] [data-h="remove"]').click();assert.equal(await page.locator('#hcList .hc-row').count(),4);
  ok('height compare: same scale from head/foot markers (layout math + real pixels), silhouette fallback, sort, reorder, variant, background, PNG export, edits flow back to the character');

  /* ---- 相関図 ---- */
  await tab('relation');
  await page.locator('#rlAdd').click();await sheet().locator('[data-p="all"]').click();await sheet().locator('[data-p="ok"]').click();
  await page.waitForFunction(()=>OCStudio.tabs.relation.debug().chart.nodes.length===5);
  const pos=async i=>S_arg(i);
  async function S_arg(i){return page.evaluate(i=>{const d=OCStudio.tabs.relation.debug(),n=d.chart.nodes[i],v=d.chart.view,r=document.getElementById('rlCanvas').getBoundingClientRect();return {x:r.left+n.x*v.k+v.x,y:r.top+n.y*v.k+v.y,id:n.charId};},i);}
  await page.evaluate(()=>document.getElementById('rlStage').scrollIntoView({block:'center'}));
  // ドラッグで配置
  let p0=await pos(0);
  await page.mouse.move(p0.x,p0.y);await page.mouse.down();await page.mouse.move(p0.x-140,p0.y-90,{steps:6});await page.mouse.up();
  const p0b=await pos(0);assert.ok(Math.abs(p0b.x-(p0.x-140))<3&&Math.abs(p0b.y-(p0.y-90))<3);
  // 線を引く：1人目→2人目
  await page.locator('.st-seg [data-mode="link"]').click();
  const a=await pos(0),b=await pos(1);
  await page.mouse.click(a.x,a.y);assert.ok((await page.locator('#rlGuide').textContent()).includes('から線を引きます'));
  await page.mouse.click(b.x,b.y);
  await sheet().locator('[data-type="love"]').click();await sheet().locator('[data-e="label"]').fill('片想い');await sheet().locator('[data-e="save"]').click();
  // 同じ二人に2本目・3本目（逆向き・双方向・破線・色変更）
  await page.locator('.st-seg [data-mode="move"]').click();
  await page.locator('#rlNewEdge').click();
  await sheet().locator('[data-e="from"]').selectOption(b.id);await sheet().locator('[data-e="to"]').selectOption(a.id);
  await sheet().locator('[data-type="rival"]').click();await sheet().locator('[data-dir="both"]').click();await sheet().locator('[data-style="dashed"]').click();await sheet().locator('[data-e="save"]').click();
  await page.locator('#rlNewEdge').click();
  await sheet().locator('[data-e="from"]').selectOption(a.id);await sheet().locator('[data-e="to"]').selectOption(b.id);
  await sheet().locator('[data-type="master"]').click();await sheet().locator('[data-dir="none"]').click();await sheet().locator('[data-style="dotted"]').click();
  await sheet().locator('#rlColors [data-color="#2E7D6B"]').click();await sheet().locator('[data-e="save"]').click();
  // 自分自身への線は拒否
  await page.locator('#rlNewEdge').click();await sheet().locator('[data-e="to"]').selectOption(await sheet().locator('[data-e="from"]').inputValue());
  await sheet().locator('[data-e="save"]').click();await toast('別々の人物');await sheet().locator('[data-e="cancel"]').click();
  const dbg=await S(()=>{const d=OCStudio.tabs.relation.debug();return {edges:d.chart.edges,labels:d.labels};});
  assert.equal(dbg.edges.length,3);
  assert.deepEqual(dbg.edges.map(e=>[e.type,e.dir,e.style,e.label]),[['love','one','solid','片想い'],['rival','both','dashed',''],['master','none','dotted','']]);
  assert.equal(dbg.edges[2].color,'#2E7D6B');
  const ys=dbg.labels.map(l=>[l.x+l.w/2,l.y+l.h/2]);
  for(let i=0;i<3;i++)for(let j=i+1;j<3;j++)assert.ok(Math.hypot(ys[i][0]-ys[j][0],ys[i][1]-ys[j][1])>30,'parallel labels must not overlap');
  assert.equal(await page.locator('#rlEdges .rl-edge').count(),3);
  // ラベルをタップして編集
  const lab=await S(()=>{const d=OCStudio.tabs.relation.debug(),l=d.labels[0],v=d.chart.view,r=document.getElementById('rlCanvas').getBoundingClientRect();return {x:r.left+(l.x+l.w/2)*v.k+v.x,y:r.top+(l.y+l.h/2)*v.k+v.y};});
  await page.mouse.click(lab.x,lab.y);
  assert.equal(await sheet().locator('[data-e="label"]').inputValue(),'片想い');await sheet().locator('[data-e="label"]').fill('幼なじみ');await sheet().locator('[data-e="save"]').click();
  // 余白ドラッグで全体移動、拡大、全体表示
  const view1=await S(()=>({...OCStudio.tabs.relation.debug().chart.view}));
  const cb=await page.locator('#rlCanvas').boundingBox();
  await page.mouse.move(cb.x+12,cb.y+12);await page.mouse.down();await page.mouse.move(cb.x+62,cb.y+42,{steps:4});await page.mouse.up();
  const view2=await S(()=>({...OCStudio.tabs.relation.debug().chart.view}));assert.ok(Math.abs(view2.x-view1.x-50)<2&&Math.abs(view2.y-view1.y-30)<2);
  await page.locator('.rl-zoom [data-z="in"]').click();assert.ok((await S(()=>OCStudio.tabs.relation.debug().chart.view.k))>view2.k);
  await page.locator('.rl-zoom [data-z="fit"]').click();
  // 連携：図鑑で改名すると相関図に反映
  await S(()=>OCStudio.tabs.zukan.openChar(OCStudio.tabs.relation.debug().chart.nodes[0].charId));
  await sheet().locator('[data-f="name"]').fill('改名 次郎');await closeSheet();await settle();
  assert.ok((await page.locator('#rlEdges .rl-edge').first().locator('.rl-who').textContent()).startsWith('改名 次郎 →'));
  await shot('relation-desktop.png');
  // 2枚目の図と複製、保存・再編集
  await page.locator('#rlChartMenu').click();await sheet().locator('[data-a="dup"]').click();
  assert.equal(await page.locator('#rlChart option').count(),2);
  assert.equal(await S(()=>OCStudio.tabs.relation.debug().chart.edges.length),3);
  await page.locator('#rlChart').selectOption({index:0});
  await page.locator('#rlPng').click();await sheet().locator('.st-png img').waitFor();
  const rp=await sheet().locator('.st-png img').evaluate(async im=>{await im.decode();return {w:im.naturalWidth,h:im.naturalHeight};});assert.ok(rp.w>=640&&rp.h>=400,JSON.stringify(rp));
  const [dl2]=await Promise.all([page.waitForEvent('download'),sheet().locator('.st-dl').click()]);
  fs.writeFileSync(path.join(outdir,'export-relation.png'),fs.readFileSync(await dl2.path()));report.screenshots.push('export-relation.png');await closeSheet();
  await settle();await page.reload();await ready();await page.waitForFunction(()=>OCStudio.S.tab==='relation');
  assert.equal(await page.locator('#rlEdges .rl-edge').count(),3);
  assert.ok((await page.locator('#rlEdges').textContent()).includes('幼なじみ'));
  const p0c=await S(()=>OCStudio.tabs.relation.debug().chart.nodes[0]);assert.ok(Number.isFinite(p0c.x));
  ok('relation chart: drag placement, tap-tap linking, three parallel relations (direction/style/color/label) without label overlap, label tap edit, pan/zoom/fit, rename propagates, multiple charts, PNG, reload');

  /* ---- 世界観 ---- */
  await tab('world');
  assert.equal(await page.locator('#wdStart .wd-tpl').count(),5);
  await page.locator('#wdStart [data-tpl="fantasy"]').click();await toast('ファンタジーの項目');
  assert.equal(await page.locator('#wdStart .wd-tpl').count(),0);
  assert.equal(await page.locator('#wdBody [data-o="genre"]').inputValue(),'ファンタジー');
  const org=page.locator('#wdBody details.st-sec:has(> summary:text("組織")) .wd-entry').first();
  await org.locator('> summary').click();
  await org.locator('[data-k="title"]').fill('アルメリア王家');await org.locator('[data-k="body"]').fill('千年続く王の血筋。');
  await org.locator('[data-link]').filter({hasText:'改名 次郎'}).click();await org.locator('[data-link]').filter({hasText:'白紙 花子'}).click();
  assert.equal(await org.locator('.wd-mem').textContent(),'2人');
  // 歴史（年代つき）・用語集（読みつき）・独自カテゴリ
  const hist=page.locator('#wdBody details.st-sec:has(> summary:text("歴史"))');
  await hist.locator('.wd-entry').first().locator('> summary').click();await hist.locator('.wd-entry').first().locator('[data-k="when"]').fill('王暦312年');
  const glo=page.locator('#wdBody details.st-sec:has(> summary:text("用語集"))');
  await glo.locator('> summary').click();await glo.locator('[data-w="addentry"]').click();
  await glo.locator('[data-k="title"]').fill('星詠み');await glo.locator('[data-k="reading"]').fill('ほしよみ');await glo.locator('[data-k="body"]').fill('星の動きから未来を読む術。');
  await page.locator('#wdAddSec').click();await sheet().locator('input.st-input').fill('料理');await sheet().locator('[data-r="1"]').click();
  assert.equal(await page.locator('#wdBody details.st-sec > summary').filter({hasText:'料理'}).count(),1);
  // テンプレートの追記は既存の記述を壊さない
  await page.locator('#wdTpl').click();await sheet().locator('[data-tpl="scifi"]').click();
  assert.equal(await S(()=>OCStudio.S.project.world.sections.find(s=>s.key==='organization').entries[0].body),'千年続く王の血筋。');
  await page.locator('#wdSearch').fill('ほしよみ');assert.equal(await page.locator('#wdBody .wd-entry').count(),1);await page.locator('#wdSearch').fill('');
  await page.locator('#wdCopy').click();
  await page.waitForFunction(async()=>{const t=await navigator.clipboard.readText();return t.includes('【組織】')&&t.includes('アルメリア王家')&&t.includes('関連キャラ：改名 次郎、白紙 花子')&&t.includes('王暦312年');});
  await shot('world-desktop.png',{fullPage:true});
  await settle();
  // 連携：図鑑側にも所属が出る／図鑑側から外せる
  await S(()=>OCStudio.tabs.zukan.openChar(OCStudio.S.chars.find(c=>c.name==='白紙 花子').id));
  await sheet().locator('details:has(#zkAff) > summary').click();
  const chip=sheet().locator('#zkAff [data-aff]').filter({hasText:'アルメリア王家'});
  assert.equal(await chip.getAttribute('aria-pressed'),'true');await chip.click();await closeSheet();await settle();
  assert.equal(await S(()=>OCStudio.S.chars.find(c=>c.name==='白紙 花子').affiliations.length),0);
  await page.waitForFunction(()=>{const m=document.querySelector('#wdBody .wd-mem');return m&&m.textContent==='1人';});
  ok('world: template start, overview, entries with kind/date/reading, custom category, non-destructive template merge, search, text export, two-way character links');

  /* ---- 削除の影響確認 ---- */
  await tab('zukan');
  await page.locator('#zkGrid .zk-card').filter({hasText:'改名 次郎'}).click();await sheet().locator('[data-a="delete"]').click();
  const msg=await sheet().locator('.st-msg').innerText();
  assert.ok(msg.includes('身長比較から外れます')&&msg.includes('相関図「相関図1」「相関図1（コピー）」')&&msg.includes('関係線6本')&&msg.includes('画像'),msg);
  await sheet().locator('[data-r="0"]').click();assert.equal(await S(()=>OCStudio.S.chars.length),5);
  await sheet().locator('[data-a="delete"]').click();await sheet().locator('[data-r="1"]').click();await toast('削除しました');
  const after=await S(()=>{const s=OCStudio.S,p=s.project;return {chars:s.chars.length,hc:p.heightCompare.items.length,nodes:p.charts.map(c=>c.nodes.length),edges:p.charts.map(c=>c.edges.length)};});
  assert.deepEqual(after,{chars:4,hc:3,nodes:[4,4],edges:[0,0]});
  // 画像は複製キャラが共有しているので残る
  await settle();assert.equal(await S(async()=>{const d=await new Promise(r=>{const q=indexedDB.open('ocMakerStudioV2');q.onsuccess=()=>r(q.result);});return new Promise(r=>{const q=d.transaction('images').objectStore('images').count();q.onsuccess=()=>r(q.result);});}),2);
  ok('deleting a character lists the affected views, can be cancelled, and cascades; shared image kept');

  /* ---- 作品管理・バックアップ・復元 ---- */
  await page.locator('#projectMenuBtn').click();
  const [dl3]=await Promise.all([page.waitForEvent('download'),sheet().locator('[data-a="export"]').click()]);
  const backupPath=path.join(outdir,'backup.json');fs.copyFileSync(await dl3.path(),backupPath);
  const backup=JSON.parse(fs.readFileSync(backupPath,'utf8'));
  assert.equal(backup.format,'creative-oc-maker-project');assert.equal(backup.characters.length,4);assert.equal(backup.images.length,2);
  assert.equal(require('./js/studio/core.js').validateBundle(backup),'');
  await sheet().locator('[data-a="rename"]').click();await sheet().locator('input.st-input').fill('星の王国');await sheet().locator('[data-r="1"]').click();
  assert.equal(await page.locator('#projectSelect option:checked').textContent(),'星の王国');
  await sheet().locator('[data-a="new"]').click();await sheet().locator('input.st-input').fill('第二作');await sheet().locator('#newPrjTpl').selectOption('modern');await sheet().locator('[data-r="1"]').click();
  await page.waitForFunction(()=>OCStudio.S.project.name==='第二作');
  assert.equal(await page.locator('#zkGrid .zk-card').count(),0);
  assert.equal(await S(()=>OCStudio.S.project.world.overview.genre),'現代');
  // 作品を切り替えるとキャラも切り替わる
  await page.locator('#projectSelect').selectOption({label:'星の王国'});await page.waitForFunction(()=>OCStudio.S.chars.length===4);
  await page.locator('#projectSelect').selectOption({label:'第二作'});await page.waitForFunction(()=>OCStudio.S.chars.length===0);
  // 復元：新しい作品として取り込まれ、既存の作品は変わらない
  await page.locator('#projectMenuBtn').click();await sheet().locator('#projectImportFile').setInputFiles(backupPath);
  await toast('を復元しました');
  const restored=await S(()=>{const s=OCStudio.S,p=s.project;return {name:p.name,count:s.projects.length,chars:s.chars.map(c=>c.name).sort(),hc:p.heightCompare.items.length,bg:p.heightCompare.bg,charts:p.charts.length,nodes:p.charts[0].nodes.length,org:p.world.sections.find(x=>x.key==='organization').entries[0].title,
   linked:s.chars.filter(c=>c.affiliations.length).length,img:s.chars.filter(c=>c.variants.some(v=>v.imageId)).length};});
  assert.deepEqual(restored,{name:'マイ作品',count:3,chars:backup.characters.map(c=>c.name).sort(),hc:3,bg:'#2D2A33',charts:2,nodes:4,org:'アルメリア王家',linked:0,img:1});
  await page.waitForSelector('#zkGrid .zk-card .zk-thumb.has img');
  await tab('height');await page.waitForFunction(()=>{const l=OCStudio.tabs.height.layout();return l&&l.rows.length===3&&l.rows.some(r=>r.img&&r.pl);});
  // 壊れたファイルは拒否し、何も増えない
  await page.locator('#projectMenuBtn').click();
  await sheet().locator('#projectImportFile').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"format":"other"}')});await toast('バックアップではありません');
  await sheet().locator('#projectImportFile').setInputFiles({name:'bad2.json',mimeType:'application/json',buffer:Buffer.from('not json')});await toast('JSONとして読み取れません');
  assert.equal(await S(()=>OCStudio.S.projects.length),3);
  // 複製と削除
  await sheet().locator('[data-a="dup"]').click();await page.waitForFunction(()=>OCStudio.S.projects.length===4&&OCStudio.S.project.name==='マイ作品（コピー）');
  assert.equal(await S(()=>OCStudio.S.chars.length),4);
  await page.locator('#projectMenuBtn').click();await sheet().locator('[data-a="delete"]').click();await sheet().locator('[data-r="1"]').click();await toast('作品を削除しました');
  assert.equal(await S(()=>OCStudio.S.projects.length),3);
  await settle();await page.reload();await ready();
  assert.deepEqual(await S(()=>OCStudio.S.projects.map(p=>p.name)),['星の王国','第二作','マイ作品']);
  assert.equal(await S(()=>localStorage.getItem('ocMakerSavedV1')),JSON.stringify(legacy));
  ok('projects: backup with images, rename, new with template, switch, restore as a new project, corrupt files refused, duplicate, delete; legacy key still untouched');

  /* ---- 名前辞典ページの共通ナビ・ページ間の移動・戻る ---- */
  const dictData=require('./data/dictionary-v1.7.json');
  await page.goto(origin);await ready();
  await page.locator('#projectSelect').selectOption({label:'第二作'});await page.waitForFunction(()=>OCStudio.S.project.name==='第二作');
  const navShape=()=>page.evaluate(()=>[...document.querySelectorAll('#studioNav *')].filter(e=>e.tagName!=='OPTION').map(e=>[e.tagName,e.id,e.getAttribute('data-tab')||'',e.getAttribute('role')||'',e.getAttribute('aria-label')||'',e.id==='saveStatus'?'':String(e.getAttribute('class')||'')].join('|')).concat([...document.querySelectorAll('#studioTabs button')].map(b=>b.textContent)));
  const navIndex=await navShape();assert.ok(navIndex.length>=15);
  await page.locator('.site-nav a').filter({hasText:'名前辞典'}).click();
  await page.waitForURL('**/dictionary.html');await ready();
  await page.waitForFunction(n=>document.getElementById('count').textContent.includes(String(n)),dictData.entries.length);
  assert.equal(await page.title(),'名前辞典 | 創作OCメーカー v2.2');
  assert.deepEqual(await navShape(),navIndex,'both pages render the same shared navigation');
  assert.equal(await page.locator('#projectSelect option:checked').textContent(),'第二作');
  assert.equal(await page.locator('#projectSelect option').count(),3);
  assert.deepEqual(await page.locator('#studioTabs [role="tab"]').evaluateAll(b=>b.map(x=>x.getAttribute('aria-selected'))),['true','false','false','false','false']);
  assert.equal(await page.locator('.site-nav a[aria-current="page"]').textContent(),'名前辞典');
  await page.waitForFunction(()=>document.getElementById('saveStatus').textContent==='保存済み');
  // 辞典の検索・絞り込み・お気に入りは従来どおり
  await page.locator('#search').fill('あとり');await page.waitForFunction(()=>document.querySelectorAll('#results .dictionary-card').length>=1&&document.querySelectorAll('#results .dictionary-card').length<20);
  const favBtn=page.locator('#results .dictionary-card').first().getByRole('button',{name:'☆ お気に入り',exact:true});
  await favBtn.click();await page.locator('#favoritesOnly').check();
  await page.waitForFunction(()=>document.querySelectorAll('#results .dictionary-card').length===1);
  await page.locator('#clear').click();await page.waitForFunction(n=>document.getElementById('count').textContent.includes(String(n)),dictData.entries.length);
  await shot('dictionary-desktop.png');
  // 「作成」は選択済みなので押しても移動しない。矢印キーはフォーカスだけ動かす
  await page.locator('#studioTabs [data-tab="create"]').click();assert.ok(page.url().endsWith('/dictionary.html'));
  await page.locator('#studioTabs [data-tab="create"]').focus();await page.keyboard.press('ArrowRight');
  assert.equal(await page.evaluate(()=>document.activeElement.dataset.tab),'zukan');assert.ok(page.url().endsWith('/dictionary.html'));
  // 辞典で作品を切り替え → 図鑑タブへ直接移動 → その作品の図鑑が開く
  await page.locator('#projectSelect').selectOption({label:'マイ作品'});await page.waitForFunction(()=>OCStudio.S.project.name==='マイ作品'&&OCStudio.S.chars.length===4);
  await page.keyboard.press('Tab');
  await page.locator('#studioTabs [data-tab="zukan"]').click();
  await page.waitForURL('**/index.html#zukan');await ready();
  await page.waitForSelector('#tab-zukan:not([hidden])');assert.equal(await page.locator('#tab-create').isVisible(),false);
  assert.equal(await page.locator('#projectSelect option:checked').textContent(),'マイ作品');
  assert.equal(await page.locator('#zkGrid .zk-card').count(),4);
  // 戻る → 辞典（作品の選択は維持）→ 進む → 図鑑
  await page.goBack();await page.waitForURL('**/dictionary.html');await ready();
  await page.waitForFunction(()=>OCStudio.S.project&&OCStudio.S.project.name==='マイ作品');
  await page.waitForFunction(n=>document.getElementById('count').textContent.includes(String(n)),dictData.entries.length);
  await page.goForward();await page.waitForURL('**/index.html#zukan');await ready();await page.waitForSelector('#tab-zukan:not([hidden])');
  await page.goBack();await page.waitForURL('**/dictionary.html');await ready();
  for(const [k,sel] of [['height','#hcCanvas'],['relation','#rlCanvas'],['world','#wdBody']]){
   await page.locator('#studioTabs [data-tab="'+k+'"]').click();await page.waitForURL('**/index.html#'+k);await ready();
   await page.waitForSelector('#tab-'+k+':not([hidden]) '+sel);
   assert.equal(await page.locator('#studioTabs [data-tab="'+k+'"]').getAttribute('aria-selected'),'true');
   await page.goBack();await page.waitForURL('**/dictionary.html');await ready();
  }
  // 辞典ページの歯車からも作品管理ができる（名前変更）。戻った先のページにも反映される
  await page.locator('#projectMenuBtn').click();await sheet().locator('[data-a="rename"]').click();
  await sheet().locator('input.st-input').fill('マイ作品・改');await sheet().locator('[data-r="1"]').click();await toast('名前を変更しました');
  await sheet().locator('.st-x').click();await settle();
  await page.locator('.site-nav a').filter({hasText:'ガチャ'}).click();await page.waitForURL('**/index.html');await ready();
  assert.ok(await page.locator('#tab-create').isVisible());
  assert.equal(await page.locator('#projectSelect option:checked').textContent(),'マイ作品・改');
  // bfcacheからの復元（pageshow persisted）：別ページで変えた作品の選択に追従する
  await page.evaluate(()=>{const other=OCStudio.S.projects.find(p=>p.name==='星の王国');localStorage.setItem('ocMakerStudioCurrentV2',other.id);window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));});
  await page.waitForFunction(()=>OCStudio.S.project.name==='星の王国'&&document.querySelector('#projectSelect option:checked').textContent==='星の王国');
  await page.locator('#projectSelect').selectOption({label:'マイ作品・改'});await page.waitForFunction(()=>OCStudio.S.chars.length===4);await settle();
  ok('dictionary page: same shared nav markup, 作成 selected + 名前辞典 current, project selection carried both ways, direct jump to all four tabs, back/forward, project management from the dictionary, bfcache resync; dictionary search/favorites/clear unchanged');

  /* ---- スマホ幅・タッチ ---- */
  const mobile=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,hasTouch:true,isMobile:true,storageState:await context.storageState({indexedDB:true})});
  const m=await mobile.newPage();m.on('pageerror',e=>report.consoleErrors.push('mobile: '+e.message));
  await m.goto(origin+'/#zukan');await m.waitForSelector('html[data-studio="ready"]');
  await m.locator('#projectSelect').selectOption({label:'マイ作品・改'});await m.waitForFunction(()=>OCStudio.S.chars.length===4);
  const noOverflow=async label=>assert.ok(await m.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),label+' overflows');
  const mtab=async k=>{await m.locator('#studioTabs [data-tab="'+k+'"]').tap();await m.waitForSelector('#tab-'+k+':not([hidden])');};
  for(const w of [390,320]){
   await m.setViewportSize({width:w,height:w===390?844:568});
   for(const k of ['create','zukan','height','relation','world']){
    await mtab(k);if(k==='height')await m.evaluate(()=>OCStudio.tabs.height.redraw());
    await m.waitForTimeout(150);await noOverflow(k+'@'+w);
    assert.ok(await m.evaluate(()=>[...document.querySelectorAll('#studioTabs button')].every(b=>b.getBoundingClientRect().height>=44)));
    if(w===390){await m.screenshot({path:path.join(outdir,'mobile-'+k+'.png')});report.screenshots.push('mobile-'+k+'.png');}
   }
  }
  await m.setViewportSize({width:390,height:844});
  // タッチで相関図：タップ2回で線、ドラッグで移動
  await mtab('relation');await m.locator('.rl-zoom [data-z="fit"]').tap();
  const mpos=i=>m.evaluate(i=>{const d=OCStudio.tabs.relation.debug(),n=d.chart.nodes[i],v=d.chart.view,r=document.getElementById('rlCanvas').getBoundingClientRect();return {x:r.left+n.x*v.k+v.x,y:r.top+n.y*v.k+v.y};},i);
  await m.evaluate(()=>document.getElementById('rlStage').scrollIntoView({block:'center'}));
  await m.locator('.st-seg [data-mode="link"]').tap();
  let t0=await mpos(0),t1=await mpos(1);
  await m.touchscreen.tap(t0.x,t0.y);await m.touchscreen.tap(t1.x,t1.y);
  await m.locator('.st-sheet [data-type="family"]').tap();await m.screenshot({path:path.join(outdir,'mobile-relation-edit.png')});report.screenshots.push('mobile-relation-edit.png');
  await m.locator('.st-sheet [data-e="save"]').tap();
  assert.equal(await m.evaluate(()=>OCStudio.tabs.relation.debug().chart.edges.length),1);
  await m.locator('.st-seg [data-mode="move"]').tap();
  const cdp=await mobile.newCDPSession(m);t0=await mpos(2);
  const touch=(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y,id:1}]});
  // 合成したドラッグの直後はヘッドレスChromiumが次の1タップをクリックにしない（アプリ無関係の素のページでも再現）。空タップで解消する。
  const drag=async(x0,y0,x1,y1,n)=>{await touch('touchStart',x0,y0);for(let i=1;i<=n;i++)await touch('touchMove',x0+(x1-x0)*i/n,y0+(y1-y0)*i/n);await touch('touchEnd');await m.touchscreen.tap(3,3);};
  await drag(t0.x,t0.y,t0.x+50,t0.y+40,5);
  const t0b=await mpos(2);assert.ok(Math.abs(t0b.x-t0.x-50)<4&&Math.abs(t0b.y-t0.y-40)<4,JSON.stringify([t0,t0b]));
  await m.screenshot({path:path.join(outdir,'mobile-relation-linked.png')});report.screenshots.push('mobile-relation-linked.png');
  // タッチで頭頂・足元の線
  await mtab('zukan');await m.locator('#zkGrid .zk-card').filter({has:m.locator('.zk-thumb.has')}).first().tap();
  await m.locator('.st-sheet [data-v="calib"]').first().tap();
  const ms=await m.locator('.cal-stage').boundingBox(),mh=await m.locator('.cal-line.head').boundingBox();
  await drag(mh.x+mh.width/2,mh.y,mh.x+mh.width/2,ms.y+ms.height*0.3,4);
  assert.ok(Math.abs(Number(await m.locator('.cal-line.head').getAttribute('aria-valuenow'))-30)<=2);
  await m.screenshot({path:path.join(outdir,'mobile-calibrator.png')});report.screenshots.push('mobile-calibrator.png');
  await m.locator('.st-sheet').last().locator('.st-x').tap();
  await m.screenshot({path:path.join(outdir,'mobile-zukan-detail.png')});report.screenshots.push('mobile-zukan-detail.png');
  assert.ok(await m.evaluate(()=>[...document.querySelectorAll('.st-sheet input[type=text],.st-sheet textarea,.st-sheet select')].every(e=>parseFloat(getComputedStyle(e).fontSize)>=16)),'inputs must be >=16px to avoid iOS zoom');
  await m.locator('.st-sheet .st-x').tap();
  // スマホ幅の名前辞典：共通ナビつきで横はみ出しなし、タップで図鑑へ移動して戻る
  for(const w of [390,320]){
   await m.setViewportSize({width:w,height:w===390?844:568});await m.goto(origin+'/dictionary.html');await m.waitForSelector('html[data-studio="ready"]');
   await m.waitForFunction(()=>/\d/.test(document.getElementById('count').textContent));await noOverflow('dictionary@'+w);
   assert.ok(await m.evaluate(()=>[...document.querySelectorAll('#studioTabs button')].every(b=>{const r=b.getBoundingClientRect();return r.height>=44&&b.scrollWidth<=b.clientWidth;})));
   assert.equal(await m.locator('#projectSelect option:checked').textContent(),'マイ作品・改');
   if(w===390){await m.screenshot({path:path.join(outdir,'mobile-dictionary.png')});report.screenshots.push('mobile-dictionary.png');}
  }
  await m.locator('#studioTabs [data-tab="relation"]').tap();await m.waitForURL('**/index.html#relation');await m.waitForSelector('#tab-relation:not([hidden]) #rlCanvas');
  await m.goBack();await m.waitForURL('**/dictionary.html');await m.waitForSelector('html[data-studio="ready"]');
  await m.locator('#projectMenuBtn').tap();await m.screenshot({path:path.join(outdir,'mobile-dictionary-menu.png')});report.screenshots.push('mobile-dictionary-menu.png');
  await m.locator('.st-sheet .st-x').tap();
  await mobile.close();
  ok('mobile 390px and 320px: no horizontal overflow on any tab or on the dictionary page, 44px tabs, touch tap-linking, touch drag of nodes and head/foot markers, 16px inputs');

  /* ---- 保存できない環境でも既存機能は動く ---- */
  const broken=await browser.newContext({viewport:{width:390,height:844}});const bp=await broken.newPage();const berr=[];bp.on('pageerror',e=>berr.push(e.message));
  await bp.addInitScript(()=>{Object.defineProperty(window,'indexedDB',{get(){throw new Error('denied');}});});
  await bp.goto(origin);await bp.waitForSelector('html[data-studio="ready"]');
  assert.ok(await bp.locator('#studioNotice').isVisible());
  await bp.locator('#btnGen1').click();assert.equal(await bp.locator('#results .card').count(),1);
  await bp.locator('#results [data-act="zukan"]').click();await bp.waitForFunction(()=>OCStudio.S.chars.length===1);
  await bp.locator('#studioTabs [data-tab="zukan"]').click();assert.equal(await bp.locator('#zkGrid .zk-card').count(),1);
  assert.deepEqual(berr,[]);await broken.close();
  ok('without IndexedDB: warning shown, generator and in-memory encyclopedia still work');

  assert.deepEqual(report.consoleErrors,[]);
  report.passed=true;
 }catch(e){report.error=e.stack||String(e);process.exitCode=1;}
 finally{
  if(browser)await browser.close();server.close();
  fs.writeFileSync(path.join(outdir,'report.json'),JSON.stringify(report,null,1));
  console.log(report.passed?'PASS '+report.checks.length+' groups':'FAIL after '+report.checks.length+' groups\n'+report.error);
  report.checks.forEach(c=>console.log(' - '+c));
  if(report.consoleErrors.length)console.log('console errors: '+JSON.stringify(report.consoleErrors));
 }
})();
