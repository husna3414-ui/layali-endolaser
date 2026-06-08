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
const SCRIPT_URL   = "https://script.google.com/macros/s/AKfycbxA67cKSqYAspN1WouXPC5zwVRera0TNePZNwDgYDYu2JnFM3SZW8rqCZW7UQSkFo1L/exec";
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

  /* ---- Build a tidy PDF of answers (+signature); returns the jsPDF doc ---- */
  function buildPDF(rows, title) {
    const { jsPDF } = window.jspdf; const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const M = 46; let y = 64; const W = 595 - M * 2;
    doc.setFont('helvetica', 'bold'); doc.setTextColor(140, 106, 59); doc.setFontSize(20);
    doc.text('Layali Clinic', M, y);
    doc.setFontSize(12); doc.setTextColor(60, 54, 48); doc.text(title || 'Form submission', M, y + 18);
    doc.setDrawColor(220, 205, 185); doc.line(M, y + 28, M + W, y + 28); y += 50;
    doc.setFontSize(10.5);
    for (const [k, v] of rows) {
      if (!v) continue;
      doc.setFont('helvetica', 'bold'); doc.setTextColor(120, 90, 50);
      const lh = doc.splitTextToSize(k + ':', W); doc.text(lh, M, y); y += lh.length * 13;
      doc.setFont('helvetica', 'normal'); doc.setTextColor(45, 40, 36);
      const vt = doc.splitTextToSize(String(v), W);
      if (y + vt.length * 12 > 800) { doc.addPage(); y = 60; }
      doc.text(vt, M, y); y += vt.length * 12 + 9;
      if (y > 790) { doc.addPage(); y = 60; }
    }
    const sig = getSig();
    if (sig) { if (y > 660) { doc.addPage(); y = 60; }
      doc.setFont('helvetica', 'bold'); doc.setTextColor(120, 90, 50); doc.text('Signature:', M, y); y += 8;
      try { doc.addImage(sig, 'PNG', M, y, 180, 70); } catch (e) {} }
    return doc;
  }

  const form = document.querySelector('form[data-pack-form]');
  if (!form) return;

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
      const rows = Object.keys(fields).map(k => [k, fields[k]]);
      const doc = buildPDF(rows, form.dataset.pdfTitle || form.dataset.packForm);
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

    try {
      // text/plain + no-cors → Apps Script processes it server-side.
      // redirect:'manual' stops the browser following Google's cross-origin
      // redirect (which throws in Safari/iOS); the script has already run by then.
      await fetch(SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        redirect: 'manual',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });
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
