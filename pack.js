/* ============================================================
   LAYALI CLINIC — shared form engine for every treatment pack
   (Consultation, Consent, Treatment Day, Review, Testimonial)

   Uses Formsubmit.co (free): on submit it emails the clinic a full
   record + the signed PDF (your log), and emails the client a
   confirmation. No API key, no monthly fee.

   ► ONE-TIME SETUP: the FIRST time a form is submitted, Formsubmit
     sends an activation email to the address below — click the link
     in it once to switch everything on. After that it just works.
   ============================================================ */
const CLINIC_EMAIL = "info.lushlips@gmail.com";   // where signed forms are emailed (your record/log)
const CLINIC_NAME  = "Layali Clinic";
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

  /* ---- Build a tidy PDF of answers (+signature) ---- */
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
    return doc.output('blob');
  }

  /* ---- Configure the form for Formsubmit ---- */
  const form = document.querySelector('form[data-pack-form]');
  if (!form) return;
  form.setAttribute('method', 'POST');
  form.setAttribute('enctype', 'multipart/form-data');
  form.setAttribute('action', 'https://formsubmit.co/' + CLINIC_EMAIL);

  const hidden = (name, val) => { const i = document.createElement('input'); i.type = 'hidden'; i.name = name; i.value = val; form.appendChild(i); return i; };
  const hasEmail = !!form.querySelector('input[type=email], input[name="Email"]');
  hidden('_subject', (form.dataset.packForm || 'Form') + ' — ' + CLINIC_NAME);
  hidden('_template', 'table');
  hidden('_captcha', 'false');
  if (hasEmail && form.dataset.autoresponse) hidden('_autoresponse', form.dataset.autoresponse);
  const nextInput = hidden('_next', '');           // set to the thank-you page at submit time
  hidden('Signature captured', canvas ? 'see attached PDF' : 'n/a');

  /* ---- Submit ---- */
  form.addEventListener('submit', async ev => {
    ev.preventDefault(); clearErrors(); let ok = true, firstBad = null;

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

    const btn = form.querySelector('.submit'); if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }

    /* Build the signed PDF and attach it as a file so it reaches the clinic inbox */
    try {
      const fd = new FormData(form); const seen = {}, order = [];
      for (const [k, v] of fd.entries()) { if (k === 'attachment' || k.charAt(0) === '_' || typeof v !== 'string') continue;
        if (seen[k] !== undefined) seen[k] += ', ' + v; else { seen[k] = v; order.push(k); } }
      const rows = order.map(k => [k, seen[k]]);
      const pdf = buildPDF(rows, form.dataset.pdfTitle || form.dataset.packForm);
      const fname = (form.dataset.packForm || 'form').replace(/\s+/g, '-').toLowerCase() + '-' + (seen['Last name'] || seen['Name'] || seen['Client name'] || 'client') + '.pdf';
      const dt = new DataTransfer(); dt.items.add(new File([pdf], fname, { type: 'application/pdf' }));
      let pdfInput = form.querySelector('input[type=file][data-pdf]');
      if (!pdfInput) { pdfInput = document.createElement('input'); pdfInput.type = 'file'; pdfInput.name = 'Signed PDF'; pdfInput.setAttribute('data-pdf', '1'); pdfInput.style.display = 'none'; form.appendChild(pdfInput); }
      pdfInput.files = dt.files;
    } catch (e) { /* if attaching fails, the form still submits with all answers as text */ }

    /* Redirect to the branded thank-you page after sending */
    try { nextInput.value = new URL('thank-you.html', window.location.href).href; } catch (e) {}

    form.submit();   // native submit → Formsubmit emails clinic + client, then redirects
  });
});
