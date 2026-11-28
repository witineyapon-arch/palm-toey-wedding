/* PALM & TOEY · Wedding Gallery — admin dashboard */
(function () {
  'use strict';
  const C = window.WG_CONFIG, WG = window.WG, sb = WG.sb, $ = WG.$, $$ = WG.$$;
  const PER = 40;
  // The guest page lives one level up from /admin/ — built from the URL this page is served at,
  // so the QR always encodes the real deployed address.
  const GALLERY_URL = new URL('../', location.href).href;

  let page = 0, filter = 'all', term = '', rows = [], total = 0;
  const selected = new Map(); // id -> row

  function show(id) { ['vLogin', 'vDash', 'vDenied'].forEach((v) => ($('#' + v).hidden = v !== id)); $('#logout').hidden = id === 'vLogin'; }

  /* ---------------- auth ---------------- */
  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#loginBtn'), err = $('#loginErr');
    btn.disabled = true; err.hidden = true;
    const { error } = await sb.auth.signInWithPassword({ email: $('#em').value.trim(), password: $('#pw').value });
    btn.disabled = false;
    if (error) { err.hidden = false; err.textContent = /invalid/i.test(error.message) ? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' : error.message; return; }
    $('#pw').value = '';
    boot();
  });
  async function logout() { await sb.auth.signOut(); show('vLogin'); }
  $('#logout').addEventListener('click', logout);
  $('#deniedOut').addEventListener('click', logout);

  async function boot() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { show('vLogin'); return; }
    const ok = await loadStats();
    if (!ok) { $('#deniedEmail').textContent = session.user.email; show('vDenied'); return; }
    $('#who').textContent = session.user.email;
    show('vDash');
    loadSettings(); renderQR(); loadPage();
  }

  /* ---------------- stats ---------------- */
  async function loadStats() {
    const { data, error } = await sb.rpc('wedding_stats');
    if (error) return false;
    $('#sTotal').textContent = data.total;
    $('#sUp').textContent = data.uploaders;
    $('#sToday').textContent = data.today;
    $('#sHour').textContent = data.last_hour;
    $('#sBytes').textContent = WG.fmtBytes(data.bytes);
    $('#sHidden').textContent = data.hidden;
    return true;
  }
  $('#refresh').addEventListener('click', () => { loadStats(); loadPage(); });
  setInterval(() => { if (!$('#vDash').hidden && !document.hidden) loadStats(); }, 30000);

  /* ---------------- settings ---------------- */
  async function loadSettings() {
    try {
      const s = await WG.getSettings();
      $('#swOpen').checked = !!s.uploads_enabled; swLabel();
      $('#noticeMsg').value = s.notice_message || '';
      $('#closedMsg').value = s.closed_message || '';
    } catch (e) { WG.toast('โหลดการตั้งค่าไม่สำเร็จ', 'error'); }
  }
  function swLabel() { $('#swState').textContent = $('#swOpen').checked ? 'เปิดรับรูปอยู่ — แขกอัปโหลดได้' : 'ปิดรับรูปแล้ว — แขกดู/ดาวน์โหลดได้อย่างเดียว'; }
  async function saveSettings(partial) {
    const payload = partial || { uploads_enabled: $('#swOpen').checked, notice_message: $('#noticeMsg').value.trim(), closed_message: $('#closedMsg').value.trim() };
    payload.updated_at = new Date().toISOString();
    const { data, error } = await sb.from('wedding_settings').update(payload).eq('id', 1).select().maybeSingle();
    if (error || !data) { WG.toast('บันทึกไม่สำเร็จ: ' + (error ? error.message : 'ไม่มีสิทธิ์'), 'error'); return false; }
    WG.toast('บันทึกแล้ว', 'ok'); $('#setMsg').textContent = 'บันทึกล่าสุด ' + WG.fmtTime(data.updated_at);
    return true;
  }
  $('#swOpen').addEventListener('change', async () => {
    swLabel();
    if (!(await saveSettings({ uploads_enabled: $('#swOpen').checked }))) { $('#swOpen').checked = !$('#swOpen').checked; swLabel(); }
  });
  $('#saveSet').addEventListener('click', () => saveSettings());

  /* ---------------- QR ---------------- */
  function qrMatrix(text) { const q = qrcode(0, 'H'); q.addData(text, 'Byte'); q.make(); return q; }
  function drawQR(ctx, q, x, y, size, dark, light) {
    const n = q.getModuleCount(), quiet = 2, cell = size / (n + quiet * 2);
    ctx.fillStyle = light; ctx.fillRect(x, y, size, size);
    ctx.fillStyle = dark;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) ctx.fillRect(Math.floor(x + (c + quiet) * cell), Math.floor(y + (r + quiet) * cell), Math.ceil(cell), Math.ceil(cell));
  }
  function isRealHost() { return location.protocol === 'https:' && !/^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(location.hostname) && !/\.local$/.test(location.hostname); }
  function renderQR() {
    $('#qrUrl').textContent = GALLERY_URL;
    const w = $('#qrWarn');
    w.hidden = isRealHost();
    w.textContent = 'หน้านี้ไม่ได้เปิดจากเว็บไซต์จริงที่ Deploy แล้ว — เปิดหน้า Admin จาก URL จริงก่อนดาวน์โหลด QR';
    const cv = $('#qrCanvas'), ctx = cv.getContext('2d');
    drawQR(ctx, qrMatrix(GALLERY_URL), 0, 0, cv.width, '#2e3438', '#ffffff');
  }
  function savePng(canvas, name) {
    canvas.toBlob((b) => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }, 'image/png');
  }
  function guardHost() { if (isRealHost()) return true; return confirm('URL นี้ไม่ใช่เว็บไซต์จริงที่ Deploy แล้ว:\n' + GALLERY_URL + '\n\nยังต้องการดาวน์โหลด QR นี้หรือไม่?'); }
  $('#qrPng').addEventListener('click', () => {
    if (!guardHost()) return;
    const c = document.createElement('canvas'); c.width = c.height = 1200;
    drawQR(c.getContext('2d'), qrMatrix(GALLERY_URL), 0, 0, 1200, '#2e3438', '#ffffff');
    savePng(c, 'PalmToey-WeddingGallery-QR.png');
  });
  $('#qrCard').addEventListener('click', async () => {
    if (!guardHost()) return;
    try { await document.fonts.load('400 80px "Allura"'); await document.fonts.load('300 80px "Bai Jamjuree"'); await document.fonts.load('400 40px "Young Serif"'); await document.fonts.load('300 30px "Prompt"'); } catch (e) {}
    const W = 1500, H = 2100, c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    x.fillStyle = '#fcfaf6'; x.fillRect(0, 0, W, H);
    x.strokeStyle = '#d9c9a8'; x.lineWidth = 3; x.strokeRect(60, 60, W - 120, H - 120);
    x.strokeStyle = '#ebe1d0'; x.lineWidth = 1.5; x.strokeRect(84, 84, W - 168, H - 168);
    x.textAlign = 'center'; x.textBaseline = 'alphabetic';
    x.fillStyle = '#6b7175'; x.font = '400 30px "Bai Jamjuree"'; spaced(x, 'WEDDING GALLERY', W / 2, 250, 12);
    x.fillStyle = '#2e3438'; x.font = '300 170px "Bai Jamjuree"'; spaced(x, 'PALM', W / 2, 460, 10);
    x.fillStyle = '#d79ea2'; x.font = '400 150px "Allura"'; x.fillText('&', W / 2, 590);
    x.fillStyle = '#2e3438'; x.font = '300 170px "Bai Jamjuree"'; spaced(x, 'TOEY', W / 2, 760, 10);
    x.fillStyle = '#9a8461'; x.font = '400 40px "Young Serif"'; spaced(x, '12.12.2026', W / 2, 850, 10);
    const qs = 720, qx = (W - qs) / 2, qy = 930;
    x.fillStyle = '#ffffff'; x.fillRect(qx - 24, qy - 24, qs + 48, qs + 48);
    x.strokeStyle = '#d9c9a8'; x.lineWidth = 2; x.strokeRect(qx - 24, qy - 24, qs + 48, qs + 48);
    drawQR(x, qrMatrix(GALLERY_URL), qx, qy, qs, '#2e3438', '#ffffff');
    x.fillStyle = '#b97a80'; x.font = '400 40px "Bai Jamjuree"'; spaced(x, 'SCAN TO SHARE YOUR PHOTOS', W / 2, 1800, 8);
    x.fillStyle = '#6b7175'; x.font = '300 38px "Prompt"'; x.fillText('สแกนเพื่ออัปโหลดและดูรูปภาพในงาน', W / 2, 1870);
    x.font = '300 30px "Prompt"'; x.fillText('ไม่ต้องสมัครสมาชิก · ไม่ต้องติดตั้งแอป', W / 2, 1920);
    x.fillStyle = '#9a8461'; x.font = '300 28px "Prompt"'; x.fillText('หุ่นไร่กา · จังหวัดพิษณุโลก', W / 2, 1985);
    savePng(c, 'PalmToey-WeddingGallery-QR-Card.png');
  });
  function spaced(ctx, text, cx, y, sp) {
    const chars = Array.from(text), widths = chars.map((ch) => ctx.measureText(ch).width);
    const total = widths.reduce((a, b) => a + b, 0) + sp * (chars.length - 1);
    let px = cx - total / 2; const al = ctx.textAlign; ctx.textAlign = 'left';
    chars.forEach((ch, i) => { ctx.fillText(ch, px, y); px += widths[i] + sp; });
    ctx.textAlign = al;
  }

  /* ---------------- photo list ---------------- */
  function baseQuery(head) {
    let q = sb.from(C.TABLE).select('id,image_url,thumb_url,storage_path,thumb_path,uploader_name,file_size,status,created_at', head ? { count: 'exact', head: true } : { count: 'exact' });
    if (filter !== 'all') q = q.eq('status', filter);
    if (term) q = q.ilike('uploader_name', '%' + term.replace(/[%_,()]/g, '') + '%');
    return q;
  }
  async function loadPage() {
    const { data, error, count } = await baseQuery().order('created_at', { ascending: false }).order('id', { ascending: false }).range(page * PER, page * PER + PER - 1);
    if (error) { WG.toast('โหลดรายการไม่สำเร็จ: ' + error.message, 'error'); return; }
    rows = data || []; total = count || 0;
    if (!rows.length && page > 0) { page--; return loadPage(); }
    renderGrid();
  }
  const IC = {
    dl: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 4v12M7 11l5 5 5-5M5 20h14"/></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    eyeoff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7a9.6 9.6 0 0 0 5.4-1.6"/></svg>',
    del: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>'
  };
  function renderGrid() {
    const g = $('#grid'); g.innerHTML = '';
    $('#adEmpty').hidden = rows.length > 0;
    rows.forEach((r, i) => {
      const el = document.createElement('div');
      el.className = 'ph-card' + (r.status === 'hidden' ? ' is-hidden' : '') + (selected.has(r.id) ? ' sel' : '');
      el.innerHTML =
        '<input class="ph-chk" type="checkbox" aria-label="เลือก"' + (selected.has(r.id) ? ' checked' : '') + '>' +
        (r.status === 'hidden' ? '<span class="badge">Hidden</span>' : '') +
        '<button class="ph-img" type="button"><img loading="lazy" decoding="async" alt="" src="' + WG.esc(r.thumb_url || r.image_url) + '"></button>' +
        '<div class="ph-info"><b>' + (r.uploader_name ? '📷 ' + WG.esc(r.uploader_name) : '<span style="color:var(--ink-soft)">ไม่ระบุชื่อ</span>') + '</b><span>' + WG.esc(WG.fmtTime(r.created_at)) + ' · ' + WG.fmtBytes(r.file_size) + '</span></div>' +
        '<div class="ph-act"><a href="' + WG.esc(WG.downloadUrl(r)) + '" title="ดาวน์โหลด" aria-label="ดาวน์โหลด">' + IC.dl + '</a>' +
        '<button type="button" class="tog" title="' + (r.status === 'hidden' ? 'แสดง' : 'ซ่อน') + '" aria-label="ซ่อนหรือแสดง">' + (r.status === 'hidden' ? IC.eye : IC.eyeoff) + '</button>' +
        '<button type="button" class="del" title="ลบ" aria-label="ลบ">' + IC.del + '</button></div>';
      el.querySelector('.ph-chk').addEventListener('change', (e) => { e.target.checked ? selected.set(r.id, r) : selected.delete(r.id); el.classList.toggle('sel', e.target.checked); syncBulk(); });
      el.querySelector('.ph-img').addEventListener('click', () => view(i));
      el.querySelector('.tog').addEventListener('click', () => setStatus([r], r.status === 'hidden' ? 'approved' : 'hidden'));
      el.querySelector('.del').addEventListener('click', () => del([r]));
      g.appendChild(el);
    });
    const pages = Math.max(1, Math.ceil(total / PER));
    $('#pageInfo').textContent = 'หน้า ' + (page + 1) + ' / ' + pages + ' · ' + total + ' รูป';
    $('#prev').disabled = page === 0; $('#next').disabled = page + 1 >= pages;
    syncBulk();
  }
  $('#prev').addEventListener('click', () => { if (page > 0) { page--; loadPage(); scrollTo(0, $('#filter').offsetTop - 80); } });
  $('#next').addEventListener('click', () => { page++; loadPage(); scrollTo(0, $('#filter').offsetTop - 80); });
  $$('#filter button').forEach((b) => b.addEventListener('click', () => { $$('#filter button').forEach((x) => x.classList.toggle('on', x === b)); filter = b.dataset.f; page = 0; loadPage(); }));
  let st; $('#search').addEventListener('input', (e) => { clearTimeout(st); st = setTimeout(() => { term = e.target.value.trim(); page = 0; loadPage(); }, 300); });
  $('#selPage').addEventListener('click', () => { const all = rows.every((r) => selected.has(r.id)); rows.forEach((r) => (all ? selected.delete(r.id) : selected.set(r.id, r))); renderGrid(); });

  function syncBulk() { $('#bulk').hidden = selected.size === 0; $('#selN').textContent = selected.size; }
  $('#bClear').addEventListener('click', () => { selected.clear(); renderGrid(); });
  $('#bDel').addEventListener('click', () => del(Array.from(selected.values())));
  $('#bHide').addEventListener('click', () => { const list = Array.from(selected.values()); const anyVisible = list.some((r) => r.status !== 'hidden'); setStatus(list, anyVisible ? 'hidden' : 'approved'); });
  $('#bZip').addEventListener('click', () => zip(Array.from(selected.values()), 'PalmToey-selected.zip'));

  async function setStatus(list, status) {
    const ids = list.map((r) => r.id);
    const { error } = await sb.from(C.TABLE).update({ status }).in('id', ids);
    if (error) { WG.toast('ไม่สำเร็จ: ' + error.message, 'error'); return; }
    WG.toast(status === 'hidden' ? 'ซ่อนจากหน้า Gallery แล้ว' : 'แสดงในหน้า Gallery แล้ว', 'ok');
    list.forEach((r) => { r.status = status; });
    loadStats(); loadPage();
  }
  async function del(list) {
    if (!list.length) return;
    if (!confirm('ลบรูป ' + list.length + ' รูปอย่างถาวร?\nไฟล์จะถูกลบออกจาก Storage และกู้คืนไม่ได้')) return;
    const paths = [];
    list.forEach((r) => { paths.push(r.storage_path); if (r.thumb_path) paths.push(r.thumb_path); });
    for (let i = 0; i < paths.length; i += 100) {
      const { error } = await sb.storage.from(C.BUCKET).remove(paths.slice(i, i + 100));
      if (error) { WG.toast('ลบไฟล์ไม่สำเร็จ: ' + error.message, 'error'); return; }
    }
    const { error } = await sb.from(C.TABLE).delete().in('id', list.map((r) => r.id));
    if (error) { WG.toast('ลบข้อมูลไม่สำเร็จ: ' + error.message, 'error'); return; }
    list.forEach((r) => selected.delete(r.id));
    WG.toast('ลบแล้ว ' + list.length + ' รูป', 'ok');
    loadStats(); loadPage();
  }

  /* ---------------- ZIP download ---------------- */
  let zipping = false;
  async function zip(list, name) {
    if (zipping || !list.length) return;
    const bytes = list.reduce((a, r) => a + (r.file_size || 0), 0);
    if (bytes > 1.5 * 1073741824 && !confirm('ไฟล์รวม ' + WG.fmtBytes(bytes) + ' อาจใหญ่เกินหน่วยความจำของเบราว์เซอร์ ดำเนินการต่อ?')) return;
    zipping = true;
    const msg = $('#zipMsg'); msg.hidden = false;
    const z = new JSZip(); let done = 0, failed = 0;
    let idx = 0;
    const worker = async () => {
      while (idx < list.length) {
        const r = list[idx++];
        try {
          const res = await fetch(r.image_url); if (!res.ok) throw new Error(res.status);
          const who = (r.uploader_name || 'guest').replace(/[\\/:*?"<>|]/g, '').slice(0, 30);
          z.file(String(r.created_at).slice(0, 19).replace(/[:T]/g, '-') + '_' + who + '_' + r.id.slice(0, 6) + '.jpg', await res.blob(), { binary: true });
        } catch (e) { failed++; }
        done++; msg.textContent = 'กำลังรวมไฟล์ ' + done + ' / ' + list.length + (failed ? ' (ไม่สำเร็จ ' + failed + ')' : '');
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
    msg.textContent = 'กำลังสร้างไฟล์ ZIP…';
    const blob = await z.generateAsync({ type: 'blob', compression: 'STORE' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    msg.textContent = 'ดาวน์โหลด ZIP แล้ว (' + (list.length - failed) + ' รูป, ' + WG.fmtBytes(blob.size) + ')';
    zipping = false;
  }
  $('#zipAll').addEventListener('click', async () => {
    const all = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await baseQuery().order('created_at', { ascending: false }).range(from, from + 999);
      if (error) { WG.toast(error.message, 'error'); return; }
      all.push.apply(all, data); if (data.length < 1000) break;
    }
    zip(all, 'PalmToey-WeddingGallery-' + WG.bkkDate() + '.zip');
  });

  /* ---------------- viewer ---------------- */
  let vi = 0;
  function view(i) { vi = i; const r = rows[i]; if (!r) return; $('#lb').hidden = false; $('#lbImg').src = r.image_url; $('#lbN').textContent = (page * PER + i + 1) + ' / ' + total; $('#lbMeta').textContent = (r.uploader_name || 'ไม่ระบุชื่อ') + ' · ' + WG.fmtTime(r.created_at); }
  function closeView() { $('#lb').hidden = true; $('#lbImg').removeAttribute('src'); }
  $('#lbClose').addEventListener('click', closeView);
  $('#lbStage').addEventListener('click', (e) => { if (e.target.id === 'lbStage') closeView(); });
  addEventListener('keydown', (e) => { if ($('#lb').hidden) return; if (e.key === 'Escape') closeView(); if (e.key === 'ArrowRight' && rows[vi + 1]) view(vi + 1); if (e.key === 'ArrowLeft' && vi > 0) view(vi - 1); });

  sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT') show('vLogin'); });
  boot();
})();
