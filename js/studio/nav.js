/* 創作OCメーカー v2.0 — 共通ナビゲーション（現在の作品カード＋5タブ）。
   index.html と dictionary.html の両方が、<div id="studioNav"> の直後でこのファイルを読み込む。
   マークアップはここ1か所だけなので、変更は両ページに反映される。 */
(function(){
"use strict";
var host=document.getElementById("studioNav");if(!host)return;
var standalone=host.getAttribute("data-page")==="dictionary"; // タブの中身を持たないページ
var TABS=[["create","作成"],["zukan","図鑑"],["height","身長比較"],["relation","相関図"],["world","世界観"]];
var GEAR='<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
host.innerHTML=
  '<section class="st-project" id="studioBar" aria-label="現在の作品">'+
    '<div class="st-project-head"><label for="projectSelect">現在の作品</label><span id="saveStatus" class="st-status" role="status"></span></div>'+
    '<div class="st-project-row"><select id="projectSelect" aria-label="作品を選ぶ"></select>'+
    '<button id="projectMenuBtn" class="st-gear" type="button" aria-label="作品の管理" title="作品の管理">'+GEAR+'</button></div>'+
  '</section>'+
  '<p id="studioNotice" role="alert" hidden></p>'+
  '<div class="st-tabs" id="studioTabs" role="tablist" aria-label="機能の切り替え">'+
  TABS.map(function(t,i){
    return '<button type="button" role="tab" data-tab="'+t[0]+'"'+(standalone?"":' aria-controls="tab-'+t[0]+'"')+' aria-selected="'+(i===0)+'"'+(i===0?"":' tabindex="-1"')+'>'+t[1]+'</button>';
  }).join("")+'</div>';
document.documentElement.classList.add(standalone?"st-standalone":"st-app");
})();
