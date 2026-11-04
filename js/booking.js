/* ==========================================================================
   Réservation 100 % statique : aucune donnée n'est envoyée à un serveur.
   La demande se transforme en SMS pré-rempli (sms:), appel (tel:),
   message Instagram (copié) ou fichier agenda (.ics).
   ========================================================================== */
(function () {
  'use strict';

  var PHONE_E164 = '+33785579300';
  var ADDRESS = '370 route de Saint-Canadet, 13100 Aix-en-Provence';
  var SLOT_FIRST = 9 * 60;          // 9h00
  var SLOT_LAST = 17 * 60 + 30;     // dernier départ 17h30
  var SLOT_STEP = 30;
  var DAYS_AHEAD = 14;              // nombre de jours ouvrés proposés
  var EVENT_MINUTES = 90;           // durée indicative dans le fichier agenda
  var ANY_SERVICE = 'Je ne sais pas, conseillez-moi';

  var form = document.getElementById('bookingForm');
  if (!form) return;

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var state = { step: 1, services: [], date: null, time: null, name: '', first: null, note: '' };
  var stepEls = $$('.bstep', form);
  var pills = $$('#bsteps li');
  var btnNext = $('#bNext');
  var btnBack = $('#bBack');
  var errBox = $('#berror');
  var chipsBox = $('#svcChips');
  var datesBox = $('#dates');
  var slotsBox = $('#slots');
  var toastEl = null;

  try { state.name = localStorage.getItem('ambre_name') || ''; } catch (e) {}

  /* ---------- Utilitaires ---------- */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function fromIso(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function frDate(d) { return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }); }
  function frTime(t) { var p = t.split(':'); return +p[0] + 'h' + p[1]; }
  function list(arr) {
    if (arr.length <= 1) return arr.join('');
    return arr.slice(0, -1).join(', ') + ' et ' + arr[arr.length - 1];
  }
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      toastEl.setAttribute('role', 'status');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { toastEl.classList.remove('is-on'); }, 3200);
  }

  /* ---------- Étape 1 : prestations ---------- */
  function buildChips() {
    var names = $$('.svc[data-service]').map(function (el) { return el.getAttribute('data-service'); });
    names.push(ANY_SERVICE);
    chipsBox.innerHTML = '';
    names.forEach(function (n) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.setAttribute('aria-pressed', state.services.indexOf(n) > -1 ? 'true' : 'false');
      b.setAttribute('data-name', n);
      b.innerHTML = '<span class="chip__box" aria-hidden="true"></span><span></span>';
      b.lastChild.textContent = n;
      b.addEventListener('click', function () { toggleService(n); });
      chipsBox.appendChild(b);
    });
  }
  function toggleService(n) {
    var i = state.services.indexOf(n);
    if (n === ANY_SERVICE) { state.services = i > -1 ? [] : [ANY_SERVICE]; }
    else {
      state.services = state.services.filter(function (s) { return s !== ANY_SERVICE; });
      if (i > -1) state.services = state.services.filter(function (s) { return s !== n; });
      else state.services.push(n);
    }
    syncChips();
    hideError();
  }
  function syncChips() {
    $$('.chip', chipsBox).forEach(function (c) {
      c.setAttribute('aria-pressed', state.services.indexOf(c.getAttribute('data-name')) > -1 ? 'true' : 'false');
    });
  }

  /* ---------- Étape 2 : date et créneau ---------- */
  function openDays() {
    var out = [];
    var d = new Date();
    // Aujourd'hui seulement s'il reste du temps, sinon on démarre demain.
    if (d.getHours() >= 16) d.setDate(d.getDate() + 1);
    d.setHours(0, 0, 0, 0);
    while (out.length < DAYS_AHEAD) {
      var wd = d.getDay();
      if (wd >= 1 && wd <= 5) out.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    return out;
  }
  function buildDates() {
    datesBox.innerHTML = '';
    openDays().forEach(function (d, idx) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'date';
      b.setAttribute('data-date', iso(d));
      b.setAttribute('aria-pressed', state.date === iso(d) ? 'true' : 'false');
      b.setAttribute('aria-label', frDate(d));
      var wd = d.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '');
      var mo = d.toLocaleDateString('fr-FR', { month: 'short' });
      b.innerHTML = '<small></small><b></b><em></em>';
      b.children[0].textContent = wd;
      b.children[1].textContent = d.getDate();
      b.children[2].textContent = mo;
      b.addEventListener('click', function () { state.date = iso(d); if (state.time && !slotAllowed(state.time)) state.time = null; syncDates(); buildSlots(); hideError(); });
      datesBox.appendChild(b);
    });
  }
  function syncDates() {
    $$('.date', datesBox).forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-date') === state.date ? 'true' : 'false'); });
  }
  function slotAllowed(t) {
    if (t === 'flexible') return true;
    if (!state.date) return true;
    var now = new Date();
    if (state.date !== iso(now)) return true;
    var p = t.split(':');
    return (+p[0] * 60 + +p[1]) >= now.getHours() * 60 + now.getMinutes() + 60;
  }
  function buildSlots() {
    slotsBox.innerHTML = '';
    if (!state.date) {
      var hint = document.createElement('p');
      hint.className = 'bhint';
      hint.textContent = 'Choisissez d’abord un jour pour voir les créneaux.';
      slotsBox.appendChild(hint);
      return;
    }
    for (var m = SLOT_FIRST; m <= SLOT_LAST; m += SLOT_STEP) {
      var t = pad(Math.floor(m / 60)) + ':' + pad(m % 60);
      if (!slotAllowed(t)) continue;
      slotsBox.appendChild(slotBtn(t, frTime(t)));
    }
    var flex = slotBtn('flexible', 'Peu importe l’heure, je m’adapte');
    flex.classList.add('slot--wide');
    slotsBox.appendChild(flex);
  }
  function slotBtn(value, label) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'slot';
    b.textContent = label;
    b.setAttribute('data-time', value);
    b.setAttribute('aria-pressed', state.time === value ? 'true' : 'false');
    b.addEventListener('click', function () {
      state.time = value;
      $$('.slot', slotsBox).forEach(function (s) { s.setAttribute('aria-pressed', s === b ? 'true' : 'false'); });
      hideError();
    });
    return b;
  }

  /* ---------- Étape 3 : coordonnées ---------- */
  var nameInput = $('#fName');
  var noteInput = $('#fNote');
  nameInput.value = state.name;
  nameInput.addEventListener('input', function () { state.name = nameInput.value; hideError(); });
  noteInput.addEventListener('input', function () { state.note = noteInput.value; });
  nameInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); next(); } });
  $$('[data-first]').forEach(function (b) {
    b.addEventListener('click', function () {
      state.first = b.getAttribute('data-first');
      $$('[data-first]').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
    });
  });

  /* ---------- Message et sorties ---------- */
  function message() {
    var parts = [];
    parts.push('Bonjour Ambre, c’est ' + (state.name.trim() || '…') + '.');
    if (state.services.length && state.services[0] !== ANY_SERVICE) {
      parts.push('Je souhaiterais prendre rendez-vous pour : ' + list(state.services) + '.');
    } else {
      parts.push('Je souhaiterais prendre rendez-vous, mais j’aimerais être conseillée sur la prestation idéale.');
    }
    if (state.date) {
      var when = frDate(fromIso(state.date));
      parts.push('Date souhaitée : ' + when + (state.time && state.time !== 'flexible' ? ' à ' + frTime(state.time) : ', horaire flexible') + '.');
    }
    if (state.first === 'yes') parts.push('Ce serait ma première visite.');
    if (state.first === 'no') parts.push('Ce n’est pas ma première visite.');
    if (state.note.trim()) parts.push('Mon inspiration : ' + state.note.trim());
    parts.push('Pouvez-vous me confirmer la disponibilité ? Merci beaucoup !');
    return parts.join('\n');
  }
  function smsHref(msg) { return 'sms:' + PHONE_E164 + '?&body=' + encodeURIComponent(msg); }

  function renderTicket() {
    var msg = message();
    var when = state.date ? frDate(fromIso(state.date)) : '';
    var time = state.time === 'flexible' ? 'Horaire flexible' : (state.time ? frTime(state.time) : '');
    var t = $('#ticket');
    t.innerHTML = '<dl></dl><p class="ticket__msg"></p>';
    var dl = $('dl', t);
    function row(k, v) {
      var dt = document.createElement('dt'); dt.textContent = k;
      var dd = document.createElement('dd'); dd.textContent = v;
      dl.appendChild(dt); dl.appendChild(dd);
    }
    row('Prénom', state.name.trim());
    row('Prestation', state.services[0] === ANY_SERVICE ? 'Conseil sur mesure' : list(state.services));
    row('Jour', when);
    row('Heure', time);
    $('.ticket__msg', t).textContent = msg;

    var href = smsHref(msg);
    $('#sendSms').setAttribute('href', href);
    drawQr(href);
  }

  function drawQr(uri) {
    var box = $('#qr');
    var fine = window.matchMedia('(hover:hover) and (pointer:fine)').matches;
    if (!fine || typeof window.qrcode !== 'function') { box.hidden = true; return; }
    try {
      var qr = window.qrcode(0, 'L');
      qr.addData(uri);
      qr.make();
      $('#qrImg').innerHTML = qr.createSvgTag({ cellSize: 3, margin: 0, scalable: true });
      box.hidden = false;
    } catch (e) { box.hidden = true; }
  }

  function copyText(txt) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(txt);
    }
    return new Promise(function (res, rej) {
      var ta = document.createElement('textarea');
      ta.value = txt; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy') ? res() : rej(); } catch (e) { rej(e); }
      document.body.removeChild(ta);
    });
  }
  $('#copyMsg').addEventListener('click', function () {
    copyText(message()).then(function () { toast('Message copié. Collez-le dans un SMS, WhatsApp ou Instagram.'); }, function () { toast('Copie impossible : sélectionnez le texte du récapitulatif.'); });
  });
  $('#sendIg').addEventListener('click', function () {
    copyText(message()).then(function () { toast('Message copié : collez-le dans la conversation Instagram.'); }, function () {});
  });
  $('#sendSms').addEventListener('click', function () {
    var fine = window.matchMedia('(hover:hover) and (pointer:fine)').matches;
    if (fine) { copyText(message()).then(function () { toast('Pas de SMS sur ordinateur : message copié, ou scannez le QR code.'); }, function () {}); }
  });

  function icsEscape(s) { return String(s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;'); }
  function stamp(d) { return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + 'T' + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + 'Z'; }
  $('#dlIcs').addEventListener('click', function () {
    var d = fromIso(state.date);
    var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Ambre N Onglerie//Demande de rendez-vous//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
      'UID:' + Date.now() + '@ambre-n-onglerie', 'DTSTAMP:' + stamp(new Date())];
    if (state.time && state.time !== 'flexible') {
      var p = state.time.split(':');
      var s = new Date(d.getFullYear(), d.getMonth(), d.getDate(), +p[0], +p[1]);
      var e = new Date(s.getTime() + EVENT_MINUTES * 60000);
      var f = function (x) { return x.getFullYear() + pad(x.getMonth() + 1) + pad(x.getDate()) + 'T' + pad(x.getHours()) + pad(x.getMinutes()) + '00'; };
      lines.push('DTSTART:' + f(s), 'DTEND:' + f(e));
    } else {
      var nx = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      var g = function (x) { return x.getFullYear() + pad(x.getMonth() + 1) + pad(x.getDate()); };
      lines.push('DTSTART;VALUE=DATE:' + g(d), 'DTEND;VALUE=DATE:' + g(nx));
    }
    lines.push('SUMMARY:' + icsEscape('Ambre N Onglerie (à confirmer)'),
      'LOCATION:' + icsEscape(ADDRESS),
      'DESCRIPTION:' + icsEscape('Demande de rendez-vous : ' + list(state.services) + '. En attente de confirmation par SMS. Tél. 07 85 57 93 00'),
      'END:VEVENT', 'END:VCALENDAR');
    var blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'rendez-vous-ambre-n-onglerie.ics';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1500);
  });

  /* ---------- Navigation entre étapes ---------- */
  function showError(msg) { errBox.textContent = msg; errBox.hidden = false; }
  function hideError() { errBox.hidden = true; }
  function validate(step) {
    if (step === 1 && !state.services.length) { showError('Choisissez au moins une prestation pour continuer.'); return false; }
    if (step === 2 && (!state.date || !state.time)) { showError('Choisissez un jour et un créneau (ou « peu importe l’heure »).'); return false; }
    if (step === 3 && !state.name.trim()) { showError('Indiquez votre prénom pour qu’Ambre sache à qui répondre.'); nameInput.focus(); return false; }
    return true;
  }
  function go(n, opts) {
    var from = state.step;
    state.step = n;
    hideError();
    stepEls.forEach(function (el) {
      var is = +el.getAttribute('data-bstep') === n;
      if (is) {
        el.hidden = false;
        el.classList.add('is-current');
        if (window.gsap && !reduce && opts && opts.animate !== false) {
          window.gsap.fromTo(el, { autoAlpha: 0, y: n > from ? 28 : -18 }, { autoAlpha: 1, y: 0, duration: .8, ease: 'expo.out', clearProps: 'transform,opacity,visibility' });
        }
      } else { el.hidden = true; el.classList.remove('is-current'); }
    });
    pills.forEach(function (li, i) {
      li.classList.toggle('is-current', i + 1 === n);
      li.classList.toggle('is-done', i + 1 < n);
      if (i + 1 === n) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    });
    btnBack.hidden = n === 1;
    btnNext.hidden = n === 4;
    $('span', btnNext).textContent = n === 3 ? 'Voir ma demande' : 'Continuer';
    if (n === 2) { if (!datesBox.children.length) buildDates(); buildSlots(); }
    if (n === 4) renderTicket();
    if (opts && opts.scroll !== false && window.__scrollTo) window.__scrollTo('#booking', -110);
    var h = stepEls.filter(function (el) { return +el.getAttribute('data-bstep') === n; })[0];
    var heading = h && $('h3', h);
    if (heading && opts && opts.focus) { heading.setAttribute('tabindex', '-1'); heading.focus({ preventScroll: true }); }
  }
  function next() {
    if (!validate(state.step)) return;
    if (state.step === 3) {
      try { localStorage.setItem('ambre_name', state.name.trim()); } catch (e) {}
    }
    if (state.step < 4) go(state.step + 1, { scroll: true, focus: true });
  }
  btnNext.addEventListener('click', next);
  btnBack.addEventListener('click', function () { if (state.step > 1) go(state.step - 1, { scroll: true, focus: true }); });
  form.addEventListener('submit', function (e) { e.preventDefault(); });

  /* ---------- Initialisation ---------- */
  buildChips();
  buildDates();
  go(1, { animate: false, scroll: false });

  // Depuis une carte de prestation : présélectionne et revient à l'étape 1.
  window.AmbreBooking = {
    preselect: function (name) {
      if (state.services.indexOf(name) === -1) {
        state.services = state.services.filter(function (s) { return s !== ANY_SERVICE; });
        state.services.push(name);
      }
      syncChips();
      if (state.step !== 1) go(1, { scroll: false, animate: false });
      toast(name + ' ajouté à votre demande.');
    }
  };
})();
