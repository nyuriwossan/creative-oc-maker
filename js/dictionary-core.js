/* Shared, dependency-free dictionary model for both pages and Node tests. */
(function(root, factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.OCDictionary=api;
})(typeof globalThis!=='undefined'?globalThis:this, function(){
  'use strict';
  const notice='収録候補は現在、個別出典の再確認中です。表示する用途・印象は創作向けの提案です。';
  const categories=['鳥類','鉱物・宝石','蝶・蛾・昆虫','日本の伝統色','古語・雅語','香木・香料','月・暦・季語','海洋生物','気象・自然現象','日本の伝統文様','和楽器・雅楽','金属・工芸素材'];
  const usages={name:'人物名',family:'姓・家名',code:'異名・コードネーム',place:'組織・地名'};
  const favoriteKey='ocMakerDictionaryFavoritesV1';
  const small='ぁぃぅぇぉっゃゅょゎゕゖ',large='あいうえおつやゆよわかけ';
  function normalize(value){
    return String(value??'').normalize('NFKC').toLowerCase()
      .replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-0x60))
      .replace(/[\s・･]+/g,'').replace(/[ぁぃぅぇぉっゃゅょゎゕゖ]/g,c=>large[small.indexOf(c)]);
  }
  function gojuon(reading){
    const first=normalize(reading).replace(/^ー+/,'').normalize('NFD')[0];
    return Object.entries({あ:'あいうえお',か:'かきくけこ',さ:'さしすせそ',た:'たちつてと',な:'なにぬねの',は:'はひふへほ',ま:'まみむめも',や:'やゆよ',ら:'らりるれろ',わ:'わゐゑをん'}).find(([,s])=>s.includes(first))?.[0]||'';
  }
  function safeUrl(value){
    try {const url=new URL(value);return ['https:','http:'].includes(url.protocol)?url.href:'';}catch{return '';}
  }
  function validate(data){
    if(data?.version!=='1.7'||!Array.isArray(data.entries)||!data.entries.length)throw new Error('辞典データの形式が正しくありません');
    const ids=new Set();
    for(const e of data.entries){
      if(!e||typeof e.id!=='string'||! /^(ND|NEW|SUP)-\d{3,4}$/.test(e.id)||ids.has(e.id)||
        !['display','reading','readingNormalized','description','minorCategory','original','sourceBatch','sourceId','canonicalGroup','sourceScope'].every(k=>typeof e[k]==='string')||
        !e.display||!e.reading||e.readingNormalized!==normalize(e.reading)||e.gojuonGroup!==gojuon(e.reading)||
        !categories.includes(e.majorCategory)||e.reviewRequired!==true||!Array.isArray(e.aliases)||!Array.isArray(e.impressionTags)||
        ![...e.aliases,...e.impressionTags].every(s=>typeof s==='string')||
        !Object.keys(usages).every(k=>[0,1].includes(e.usageFlags?.[k]))||
        !['name','url','note'].every(k=>typeof e.source?.[k]==='string')||
        !['name','reading','origin','form','classification'].every(k=>typeof e.verification?.[k]==='string'))throw new Error('辞典データに欠損・重複があります');
      ids.add(e.id);
    }
    return data.entries;
  }
  let pending;
  function load(){
    if(!pending)pending=fetch('./data/dictionary-v1.7.json').then(r=>{if(!r.ok)throw new Error('HTTP '+r.status);return r.json();}).then(validate).catch(error=>{pending=null;throw error;});
    return pending;
  }
  function searchKey(e){return normalize([e.display,e.reading,e.description,e.original,...e.aliases].join(' '));}
  const collator=new Intl.Collator('ja');
  function compare(a,b){
    return collator.compare(a.readingNormalized,b.readingNormalized)||collator.compare(a.display,b.display)||(a.id<b.id?-1:a.id>b.id?1:0);
  }
  function filter(entries,opts={}){
    const q=normalize(opts.query);
    return entries.filter(e=>(!q||searchKey(e).includes(q))&&(!opts.group||e.gojuonGroup===opts.group)&&
      (!opts.categories?.length||opts.categories.includes(e.majorCategory))&&(!opts.minor||e.minorCategory===opts.minor)&&
      (!opts.usages?.length||opts.usages.some(k=>e.usageFlags[k]===1))&&
      (!opts.impression||e.impressionTags.includes(opts.impression))&&(!opts.ids||opts.ids.has(e.id)));
  }
  function favorites(getStorage,onWarning=()=>{}){
    let ids=[],persistent=true,storage;
    function warn(){persistent=false;onWarning('保存領域を利用できないため、お気に入りはこの画面を開いている間だけ保持します。');}
    try{
      storage=getStorage();
      const raw=storage.getItem(favoriteKey);
      if(raw){const value=JSON.parse(raw);if(value?.version!==1||!Array.isArray(value.ids)||!value.ids.every(id=>typeof id==='string'))throw Error('invalid favorites');ids=[...new Set(value.ids)];}
      // Probe also detects private/disabled storage before the first favorite is added.
      storage.setItem(favoriteKey,JSON.stringify({version:1,ids}));
    }catch{warn();}
    return {
      ids:()=>ids.slice(),has:id=>ids.includes(id),persistent:()=>persistent,
      toggle(id){ids=ids.includes(id)?ids.filter(x=>x!==id):[...ids,id];if(persistent)try{storage.setItem(favoriteKey,JSON.stringify({version:1,ids}));}catch{warn();}return ids.includes(id);}
    };
  }
  return {notice,categories,usages,favoriteKey,normalize,gojuon,safeUrl,validate,load,filter,compare,favorites};
});
