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

  /* theme switch */
  var root = document.documentElement;
  root.setAttribute("data-ready","1");   /* tells the head failsafe we are alive */
  var sw = document.getElementById("themeSwitch");
  var metaTheme = document.getElementById("metaTheme");
  function applyTheme(t){
    root.setAttribute("data-theme", t);
    sw.setAttribute("aria-checked", t === "dark" ? "true" : "false");
    sw.setAttribute("aria-label", t === "dark" ? "Switch to light mode" : "Switch to dark mode");
    if(metaTheme) metaTheme.setAttribute("content", t === "dark" ? "#0c0e13" : "#f2f4f8");
    if(window.__ajBirds) window.__ajBirds.retint();
  }
  applyTheme(root.getAttribute("data-theme") === "dark" ? "dark" : "light");
  sw.addEventListener("click", function(){
    var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    root.classList.add("theming");
    applyTheme(next);
    try{ localStorage.setItem("ajps-theme", next); }catch(e){}
    setTimeout(function(){ root.classList.remove("theming"); }, 420);
  });
  if(window.matchMedia){
    var mqDark = window.matchMedia("(prefers-color-scheme: dark)");
    var onOsTheme = function(e){
      var saved = null;
      try{ saved = localStorage.getItem("ajps-theme"); }catch(err){}
      if(saved !== "dark" && saved !== "light"){ applyTheme(e.matches ? "dark" : "light"); }
    };
    if(mqDark.addEventListener){ mqDark.addEventListener("change", onOsTheme); }
  }

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

  /* mobile menu */
  var menuBtn = document.getElementById("menuBtn");
  var links = document.getElementById("navLinks");
  function closeMenu(){ links.classList.remove("open"); menuBtn.setAttribute("aria-expanded","false"); menuBtn.setAttribute("aria-label","Open menu"); }
  menuBtn.addEventListener("click", function(){
    var open = links.classList.toggle("open");
    menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
    menuBtn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  });
  links.addEventListener("click", function(e){ if(e.target.tagName === "A") closeMenu(); });
  document.addEventListener("keydown", function(e){ if(e.key === "Escape") closeMenu(); });

  /* macOS-style pill that glides between the centred tabs */
  var pill = links ? links.querySelector(".navpill") : null;
  var mqDesktop = window.matchMedia ? window.matchMedia("(min-width: 1025px)") : null;
  if(pill && links){
    links.addEventListener("pointerover", function(e){
      var a = e.target.closest ? e.target.closest("a") : null;
      if(!a || !links.contains(a)) return;
      if(mqDesktop && !mqDesktop.matches) return;
      pill.style.width = a.offsetWidth + "px";
      pill.style.transform = "translateX(" + a.offsetLeft + "px)";
      links.classList.add("armed");
    });
    links.addEventListener("pointerleave", function(){ links.classList.remove("armed"); });
    window.addEventListener("resize", function(){ links.classList.remove("armed"); }, {passive:true});
  }
  /* close the mobile menu when tapping outside it */
  document.addEventListener("click", function(e){
    if(!links || !links.classList.contains("open")) return;
    if(e.target.closest("#navLinks") || e.target.closest("#menuBtn")) return;
    closeMenu();
  });

  /* links from the old single-page version land on the right page now */
  var legacy = {
    story:"/story/", experience:"/experience/", projects:"/work/", work:"/work/",
    ajtools:"/aj-tools/", "aj-tools":"/aj-tools/", brain:"/ai-brain/",
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

  /* ribbon tabs — without JS both panels stay open and readable */
  (function(){
    var list = document.querySelector(".rtabs[role=tablist]");
    if(!list) return;
    var tabs = [].slice.call(list.querySelectorAll("[role=tab]"));
    function select(tab, focus){
      tabs.forEach(function(t){
        var on = t === tab;
        t.setAttribute("aria-selected", on ? "true" : "false");
        t.tabIndex = on ? 0 : -1;
        var panel = document.getElementById(t.getAttribute("aria-controls"));
        if(panel) panel.hidden = !on;
      });
      if(focus) tab.focus();
    }
    tabs.forEach(function(t){ t.addEventListener("click", function(){ select(t, false); }); });
    list.addEventListener("keydown", function(e){
      var i = tabs.indexOf(document.activeElement);
      if(i < 0) return;
      var n = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1
            : e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : -1;
      if(n < 0 && e.key !== "Home" && e.key !== "End") return;
      e.preventDefault();
      select(tabs[(n + tabs.length) % tabs.length], true);
    });
    select(tabs[0], false);   // JS is on, so collapse to a real tab view
  })();

  /* ------------------------------------------------------------------
     Analytics — OFF until you put your GoatCounter code below.

     Sign up free at https://www.goatcounter.com (no card, no cookies,
     no consent banner needed). Pick a site code, then set it here:

         var GOATCOUNTER = "ajmalps";

     Leave it empty and the site loads nothing from anyone else, exactly
     as it does today. Visitors who send Do Not Track are never counted.
     ------------------------------------------------------------------ */
  var GOATCOUNTER = "";

  (function(){
    if(!GOATCOUNTER) return;
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

  /* ---------- Vanta BIRDS behind the hero, home page only ----------
     three.js is 600kb, so it is fetched only when it will actually be drawn:
     never for reduced-motion, never on Save-Data, never without WebGL, and
     never on the pages that have no hero. The flock is destroyed when the hero
     scrolls away so it is not burning a phone battery further down the page. */
  (function(){
    var host = document.getElementById("vanta-hero");
    if(!host || reduceMotion) return;

    var conn = navigator.connection || navigator.webkitConnection || navigator.mozConnection;
    if(conn && conn.saveData) return;

    var gl = false;
    try{
      var probe = document.createElement("canvas");
      gl = !!(window.WebGLRenderingContext &&
              (probe.getContext("webgl") || probe.getContext("experimental-webgl")));
    }catch(e){ gl = false; }
    if(!gl) return;

    var vendor = host.getAttribute("data-vendor") || "vendor/";
    var effect = null, loading = null, retintTimer = null;
    /* `wanted` is owned by the observer. three.js takes seconds to arrive on a
       slow connection, and without this the hero can scroll away mid-download
       and start() still fires afterwards, leaving a flock running off-screen
       for the rest of the visit - exactly the battery cost this is meant to
       avoid. stop() has to stay authoritative while the scripts are in flight. */
    var wanted = false;

    function palette(){
      /* cyan reads well on the dark canvas, blue holds up on the light one;
         both land on violet, the same sweep as the tagline gradient */
      return root.getAttribute("data-theme") === "dark"
        ? { color1:0x00c8ff, color2:0x7c3aed }
        : { color1:0x2563eb, color2:0x7c3aed };
    }

    function loadScript(src){
      return new Promise(function(resolve, reject){
        var s = document.createElement("script");
        s.src = src; s.async = true;
        s.onload = resolve;
        s.onerror = function(){ reject(new Error("failed: " + src)); };
        document.head.appendChild(s);
      });
    }

    function libs(){
      if(!loading){
        loading = loadScript(vendor + "three.min.js").then(function(){
          return loadScript(vendor + "vanta.birds.min.js");
        }).catch(function(err){
          loading = null;   /* do not cache the failure, or one dropped request kills it for the whole visit */
          throw err;
        });
      }
      return loading;
    }

    function start(){
      if(!wanted || effect || !window.VANTA || !window.VANTA.BIRDS || !window.THREE) return;
      var narrow = window.innerWidth < 1025;
      var tint = palette();
      try{
        effect = window.VANTA.BIRDS({
          el: host,
          THREE: window.THREE,
          mouseControls: !narrow,   /* vanta binds this to window, so the hero buttons stay clickable */
          touchControls: false,     /* would fight with scrolling on a phone */
          gyroControls: false,
          minHeight: 200, minWidth: 200,
          scale: 1, scaleMobile: 1,
          backgroundAlpha: 0,       /* keep the hero gradient underneath */
          color1: tint.color1,
          color2: tint.color2,
          colorMode: "varianceGradient",
          /* tuned down from the Vanta defaults: the default 1024 birds with
             high cohesion ball up in the middle of the hero and sit all over
             the name. Fewer birds, pushed apart, moving slower. */
          birdSize: 1,
          wingSpan: 20,
          speedLimit: 3.5,
          separation: 60,
          alignment: 28,
          cohesion: 14,
          quantity: narrow ? 3 : 4
        });
        host.classList.add("on");
      }catch(e){
        effect = null;            /* a WebGL failure must never break the page */
      }
    }

    function stop(){
      if(!effect) return;
      host.classList.remove("on");
      var renderer = effect.renderer;      /* destroy() clears the reference */
      try{ effect.destroy(); }catch(e){}
      try{
        /* hand the WebGL context back now instead of waiting for the collector */
        if(renderer){
          renderer.dispose();
          var lose = renderer.getContext().getExtension("WEBGL_lose_context");
          if(lose) lose.loseContext();
        }
      }catch(e){}
      effect = null;
    }

    window.__ajBirds = { retint: function(){
      /* BIRDS bakes color1/color2 into a per-vertex attribute when it is built,
         so setOptions cannot recolour a running flock - it has to be rebuilt.
         Debounced so flipping the switch quickly does not thrash WebGL. */
      if(!effect) return;
      clearTimeout(retintTimer);
      retintTimer = setTimeout(function(){
        if(!effect || !wanted) return;
        stop();
        start();
      }, 160);
    } };

    if("IntersectionObserver" in window){
      var io = new IntersectionObserver(function(entries){
        entries.forEach(function(en){
          if(en.isIntersecting){ wanted = true; libs().then(start).catch(function(){}); }
          else { wanted = false; stop(); }
        });
      }, { rootMargin: "200px" });
      io.observe(host);
    } else {
      wanted = true;
      libs().then(start).catch(function(){});
    }
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
