/* PALM & TOEY · Wedding Gallery — shared helpers (guest page + admin page) */
(function () {
  'use strict';
  const C = window.WG_CONFIG;
  const SCRIPT_SRC = (document.currentScript && document.currentScript.src) || location.href;
  const WG = (window.WG = {});

  WG.sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'wg-admin-auth' },
    realtime: { params: { eventsPerSecond: 5 } }
  });

  /* ---------- small utils ---------- */
  WG.$ = (s, r) => (r || document).querySelector(s);
  WG.$$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  WG.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  WG.fmtBytes = (b) => {
    b = Number(b) || 0;
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b / 1024).toFixed(0) + ' KB';
    if (b < 1073741824) return (b / 1048576).toFixed(1) + ' MB';
    return (b / 1073741824).toFixed(2) + ' GB';
  };
  WG.fmtTime = (iso) => {
    try {
      return new Date(iso).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch (e) { return ''; }
  };
  WG.timeAgo = (iso) => {
    const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return 'เมื่อสักครู่';
    if (s < 3600) return Math.floor(s / 60) + ' นาทีที่แล้ว';
    if (s < 86400) return Math.floor(s / 3600) + ' ชั่วโมงที่แล้ว';
    return WG.fmtTime(iso);
  };
  WG.store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  WG.uuid = () => {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    const b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  };
  WG.bkkDate = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);

  /* ---------- toast ---------- */
  let toastTimer;
  WG.toast = (msg, kind) => {
    let t = WG.$('#wgToast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'wgToast'; t.className = 'wg-toast'; t.setAttribute('role', 'status'); t.setAttribute('aria-live', 'polite');
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.dataset.kind = kind || 'info';
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 3800);
  };

  /* ---------- download / share a photo ---------- */
  WG.fileName = (p) => 'PalmToey-' + String(p.created_at || '').slice(0, 10) + '-' + String(p.id).slice(0, 8) + '.jpg';
  WG.downloadUrl = (p) => p.image_url + '?download=' + encodeURIComponent(WG.fileName(p));
  const blobCache = new Map();
  WG.prefetchBlob = (p) => {
    if (blobCache.has(p.id)) return blobCache.get(p.id);
    const pr = fetch(p.image_url, { mode: 'cors' }).then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.blob(); });
    pr.catch(() => blobCache.delete(p.id));
    blobCache.set(p.id, pr);
    if (blobCache.size > 6) blobCache.delete(blobCache.keys().next().value);
    return pr;
  };
  WG.isTouch = () => matchMedia('(pointer:coarse)').matches;
  // On phones: share sheet → "Save Image" puts it straight into Photos. Elsewhere: real file download.
  WG.downloadPhoto = async (p) => {
    if (WG.isTouch() && navigator.canShare) {
      try {
        const blob = await WG.prefetchBlob(p);
        const file = new File([blob], WG.fileName(p), { type: 'image/jpeg' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: 'PALM & TOEY · 12.12.2026' });
          return;
        }
      } catch (e) {
        if (e && e.name === 'AbortError') return; // user closed the sheet
      }
    }
    const a = document.createElement('a');
    a.href = WG.downloadUrl(p); a.rel = 'noopener'; a.download = WG.fileName(p);
    document.body.appendChild(a); a.click(); a.remove();
  };

  WG.shareSite = async (url) => {
    const data = { title: 'PALM & TOEY · Wedding Gallery', text: 'มาช่วยกันแชร์รูปงานแต่ง PALM & TOEY 12.12.2026 กันนะ', url };
    if (navigator.share) {
      try { await navigator.share(data); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    try { await navigator.clipboard.writeText(url); WG.toast('คัดลอกลิงก์แล้ว ส่งต่อให้เพื่อนได้เลย'); }
    catch (e) { window.prompt('คัดลอกลิงก์นี้', url); }
  };

  /* ---------- file validation (magic bytes, not just the extension) ---------- */
  WG.sniffType = async (file) => {
    const b = new Uint8Array(await file.slice(0, 32).arrayBuffer());
    const s = (i, n) => String.fromCharCode.apply(null, b.slice(i, i + n));
    if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
    if (b[0] === 0x89 && s(1, 3) === 'PNG') return 'png';
    if (s(0, 4) === 'RIFF' && s(8, 4) === 'WEBP') return 'webp';
    if (s(4, 4) === 'ftyp') {
      const brand = s(8, 4).toLowerCase();
      if (['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1', 'avif'].indexOf(brand) >= 0) return brand === 'avif' ? 'avif' : 'heic';
    }
    return null;
  };

  /* ---------- decode + resize (strips EXIF/GPS, fixes orientation) ---------- */
  let heicLib;
  function loadHeicLib() {
    if (!heicLib) {
      heicLib = new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = new URL('../vendor/heic2any.min.js', SCRIPT_SRC).href;
        s.onload = () => res(window.heic2any); s.onerror = () => { heicLib = null; rej(new Error('heic lib')); };
        document.head.appendChild(s);
      });
    }
    return heicLib;
  }
  function decodeViaImg(blob) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => res({ src: img, w: img.naturalWidth, h: img.naturalHeight, done: () => URL.revokeObjectURL(url) });
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('decode')); };
      img.src = url;
    });
  }
  async function decode(blob) {
    if (window.createImageBitmap) {
      try {
        const bm = await createImageBitmap(blob, { imageOrientation: 'from-image' });
        return { src: bm, w: bm.width, h: bm.height, done: () => bm.close && bm.close() };
      } catch (e) { /* fall through */ }
    }
    return decodeViaImg(blob);
  }
  async function decodeAny(file, kind) {
    try { return await decode(file); }
    catch (e) {
      if (kind !== 'heic') throw e;
      const heic2any = await loadHeicLib();
      let out = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 });
      if (Array.isArray(out)) out = out[0];
      return decode(out);
    }
  }
  function toJpeg(img, maxEdge, q) {
    const scale = Math.min(1, maxEdge / Math.max(img.w, img.h));
    const w = Math.max(1, Math.round(img.w * scale)), h = Math.max(1, Math.round(img.h * scale));
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d', { alpha: false });
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h); // PNG transparency → white
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img.src, 0, 0, w, h);
    return new Promise((res, rej) => c.toBlob((b) => {
      c.width = c.height = 0; // free memory on iOS
      b ? res({ blob: b, w, h }) : rej(new Error('encode'));
    }, 'image/jpeg', q));
  }
  WG.processImage = async (file, kind) => {
    const img = await decodeAny(file, kind);
    try {
      const full = await toJpeg(img, C.FULL_MAX_EDGE, C.FULL_QUALITY);
      const thumb = await toJpeg(img, C.THUMB_MAX_EDGE, C.THUMB_QUALITY);
      return { full, thumb };
    } finally { img.done(); }
  };

  /* ---------- upload one blob to Storage with progress (XHR) ---------- */
  WG.uploadBlob = (path, blob, onProgress) => new Promise((res, rej) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', C.SUPABASE_URL + '/storage/v1/object/' + C.BUCKET + '/' + path);
    xhr.setRequestHeader('apikey', C.SUPABASE_ANON_KEY);
    xhr.setRequestHeader('Authorization', 'Bearer ' + C.SUPABASE_ANON_KEY);
    xhr.setRequestHeader('Content-Type', 'image/jpeg');
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.setRequestHeader('cache-control', 'max-age=31536000');
    xhr.timeout = 120000;
    if (xhr.upload && onProgress) xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return res();
      let msg = 'HTTP ' + xhr.status;
      try { const j = JSON.parse(xhr.responseText); msg = j.message || j.error || msg; } catch (e) {}
      const err = new Error(msg); err.status = xhr.status; rej(err);
    };
    xhr.onerror = () => { const e = new Error('network'); e.network = true; rej(e); };
    xhr.ontimeout = () => { const e = new Error('timeout'); e.network = true; rej(e); };
    xhr.send(blob);
  });

  WG.withRetry = async (fn, tries) => {
    let last;
    for (let i = 0; i < (tries || 3); i++) {
      try { return await fn(i); }
      catch (e) {
        last = e;
        if (!(e.network || (e.status >= 500))) throw e;
        await new Promise((r) => setTimeout(r, 1200 * (i + 1)));
      }
    }
    throw last;
  };

  /* ---------- settings ---------- */
  WG.getSettings = async () => {
    const { data, error } = await WG.sb.from('wedding_settings').select('*').eq('id', 1).maybeSingle();
    if (error) throw error;
    return data || { uploads_enabled: true, notice_message: '', closed_message: '' };
  };
})();
