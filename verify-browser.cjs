const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const repo=__dirname,outdir=process.argv[2]||path.join(__dirname,'test-results');fs.mkdirSync(outdir,{recursive:true});
const report={passed:false,checks:[],consoleErrors:[],screenshots:[]};
(async()=>{
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(fs.readFileSync(path.join(repo,'index.html')));});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 let browser;
 try{
  browser=await chromium.launch({channel:'msedge',headless:true});
  const context=await browser.newContext({viewport:{width:1280,height:950},permissions:['clipboard-read','clipboard-write']});
  const page=await context.newPage();page.on('pageerror',e=>report.consoleErrors.push(e.message));
  // Inject a real legacy-format save before app initialization.
  await page.addInitScript(()=>{
   if(!localStorage.getItem('qa-fixture')){localStorage.setItem('ocMakerSavedV1',JSON.stringify([{id:'old-v12',mode:'nameOnly',name:'旧保存 テスト',reading:'きゅうほぞん てすと',roman:'Old Test',worldLabel:'現代日本',nameImpression:'穏やかな印象',suitedFor:'教師'}]));localStorage.setItem('qa-fixture','1');}
  });
  await page.goto(origin);
  assert.equal(await page.locator('.naming-details').getAttribute('open'),null);report.checks.push('details initially collapsed');
  await page.locator('[data-sact="toggle"]').click();assert.ok(await page.locator('.s-detail').isVisible());
  await page.locator('[data-sact="copy"]').click();assert.ok(await page.evaluate(()=>navigator.clipboard.readText().then(s=>s.includes('旧保存 テスト'))));report.checks.push('legacy save displays and copies');
  const system=(key)=>page.locator('[data-name-choice="system:'+key+'"]');
  await page.locator('.naming-details > summary').click();
  await system('modernWestern').focus();await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(()=>document.activeElement.dataset.nameChoice),'system:modernWestern');assert.equal(await system('modernWestern').getAttribute('aria-pressed'),'true');report.checks.push('keyboard selection keeps focus and aria-pressed');
  await page.locator('[data-cond="world"][data-key="modernWestern"]').click();
  await page.locator('[data-name-choice="culture:de"]').click();
  await page.locator('[data-mode="nameOnly"]').click();await page.locator('#btnGen5').click();assert.equal(await page.locator('#results .card').count(),5);
  assert.equal(new Set(await page.locator('#results .nm').allTextContents()).size,5);
  await page.locator('#results [data-act="name"]').first().click();await page.waitForFunction(async()=> (await navigator.clipboard.readText()).replace(/\r\n/g,'\n')===buildNameText(generatedResults[0]));
  await page.locator('#results [data-act="save"]').first().click();assert.equal(await page.locator('#savedList .saved-item').count(),2);
  await page.reload();assert.equal(await page.locator('#savedList .saved-item').count(),2);report.checks.push('five modern names, exact name-only clipboard text, new save and reload');
  page.on('dialog',dialog=>dialog.accept());await page.locator('#savedList [data-id="old-v12"] [data-sact="del"]').click();assert.equal(await page.locator('#savedList .saved-item').count(),1);report.checks.push('old save deletion');
  await page.locator('[data-mode="settingOnly"]').click();await page.locator('#nameInput').fill('固定名 春');
  await page.locator('.naming-details > summary').click();assert.equal(await system('modernWestern').isDisabled(),true);
  await page.locator('#btnGen5').click();assert.deepEqual(await page.locator('#results .nm').allTextContents(),Array(5).fill('固定名 春'));
  await page.locator('#nameInput').fill('');await page.locator('#btnGen1').click();assert.equal(await page.locator('#results .card').count(),1);assert.equal(await page.locator('#results .nm').count(),0);report.checks.push('setting-only with and without manual name; name controls disabled');
  await page.locator('[data-mode="full"]').click();await system('fantasy').click();await page.locator('[data-name-choice="motif:german"]').click();await page.locator('[data-name-choice="motif:gemstone"]').click();
  assert.equal(await page.locator('[data-name-choice="motif:auto"]').getAttribute('aria-pressed'),'false');
  await page.locator('#btnGen5').click();assert.equal(await page.locator('#results .card').count(),5);
  await page.locator('#results [data-act="detail"]').first().click();await page.waitForFunction(async()=> (await navigator.clipboard.readText()).replace(/\r\n/g,'\n')===buildDetailText(generatedResults[0]));
  await page.locator('#results [data-act="img"]').first().click();await page.waitForFunction(async()=> (await navigator.clipboard.readText()).replace(/\r\n/g,'\n')===buildImagePrompt(generatedResults[0]));
  await page.locator('.name-origin > summary').first().click();
  await page.locator('#results .card').first().screenshot({path:path.join(outdir,'desktop-result.png')});report.screenshots.push('desktop-result.png');report.checks.push('fantasy themes, full detail and image prompt clipboard text');
  // Error paths in the real DOM, using isolated test-only state changes.
  const previous=await page.locator('#results').innerHTML();
  await page.evaluate(()=>{window.qaOriginal=generateFullCharacter;generateFullCharacter=()=>{throw new NamingError('候補がありません。');};});
  await page.locator('#btnGen5').click();assert.equal(await page.locator('#results').innerHTML(),previous);assert.ok(await page.locator('#generationError').isVisible());assert.equal(await page.locator('#generationError').getAttribute('role'),'alert');
  await page.evaluate(()=>{generateFullCharacter=()=>({name:'same'});});await page.locator('#btnGen5').click();assert.ok((await page.locator('#generationError').innerText()).includes('128'));assert.equal(await page.locator('#results').innerHTML(),previous);
  await page.evaluate(()=>{generateFullCharacter=window.qaOriginal;});await page.locator('#btnGen1').click();assert.equal(await page.locator('#generationError').isVisible(),false);report.checks.push('empty candidates and bounded retry errors preserve real DOM results and recover');
  await page.setViewportSize({width:390,height:844});await page.locator('#btnReset').click();await page.locator('[data-mode="nameOnly"]').click();
  if(!(await page.locator('.naming-details').evaluate(d=>d.open)))await page.locator('.naming-details > summary').click();
  await system('modernWestern').click();await page.locator('[data-name-choice="culture:fr"]').click();await page.locator('#btnGen1').click();
  await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:path.join(outdir,'mobile-controls.png'),fullPage:true});report.screenshots.push('mobile-controls.png');
  await page.locator('#results .card').first().screenshot({path:path.join(outdir,'mobile-result.png')});report.screenshots.push('mobile-result.png');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));report.checks.push('390px mobile width has no horizontal overflow');
  await page.locator('#btnReset').click();await page.locator('[data-mode="nameOnly"]').click();
  if(!(await page.locator('.naming-details').evaluate(d=>d.open)))await page.locator('.naming-details > summary').click();
  await system('fantasy').click();await page.locator('[data-name-choice="motif:auto"]').click();
  await page.evaluate(()=>{let seed=914;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};});
  let found=false;for(let i=0;i<80&&!found;i++){await page.locator('#btnGen1').click();found=await page.evaluate(()=>Object.values(generatedResults[0].nameParts).some(p=>p.editorialNote));}
  assert.ok(found,'new editorial name was not generated');
  await page.locator('.name-origin > summary').first().click();assert.ok((await page.locator('.name-origin').innerText()).includes('編集上の着想'));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
  await page.locator('#results .card').screenshot({path:path.join(outdir,'new-origin-mobile.png')});report.screenshots.push('new-origin-mobile.png');
  const saved=await page.evaluate(()=>({name:generatedResults[0].name,parts:generatedResults[0].nameParts}));
  await page.locator('#results [data-act="save"]').click();await page.reload();
  const restored=await page.evaluate(name=>JSON.parse(localStorage.getItem('ocMakerSavedV1')).find(n=>n.name===name),saved.name);
  assert.deepEqual(restored.nameParts,saved.parts);report.checks.push('v1.4 editorial origin renders at 390px and metadata survives save/reload');
  assert.equal(await page.title(),'創作OCメーカー v1.5');
  assert.equal(report.consoleErrors.length,0);report.passed=true;
 }finally{if(browser)await browser.close();server.close();fs.writeFileSync(path.join(outdir,'browser-test-report.json'),JSON.stringify(report,null,2));}
 console.log(JSON.stringify(report));
})().catch(e=>{console.error(e);process.exitCode=1;});
