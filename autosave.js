/* ============================================================
   LAYALI CLINIC — Autosave & Resume
   ------------------------------------------------------------
   Plain-English summary of what this does:
   • As the client fills in the consent form, their answers are
     quietly saved onto THEIR OWN phone/computer (in the browser).
   • If they get interrupted — a phone call, they close the tab,
     their battery dies — they just reopen the link and everything
     they'd typed is still there. Nothing is lost.
   • Nothing is ever sent anywhere by this file; the draft never
     leaves their device. It's only remembered locally.
   • The moment they submit the form, the saved draft is wiped.
   • A draft older than 12 hours is ignored, so a stale form on a
     shared device starts clean.
   • A "Not you? Start fresh" button lets a different person on the
     same device clear the previous draft in one tap.
   This file is generic — it works on any of the consent forms.
   ============================================================ */
(function () {
  var form = document.querySelector('form');
  if (!form || !window.localStorage) return;

  // A separate saved slot per treatment (so e.g. Lips and Butt drafts don't mix)
  var KEY = 'layali-draft:' + (form.getAttribute('data-pack-form') || location.pathname);
  var MAX_AGE = 12 * 60 * 60 * 1000; // ignore drafts older than 12 hours

  // ---- gather every answer currently on the form ----
  function collect() {
    var data = {};
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name || el.disabled) return;
      var t = el.type;
      if (t === 'file' || t === 'submit' || t === 'button' || t === 'reset') return;
      if (t === 'checkbox' || t === 'radio') {
        if (el.checked) { (data[el.name] = data[el.name] || []).push(el.value); }
      } else if (el.value) {
        data[el.name] = el.value;
      }
    });
    return data;
  }

  // keep the engine's tick-box highlight (.opt.checked) in sync after a restore
  function syncOptStyle() {
    form.querySelectorAll('.opt').forEach(function (lbl) {
      var i = lbl.querySelector('input');
      if (i) lbl.classList.toggle('checked', i.checked);
    });
  }

  // ---- save as they type (debounced so it isn't constant) ----
  var timer, lastToast = 0;
  function save() {
    clearTimeout(timer);
    timer = setTimeout(function () {
      try {
        localStorage.setItem(KEY, JSON.stringify({ t: Date.now(), v: collect() }));
        var now = Date.now();
        if (now - lastToast > 4000) { toast('✓ Progress saved on this device', 1500); lastToast = now; }
      } catch (e) {}
    }, 450);
  }
  form.addEventListener('input', save);
  form.addEventListener('change', save);

  // ---- once the form is actually submitted, forget the draft ----
  form.addEventListener('submit', function () { try { localStorage.removeItem(KEY); } catch (e) {} });

  // ---- put saved answers back when the page re-opens ----
  function restore() {
    var raw; try { raw = localStorage.getItem(KEY); } catch (e) { return; }
    if (!raw) return;
    var saved; try { saved = JSON.parse(raw); } catch (e) { return; }
    if (!saved || !saved.v || (saved.t && (Date.now() - saved.t) > MAX_AGE)) {
      try { localStorage.removeItem(KEY); } catch (e) {}
      return;
    }
    var data = saved.v;

    // Pass 1 — re-tick any conditional TRIGGERS first (e.g. the treatment
    // areas on the filler form) so their hidden cards are re-inserted before
    // we try to fill the fields that live inside them.
    form.querySelectorAll('input[data-trigger]').forEach(function (el) {
      var v = data[el.name];
      if (v && v.indexOf && v.indexOf(el.value) > -1) {
        el.checked = true;
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    // Pass 2 — refill every saved field (any conditional cards are now present)
    Object.keys(data).forEach(function (name) {
      var v = data[name];
      var els = form.elements[name];
      if (!els) return;
      var list = (typeof els.length === 'number' && els.tagName === undefined) ? els : [els];
      Array.prototype.forEach.call(list, function (el) {
        if (!el || !el.type) return;
        if (el.type === 'checkbox' || el.type === 'radio') {
          el.checked = Array.isArray(v) ? v.indexOf(el.value) > -1 : v === el.value;
        } else {
          el.value = v;
        }
      });
    });

    syncOptStyle();
    resumeBanner();
  }

  // ---- small "saved" toast ----
  var chip;
  function toast(msg, ms) {
    if (!chip) {
      chip = document.createElement('div');
      chip.style.cssText = 'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:60;' +
        'font-family:Jost,sans-serif;font-size:12.5px;color:#5f5347;background:#fffdfb;border:1px solid #e7ddd2;' +
        'border-radius:22px;padding:8px 16px;box-shadow:0 12px 34px -14px rgba(80,60,30,.45);opacity:0;' +
        'transition:opacity .3s;pointer-events:none;max-width:88vw;text-align:center';
      document.body.appendChild(chip);
    }
    chip.textContent = msg; chip.style.opacity = '1';
    clearTimeout(chip._h); chip._h = setTimeout(function () { chip.style.opacity = '0'; }, ms || 1600);
  }

  // ---- friendly "welcome back" bar with a start-fresh escape hatch ----
  function resumeBanner() {
    var b = document.createElement('div');
    b.style.cssText = 'position:sticky;top:0;z-index:55;display:flex;gap:12px;align-items:center;' +
      'justify-content:center;flex-wrap:wrap;font-family:Jost,sans-serif;font-size:13px;color:#4a4138;' +
      'background:#fbf1e2;border-bottom:1px solid #ecd9bf;padding:10px 14px;text-align:center';
    b.appendChild(Object.assign(document.createElement('span'),
      { textContent: '✓ Welcome back — we restored your saved answers.' }));
    var btn = document.createElement('button');
    btn.type = 'button'; btn.textContent = 'Not you? Start fresh';
    btn.style.cssText = 'font-family:Jost,sans-serif;font-size:12.5px;color:#8c6a3b;background:#fff;' +
      'border:1px solid #ecd9bf;border-radius:20px;padding:5px 13px;cursor:pointer';
    btn.addEventListener('click', function () {
      try { localStorage.removeItem(KEY); } catch (e) {}
      location.reload();
    });
    b.appendChild(btn);
    document.body.insertBefore(b, document.body.firstChild);
  }

  // run the restore after the page (and any conditional-card setup) is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', restore);
  } else {
    restore();
  }
})();
