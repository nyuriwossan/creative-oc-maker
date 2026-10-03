'use strict';
// Optional research audit (network required). The app itself never fetches these pages.
const data=require('./data/science-medical-v1.6.json');
// NCI entries were reviewed individually during curation. USGS blocks scripted
// requests (403); its three cited pages were checked through the public web view.
const manuallyReviewed=new Set(['nci','usgsVolcano','usgsQuake','usgsWater']);
const selected=data.terms.filter(t=>!manuallyReviewed.has(t.source));
const sourceUrl=t=>{const s=data.sources[t.source];return s.url||s.baseUrl+(t.sourcePath||t.original).split('/').map(encodeURIComponent).join('/');};
const unique=new Map(selected.map(t=>{
 const url=sourceUrl(t);
 return [url,{url,source:t.source,terms:[]}];
}));
for(const t of selected){unique.get(sourceUrl(t)).terms.push(t.original);}
const requests=[...unique.values()];let index=0;const results=[];
async function worker(){while(index<requests.length){const x=requests[index++];try{
 const response=await fetch(x.url,{signal:AbortSignal.timeout(20000)});
 const body=await response.text();
 results.push({...x,status:response.status,missing:x.terms.filter(t=>!body.toLowerCase().includes(t.toLowerCase()))});
}catch(e){results.push({...x,error:e.message});}}}
Promise.all(Array.from({length:8},worker)).then(()=>{
 const bad=results.filter(r=>r.error||r.status!==200||r.missing.length);
 console.log(JSON.stringify({checked:results.length,manualReview:[...manuallyReviewed],failed:bad},null,2));
 if(bad.length)process.exitCode=1;
});
