/*
 * The welcome on the home page: "Ajmal P.S" assembled from shards.
 *
 * After the three.js example webgl_modifier_tessellation. The name is 3D text
 * in Geist (assets/fonts/geist-600.typeface.json, made from the site's own font),
 * cut into small triangles by TessellateModifier. Each triangle starts scattered
 * and spinning, flies home left to right, the name breathes a moment, then the
 * shards fly apart toward you while the fog screen lifts off the forest.
 *
 * It plays once per visit. The inline script in index.html decides that before
 * first paint (html.intro-on shows the dark screen at once, so nothing flashes),
 * and gives up on its own if this file never runs. Reduced motion, no script or
 * no WebGL: no intro, straight to the page.
 */
(function () {
  'use strict';
  var root = document.documentElement;
  var box = document.getElementById('welcome');
  if (!box) return;
  if (!root.classList.contains('intro-on')) { box.remove(); return; }
  root.classList.add('intro-run');
  try { sessionStorage.setItem('aj-intro', '1'); } catch (e) { /* private mode: it may play again, that is all */ }

  var aj = window.__aj || {};
  var lenis = aj.lenis || null;
  var finished = false;
  function end() {
    if (finished) return;
    finished = true;
    box.remove();
    root.classList.remove('intro-on', 'intro-run');
    document.body.style.overflow = '';
    if (lenis) lenis.start();
  }
  if (aj.reduce || !window.THREE || !THREE.TessellateModifier || !THREE.Font || !window.fetch) { end(); return; }
  document.body.style.overflow = 'hidden';
  if (lenis) lenis.stop();

  // Skip, a click or Escape ends it at once: no fly-out to wait for, which on a
  // slow device could keep the page away for seconds
  var cleanup = function () {};
  var skipNow = function () { cleanup(); end(); };
  document.getElementById('introSkip').addEventListener('click', function (e) { e.stopPropagation(); skipNow(); });
  box.addEventListener('click', skipNow);
  var onKey = function (e) { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') skipNow(); };
  addEventListener('keydown', onKey);

  fetch('/assets/fonts/geist-600.typeface.json').then(function (r) {
    if (!r.ok) throw new Error('font ' + r.status);
    return r.json();
  }).then(function (data) {
    if (!finished) start(new THREE.Font(data));
  }).catch(function () { end(); });

  function start(font) {
    var T = THREE;
    var cv = document.getElementById('introCanvas');
    var r;
    try { r = new T.WebGLRenderer({ canvas: cv, antialias: true, alpha: true }); } catch (e) { end(); return; }
    r.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    r.setClearColor(0x000000, 0);
    var scene = new T.Scene();
    var camera = new T.PerspectiveCamera(32, 1, 1, 5000);

    var geo = new T.TextGeometry('Ajmal P.S', { font: font, size: 40, height: 7, curveSegments: 5, bevelEnabled: true, bevelThickness: 1.8, bevelSize: 0.9, bevelSegments: 2 });
    geo.center();
    geo = new T.TessellateModifier(innerWidth < 900 ? 4.5 : 3.4, 6).modify(geo);
    geo.computeBoundingBox();
    var bb = geo.boundingBox, W = bb.max.x - bb.min.x, H = bb.max.y - bb.min.y;

    // one colour, centre, flight and spin per triangle, in the site's colours
    var pos = geo.attributes.position.array, nor = geo.attributes.normal.array;
    var n = pos.length / 9;
    var A = function (k) { return new Float32Array(n * 3 * k); };
    var aCenter = A(3), aDir = A(3), aAxis = A(3), aColor = A(3), aSpin = A(1), aDelay = A(1);
    // dark letters on the light fog screen, their sides in fog greys
    var faceCols = ['#15171B', '#15171B', '#15171B', '#22252A', '#2C3036'];
    var sideCols = ['#5B6168', '#6D737A', '#4A4F55', '#80868D'];
    var spark = ['#FD641A', '#FF9A5C'];
    var col = new T.Color(), v = new T.Vector3(), ax = new T.Vector3();
    for (var f = 0; f < n; f++) {
      var i = f * 9;
      var cx = (pos[i] + pos[i + 3] + pos[i + 6]) / 3, cy = (pos[i + 1] + pos[i + 4] + pos[i + 7]) / 3, cz = (pos[i + 2] + pos[i + 5] + pos[i + 8]) / 3;
      var front = Math.abs(nor[i + 2]) > 0.85;
      var pal = Math.random() < (front ? 0.045 : 0.02) ? spark : front ? faceCols : sideCols;
      col.set(pal[(Math.random() * pal.length) | 0]);
      v.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() * 0.9 - 0.15).normalize().multiplyScalar(90 + Math.random() * 230);
      ax.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      var delay = ((cx - bb.min.x) / W) * 0.42 + Math.random() * 0.2;
      var spin = (Math.random() < 0.5 ? -1 : 1) * (2.5 + Math.random() * 6);
      for (var k = 0; k < 3; k++) {
        var j = (f * 3 + k) * 3, s = f * 3 + k;
        aCenter[j] = cx; aCenter[j + 1] = cy; aCenter[j + 2] = cz;
        aDir[j] = v.x; aDir[j + 1] = v.y; aDir[j + 2] = v.z;
        aAxis[j] = ax.x; aAxis[j + 1] = ax.y; aAxis[j + 2] = ax.z;
        aColor[j] = col.r; aColor[j + 1] = col.g; aColor[j + 2] = col.b;
        aSpin[s] = spin; aDelay[s] = delay;
      }
    }
    geo.setAttribute('aCenter', new T.BufferAttribute(aCenter, 3));
    geo.setAttribute('aDir', new T.BufferAttribute(aDir, 3));
    geo.setAttribute('aAxis', new T.BufferAttribute(aAxis, 3));
    geo.setAttribute('aColor', new T.BufferAttribute(aColor, 3));
    geo.setAttribute('aSpin', new T.BufferAttribute(aSpin, 1));
    geo.setAttribute('aDelay', new T.BufferAttribute(aDelay, 1));

    var uniforms = { uIn: { value: 0 }, uOut: { value: 0 }, uTime: { value: 0 } };
    var mat = new T.ShaderMaterial({
      uniforms: uniforms, transparent: true, side: T.DoubleSide,
      vertexShader: [
        'uniform float uIn; uniform float uOut; uniform float uTime;',
        'attribute vec3 aCenter; attribute vec3 aDir; attribute vec3 aAxis; attribute vec3 aColor;',
        'attribute float aSpin; attribute float aDelay;',
        'varying vec3 vNormal; varying vec3 vColor; varying float vFade;',
        'mat3 rot(vec3 a, float g) {',
        '  float s = sin(g), c = cos(g), o = 1. - c;',
        '  return mat3(o*a.x*a.x + c, o*a.x*a.y + a.z*s, o*a.z*a.x - a.y*s,',
        '              o*a.x*a.y - a.z*s, o*a.y*a.y + c, o*a.y*a.z + a.x*s,',
        '              o*a.z*a.x + a.y*s, o*a.y*a.z - a.x*s, o*a.z*a.z + c);',
        '}',
        'void main() {',
        '  float t = clamp((uIn - aDelay) / 0.5, 0., 1.);',
        '  t = 1. - pow(1. - t, 3.);',
        '  float o = clamp((uOut - aDelay * 0.7) / 0.55, 0., 1.);',
        '  o = o * o;',
        '  float k = (1. - t) + o * 1.4;',
        '  mat3 R = rot(aAxis, aSpin * k);',
        '  vec3 p = aCenter + R * (position - aCenter) + aDir * k;',
        '  p += normal * sin(uTime * 2.2 + aCenter.x * 0.07) * 0.45 * t * (1. - o);',
        '  vNormal = normalize(normalMatrix * (R * normal));',
        '  vColor = aColor;',
        '  vFade = t * (1. - o);',
        '  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.);',
        '}'
      ].join('\n'),
      fragmentShader: [
        'varying vec3 vNormal; varying vec3 vColor; varying float vFade;',
        'void main() {',
        '  vec3 N = normalize(vNormal);',
        '  float d = max(dot(N, normalize(vec3(-0.35, 0.55, 1.0))), 0.);',
        '  vec3 c = vColor * (0.32 + 0.78 * d) + pow(1. - abs(N.z), 3.) * 0.1;',
        '  gl_FragColor = vec4(c, clamp(vFade * 1.6, 0., 1.));',
        '}'
      ].join('\n')
    });
    var mesh = new T.Mesh(geo, mat);
    scene.add(mesh);

    var dist = 300;
    function size() {
      var w = innerWidth, h = innerHeight;
      r.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
      var vf = (camera.fov * Math.PI) / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * camera.aspect);
      var fill = w < 900 ? 0.84 : 0.62;
      dist = Math.max((W / 2) / Math.tan(hf / 2) / fill, (H / 2) / Math.tan(vf / 2) / 0.4);
    }
    size(); addEventListener('resize', size);

    var line = document.getElementById('introLine'), bar = document.getElementById('introBar');
    // its own clock, advanced at most 1/30 s a frame: a slow frame (the forest
    // growing underneath, a busy phone) slows the animation instead of skipping it
    var IN = 2.6, HOLD = 1.3, OUT = 1.3;
    var clock = 0, last = null, leaving = -1;
    // the natural ending: the shards fly apart while the dark fades (CSS, 1.1 s);
    // the page comes back on time even if frames are slow
    var leave = function () {
      if (leaving >= 0) return;
      leaving = clock;
      box.classList.add('out');
      setTimeout(stop, 1700);
    };
    cleanup = function () {
      removeEventListener('resize', size); removeEventListener('keydown', onKey);
      r.dispose(); geo.dispose(); mat.dispose();
      cleanup = function () {};
    };
    function stop() { if (!finished) { cleanup(); end(); } }
    function frame(now) {
      if (finished) return;
      if (last === null) last = now;
      clock += Math.min(1 / 30, (now - last) / 1000); last = now;
      var t = clock;
      uniforms.uTime.value = t;
      uniforms.uIn.value = Math.min(1, t / IN);
      if (t > IN * 0.62) line.classList.add('on');
      if (leaving < 0 && t > IN + HOLD) leave();
      if (leaving >= 0) {
        var p = Math.min(1, (t - leaving) / OUT);
        uniforms.uOut.value = p;
        if (p >= 1) { stop(); return; }
      }
      bar.style.setProperty('--p', Math.min(1, t / (IN + HOLD)).toFixed(3));
      var e = Math.min(1, t / (IN + HOLD));
      camera.position.set(Math.sin(t * 0.35) * dist * 0.06, Math.cos(t * 0.27) * dist * 0.025, dist * (1.1 - 0.1 * (1 - Math.pow(1 - e, 3))));
      camera.lookAt(0, 0, 0);
      r.render(scene, camera);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
})();
