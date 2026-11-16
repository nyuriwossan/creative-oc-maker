/* 創作OCメーカー v2.0 — 起動。失敗しても従来のキャラ作成は動かし続ける。 */
OCStudio.init().catch(function(e){
  console.error(e);
  var n=document.getElementById("studioNotice");
  if(n){n.hidden=false;n.textContent="図鑑などの新機能を読み込めませんでした。キャラ作成は従来どおり使えます。";}
});
