/* ajmalps.com - shared behaviour. Built from the published site. */
/* ---------- core: runs immediately, needs no library ---------- */
(function(){
  "use strict";
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.__ajReduce = reduceMotion;

  /* years of experience — computed so the page never states a stale figure.
     The HTML already carries the correct value, this only takes over when it rolls. */
  (function(){
    var START = new Date(2015, 4, 1);            // May 2015
    var now = new Date();
    var y = now.getFullYear() - START.getFullYear();
    if(now.getMonth() < START.getMonth()) y--;
    if(y < 1) return;
    var WORDS = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten",
                 "Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen",
                 "Eighteen","Nineteen","Twenty"];
    var i, els = document.querySelectorAll("[data-yrs]");
    for(i = 0; i < els.length; i++) els[i].textContent = String(y);
    els = document.querySelectorAll("[data-yrs-word]");
    for(i = 0; i < els.length; i++) els[i].textContent = WORDS[y] || String(y);
    els = document.querySelectorAll("[data-yrs-count]");
    for(i = 0; i < els.length; i++){ els[i].setAttribute("data-count", String(y)); els[i].textContent = String(y); }
  })();

  var root = document.documentElement;
  root.setAttribute("data-ready","1");   /* tells the head failsafe we are alive */

  /* There is no theme switch any more. The site has one skin, the cover's,
     and the stylesheet is written for it - two skins is what made the site
     read as two sites. assets/style.css sets color-scheme: dark so form
     controls and scrollbars follow. */

  /* nav shadow + reading progress */
  var nav = document.getElementById("nav");
  var prog = document.getElementById("prog");
  var ticking = false;
  function paint(){
    var y = window.scrollY;
    nav.classList.toggle("scrolled", y > 8);
    if(prog){
      var max = document.documentElement.scrollHeight - window.innerHeight;
      prog.style.transform = "scaleX(" + (max > 0 ? Math.min(y / max, 1) : 0) + ")";
    }
    ticking = false;
  }
  function onScroll(){ if(!ticking){ ticking = true; requestAnimationFrame(paint); } }
  window.addEventListener("scroll", onScroll, {passive:true});
  window.addEventListener("resize", onScroll, {passive:true});
  paint();

  /* ---- navigation: the sheet, and the three menus ----
     Desktop: each trigger is a disclosure button. Hover or click opens it,
     Escape closes it and puts focus back on the trigger, the arrow keys walk
     the links. Only one is open at a time.
     Under 1000px the triggers are inert headings (CSS) and the whole thing is
     one sheet behind the menu button - so the code below only has to leave the
     menus alone at that width. */
  var menuBtn = document.getElementById("menuBtn");
  var links = document.getElementById("navLinks");
  var groups = links ? [].slice.call(links.querySelectorAll(".navgroup")) : [];
  var mqSheet = window.matchMedia ? window.matchMedia("(max-width: 1000px)") : null;
  var sheetMode = function(){ return !!(mqSheet && mqSheet.matches); };

  /* Under 1000px every menu is simply open and the trigger is an inert heading
     (chrome.css turns off its pointer events). Left as it is written, it would
     still be a focusable <button aria-expanded="false"> - so a screen reader
     announces three collapsed menus, tabs onto each, and pressing them does
     nothing. Out of the reading order it goes; the <ul aria-label> under it
     carries the group's name there. */
  function syncTriggers(){
    var sheet = sheetMode();
    for(var i=0;i<groups.length;i++){
      var t = groups[i].querySelector(".navtrig");
      if(!t) continue;
      if(sheet){
        t.setAttribute("tabindex","-1");
        t.setAttribute("aria-hidden","true");
        t.removeAttribute("aria-expanded");
        t.removeAttribute("aria-controls");
      }else{
        t.removeAttribute("tabindex");
        t.removeAttribute("aria-hidden");
        t.setAttribute("aria-controls", groups[i].querySelector(".navmenu").id);
        t.setAttribute("aria-expanded", groups[i].classList.contains("open") ? "true" : "false");
      }
    }
  }

  function closeMenus(except){
    for(var i=0;i<groups.length;i++){
      if(groups[i] === except) continue;
      groups[i].classList.remove("open");
      groups[i].removeAttribute("data-clicked");
      var t = groups[i].querySelector(".navtrig");
      if(t && !sheetMode()) t.setAttribute("aria-expanded","false");
    }
  }
  function openGroup(g, byClick){
    if(sheetMode()) return;
    closeMenus(g);
    g.classList.add("open");
    /* Remembers how it was opened. Hovering a trigger opens its menu, so
       without this the click that follows the hover - the ordinary way a
       person uses a menu bar - would read as "already open" and shut it
       again in their face. A click closes only what a click opened. */
    if(byClick) g.setAttribute("data-clicked","");
    g.querySelector(".navtrig").setAttribute("aria-expanded","true");
  }
  function closeGroup(g){
    g.classList.remove("open");
    g.removeAttribute("data-clicked");
    if(!sheetMode()) g.querySelector(".navtrig").setAttribute("aria-expanded","false");
  }

  groups.forEach(function(g){
    var trig = g.querySelector(".navtrig");
    var items = [].slice.call(g.querySelectorAll(".navmenu a"));
    if(!trig) return;

    trig.addEventListener("click", function(){
      if(sheetMode()) return;
      if(g.hasAttribute("data-clicked")) closeGroup(g); else openGroup(g, true);
    });
    /* Pointer opens it too, which is what a pointer expects of a menu bar.
       A short delay on leaving means crossing the gap down to the panel does
       not shut it. */
    var leaveTimer = null;
    g.addEventListener("pointerenter", function(e){
      if(e.pointerType === "touch") return;
      clearTimeout(leaveTimer);
      openGroup(g);
    });
    g.addEventListener("pointerleave", function(e){
      if(e.pointerType === "touch") return;
      leaveTimer = setTimeout(function(){
        if(!g.contains(document.activeElement)) closeGroup(g);
      }, 140);
    });

    g.addEventListener("keydown", function(e){
      if(sheetMode()) return;
      var i = items.indexOf(document.activeElement);
      if(e.key === "Escape"){
        if(!g.classList.contains("open")) return;
        closeGroup(g); trig.focus(); e.stopPropagation();
      } else if(e.key === "ArrowDown"){
        e.preventDefault();
        if(!g.classList.contains("open")) openGroup(g, true);
        /* reading a layout property forces the style change above to land, so
           the link is out of a hidden subtree before focus is asked for */
        void g.querySelector(".navmenu").offsetWidth;
        (items[i + 1] || items[0]).focus();
      } else if(e.key === "ArrowUp"){
        e.preventDefault();
        (i > 0 ? items[i - 1] : items[items.length - 1]).focus();
      }
    });
    /* Tabbing out of the last link closes it behind you. */
    g.addEventListener("focusout", function(){
      setTimeout(function(){
        if(!sheetMode() && !g.contains(document.activeElement)) closeGroup(g);
      }, 0);
    });
  });

  function closeSheet(){
    if(!links || !menuBtn) return;
    links.classList.remove("open");
    menuBtn.setAttribute("aria-expanded","false");
    menuBtn.setAttribute("aria-label","Open menu");
  }
  if(menuBtn && links){
    menuBtn.addEventListener("click", function(){
      var open = links.classList.toggle("open");
      menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
      menuBtn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    });
    links.addEventListener("click", function(e){ if(e.target.closest("a")) closeSheet(); });
  }
  document.addEventListener("keydown", function(e){
    if(e.key !== "Escape") return;
    closeSheet(); closeMenus(null);
  });
  document.addEventListener("click", function(e){
    if(e.target.closest("#nav")) return;
    closeSheet(); closeMenus(null);
  });
  /* Leaving the sheet width with the sheet open would otherwise strand it. */
  if(mqSheet && mqSheet.addEventListener){
    mqSheet.addEventListener("change", function(){ closeSheet(); closeMenus(null); syncTriggers(); });
  }
  syncTriggers();

  /* links from the old single-page version land on the right page now */
  var legacy = {
    story:"/story/", experience:"/experience/", projects:"/work/", work:"/work/",
    ajtools:"/aj-tools/", "aj-tools":"/aj-tools/", brain:"/heron-ai/",
    about:"/about/", skills:"/skills/", faq:"/faq/", contact:"/contact/"
  };
  if(location.hash){
    var lkey = location.hash.slice(1).toLowerCase();
    if(legacy[lkey] && !document.getElementById(lkey)){
      location.replace(legacy[lkey]);
      return;
    }
  }

  /* stagger delays for line-masked headings */
  var heads = document.querySelectorAll(".rvt");
  for(var h=0; h<heads.length; h++){
    var lns = heads[h].querySelectorAll(".ln > i");
    for(var l=0; l<lns.length; l++){ lns[l].style.setProperty("--ld", (l * 0.085) + "s"); }
  }

  /* clean address bar: scroll without leaving #hash in the URL */
  function stripHash(){
    if(history.replaceState){ history.replaceState(null, "", location.pathname + location.search); }
  }
  document.addEventListener("click", function(e){
    var a = e.target && e.target.closest ? e.target.closest('a[href^="#"]') : null;
    if(!a) return;
    var id = a.getAttribute("href").slice(1);
    var target = document.getElementById(id);
    if(!target) return;
    e.preventDefault();
    var top = id === "top";
    if(window.__ajLenis){
      window.__ajLenis.scrollTo(top ? 0 : target, {offset: top ? 0 : -10});
    } else if(top){
      window.scrollTo({top:0, behavior:reduceMotion ? "auto" : "smooth"});
    } else {
      target.scrollIntoView({behavior:reduceMotion ? "auto" : "smooth", block:"start"});
    }
    stripHash();
  });
  if(location.hash){ stripHash(); }

  /* count-up */
  function counterFinal(el){
    el.textContent = el.getAttribute("data-count") + (el.getAttribute("data-suffix") || "");
  }
  function runCounter(el){
    var target = parseInt(el.getAttribute("data-count"), 10);
    var suffix = el.getAttribute("data-suffix") || "";
    if(reduceMotion || !window.requestAnimationFrame){ counterFinal(el); return; }
    var dur = 1300, start = null;
    function step(ts){
      if(start === null) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased) + suffix;
      if(p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* scroll reveal — .reveal, .rvt headings, timeline dots */
  var revealEls = document.querySelectorAll(".reveal, .rvt, .ladder");
  var counters = document.querySelectorAll("[data-count]");
  var tlItems = document.querySelectorAll(".tl-item");

  if(reduceMotion || !("IntersectionObserver" in window)){
    for(var i=0;i<revealEls.length;i++){ revealEls[i].classList.add("in"); }
    for(var j=0;j<counters.length;j++){ counterFinal(counters[j]); }
    for(var t=0;t<tlItems.length;t++){ tlItems[t].classList.add("lit"); }
  } else {
    for(var k=0;k<counters.length;k++){ counters[k].textContent = "0" + (counters[k].getAttribute("data-suffix") || ""); }
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(entry.isIntersecting){
          entry.target.classList.add("in");
          entry.target.querySelectorAll("[data-count]").forEach(function(c){
            if(!c.dataset.done){ c.dataset.done = "1"; runCounter(c); }
          });
          io.unobserve(entry.target);
        }
      });
    }, {threshold:.15, rootMargin:"0px 0px -40px 0px"});
    revealEls.forEach(function(el){ io.observe(el); });

    var dotIo = new IntersectionObserver(function(entries){
      entries.forEach(function(en){ if(en.isIntersecting){ en.target.classList.add("lit"); dotIo.unobserve(en.target); } });
    }, {threshold:.2, rootMargin:"0px 0px -25% 0px"});
    tlItems.forEach(function(el){ dotIo.observe(el); });
  }

  /* ------------------------------------------------------------------
     Analytics — ON. Dashboard: https://ajmalps.goatcounter.com

     GoatCounter sets no cookies and stores no personal data, so there is
     nothing to put a consent banner in front of. Visitors who send Do Not
     Track or Global Privacy Control are never counted at all.

     To switch every bit of this off again, set the code back to "" — that
     one line stops the script below from ever being fetched.
     ------------------------------------------------------------------ */
  var GOATCOUNTER = "ajmalps";

  (function(){
    /* <html data-no-count> opts a page out entirely (the AR viewer promises no analytics) */
    if(!GOATCOUNTER || root.hasAttribute("data-no-count")) return;
    var dnt = navigator.doNotTrack === "1" || window.doNotTrack === "1" ||
              navigator.globalPrivacyControl === true;
    if(dnt) return;

    var sc = document.createElement("script");
    sc.async = true;
    sc.src = "https://gc.zgo.at/count.js";
    sc.setAttribute("data-goatcounter", "https://" + GOATCOUNTER + ".goatcounter.com/count");
    document.head.appendChild(sc);

    /* which chapters actually get read — one event per section, per visit */
    if(!("IntersectionObserver" in window)) return;
    var seen = {};
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if(!en.isIntersecting) return;
        var name = en.target.getAttribute("data-track");
        if(!name || seen[name]) return;
        seen[name] = 1;
        io.unobserve(en.target);
        if(window.goatcounter && window.goatcounter.count){
          window.goatcounter.count({path:"read/" + name, title:"Read: " + name, event:true});
        }
      });
    }, {threshold:.5});
    var els = document.querySelectorAll("[data-track]");
    for(var i=0;i<els.length;i++) io.observe(els[i]);
  })();


  var yrEl = document.getElementById("yr");
  if(yrEl) yrEl.textContent = new Date().getFullYear();
})();

