/*
 * ajmalps.com, shared behaviour. Every page loads this, after vendor/lenis.min.js.
 * Nothing here hides content: with this file blocked, every page still reads.
 */
(function () {
  'use strict';
  var root = document.documentElement;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia && matchMedia('(pointer: fine)').matches;
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  window.__aj = { reduce: reduce, fine: fine };

  /* ---------- years of experience, computed so no page states a stale figure ---------- */
  (function () {
    var START = new Date(2015, 4, 1); // May 2015
    var now = new Date();
    var y = now.getFullYear() - START.getFullYear();
    if (now.getMonth() < START.getMonth()) y--;
    if (y < 1) return;
    var WORDS = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
      'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen',
      'Eighteen', 'Nineteen', 'Twenty'];
    var i, els = document.querySelectorAll('[data-yrs]');
    for (i = 0; i < els.length; i++) els[i].textContent = String(y);
    els = document.querySelectorAll('[data-yrs-word]');
    for (i = 0; i < els.length; i++) els[i].textContent = WORDS[y] || String(y);
    els = document.querySelectorAll('[data-yrs-count]');
    for (i = 0; i < els.length; i++) { els[i].setAttribute('data-count', String(y)); els[i].textContent = String(y); }
  })();

  /* ---------- links from older versions of the site land in the right place ---------- */
  var legacy = {
    story: '/about/#story', experience: '/about/#experience', projects: '/about/#work', work: '/about/#work',
    ajtools: '/about/#skills', 'aj-tools': '/about/#skills', brain: '/heron-ai/',
    about: '/about/', skills: '/about/#skills', faq: '/about/#faq', contact: '/#contact'
  };
  if (location.hash) {
    var lkey = location.hash.slice(1).toLowerCase();
    if (legacy[lkey] && !document.getElementById(lkey)) { location.replace(legacy[lkey]); return; }
  }

  root.classList.remove('no-js');
  root.classList.add('js');
  root.setAttribute('data-ready', '1');

  var y = document.getElementById('yr');
  if (y) y.textContent = String(new Date().getFullYear());

  /* ---------- smooth scroll ---------- */
  var lenis = null;
  if (!reduce && window.Lenis) {
    try {
      lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
      var raf = function (t) { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    } catch (e) { lenis = null; }
  }
  window.__aj.lenis = lenis;
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href*="#"]');
    if (!a) return;
    var url = new URL(a.href, location.href);
    if (url.pathname !== location.pathname || !url.hash || url.hash.length < 2) return;
    var el = document.getElementById(decodeURIComponent(url.hash.slice(1)));
    if (!el) return;
    e.preventDefault();
    closeMenu();
    if (lenis) lenis.scrollTo(el, { offset: -80, duration: 1.2 });
    else el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    history.replaceState(null, '', url.hash);
  });

  /* ---------- the bar ---------- */
  var nav = document.getElementById('nav');
  function onScroll() { if (nav) nav.classList.toggle('solid', (window.scrollY || 0) > 40); }
  onScroll();
  if (lenis) lenis.on('scroll', onScroll); else addEventListener('scroll', onScroll, { passive: true });

  /* tabs: one highlight glides to the tab under the pointer; the current page keeps a solid one */
  var tabs = document.getElementById('tabs');
  if (tabs) {
    var ind = tabs.querySelector('.tab-ind');
    var tabLinks = [].slice.call(tabs.querySelectorAll('a[data-tab]'));
    var current = tabs.querySelector('a[aria-current="page"]');
    var glide = function (a, mode) {
      if (!a) { ind.style.opacity = '0'; tabLinks.forEach(function (l) { l.classList.remove('lit'); }); return; }
      var first = ind.style.opacity !== '1';
      ind.classList.toggle('instant', first);
      ind.style.transform = 'translateX(' + a.parentElement.offsetLeft + 'px)';
      ind.style.width = a.parentElement.offsetWidth + 'px';
      ind.setAttribute('data-mode', mode);
      ind.classList.toggle('heron', a.getAttribute('data-tab') === 'heron');
      ind.style.opacity = '1';
      tabLinks.forEach(function (l) { l.classList.toggle('lit', l === a); });
      if (first) requestAnimationFrame(function () { ind.classList.remove('instant'); });
    };
    var rest = function () { glide(current, 'sel'); };
    tabLinks.forEach(function (a) {
      var over = function () { glide(a, a === current ? 'sel' : 'hover'); };
      a.addEventListener('pointerenter', over);
      a.addEventListener('focus', over);
      a.addEventListener('blur', rest);
    });
    tabs.addEventListener('pointerleave', rest);
    addEventListener('resize', rest);
    rest();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(rest);
  }

  /* the phone menu: a full-screen sheet */
  var overlay = document.getElementById('overlay');
  var burger = document.getElementById('burger');
  function closeMenu() {
    if (!overlay || !overlay.hasAttribute('data-open')) return;
    overlay.removeAttribute('data-open');
    burger.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    if (lenis) lenis.start();
    burger.focus();
  }
  if (overlay && burger) {
    burger.addEventListener('click', function () {
      overlay.setAttribute('data-open', '');
      burger.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
      if (lenis) lenis.stop();
      var first = overlay.querySelector('a');
      if (first) setTimeout(function () { first.focus(); }, 50);
    });
    var closeBtn = overlay.querySelector('.close');
    if (closeBtn) closeBtn.addEventListener('click', closeMenu);
    overlay.addEventListener('click', function (e) { if (e.target.closest('a')) closeMenu(); });
    addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });
    addEventListener('resize', function () { if (innerWidth > 900) closeMenu(); });
  }

  /* ---------- contact: the button grows into a card ----------
     The card is pinned where it ends, then grown there from the button that
     was pressed, colour and corners included; closing shrinks it back into the
     button. With no script the button simply goes to the footer. */
  var cbox = document.getElementById('cbox');
  if (cbox) {
    var card = cbox.querySelector('.cbox-card');
    var inner = cbox.querySelector('.cbox-in');
    var bg = cbox.querySelector('.cbox-bg');
    var EASE = 'cubic-bezier(.2,.9,.25,1)';
    var source = null, lastFocus = null, busy = false;
    var KEYS = ['top', 'left', 'right', 'bottom', 'width', 'height'];
    var clearInline = function () { KEYS.forEach(function (k) { card.style[k] = ''; }); inner.style.width = ''; };
    var shown = function (el) { if (!el) return null; var r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 ? r : null; };
    var pin = function (r) {
      card.style.top = r.top + 'px'; card.style.left = r.left + 'px'; card.style.right = 'auto'; card.style.bottom = 'auto';
      card.style.width = r.width + 'px'; card.style.height = r.height + 'px'; inner.style.width = r.width + 'px';
    };
    var box = function (r, radius, colour) {
      return { top: r.top + 'px', left: r.left + 'px', width: r.width + 'px', height: r.height + 'px', borderRadius: radius, backgroundColor: colour };
    };
    var cancelAll = function () { [card, inner, bg].forEach(function (el) { el.getAnimations().forEach(function (a) { a.cancel(); }); }); };

    var openCard = function (from) {
      if (!cbox.hidden || busy) return;
      lastFocus = document.activeElement;
      var fromRect = shown(from), fromBg = from ? getComputedStyle(from).backgroundColor : '';
      source = from;
      closeMenu();
      cbox.hidden = false;
      document.body.style.overflow = 'hidden';
      if (lenis) lenis.stop();
      var cs = getComputedStyle(card), to = card.getBoundingClientRect();
      if (!reduce && fromRect && card.animate) {
        busy = true;
        pin(to);
        from.style.visibility = 'hidden';
        var grow = card.animate([box(fromRect, (fromRect.height / 2) + 'px', fromBg), box(to, cs.borderRadius, cs.backgroundColor)], { duration: 620, easing: EASE });
        inner.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 0, transform: 'translateY(10px)', offset: 0.35 }, { opacity: 1, transform: 'none' }], { duration: 620, easing: 'ease-out' });
        bg.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 420, easing: 'ease-out' });
        grow.onfinish = function () { clearInline(); busy = false; };
      }
      var x = cbox.querySelector('.cbox-x');
      setTimeout(function () { x.focus({ preventScroll: true }); }, reduce ? 0 : 260);
    };

    var closeCard = function () {
      if (cbox.hidden || busy) return;
      var done = function () {
        cancelAll(); clearInline();
        cbox.hidden = true;
        if (source) source.style.visibility = '';
        document.body.style.overflow = '';
        if (lenis) lenis.start();
        var f = lastFocus && document.contains(lastFocus) && shown(lastFocus) ? lastFocus : shown(source) ? source : null;
        if (f && f.focus) f.focus({ preventScroll: true });
        busy = false;
      };
      if (reduce || !card.animate) { done(); return; }
      busy = true;
      var cs = getComputedStyle(card), r = card.getBoundingClientRect(), to = shown(source);
      var end;
      if (to) {
        pin(r);
        end = card.animate([box(r, cs.borderRadius, cs.backgroundColor), box(to, (to.height / 2) + 'px', getComputedStyle(source).backgroundColor)], { duration: 480, easing: EASE, fill: 'forwards' });
        inner.animate([{ opacity: 1 }, { opacity: 0, offset: 0.4 }, { opacity: 0 }], { duration: 480, fill: 'forwards' });
      } else {
        end = card.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(14px) scale(.98)' }], { duration: 280, easing: 'ease-in', fill: 'forwards' });
      }
      bg.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 380, fill: 'forwards' });
      end.onfinish = done;
    };

    // capture, so this runs before the smooth-scroll handler that would go to #contact
    document.addEventListener('click', function (e) {
      var t = e.target.closest && e.target.closest('[data-contact]');
      if (!t) return;
      e.preventDefault(); e.stopPropagation();
      openCard(t);
    }, true);
    cbox.addEventListener('click', function (e) { if (e.target.closest('[data-close]')) closeCard(); });
    addEventListener('keydown', function (e) {
      if (cbox.hidden) return;
      if (e.key === 'Escape') { e.preventDefault(); closeCard(); return; }
      if (e.key !== 'Tab') return;
      var f = [].slice.call(card.querySelectorAll('a[href], button'));
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    });
    addEventListener('resize', function () { if (!cbox.hidden && !busy) clearInline(); });
  }

  /* ---------- copy the email address ---------- */
  [].forEach.call(document.querySelectorAll('[data-copy]'), function (btn) {
    btn.addEventListener('click', function () {
      var text = btn.getAttribute('data-copy');
      var done = function () { btn.textContent = 'Copied'; setTimeout(function () { btn.textContent = 'Copy'; }, 1800); };
      try { navigator.clipboard.writeText(text).then(done, function () {}); } catch (e) { /* the address is on screen to select */ }
    });
  });

  /* ---------- buttons that lean toward the pointer ---------- */
  if (fine && !reduce) [].forEach.call(document.querySelectorAll('.magnetic'), function (el) {
    el.addEventListener('pointermove', function (e) {
      var r = el.getBoundingClientRect();
      el.style.transform = 'translate(' + ((e.clientX - r.left - r.width / 2) * 0.25) + 'px,' + ((e.clientY - r.top - r.height / 2) * 0.3) + 'px)';
    });
    el.addEventListener('pointerleave', function () { el.style.transform = ''; });
  });

  /* ---------- figures that count up when they come into view ---------- */
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        var el = en.target, end = parseFloat(el.getAttribute('data-count')), suf = el.getAttribute('data-suffix') || '';
        if (isNaN(end)) return;
        var from = el.hasAttribute('data-from') ? parseFloat(el.getAttribute('data-from')) : 0;
        var t0 = performance.now();
        var tick = function (now) {
          var p = clamp((now - t0) / 1500, 0, 1), k = 1 - Math.pow(1 - p, 4);
          el.textContent = Math.round(from + (end - from) * k) + suf;
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    }, { threshold: 0.6 });
    [].forEach.call(document.querySelectorAll('[data-count]'), function (c) { io.observe(c); });
  }

  /* ---------- linked particles behind the mouse ----------
     After the three.js example webgpu_tsl_vfx_linkedparticles: the pointer sheds
     particles that drift and fade, each linked to its two nearest neighbours.
     2D canvas, mouse only, and it sleeps when nothing is alive. */
  (function () {
    if (!fine || reduce) return;
    var cv = document.createElement('canvas');
    cv.className = 'links-fx'; cv.setAttribute('aria-hidden', 'true');
    document.body.appendChild(cv);
    var ctx = cv.getContext('2d');
    var dpr = 1, W = 0, H = 0;
    function size() { dpr = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
    size(); addEventListener('resize', size);
    var MAX = 420, LIFE = 2.4, P = [];
    var px = null, py = null, mx = 0, my = 0, moved = false, rafId = 0, last = 0, seed = 0;
    addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      mx = e.clientX; my = e.clientY; moved = true;
      if (px === null) { px = mx; py = my; }
      if (!rafId) { last = performance.now(); rafId = requestAnimationFrame(tick); }
    }, { passive: true });
    document.addEventListener('pointerleave', function () { px = null; });
    function spawn() {
      for (var k = 0; k < 4; k++) {
        var t = k / 3, a = Math.random() * Math.PI * 2, sp = 20 + Math.random() * 46;
        P.push({ x: px + (mx - px) * t + Math.cos(a) * 2, y: py + (my - py) * t + Math.sin(a) * 2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, id: seed++, r: 1.2 + Math.random() * 1.8 });
      }
      while (P.length > MAX) P.shift();
      px = mx; py = my;
    }
    function hue(id) { return 228 + 52 * Math.sin(id * 0.045) + 14 * Math.sin(id * 0.013); }
    function tick(now) {
      rafId = 0;
      var dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (moved && px !== null) { spawn(); moved = false; }
      var t = now / 1000, i, j;
      for (i = P.length - 1; i >= 0; i--) {
        var p = P[i];
        p.life -= dt / LIFE;
        if (p.life <= 0) { P.splice(i, 1); continue; }
        var f = 0.012;
        p.vx += (Math.sin(p.y * f + t * 1.1) + Math.sin(p.y * f * 2.3 - t * 0.7) * 0.5) * 60 * dt * (p.life + 0.1);
        p.vy += (Math.cos(p.x * f - t * 0.9) + Math.cos(p.x * f * 2.1 + t * 0.6) * 0.5) * 60 * dt * (p.life + 0.1);
        p.vx *= 1 - 1.4 * dt; p.vy *= 1 - 1.4 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
      }
      ctx.clearRect(0, 0, W, H);
      // the site is light all over: darker, saturated lines, normal blending
      ctx.globalCompositeOperation = 'source-over';
      var L = 42, S = 80, n = P.length;
      ctx.lineWidth = 1;
      for (i = 0; i < n; i++) {
        var a2 = P[i], d1 = 1e9, d2 = 1e9, j1 = -1, j2 = -1;
        for (j = 0; j < n; j++) {
          if (j === i) continue;
          var b = P[j], dx = a2.x - b.x, dy = a2.y - b.y, d = dx * dx + dy * dy;
          if (d < d1) { d2 = d1; j2 = j1; d1 = d; j1 = j; } else if (d < d2) { d2 = d; j2 = j; }
        }
        var h = hue(a2.id), pair = [[j1, d1], [j2, d2]];
        for (var q = 0; q < 2; q++) {
          var jj = pair[q][0];
          if (jj < 0 || pair[q][1] > 25600) continue;
          var o = Math.pow(Math.max(0, Math.min(a2.life, P[jj].life)), 0.8) * 0.55;
          ctx.strokeStyle = 'hsla(' + h + ',' + S + '%,' + L + '%,' + o + ')';
          ctx.beginPath(); ctx.moveTo(a2.x, a2.y); ctx.lineTo(P[jj].x, P[jj].y); ctx.stroke();
        }
      }
      for (i = 0; i < n; i++) {
        var pp = P[i], pulse = 1 + 0.6 * Math.max(0, Math.sin(pp.id * 1.7 + t * Math.PI));
        ctx.fillStyle = 'hsla(' + hue(pp.id) + ',' + S + '%,' + L + '%,' + Math.pow(pp.life, 1.2) + ')';
        ctx.beginPath(); ctx.arc(pp.x, pp.y, pp.r * pulse, 0, Math.PI * 2); ctx.fill();
      }
      if (P.length || moved) rafId = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, W, H);
    }
  })();

  /* ---------- analytics: GoatCounter, cookie-less, skipped for Do Not Track ----------
     To switch every bit of this off, set the code back to "" and the script
     below is never fetched. */
  var GOATCOUNTER = 'ajmalps';
  (function () {
    /* <html data-no-count> opts a page out entirely (the AR viewer promises no analytics) */
    if (!GOATCOUNTER || root.hasAttribute('data-no-count')) return;
    var dnt = navigator.doNotTrack === '1' || window.doNotTrack === '1' || navigator.globalPrivacyControl === true;
    if (dnt) return;
    var sc = document.createElement('script');
    sc.async = true;
    sc.src = 'https://gc.zgo.at/count.js';
    sc.setAttribute('data-goatcounter', 'https://' + GOATCOUNTER + '.goatcounter.com/count');
    document.head.appendChild(sc);
    /* which sections actually get read: one event per section, per visit */
    if (!('IntersectionObserver' in window)) return;
    var seen = {};
    var io2 = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var name = en.target.getAttribute('data-track');
        if (!name || seen[name]) return;
        seen[name] = 1;
        io2.unobserve(en.target);
        if (window.goatcounter && window.goatcounter.count) {
          window.goatcounter.count({ path: 'read/' + name, title: 'Read: ' + name, event: true });
        }
      });
    }, { threshold: 0.5 });
    [].forEach.call(document.querySelectorAll('[data-track]'), function (el) { io2.observe(el); });
  })();
})();
