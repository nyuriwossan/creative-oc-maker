'use strict';
// Run: PLAYWRIGHT_MODULE=... node verify-null-name-display.cjs [report.json]
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const report={passed:false,checks:[],pageErrors:[]};
const server=http.createServer((req,res)=>{
  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.end(fs.readFileSync(path.join(__dirname,'index.html')));
});
const absent=/\b(?:null|undefined)\b/i;
async function clipboard(page){return (await page.evaluate(()=>navigator.clipboard.readText())).replace(/\r\n/g,'\n');}
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;
 try{
  browser=await chromium.launch({channel:'msedge',headless:true});
  const context=await browser.newContext({permissions:['clipboard-read','clipboard-write']});
  const page=await context.newPage();page.on('pageerror',e=>report.pageErrors.push(e.message));
  await page.addInitScript(()=>{
    if(localStorage.getItem('null-display-fixture'))return;
    const base={mode:'nameOnly',worldLabel:'現代日本',nameImpression:'穏やかな印象',suitedFor:'教師'};
    localStorage.setItem('ocMakerSavedV1',JSON.stringify([
      {...base,id:'old-v12',name:'旧保存 テスト',reading:'きゅうほぞん てすと',roman:'Old Test'},
      {...base,id:'old-v12-null',name:'旧保存 無表記',reading:'きゅうほぞん',roman:null}
    ]));
    localStorage.setItem('null-display-fixture','1');
  });
  await page.goto('http://127.0.0.1:'+server.address().port);
  const system=key=>page.locator('[data-name-choice="system:'+key+'"]');
  const oldFull=await page.locator('#savedList [data-id="old-v12"] .s-detail').textContent();
  const oldMissing=await page.locator('#savedList [data-id="old-v12-null"] .s-detail').textContent();
  const oldSummary=await page.locator('#savedList [data-id="old-v12-null"] .s-imp').textContent();
  assert.match(oldFull,/英字表記：Old Test/);assert.doesNotMatch(oldMissing,absent);
  assert.doesNotMatch(oldMissing,/英字表記：/);
  assert.match(oldSummary,/世界観：現代日本/);assert.doesNotMatch(oldSummary,/名前：/);
  report.checks.push('old saves load without invented naming system or missing roman spelling');

  // Name only > details > one kanji > standard > ten.
  await page.locator('[data-mode="nameOnly"]').click();
  await page.locator('.naming-details > summary').click();
  await system('kanjiSingle').click();
  assert.equal(await page.locator('[data-name-choice="kanjiReading:standard"]').getAttribute('aria-pressed'),'true');
  await page.locator('#btnGen5').click();
  assert.equal(await page.locator('#results .card').count(),10);
  assert.equal(await page.locator('#results .roman').count(),0);
  assert.equal(await page.locator('#results .rd').count(),10);
  assert.doesNotMatch(await page.locator('#results').textContent(),absent);
  assert.ok(await page.evaluate(()=>generatedResults.every(c=>c.roman===null&&c.reading)));
  await page.locator('#results [data-act="name"]').first().click();
  await page.waitForFunction(async()=> (await navigator.clipboard.readText()).startsWith('名前：'));
  const nameCopy=await clipboard(page);assert.doesNotMatch(nameCopy,absent);assert.doesNotMatch(nameCopy,/英字表記：/);
  await page.locator('#results [data-act="detail"]').first().click();
  await page.waitForFunction(async()=> (await navigator.clipboard.readText()).includes('名前の系統：'));
  const detailCopy=await clipboard(page);assert.doesNotMatch(detailCopy,absent);assert.doesNotMatch(detailCopy,/英字表記：/);
  report.checks.push('ten-name path, card rendering, name and detail copy');

  const savedName=await page.evaluate(()=>generatedResults[0].name);
  await page.locator('#results [data-act="save"]').first().click();
  await page.reload();
  const stored=await page.evaluate(name=>JSON.parse(localStorage.getItem('ocMakerSavedV1')).find(c=>c.name===name),savedName);
  assert.equal(stored.roman,null);
  const savedText=await page.locator('#savedList [data-id="'+stored.id+'"] .s-detail').textContent();
  assert.doesNotMatch(savedText,absent);assert.doesNotMatch(savedText,/英字表記：/);
  await page.locator('#savedList [data-id="'+stored.id+'"] [data-sact="copy"]').click();
  await page.waitForFunction(async()=> (await navigator.clipboard.readText()).includes('名前の系統：'));
  assert.doesNotMatch(await clipboard(page),absent);
  report.checks.push('saved one-kanji result and saved-detail copy after reload');

  await page.locator('.naming-details > summary').click();
  await system('kanjiSingle').click();
  await page.locator('[data-mode="full"]').click();
  await page.locator('#btnGen1').click();
  assert.equal(await page.locator('#results .roman').count(),0);
  await page.locator('#results [data-act="detail"]').click();
  await page.waitForFunction(async()=> (await navigator.clipboard.readText()).includes('【基本設定】'));
  const fullCopy=await clipboard(page);assert.doesNotMatch(fullCopy,absent);assert.doesNotMatch(fullCopy,/英字表記：/);
  report.checks.push('full-character one-kanji detail copy omits missing roman spelling');

  await system('mythology').click();
  await page.locator('[data-mode="nameOnly"]').click();
  await page.locator('#btnGen5').click();
  assert.equal(await page.locator('#results .card').count(),10);
  assert.equal(await page.locator('#results .roman').count(),10);
  assert.doesNotMatch(await page.locator('#results').textContent(),absent);
  await page.locator('#results [data-act="name"]').first().click();
  await page.waitForFunction(async()=> (await navigator.clipboard.readText()).includes('英字表記：'));
  assert.match(await clipboard(page),/英字表記：\S/);
  await page.locator('#results [data-act="detail"]').first().click();
  await page.waitForFunction(async()=> (await navigator.clipboard.readText()).includes('元の綴り：'));
  assert.match(await clipboard(page),/元の綴り：\S/);
  report.checks.push('myth names retain source spellings in card and both copy actions');

  // A single-name record can also lack its source spelling. Check every missing-value form.
  const missing=await page.evaluate(()=>{
    const values=[null,undefined,'','  '];
    return values.map(value=>{
      const c=structuredClone(generatedResults[0]);
      c.reading=value;c.roman=value;c.nameParts.single.original=value;
      renderResults([c]);
      return {card:document.querySelector('#results .card').textContent,
        romanLines:document.querySelectorAll('#results .roman').length,
        readingLines:document.querySelectorAll('#results .rd').length,
        name:buildNameText(c),detail:buildDetailText(c),origin:renderNameInfo(c)};
    });
  });
  for(const item of missing){
    for(const value of [item.card,item.name,item.detail,item.origin])assert.doesNotMatch(value,absent);
    assert.equal(item.romanLines,0);assert.equal(item.readingLines,0);
    assert.doesNotMatch(item.name,/読み：|英字表記：/);assert.doesNotMatch(item.detail,/元の綴り：/);
  }
  report.checks.push('null, undefined, empty and whitespace-only optional myth spellings are omitted');

  await system('japanese').click();
  await page.locator('#btnGen1').click();
  assert.equal(await page.locator('#results .roman').count(),1);
  assert.match(await page.locator('#results .name-line').textContent(),/ /);
  await page.locator('#results [data-act="name"]').click();
  await page.waitForFunction(async()=> (await navigator.clipboard.readText()).includes('英字表記：'));
  assert.match(await clipboard(page),/英字表記：\S/);
  assert.equal(report.pageErrors.length,0);
  report.checks.push('ordinary surname-plus-given-name display and copy remain intact');
  report.passed=true;
 }finally{
  if(browser)await browser.close();server.close();
  if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
 }
 console.log(JSON.stringify(report));
})().catch(e=>{console.error(e);process.exitCode=1;});