/* ---------- enhancement: smooth scroll + scroll-linked motion ---------- */
document.addEventListener("DOMContentLoaded", function(){
  "use strict";
  if(window.__ajReduce) return;
  var hasGsap = typeof window.gsap !== "undefined" && typeof window.ScrollTrigger !== "undefined";
  var hasLenis = typeof window.Lenis !== "undefined";
  if(!hasGsap && !hasLenis) return;

  /* Lenis momentum scrolling */
  if(hasLenis){
    var lenis = new window.Lenis({ lerp:0.11, wheelMultiplier:1, smoothWheel:true, touchMultiplier:1.6 });
    window.__ajLenis = lenis;
    if(hasGsap){
      lenis.on("scroll", window.ScrollTrigger.update);
      window.gsap.ticker.add(function(time){ lenis.raf(time * 1000); });
      window.gsap.ticker.lagSmoothing(0);
    } else {
      var raf = function(t){ lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
  }

  if(!hasGsap) return;
  var gsap = window.gsap, ST = window.ScrollTrigger;
  gsap.registerPlugin(ST);

  /* hero content drifts and fades as you leave it */
  var heroInner = document.querySelector(".hero .wrap");
  if(heroInner){
    gsap.to(heroInner, {
      yPercent:14, opacity:.35, ease:"none",
      scrollTrigger:{ trigger:".hero", start:"top top", end:"bottom top", scrub:true }
    });
  }

  /* timeline draws itself as the chapter scrolls */
  var tl = document.getElementById("tl");
  if(tl){
    gsap.fromTo(tl, {"--draw":"0%"}, {
      "--draw":"100%", ease:"none",
      scrollTrigger:{ trigger: tl, start:"top 72%", end:"bottom 72%", scrub:.4 }
    });
  }
});
