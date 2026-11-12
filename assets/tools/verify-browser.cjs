const http=require('http'), fs=require('fs'), path=require('path'), {spawn}=require('child_process');
const root=path.resolve(__dirname,'..');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpeg':'image/jpeg','.webp':'image/webp'};
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html')));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}fs.readFile(file,(err,data)=>{res.writeHead(err?404:200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(err?'Not found':data);});});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 await new Promise(r=>server.listen(4173,'127.0.0.1',r));
 const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=9223','--user-data-dir='+path.join(root,'.qa-browser'),'about:blank'],{stdio:'ignore',windowsHide:true});
 let socket;
 try{
 let pages;for(let i=0;i<50;i++){try{pages=await(await fetch('http://127.0.0.1:9223/json')).json();break}catch{await pause(100)}}
 socket=new WebSocket(pages.find(x=>x.type==='page').webSocketDebuggerUrl);await new Promise(r=>socket.addEventListener('open',r,{once:true}));
 let id=0;const pending=new Map(),errors=[];
 socket.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result)}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text)});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});socket.send(JSON.stringify({id:n,method,params}))});
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value};
 const size=(width,height)=>send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
 const go=async url=>{await send('Page.navigate',{url:'http://127.0.0.1:4173/'+url});await pause(1200)};
 const shot=async name=>{const r=await send('Page.captureScreenshot',{format:'png'});fs.mkdirSync(path.join(root,'qa'),{recursive:true});fs.writeFileSync(path.join(root,'qa',name+'.png'),Buffer.from(r.data,'base64'))};
 const assert=(ok,label)=>{if(!ok)throw Error('FAIL: '+label);console.log('PASS: '+label)};
 await send('Runtime.enable');await send('Page.enable');
 await size(1200,630);await go('tools/social-card.html');
 const card=await send('Page.captureScreenshot',{format:'png'});
 fs.writeFileSync(path.join(root,'assets/images/social-card.png'),Buffer.from(card.data,'base64'));
 for(const width of [320,390,768,1024,1440]){
 await size(width,844);await go('index.html');
 assert(await evaluate('[...document.images].filter(im=>im.src.includes("logo-arlatruck") && im.loading!=="lazy").every(im=>im.complete && im.naturalWidth>0)'),'new logos load');
 assert(await evaluate('document.querySelector("link[rel=icon]").getAttribute("href")==="assets/icons/favicon-arlatruck.png"'),'new favicon linked');
 assert(await evaluate('document.documentElement.scrollWidth <= innerWidth'),width+'px: no horizontal overflow');
 await evaluate('document.querySelector("#contato").scrollIntoView({behavior:"instant",block:"start"})'); await pause(700);
 assert(await evaluate('!document.querySelector("#contato .btn-whatsapp") && !document.querySelector(".footer-hours")'),'repeated WhatsApp and footer hours removed');
 assert(await evaluate('[...document.querySelectorAll(".contact-routes-grid a, .footer-simple")].every(el => { const r=el.getBoundingClientRect(); return r.width>0 && r.left>=0 && r.right<=innerWidth; })'),'contact and footer fit viewport');
 if(width===390) await shot('mobile-contact');
 await evaluate('document.querySelector("footer").scrollIntoView({behavior:"instant",block:"start"})'); await pause(400);
 if(width===390) await shot('mobile-footer');
 await evaluate('window.scrollTo({top:0,behavior:"instant"})'); await pause(400);
 assert(await evaluate('document.querySelectorAll("main").length===1 && document.querySelectorAll("h1").length===1'),'semantic landmarks');
 if(width<=1100){
 await evaluate('document.querySelector(".mobile-toggle").focus(); document.querySelector(".mobile-toggle").click()');await pause(350);
 assert(await evaluate('document.querySelector(".drawer-close")===document.activeElement'),'drawer receives focus');
 assert(await evaluate('getComputedStyle(document.querySelector(".mobile-action-bar")).display==="none" && getComputedStyle(document.querySelector(".wa-widget")).display==="none"'),'contact overlays hidden with drawer open');
 assert(await evaluate('document.querySelector("main").inert && document.body.style.overflow==="hidden"'),'background inert and scroll locked');
 await evaluate('document.querySelector(".drawer-footer a").focus()');await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
 assert(await evaluate('document.activeElement.classList.contains("drawer-close")'),'Tab wraps inside menu');
 if(width===390)await shot('mobile-menu');
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
 await pause(350);
 assert(await evaluate('!document.body.classList.contains("menu-open") && document.querySelector(".mobile-toggle")===document.activeElement'),'Escape closes and restores focus');
 }
 if(width===390){assert(await evaluate('getComputedStyle(document.querySelector(".wa-widget")).display==="none"'),'floating WhatsApp removed on mobile');await shot('mobile-home');}
 if(width===1440){await shot('desktop-home');await evaluate('document.querySelector(".wa-floating-btn").click()');assert(await evaluate('!document.querySelector(".wa-popup").inert'),'desktop WhatsApp opens');await evaluate('document.querySelector(".wa-popup-close").click()');assert(await evaluate('document.querySelector(".wa-popup").inert'),'closed popup inert');}
 assert(await evaluate('document.querySelectorAll("details.faq-item").length===8'),'eight native FAQ items');
 await evaluate('document.querySelector("details:not([open]) summary").click()');
 assert(await evaluate('document.querySelectorAll("details[open]").length===2'),'FAQ toggles');
 }
 await send('Emulation.setScriptExecutionDisabled',{value:true});await size(390,844);await go('index.html');
 assert(await evaluate('getComputedStyle(document.querySelector("h1")).opacity==="1"'),'content visible without JavaScript');
 await send('Emulation.setScriptExecutionDisabled',{value:false});await go('privacidade.html');assert(await evaluate('document.querySelector("h1").textContent==="Privacidade"'),'privacy page loads');
 assert(errors.length===0,'no JavaScript runtime exceptions');
 console.log('Browser verification completed.');
 }finally{socket?.close();chrome.kill();server.close()}
})().catch(e=>{console.error(e);process.exitCode=1;server.close()});
