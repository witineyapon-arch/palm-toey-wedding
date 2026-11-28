// Wedding WN — minimal service worker so the planner can be installed as an app.
// Always uses the network (data must stay live); falls back to the cached page when offline.
const C="wn-planner-v1";
self.addEventListener("install",e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(["./","index.html","icon-192.png"])).catch(()=>{}));self.skipWaiting()});
self.addEventListener("activate",e=>e.waitUntil(self.clients.claim()));
self.addEventListener("fetch",e=>{const r=e.request;if(r.method!=="GET"||new URL(r.url).origin!==location.origin)return;
  e.respondWith(fetch(r).then(res=>{if(r.mode==="navigate"){const cp=res.clone();caches.open(C).then(c=>c.put("index.html",cp))}return res}).catch(()=>caches.match(r).then(m=>m||caches.match("index.html"))))});
