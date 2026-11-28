/* Wedding WN — Supabase bridge: provides window.claude.use(db|user|assets|downloads) for the planner page */
(function(){
  const SB_URL="https://ebbnmgngfufrdjkkmhnx.supabase.co";
  const SB_KEY="sb_publishable_izITuLxhn-vbIkTSKGTcsg_nzaVcPAs";
  const sb=window.supabase.createClient(SB_URL,SB_KEY,{auth:{flowType:"implicit",persistSession:true,detectSessionInUrl:true,autoRefreshToken:true}});
  window.__sb=sb;
  let email="",resolveReady;const ready=new Promise(r=>resolveReady=r);
  const T="planner_docs";
  const cache={},loaded={},subs={};
  const rid=()=>Array.from(crypto.getRandomValues(new Uint8Array(10)),b=>"abcdefghijklmnopqrstuvwxyz0123456789"[b%36]).join("");
  const clone=o=>JSON.parse(JSON.stringify(o));
  function emit(col){(subs[col]||new Set()).forEach(f=>{try{f()}catch(e){console.error(e)}})}
  async function load(col){
    if(loaded[col])return loaded[col];
    loaded[col]=(async()=>{const m=new Map();let from=0;
      for(;;){const {data,error}=await sb.from(T).select("id,data").eq("collection",col).range(from,from+999);
        if(error){loaded[col]=null;throw error}
        data.forEach(r=>m.set(r.id,r.data));if(data.length<1000)break;from+=1000}
      cache[col]=m;})();
    return loaded[col];
  }
  function snapCol(col){const m=cache[col]||new Map();return{docs:[...m.entries()].map(([id,d])=>({id,data:()=>clone(d)})),size:m.size,empty:!m.size}}
  function docRef(col,id){id=id||rid();return{id,
    async get(){await load(col);const d=cache[col].get(id);return{id,exists:!!d,data:()=>d?clone(d):undefined}},
    async set(data){const {error}=await sb.from(T).upsert({collection:col,id,data,updated_at:new Date().toISOString(),updated_by:email});
      if(error)throw Object.assign(new Error(error.message),{code:"write_failed"});(cache[col]||(cache[col]=new Map())).set(id,clone(data));emit(col)},
    async update(patch){await load(col);const cur=cache[col].get(id)||{};return this.set({...cur,...patch})},
    async delete(){const {error}=await sb.from(T).delete().eq("collection",col).eq("id",id);
      if(error)throw Object.assign(new Error(error.message),{code:"write_failed"});cache[col]&&cache[col].delete(id);emit(col)},
    onSnapshot(fn,err){const f=()=>{const d=cache[col]&&cache[col].get(id);fn({id,exists:!!d,data:()=>d?clone(d):undefined})};
      (subs[col]||(subs[col]=new Set())).add(f);load(col).then(f,e=>err&&err(e));return()=>subs[col].delete(f)}}}
  function colRef(col){const q={orderBy(){return q},where(){return q},limit(){return q},doc:(id)=>docRef(col,id),
    async get(){await load(col);return snapCol(col)},
    onSnapshot(fn,err){const f=()=>fn(snapCol(col));(subs[col]||(subs[col]=new Set())).add(f);load(col).then(f,e=>err&&err(e));return()=>subs[col].delete(f)}};return q}
  const db=Object.freeze({collection:colRef,doc(path){const [c,i]=path.split("/");return docRef(c,i)}});
  const user=Object.freeze({id:async()=>email,me:async()=>({id:email,name:email.split("@")[0]}),isOwner:()=>true,canEdit:()=>true,can:async()=>true,
    profiles:async ids=>Object.fromEntries(ids.map(i=>[i,{id:i,name:String(i).includes("@")?String(i).split("@")[0]:""}]))});
  // blobs (payment slips)
  const blobCache={};
  async function fetchBlob(id){if(id in blobCache)return blobCache[id];
    blobCache[id]=(async()=>{const {data}=await sb.from("planner_blobs").select("mime,data").eq("id",id).maybeSingle();
      if(!data)return null;const bin=atob(data.data),u8=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u8[i]=bin.charCodeAt(i);
      return URL.createObjectURL(new Blob([u8],{type:data.mime}))})();return blobCache[id]}
  window.blobUrl=function(id){fetchBlob(id).then(u=>{document.querySelectorAll('[data-blob="'+id+'"]').forEach(el=>{
      if(!u){const s=document.createElement("span");s.className="note";s.textContent="สลิปอยู่ในลิงก์เดิม";el.replaceWith(s);return}
      if(el.tagName==="A")el.href=u;else el.src=u})});return "data:image/gif;base64,R0lGODlhAQABAAAAACw="};
  const assets=Object.freeze({async upload(blob){if(blob.size>6e6)throw Object.assign(new Error("too large"),{code:"too_large"});
      const mime=blob.type||"image/jpeg";if(!/^(image\/(jpeg|png|webp|gif)|application\/pdf)$/.test(mime))throw Object.assign(new Error("type"),{code:"unsupported_type"});
      const b64=await new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>res(String(fr.result).split(",")[1]);fr.onerror=rej;fr.readAsDataURL(blob)});
      const {data,error}=await sb.from("planner_blobs").insert({mime,data:b64,size:blob.size,created_by:email}).select("id").single();
      if(error)throw Object.assign(new Error(error.message),{code:"upload_failed"});
      return{id:data.id,url:"",sizeBytes:blob.size,contentType:mime}}});
  const downloads=Object.freeze({async save({filename,data}){const b=data instanceof Blob?data:new Blob([data]);const u=URL.createObjectURL(b);
      const a=document.createElement("a");a.href=u;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),4000);return{status:"saved"}}});
  const map={db,user,assets,downloads};
  window.claude={use:async name=>{await ready;return map[name]||null}};
  // realtime
  function live(){sb.channel("planner-docs").on("postgres_changes",{event:"*",schema:"public",table:T},p=>{
      const r=(p.new&&p.new.collection)?p.new:p.old;if(!r||!r.collection||!cache[r.collection])return;
      if(p.eventType==="DELETE")cache[r.collection].delete(r.id);else cache[r.collection].set(r.id,p.new.data);emit(r.collection)}).subscribe()}
  // ---- login gate ----
  const $g=id=>document.getElementById(id);
  function gate(state,msg){const g=$g("gate");g.hidden=state==="in";g.dataset.state=state;if(msg!==undefined)$g("gMsg").textContent=msg}
  async function check(session){
    if(!session){gate("out","");return}
    email=(session.user.email||"").toLowerCase();
    const {data,error}=await sb.from("planner_members").select("email").eq("email",email).maybeSingle();
    if(error||!data){gate("denied",`อีเมล ${email} ยังไม่ได้รับสิทธิ์เข้าใช้งาน`);return}
    $g("whoami").textContent=email;gate("in");live();resolveReady();
  }
  document.addEventListener("DOMContentLoaded",()=>{
    $g("gForm").onsubmit=async e=>{e.preventDefault();const em=$g("gEmail").value.trim().toLowerCase();if(!em)return;
      $g("gBtn").disabled=true;$g("gMsg").textContent="กำลังส่งลิงก์…";
      const {error}=await sb.auth.signInWithOtp({email:em,options:{emailRedirectTo:location.origin+location.pathname,shouldCreateUser:true}});
      $g("gBtn").disabled=false;
      $g("gMsg").textContent=error?(/rate|seconds/i.test(error.message)?"ส่งบ่อยเกินไป รอสักครู่แล้วลองใหม่":"ส่งไม่สำเร็จ: "+error.message):`ส่งลิงก์ไปที่ ${em} แล้ว เปิดอีเมลแล้วกดลิงก์ในเบราว์เซอร์นี้`;
      if(!error)$g("gCodeRow").hidden=false};
    $g("gVerify").onclick=async()=>{const em=$g("gEmail").value.trim().toLowerCase(),tk=$g("gCode").value.trim();if(!em||!tk)return;
      const {error}=await sb.auth.verifyOtp({email:em,token:tk,type:"email"});if(error)$g("gMsg").textContent="รหัสไม่ถูกต้องหรือหมดอายุ"};
    document.querySelectorAll("[data-signout]").forEach(b=>b.onclick=async()=>{await sb.auth.signOut();location.reload()});
    // Public mode: anyone with the link can view and edit — no login needed.
    sb.auth.getSession().then(({data})=>{email=(data.session&&data.session.user.email||"").toLowerCase();gate("in");live();resolveReady()});
  });
})();
