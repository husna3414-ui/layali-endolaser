/* ============================================================
   LAYALI CLINIC — Collapsible sections
   ------------------------------------------------------------
   Plain-English summary:
   • Turns each section of the consent into a tap/keyboard panel.
     The client sees a tidy list of titles and opens them one at a
     time, so a long form feels short and manageable.
   • The FIRST section starts open; the rest start closed and slide
     open smoothly when tapped (or Enter/Space when focused).
   • A small ✓ appears on a section once its required questions are
     answered, so progress is visible without opening each one.
   • On submit, EVERY section opens automatically so nothing is
     hidden while the form checks answers and builds the PDF.
   • It leaves the pop-in "area" cards on the filler form alone
     (those already show/hide themselves).
   ============================================================ */
(function () {
  var form = document.querySelector('form');
  if (!form) return;
  var cards = form.querySelectorAll('.card');
  if (!cards.length) return;

  form.classList.add('collapse-ready');
  var handled = [];
  var first = true;

  Array.prototype.forEach.call(cards, function (card) {
    if (card.hasAttribute('data-cond')) return;          // leave conditional area cards alone
    var head = card.querySelector(':scope > .sec-h');
    if (!head) return;

    // wrap the body in .card-body > .cb-inner (the inner wrapper lets the
    // height animate smoothly instead of snapping open/closed)
    var body = document.createElement('div'); body.className = 'card-body';
    var inner = document.createElement('div'); inner.className = 'cb-inner';
    var n = head.nextSibling;
    while (n) { var next = n.nextSibling; inner.appendChild(n); n = next; }
    body.appendChild(inner);
    card.appendChild(body);
    card.classList.add('cx');

    // right side of the header: a completion tick + a chevron
    var meta = document.createElement('span'); meta.className = 'sec-meta';
    var tick = document.createElement('span'); tick.className = 'tick'; tick.setAttribute('aria-hidden', 'true'); tick.textContent = '✓';
    var chev = document.createElement('span'); chev.className = 'chev'; chev.setAttribute('aria-hidden', 'true'); chev.textContent = '⌄';
    meta.appendChild(tick); meta.appendChild(chev);
    head.appendChild(meta);

    // make the header a real keyboard control
    head.setAttribute('tabindex', '0');
    head.setAttribute('role', 'button');

    if (!first) card.classList.add('collapsed');
    first = false;
    head.setAttribute('aria-expanded', card.classList.contains('collapsed') ? 'false' : 'true');

    function toggle() {
      card.classList.toggle('collapsed');
      head.setAttribute('aria-expanded', card.classList.contains('collapsed') ? 'false' : 'true');
    }
    head.addEventListener('click', toggle);
    head.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });

    handled.push(card);
  });

  // ---- completion tick ----
  // A section is "done" when every required choice-group is answered and
  // every required (*) text field is filled. Unmarked/optional fields don't count.
  function cardDone(card) {
    var ok = true, hasReq = false;
    card.querySelectorAll('.f[data-group]').forEach(function (g) {
      hasReq = true;
      var opts = g.querySelector('.opts'); if (!opts) return;
      var checked = g.querySelectorAll('input:checked').length;
      var total = g.querySelectorAll('input[type=checkbox],input[type=radio]').length;
      if (opts.hasAttribute('data-all')) { if (checked < total) ok = false; }
      else { var min = parseInt(opts.getAttribute('data-min') || '1', 10); if (checked < min) ok = false; }
    });
    card.querySelectorAll('.f:not([data-group])').forEach(function (f) {
      var lbl = f.querySelector('label.q');
      if (!(lbl && lbl.querySelector('.req'))) return;   // only fields marked required (*)
      hasReq = true;
      var inp = f.querySelector('input,textarea,select');
      if (inp && !String(inp.value).trim()) ok = false;
    });
    return hasReq && ok;
  }
  function refresh() {
    handled.forEach(function (card) { card.classList.toggle('done', cardDone(card)); });
  }
  form.addEventListener('input', refresh);
  form.addEventListener('change', refresh);
  refresh();
  setTimeout(refresh, 600);      // re-check after autosave has restored any saved answers

  // ---- open everything on submit so validation + PDF see all fields ----
  form.addEventListener('submit', function () {
    handled.forEach(function (card) {
      card.classList.remove('collapsed');
      var h = card.querySelector(':scope > .sec-h');
      if (h) h.setAttribute('aria-expanded', 'true');
    });
  }, true);
})();
