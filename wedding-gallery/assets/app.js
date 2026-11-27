/* PALM & TOEY · Wedding Gallery — guest page (home / upload / gallery) */
(function () {
  'use strict';
  const C = window.WG_CONFIG, WG = window.WG, sb = WG.sb, $ = WG.$;
  const GALLERY_URL = location.origin + location.pathname; // the real, live URL of this page
  let settings = { uploads_enabled: true, notice_message: '', closed_message: '' };

  /* ======================= router ======================= */
  const views = { '': $('#vHome'), upload: $('#vUpload'), gallery: $('#vGallery') };
  let current = null;
  function route() {
    const key = (location.hash || '').replace(/^#\/?/, '');
    const name = views[key] ? key : '';
    if (name === current) return;
    if (current === 'upload' && uploading) { // never lose an upload in progress
      history.replaceState(null, '', '#upload');
      WG.toast('กำลังอัปโหลดอยู่ กรุณารอสักครู่นะ');
      return;
    }
    current = name;
    Object.keys(views).forEach((k) => (views[k].hidden = k !== name));
    $('#foot').hidden = name === 'upload';
    window.scrollTo(0, 0);
    if (name === 'gallery') Gallery.enter();
    document.title = (name === 'upload' ? 'Upload · ' : name === 'gallery' ? 'Shared Memories · ' : 'Wedding Gallery · ') + 'Palm & Toey · 12.12.2026';
  }
  window.addEventListener('hashchange', route);
  window.addEventListener('scroll', () => $('#top').classList.toggle('scrolled', scrollY > 8), { passive: true });
  $('#shareTop').addEventListener('click', () => WG.shareSite(GALLERY_URL));

  /* ======================= settings & counters ======================= */
  function applySettings() {
    const open = !!settings.uploads_enabled;
    const hn = $('#homeNotice'), un = $('#upNotice');
    const msg = open ? (settings.notice_message || '').trim() : (settings.closed_message || 'ตอนนี้ปิดรับรูปภาพแล้ว ขอบคุณทุกคนนะ').trim();
    hn.hidden = !msg; hn.textContent = msg; hn.classList.toggle('closed', !open);
    un.hidden = !(open && msg); un.textContent = open ? msg : '';
    $('#upClosed').hidden = open; $('#upClosed').textContent = open ? '' : msg;
    $('#upOpen').hidden = !open;
    $('#upBar').hidden = !open;
    $('#galFab').hidden = !open;
    const cta = $('#ctaUpload');
    cta.classList.toggle('is-closed', !open);
    cta.querySelector('small').textContent = open ? 'อัปโหลดรูปจากโทรศัพท์' : 'ปิดรับรูปภาพแล้ว';
  }
  async function loadSettings() {
    try { settings = await WG.getSettings(); applySettings(); } catch (e) { /* keep defaults */ }
  }
  async function loadCount() {
    const { count, error } = await sb.from(C.TABLE).select('id', { count: 'exact', head: true });
    if (error) return;
    $('#homeCountN').textContent = count; $('#homeCount').hidden = !count;
    $('#galCount').textContent = count;
  }

  /* ======================= upload ======================= */
  const picked = []; // {id, file, kind, url, el, state}
  let uploading = false;
  $('#maxFiles').textContent = C.MAX_FILES_PER_BATCH;
  const nameInput = $('#nameInput');
  nameInput.value = WG.store.get('wg-name') || '';
  nameInput.addEventListener('change', () => WG.store.set('wg-name', nameInput.value.trim()));

  const fileInput = $('#fileInput'), drop = $('#drop');
  fileInput.addEventListener('change', () => { addFiles(fileInput.files); fileInput.value = ''; });
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, () => drop.classList.remove('over')));
  drop.addEventListener('drop', (e) => { e.preventDefault(); if (e.dataTransfer) addFiles(e.dataTransfer.files); });

  function showErr(msg) { const el = $('#upErr'); el.hidden = !msg; el.textContent = msg || ''; }

  async function addFiles(list) {
    if (uploading) return;
    showErr('');
    const files = Array.from(list || []);
    const problems = [];
    for (const f of files) {
      if (picked.filter((p) => p.state !== 'done').length >= C.MAX_FILES_PER_BATCH) { problems.push('เลือกได้สูงสุดครั้งละ ' + C.MAX_FILES_PER_BATCH + ' รูป'); break; }
      if (f.size > C.MAX_INPUT_MB * 1048576) { problems.push(f.name + ' ใหญ่เกิน ' + C.MAX_INPUT_MB + 'MB'); continue; }
      if (f.size < 100) { problems.push(f.name + ' ไม่ใช่ไฟล์รูปภาพ'); continue; }
      let kind = null;
      try { kind = await WG.sniffType(f); } catch (e) {}
      if (!kind) { problems.push((f.name || 'ไฟล์') + ' ไม่ใช่ไฟล์รูปภาพที่รองรับ'); continue; }
      if (picked.some((p) => p.file.name === f.name && p.file.size === f.size && p.file.lastModified === f.lastModified && p.state !== 'done')) continue;
      const item = { id: WG.uuid(), file: f, kind, state: 'ready' };
      picked.push(item);
      renderPreview(item);
    }
    if (problems.length) showErr(problems.slice(0, 3).join(' · ') + (problems.length > 3 ? ' …' : ''));
    syncPicked();
  }

  function renderPreview(item) {
    const el = document.createElement('div');
    el.className = 'pv';
    const canPreview = item.kind !== 'heic' || /safari/i.test(navigator.userAgent) && !/chrome|crios|android/i.test(navigator.userAgent);
    if (canPreview) {
      item.url = URL.createObjectURL(item.file);
      const img = new Image(); img.alt = ''; img.decoding = 'async'; img.loading = 'lazy'; img.src = item.url;
      img.onerror = () => { img.remove(); el.insertAdjacentHTML('afterbegin', '<span class="ph">' + item.kind.toUpperCase() + '</span>'); };
      el.appendChild(img);
    } else {
      el.insertAdjacentHTML('afterbegin', '<span class="ph">HEIC</span>');
    }
    el.insertAdjacentHTML('beforeend', '<button class="x" type="button" aria-label="ลบรูปนี้"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button><div class="st"><i></i></div>');
    el.querySelector('.x').addEventListener('click', () => removeItem(item));
    item.el = el;
    $('#previews').appendChild(el);
  }
  function removeItem(item) {
    if (uploading) return;
    const i = picked.indexOf(item);
    if (i >= 0) picked.splice(i, 1);
    if (item.url) URL.revokeObjectURL(item.url);
    item.el.remove();
    syncPicked();
  }
  $('#clearAll').addEventListener('click', () => { if (!uploading) picked.slice().forEach(removeItem); showErr(''); });

  function pending() { return picked.filter((p) => p.state === 'ready' || p.state === 'fail'); }
  function syncPicked() {
    const n = pending().length;
    $('#pickedWrap').hidden = picked.length === 0;
    $('#pickedN').textContent = picked.length;
    $('#uploadBtn').disabled = uploading || n === 0;
    $('#uploadBtnText').textContent = uploading ? 'Uploading…' : n ? 'Upload ' + n + ' photo' + (n > 1 ? 's' : '') : 'Upload photos';
  }

  function setItemProgress(item, f) { item.progress = f; const bar = item.el.querySelector('.st i'); if (bar) bar.style.width = Math.round(f * 100) + '%'; }

  async function uploadOne(item, uploader) {
    item.el.classList.remove('fail'); item.el.classList.add('busy');
    setItemProgress(item, 0.05);
    const { full, thumb } = await WG.processImage(item.file, item.kind);
    if (full.blob.size > 10 * 1048576) throw new Error('ไฟล์ใหญ่เกินไปหลังย่อขนาด');
    setItemProgress(item, 0.2);
    const name = WG.bkkDate() + '/' + WG.uuid() + '.jpg';
    const photoPath = 'photos/' + name, thumbPath = 'thumbs/' + name;
    await WG.withRetry(() => WG.uploadBlob(thumbPath, thumb.blob));
    setItemProgress(item, 0.3);
    await WG.withRetry(() => WG.uploadBlob(photoPath, full.blob, (f) => setItemProgress(item, 0.3 + f * 0.62)));
    await WG.withRetry(async () => {
      const { error } = await sb.from(C.TABLE).insert({ storage_path: photoPath, thumb_path: thumbPath, uploader_name: uploader || null, width: full.w, height: full.h });
      if (error) { const e = new Error(error.message); if (/fetch|network/i.test(error.message)) e.network = true; throw e; }
    });
    setItemProgress(item, 1);
  }

  let wakeLock = null;
  async function startUpload() {
    if (uploading) return;
    const queue = pending();
    if (!queue.length) return;
    // re-check that uploads are still open
    await loadSettings();
    if (!settings.uploads_enabled) { WG.toast('ตอนนี้ปิดรับรูปภาพแล้ว', 'error'); return; }
    uploading = true; showErr('');
    syncPicked();
    $('#uploadBtn').classList.add('is-busy');
    $('#prog').hidden = false;
    try { if (navigator.wakeLock) wakeLock = await navigator.wakeLock.request('screen'); } catch (e) {}
    const uploader = nameInput.value.trim().slice(0, 40);
    WG.store.set('wg-name', uploader);
    queue.forEach((it) => { it.state = 'queued'; setItemProgress(it, 0); });
    let ok = 0, fail = 0, lastErr = '';
    const total = queue.length;
    const tick = () => {
      const sum = queue.reduce((a, it) => a + (it.progress || 0), 0);
      const pct = Math.round((sum / total) * 100);
      $('#progFill').style.width = pct + '%';
      $('#progPct').textContent = pct + '%';
      $('#progText').textContent = 'อัปโหลดแล้ว ' + ok + ' / ' + total + ' รูป' + (fail ? ' · ไม่สำเร็จ ' + fail : '');
    };
    const timer = setInterval(tick, 250);
    let idx = 0;
    const worker = async () => {
      while (idx < queue.length) {
        const it = queue[idx++];
        try {
          await uploadOne(it, uploader);
          it.state = 'done'; ok++;
          it.el.classList.remove('busy'); it.el.classList.add('done');
        } catch (e) {
          it.state = 'fail'; fail++;
          it.el.classList.remove('busy'); it.el.classList.add('fail');
          lastErr = e && e.message || 'error';
          console.warn('upload failed', e);
        }
      }
    };
    await Promise.all([worker(), worker()]); // 2 at a time: fast but gentle on mobile data
    clearInterval(timer); tick();
    uploading = false;
    $('#uploadBtn').classList.remove('is-busy');
    try { wakeLock && wakeLock.release(); } catch (e) {} wakeLock = null;
    syncPicked();
    Gallery.invalidate();
    loadCount();
    showResult(ok, fail, lastErr);
  }
  $('#uploadBtn').addEventListener('click', startUpload);
  window.addEventListener('beforeunload', (e) => { if (uploading) { e.preventDefault(); e.returnValue = ''; } });

  function friendly(err) {
    if (/row-level security|policy|403|Unauthorized/i.test(err)) return 'ระบบปิดรับรูปภาพอยู่ หรือไม่มีสิทธิ์อัปโหลด';
    if (/network|timeout|fetch/i.test(err)) return 'อินเทอร์เน็ตไม่เสถียร ลองอีกครั้งเมื่อสัญญาณดีขึ้น';
    if (/decode|heic/i.test(err)) return 'อ่านไฟล์รูปบางไฟล์ไม่ได้';
    if (/size|large|ใหญ่/i.test(err)) return 'ไฟล์ใหญ่เกินไป';
    return 'เกิดข้อผิดพลาด ลองใหม่อีกครั้ง';
  }
  function showResult(ok, fail, lastErr) {
    $('#sheetTitle').textContent = fail && !ok ? 'UPLOAD FAILED' : 'UPLOAD COMPLETE';
    $('#sheet').querySelector('.big').textContent = fail && !ok ? 'Oops' : 'Thank you';
    $('#sheetText').textContent = (ok ? 'อัปโหลดสำเร็จ ' + ok + ' รูป ขอบคุณที่ร่วมเก็บความทรงจำนะ' : '') + (fail ? (ok ? ' · ' : '') + 'ไม่สำเร็จ ' + fail + ' รูป (' + friendly(lastErr) + ')' : '');
    $('#sheetRetry').hidden = !fail;
    $('#sheetGallery').hidden = !ok;
    $('#sheet').hidden = false;
    if (ok && navigator.vibrate) navigator.vibrate(30);
  }
  function closeSheet() { $('#sheet').hidden = true; }
  $('#sheetGallery').addEventListener('click', () => { closeSheet(); clearDone(); });
  $('#sheetMore').addEventListener('click', () => { closeSheet(); clearDone(); fileInput.click(); });
  $('#sheetRetry').addEventListener('click', () => { closeSheet(); startUpload(); });
  function clearDone() { picked.filter((p) => p.state === 'done').forEach((p) => { p.state = 'x'; removeItemForce(p); }); syncPicked(); }
  function removeItemForce(item) { const i = picked.indexOf(item); if (i >= 0) picked.splice(i, 1); if (item.url) URL.revokeObjectURL(item.url); item.el.remove(); }

  /* ======================= gallery ======================= */
  const Gallery = (function () {
    const box = $('#masonry');
    let items = [], ids = new Set(), cursor = null, done = false, loading = false, started = false, stale = false;
    let cols = [], colH = [], ncols = 0, fresh = [];
    const io = 'IntersectionObserver' in window ? new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) more(); }, { rootMargin: '900px 0px' }) : null;
    const imgIO = 'IntersectionObserver' in window ? new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { const im = e.target; im.src = im.dataset.src; imgIO.unobserve(im); } }), { rootMargin: '600px 0px' }) : null;

    function colCount() { const w = box.clientWidth || innerWidth; return w < 560 ? 2 : w < 900 ? 3 : w < 1200 ? 4 : 5; }
    function layout() {
      ncols = colCount(); box.innerHTML = ''; cols = []; colH = [];
      for (let i = 0; i < ncols; i++) { const c = document.createElement('div'); c.className = 'mcol'; box.appendChild(c); cols.push(c); colH.push(0); }
      items.forEach((p, i) => place(p, i, false));
    }
    function place(p, i, isNew) {
      let k = 0; for (let j = 1; j < ncols; j++) if (colH[j] < colH[k] - 0.01) k = j;
      const ratio = p.width && p.height ? p.height / p.width : 1.3;
      colH[k] += ratio;
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'tile sk' + (isNew ? ' new' : ''); b.style.aspectRatio = (p.width || 3) + ' / ' + (p.height || 4);
      b.dataset.i = i;
      b.setAttribute('aria-label', 'เปิดรูป' + (p.uploader_name ? ' จาก ' + p.uploader_name : ''));
      const img = new Image(); img.alt = p.uploader_name ? 'Photo by ' + p.uploader_name : 'Wedding photo'; img.decoding = 'async';
      img.onload = () => { img.classList.add('in'); b.classList.remove('sk'); };
      img.onerror = () => { if (img.dataset.tried) { b.remove(); return; } img.dataset.tried = 1; img.src = p.image_url; };
      const src = p.thumb_url || p.image_url;
      if (imgIO) { img.dataset.src = src; imgIO.observe(img); } else { img.loading = 'lazy'; img.src = src; }
      b.appendChild(img);
      if (p.uploader_name) b.insertAdjacentHTML('beforeend', '<span class="who">📷 ' + WG.esc(p.uploader_name) + '</span>');
      b.addEventListener('click', () => Lightbox.open(+b.dataset.i));
      cols[k].appendChild(b);
    }
    async function more() {
      if (loading || done) return;
      loading = true; $('#galSpin').hidden = false; $('#loadMore').hidden = true; $('#galErr').hidden = true;
      try {
        let q = sb.from(C.TABLE).select('id,image_url,thumb_url,uploader_name,width,height,created_at').order('created_at', { ascending: false }).order('id', { ascending: false }).limit(C.PAGE_SIZE);
        if (cursor) q = q.lt('created_at', cursor);
        const { data, error } = await q;
        if (error) throw error;
        const rows = (data || []).filter((r) => !ids.has(r.id));
        rows.forEach((r) => { ids.add(r.id); items.push(r); place(r, items.length - 1, false); });
        if (data && data.length) cursor = data[data.length - 1].created_at;
        if (!data || data.length < C.PAGE_SIZE) done = true;
      } catch (e) {
        $('#galErr').hidden = false; $('#galErr').textContent = 'โหลดรูปไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่';
        $('#loadMore').hidden = false;
      } finally {
        loading = false; $('#galSpin').hidden = true;
        $('#galEmpty').hidden = items.length > 0 || !done;
        $('#galEnd').hidden = !(done && items.length > 0);
        if (!io && !done) $('#loadMore').hidden = false;
      }
    }
    function reset() { items = []; ids = new Set(); cursor = null; done = false; fresh = []; hidePill(); layout(); }
    function enter() {
      if (!started) { started = true; layout(); if (io) io.observe($('#sentinel')); more(); subscribe(); return; }
      if (stale) { stale = false; reset(); more(); }
      else if (colCount() !== ncols) layout();
    }
    function invalidate() { stale = true; }
    $('#loadMore').addEventListener('click', more);
    let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (started && colCount() !== ncols) layout(); }, 200); });

    // live: photos uploaded by other guests appear without reloading
    function subscribe() {
      sb.channel('wedding-photos-feed')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: C.TABLE }, (payload) => {
          const r = payload.new; if (!r || r.status !== 'approved' || ids.has(r.id)) return;
          fresh.push(r); showPill(); loadCount();
        }).subscribe();
    }
    let pill;
    function showPill() {
      if (current !== 'gallery') { applyFresh(); return; }
      if (!pill) { pill = document.createElement('button'); pill.type = 'button'; pill.className = 'newpill'; pill.addEventListener('click', () => { applyFresh(); scrollTo({ top: 0, behavior: 'smooth' }); }); document.body.appendChild(pill); }
      pill.innerHTML = 'มีรูปใหม่ <b>' + fresh.length + '</b> รูป · แตะเพื่อดู';
      pill.hidden = false;
    }
    function hidePill() { if (pill) pill.hidden = true; }
    function applyFresh() {
      if (!fresh.length) return;
      fresh.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      fresh.forEach((r) => ids.add(r.id));
      items = fresh.concat(items); fresh = []; hidePill(); layout();
    }
    return { enter, invalidate, more, get items() { return items; }, get done() { return done; } };
  })();

  /* ======================= lightbox ======================= */
  const Lightbox = (function () {
    const lb = $('#lb'), img = $('#lbImg');
    let i = 0, lastFocus = null;
    function show() {
      const list = Gallery.items, p = list[i]; if (!p) return;
      $('#lbN').textContent = (i + 1) + ' / ' + list.length + (Gallery.done ? '' : '+');
      $('#lbMeta').innerHTML = (p.uploader_name ? '📷 <b>' + WG.esc(p.uploader_name) + '</b> · ' : '') + WG.esc(WG.timeAgo(p.created_at));
      img.classList.add('loading'); $('#lbSpin').hidden = false;
      if (p.thumb_url) img.src = p.thumb_url; // instant low-res, then swap
      const full = new Image();
      full.onload = () => { if (Gallery.items[i] === p) { img.src = p.image_url; img.classList.remove('loading'); $('#lbSpin').hidden = true; } };
      full.onerror = () => { $('#lbSpin').hidden = true; img.classList.remove('loading'); };
      full.src = p.image_url;
      img.alt = p.uploader_name ? 'Photo by ' + p.uploader_name : 'Wedding photo';
      [i + 1, i - 1].forEach((k) => { const q = list[k]; if (q) { const pre = new Image(); pre.src = q.image_url; } });
      if (WG.isTouch()) WG.prefetchBlob(p).catch(() => {}); // ready for the share sheet
      $('#lbPrev').disabled = i === 0;
      if (i >= list.length - 3) Gallery.more();
    }
    function open(k) { i = k; lastFocus = document.activeElement; lb.hidden = false; document.body.style.overflow = 'hidden'; show(); $('#lbClose').focus(); history.pushState({ lb: 1 }, '', location.hash || '#gallery'); }
    function close(fromPop) { if (lb.hidden) return; lb.hidden = true; document.body.style.overflow = ''; img.removeAttribute('src'); if (lastFocus) lastFocus.focus(); if (!fromPop && history.state && history.state.lb) history.back(); }
    function go(d) { const n = i + d; if (n < 0) return; if (n >= Gallery.items.length) { Gallery.more(); return; } i = n; show(); }
    $('#lbClose').addEventListener('click', () => close());
    $('#lbPrev').addEventListener('click', () => go(-1));
    $('#lbNext').addEventListener('click', () => go(1));
    $('#lbDl').addEventListener('click', () => { const p = Gallery.items[i]; if (p) WG.downloadPhoto(p); });
    $('#lbShare').addEventListener('click', () => WG.shareSite(GALLERY_URL));
    addEventListener('popstate', () => close(true));
    addEventListener('keydown', (e) => { if (lb.hidden) return; if (e.key === 'Escape') close(); else if (e.key === 'ArrowRight') go(1); else if (e.key === 'ArrowLeft') go(-1); });
    // swipe
    let sx = 0, sy = 0, st = 0;
    const stage = $('#lbStage');
    stage.addEventListener('touchstart', (e) => { const t = e.touches[0]; sx = t.clientX; sy = t.clientY; st = Date.now(); }, { passive: true });
    stage.addEventListener('touchend', (e) => {
      const t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3 && Date.now() - st < 700) go(dx < 0 ? 1 : -1);
      else if (dy > 110 && Math.abs(dy) > Math.abs(dx) * 1.5) close();
    }, { passive: true });
    stage.addEventListener('click', (e) => { if (e.target === stage) close(); });
    return { open };
  })();

  /* ======================= boot ======================= */
  route();
  loadSettings();
  loadCount();
  setInterval(loadSettings, 60000); // pick up admin open/close changes during the party
})();
