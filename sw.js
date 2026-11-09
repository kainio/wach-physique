/* Wach?! plateau — service worker : hors ligne après la première visite */
const V='wach-plateau-v15';
const PRE=['./','index.html','1v1.html','multi.html','simple-1v1.html','simple-multi.html','video.html','manifest.webmanifest',
  'icons/icon-192.png','icons/icon-512.png','icons/maskable-512.png','icons/apple-touch-icon.png','icons/favicon.png'];
self.addEventListener('install',e=>{
  /* 'reload' : on ignore le cache HTTP du navigateur ou de l’hébergeur, sinon l’ancienne version serait recopiée dans le cache */
  const get=(c,u)=>fetch(new Request(u,{cache:'reload'})).then(r=>{if(!r.ok)throw new Error(u);return c.put(u,r);});
  e.waitUntil(caches.open(V).then(c=>Promise.all(PRE.map(u=>get(c,u))).then(()=>Promise.all(['explainer.mp4','explainer-poster.jpg','explainer-vertical.mp4','explainer-vertical-poster.jpg'].map(u=>get(c,u).catch(()=>{}))))).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V&&k!==V+'-fonts').map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});

/* vidéo : Safari exige les requêtes Range, que le cache ne sait pas servir seul */
async function vidRes(r){
  const c=await caches.open(V),key=new Request(r.url);
  let res=await c.match(key);
  if(!res){
    try{res=await fetch(key);}catch(e){return Response.error();}
    if(!res||res.status!==200)return res;
    c.put(key,res.clone());
  }
  const rg=r.headers.get('range');
  if(!rg)return res;
  const m=/bytes=(\d*)-(\d*)/.exec(rg),buf=await res.arrayBuffer(),n=buf.byteLength;
  let a=m&&m[1]!==''?parseInt(m[1],10):0,b=m&&m[2]!==''?parseInt(m[2],10):n-1;
  if(m&&m[1]===''&&m[2]!==''){a=Math.max(0,n-parseInt(m[2],10));b=n-1;}
  b=Math.min(b,n-1);
  if(a>b)return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+n}});
  const part=buf.slice(a,b+1);
  return new Response(part,{status:206,headers:{'Content-Type':'video/mp4','Content-Range':'bytes '+a+'-'+b+'/'+n,'Content-Length':String(part.byteLength),'Accept-Ranges':'bytes'}});
}
self.addEventListener('fetch',e=>{
  const r=e.request;
  if(r.method!=='GET')return;
  const u=new URL(r.url);
  if(u.origin===location.origin){
    if(/\.mp4$/.test(u.pathname)){e.respondWith(vidRes(r));return;}
    if(r.mode==='navigate'){
      e.respondWith(fetch(r.url,{cache:'no-store'}).then(res=>{const cp=res.clone();caches.open(V).then(c=>c.put(r.url,cp));return res;})
        .catch(()=>caches.match(r.url,{ignoreSearch:true}).then(m=>m||caches.match('index.html'))));
      return;
    }
    e.respondWith(caches.match(r).then(m=>m||fetch(r).then(res=>{const cp=res.clone();caches.open(V).then(c=>c.put(r,cp));return res;})));
    return;
  }
  if(/(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)){
    e.respondWith(caches.open(V+'-fonts').then(c=>c.match(r).then(m=>{
      const f=fetch(r).then(res=>{c.put(r,res.clone());return res;}).catch(()=>m);
      return m||f;
    })));
  }
});
