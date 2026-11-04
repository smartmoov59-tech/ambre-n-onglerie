/* ==========================================================================
   Ambre N Onglerie : moteur d'animations (GSAP + ScrollTrigger + Lenis)
   Règles : transform / opacity en priorité, courbes douces (expo, power3),
   version allégée sur mobile et si prefers-reduced-motion est activé.
   ========================================================================== */
(function () {
  'use strict';

  var gsap = window.gsap, ScrollTrigger = window.ScrollTrigger;
  var html = document.documentElement;
  if (!gsap || !ScrollTrigger) { html.classList.add('failsafe'); return; }
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });
  // Le préchargeur et les sections épinglées supposent un départ en haut de page.
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  if (!location.hash) window.scrollTo(0, 0);

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover:hover) and (pointer:fine)').matches;
  var isDesktop = window.matchMedia('(min-width: 900px)').matches;
  var expoOut = 'expo.out';

  var nav = $('#nav');
  var loader = $('#loader');
  var lenis = null;

  /* ------------------------------------------------------------------
     Défilement fluide (Lenis) + ancres
     ------------------------------------------------------------------ */
  if (!reduce && window.Lenis) {
    lenis = new window.Lenis({ duration: 1.15, easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); }, wheelMultiplier: .95 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
    lenis.stop();
  }
  function scrollToEl(target, offset) {
    var el = typeof target === 'string' ? $(target) : target;
    if (!el) return;
    if (lenis) lenis.scrollTo(el, { offset: offset || 0, duration: 1.7, easing: function (t) { return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); } });
    else window.scrollTo({ top: el.getBoundingClientRect().top + window.pageYOffset + (offset || 0), behavior: reduce ? 'auto' : 'smooth' });
  }
  window.__scrollTo = scrollToEl;

  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute('href');
    if (!id || id.length < 2) return;
    var t = $(id);
    if (!t) return;
    e.preventDefault();
    setMenu(false);
    scrollToEl(id === '#top' ? document.body : t, 0);
    try { history.replaceState(null, '', id); } catch (err) {}
  });
  var toTop = $('#toTop');
  if (toTop) toTop.addEventListener('click', function () { scrollToEl(document.body, 0); });
  var yearEl = $('#year'); if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ------------------------------------------------------------------
     Découpe de texte (mots / lettres) avec masque
     ------------------------------------------------------------------ */
  function splitText(el, mode) {
    if (!el || el.__split) return el ? el.__split : [];
    var label = el.textContent.replace(/\s+/g, ' ').trim();
    if (!el.hasAttribute('aria-label') && /^H[1-6]$|^P$/.test(el.tagName)) el.setAttribute('aria-label', label);
    function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (ch) {
        if (ch.nodeType === 3) {
          var txt = ch.textContent;
          if (!txt.trim()) return;
          var frag = document.createDocumentFragment();
          txt.split(/(\s+)/).forEach(function (p) {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(' ')); return; }
            var w = document.createElement('span');
            w.className = 'w';
            w.setAttribute('aria-hidden', 'true');
            if (mode === 'chars') {
              Array.from(p).forEach(function (c) {
                var s = document.createElement('span'); s.className = 'c'; s.textContent = c; w.appendChild(s);
              });
            } else {
              var i = document.createElement('span'); i.className = 'wi'; i.textContent = p; w.appendChild(i);
            }
            frag.appendChild(w);
          });
          ch.parentNode.replaceChild(frag, ch);
        } else if (ch.nodeType === 1 && ch.tagName !== 'BR') { walk(ch); }
      });
    }
    walk(el);
    el.__split = $$(mode === 'chars' ? '.c' : '.wi', el);
    return el.__split;
  }

  /* ------------------------------------------------------------------
     Gouttes d'ambre (séparateurs de sections)
     ------------------------------------------------------------------ */
  function seeded(seed) { var s = seed * 9301 + 49297; return function () { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }
  var dripsPlayed = false;
  function buildDrips() {
    var NS = 'http://www.w3.org/2000/svg';
    $$('[data-drip]').forEach(function (svg) {
      var W = svg.clientWidth || window.innerWidth, H = svg.clientHeight || 100;
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      svg.innerHTML = '';
      var rnd = seeded(parseInt(svg.getAttribute('data-seed') || '1', 10));
      var band = document.createElementNS(NS, 'rect');
      band.setAttribute('x', -2); band.setAttribute('y', -2); band.setAttribute('width', W + 4); band.setAttribute('height', 10);
      svg.appendChild(band);
      var small = W < 700, x = 8 + rnd() * 40, drops = [];
      while (x < W - 24) {
        var w = (small ? 12 : 14) + rnd() * (small ? 12 : 24);
        var len = 20 + rnd() * (H - 34);
        var stemW = w * .52, r = w * .5;
        var g = document.createElementNS(NS, 'g');
        var stem = document.createElementNS(NS, 'rect');
        stem.setAttribute('x', x + (w - stemW) / 2); stem.setAttribute('y', 2); stem.setAttribute('width', stemW); stem.setAttribute('height', Math.max(4, len - r));
        var bulb = document.createElementNS(NS, 'circle');
        bulb.setAttribute('cx', x + w / 2); bulb.setAttribute('cy', len - r + 2); bulb.setAttribute('r', r);
        g.appendChild(stem); g.appendChild(bulb); svg.appendChild(g); drops.push(g);
        x += w + 26 + rnd() * (small ? 70 : 150);
      }
      svg.__drops = drops;
      if (dripsPlayed || reduce || svg.__played) gsap.set(drops, { scaleY: 1, transformOrigin: '50% 0%' });
    });
  }
  function initDrips() {
    buildDrips();
    if (reduce) return;
    $$('[data-drip]').forEach(function (svg) {
      gsap.set(svg.__drops, { scaleY: 0, transformOrigin: '50% 0%' });
      ScrollTrigger.create({
        trigger: svg, start: 'top 92%', once: true,
        onEnter: function () {
          svg.__played = true;
          gsap.to(svg.__drops, { scaleY: 1, duration: 1.8, ease: 'power3.out', stagger: { each: .08, from: 'random' } });
        }
      });
    });
  }

  /* ------------------------------------------------------------------
     Préchargeur + entrée du hero
     ------------------------------------------------------------------ */
  var heroTitle = $('.hero__title');
  var heroChars = [];
  if (!reduce) {
    $$('.hero__line .split', heroTitle).forEach(function (s) { heroChars = heroChars.concat(splitText(s, 'chars')); });
    gsap.set(heroChars, { yPercent: 118 });
    gsap.set(['.hero__kicker', '.hero__lead', '.hero__cta', '.hero__rating'], { opacity: 0, y: 36 });
    gsap.set('.frame', { opacity: 0, y: 220 });
    gsap.set('.orb', { opacity: 0, scale: 0 });
    gsap.set('.hero__media', { scale: 1.28 });
    gsap.set('.hero__scroll', { opacity: 0 });
    if (nav) nav.classList.add('is-hidden');
  }

  function heroIn() {
    var tl = gsap.timeline({ defaults: { ease: expoOut } });
    tl.to('.hero__media', { scale: 1, duration: 2.6, ease: 'power3.out' }, 0)
      .to(heroChars, { yPercent: 0, duration: 1.6, stagger: .05 }, .05)
      .to('.hero__kicker', { opacity: 1, y: 0, duration: 1.2 }, .25)
      .to('.frame', { opacity: 1, y: 0, duration: 1.8, stagger: .14 }, .3)
      .to('.orb', { opacity: 1, scale: 1, duration: 1.6, stagger: .12, ease: 'elastic.out(1,.55)' }, .8)
      .to(['.hero__lead', '.hero__cta', '.hero__rating'], { opacity: 1, y: 0, duration: 1.3, stagger: .12 }, .75)
      .to('.hero__scroll', { opacity: 1, duration: 1 }, 1.4)
      .add(function () {
        if (nav) nav.classList.remove('is-hidden');
        var m = $('.mcta'); if (m) m.classList.add('is-on');
      }, .9);
    return tl;
  }

  function runLoader() {
    return new Promise(function (resolve) {
      if (reduce || !loader) { if (loader) loader.remove(); resolve(); return; }
      var num = $('#loaderNum'), fill = $('.loader__fill'), dome = $('.loader__dome'), inner = $('.loader__inner');
      var word = $('.loader__word');
      var wc = splitText(word, 'chars');
      gsap.set(wc, { yPercent: 125 });
      gsap.set(dome, { yPercent: 100 });
      gsap.set(fill, { scaleY: 0, svgOrigin: '60 170' });
      var st = { v: 0 };
      var A = gsap.timeline();
      A.to(wc, { yPercent: 0, duration: 1.1, ease: expoOut, stagger: .06 }, .1)
        .to(fill, { scaleY: 1, duration: 1.7, ease: 'power2.inOut' }, .15)
        .to(st, { v: 100, duration: 1.7, ease: 'power2.inOut', onUpdate: function () { num.textContent = String(Math.round(st.v)).padStart(3, '0'); } }, .15);
      var done = new Promise(function (r) { A.eventCallback('onComplete', r); });

      var video = $('#heroVideo');
      var videoReady = new Promise(function (r) {
        if (!video || video.readyState >= 2) return r();
        video.addEventListener('loadeddata', r, { once: true });
        setTimeout(r, 2500);
      });
      var fontsReady = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
      var cap = new Promise(function (r) { setTimeout(r, 4500); });

      Promise.all([done, Promise.race([Promise.all([videoReady, fontsReady]), cap])]).then(function () {
        var out = gsap.timeline({ onComplete: function () { loader.remove(); if (lenis) lenis.start(); ScrollTrigger.refresh(); } });
        out.to(inner, { y: -30, opacity: 0, duration: .55, ease: 'power3.in' })
          .addLabel('dome', '-=.1')
          .to(dome, { yPercent: -100, duration: 1.7, ease: 'power3.inOut' }, 'dome')
          .set(loader, { backgroundColor: 'transparent' }, 'dome+=.85')
          .add(function () { heroIn(); }, 'dome+=.95');
        resolve();
      });
    });
  }

  /* ------------------------------------------------------------------
     Hero : parallax multicouche
     ------------------------------------------------------------------ */
  function initHeroParallax() {
    if (reduce) return;
    var hero = $('.hero');
    var tl = gsap.timeline({ scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
    tl.to('.hero__media', { yPercent: 14, ease: 'none' }, 0)
      .to('.hero__title', { y: -90, ease: 'none' }, 0)
      .to('.hero__glow', { y: 160, ease: 'none' }, 0);
    if (isDesktop) {
      $$('.frame').forEach(function (f) {
        var d = parseFloat(f.getAttribute('data-depth')) || 0;
        tl.to(f, { yPercent: d * 160, ease: 'none' }, 0);
      });
      tl.to('.orb--1', { y: -140, ease: 'none' }, 0).to('.orb--2', { y: 90, ease: 'none' }, 0).to('.orb--3', { y: -60, ease: 'none' }, 0);
    }
    tl.to(['.hero__bottom'], { opacity: .0, y: 40, ease: 'none' }, .35);
    // Léger zoom du fond vidéo : effet Ken Burns
    gsap.to('.hero__video', { scale: 1.08, duration: 18, ease: 'sine.inOut', yoyo: true, repeat: -1 });
  }

  /* ------------------------------------------------------------------
     Titres, révélations
     ------------------------------------------------------------------ */
  function initReveals() {
    $$('[data-split]').forEach(function (h) {
      if (h.closest('.hs__outro')) return;
      var words = splitText(h, 'words');
      if (reduce) return;
      gsap.set(words, { yPercent: 118 });
      ScrollTrigger.create({
        trigger: h, start: 'top 88%', once: true,
        onEnter: function () { gsap.to(words, { yPercent: 0, duration: 1.4, ease: expoOut, stagger: .055 }); }
      });
    });
    if (reduce) return;
    $$('[data-reveal]').forEach(function (el) {
      gsap.set(el, { opacity: 0, y: 44 });
      ScrollTrigger.create({
        trigger: el, start: 'top 90%', once: true,
        onEnter: function () { gsap.to(el, { opacity: 1, y: 0, duration: 1.3, ease: 'power3.out', delay: parseFloat(el.getAttribute('data-delay')) || 0 }); }
      });
    });
  }

  /* ------------------------------------------------------------------
     Marquee : vitesse et sens réactifs au scroll
     ------------------------------------------------------------------ */
  function initMarquee() {
    var rows = $$('.marquee__row');
    rows.forEach(function (row) {
      var track = $('.marquee__track', row);
      var belt = document.createElement('div');
      belt.className = 'marquee__belt';
      belt.style.cssText = 'display:flex;width:max-content;will-change:transform';
      row.insertBefore(belt, track);
      belt.appendChild(track);
      var copies = Math.max(2, Math.ceil((window.innerWidth * 2) / Math.max(1, track.offsetWidth)) + 1);
      for (var i = 0; i < copies; i++) {
        var c = track.cloneNode(true); c.setAttribute('aria-hidden', 'true'); belt.appendChild(c);
      }
      row.__belt = belt; row.__x = 0; row.__w = track.offsetWidth;
    });
    if (reduce) return;
    var dirNow = 1, lastY = window.pageYOffset;
    gsap.ticker.add(function (time, dt) {
      var y = window.pageYOffset, dy = y - lastY; lastY = y;
      if (Math.abs(dy) > .5) dirNow += ((dy > 0 ? 1 : -1) - dirNow) * .12;
      var boost = Math.min(Math.abs(dy), 90) * .55;
      var f = dt / 16.667;
      rows.forEach(function (row) {
        var dir = parseFloat(row.getAttribute('data-dir')) || -1;
        var speed = (1.05 + boost) * f;
        row.__x += dir * dirNow * speed;
        var w = row.__w || 1;
        row.__x = ((row.__x % w) - w) % w;
        row.__belt.style.transform = 'translate3d(' + row.__x + 'px,0,0)';
      });
    });
  }

  /* ------------------------------------------------------------------
     Sections épinglées / défilement horizontal (desktop)
     ------------------------------------------------------------------ */
  var mm = gsap.matchMedia();
  function initPinned() {
    mm.add('(min-width: 900px) and (prefers-reduced-motion: no-preference)', function () {
      /* ---- Storytelling pinné ---- */
      var pin = $('.story__pin'), steps = $$('.story .step'), imgs = $$('.story__img'), idx = $('.story__idx'), bar = $('.story__progress i');
      var total = steps.length, current = 0;
      imgs.forEach(function (im, k) { im.style.zIndex = k + 1; im.dataset.on = k === 0 ? '1' : '0'; });
      function setStep(i) {
        var prev = current; current = i;
        steps.forEach(function (s, k) {
          if (k === i) {
            s.classList.add('is-active');
            gsap.fromTo(s, { autoAlpha: 0, y: prev < i ? 44 : -44 }, { autoAlpha: 1, y: 0, duration: 1, ease: expoOut, overwrite: true, delay: .12 });
          } else if (s.classList.contains('is-active')) {
            s.classList.remove('is-active');
            gsap.to(s, { autoAlpha: 0, y: prev < i ? -44 : 44, duration: .45, ease: 'power2.in', overwrite: true });
          }
        });
        imgs.forEach(function (im, k) {
          var show = k <= i, was = im.dataset.on === '1';
          if (show && !was) {
            im.dataset.on = '1';
            gsap.fromTo(im, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.3, ease: expoOut, overwrite: true });
          } else if (!show && was) {
            im.dataset.on = '0';
            gsap.to(im, { clipPath: 'inset(100% 0% 0% 0%)', duration: .9, ease: 'expo.inOut', overwrite: true });
          }
        });
        gsap.to(idx, { yPercent: -30, opacity: 0, duration: .25, ease: 'power2.in', onComplete: function () {
          idx.textContent = '0' + (i + 1);
          gsap.fromTo(idx, { yPercent: 30, opacity: 0 }, { yPercent: 0, opacity: 1, duration: .6, ease: expoOut });
        } });
      }
      ScrollTrigger.create({
        trigger: pin, start: 'top top', end: function () { return '+=' + Math.round(window.innerHeight * 3.4); },
        pin: true, anticipatePin: 1,
        onUpdate: function (self) {
          gsap.set(bar, { scaleX: self.progress });
          var i = Math.min(total - 1, Math.floor(self.progress * total * .9999));
          if (i !== current) setStep(i);
        }
      });
      gsap.to(imgs, { scale: 1.1, ease: 'none', scrollTrigger: { trigger: pin, start: 'top top', end: function () { return '+=' + Math.round(window.innerHeight * 3.4); }, scrub: true } });

      /* ---- Prestations : défilement horizontal piloté par le scroll vertical ---- */
      var hs = $('#hs'), track = $('#hsTrack'), hsBar = $('.hs__bar i');
      var dist = function () { return Math.max(0, track.scrollWidth - window.innerWidth); };
      var tween = gsap.to(track, {
        x: function () { return -dist(); }, ease: 'none',
        scrollTrigger: {
          trigger: hs, start: 'top top', end: function () { return '+=' + dist(); },
          pin: true, scrub: .9, anticipatePin: 1, invalidateOnRefresh: true,
          onUpdate: function (self) { gsap.set(hsBar, { scaleX: self.progress }); }
        }
      });
      $$('.svc__img img').forEach(function (img) {
        gsap.fromTo(img, { xPercent: -6 }, { xPercent: 6, ease: 'none', scrollTrigger: { trigger: img.closest('.svc'), containerAnimation: tween, start: 'left right', end: 'right left', scrub: true } });
      });
      $$('.svc').forEach(function (c) {
        gsap.from(c, { opacity: 0, rotation: 2.5, y: 60, duration: 1.2, ease: 'power3.out', scrollTrigger: { trigger: c, containerAnimation: tween, start: 'left 92%', toggleActions: 'play none none none' } });
      });
      var outro = $('.outro__big');
      if (outro) {
        var ow = splitText(outro, 'words');
        gsap.set(ow, { yPercent: 118 });
        gsap.to(ow, { yPercent: 0, duration: 1.4, ease: expoOut, stagger: .07, scrollTrigger: { trigger: outro, containerAnimation: tween, start: 'left 85%', toggleActions: 'play none none none' } });
      }
      return function () {
        steps.forEach(function (s, k) { s.classList.toggle('is-active', k === 0); });
        imgs.forEach(function (im) { im.dataset.on = '0'; });
      };
    });

    mm.add('(max-width: 899px), (prefers-reduced-motion: reduce)', function () {
      if (reduce) return;
      // Mobile : apparition simple des étapes et des cartes
      $$('.story .step').forEach(function (s) { gsap.from(s, { opacity: 0, y: 40, duration: 1.1, ease: 'power3.out', scrollTrigger: { trigger: s, start: 'top 88%', toggleActions: 'play none none none' } }); });
      $$('.story__img').forEach(function (im) { gsap.from(im, { opacity: 0, y: 50, duration: 1.1, ease: 'power3.out', scrollTrigger: { trigger: im, start: 'top 92%', toggleActions: 'play none none none' } }); });
      var outro = $('.outro__big');
      if (outro) { var ow = splitText(outro, 'words'); gsap.set(ow, { yPercent: 118 }); ScrollTrigger.create({ trigger: outro, start: 'top 90%', once: true, onEnter: function () { gsap.to(ow, { yPercent: 0, duration: 1.3, ease: expoOut, stagger: .07 }); } }); }
    });
  }

  /* ------------------------------------------------------------------
     Cartes : inclinaison 3D + reflet qui suit la souris
     ------------------------------------------------------------------ */
  function initTilt() {
    if (!finePointer || reduce) return;
    $$('[data-tilt]').forEach(function (card) {
      gsap.set(card, { transformPerspective: 900 });
      var rx = gsap.quickTo(card, 'rotationX', { duration: .6, ease: 'power3' });
      var ry = gsap.quickTo(card, 'rotationY', { duration: .6, ease: 'power3' });
      var img = $('.svc__img', card);
      card.addEventListener('pointermove', function (e) {
        var r = card.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        ry((px - .5) * 14); rx((.5 - py) * 12);
        img.style.setProperty('--mx', (px * 100) + '%'); img.style.setProperty('--my', (py * 100) + '%');
      });
      card.addEventListener('pointerleave', function () { rx(0); ry(0); });
    });
  }

  /* ------------------------------------------------------------------
     Compteurs animés
     ------------------------------------------------------------------ */
  function initCounters() {
    $$('[data-count]').forEach(function (el) {
      var end = parseFloat(el.getAttribute('data-count')), dec = parseInt(el.getAttribute('data-decimals') || '0', 10);
      var fmt = function (v) { return v.toFixed(dec).replace('.', ','); };
      if (reduce) { el.textContent = fmt(end); return; }
      el.textContent = fmt(0);
      var o = { v: 0 };
      ScrollTrigger.create({
        trigger: el, start: 'top 90%', once: true,
        onEnter: function () { gsap.to(o, { v: end, duration: 2.6, ease: 'power3.out', onUpdate: function () { el.textContent = fmt(o.v); } }); }
      });
    });
  }

  /* ------------------------------------------------------------------
     Galerie : révélation en cercle, inclinaison, parallax interne, lightbox
     ------------------------------------------------------------------ */
  function initGallery() {
    var items = $$('.gal__item');
    items.forEach(function (it, i) {
      var mask = $('.gal__mask', it), inner = $('.gal__in', it);
      if (!reduce) {
        gsap.set(mask, { clipPath: 'circle(0% at 50% 60%)', scale: .92 });
        ScrollTrigger.create({
          trigger: it, start: 'top 90%', once: true,
          onEnter: function () {
            gsap.to(mask, { clipPath: 'circle(78% at 50% 60%)', scale: 1, duration: 1.6, ease: 'expo.out', onComplete: function () { gsap.set(mask, { clearProps: 'clipPath' }); } });
          }
        });
        if (isDesktop) gsap.fromTo(inner, { yPercent: -5 }, { yPercent: 5, ease: 'none', scrollTrigger: { trigger: it, start: 'top bottom', end: 'bottom top', scrub: true } });
      }
      if (finePointer && !reduce) {
        var btn = $('button', it);
        gsap.set(mask, { transformPerspective: 900 });
        var rx = gsap.quickTo(mask, 'rotationX', { duration: .7, ease: 'power3' }), ry = gsap.quickTo(mask, 'rotationY', { duration: .7, ease: 'power3' });
        btn.addEventListener('pointermove', function (e) {
          var r = btn.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
          ry((px - .5) * 10); rx((.5 - py) * 10);
        });
        btn.addEventListener('pointerleave', function () { rx(0); ry(0); });
      }
    });

    var dlg = $('#lightbox'), lbImg = $('#lbImg'), lbCap = $('#lbCap');
    var btns = $$('.gal__item button'), cur = 0;
    function show(i) {
      cur = (i + btns.length) % btns.length;
      var b = btns[cur];
      lbImg.src = b.getAttribute('data-full');
      lbImg.alt = $('img', b).alt;
      lbCap.textContent = b.getAttribute('data-cap') || '';
      if (!reduce) gsap.fromTo(lbImg, { opacity: 0, scale: .96 }, { opacity: 1, scale: 1, duration: .7, ease: expoOut });
    }
    btns.forEach(function (b, i) {
      b.addEventListener('click', function () {
        if (typeof dlg.showModal !== 'function') return;
        show(i); dlg.showModal(); if (lenis) lenis.stop();
      });
    });
    function close() { dlg.close(); }
    dlg.addEventListener('close', function () { if (lenis) lenis.start(); });
    $('.lightbox__close', dlg).addEventListener('click', close);
    $('.lightbox__nav--prev', dlg).addEventListener('click', function () { show(cur - 1); });
    $('.lightbox__nav--next', dlg).addEventListener('click', function () { show(cur + 1); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) close(); });
    dlg.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') show(cur - 1);
      if (e.key === 'ArrowRight') show(cur + 1);
    });
  }

  /* ------------------------------------------------------------------
     Entretien : accordéon + ongle qui se dessine
     ------------------------------------------------------------------ */
  function initCare() {
    var items = $$('.acc__item');
    items.forEach(function (it) {
      var btn = $('button', it);
      btn.addEventListener('click', function () {
        var open = it.classList.contains('is-open');
        items.forEach(function (o) { o.classList.remove('is-open'); $('button', o).setAttribute('aria-expanded', 'false'); });
        if (!open) { it.classList.add('is-open'); btn.setAttribute('aria-expanded', 'true'); }
      });
    });
    if (reduce) { gsap.set('.care__nail-line', { strokeDashoffset: 0 }); return; }
    gsap.to('.care__nail-line', { strokeDashoffset: 0, ease: 'none', scrollTrigger: { trigger: '.care', start: 'top 70%', end: 'bottom 80%', scrub: true } });
    gsap.fromTo('.care__nail-gloss', { opacity: 0, y: 12 }, { opacity: 1, y: 0, ease: 'none', scrollTrigger: { trigger: '.care', start: 'top 40%', end: 'center 40%', scrub: true } });
  }

  /* ------------------------------------------------------------------
     Avis : carrousel (flèches, clavier, glisser)
     ------------------------------------------------------------------ */
  function initReviews() {
    var vp = $('#revViewport'), track = $('#revTrack'), cards = $$('.rev__card'), n = cards.length;
    if (!vp || !n) return;
    var idx = 0, bar = $('#revBar'), count = $('#revCount');
    track.style.position = 'relative';
    vp.setAttribute('tabindex', '0');
    function targetX(i) {
      var c = cards[i], vw = vp.clientWidth, padL = parseFloat(getComputedStyle(vp).paddingLeft) || 0;
      return vw / 2 - padL - c.offsetLeft - c.offsetWidth / 2;
    }
    function goTo(i, instant) {
      idx = (i + n) % n;
      cards.forEach(function (c, k) { c.classList.toggle('is-active', k === idx); });
      gsap.to(track, { x: targetX(idx), duration: instant || reduce ? 0 : 1.2, ease: expoOut, overwrite: true });
      bar.style.transform = 'scaleX(' + ((idx + 1) / n) + ')';
      count.textContent = '0' + (idx + 1) + ' / 0' + n;
    }
    $('#revPrev').addEventListener('click', function () { goTo(idx - 1); });
    $('#revNext').addEventListener('click', function () { goTo(idx + 1); });
    vp.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(idx - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); goTo(idx + 1); }
    });
    var down = false, sx = 0, sx0 = 0, moved = 0, st = 0;
    vp.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      down = true; sx = e.clientX; sx0 = gsap.getProperty(track, 'x'); moved = 0; st = performance.now();
      vp.classList.add('is-drag');
      gsap.killTweensOf(track);
    });
    window.addEventListener('pointermove', function (e) {
      if (!down) return;
      moved = e.clientX - sx;
      gsap.set(track, { x: sx0 + moved });
    });
    function end() {
      if (!down) return; down = false; vp.classList.remove('is-drag');
      var v = moved / Math.max(1, performance.now() - st);
      if (moved < -60 || v < -.4) goTo(idx + 1);
      else if (moved > 60 || v > .4) goTo(idx - 1);
      else goTo(idx);
    }
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    vp.addEventListener('dragstart', function (e) { e.preventDefault(); });
    var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { goTo(idx, true); }, 150); });
    goTo(0, true);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { goTo(idx, true); });
    if (!reduce) {
      gsap.from('#revViewport', { opacity: 0, y: 70, duration: 1.5, ease: 'power3.out', scrollTrigger: { trigger: '#rev', start: 'top 88%', toggleActions: 'play none none none' } });
    }
  }

  /* ------------------------------------------------------------------
     Horaires : ouvert / fermé en temps réel (heure de Paris)
     ------------------------------------------------------------------ */
  function initHours() {
    var status = $('#openStatus'); if (!status) return;
    var paris = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
    var day = paris.getDay(), mins = paris.getHours() * 60 + paris.getMinutes();
    var isOpen = day >= 1 && day <= 5 && mins >= 540 && mins < 1140;
    var txt;
    if (isOpen) txt = 'Ouvert maintenant · jusqu’à 19h00';
    else if (day >= 1 && day <= 5 && mins < 540) txt = 'Fermé · ouvre aujourd’hui à 9h00';
    else if (day >= 1 && day <= 4) txt = 'Fermé · ouvre demain à 9h00';
    else txt = 'Fermé · ouvre lundi à 9h00';
    status.classList.toggle('is-open', isOpen);
    $('span', status).textContent = txt;
    var row = $('.hours tr[data-day="' + day + '"]'); if (row) row.classList.add('is-today');
  }

  /* ------------------------------------------------------------------
     Pied de page géant
     ------------------------------------------------------------------ */
  function initFooter() {
    var g = $('.footer__giant .split'); if (!g) return;
    var ch = splitText(g, 'chars');
    if (reduce) return;
    gsap.set(ch, { yPercent: 112 });
    ScrollTrigger.create({ trigger: '.footer__giant', start: 'top 92%', once: true, onEnter: function () { gsap.to(ch, { yPercent: 0, duration: 1.7, ease: expoOut, stagger: .06 }); } });
  }

  /* ------------------------------------------------------------------
     Navigation, menu mobile, progression, CTA mobile
     ------------------------------------------------------------------ */
  var menu = $('#menu'), burger = $('#burger'), menuOpen = false;
  function setMenu(v) {
    if (!menu || v === menuOpen) return;
    menuOpen = v;
    burger.setAttribute('aria-expanded', String(v));
    burger.setAttribute('aria-label', v ? 'Fermer le menu' : 'Ouvrir le menu');
    menu.setAttribute('aria-hidden', String(!v));
    nav.classList.toggle('is-menu', v);
    var cx = window.innerWidth - 2.6 * 16, cy = 2.6 * 16, R = Math.hypot(window.innerWidth, window.innerHeight);
    var d = reduce ? 0 : 1;
    if (v) {
      if (lenis) lenis.stop();
      gsap.set(menu, { visibility: 'visible' });
      gsap.fromTo(menu, { clipPath: 'circle(0px at ' + cx + 'px ' + cy + 'px)' }, { clipPath: 'circle(' + R + 'px at ' + cx + 'px ' + cy + 'px)', duration: 1 * d, ease: 'expo.inOut' });
      gsap.fromTo('.menu__nav a', { yPercent: 110, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 1.1 * d, stagger: .06 * d, ease: expoOut, delay: .35 * d });
      gsap.fromTo('.menu__foot > *', { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: .9 * d, stagger: .08 * d, delay: .7 * d, ease: 'power3.out' });
    } else {
      gsap.to(menu, { clipPath: 'circle(0px at ' + cx + 'px ' + cy + 'px)', duration: .8 * d, ease: 'expo.inOut', onComplete: function () { gsap.set(menu, { visibility: 'hidden' }); if (lenis) lenis.start(); } });
    }
  }
  if (burger) burger.addEventListener('click', function () { setMenu(!menuOpen); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && menuOpen) setMenu(false); });

  function initNav() {
    ScrollTrigger.create({
      start: 0, end: 'max',
      onUpdate: function (self) {
        if (menuOpen) return;
        var y = self.scroll();
        if (y < 140) nav.classList.remove('is-hidden');
        else if (self.direction === 1) nav.classList.add('is-hidden');
        else if (self.direction === -1) nav.classList.remove('is-hidden');
      }
    });
    ScrollTrigger.create({
      trigger: document.body, start: 'top top', end: 'bottom bottom',
      onUpdate: function (s) { gsap.set('#progress', { scaleX: s.progress }); }
    });
    var cta = $('.mcta'), book = $('#reserver');
    if (cta && book && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { cta.classList.toggle('is-off', en[0].isIntersecting); }, { threshold: .15 }).observe(book);
    }
  }

  /* ------------------------------------------------------------------
     Curseur, boutons magnétiques, remplissage au survol
     ------------------------------------------------------------------ */
  function initPointer() {
    $$('.btn, .svc__pick').forEach(function (b) {
      var set = function (e) { var r = b.getBoundingClientRect(); b.style.setProperty('--x', (e.clientX - r.left) + 'px'); b.style.setProperty('--y', (e.clientY - r.top) + 'px'); };
      b.addEventListener('pointerenter', set); b.addEventListener('pointerleave', set);
    });
    if (!finePointer || reduce) return;
    $$('[data-magnetic]').forEach(function (b) {
      var inner = b.firstElementChild;
      var xT = gsap.quickTo(b, 'x', { duration: .7, ease: 'elastic.out(1,.45)' }), yT = gsap.quickTo(b, 'y', { duration: .7, ease: 'elastic.out(1,.45)' });
      var ixT = inner ? gsap.quickTo(inner, 'x', { duration: .6, ease: 'power3' }) : null, iyT = inner ? gsap.quickTo(inner, 'y', { duration: .6, ease: 'power3' }) : null;
      b.addEventListener('pointermove', function (e) {
        var r = b.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        xT(dx * .28); yT(dy * .4); if (ixT) { ixT(dx * .12); iyT(dy * .2); }
      });
      b.addEventListener('pointerleave', function () { xT(0); yT(0); if (ixT) { ixT(0); iyT(0); } });
    });

    html.classList.add('has-cursor');
    var cur = $('#cursor'), lab = $('#cursorLabel');
    var qx = gsap.quickTo(cur, 'x', { duration: .4, ease: 'power3' }), qy = gsap.quickTo(cur, 'y', { duration: .4, ease: 'power3' });
    window.addEventListener('pointermove', function (e) { cur.classList.add('is-on'); qx(e.clientX); qy(e.clientY); }, { passive: true });
    document.addEventListener('pointerleave', function () { cur.classList.remove('is-on'); });
    document.addEventListener('pointerover', function (e) {
      var t = e.target.closest ? e.target : e.target.parentElement; if (!t) return;
      var label = '';
      if (t.closest('.gal__item button')) label = 'Voir';
      else if (t.closest('.rev__viewport')) label = 'Glisser';
      cur.classList.toggle('is-label', !!label);
      lab.textContent = label;
      cur.classList.toggle('is-link', !label && !!t.closest('a, button, .chip, .date, .slot, input, textarea, summary'));
    });
  }

  /* ------------------------------------------------------------------
     Liaison cartes prestations → réservation
     ------------------------------------------------------------------ */
  function initPick() {
    $$('[data-pick]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (window.AmbreBooking) window.AmbreBooking.preselect(b.getAttribute('data-pick'));
        scrollToEl('#reserver', 0);
      });
    });
  }

  /* ------------------------------------------------------------------
     Démarrage
     ------------------------------------------------------------------ */
  var video = $('#heroVideo');
  if (video) { var p = video.play(); if (p && p.catch) p.catch(function () {}); }

  initReveals();
  initDrips();
  initHeroParallax();
  initMarquee();
  initPinned();
  initTilt();
  initCounters();
  initGallery();
  initCare();
  initReviews();
  initHours();
  initFooter();
  initNav();
  initPointer();
  initPick();

  var rsT;
  var lastW = window.innerWidth;
  window.addEventListener('resize', function () {
    clearTimeout(rsT);
    rsT = setTimeout(function () {
      if (window.innerWidth !== lastW) { lastW = window.innerWidth; dripsPlayed = true; buildDrips(); }
      ScrollTrigger.refresh();
    }, 250);
  });
  window.addEventListener('load', function () { ScrollTrigger.refresh(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ScrollTrigger.refresh(); });

  runLoader().then(function () { if (reduce) { if (nav) nav.classList.remove('is-hidden'); var m = $('.mcta'); if (m) m.classList.add('is-on'); if (lenis) lenis.start(); } });
})();
