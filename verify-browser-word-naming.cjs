'use strict';
// Run: node verify-browser-word-naming.cjs [outdir] — 名前辞典「言葉から名付け」（v2.2）の実ブラウザ検証
// v2.1 の検証項目（辞典への非干渉・原語と創作名の区分・保存・バックアップ・キャラ作成への送信・iPhone幅）を引き継ぎ、
// 11カテゴリ・逆引き検索・命名コレクション・複数キャラ命名・世界観連携を加えた。
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const repo=__dirname,outdir=process.argv[2]||path.join(repo,'reports/v2.2/word-naming-browser');fs.mkdirSync(outdir,{recursive:true});
const report={passed:false,checks:[],consoleErrors:[],screenshots:[]};
const dict=require('./data/dictionary-v1.7.json'),words=require('./data/word-naming-v2.json');
const TOTAL=words.words.length,PAGE=24;
const inCat=(...cats)=>words.words.filter(w=>cats.some(c=>w.categories.includes(c)));
(async()=>{
 const server=require('./tests/static-server.cjs')(repo);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port;let browser;const ok=m=>report.checks.push(m);
 try{
  browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
  const context=await browser.newContext({viewport:{width:1100,height:900},acceptDownloads:true,permissions:['clipboard-read','clipboard-write']});
  const page=await context.newPage();
  const watch=(p,label)=>{
   p.on('pageerror',e=>report.consoleErrors.push(label+'pageerror @'+p.url()+': '+e.message));
   p.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))report.consoleErrors.push(label+'console @'+p.url()+': '+m.text());});
  };
  watch(page,'');
  const ready=()=>page.waitForSelector('html[data-studio="ready"]');
  const sheet=()=>page.locator('.st-sheet').last();
  const toast=t=>page.waitForFunction(x=>document.getElementById('toast')&&document.getElementById('toast').textContent.includes(x),t);
  const count=n=>page.waitForFunction(([n,t,pg])=>document.getElementById('wnCount').textContent==='全'+t+'語 ／ 該当'+n+'語'+(n>pg?'（'+pg+'語を表示中）':''),[n,TOTAL,PAGE]);
  const settle=()=>page.evaluate(()=>OCStudio.flush());
  const shot=async(p,name,opts)=>{await p.screenshot({path:path.join(outdir,name),...(opts||{})});report.screenshots.push(name);};
  const cardOf=id=>page.locator('#wnResults [data-id="'+id+'"]');
  const sub=async name=>{await page.locator('#wnTab-'+name).click();await page.waitForSelector('#wnPane-'+name+':not([hidden])');};
  const find=async q=>{await page.locator('#wnSearch').fill(q);};
  const ideaCard=name=>page.locator('#wnIdeas .wn-idea').filter({has:page.locator('h3',{hasText:new RegExp('^'+name+'$')})});
  const colCard=name=>page.locator('#wnCollections .wn-col').filter({has:page.locator('h3',{hasText:new RegExp('^'+name+'$')})});

  /* ---- 既存の辞典はそのまま。2モード＋3機能 ---- */
  await page.goto(origin+'/dictionary.html');await ready();
  await page.waitForFunction(n=>document.getElementById('count').textContent.startsWith('全'+n+'候補'),dict.entries.length);
  assert.equal(await page.title(),'名前辞典 | 創作OCメーカー v2.2');assert.equal(await page.locator('.eyebrow').textContent(),'創作OCメーカー v2.2');
  assert.equal(await page.locator('#modeFindBtn').getAttribute('aria-selected'),'true');assert.equal(await page.locator('#modeWords').isVisible(),false);
  assert.deepEqual(await page.locator('#studioTabs [role="tab"]').allTextContents(),['作成','図鑑','身長比較','相関図','世界観']);
  assert.deepEqual(await page.locator('#wnModes [role="tab"]').allTextContents(),['名前を探す','言葉から名付け']);
  await page.locator('#search').fill('あとり');await page.waitForFunction(()=>{const n=document.querySelectorAll('#results .dictionary-card').length;return n>=1&&n<20;});
  await page.locator('#results .dictionary-card').first().getByRole('button',{name:'☆ お気に入り',exact:true}).click();
  const dictFav=await page.evaluate(()=>localStorage.getItem(OCDictionary.favoriteKey));assert.equal(JSON.parse(dictFav).ids.length,1);
  await page.locator('#clear').click();
  await page.locator('#modeWordsBtn').click();assert.ok(page.url().endsWith('/dictionary.html#words'));
  assert.equal(await page.locator('#modeFind').isVisible(),false);await count(TOTAL);
  assert.deepEqual(await page.locator('#wnSubtabs [role="tab"]').allTextContents(),['言葉を探す','命名コレクション','複数キャラ命名']);
  assert.ok(await page.locator('#wnPane-find').isVisible());assert.equal(await page.locator('#wnPane-collections').isVisible(),false);assert.equal(await page.locator('#wnPane-batch').isVisible(),false);
  // 最初の画面は検索欄とカテゴリだけ。細かい絞り込みは折りたたみの中
  assert.equal(await page.locator('#wnMoreFilters').getAttribute('open'),null);assert.equal(await page.locator('#wnLangs').isVisible(),false);assert.equal(await page.locator('#wnCatModeBox').isVisible(),false);
  assert.deepEqual(await page.locator('#wnCategories button').allTextContents(),words.categories.map(c=>c.label));assert.equal(await page.locator('#wnCategories button:disabled').count(),0);
  assert.equal(await page.locator('#wnResults .wn-card').count(),PAGE);
  const notice=await page.locator('#wnNotice').textContent();
  assert.ok(notice.includes('11カテゴリ・'+TOTAL+'語')&&notice.includes('重複は確認していません')&&notice.includes('検索結果に表示されたページ抜粋'),notice);
  await page.locator('#modeWordsBtn').focus();await page.keyboard.press('ArrowLeft');assert.ok(await page.locator('#modeFind').isVisible());
  assert.equal(await page.locator('#results .dictionary-card').count(),36);
  await page.keyboard.press('ArrowRight');assert.ok(await page.locator('#modeWords').isVisible());
  await page.locator('#wnTab-find').focus();await page.keyboard.press('ArrowRight');assert.ok(await page.locator('#wnPane-collections').isVisible());assert.ok(page.url().endsWith('#words/collections'));
  await page.keyboard.press('ArrowRight');assert.ok(await page.locator('#wnPane-batch').isVisible());await page.keyboard.press('ArrowRight');assert.ok(await page.locator('#wnPane-find').isVisible());assert.ok(page.url().endsWith('#words'));
  ok('dictionary untouched (675, search, favorites); 2 modes kept, 3 functions inside “言葉から名付け” switch by click/keys; first screen shows only search + 11 enabled categories');

  /* ---- 原語と創作名の表示区分・出典・確認範囲・重なりの表記 ---- */
  await find('accord');await count(2);
  const fr=cardOf('WN-FR-0002'),w=words.words.find(x=>x.id==='WN-FR-0002');
  assert.equal(await fr.locator('h2').textContent(),'accord');assert.equal(await fr.locator('h2').getAttribute('lang'),'fr');
  assert.equal(await fr.locator('.wn-origin h3').textContent(),'原語（辞書で確認した実在語）');assert.equal(await fr.locator('.wn-made h3').textContent(),'創作名の候補');
  await fr.locator('.wn-detail summary').click();
  const originText=await fr.locator('.wn-origin').innerText(),madeText=await fr.locator('.wn-made').innerText();
  assert.ok(originText.includes(w.meaningJa)&&originText.includes('確認済み（2026-11-17）')&&originText.includes('[akɔr]')&&originText.includes('直接開いての全文確認ではない'),originText);
  for(const c of w.candidates){assert.ok(madeText.includes(c.name));assert.ok(!originText.replace('カタカナ読み（発音記号からの近似）\n'+w.kana.text,'').includes(c.name)||c.name===w.kana.text,'coined name leaked into the source block: '+c.name);}
  assert.ok(madeText.includes('創作向けに加工した候補です。実在する人名・単語との重複は未確認です。'));
  assert.ok(!madeText.includes('実在する人名・単語ではありません')&&!madeText.includes('造語であり'),'the old absolute claim must be gone');assert.ok(!madeText.includes('確認済み'));
  assert.ok((await fr.locator('[data-cand="WN-FR-0002-a"] .wn-overlap').textContent())==='実在の人名・単語との重なり：未確認');
  assert.equal(await fr.locator('[data-cand="WN-FR-0002-b"] .wn-overlap').textContent(),'実在の人名・単語との重なり：外来語「コール」と同じ表記（ほかの重複は未確認）');
  const link=fr.locator('.wn-origin a');
  assert.equal(await link.getAttribute('href'),w.source.url);assert.equal(await link.getAttribute('target'),'_blank');assert.equal(await link.getAttribute('rel'),'noopener noreferrer');assert.equal(await link.textContent(),'Larousse で確認する');
  await find('Barmherzigkeit');await count(1);await cardOf('WN-DE-0029').locator('.wn-detail summary').click();
  const de=await cardOf('WN-DE-0029').locator('.wn-origin').innerText();
  assert.ok(de.includes('発音\n未確認')&&de.includes('カタカナ読み（目安・発音は未確認）')&&!/\[[^\]]*ˈ/.test(de),de);
  await shot(page,'words-desktop.png');
  // 全語：出典リンクがその言語の辞書を指す（ページングをたどって全件を確認）
  await page.locator('#wnClear').click();await count(TOTAL);
  while(await page.locator('#wnMore').isVisible())await page.locator('#wnMore').click();
  assert.equal(await page.locator('#wnResults .wn-card').count(),TOTAL);
  const hosts=await page.evaluate(()=>[...document.querySelectorAll('#wnResults .wn-card')].map(c=>[c.dataset.id,new URL(c.querySelector('.wn-origin a').href).hostname]));
  for(const [id,host] of hosts)assert.equal(host,words.languages[words.words.find(x=>x.id===id).lang].host,id);
  assert.equal(await page.locator('#wnCount').textContent(),'全'+TOTAL+'語 ／ 該当'+TOTAL+'語');
  ok('each card separates the verified source word from coined names; says how far it was verified; known overlaps are noted and everything else is “未確認”; all '+TOTAL+' source links go to the right dictionary (paged list)');

  /* ---- 逆引き検索：テーマ語・複数カテゴリ（OR/AND）・複数言語・ニュアンス・長さ・印象・検索場所・0件の案内 ---- */
  await page.locator('#wnClear').click();await count(TOTAL);assert.equal(await page.locator('#wnResults .wn-card').count(),PAGE);
  await find('優しさ');await page.waitForFunction(()=>document.getElementById('wnTheme').textContent.includes('「慈愛・優しさ」に結びつけて'));
  assert.ok(await page.locator('#wnResults .wn-card').count()>=20);
  await find('');await page.locator('#wnCategories [data-value="hope"]').click();await count(inCat('hope').length);
  assert.equal(await page.locator('#wnCatModeBox').isVisible(),false);
  await page.locator('#wnCategories [data-value="trust"]').click();await count(inCat('hope','trust').length);
  assert.ok(await page.locator('#wnCatModeBox').isVisible(),'OR/AND appears once two categories are chosen');
  await page.locator('input[name="wnCatMode"][value="and"]').check();await count(2);
  assert.deepEqual((await page.locator('#wnResults .wn-card h2').allTextContents()).sort(),['Zuversicht','fiducia']);
  await page.locator('#wnMoreFilters > summary').click();
  await page.locator('#wnLangs [data-value="it"]').click();await count(1);
  await page.locator('#wnLangs [data-value="de"]').click();await count(2);
  await page.locator('input[name="wnCatMode"][value="or"]').check();
  await count(words.words.filter(x=>['it','de'].includes(x.lang)&&(x.categories.includes('hope')||x.categories.includes('trust'))).length);
  await page.locator('#wnClear').click();await count(TOTAL);assert.equal(await page.locator('#wnCatModeBox').isVisible(),false);
  await page.locator('#wnLengths [data-value="long"]').click();await page.locator('#wnImpressions [data-value="elegant"]').click();
  const n=await page.locator('#wnResults .wn-card').count();assert.ok(n>0);
  assert.ok(await page.locator('#wnResults .wn-cand.dim').count()>0);assert.ok(await page.locator('#wnResults .wn-cand:not(.dim)').count()>=n);
  await page.locator('#wnNuances [data-value="religious"]').click();
  const withRel=await page.evaluate(()=>+/該当(\d+)語/.exec(document.getElementById('wnCount').textContent)[1]);
  assert.equal(withRel,words.words.filter(x=>x.nuances.includes('religious')&&x.candidates.some(c=>c.impressions.includes('elegant')&&c.name.replace(/[ャュョァィゥェォ]/g,'').length>=6)).length);
  await page.locator('#wnClear').click();await count(TOTAL);
  // 原語と創作名の個別検索
  await find('リベラ');await page.locator('#wnScope').selectOption('name');await count(2);
  assert.equal(await page.locator('#wnResults .wn-cand:not(.dim)').count(),4);
  await find('希望');await count(0);
  await page.locator('#wnSuggest [data-relax="scope"]').click();await count(inCat('hope').length);assert.equal(await page.locator('#wnScope').inputValue(),'all');
  await page.locator('#wnScope').selectOption('lemma');await find('ウィエル');await count(0);
  await page.locator('#wnScope').selectOption('all');await count(1);
  // 0件：翻訳しない。近いテーマと条件緩和を案内する
  await find('りんご');await count(0);
  let sg=await page.locator('#wnSuggest').innerText();
  assert.ok(sg.includes('条件に合う言葉がありません。')&&sg.includes('翻訳して探す機能ではありません')&&sg.includes('検索語を消す（'+TOTAL+'語）'),sg);
  assert.equal(await page.locator('#wnResults .wn-card').count(),0);assert.equal(await page.locator('#wnSuggest [data-theme]').count(),0);
  await find('望郷');await count(0);
  assert.deepEqual(await page.locator('#wnSuggest [data-theme]').allTextContents(),['希望・未来']);
  await page.locator('#wnSuggest [data-theme="hope"]').click();await count(inCat('hope').length);
  assert.equal(await page.locator('#wnSearch').inputValue(),'');assert.equal(await page.locator('#wnCategories [data-value="hope"]').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('#wnSuggest').isVisible(),false);
  await page.locator('#wnCategories [data-value="affirm"]').click();await page.locator('input[name="wnCatMode"][value="and"]').check();await count(0);
  await page.locator('#wnSuggest [data-relax="categoryMode"]').click();await count(inCat('hope','affirm').length);
  await page.locator('#wnSuggest').waitFor({state:'hidden'});
  await page.locator('#wnClear').click();await count(TOTAL);
  // お気に入り（辞典とは別キー）
  await find('assenso');await count(1);
  await cardOf('WN-IT-0002').getByRole('button',{name:'☆ お気に入り',exact:true}).click();
  await find('');await page.locator('#wnFavoritesOnly').check();await count(1);
  await page.reload();await ready();await count(TOTAL);
  assert.ok(await page.locator('#modeWords').isVisible(),'mode survives reload via #words');
  await find('assenso');await count(1);assert.equal(await cardOf('WN-IT-0002').getByRole('button',{name:'★ お気に入り解除',exact:true}).count(),1);
  assert.equal(await page.evaluate(()=>localStorage.getItem(OCDictionary.favoriteKey)),dictFav,'dictionary favorites must be untouched');
  assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem(OCWordNaming.FAVORITE_KEY))),{version:1,ids:['WN-IT-0002']});
  ok('reverse lookup: theme word → category, multi-category OR/AND, multi-language, nuance, length × impression, source-only / name-only search; zero results offer near themes and relaxations without pretending to translate; favorites under a separate key');

  /* ---- 創作名を作る・編集・保存（コレクションへ同時に入れる） ---- */
  await find('accord');await count(2);
  await fr.locator('[data-cand="WN-FR-0002-a"]').click();
  assert.equal(await sheet().locator('#wnName').inputValue(),'アコール');assert.equal(await sheet().locator('#wnMethod').inputValue(),'kana');
  assert.ok((await sheet().locator('.wn-src').innerText()).includes('原語の意味：'+w.meaningJa));
  assert.ok((await sheet().locator('#wnLen').textContent()).startsWith('4音・ふつう'));
  assert.ok((await sheet().locator('#wnOverlap').textContent()).startsWith('実在の人名・単語との重なり：未確認。創作向けに加工した名前です。'));
  await sheet().locator('#wnName').fill('アコリエ');assert.equal(await sheet().locator('#wnMethod').inputValue(),'free');
  await sheet().locator('#wnName').fill('アコール');assert.equal(await sheet().locator('#wnMethod').inputValue(),'kana');
  await sheet().locator('#wnIntent').fill('争いを収める兄。');
  assert.equal(await sheet().locator('#wnCollectionName').isVisible(),false);
  await sheet().locator('#wnCollection').selectOption('__new');await sheet().locator('#wnCollectionName').fill('全肯定する兄弟');
  await shot(page,'editor-desktop.png');
  await sheet().locator('[data-e="save"]').click();await toast('コレクション「全肯定する兄弟」に入れました');
  assert.equal(await page.locator('.st-sheet').count(),0);
  const saved=await page.evaluate(()=>OCStudio.S.project.nameIdeas[0]);
  assert.deepEqual([saved.name,saved.wordId,saved.candidateId,saved.baseName,saved.method,saved.edited,saved.intent,saved.overlap,saved.source.lemma,saved.source.url,saved.dataVersion],
   ['アコール','WN-FR-0002','WN-FR-0002-a','アコール','kana',false,'争いを収める兄。','','accord',w.source.url,'2.0.0']);
  assert.deepEqual(await page.evaluate(()=>OCStudio.S.project.nameCollections.map(c=>[c.name,c.items.length])),[['全肯定する兄弟',1]]);
  assert.ok((await page.locator('#wnIdeasLink').textContent()).includes('「マイ作品」に保存した名前候補：1件 ／ コレクション：1件'));
  // 自分で作る：ドイツ語 jawohl は未収録なので、ja から自由編集で作る。名前が空のうちは保存できない
  await find('ja');await cardOf('WN-DE-0001').locator('[data-act="own"]').click();
  assert.ok(await sheet().locator('[data-e="save"]').isDisabled());
  await sheet().locator('#wnName').fill('ヤヴォル');await sheet().locator('#wnIntent').fill('即答する弟。');
  assert.deepEqual(await sheet().locator('#wnCollection option').allTextContents(),['入れない','全肯定する兄弟','＋ 新しいコレクションを作る']);
  await sheet().locator('#wnCollection').selectOption({label:'全肯定する兄弟'});
  await sheet().locator('[data-e="save"]').click();await page.waitForFunction(()=>OCStudio.S.project.nameCollections[0].items.length===2);
  // HTMLとして解釈されない
  await cardOf('WN-DE-0001').locator('[data-act="own"]').click();
  await sheet().locator('#wnName').fill('<img src=x onerror="window.pwned=1">');await sheet().locator('#wnIntent').fill('<b>太字</b>');
  await sheet().locator('[data-e="save"]').click();await page.waitForFunction(()=>OCStudio.S.project.nameIdeas.length===3);
  // 既知の重なりがある候補
  await find('concorde');await cardOf('WN-FR-0010').locator('[data-cand="WN-FR-0010-a"]').click();
  assert.ok((await sheet().locator('#wnOverlap').textContent()).includes('超音速旅客機・パリの広場の名として有名（ほかの重複は未確認）'));
  await sheet().locator('[data-e="save"]').click();await page.waitForFunction(()=>OCStudio.S.project.nameIdeas.length===4);
  await sub('collections');
  assert.equal(await page.evaluate(()=>window.pwned),undefined);assert.equal(await page.locator('#wnIdeas img, #wnIdeas b').count(),0);
  assert.ok((await page.locator('#wnIdeasTitle').textContent()).includes('「マイ作品」の名前候補（4件）'));
  const ideaText=await ideaCard('アコール').innerText();
  assert.ok(ideaText.includes('原語の意味\n'+w.meaningJa)&&ideaText.includes('創作上の意図\n争いを収める兄。')&&ideaText.includes('実在の人名・単語との重なり\n未確認')&&ideaText.includes('コレクション\n全肯定する兄弟'),ideaText);
  assert.ok((await ideaCard('コンコルド').innerText()).includes('超音速旅客機'));
  // 保存した候補を再編集 → コピー
  await ideaCard('アコール').locator('[data-i="edit"]').click();
  assert.equal(await sheet().locator('#wnName').inputValue(),'アコール');assert.equal(await sheet().locator('#wnCollection').count(),0);
  await sheet().locator('#wnIntent').fill('争いを収める兄。弟は即答する。');await sheet().locator('[data-e="save"]').click();
  await page.waitForFunction(()=>OCStudio.S.project.nameIdeas.length===4&&OCStudio.S.project.nameIdeas[0].intent==='争いを収める兄。弟は即答する。');
  await ideaCard('アコール').locator('[data-i="copy"]').click();
  await page.waitForFunction(async()=>{const t=await navigator.clipboard.readText();return t.includes('創作名：アコール')&&t.includes('原語の意味：')&&t.includes('創作上の意図：争いを収める兄')&&t.includes('実在の人名・単語との重なり：未確認')&&t.includes('重複は確認していません')&&!t.includes('示しません');});
  await settle();
  ok('pick or write a name, method follows edits, save with source word + intent + (optional) collection, known overlap shown, re-edit, copy; user text never parsed as HTML');

  /* ---- 命名コレクション：作成・追加・並び替え・メモ・名前変更・コピー・書き出し・削除 ---- */
  assert.equal(await page.locator('#wnColTitle').textContent(),'命名コレクション（1件）');
  let col=colCard('全肯定する兄弟');
  assert.deepEqual(await col.locator('.wn-col-name strong').allTextContents(),['アコール','ヤヴォル']);
  assert.ok((await col.locator('li').first().innerText()).includes('：accord（フランス語）／'+w.meaningJa));
  assert.ok((await col.locator('li').nth(1).innerText()).includes('：ja（ドイツ語）／'),'languages are mixed in one collection');
  await col.locator('[data-c="add"]').click();
  assert.equal(await sheet().locator('.wn-checks input').count(),2);
  await sheet().locator('.wn-checks label',{hasText:'コンコルド'}).locator('input').check();await sheet().locator('[data-e="add"]').click();await toast('1件を追加しました');
  assert.deepEqual(await col.locator('.wn-col-name strong').allTextContents(),['アコール','ヤヴォル','コンコルド']);
  assert.ok(await col.locator('li').first().locator('[data-c="up"]').isDisabled());assert.ok(await col.locator('li').last().locator('[data-c="down"]').isDisabled());
  await col.locator('li').last().locator('[data-c="up"]').click();
  assert.deepEqual(await col.locator('.wn-col-name strong').allTextContents(),['アコール','コンコルド','ヤヴォル']);
  await col.locator('li').first().locator('[data-c="down"]').click();
  assert.deepEqual(await col.locator('.wn-col-name strong').allTextContents(),['コンコルド','アコール','ヤヴォル']);
  await col.locator('li').nth(1).locator('[data-c="up"]').click();
  await col.locator('li').nth(1).locator('[data-c="note"]').click();await sheet().locator('input.st-input').fill('末の妹（仮）');await sheet().locator('[data-r="1"]').click();
  await page.waitForFunction(()=>OCStudio.S.project.nameCollections[0].items[1].note==='末の妹（仮）');
  await col.locator('[data-c="edit"]').click();
  assert.equal(await sheet().locator('#wnColName').inputValue(),'全肯定する兄弟');
  await sheet().locator('#wnColName').fill('全肯定する三きょうだい');await sheet().locator('#wnColTheme').fill('肯定・同意と調和');await sheet().locator('#wnColMemo').fill('返事の言葉から取る。');
  await sheet().locator('[data-e="save"]').click();await toast('コレクションを保存しました');
  col=colCard('全肯定する三きょうだい');
  const colText=await col.innerText();assert.ok(colText.includes('共通テーマ\n肯定・同意と調和')&&colText.includes('メモ\n返事の言葉から取る。')&&colText.includes('メモ：末の妹（仮）'),colText);
  await shot(page,'collections-desktop.png');
  await col.locator('[data-c="copy"]').click();
  await page.waitForFunction(async()=>{const t=await navigator.clipboard.readText();return t.startsWith('コレクション：全肯定する三きょうだい\n共通テーマ：肯定・同意と調和\nメモ：返事の言葉から取る。\n（3件）')&&t.includes('1. アコール：accord（フランス語）／')&&t.includes('3. ヤヴォル：ja（ドイツ語）／')&&t.includes('   メモ：末の妹（仮）')&&t.includes('原語の意味で、創作名そのものの意味ではありません');});
  await page.evaluate(()=>{const o=OCStudio.download;window.__dl=[];OCStudio.download=(blob,name)=>{window.__dl.push([name,blob.type]);return o(blob,name);};});
  const [colDl]=await Promise.all([page.waitForEvent('download'),col.locator('[data-c="export"]').click()]);
  const [dlName,dlType]=(await page.evaluate(()=>window.__dl))[0];
  assert.match(dlName,/^naming-collection_全肯定する三きょうだい_\d{8}-\d{4}\.txt$/);assert.equal(dlType,'text/plain;charset=utf-8');
  const exported=fs.readFileSync(await colDl.path(),'utf8');
  assert.ok(exported.startsWith('コレクション：全肯定する三きょうだい\n')&&exported.includes('2. コンコルド：concorde（フランス語）／')&&exported.includes('   創作上の意図：即答する弟。'),exported);
  // 新規作成（空）→ 名前候補側から追加（同じ名前を複数のコレクションへ）→ 外す → 削除
  await page.locator('#wnColNew').click();assert.ok(await sheet().locator('[data-e="save"]').isDisabled());
  await sheet().locator('#wnColName').fill('仮置き');await sheet().locator('[data-e="save"]').click();await toast('コレクション「仮置き」を作りました');
  await ideaCard('アコール').locator('[data-i="collect"]').click();
  assert.deepEqual(await sheet().locator('#wnAddCol option').allTextContents(),['全肯定する三きょうだい（追加済み）','仮置き','＋ 新しいコレクションを作る']);
  await sheet().locator('#wnAddCol').selectOption({label:'仮置き'});await sheet().locator('[data-e="add"]').click();await toast('コレクション「仮置き」に追加しました');
  assert.ok((await ideaCard('アコール').innerText()).includes('コレクション\n全肯定する三きょうだい、仮置き'));
  await colCard('仮置き').locator('[data-c="remove"]').click();await toast('コレクションから外しました');
  assert.equal(await page.evaluate(()=>OCStudio.S.project.nameIdeas.length),4,'removing from a collection keeps the saved name');
  await colCard('仮置き').locator('[data-c="delete"]').click();await sheet().locator('[data-r="1"]').click();await toast('コレクションを削除しました');
  assert.equal(await page.locator('#wnCollections .wn-col').count(),1);assert.equal(await page.evaluate(()=>OCStudio.S.project.nameIdeas.length),4);
  // 名前候補の削除：コレクションからも外れることを確認画面で知らせる
  await ideaCard('<img src=x onerror="window.pwned=1">').locator('[data-i="delete"]').click();await sheet().locator('[data-r="1"]').click();await toast('削除しました');
  await ideaCard('コンコルド').locator('[data-i="delete"]').click();
  assert.ok((await sheet().locator('.st-msg').innerText()).includes('コレクション「全肯定する三きょうだい」からも外れます'));
  await sheet().locator('[data-r="0"]').click();assert.equal(await page.evaluate(()=>OCStudio.S.project.nameIdeas.length),3,'cancel keeps it');
  await settle();
  ok('collections: create (from the editor or empty), add several saved names, mixed languages, reorder, per-item memo, rename + theme + memo, copy, text export, remove item / delete collection without losing the saved names');

  /* ---- 世界観への連携：家名・国家・都市・組織・用語集。利用先ごとに名前と命名意図を持つ ---- */
  await ideaCard('アコール').locator('[data-i="use"]').click();
  assert.deepEqual(await sheet().locator('#wnUseKind option').allTextContents(),['キャラクター名','姓・家名','国家名','地域名','都市名','組織・派閥名','用語集（固有名詞）']);
  assert.equal(await sheet().locator('#wnUseKind').inputValue(),'family');assert.equal(await sheet().locator('#wnUseChar').isVisible(),false);
  assert.equal(await sheet().locator('#wnUseName').inputValue(),'アコール');assert.equal(await sheet().locator('#wnUseIntent').inputValue(),'争いを収める兄。弟は即答する。');
  await sheet().locator('#wnUseKind').selectOption('nation');assert.ok((await sheet().locator('#wnUseNote').textContent()).includes('世界観の「地理」に、種類「国家」の項目として追加します。語彙データは変更しません。'));
  await sheet().locator('#wnUseName').fill('アコール王国');await sheet().locator('#wnUseIntent').fill('建国の盟約（合意）にちなむ。');
  await sheet().locator('[data-e="send"]').click();await toast('世界観（地理）に「アコール王国」を追加しました');
  const useOnce=async(kind,name,intent)=>{
   await ideaCard('アコール').locator('[data-i="use"]').click();await sheet().locator('#wnUseKind').selectOption(kind);
   await sheet().locator('#wnUseName').fill(name);await sheet().locator('#wnUseIntent').fill(intent);await sheet().locator('[data-e="send"]').click();
  };
  await useOnce('family','アコール家','調停を家業とする一族。');await toast('世界観（組織）に「アコール家」を追加しました');
  await useOnce('city','アコール','');await toast('世界観（地理）に「アコール」を追加しました');
  await useOnce('organization','アコール同盟','');await toast('世界観（組織）に「アコール同盟」を追加しました');
  await useOnce('glossary','アコール','');await toast('世界観（用語集）に「アコール」を追加しました');
  await useOnce('nation','アコール王国','');await toast('「地理」に同じ名前の項目があります');
  await sheet().locator('.st-x').click();
  const world=await page.evaluate(()=>Object.fromEntries(OCStudio.S.project.world.sections.map(s=>[s.key,s.entries.map(e=>[e.title,e.kind,e.body])])));
  assert.deepEqual(world.geography.map(e=>e.slice(0,2)),[['アコール王国','国家'],['アコール','都市']]);
  assert.deepEqual(world.organization.map(e=>e.slice(0,2)),[['アコール家','家系'],['アコール同盟','派閥']]);
  assert.deepEqual(world.glossary.map(e=>e.slice(0,2)),[['アコール','固有名詞']]);
  assert.deepEqual(world.geography[0][2].split('\n').slice(0,5),['名前の由来（言葉から名付け）','もとにした創作名：アコール','もとにした言葉：accord（フランス語・名詞（男性））','原語の意味：'+w.meaningJa,'命名意図：建国の盟約（合意）にちなむ。']);
  assert.ok(world.organization[0][2].includes('命名意図：調停を家業とする一族。')&&!world.glossary[0][2].includes('命名意図'));
  const uses=await page.evaluate(()=>OCStudio.S.project.nameUses.map(u=>[u.kind,u.name,u.intent,u.targetType,u.ideaId===OCStudio.S.project.nameIdeas[0].id]));
  assert.deepEqual(uses,[['nation','アコール王国','建国の盟約（合意）にちなむ。','entry',true],['family','アコール家','調停を家業とする一族。','entry',true],['city','アコール','','entry',true],['organization','アコール同盟','','entry',true],['glossary','アコール','','entry',true]]);
  assert.deepEqual(await page.evaluate(()=>[OCStudio.S.project.nameIdeas[0].name,OCStudio.S.project.nameIdeas[0].intent]),['アコール','争いを収める兄。弟は即答する。'],'the saved name itself is not rewritten by its uses');
  assert.equal(JSON.stringify(await page.evaluate(()=>OCWordNamingPage.data().words.find(x=>x.id==='WN-FR-0002'))),JSON.stringify(w),'vocabulary untouched');
  assert.ok((await ideaCard('アコール').innerText()).includes('使っている場所\n国家名「アコール王国」（世界観・地理）、姓・家名「アコール家」（世界観・組織）、都市名「アコール」（世界観・地理）、組織・派閥名「アコール同盟」（世界観・組織）、用語集（固有名詞）「アコール」（世界観・用語集）'));
  // 編集画面から直接：保存して使い道へ
  await sub('find');await find('speranza');await count(1);
  await cardOf('WN-IT-0013').locator('[data-cand="WN-IT-0013-a"]').click();await sheet().locator('[data-e="use"]').click();
  await page.waitForSelector('.st-sheet #wnUseKind');await sheet().locator('#wnUseKind').selectOption('region');await sheet().locator('#wnUseName').fill('スペランツァ辺境領');
  await sheet().locator('[data-e="send"]').click();await toast('世界観（地理）に「スペランツァ辺境領」を追加しました');
  assert.equal(await page.evaluate(()=>OCStudio.S.project.nameIdeas.length),4);
  await settle();
  // 世界観タブで実際に表示される
  await page.goto(origin+'/index.html#world');await ready();await page.waitForSelector('#tab-world:not([hidden])');
  const secs=await page.evaluate(()=>[...document.querySelectorAll('#tab-world details.st-sec > summary')].map(x=>x.textContent));
  for(const t of ['地理3件','組織2件','用語集1件'])assert.ok(secs.includes(t),'world tab lists '+t+': '+secs);
  await page.locator('#tab-world details.st-sec > summary',{hasText:'地理'}).click();
  const geo=await page.evaluate(()=>[...document.querySelectorAll('#tab-world details.st-sec[open] .wd-entry > summary')].map(x=>x.textContent));
  for(const t of ['アコール王国','スペランツァ辺境領'])assert.ok(geo.some(x=>x.includes(t)),'world tab shows '+t+': '+geo);
  const worldExport=await page.evaluate(()=>OCStudio.C.worldToText(OCStudio.S.project.world,OCStudio.S.chars));
  for(const t of ['アコール王国','アコール家','アコール同盟','スペランツァ辺境領','命名意図：建国の盟約（合意）にちなむ。'])assert.ok(worldExport.includes(t),'world text export has '+t);
  await page.goto(origin+'/dictionary.html#words/collections');await ready();await page.waitForFunction(()=>document.querySelectorAll('#wnIdeas .wn-idea').length===4);
  ok('a saved name can be sent as family / nation / region / city / organization / glossary entry: each use keeps its own name and naming intent beside the source meaning, duplicates are refused, the saved name and the vocabulary stay unchanged, and the entries appear in the world tab');

  /* ---- 複数キャラ命名：選択・テーマ・割り当て・比較・重複警告・個別編集・確認してから反映 ---- */
  await sub('batch');
  assert.ok((await page.locator('#wnBatch').innerText()).includes('図鑑にキャラクターがいません'));
  await page.evaluate(async()=>{
   const A=OCStudio,C=A.C;
   for(const [name,reading] of [['長男（仮）','ちょうなん'],['次男（仮）',''],['',''],['リーデン','']]){const c=C.newCharacter(A.S.project.id,name);c.reading=reading;c.profile.nameNote=name==='長男（仮）'?'仮の名前。':'';await A.putChar(c);A.S.chars.push(c);}
   OCWordNamingPage.emit('ideas');
  });
  await page.waitForSelector('#wnBatchChars input');
  assert.deepEqual(await page.locator('#wnBatchChars label').allTextContents(),['長男（仮）','次男（仮）','（名前なし）','リーデン']);
  assert.equal(await page.locator('#wnBatchResult').isVisible(),false);
  await page.locator('#wnBatchAssign').click();assert.equal(await page.locator('#wnBatchMsg').textContent(),'キャラクターを1人以上選んでください。');
  for(const i of [0,1,2])await page.locator('#wnBatchChars input').nth(i).check();
  assert.ok((await page.locator('#wnBatch legend').first().textContent()).includes('（3人）'));
  await page.locator('#wnBatchTheme').fill('平和を願う三きょうだい');
  await page.locator('#wnBatchCats [data-value="harmony"]').click();await page.locator('#wnBatchLangs [data-value="de"]').click();
  await page.locator('#wnBatchAssign').click();await page.waitForSelector('#wnBatchTable .wn-brow[data-row]');
  const rowsOf=()=>page.evaluate(()=>[...document.querySelectorAll('#wnBatchTable .wn-brow[data-row]')].map(r=>({cur:r.children[0].textContent,name:r.querySelector('[data-b="name"]').value,lemma:r.children[2].textContent,mean:r.children[3].textContent,apply:r.querySelector('[data-b="apply"]').checked})));
  let rows=await rowsOf();
  assert.deepEqual(rows.map(r=>r.cur),['長男（仮）','次男（仮）','（名前なし）']);assert.ok(rows.every(r=>r.apply&&r.name));
  assert.equal(new Set(rows.map(r=>r.name)).size,3,'each character gets a different candidate');
  const deHarmony=words.words.filter(x=>x.lang==='de'&&x.categories.includes('harmony'));
  for(const r of rows){const src=deHarmony.find(x=>r.lemma===x.lemma+'（ドイツ語）');assert.ok(src,'candidate must come from the chosen theme: '+r.lemma);assert.equal(r.mean,src.meaningJa);assert.ok(src.candidates.some(c=>c.name===r.name));}
  assert.ok(!rows.some(r=>r.name==='リーデン'),'a name already used by a character that is not being renamed is avoided');
  assert.deepEqual(await page.locator('#wnBatchTable .wn-bhead span').allTextContents(),['キャラクター','新しい名前','原語','原語の意味','候補の変更']);
  const cols3=await page.evaluate(()=>{const r=document.querySelector('#wnBatchTable .wn-brow[data-row]');const xs=[...r.children].map(c=>Math.round(c.getBoundingClientRect().left));return new Set(xs).size;});
  assert.equal(cols3,5,'name / source word / meaning sit side by side on a wide screen');
  assert.equal(await page.locator('#wnBatchWarn').isVisible(),false);assert.equal(await page.locator('#wnBatchApply').textContent(),'確定して3人の名前を図鑑へ反映');
  // 別の候補へ／個別編集／重複警告
  const row=i=>page.locator('#wnBatchTable .wn-brow[data-row]').nth(i);
  const before1=rows[1].name;await row(1).locator('[data-b="next"]').click();rows=await rowsOf();
  assert.notEqual(rows[1].name,before1);assert.equal(new Set(rows.map(r=>r.name)).size,3,'cycling skips names used by the other rows');
  await row(1).locator('[data-b="prev"]').click();assert.equal((await rowsOf())[1].name,before1);
  await row(1).locator('[data-b="name"]').fill(rows[0].name);
  await page.waitForSelector('#wnBatchWarn:not([hidden])');
  assert.ok((await page.locator('#wnBatchWarn').innerText()).includes('「'+rows[0].name+'」が2人に割り当てられています。'));
  await row(1).locator('[data-b="name"]').fill('リーデン');
  assert.ok((await page.locator('#wnBatchWarn').innerText()).includes('「リーデン」は、この作品の別のキャラクターがすでに使っています。'));
  await row(1).locator('[data-b="name"]').fill('フリーデル');await page.locator('#wnBatchWarn').waitFor({state:'hidden'});
  await row(2).locator('[data-b="apply"]').uncheck();assert.equal(await page.locator('#wnBatchApply').textContent(),'確定して2人の名前を図鑑へ反映');
  rows=await rowsOf();await shot(page,'batch-desktop.png');
  // 確定 → 確認画面。やめれば何も変わらない
  const namesNow=()=>page.evaluate(()=>OCStudio.S.chars.map(c=>c.name));
  await page.locator('#wnBatchApply').click();
  const confirmText=await sheet().locator('.st-msg').innerText();
  assert.ok(confirmText.includes('次の2人の名前を、キャラ図鑑に反映します。')&&confirmText.includes('長男（仮） → '+rows[0].name)&&confirmText.includes('次男（仮） → フリーデル')&&!confirmText.includes('名前なし')&&confirmText.includes('読み・ローマ字は変更しません'),confirmText);
  assert.deepEqual(await namesNow(),['長男（仮）','次男（仮）','','リーデン'],'nothing changes before the explicit confirmation');
  await sheet().locator('[data-r="0"]').click();await toast('変更しませんでした');
  assert.deepEqual(await namesNow(),['長男（仮）','次男（仮）','','リーデン']);assert.equal(await page.evaluate(()=>OCStudio.S.project.nameIdeas.length),4);
  assert.equal(await page.locator('#wnBatchTable .wn-brow[data-row]').count(),3,'the comparison stays after cancelling');
  await page.locator('#wnBatchApply').click();await sheet().locator('[data-r="1"]').click();await toast('2人の名前を図鑑に反映しました');
  await settle();
  const after=await page.evaluate(()=>({chars:OCStudio.S.chars.map(c=>[c.name,c.reading,c.profile.nameNote]),ideas:OCStudio.S.project.nameIdeas.map(i=>[i.name,i.source.lang,i.edited,i.intent]),
   cols:OCStudio.S.project.nameCollections.map(c=>[c.name,c.theme,c.items.length]),uses:OCStudio.S.project.nameUses.filter(u=>u.kind==='character').map(u=>[u.name,u.intent,OCStudio.S.chars.findIndex(c=>c.id===u.targetId)])}));
  assert.deepEqual(after.chars.map(c=>c[0]),[rows[0].name,'フリーデル','','リーデン']);assert.equal(after.chars[0][1],'ちょうなん','reading is left alone');
  const note0=after.chars[0][2].split('\n');
  assert.equal(note0[0],'名前の由来（言葉から名付け）');assert.ok(note0.includes('命名意図：共通テーマ「平和を願う三きょうだい」')&&note0.includes('以前の名前：長男（仮）')&&note0.includes('（以前のメモ）')&&note0.includes('仮の名前。'),after.chars[0][2]);
  assert.ok(note0.some(l=>l.startsWith('原語の意味：'))&&note0.some(l=>l.startsWith('もとにした言葉：')&&l.includes('ドイツ語')));
  assert.ok(after.chars[1][2].includes('もとにした言葉：')&&after.chars[1][2].includes('以前の名前：次男（仮）'),after.chars[1][2]);
  assert.equal(await page.evaluate(()=>OCStudio.S.project.nameIdeas[5].baseName),before1,'an edited name remembers the candidate it came from');
  assert.equal(after.ideas.length,6);assert.deepEqual(after.ideas.slice(4),[[rows[0].name,'de',false,'共通テーマ「平和を願う三きょうだい」'],['フリーデル','de',true,'共通テーマ「平和を願う三きょうだい」']]);
  assert.deepEqual(after.cols,[['全肯定する三きょうだい','肯定・同意と調和',3],['平和を願う三きょうだい','平和を願う三きょうだい',2]]);
  assert.deepEqual(after.uses,[[rows[0].name,'共通テーマ「平和を願う三きょうだい」',0],['フリーデル','共通テーマ「平和を願う三きょうだい」',1]]);
  assert.equal(await page.locator('#wnBatchResult').isVisible(),false);assert.equal(await page.locator('#wnBatchChars input:checked').count(),0);
  assert.equal((await page.locator('#wnBatchChars label').allTextContents())[1],'フリーデル');
  // コレクションの名前を割り当てる（保存済みの名前と由来をそのまま使う）。足りないぶんは知らせる
  await page.locator('#wnBatchSource').selectOption('collection');await page.locator('#wnBatchCollection').selectOption({label:'全肯定する三きょうだい（3件）'});
  for(const i of [0,1,2,3])await page.locator('#wnBatchChars input').nth(i).check();
  await page.locator('#wnBatchAssign').click();await page.waitForSelector('#wnBatchTable .wn-brow[data-row]');
  rows=await rowsOf();
  assert.deepEqual(rows.map(r=>[r.name,r.apply]),[['アコール',true],['コンコルド',true],['ヤヴォル',true],['',false]]);
  assert.equal(await page.locator('#wnBatchMsg').textContent(),'1人ぶんの候補が足りません。テーマを広げるか、名前を直接入力してください。');
  assert.equal(await page.locator('#wnBatchSaveCol').isVisible(),false);
  await row(0).locator('[data-b="apply"]').uncheck();await row(1).locator('[data-b="apply"]').uncheck();
  await page.locator('#wnBatchApply').click();
  assert.ok((await sheet().locator('.st-msg').innerText()).includes('（名前なし） → ヤヴォル'));
  await sheet().locator('[data-r="1"]').click();await toast('1人の名前を図鑑に反映しました');await settle();
  const c3=await page.evaluate(()=>({name:OCStudio.S.chars[2].name,note:OCStudio.S.chars[2].profile.nameNote,ideas:OCStudio.S.project.nameIdeas.length,cols:OCStudio.S.project.nameCollections.length}));
  assert.equal(c3.name,'ヤヴォル');assert.ok(c3.note.includes('もとにした言葉：ja（ドイツ語')&&!c3.note.includes('以前の名前'),c3.note);assert.deepEqual([c3.ideas,c3.cols],[6,2],'names from a collection are reused, not duplicated');
  // 使い道の画面からも、登録済みキャラの名前は確認してから変える
  await sub('collections');await ideaCard('スペランツァ').locator('[data-i="use"]').click();
  await sheet().locator('#wnUseKind').selectOption('character');assert.ok(await sheet().locator('#wnUseChar').isVisible());
  await sheet().locator('#wnUseChar').selectOption({label:'登録済み：「リーデン」に付ける'});await sheet().locator('[data-e="send"]').click();
  assert.ok((await page.locator('.st-sheet').last().locator('.st-msg').innerText()).includes('リーデン → スペランツァ'));
  await page.locator('.st-sheet').last().locator('[data-r="0"]').click();assert.equal((await namesNow())[3],'リーデン');
  await sheet().locator('[data-e="send"]').click();await page.locator('.st-sheet').last().locator('[data-r="1"]').click();await toast('「スペランツァ」を図鑑に反映しました');
  assert.equal((await namesNow())[3],'スペランツァ');await settle();
  // 図鑑に反映されている
  await page.goto(origin+'/index.html#zukan');await ready();await page.waitForSelector('#tab-zukan:not([hidden])');
  const zukan=await page.locator('#tab-zukan').innerText();
  for(const t of [after.chars[0][0],'フリーデル','ヤヴォル','スペランツァ'])assert.ok(zukan.includes(t),'encyclopedia shows '+t);
  assert.ok(!zukan.includes('長男（仮）')&&!zukan.includes('次男（仮）'));
  await page.goto(origin+'/dictionary.html#words/batch');await ready();await page.waitForSelector('#wnBatchChars input');
  ok('batch naming: choose characters + a common theme, different candidates per character from that theme, side-by-side name / source / meaning, cycle and edit individually, duplicate warnings (within the batch and against other characters), nothing changes until the confirmation is accepted, then names + origin notes land in the encyclopedia; collection names can be assigned too');

  /* ---- 作品ごとの保存・バックアップ・復元・既存作品への影響 ---- */
  await page.locator('#projectMenuBtn').click();
  const [dl]=await Promise.all([page.waitForEvent('download'),sheet().locator('[data-a="export"]').click()]);
  const backupPath=path.join(outdir,'backup.json');fs.copyFileSync(await dl.path(),backupPath);
  const backup=JSON.parse(fs.readFileSync(backupPath,'utf8'));
  assert.equal(backup.version,3);assert.equal(backup.project.nameIdeas.length,6);assert.equal(backup.project.nameCollections.length,2);assert.equal(backup.project.nameUses.length,10);assert.equal(backup.characters.length,4);
  await sheet().locator('[data-a="new"]').click();await sheet().locator('input.st-input').fill('別の作品');await sheet().locator('[data-r="1"]').click();
  await page.waitForFunction(()=>OCStudio.S.project.name==='別の作品');
  await sub('collections');
  await page.waitForFunction(()=>document.getElementById('wnIdeasTitle').textContent.includes('「別の作品」の名前候補（0件）'));
  assert.equal(await page.locator('#wnIdeas .wn-idea').count(),0);assert.equal(await page.locator('#wnCollections .wn-col').count(),0);
  await page.locator('#projectMenuBtn').click();await sheet().locator('#projectImportFile').setInputFiles(backupPath);await toast('を復元しました');
  await page.waitForFunction(()=>document.getElementById('wnIdeasTitle').textContent.includes('の名前候補（6件）'));
  const restored=await page.evaluate(()=>{const p=OCStudio.S.project,idea=id=>p.nameIdeas.find(i=>i.id===id);
   return {name:p.name,cols:p.nameCollections.map(c=>[c.name,c.theme,c.memo,c.items.map(i=>[idea(i.ideaId).name,i.note])]),
    uses:p.nameUses.map(u=>[u.kind,u.name,u.intent,u.ideaId?idea(u.ideaId).name:'',u.targetType==='character'?OCStudio.S.chars.some(c=>c.id===u.targetId&&c.name===u.name):p.world.sections.some(s=>s.entries.some(e=>e.id===u.targetId&&e.title===u.name))]).sort(),
    chars:OCStudio.S.chars.map(c=>c.name)};});
  assert.equal(restored.name,'マイ作品（復元）');
  const idName=id=>backup.project.nameIdeas.find(i=>i.id===id).name;
  assert.deepEqual(restored.cols,backup.project.nameCollections.map(c=>[c.name,c.theme,c.memo,c.items.map(i=>[idName(i.ideaId),i.note])]));
  assert.equal(restored.uses.length,10);assert.ok(restored.uses.every(u=>u[4]),'every restored use points at its restored character / world entry: '+JSON.stringify(restored.uses.filter(u=>!u[4])));
  assert.deepEqual(restored.uses.map(u=>u.slice(0,4)),backup.project.nameUses.map(u=>[u.kind,u.name,u.intent,u.ideaId?idName(u.ideaId):'']).sort());
  assert.deepEqual(restored.chars,backup.characters.map(c=>c.name));
  assert.ok((await ideaCard('アコール').innerText()).includes('使っている場所\n国家名「アコール王国」（世界観・地理）'));
  fs.unlinkSync(backupPath);
  // v2.1 のバックアップ（version 2・コレクションなし）も読める
  const oldPath=path.join(outdir,'backup-v21.json');
  const oldBackup=JSON.parse(JSON.stringify(backup));oldBackup.version=2;oldBackup.app='2.0';oldBackup.project.name='v2.1のバックアップ';delete oldBackup.project.nameCollections;delete oldBackup.project.nameUses;oldBackup.project.nameIdeas.forEach(i=>delete i.overlap);
  fs.writeFileSync(oldPath,JSON.stringify(oldBackup));
  await page.locator('#projectMenuBtn').click();await sheet().locator('#projectImportFile').setInputFiles(oldPath);await toast('「v2.1のバックアップ」を復元しました');fs.unlinkSync(oldPath);
  await page.waitForFunction(()=>OCStudio.S.project.name==='v2.1のバックアップ'&&OCStudio.S.project.nameIdeas.length===6);
  assert.deepEqual(await page.evaluate(()=>[OCStudio.S.project.nameCollections,OCStudio.S.project.nameUses,OCStudio.S.chars.length]),[[],[],4]);
  assert.ok((await ideaCard('アコール').innerText()).includes('実在の人名・単語との重なり\n未確認'));
  // v2.0で作られた作品（名前候補の欄も持たない）を開いても壊れず、保存できる
  await settle();
  await page.evaluate(async()=>{
   const db=await new Promise(r=>{const q=indexedDB.open('ocMakerStudioV2');q.onsuccess=()=>r(q.result);});
   const old={id:'prj_old_v20',name:'v2.0の作品',createdAt:1,updatedAt:1,world:OCStudio.C.defaultWorld('fantasy'),heightCompare:{items:[],bg:'#F7F5F0',showScale:true,showNames:true},charts:[]};
   await new Promise(r=>{const t=db.transaction('projects','readwrite');t.objectStore('projects').put(old);t.oncomplete=r;});db.close();
   localStorage.setItem('ocMakerStudioCurrentV2','prj_old_v20');
  });
  await page.goto(origin+'/dictionary.html#words');await page.reload();await ready();await count(TOTAL);
  assert.equal(await page.locator('#projectSelect option:checked').textContent(),'v2.0の作品');
  // v2.1 で一度だけ出た原因未特定のコンソールエラーの再現条件：
  // 「名前候補の欄を持たない古い作品」を開くとき、キャラの読み込みより先に言葉データが届く。キャラの読み込みを遅らせて必ずその順にする。
  const slow=await context.newPage();watch(slow,'race ');
  await slow.addInitScript(()=>{let db;Object.defineProperty(window,'OCStudioDB',{configurable:true,get:()=>db,set(v){
   const orig=v.byProject;v.byProject=async(...a)=>{await new Promise(r=>setTimeout(r,700));return orig(...a);};db=v;}});});
  await slow.route('**/data/word-naming-v2.json',async r=>{await new Promise(x=>setTimeout(x,300));await r.continue();});
  await slow.goto(origin+'/dictionary.html#words/collections');
  await slow.waitForFunction(t=>document.getElementById('wnCount').textContent.startsWith('全'+t+'語'),TOTAL);
  assert.equal(await slow.evaluate(()=>document.documentElement.dataset.studio),undefined,'the word data must arrive while the project is still loading');
  assert.equal(await slow.locator('#wnLoadError').isVisible(),false);assert.ok((await slow.locator('#wnIdeas').textContent()).includes('作品を読み込んでいます'));
  await slow.waitForSelector('html[data-studio="ready"]');
  await slow.waitForFunction(()=>document.getElementById('wnIdeasTitle').textContent.includes('「v2.0の作品」の名前候補（0件）'));
  await slow.locator('#wnTab-batch').click();await slow.locator('#wnTab-find').click();
  assert.equal(await slow.locator('#wnLoadError').isVisible(),false);assert.equal(await slow.locator('#wnResults .wn-card').count(),PAGE);await slow.close();
  assert.deepEqual(await page.evaluate(()=>[OCStudio.S.project.nameIdeas,OCStudio.S.project.nameCollections,OCStudio.S.project.nameUses]),[[],[],[]]);
  assert.equal(await page.evaluate(()=>OCStudio.S.project.world.sections.find(s=>s.key==='geography').entries.length),2);
  await find('consenso');await cardOf('WN-IT-0003').locator('[data-cand="WN-IT-0003-b"]').click();await sheet().locator('[data-e="save"]').click();await toast('名前候補に保存しました');
  await settle();await page.reload();await ready();await sub('collections');
  await page.waitForFunction(()=>document.querySelectorAll('#wnIdeas .wn-idea').length===1);
  assert.equal(await page.evaluate(()=>OCStudio.S.project.nameIdeas[0].method),'short');
  await page.locator('#wnIdeas [data-i="delete"]').click();await sheet().locator('[data-r="1"]').click();await toast('削除しました');
  assert.equal(await page.locator('#wnIdeas .wn-idea').count(),0);await settle();
  ok('names, collections and uses are stored per project and travel in the project backup (restored links point at the restored characters and world entries); other projects stay separate; v2.1 backups and v2.0 projects open and save normally');

  /* ---- キャラ作成に送る → 図鑑に由来が残る → 戻る ---- */
  await page.locator('#projectSelect').selectOption({label:'別の作品'});await page.waitForFunction(()=>OCStudio.S.project.name==='別の作品'&&OCStudio.S.chars.length===0);
  await sub('find');await find('accord');await count(2);
  await cardOf('WN-EN-0003').locator('[data-cand="WN-EN-0003-c"]').click();await sheet().locator('#wnName').fill('アコーネ');await sheet().locator('#wnIntent').fill('調停役。');
  await sheet().locator('[data-e="save"]').click();await toast('名前候補に保存しました');await settle();
  await sub('collections');await ideaCard('アコーネ').locator('[data-i="create"]').click();
  await page.waitForURL(u=>u.pathname.endsWith('/index.html'));await ready();
  assert.equal(await page.locator('#nameInput').inputValue(),'アコーネ');assert.equal(new URL(page.url()).search,'');
  await toast('名前「アコーネ」を入力欄に入れました');assert.ok(await page.locator('#nameInput').isVisible());
  await page.locator('#btnGen1').click();await page.waitForSelector('#results .card');
  assert.ok((await page.locator('#results .card').first().innerText()).includes('アコーネ'));
  await page.locator('#results [data-act="zukan"]').click();await page.waitForFunction(()=>OCStudio.S.chars.length===1);
  const ch=await page.evaluate(()=>({name:OCStudio.S.chars[0].name,note:OCStudio.S.chars[0].profile.nameNote}));
  assert.equal(ch.name,'アコーネ');assert.ok(ch.note.includes('もとにした言葉：accord（英語')&&ch.note.includes('創作上の意図：調停役。')&&ch.note.includes('重複は確認していません')&&!ch.note.includes('示しません'),ch.note);
  await page.goBack();await page.waitForURL('**/dictionary.html#words/collections');await ready();await page.waitForSelector('#wnPane-collections:not([hidden])');
  assert.ok(await page.locator('#modeWords').isVisible(),'back returns to the same function');
  // 候補から直接（保存せずに）送った場合も由来が残る
  await sub('find');await count(TOTAL);await find('assent');await cardOf('WN-EN-0002').locator('[data-cand="WN-EN-0002-a"]').click();await sheet().locator('[data-e="create"]').click();
  await page.waitForURL(u=>u.pathname.endsWith('/index.html'));await ready();
  assert.equal(await page.locator('#nameInput').inputValue(),'アセント');
  await page.locator('#btnGen1').click();await page.locator('#results [data-act="zukan"]').first().click();await page.waitForFunction(()=>OCStudio.S.chars.length===2);
  assert.ok((await page.evaluate(()=>OCStudio.S.chars[1].profile.nameNote)).includes('もとにした言葉：assent（英語'));
  ok('send to character creation still fills the fixed-name field, the generated card uses it, and the encyclopedia keeps the name origin; back returns to the same function');

  /* ---- 読み込み失敗時：辞典は動き、再読み込みで復帰。読み込み中にページを離れてもエラーを出さない ---- */
  const p2=await context.newPage();let fail=true;watch(p2,'p2 ');
  await p2.route('**/data/word-naming-v2.json',r=>fail?r.abort():r.continue());
  await p2.goto(origin+'/dictionary.html#words');await p2.waitForSelector('html[data-studio="ready"]');
  await p2.waitForSelector('#wnLoadError:not([hidden])');assert.ok(await p2.locator('#wnSearch').isDisabled());
  const loadErrors=report.consoleErrors.splice(0).filter(e=>!/^p2 console .*Failed to fetch/.test(e));assert.deepEqual(loadErrors,[],'only the expected load failure is logged');
  await p2.locator('#wnTab-collections').click();assert.ok(await p2.locator('#wnPane-collections').isVisible(),'collections stay reachable without the word data');
  await p2.locator('#wnTab-batch').click();await p2.locator('#wnTab-find').click();
  await p2.locator('#modeFindBtn').click();await p2.waitForFunction(n=>document.getElementById('count').textContent.startsWith('全'+n+'候補'),dict.entries.length);
  await p2.locator('#modeWordsBtn').click();await p2.waitForSelector('#wnLoadError:not([hidden])');report.consoleErrors.splice(0);
  fail=false;await p2.locator('#wnRetry').click();
  await p2.waitForFunction(t=>document.getElementById('wnCount').textContent.startsWith('全'+t+'語 ／ 該当'+t+'語'),TOTAL);
  await p2.unroute('**/data/word-naming-v2.json');
  await p2.route('**/data/word-naming-v2.json',async r=>{await new Promise(x=>setTimeout(x,500));try{await r.continue();}catch(e){}});
  await p2.goto(origin+'/dictionary.html#words');await p2.waitForSelector('html[data-studio="ready"]');
  await p2.goto(origin+'/index.html');await p2.waitForSelector('html[data-studio="ready"]');await p2.waitForTimeout(800);
  assert.deepEqual(report.consoleErrors,[]);await p2.close();
  ok('if the word data fails to load, the dictionary and the collections keep working and retry recovers; leaving the page mid-load logs nothing');

  /* ---- iPhone相当の画面（390 / 320） ---- */
  await page.locator('#projectSelect').selectOption({label:'マイ作品（復元）'});await page.waitForFunction(()=>OCStudio.S.project.name==='マイ作品（復元）'&&OCStudio.S.chars.length===4);await settle();
  const mobile=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,hasTouch:true,isMobile:true,storageState:await context.storageState({indexedDB:true})});
  const m=await mobile.newPage();watch(m,'mobile ');
  const noOverflow=async label=>assert.ok(await m.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),label+' overflows');
  const tall=sel=>m.evaluate(s=>[...document.querySelectorAll(s)].filter(b=>b.offsetParent).every(b=>b.getBoundingClientRect().height>=44),sel);
  for(const wd of [390,320]){
   await m.setViewportSize({width:wd,height:wd===390?844:568});await m.evaluate(()=>window.OCStudio&&OCStudio.flush());await m.goto(origin+'/dictionary.html#words');await m.reload();await m.waitForSelector('html[data-studio="ready"]');
   await m.waitForFunction(t=>document.getElementById('wnCount').textContent.startsWith('全'+t+'語'),TOTAL);await noOverflow('find@'+wd);
   assert.ok(await tall('#wnModes button,#wnSubtabs button,#wnCategories button,.wn-cand,.wn-made .actions button,.wn-detail summary,#wnMoreFilters summary,#wnMore'),'44px targets @'+wd);
   assert.ok(await m.evaluate(()=>[...document.querySelectorAll('#wnModes button,#wnSubtabs button')].every(b=>b.scrollWidth<=b.clientWidth)),'tab labels fit @'+wd);
   assert.equal(await m.locator('#wnLangs').isVisible(),false,'extra filters stay folded @'+wd);
   if(wd===390)await shot(m,'mobile-find-top.png');
   await m.locator('#wnMoreFilters > summary').tap();await m.waitForSelector('#wnLangs button');await noOverflow('filters@'+wd);assert.ok(await tall('#wnLangs button,#wnNuances button,#wnLengths button,#wnImpressions button'));
   assert.ok(await m.evaluate(()=>parseFloat(getComputedStyle(document.getElementById('wnSearch')).fontSize)>=16&&parseFloat(getComputedStyle(document.getElementById('wnScope')).fontSize)>=16));
   if(wd===390){await m.locator('[data-id="WN-FR-0004"]').scrollIntoViewIfNeeded();await shot(m,'mobile-find-card.png');}
   await m.locator('#wnSearch').fill('りんご');await m.waitForSelector('#wnSuggest:not([hidden])');await noOverflow('suggest@'+wd);assert.ok(await tall('#wnSuggest button'));
   await m.locator('#wnTab-collections').tap();await m.waitForSelector('#wnCollections .wn-col');await noOverflow('collections@'+wd);
   assert.ok(await tall('#wnCollections button,#wnIdeas button,#wnColNew'),'collection buttons @'+wd);
   if(wd===390){await shot(m,'mobile-collections.png');await m.locator('#wnIdeas').scrollIntoViewIfNeeded();await shot(m,'mobile-ideas.png');}
   await m.locator('#wnTab-batch').tap();await m.waitForSelector('#wnBatchChars input');await noOverflow('batch@'+wd);
   for(const i of [0,1])await m.locator('#wnBatchChars input').nth(i).check();
   await m.locator('#wnBatchCats [data-value="courage"]').tap();await m.locator('#wnBatchAssign').tap();await m.waitForSelector('#wnBatchTable .wn-brow[data-row]');
   await noOverflow('batch table@'+wd);
   assert.ok(await tall('#wnBatch button,#wnBatchChars label,#wnBatchTable label'),'batch targets @'+wd);
   assert.ok(await m.evaluate(()=>[...document.querySelectorAll('#wnBatch input[type=text],#wnBatch select')].every(e=>parseFloat(getComputedStyle(e).fontSize)>=16)),'16px inputs @'+wd);
   assert.equal(await m.evaluate(()=>getComputedStyle(document.querySelector('#wnBatchTable .wn-bhead')).display),'none');
   assert.equal(await m.evaluate(()=>getComputedStyle(document.querySelector('#wnBatchTable .wn-brow[data-row] .wn-bcell'),'::before').content),'"キャラクター"','stacked cards carry their labels @'+wd);
   if(wd===390){await m.locator('#wnBatchTable').scrollIntoViewIfNeeded();await shot(m,'mobile-batch.png');}
  }
  // 320pxのまま：タッチで選ぶ → 編集 → コレクションに保存、使い道の画面
  await m.locator('#wnTab-find').tap();await m.locator('#wnSearch').fill('oui');await m.waitForSelector('[data-id="WN-FR-0001"]');
  await m.locator('[data-id="WN-FR-0001"] [data-cand="WN-FR-0001-b"]').tap();
  await m.waitForSelector('.st-sheet #wnName');await noOverflow('editor@320');
  assert.ok(await m.evaluate(()=>[...document.querySelectorAll('.st-sheet input,.st-sheet textarea,.st-sheet select')].every(e=>parseFloat(getComputedStyle(e).fontSize)>=16)));
  assert.ok(await m.evaluate(()=>[...document.querySelectorAll('.st-sheet .st-actions button')].every(b=>b.getBoundingClientRect().height>=40)));
  await m.setViewportSize({width:390,height:844});await shot(m,'mobile-editor.png');await m.setViewportSize({width:320,height:568});
  await m.locator('.st-sheet #wnCollection').selectOption({label:'全肯定する三きょうだい'});
  await m.locator('.st-sheet [data-e="use"]').tap();await m.waitForSelector('.st-sheet #wnUseKind');await noOverflow('use@320');
  assert.ok(await m.evaluate(()=>[...document.querySelectorAll('.st-sheet input,.st-sheet textarea,.st-sheet select')].every(e=>parseFloat(getComputedStyle(e).fontSize)>=16)));
  await m.locator('.st-sheet .st-x').tap();
  await m.waitForFunction(()=>OCStudio.S.project.nameIdeas.length===7&&OCStudio.S.project.nameCollections[0].items.length===4);
  await m.locator('#modeFindBtn').scrollIntoViewIfNeeded();await m.locator('#modeFindBtn').tap();
  await m.waitForFunction(n=>document.getElementById('count').textContent.startsWith('全'+n+'候補'),dict.entries.length);await noOverflow('dictionary@320');
  await m.evaluate(()=>OCStudio.flush());await mobile.close();
  ok('iPhone-sized screens (390/320): no horizontal overflow in any of the 3 functions, 44px targets, 16px inputs, extra filters folded, batch comparison stacks into labelled cards, touch select-edit-save');

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
