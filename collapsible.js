/* ============================================================
   LAYALI CLINIC — Collapsible sections
   ------------------------------------------------------------
   Plain-English summary:
   • Turns each section of the consent form into a tap-to-open
     panel. Instead of one long scroll, the client sees a tidy
     list of section titles and opens them one at a time — so it
     feels short and manageable.
   • The FIRST section starts open; the rest start closed.
   • When they submit, EVERY section is opened automatically, so
     nothing is hidden while the form checks their answers and
     builds the PDF (and any missed question is visible).
   • It leaves the pop-in "area" cards on the filler form alone
     (those already appear/disappear on their own).
   ============================================================ */
(function () {
  var form = document.querySelector('form');
  if (!form) return;
  var cards = form.querySelectorAll('.card');
  if (!cards.length) return;

  form.classList.add('collapse-ready');
  var first = true;

  Array.prototype.forEach.call(cards, function (card) {
    // skip the conditional "area" cards — they manage their own show/hide
    if (card.hasAttribute('data-cond')) return;
    var head = card.querySelector(':scope > .sec-h');
    if (!head) return;

    // move everything below the header into a wrapper we can hide
    var body = document.createElement('div');
    body.className = 'card-body';
    var n = head.nextSibling;
    while (n) { var next = n.nextSibling; body.appendChild(n); n = next; }
    card.appendChild(body);
    card.classList.add('cx');

    // little chevron on the right of the header
    var chev = document.createElement('span');
    chev.className = 'chev';
    chev.setAttribute('aria-hidden', 'true');
    chev.textContent = '⌄';
    head.appendChild(chev);

    // first section open, the rest closed
    if (!first) card.classList.add('collapsed');
    first = false;

    head.addEventListener('click', function () {
      card.classList.toggle('collapsed');
    });
  });

  // open everything on submit so validation + PDF see all fields
  form.addEventListener('submit', function () {
    Array.prototype.forEach.call(form.querySelectorAll('.card.collapsed'), function (c) {
      c.classList.remove('collapsed');
    });
  }, true);
})();
