/* All delivery/user strings become text nodes. No template HTML or inline event handlers. */
(function(){
  'use strict';
  const D=OCDictionary,$=id=>document.getElementById(id);
  let entries=[],group='',limit=36,matched=[],favorites,copyTrigger;
  const byId=new Map();
  function el(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;}
  function status(text){$('actionStatus').textContent=text;}
  function choices(id,values){
    for(const [value,text] of Object.entries(values)){
      const label=el('label',undefined,'check'),input=el('input');input.type='checkbox';input.value=value;
      label.append(input,document.createTextNode(text));$(id).append(label);
    }
  }
  function selected(id){return [...$(id).querySelectorAll('input:checked')].map(i=>i.value);}
  function updateMinor(){
    const chosen=selected('categories'),previous=$('minor').value;
    const minors=[...new Set(entries.filter(e=>!chosen.length||chosen.includes(e.majorCategory)).map(e=>e.minorCategory))].sort((a,b)=>a.localeCompare(b,'ja'));
    $('minor').replaceChildren(new Option('すべて',''),...minors.map(m=>new Option(m,m)));
    $('minor').value=minors.includes(previous)?previous:'';
  }
  async function copy(text,trigger){
    try{await navigator.clipboard.writeText(text);status('コピーしました');}
    catch{copyTrigger=trigger;$('copyFallback').hidden=false;$('copyText').value=text;$('copyText').focus();$('copyText').select();}
  }
  function favoriteButton(id){
    const b=el('button');b.type='button';
    function refresh(){const on=favorites.has(id);b.textContent=on?'★ お気に入り解除':'☆ お気に入り';b.setAttribute('aria-pressed',String(on));}
    refresh();b.addEventListener('click',()=>{
      const on=favorites.toggle(id);refresh();status(on?'お気に入りに登録しました':'お気に入りから解除しました');
      if($('favoritesOnly').checked||$('sort').value==='favorite'){
        const index=[...$('results').children].indexOf(b.closest('article'));render();
        const next=$('results').children[Math.max(0,Math.min(index,$('results').children.length-1))];
        (next?.querySelector('[aria-pressed]')||$('favoritesOnly')).focus();
      }
    });return b;
  }
  function card(e){
    const article=el('article',undefined,'dictionary-card');article.dataset.id=e.id;
    article.append(el('h2',e.display),el('p',e.reading,'reading'),el('p',e.majorCategory+' ／ '+e.minorCategory,'genre'),el('p',e.description,'description'));
    const actions=el('div',undefined,'actions'),copyButton=el('button','コピー');copyButton.type='button';
    copyButton.addEventListener('click',()=>copy(e.display+'（'+e.reading+'）',copyButton));
    const create=el('a','この名前でOCを作る');create.href='./index.html?dictionaryId='+encodeURIComponent(e.id);
    actions.append(copyButton,favoriteButton(e.id),create);article.append(actions);
    const details=el('details');details.append(el('summary','意味・用途・確認状況・参考資料'));
    details.append(el('p',D.notice,'notice'),el('p','ID：'+e.id+' ／ 原ID：'+e.sourceId),el('p','原分類：'+e.originalCategory+' ／ 収録元：'+e.sourceBatch),el('p','意味・説明：'+e.description));
    if(e.original)details.append(el('p','原語・原記録：'+e.original));
    if(e.aliases.length)details.append(el('p','別表記：'+e.aliases.join('、')));
    const uses=Object.keys(D.usages).filter(k=>e.usageFlags[k]===1).map(k=>D.usages[k]);
    details.append(el('p','編集上のおすすめ用途：'+(uses.join('、')||'指定なし（直接選択できます）')),el('p','印象（編集判断）：'+e.impressionTags.join('、')));
    details.append(el('p','個別出典確認待ち。用途・印象は編集判断であり、人名の実在証明ではありません。'));
    const labels={name:'名称',reading:'読み',origin:'由来',form:'表記',classification:'分類'};
    for(const [key,label] of Object.entries(labels))details.append(el('p',label+'：'+e.verification[key]));
    details.append(el('p','参考資料：'+e.source.name),el('p',e.sourceScope));
    const url=D.safeUrl(e.source.url);
    if(url){const a=el('a','参考資料を開く（個別立証は未確認）');a.href=url;a.target='_blank';a.rel='noopener noreferrer';details.append(a);}
    if(e.source.note)details.append(el('p',e.source.note));
    const related=entries.filter(other=>other.id!==e.id&&(other.display===e.display||(e.relatedGroupUnconfirmed&&e.relatedGroupUnconfirmed===other.relatedGroupUnconfirmed)));
    if(related.length)details.append(el('p','関連候補（同一語義・異表記の関係は未確認）：'+related.map(r=>r.display+'［'+r.majorCategory+'・'+r.id+'］').join('、')));
    article.append(details);return article;
  }
  function append(){
    const shown=$('results').querySelectorAll('article[data-id]').length;
    const fragment=document.createDocumentFragment();
    for(const e of matched.slice(shown,limit))fragment.append(card(e));
    $('results').append(fragment);$('more').hidden=limit>=matched.length;
  }
  function render(){
    limit=36;
    matched=D.filter(entries,{query:$('search').value,group,categories:selected('categories'),minor:$('minor').value,
      usages:selected('usages'),impression:$('impression').value,ids:$('favoritesOnly').checked?new Set(favorites.ids()):null});
    const order=favorites.ids();
    matched.sort($('sort').value==='favorite'?(a,b)=>{
      const ai=order.indexOf(a.id),bi=order.indexOf(b.id);
      return (ai<0?Infinity:ai)-(bi<0?Infinity:bi)||D.compare(a,b);
    }:D.compare);
    $('results').replaceChildren();
    $('count').textContent='全'+entries.length+'候補 ／ 表示'+matched.length+'候補';
    if(!matched.length)$('results').append(el('p','該当する名前がありません。上の「条件をクリア」から探し直せます。'));
    append();
    if($('favoritesOnly').checked){
      for(const id of favorites.ids().filter(id=>!byId.has(id))){
        const a=el('article',undefined,'dictionary-card');a.append(el('p','この候補は現行辞典にありません（'+id+'）'),favoriteButton(id));$('results').append(a);
      }
    }
  }
  async function start(){
    $('loadError').hidden=true;$('loadStatus').hidden=false;$('filterControls').disabled=true;$('results').setAttribute('aria-busy','true');
    try{
      entries=await D.load();entries.forEach(e=>byId.set(e.id,e));
      favorites=D.favorites(()=>localStorage,message=>{$('storageWarning').hidden=false;$('storageWarning').textContent=message;});
      updateMinor();
      $('impression').replaceChildren(new Option('すべて',''),...[...new Set(entries.flatMap(e=>e.impressionTags))].sort((a,b)=>a.localeCompare(b,'ja')).map(t=>new Option(t,t)));
      $('loadStatus').hidden=true;$('filterControls').disabled=false;render();
    }catch{$('loadStatus').hidden=true;$('loadError').hidden=false;}
    finally{$('results').setAttribute('aria-busy','false');}
  }
  choices('categories',Object.fromEntries(D.categories.map(c=>[c,c])));choices('usages',D.usages);
  for(const value of ['','あ','か','さ','た','な','は','ま','や','ら','わ']){
    const b=el('button',value||'すべて');b.type='button';b.setAttribute('aria-pressed',String(!value));
    b.addEventListener('click',()=>{group=value;for(const btn of $('gojuon').children)btn.setAttribute('aria-pressed',String(btn===b));render();});$('gojuon').append(b);
  }
  $('filters').addEventListener('submit',e=>e.preventDefault());
  $('search').addEventListener('input',render);
  $('filters').addEventListener('change',e=>{if(e.target.id==='search')return;if(e.target.closest('#categories'))updateMinor();render();});
  $('clear').addEventListener('click',()=>{
    $('filters').reset();group='';for(const [i,b] of [...$('gojuon').children].entries())b.setAttribute('aria-pressed',String(i===0));updateMinor();render();$('search').focus();
  });
  $('more').addEventListener('click',()=>{
    const old=$('results').querySelectorAll('article[data-id]').length;limit+=36;append();
    const heading=$('results').querySelectorAll('article')[old]?.querySelector('h2');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}
  });
  $('retry').addEventListener('click',start);
  $('closeCopy').addEventListener('click',()=>{$('copyFallback').hidden=true;copyTrigger?.focus();});
  start();
})();
