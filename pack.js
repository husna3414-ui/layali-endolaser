/* ============================================================
   LAYALI CLINIC — shared form engine for every treatment pack
   (Consultation, Consent, Review, Testimonial)

   Submissions POST to your own Google Apps Script, which saves a row
   to your Google Sheet, emails the clinic the signed PDF, and emails
   the client a confirmation. No third-party form service — powered
   entirely by your own Google account (rock-solid uptime).
   ============================================================ */
const CLINIC_EMAIL = "info.lushlips@gmail.com";   // shown to clients; the script emails here
const CLINIC_NAME  = "Layali Clinic";
const SCRIPT_URL   = "https://script.google.com/macros/s/AKfycby1zBqO31wC8EZI7uLoh0j1ETKMvWNuEN1n94OvjUsX2fknFFc5Zn6-jzp_YvQp3AmH/exec";
/* ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  /* ---- Option visual state + none/single/radio logic ---- */
  document.addEventListener('change', e => {
    const t = e.target;
    if (t.type === 'checkbox') {
      const lab = t.closest('.opt'); if (lab) lab.classList.toggle('checked', t.checked);
      const box = t.closest('.opts'); if (!box) return;
      if (box.hasAttribute('data-radio') || box.hasAttribute('data-single')) {
        if (t.checked) box.querySelectorAll('input').forEach(i => { if (i !== t) { i.checked = false; i.closest('.opt').classList.remove('checked'); } });
      }
      const noneVal = box.getAttribute('data-none');
      if (noneVal) {
        const inputs = [...box.querySelectorAll('input')];
        const noneInp = inputs.find(i => i.value === noneVal);
        if (t === noneInp && t.checked) inputs.forEach(i => { if (i !== noneInp) { i.checked = false; i.closest('.opt').classList.remove('checked'); } });
        else if (t !== noneInp && t.checked && noneInp) { noneInp.checked = false; noneInp.closest('.opt').classList.remove('checked'); }
      }
    }
    if (t.type === 'radio' && t.closest('.scale')) {
      t.closest('.scale').querySelectorAll('label').forEach(l => l.classList.remove('checked'));
      t.closest('label').classList.add('checked');
    }
  });

  /* ---- Signature pad (if present) ---- */
  const canvas = document.querySelector('canvas.sig');
  let hasSig = false, ctx = null;
  if (canvas) {
    ctx = canvas.getContext('2d');
    const size = () => { const r = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
      canvas.width = r.width * dpr; canvas.height = r.height * dpr; ctx.scale(dpr, dpr);
      ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#2b2622'; };
    setTimeout(size, 60);
    let drawing = false;
    const pos = e => { const r = canvas.getBoundingClientRect(); const p = e.touches ? e.touches[0] : e; return { x: p.clientX - r.left, y: p.clientY - r.top }; };
    canvas.addEventListener('pointerdown', e => { drawing = true; const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); e.preventDefault(); });
    canvas.addEventListener('pointermove', e => { if (!drawing) return; const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); hasSig = true; e.preventDefault(); });
    window.addEventListener('pointerup', () => drawing = false);
    const clr = document.getElementById('sigClear');
    if (clr) clr.onclick = () => { ctx.clearRect(0, 0, canvas.width, canvas.height); hasSig = false; };
  }
  const getSig = () => (canvas && hasSig) ? canvas.toDataURL('image/png') : null;

  /* ---- Helpers ---- */
  const clearErrors = () => { document.querySelectorAll('.field-bad').forEach(f => f.classList.remove('field-bad'));
    document.querySelectorAll('.err-msg').forEach(m => m.style.display = 'none'); };
  const flag = el => { const f = el.closest('.f'); if (f) { f.classList.add('field-bad'); const m = f.querySelector('.err-msg'); if (m) m.style.display = 'block'; } };

  /* ---- Build a COMPLETE legal PDF: the whole form as presented —
         full declarations & risk wording, every option with [X]/[ ],
         typed answers, timestamp and signature. Returns the jsPDF doc. ---- */
  function buildPDF(formEl, title) {
    const { jsPDF } = window.jspdf; const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const M = 46, W = 595 - M * 2; let y = 56;
    const SKIP = ['script', 'style', 'button', 'canvas', 'noscript'];
    const SKIPCLASS = ['sec-n', 'req', 'sig-base', 'sig-clear', 'submit', 'err-msg', 'done'];

    const lines = [];
    (function walk(node) {
      node.childNodes.forEach(ch => {
        if (ch.nodeType === 3) { const t = ch.textContent.replace(/\s+/g, ' ').trim(); if (t) lines.push({ s: 'body', t: t }); return; }
        if (ch.nodeType !== 1) return;
        const el = ch, tag = el.tagName.toLowerCase();
        if (SKIP.indexOf(tag) >= 0) return;
        if (el.classList && SKIPCLASS.some(c => el.classList.contains(c))) return;
        if (tag === 'input') {
          if (el.type === 'checkbox' || el.type === 'radio') return;
          if (['text', 'email', 'tel', 'date', 'number'].indexOf(el.type) >= 0) lines.push({ s: 'answer', t: (el.value || '—') });
          return;
        }
        if (tag === 'textarea') { lines.push({ s: 'answer', t: (el.value || '—') }); return; }
        if (tag === 'label' && el.classList.contains('opt')) {
          const cb = el.querySelector('input'); const span = el.querySelector('span');
          const txt = (span ? span.textContent : el.textContent).replace(/\s+/g, ' ').trim();
          lines.push({ s: (cb && cb.checked) ? 'checked' : 'body', t: (cb && cb.checked ? '[X] ' : '[  ] ') + txt });
          return;
        }
        if (['h1', 'h2'].indexOf(tag) >= 0 || (el.classList && el.classList.contains('sec-t'))) { const t = el.textContent.replace(/\s+/g, ' ').trim(); if (t) lines.push({ s: 'heading', t: t }); return; }
        if (tag === 'h3' || tag === 'h4' || tag === 'summary') { const t = el.textContent.replace(/\s+/g, ' ').trim(); if (t) lines.push({ s: 'subhead', t: t }); return; }
        walk(el);
      });
    })(formEl);

    doc.setFont('helvetica', 'bold'); doc.setTextColor(140, 106, 59); doc.setFontSize(18);
    doc.text('Layali Clinic', M, y);
    doc.setFontSize(11); doc.setTextColor(60, 54, 48); doc.text(title || 'Consent record', M, y + 16);
    doc.setFontSize(8.5); doc.setTextColor(120, 110, 100);
    let stamp = ''; try { stamp = new Date().toLocaleString('en-GB'); } catch (e) {}
    doc.text('Completed electronically — ' + stamp, M, y + 30);
    doc.setDrawColor(220, 205, 185); doc.line(M, y + 38, M + W, y + 38); y += 54;

    lines.forEach(L => {
      let size = 9.5, font = 'normal', color = [70, 64, 58], indent = 0, gap = 4;
      if (L.s === 'heading') { size = 13; font = 'bold'; color = [140, 106, 59]; y += 8; gap = 5; }
      else if (L.s === 'subhead') { size = 10.5; font = 'bold'; color = [120, 90, 50]; y += 2; }
      else if (L.s === 'checked') { size = 9.5; font = 'bold'; color = [38, 38, 34]; indent = 2; }
      else if (L.s === 'answer') { size = 10; font = 'bold'; color = [54, 82, 60]; indent = 12; }
      doc.setFont('helvetica', font); doc.setFontSize(size); doc.setTextColor(color[0], color[1], color[2]);
      const wrapped = doc.splitTextToSize(L.t, W - indent);
      const need = wrapped.length * (size + 2.5);
      if (y + need > 800) { doc.addPage(); y = 56; }
      doc.text(wrapped, M + indent, y); y += need + gap;
    });

    const sig = getSig();
    if (sig) {
      if (y + 96 > 800) { doc.addPage(); y = 56; }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(120, 90, 50);
      doc.text('Signature captured on this form:', M, y); y += 8;
      try { doc.addImage(sig, 'PNG', M, y, 180, 70); y += 76; } catch (e) {}
    }
    return doc;
  }

  const form = document.querySelector('form[data-pack-form]');
  if (!form) return;

  /* ---- In-app browser warning: Instagram/Facebook/WhatsApp in-app browsers
         silently break form submission. Tell the user to open it properly. ---- */
  (function () {
    var ua = navigator.userAgent || '';
    if (/FBAN|FBAV|FB_IAB|FBIOS|Instagram|Line\/|Twitter|MicroMessenger|GSA\/|; wv\)/i.test(ua)) {
      var b = document.createElement('div');
      b.style.cssText = 'position:sticky;top:0;z-index:9999;background:#8a3b33;color:#fff;padding:13px 16px;font-size:13.5px;line-height:1.5;text-align:center;font-family:Jost,system-ui,sans-serif';
      b.innerHTML = 'To complete this form, please open it in your browser — tap the <b>&#8226;&#8226;&#8226;</b> or <b>&#8220;Aa&#8221;</b> menu and choose <b>Open in Safari</b> / <b>Open in Chrome</b>, then fill it in there.';
      document.body.insertBefore(b, document.body.firstChild);
    }
  })();

  const doneScreen = document.getElementById('doneScreen');
  const showError = (msg) => {
    let e = document.getElementById('submitError');
    if (!e) { e = document.createElement('p'); e.id = 'submitError';
      e.style.cssText = 'color:#b4564c;font-size:13.5px;text-align:center;margin:12px 0;line-height:1.5';
      const b = form.querySelector('.submit'); b.parentNode.insertBefore(e, b.nextSibling); }
    e.innerHTML = msg; e.style.display = 'block';
  };

  /* ---- Submit → your own Google Apps Script (Sheet + email + signed PDF) ---- */
  form.addEventListener('submit', async ev => {
    ev.preventDefault(); clearErrors();
    const prevErr = document.getElementById('submitError'); if (prevErr) prevErr.style.display = 'none';
    let ok = true, firstBad = null;

    form.querySelectorAll('input[required],textarea[required],select[required]').forEach(el => {
      if (el.type === 'file') { if (!el.files.length) { ok = false; flag(el); firstBad = firstBad || el; } return; }
      if (!el.value.trim()) { ok = false; flag(el); firstBad = firstBad || el; }
    });
    document.querySelectorAll('[data-group]').forEach(g => {
      const box = g.querySelector('.opts, .scale'); if (!box) return;
      const min = parseInt(box.getAttribute('data-min') || '0', 10);
      const checked = box.querySelectorAll('input:checked').length;
      const bad = box.hasAttribute('data-all') ? checked < box.querySelectorAll('input').length : checked < min;
      if (bad) { ok = false; g.classList.add('field-bad'); const m = g.querySelector('.err-msg'); if (m) m.style.display = 'block'; firstBad = firstBad || g; }
    });
    const sigField = document.getElementById('sigField');
    if (sigField && !hasSig) { ok = false; sigField.classList.add('field-bad'); sigField.querySelector('.err-msg').style.display = 'block'; firstBad = firstBad || sigField; }

    if (!ok) { (firstBad || form).scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }

    const btn = form.querySelector('.submit'); const label = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }

    // gather all typed answers (checkboxes joined; files skipped)
    const fd = new FormData(form); const fields = {};
    for (const [k, v] of fd.entries()) {
      if (typeof v !== 'string' || k.charAt(0) === '_') continue;
      fields[k] = (fields[k] !== undefined) ? fields[k] + ', ' + v : v;
    }

    // signed PDF → base64 for the email attachment
    let pdfBase64 = '', pdfName = '';
    try {
      const doc = buildPDF(form, form.dataset.pdfTitle || form.dataset.packForm);
      pdfBase64 = (doc.output('datauristring').split(',')[1]) || '';
      pdfName = (form.dataset.packForm || 'form').replace(/\s+/g, '-').toLowerCase() + '-' +
        (fields['Last name'] || fields['Name'] || fields['Client name'] || 'client') + '.pdf';
    } catch (e) {}

    const payload = {
      form: form.dataset.packForm || 'Form',
      fields: fields,
      pdfBase64: pdfBase64,
      pdfName: pdfName,
      autoresponse: form.dataset.autoresponse || ''
    };

    // Bulletproof delivery: a hidden form POST into a hidden iframe.
    // Works on iOS/Safari (no CORS, no fetch/redirect issues). The script
    // runs server-side; we don't need to read the response.
    const deliver = () => new Promise((resolve) => {
      const sink = document.createElement('iframe');
      sink.name = 'layali_sink_' + Date.now();
      sink.style.display = 'none';
      document.body.appendChild(sink);
      const f = document.createElement('form');
      f.action = SCRIPT_URL; f.method = 'POST'; f.target = sink.name; f.style.display = 'none';
      const ta = document.createElement('textarea'); ta.name = 'payload'; ta.value = JSON.stringify(payload);
      f.appendChild(ta); document.body.appendChild(f);
      let settled = false;
      const finish = () => { if (settled) return; settled = true;
        try { document.body.removeChild(f); document.body.removeChild(sink); } catch (e) {} resolve(); };
      sink.addEventListener('load', finish);
      setTimeout(finish, 4000); // fallback in case the cross-origin load event is suppressed
      f.submit();
    });

    try {
      await deliver();
      form.style.display = 'none';
      const h = document.querySelector('header.hero'); if (h) h.style.display = 'none';
      if (doneScreen) doneScreen.style.display = 'block';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      if (btn) { btn.disabled = false; btn.textContent = label; }
      showError('Sorry, we couldn’t send the form just now. Please check your connection and try again.');
    }
  });
});
