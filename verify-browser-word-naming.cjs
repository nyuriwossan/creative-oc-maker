'use strict';
// Run: node verify-browser-word-naming.cjs [outdir] — 名前辞典「言葉から名付け」モードの実ブラウザ検証
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const repo=__dirname,outdir=process.argv[2]||path.join(repo,'reports/v2.1/word-naming-browser');fs.mkdirSync(outdir,{recursive:true});
const report={passed:false,checks:[],consoleErrors:[],screenshots:[]};
const dict=require('./data/dictionary-v1.7.json'),words=require('./data/word-naming-v1.json');
(async()=>{
 const server=require('./tests/static-server.cjs')(repo);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port;let browser;const ok=m=>report.checks.push(m);
 try{
  browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
  const context=await browser.newContext({viewport:{width:1100,height:900},acceptDownloads:true,permissions:['clipboard-read','clipboard-write']});
  const page=await context.newPage();
  page.on('pageerror',e=>report.consoleErrors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))report.consoleErrors.push(m.text());});
  const ready=()=>page.waitForSelector('html[data-studio="ready"]');
  const sheet=()=>page.locator('.st-sheet').last();
  const toast=t=>page.waitForFunction(x=>document.getElementById('toast')&&document.getElementById('toast').textContent.includes(x),t);
  const count=n=>page.waitForFunction(n=>document.getElementById('wnCount').textContent==='全20語 ／ 表示'+n+'語',n);
  const settle=()=>page.evaluate(()=>OCStudio.flush());
  const shot=async(p,name,opts)=>{await p.screenshot({path:path.join(outdir,name),...(opts||{})});report.screenshots.push(name);};
  const cardOf=id=>page.locator('#wnResults [data-id="'+id+'"]');

  /* ---- 既存の辞典はそのまま、モードを切り替えられる ---- */
  await page.goto(origin+'/dictionary.html');await ready();
  await page.waitForFunction(n=>document.getElementById('count').textContent.startsWith('全'+n+'候補'),dict.entries.length);
  assert.equal(await page.title(),'名前辞典 | 創作OCメーカー v2.1');assert.equal(await page.locator('.eyebrow').textContent(),'創作OCメーカー v2.1');
  assert.equal(await page.locator('#modeFindBtn').getAttribute('aria-selected'),'true');
  assert.equal(await page.locator('#modeWords').isVisible(),false);
  assert.deepEqual(await page.locator('#studioTabs [role="tab"]').allTextContents(),['作成','図鑑','身長比較','相関図','世界観']);
  await page.locator('#search').fill('あとり');await page.waitForFunction(()=>{const n=document.querySelectorAll('#results .dictionary-card').length;return n>=1&&n<20;});
  await page.locator('#results .dictionary-card').first().getByRole('button',{name:'☆ お気に入り',exact:true}).click();
  const dictFav=await page.evaluate(()=>localStorage.getItem(OCDictionary.favoriteKey));assert.equal(JSON.parse(dictFav).ids.length,1);
  await page.locator('#clear').click();
  await page.locator('#modeWordsBtn').click();
  assert.ok(page.url().endsWith('/dictionary.html#words'));
  assert.equal(await page.locator('#modeFind').isVisible(),false);await count(20);
  assert.ok((await page.locator('#wnNotice').textContent()).includes('第1段階')&&(await page.locator('#wnNotice').textContent()).includes('造語'));
  assert.equal(await page.locator('#wnResults .wn-card').count(),words.words.length);
  assert.equal(await page.locator('#wnCategories button:disabled').count(),9);
  await page.locator('#modeWordsBtn').focus();await page.keyboard.press('ArrowLeft');assert.ok(await page.locator('#modeFind').isVisible());
  assert.equal(await page.locator('#results .dictionary-card').count(),36);
  await page.keyboard.press('ArrowRight');assert.ok(await page.locator('#modeWords').isVisible());
  ok('dictionary untouched (675, search, favorites); two modes switch by click/keys and keep the 5 tabs; planned categories disabled');

  /* ---- 原語と創作名の表示区分・出典 ---- */
  const fr=cardOf('WN-FR-0002'),w=words.words.find(x=>x.id==='WN-FR-0002');
  assert.equal(await fr.locator('h2').textContent(),'accord');assert.equal(await fr.locator('h2').getAttribute('lang'),'fr');
  assert.equal(await fr.locator('.wn-origin h3').textContent(),'原語（辞書で確認した実在語）');
  assert.equal(await fr.locator('.wn-made h3').textContent(),'創作名の候補（造語）');
  const originText=await fr.locator('.wn-origin').innerText(),madeText=await fr.locator('.wn-made').innerText();
  assert.ok(originText.includes(w.meaningJa)&&originText.includes('確認済み（2026-11-17）')&&originText.includes('[akɔr]'));
  for(const c of w.candidates){assert.ok(madeText.includes(c.name));assert.ok(!originText.replace('カタカナ読み（発音記号からの近似）\n'+w.kana.text,'').includes(c.name)||c.name===w.kana.text,'coined name leaked into the source block: '+c.name);}
  assert.ok(madeText.includes('原語に実在する人名・単語ではありません'));assert.ok(!madeText.includes('確認済み'));
  const link=fr.locator('.wn-origin a');
  assert.equal(await link.getAttribute('href'),w.source.url);assert.equal(await link.getAttribute('target'),'_blank');assert.equal(await link.getAttribute('rel'),'noopener noreferrer');
  assert.equal(await link.textContent(),'Larousse で確認する');
  const de=await cardOf('WN-DE-0004').locator('.wn-origin').innerText();
  assert.ok(de.includes('発音\n未確認')&&de.includes('カタカナ読み（目安・発音は未確認）'),de);
  for(const x of words.words){const href=await cardOf(x.id).locator('.wn-origin a').getAttribute('href');assert.equal(new URL(href).hostname,words.languages[x.lang].host);}
  await shot(page,'words-desktop.png');
  ok('each card separates the verified source word from coined names; source links go to the right dictionary; unconfirmed pronunciation is labelled');

  /* ---- 検索・絞り込み・お気に入り ---- */
  await page.locator('#wnLangs [data-value="fr"]').click();await count(4);
  await page.locator('#wnLangs [data-value="pt"]').click();await count(8);
  await page.locator('#wnCategories [data-value="recognize"]').click();await count(4);
  await page.locator('#wnClear').click();await count(20);
  await page.locator('#wnSearch').fill('賛成');await page.waitForFunction(()=>document.getElementById('wnTheme').textContent.includes('「肯定・同意」に結びつけて'));
  assert.ok(await page.locator('#wnResults .wn-card').count()>=10);
  await page.locator('#wnSearch').fill('りんご');await count(0);
  assert.ok((await page.locator('#wnTheme').textContent()).includes('翻訳して探す機能ではありません'));
  await page.locator('#wnSearch').fill('あこーる');await count(1);
  await page.locator('#wnClear').click();
  await page.locator('#wnFilters details > summary').click();
  await page.locator('#wnLengths [data-value="long"]').click();await page.locator('#wnImpressions [data-value="noble"]').click();
  const n=await page.locator('#wnResults .wn-card').count();assert.ok(n>0&&n<20);
  assert.ok(await page.locator('#wnResults .wn-cand.dim').count()>0);assert.ok(await page.locator('#wnResults .wn-cand:not(.dim)').count()>=n);
  await page.locator('#wnNuances [data-value="formal"]').click();
  assert.ok((await page.locator('#wnResults .wn-card').count())<n);
  await page.locator('#wnClear').click();await count(20);
  await cardOf('WN-IT-0002').getByRole('button',{name:'☆ お気に入り',exact:true}).click();
  await page.locator('#wnFavoritesOnly').check();await count(1);
  await page.reload();await ready();await count(20);
  assert.ok(await page.locator('#modeWords').isVisible(),'mode survives reload via #words');
  assert.equal(await cardOf('WN-IT-0002').getByRole('button',{name:'★ お気に入り解除',exact:true}).count(),1);
  assert.equal(await page.evaluate(()=>localStorage.getItem(OCDictionary.favoriteKey)),dictFav,'dictionary favorites must be untouched');
  assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem(OCWordNaming.FAVORITE_KEY))),{version:1,ids:['WN-IT-0002']});
  ok('language multi-select, category, free-text theme mapping, no fake translation, nuance, length/impression, favorites under a separate key');

  /* ---- 創作名を作る・編集・保存 ---- */
  await fr.locator('[data-cand="WN-FR-0002-a"]').click();
  assert.equal(await sheet().locator('#wnName').inputValue(),'アコール');assert.equal(await sheet().locator('#wnMethod').inputValue(),'kana');
  assert.ok((await sheet().locator('.wn-src').innerText()).includes('原語の意味：'+w.meaningJa));
  assert.ok((await sheet().locator('#wnLen').textContent()).startsWith('4音・ふつう'));
  await sheet().locator('#wnName').fill('アコリエ');assert.equal(await sheet().locator('#wnMethod').inputValue(),'free');
  await sheet().locator('#wnName').fill('アコール');assert.equal(await sheet().locator('#wnMethod').inputValue(),'kana');
  await sheet().locator('#wnName').fill('アコリエ');await sheet().locator('#wnIntent').fill('争いを収める調停役の少女に。');
  await shot(page,'editor-desktop.png');
  await sheet().locator('[data-e="save"]').click();await toast('名前候補に保存しました');
  assert.equal(await page.locator('.st-sheet').count(),0);
  const saved=await page.evaluate(()=>OCStudio.S.project.nameIdeas[0]);
  assert.deepEqual([saved.name,saved.wordId,saved.candidateId,saved.baseName,saved.method,saved.edited,saved.intent,saved.source.lemma,saved.source.url],
   ['アコリエ','WN-FR-0002','WN-FR-0002-a','アコール','free',true,'争いを収める調停役の少女に。','accord',w.source.url]);
  const ideaText=await page.locator('#wnIdeas .wn-idea').first().innerText();
  assert.ok(ideaText.includes('原語の意味\n'+w.meaningJa)&&ideaText.includes('創作上の意図\n争いを収める調停役の少女に。')&&ideaText.includes('候補「アコール」から編集'),ideaText);
  assert.ok((await page.locator('#wnIdeasTitle').textContent()).includes('「マイ作品」の名前候補（1件）'));
  // 自分で作る：名前が空のうちは保存できない。HTMLとして解釈されない
  await cardOf('WN-DE-0001').locator('[data-act="own"]').click();
  assert.ok(await sheet().locator('[data-e="save"]').isDisabled());
  await sheet().locator('#wnName').fill('<img src=x onerror="window.pwned=1">');await sheet().locator('#wnIntent').fill('<b>太字</b>');
  await sheet().locator('[data-e="save"]').click();
  await page.waitForFunction(()=>document.querySelectorAll('#wnIdeas .wn-idea').length===2);
  assert.equal(await page.evaluate(()=>window.pwned),undefined);assert.equal(await page.locator('#wnIdeas img, #wnIdeas b').count(),0);
  // 保存した候補を再編集
  await page.locator('#wnIdeas .wn-idea').filter({hasText:'アコリエ'}).locator('[data-i="edit"]').click();
  assert.equal(await sheet().locator('#wnName').inputValue(),'アコリエ');await sheet().locator('#wnIntent').fill('調停役。姉の名は別に考える。');
  await sheet().locator('[data-e="save"]').click();
  await page.waitForFunction(()=>OCStudio.S.project.nameIdeas.length===2&&OCStudio.S.project.nameIdeas[0].intent==='調停役。姉の名は別に考える。');
  // コピー
  await page.locator('#wnIdeas .wn-idea').filter({hasText:'アコリエ'}).locator('[data-i="copy"]').click();
  await page.waitForFunction(async()=>{const t=await navigator.clipboard.readText();return t.includes('創作名：アコリエ')&&t.includes('原語の意味：')&&t.includes('創作上の意図：調停役')&&t.includes('実在する人名・単語であることを示しません');});
  await settle();
  ok('pick or write a name, method follows edits, save with source word + intent, re-edit, copy; user text never parsed as HTML');

  /* ---- 世界観の用語集へ ---- */
  await page.locator('#wnIdeas .wn-idea').filter({hasText:'アコリエ'}).locator('[data-i="glossary"]').click();await toast('用語集に追加しました');
  const gloss=await page.evaluate(()=>OCStudio.S.project.world.sections.find(s=>s.key==='glossary').entries.map(e=>[e.title,e.kind,e.body]));
  assert.equal(gloss.length,1);assert.equal(gloss[0][0],'アコリエ');assert.equal(gloss[0][1],'固有名詞');assert.ok(gloss[0][2].includes('原語の意味：'+w.meaningJa));
  await page.locator('#wnIdeas .wn-idea').filter({hasText:'アコリエ'}).locator('[data-i="glossary"]').click();await toast('同じ名前の項目があります');
  assert.equal(await page.evaluate(()=>OCStudio.S.project.world.sections.find(s=>s.key==='glossary').entries.length),1);
  await settle();
  ok('send to the world glossary once, with the source meaning kept');

  /* ---- 作品ごとの保存・バックアップ・復元・既存作品への影響 ---- */
  await page.locator('#projectMenuBtn').click();
  const [dl]=await Promise.all([page.waitForEvent('download'),sheet().locator('[data-a="export"]').click()]);
  const backupPath=path.join(outdir,'backup.json');fs.copyFileSync(await dl.path(),backupPath);
  const backup=JSON.parse(fs.readFileSync(backupPath,'utf8'));
  assert.equal(backup.project.nameIdeas.length,2);assert.equal(backup.project.nameIdeas[0].wordId,'WN-FR-0002');
  await sheet().locator('[data-a="new"]').click();await sheet().locator('input.st-input').fill('別の作品');await sheet().locator('[data-r="1"]').click();
  await page.waitForFunction(()=>OCStudio.S.project.name==='別の作品');
  await page.waitForFunction(()=>document.getElementById('wnIdeasTitle').textContent.includes('「別の作品」の名前候補（0件）'));
  assert.equal(await page.locator('#wnIdeas .wn-idea').count(),0);
  await page.locator('#projectMenuBtn').click();await sheet().locator('#projectImportFile').setInputFiles(backupPath);await toast('を復元しました');
  await page.waitForFunction(()=>document.getElementById('wnIdeasTitle').textContent.includes('の名前候補（2件）'));
  assert.deepEqual(await page.evaluate(()=>OCStudio.S.project.nameIdeas.map(i=>[i.name,i.wordId,i.intent]).sort()),backup.project.nameIdeas.map(i=>[i.name,i.wordId,i.intent]).sort());
  fs.unlinkSync(backupPath);
  // v2.0で作られた作品（nameIdeas を持たない）を開いても壊れず、保存できる
  await settle();
  await page.evaluate(async()=>{
   const db=await new Promise(r=>{const q=indexedDB.open('ocMakerStudioV2');q.onsuccess=()=>r(q.result);});
   const old={id:'prj_old_v20',name:'v2.0の作品',createdAt:1,updatedAt:1,world:OCStudio.C.defaultWorld('fantasy'),heightCompare:{items:[],bg:'#F7F5F0',showScale:true,showNames:true},charts:[]};
   await new Promise(r=>{const t=db.transaction('projects','readwrite');t.objectStore('projects').put(old);t.oncomplete=r;});
   localStorage.setItem('ocMakerStudioCurrentV2','prj_old_v20');
  });
  await page.reload();await ready();await count(20);
  assert.equal(await page.locator('#projectSelect option:checked').textContent(),'v2.0の作品');
  assert.deepEqual(await page.evaluate(()=>OCStudio.S.project.nameIdeas),[]);
  assert.equal(await page.evaluate(()=>OCStudio.S.project.world.sections.find(s=>s.key==='geography').entries.length),2);
  await cardOf('WN-IT-0003').locator('[data-cand="WN-IT-0003-b"]').click();await sheet().locator('[data-e="save"]').click();await toast('名前候補に保存しました');
  await settle();await page.reload();await ready();
  await page.waitForFunction(()=>document.querySelectorAll('#wnIdeas .wn-idea').length===1);
  assert.equal(await page.evaluate(()=>OCStudio.S.project.nameIdeas[0].method),'short');
  await page.locator('#wnIdeas [data-i="delete"]').click();await sheet().locator('[data-r="1"]').click();await toast('削除しました');
  assert.equal(await page.locator('#wnIdeas .wn-idea').count(),0);
  ok('ideas are stored per project, included in backup/restore, isolated between projects; a v2.0 project without the field opens and saves normally');

  /* ---- キャラ作成に送る → 図鑑に由来が残る → 戻る ---- */
  await page.locator('#projectSelect').selectOption({label:'マイ作品'});await page.waitForFunction(()=>OCStudio.S.project.nameIdeas.length===2);
  await page.locator('#wnIdeas .wn-idea').filter({hasText:'アコリエ'}).locator('[data-i="create"]').click();
  await page.waitForURL(u=>u.pathname.endsWith('/index.html'));await ready();
  assert.equal(await page.locator('#nameInput').inputValue(),'アコリエ');assert.equal(new URL(page.url()).search,'');
  await toast('名前「アコリエ」を入力欄に入れました');
  assert.ok(await page.locator('#nameInput').isVisible());
  await page.locator('#btnGen1').click();await page.waitForSelector('#results .card');
  assert.ok((await page.locator('#results .card').first().innerText()).includes('アコリエ'));
  await page.locator('#results [data-act="zukan"]').click();await page.waitForFunction(()=>OCStudio.S.chars.length===1);
  const ch=await page.evaluate(()=>({name:OCStudio.S.chars[0].name,note:OCStudio.S.chars[0].profile.nameNote}));
  assert.equal(ch.name,'アコリエ');assert.ok(ch.note.includes('もとにした言葉：accord（フランス語')&&ch.note.includes('原語の意味：'+w.meaningJa)&&ch.note.includes('創作上の意図：調停役'),ch.note);
  await page.goBack();await page.waitForURL('**/dictionary.html#words');await ready();await count(20);
  assert.ok(await page.locator('#modeWords').isVisible());
  // 候補から直接（保存せずに）送った場合も由来が残る
  await cardOf('WN-EN-0002').locator('[data-cand="WN-EN-0002-a"]').click();await sheet().locator('[data-e="create"]').click();
  await page.waitForURL(u=>u.pathname.endsWith('/index.html'));await ready();
  assert.equal(await page.locator('#nameInput').inputValue(),'アセント');
  await page.locator('#btnGen1').click();await page.locator('#results [data-act="zukan"]').first().click();await page.waitForFunction(()=>OCStudio.S.chars.length===2);
  assert.ok((await page.evaluate(()=>OCStudio.S.chars[1].profile.nameNote)).includes('もとにした言葉：assent（英語'));
  ok('send to character creation fills the fixed-name field, the generated card uses it, and the encyclopedia keeps the name origin; back returns to the words mode');

  /* ---- 読み込み失敗時：辞典は動き、再読み込みで復帰 ---- */
  const p2=await context.newPage();let fail=true;const e2=[];p2.on('pageerror',e=>e2.push(e.message));
  await p2.route('**/data/word-naming-v1.json',r=>fail?r.abort():r.continue());
  await p2.goto(origin+'/dictionary.html#words');await p2.waitForSelector('html[data-studio="ready"]');
  await p2.waitForSelector('#wnLoadError:not([hidden])');assert.ok(await p2.locator('#wnSearch').isDisabled());
  await p2.locator('#modeFindBtn').click();await p2.waitForFunction(n=>document.getElementById('count').textContent.startsWith('全'+n+'候補'),dict.entries.length);
  await p2.locator('#modeWordsBtn').click();await p2.waitForSelector('#wnLoadError:not([hidden])');
  fail=false;await p2.locator('#wnRetry').click();
  await p2.waitForFunction(()=>document.getElementById('wnCount').textContent==='全20語 ／ 表示20語');assert.deepEqual(e2,[]);await p2.close();
  ok('if the word data fails to load, the dictionary keeps working and retry recovers');

  /* ---- iPhone相当の画面 ---- */
  const mobile=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,hasTouch:true,isMobile:true,storageState:await context.storageState({indexedDB:true})});
  const m=await mobile.newPage();m.on('pageerror',e=>report.consoleErrors.push('mobile: '+e.message));
  const noOverflow=async label=>assert.ok(await m.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),label+' overflows');
  for(const wd of [390,320]){
   await m.setViewportSize({width:wd,height:wd===390?844:568});await m.goto(origin+'/dictionary.html#words');await m.waitForSelector('html[data-studio="ready"]');
   await m.waitForFunction(()=>document.getElementById('wnCount').textContent==='全20語 ／ 表示20語');await noOverflow('words@'+wd);
   assert.ok(await m.evaluate(()=>[...document.querySelectorAll('#wnModes button,#wnLangs button,.wn-cand,.wn-made .actions button')].every(b=>b.getBoundingClientRect().height>=44)));
   assert.ok(await m.evaluate(()=>[...document.querySelectorAll('#wnModes button')].every(b=>b.scrollWidth<=b.clientWidth)));
   if(wd===390){await shot(m,'mobile-words-top.png');await m.locator('[data-id="WN-FR-0004"]').scrollIntoViewIfNeeded();await shot(m,'mobile-words-card.png');}
  }
  await m.locator('[data-id="WN-FR-0001"] [data-cand="WN-FR-0001-b"]').tap();
  await m.waitForSelector('.st-sheet #wnName');await noOverflow('editor@320');
  assert.ok(await m.evaluate(()=>[...document.querySelectorAll('.st-sheet input,.st-sheet textarea,.st-sheet select')].every(e=>parseFloat(getComputedStyle(e).fontSize)>=16)));
  assert.ok(await m.evaluate(()=>[...document.querySelectorAll('.st-sheet .st-actions button')].every(b=>b.getBoundingClientRect().height>=44)));
  await m.setViewportSize({width:390,height:844});await shot(m,'mobile-editor.png');
  await m.locator('.st-sheet [data-e="save"]').tap();
  await m.waitForFunction(()=>document.querySelectorAll('#wnIdeas .wn-idea').length===3);
  await m.locator('#wnIdeas').scrollIntoViewIfNeeded();await noOverflow('ideas@390');await shot(m,'mobile-ideas.png');
  await m.locator('#modeFindBtn').scrollIntoViewIfNeeded();await m.locator('#modeFindBtn').tap();
  await m.waitForFunction(n=>document.getElementById('count').textContent.startsWith('全'+n+'候補'),dict.entries.length);await noOverflow('find@390');
  await mobile.close();
  ok('iPhone-sized screens (390/320): no horizontal overflow, 44px targets, 16px inputs, touch select-edit-save');

  assert.deepEqual(report.consoleErrors,[]);report.passed=true;
 }catch(e){report.error=e.stack||String(e);process.exitCode=1;}
 finally{
  if(browser)await browser.close();server.close();
  fs.writeFileSync(path.join(outdir,'report.json'),JSON.stringify(report,null,1));
  console.log(report.passed?'PASS '+report.checks.length+' groups':'FAIL after '+report.checks.length+' groups\n'+report.error);
  report.checks.forEach(c=>console.log(' - '+c));
  if(report.consoleErrors.length)console.log('console errors: '+JSON.stringify(report.consoleErrors));
 }
})();
