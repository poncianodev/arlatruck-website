const fs=require('fs'),path=require('path'),assert=require('assert/strict');
for(const file of ['index.html','privacidade.html','404.html']){
 const h=fs.readFileSync(file,'utf8');
 const ids=[...h.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
 assert.equal(new Set(ids).size,ids.length,`${file}: duplicate ids`);
 for(const [,id] of h.matchAll(/href="#([^"]+)"/g))assert(ids.includes(id),`${file}: broken anchor ${id}`);
 for(const [,url] of h.matchAll(/(?:src|href)="([^"?#]+)(?:\?[^" ]*)?"/g)){
  if(/^[a-z]+:|^\/\//i.test(url))continue;
  assert(fs.existsSync(path.resolve(url.replace(/^\//,''))),`${file}: missing ${url}`);
 }
 for(const [,json] of h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g))JSON.parse(json);
 for(const [,set] of h.matchAll(/(?:imagesrcset|srcset)="([^"]+)"/g)){
  for(const entry of set.split(','))assert(fs.existsSync(entry.trim().split(/\s+/)[0]),`${file}: missing responsive image ${entry}`);
 }
 assert.equal((h.match(/<main\b/g)||[]).length,1,`${file}: main`);
 assert.equal((h.match(/<h1\b/g)||[]).length,1,`${file}: h1`);
 console.log('PASS: '+file+' — assets, anchors, IDs, landmarks and JSON');
}
const stylesheet='assets/css/style.css';
for(const [,url] of fs.readFileSync(stylesheet,'utf8').matchAll(/url\(['"]?([^'"\)]+)['"]?\)/g)){
 if(!/^(?:https?:|data:|#)/.test(url))assert(fs.existsSync(path.resolve(path.dirname(stylesheet),url)),`CSS: missing ${url}`);
}
console.log('PASS: responsive images and CSS asset paths');
