'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
module.exports=(root,prefix='')=>http.createServer((req,res)=>{
  try{
    let requested=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(prefix){if(!requested.startsWith(prefix+'/')){res.writeHead(404);res.end();return;}requested=requested.slice(prefix.length);}
    const file=path.resolve(root,'.'+(requested.endsWith('/')?requested+'index.html':requested));
    if(!file.startsWith(path.resolve(root)+path.sep)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
    const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.webmanifest':'application/manifest+json'};
    res.setHeader('Content-Type',(mime[path.extname(file)]||'text/plain')+'; charset=utf-8');res.end(fs.readFileSync(file));
  }catch{res.writeHead(404);res.end();}
});
