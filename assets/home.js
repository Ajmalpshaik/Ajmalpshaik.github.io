/*
 * The home page: a misty forest with a flock flying between the trees, light
 * snow falling and a few leaves blowing through on the wind.
 * Loaded only by index.html, after assets/site.js. three.js r128 and its
 * GPUComputationRenderer come from jsDelivr, pinned and fingerprinted in index.html.
 *
 * The page is complete without this file: the fog colour, the headline and the
 * story are plain HTML. This only adds the 3D scene and the scroll choreography.
 */
(function () {
  'use strict';
  var aj = window.__aj || {};
  var reduce = !!aj.reduce, fine = !!aj.fine, lenis = aj.lenis || null;
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };

  var nav = document.getElementById('nav');
  var stage = document.getElementById('stage');
  var heroCopy = document.getElementById('heroCopy');
  var stLayer = document.getElementById('statementLayer');
  var stmt = document.getElementById('statement');
  var src = document.getElementById('statementText');
  var shade = document.getElementById('shade');
  if (!stage) return;
  document.documentElement.classList.add('home-ready');

  // ---------- the story: its words light up as you scroll ----------
  var words = [];
  if (stmt && src) {
    src.childNodes.forEach(function (n) {
      var wrapIn = n.nodeType === 1 ? n.cloneNode(false) : null;
      (n.textContent.match(/\s*\S+\s*/g) || []).forEach(function (w) {
        var s = document.createElement('span'); s.className = 'w'; s.textContent = w;
        if (wrapIn) { var e = wrapIn.cloneNode(false); e.removeAttribute('id'); e.removeAttribute('data-yrs-word'); e.appendChild(s); stmt.appendChild(e); } else stmt.appendChild(s);
        words.push(s);
      });
    });
  }

  // ---------- one stage: the hero leaves, the story arrives, the fog turns to night ----------
  var stageP = 0;
  function onScroll() {
    var y = window.scrollY || 0, vh = innerHeight;
    var total = Math.max(1, stage.offsetHeight - vh);
    stageP = clamp(y / total, 0, 1);
    if (nav) nav.classList.toggle('light', y < total * 0.2);
    var out = clamp(stageP / 0.28, 0, 1);
    heroCopy.style.opacity = String(1 - out);
    heroCopy.style.transform = 'translateY(' + (-out * 60) + 'px)';
    var inP = clamp((stageP - 0.22) / 0.2, 0, 1);
    stLayer.style.opacity = String(inP);
    var lit = clamp((stageP - 0.3) / 0.55, 0, 1) * words.length;
    for (var i = 0; i < words.length; i++) words[i].style.setProperty('--o', String(clamp(lit - i, 0.2, 1)));
    shade.style.opacity = String(Math.min(1, inP * 0.74 + clamp((stageP - 0.78) / 0.22, 0, 1) * 0.26));
  }
  onScroll();
  if (lenis) lenis.on('scroll', onScroll); else addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);

  // ---------- the forest: bare trees in mist, and a flock flying between them ----------
  // The look follows the three.js fog examples (custom_fog_scattering, custom_fog_background):
  // bare trees, and a fog whose colour is the background's, so far trunks and far birds
  // dissolve into it. The birds are the three.js GPGPU flock (webgl_gpgpu_birds, MIT):
  // stepped on the GPU and drawn in the same scene, so the fog reaches them too.
  (function forest() {
    const cv = document.getElementById('forest');
    if (!window.THREE) { cv.remove(); return; }
    const T = THREE;
    let r;
    try { r = new T.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance' }); } catch (e) { cv.remove(); return; }
    const small = innerWidth < 900 || !fine;
    r.setPixelRatio(Math.min(devicePixelRatio || 1, small ? 1.5 : 2));
    r.outputEncoding = T.sRGBEncoding;

    // one colour for the fog and the sky behind it (r128 mixes fog after the
    // colour transform, so both take the plain sRGB value)
    const FOG = 0xc6cace, DENSITY = small ? 0.1 : 0.11;
    const scene = new T.Scene();
    scene.background = new T.Color(FOG);
    scene.fog = new T.FogExp2(FOG, DENSITY);
    const camera = new T.PerspectiveCamera(55, 1, 0.1, Math.sqrt(-Math.log(0.001)) / DENSITY);
    const lin = (h) => new T.Color(h).convertSRGBToLinear();

    scene.add(new T.HemisphereLight(0xdce6ed, 0x292521, 1.3));
    const sky = new T.DirectionalLight(0xdce6ed, 1.4); sky.position.set(-3, 8, 5); scene.add(sky);

    // ---- bare trees, grown from a seed: a gnarled trunk, then four levels of branches ----
    const UP = new T.Vector3(0, 1, 0);
    function rng(seed) { let s = (Math.imul(seed + 1, 2654435761) >>> 0) || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
    function merge(list) {
      let verts = 0, idx = 0;
      for (const g of list) { verts += g.attributes.position.count; idx += g.index ? g.index.count : g.attributes.position.count; }
      const pos = new Float32Array(verts * 3), nor = new Float32Array(verts * 3), index = new Uint32Array(idx);
      let v = 0, k = 0;
      for (const g of list) {
        const c = g.attributes.position.count;
        pos.set(g.attributes.position.array, v * 3); nor.set(g.attributes.normal.array, v * 3);
        if (g.index) { const a = g.index.array; for (let i = 0; i < a.length; i++) index[k++] = a[i] + v; } else for (let i = 0; i < c; i++) index[k++] = v + i;
        v += c; g.dispose();
      }
      const out = new T.BufferGeometry();
      out.setAttribute('position', new T.BufferAttribute(pos, 3));
      out.setAttribute('normal', new T.BufferAttribute(nor, 3));
      out.setIndex(new T.BufferAttribute(index, 1));
      out.computeBoundingSphere();
      return out;
    }
    const ANG = [62, 46, 38, 32].map((d) => (d * Math.PI) / 180);
    const GNARL = [0.045, 0.13, 0.2, 0.26, 0.3];
    const RADIAL = [7, 6, 5, 3, 3];
    function makeTree(seed, o) {
      const rand = rng(seed);
      const parts = [];
      const q = new T.Quaternion(), m = new T.Matrix4(), one = new T.Vector3(1, 1, 1), mid = new T.Vector3(), d = new T.Vector3();
      const seg = (a, b, r0, r1, lvl) => {
        d.subVectors(b, a); const len = d.length(); if (len < 1e-4) return;
        const g = new T.CylinderGeometry(r1, r0, len, RADIAL[lvl], 1, true);
        q.setFromUnitVectors(UP, d.normalize());
        g.applyMatrix4(m.compose(mid.addVectors(a, b).multiplyScalar(0.5), q, one));
        parts.push(g);
      };
      const branch = (p, dir, len, r0, lvl) => {
        const n = Math.max(2, Math.round(len / 0.26));
        const pts = [p.clone()], rad = [lvl === 0 ? r0 * 1.5 : r0];
        const dd = dir.clone();
        for (let i = 1; i <= n; i++) {
          const g = GNARL[lvl];
          dd.x += (rand() - 0.5) * g * 2; dd.y += (rand() - 0.5) * g; dd.z += (rand() - 0.5) * g * 2;
          if (lvl > 0) dd.y += 0.022 - 0.01 * lvl; // a little up-pull, then droop on the finer branches
          dd.normalize();
          pts.push(pts[i - 1].clone().addScaledVector(dd, len / n));
          rad.push(Math.max(o.minR, r0 * (1 - 0.86 * (i / n))));
        }
        for (let i = 0; i < n; i++) seg(pts[i], pts[i + 1], rad[i], rad[i + 1], lvl);
        if (lvl + 1 >= o.levels) return;
        const kids = o.children[lvl], start = lvl === 0 ? o.clear : 0.22;
        for (let k = 0; k < kids; k++) {
          const t = start + (1 - start) * Math.min(0.97, (k + 0.15 + rand() * 0.7) / kids);
          const f = t * n, i = Math.min(n - 1, Math.floor(f)), u = f - i;
          const bp = pts[i].clone().lerp(pts[i + 1], u);
          const br = rad[i] + (rad[i + 1] - rad[i]) * u;
          const pd = new T.Vector3().subVectors(pts[i + 1], pts[i]).normalize();
          const perp = Math.abs(pd.y) < 0.95 ? new T.Vector3().crossVectors(pd, UP).normalize() : new T.Vector3(1, 0, 0);
          perp.applyAxisAngle(pd, rand() * Math.PI * 2);
          const ang = ANG[Math.min(lvl, 3)] + (rand() - 0.5) * 2 * ((24 * Math.PI) / 180);
          const nd = pd.clone().applyAxisAngle(perp, ang).normalize();
          const nl = len * 0.62 * (1 + (rand() - 0.5) * 0.6) * (1 - 0.45 * t * (lvl === 0 ? 1 : 0.4));
          if (nl < 0.05) continue;
          branch(bp, nd, nl, Math.max(o.minR, br * 0.64), lvl + 1);
        }
      };
      branch(new T.Vector3(), new T.Vector3((rand() - 0.5) * 0.08, 1, (rand() - 0.5) * 0.08).normalize(), o.trunk, o.radius, 0);
      return merge(parts);
    }

    const bark = new T.MeshStandardMaterial({ color: lin(0x302c28), roughness: 1, metalness: 0 });
    // darker where the trunk meets the ground, as in the example
    bark.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vH;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvH = position.y;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vH;').replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= smoothstep(0.0, 0.5, vH);');
    };
    const ground = new T.Mesh(new T.PlaneGeometry(600, 600).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: lin(0x8f9398) }));
    scene.add(ground);

    // ---- drifting mist: soft noise clouds hung between the trees, always moving ----
    // After the moving cloud fog of the three.js example webgpu_postprocessing_fog:
    // here as sheets of animated noise at several depths, thick near the ground.
    const mists = [];
    function mist() {
      const vs = `
        varying vec2 vUv; varying float vDepth;
        void main() { vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vDepth = -mv.z; gl_Position = projectionMatrix * mv; }`;
      const fs = `
        uniform float uTime; uniform vec3 uColor; uniform float uOpacity; uniform vec2 uSpeed; uniform float uSeed;
        uniform vec3 fogColor; uniform float fogDensity;
        varying vec2 vUv; varying float vDepth;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p) {
          vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
          return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y);
        }
        float fbm(vec2 p) { float v = 0., a = .5; for (int i = 0; i < OCT; i++) { v += a * noise(p); p = p * 2.03 + 17.1; a *= .5; } return v; }
        void main() {
          vec2 p = vUv * vec2(4.0, 1.4) + uSeed;
          vec2 q = vec2(fbm(p + uTime * 0.02), fbm(p + 5.2 - uTime * 0.015));
          float n = fbm(p + 1.6 * q + uSpeed * uTime);
          float edge = smoothstep(0., .22, vUv.x) * smoothstep(1., .78, vUv.x) * smoothstep(0., .25, vUv.y) * smoothstep(1., .3, vUv.y);
          float a = smoothstep(.3, .74, n) * edge * uOpacity;
          a *= smoothstep(0.6, 3.0, vDepth); // the nearest sheet thins as you walk through it
          float fog = 1.0 - exp(-fogDensity * fogDensity * vDepth * vDepth);
          gl_FragColor = vec4(mix(uColor, fogColor, fog * 0.6), a);
        }`;
      const fc = new T.Color(FOG);
      const layers = small
        ? [[5.5, 0.58], [1, 0.66], [-4, 0.7], [-9, 0.68]]
        : [[6.5, 0.5], [3, 0.62], [-0.5, 0.68], [-4, 0.7], [-8, 0.7], [-12, 0.66]];
      layers.forEach(([z, op], i) => {
        const m = new T.ShaderMaterial({
          uniforms: {
            uTime: { value: 0 }, uColor: { value: new T.Vector3(1.0, 1.0, 1.0) }, uOpacity: { value: op },
            uSpeed: { value: new T.Vector2(0.035 + i * 0.007, 0.004) }, uSeed: { value: i * 7.3 },
            fogColor: { value: new T.Vector3(fc.r, fc.g, fc.b) }, fogDensity: { value: DENSITY },
          },
          vertexShader: vs, fragmentShader: fs, transparent: true, depthWrite: false, defines: { OCT: small ? 3 : 5 },
        });
        const w = 26 + i * 4, h = 5.5 + i * 0.5;
        const plane = new T.Mesh(new T.PlaneGeometry(w, h), m);
        plane.position.set((i % 2 ? -1 : 1) * 0.8, h / 2 - 0.4, z);
        plane.renderOrder = 2;
        scene.add(plane); mists.push(m);
      });
    }

    function grow() {
      const VARIANTS = small ? 6 : 10;
      const variants = [];
      for (let v = 0; v < VARIANTS; v++) {
        variants.push(makeTree(v + 1, {
          levels: small ? 4 : 5, trunk: 3.4 + v * 0.16, radius: 0.065 + v * 0.004,
          children: small ? [6 + (v % 3), 3, 2] : [7 + (v % 3), 4, 3, 1], clear: 0.38 + (v % 4) * 0.05, minR: 0.0012,
        }));
      }
      const rand = rng(25);
      const cols = small ? 9 : 13, rows = small ? 10 : 12, spacing = 1.9;
      const lists = variants.map(() => []);
      const dummy = new T.Object3D();
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        const v = Math.floor(rand() * variants.length);
        dummy.position.set((i - cols / 2) * spacing + (rand() - 0.5) * spacing * 1.4, 0, j * spacing - rows * spacing + 4.2 + (rand() - 0.5) * spacing * 1.4);
        const s = 0.7 + rand() * 0.65;
        dummy.rotation.set((rand() - 0.5) * 0.08, rand() * Math.PI * 2, (rand() - 0.5) * 0.08);
        dummy.scale.set(s, s * (0.85 + rand() * 0.3), s);
        dummy.updateMatrix(); lists[v].push(dummy.matrix.clone());
      }
      // two big trunks close to the camera anchor the depth
      [[-1.1, 4.9, 1.25, 1.1, 8], [1.5, 4, 1.1, 0.3, 5]].forEach(([x, z, s, ry, v]) => {
        dummy.position.set(x, 0, z); dummy.rotation.set(0, ry, 0); dummy.scale.setScalar(s); dummy.updateMatrix();
        lists[v % variants.length].push(dummy.matrix.clone());
      });
      variants.forEach((g, v) => {
        const mesh = new T.InstancedMesh(g, bark, lists[v].length);
        lists[v].forEach((mx, k) => mesh.setMatrixAt(k, mx));
        mesh.instanceMatrix.needsUpdate = true; mesh.frustumCulled = false;
        scene.add(mesh);
      });
    }

    // ---- snow: point sprites drifting through the mist ----
    // After the three.js example webgl_points_sprites: thousands of textured
    // points, five snowflake shapes (drawn here in code), falling slowly, swaying
    // and spinning. Near flakes are larger; far ones melt into the same fog.
    let snowU = null;
    function snow() {
      const N = small ? 900 : 2100, CELL = 128;
      const atlas = document.createElement('canvas');
      atlas.width = CELL * 5; atlas.height = CELL;
      const g = atlas.getContext('2d');
      g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.lineCap = 'round';
      g.shadowColor = 'rgba(255,255,255,.9)'; g.shadowBlur = 6;
      const flake = (cx, cy, R, v) => {
        g.save(); g.translate(cx, cy);
        if (v === 4) { // a soft round flake
          const rg = g.createRadialGradient(0, 0, 0, 0, 0, R * 0.55);
          rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
          g.fillStyle = rg; g.beginPath(); g.arc(0, 0, R * 0.55, 0, Math.PI * 2); g.fill(); g.restore(); return;
        }
        if (g.strokeStyle === '#ffffff') g.lineWidth = [5, 4, 6, 3.5][v];
        for (let a = 0; a < 6; a++) {
          g.save(); g.rotate((a * Math.PI) / 3);
          g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -R); g.stroke();
          const branches = [[0.45, 0.32], [0.3, 0.22, 0.65, 0.3], [0.55, 0.42], [0.25, 0.18, 0.5, 0.26, 0.75, 0.2]][v];
          for (let b = 0; b < branches.length; b += 2) {
            const y = -R * branches[b], len = R * branches[b + 1];
            g.beginPath(); g.moveTo(0, y); g.lineTo(-len * 0.8, y - len * 0.6); g.moveTo(0, y); g.lineTo(len * 0.8, y - len * 0.6); g.stroke();
          }
          g.restore();
        }
        g.beginPath(); g.arc(0, 0, R * 0.09, 0, Math.PI * 2); g.fill();
        g.restore();
      };
      // a soft grey edge first, then the white flake: it reads against bright fog
      g.save(); g.strokeStyle = 'rgba(70,76,84,.42)'; g.fillStyle = 'rgba(70,76,84,.42)'; g.shadowColor = 'rgba(70,76,84,.5)'; g.shadowBlur = 8;
      for (let v = 0; v < 5; v++) { g.lineWidth = 9; flake(v * CELL + CELL / 2, CELL / 2, CELL * 0.4, v); }
      g.restore();
      for (let v = 0; v < 5; v++) flake(v * CELL + CELL / 2, CELL / 2, CELL * 0.4, v);
      const tex = new T.CanvasTexture(atlas);

      const pos = new Float32Array(N * 3), aVar = new Float32Array(N), aSize = new Float32Array(N), aSpeed = new Float32Array(N), aPhase = new Float32Array(N), aSpin = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        pos[i * 3] = (Math.random() - 0.5) * 20;
        pos[i * 3 + 1] = Math.random() * 9 - 0.5;
        pos[i * 3 + 2] = -14 + Math.random() * 22;
        aVar[i] = Math.floor(Math.random() * 5);
        aSize[i] = 0.022 + Math.random() * 0.045;
        aSpeed[i] = 0.22 + Math.random() * 0.38;
        aPhase[i] = Math.random() * Math.PI * 2;
        aSpin[i] = (Math.random() - 0.5) * 1.6;
      }
      const geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.BufferAttribute(pos, 3));
      geo.setAttribute('aVar', new T.BufferAttribute(aVar, 1));
      geo.setAttribute('aSize', new T.BufferAttribute(aSize, 1));
      geo.setAttribute('aSpeed', new T.BufferAttribute(aSpeed, 1));
      geo.setAttribute('aPhase', new T.BufferAttribute(aPhase, 1));
      geo.setAttribute('aSpin', new T.BufferAttribute(aSpin, 1));
      const fc = new T.Color(FOG);
      snowU = {
        uTime: { value: 0 }, uTex: { value: tex }, uScale: { value: 800 },
        fogColor: { value: new T.Vector3(fc.r, fc.g, fc.b) }, fogDensity: { value: DENSITY },
      };
      const mat = new T.ShaderMaterial({
        uniforms: snowU, transparent: true, depthWrite: false,
        vertexShader: `
          uniform float uTime; uniform float uScale;
          attribute float aVar; attribute float aSize; attribute float aSpeed; attribute float aPhase; attribute float aSpin;
          varying float vVar; varying float vRot; varying float vDepth;
          void main() {
            float y = -0.5 + mod(position.y + 0.5 - uTime * aSpeed, 9.0);
            vec3 p = vec3(position.x + sin(uTime * 0.6 + aPhase) * 0.35, y, position.z + cos(uTime * 0.45 + aPhase) * 0.25);
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            vDepth = -mv.z;
            gl_PointSize = min(24.0, aSize * uScale / max(vDepth, 0.1));
            vVar = aVar; vRot = aPhase + uTime * aSpin;
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: `
          uniform sampler2D uTex; uniform vec3 fogColor; uniform float fogDensity;
          varying float vVar; varying float vRot; varying float vDepth;
          void main() {
            vec2 c = gl_PointCoord - 0.5;
            float s = sin(vRot), co = cos(vRot);
            c = mat2(co, -s, s, co) * c + 0.5;
            if (c.x < 0. || c.y < 0. || c.x > 1. || c.y > 1.) discard;
            vec4 t = texture2D(uTex, vec2((vVar + c.x) / 5.0, 1.0 - c.y));
            float fog = 1.0 - exp(-fogDensity * fogDensity * vDepth * vDepth);
            float a = t.a * (1.0 - fog * 0.88);
            if (a < 0.02) discard;
            gl_FragColor = vec4(mix(vec3(1.0), fogColor, fog * 0.8), a);
          }`,
      });
      const pts = new T.Points(geo, mat);
      pts.frustumCulled = false;
      scene.add(pts);
    }

    // ---- leaves on the wind: three layers of them, tumbling through the trees ----
    // After the three.js example webgpu_layers: thousands of small sprites in three
    // colours, each on its own layer, blowing diagonally across and turning over
    // as they go. Here they are leaves in the site's warm colours, drawn in code.
    let leafU = null;
    function leaves() {
      const per = small ? 100 : 230;
      const cv2 = document.createElement('canvas'); cv2.width = 64; cv2.height = 64;
      const g = cv2.getContext('2d');
      g.translate(32, 32); g.rotate(-0.6);
      g.fillStyle = '#fff';
      g.beginPath(); g.moveTo(0, -28); g.bezierCurveTo(18, -16, 18, 14, 0, 28); g.bezierCurveTo(-18, 14, -18, -16, 0, -28); g.fill();
      g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -24); g.lineTo(0, 26); g.stroke();
      const tex = new T.CanvasTexture(cv2);
      const plane = new T.PlaneGeometry(0.1, 0.1);
      const fc = new T.Color(FOG);
      leafU = { uTime: { value: 0 }, uTex: { value: tex }, fogColor: { value: new T.Vector3(fc.r, fc.g, fc.b) }, fogDensity: { value: DENSITY } };
      const layers = [0xFD641A, 0xFF9A5C, 0xC9A14A];
      layers.forEach((hex, li) => {
        const geo = new T.InstancedBufferGeometry();
        geo.index = plane.index;
        geo.setAttribute('position', plane.attributes.position);
        geo.setAttribute('uv', plane.attributes.uv);
        geo.instanceCount = per;
        const start = new Float32Array(per * 3), rot = new Float32Array(per * 3), dir = new Float32Array(per * 3), off = new Float32Array(per);
        const v = new T.Vector3();
        for (let i = 0; i < per; i++) {
          start[i * 3] = -20 + Math.random() * 5;
          start[i * 3 + 1] = 0 + Math.random() * 12;
          start[i * 3 + 2] = -7 + Math.random() * 13;
          v.set(0.75 + Math.random() * 0.2, -0.3 + Math.random() * 0.14, (Math.random() - 0.5) * 0.2).normalize();
          dir[i * 3] = v.x; dir[i * 3 + 1] = v.y; dir[i * 3 + 2] = v.z;
          rot[i * 3] = Math.random(); rot[i * 3 + 1] = Math.random(); rot[i * 3 + 2] = Math.random();
          off[i] = i / per;
        }
        geo.setAttribute('aStart', new T.InstancedBufferAttribute(start, 3));
        geo.setAttribute('aRot', new T.InstancedBufferAttribute(rot, 3));
        geo.setAttribute('aDir', new T.InstancedBufferAttribute(dir, 3));
        geo.setAttribute('aOff', new T.InstancedBufferAttribute(off, 1));
        const c = new T.Color(hex);
        const mat = new T.ShaderMaterial({
          uniforms: Object.assign({ uColor: { value: new T.Vector3(c.r, c.g, c.b) } }, leafU),
          side: T.DoubleSide, transparent: true, depthWrite: false,
          vertexShader: `
            uniform float uTime;
            attribute vec3 aStart; attribute vec3 aRot; attribute vec3 aDir; attribute float aOff;
            varying vec2 vUv; varying float vShade; varying float vDepth;
            mat3 rx(float a) { float s = sin(a), c = cos(a); return mat3(1., 0., 0., 0., c, s, 0., -s, c); }
            mat3 ry(float a) { float s = sin(a), c = cos(a); return mat3(c, 0., -s, 0., 1., 0., s, 0., c); }
            mat3 rz(float a) { float s = sin(a), c = cos(a); return mat3(c, s, 0., -s, c, 0., 0., 0., 1.); }
            void main() {
              float t = fract(aOff + uTime * 0.014);
              vec3 ang = aRot * t * 20.0;
              mat3 R = rz(ang.z) * ry(ang.y) * rx(ang.x);
              vec3 p = aStart + R * position + aDir * t * 34.0;
              p.y += sin(uTime * 0.8 + aOff * 40.0) * 0.25;
              vec4 mv = modelViewMatrix * vec4(p, 1.0);
              vDepth = -mv.z;
              vShade = 0.55 + 0.45 * abs(normalize(normalMatrix * (R * vec3(0., 0., 1.))).z);
              vUv = uv;
              gl_Position = projectionMatrix * mv;
            }`,
          fragmentShader: `
            uniform sampler2D uTex; uniform vec3 uColor; uniform vec3 fogColor; uniform float fogDensity;
            varying vec2 vUv; varying float vShade; varying float vDepth;
            void main() {
              vec4 t = texture2D(uTex, vUv);
              if (t.a < 0.1) discard;
              float fog = 1.0 - exp(-fogDensity * fogDensity * vDepth * vDepth);
              vec3 col = uColor * vShade * (1.0 - (1.0 - t.r) * 0.6);
              gl_FragColor = vec4(mix(col, fogColor, fog * 0.8), t.a * (1.0 - fog * 0.5));
            }`,
        });
        const mesh = new T.Mesh(geo, mat);
        mesh.frustumCulled = false;
        mesh.layers.set(0);
        scene.add(mesh);
      });
    }

    // ---- the flock ----
    let flock = null;
    function birds() {
      if (reduce || !T.GPUComputationRenderer) return;
      const W = small ? 20 : 28, N = W * W, BOUNDS = 800, HALF = BOUNDS / 2;
      const SCALE = 0.02, OFFSET = new T.Vector3(0, 3.3, -6.5);
      const posFS = `
        uniform float time; uniform float delta;
        void main() {
          vec2 uv = gl_FragCoord.xy / resolution.xy;
          vec4 tmpPos = texture2D(texturePosition, uv);
          vec3 position = tmpPos.xyz;
          vec3 velocity = texture2D(textureVelocity, uv).xyz;
          float phase = tmpPos.w;
          // slowed from the example: half the travel speed, calmer wingbeats
          phase = mod((phase + delta * 0.7 + length(velocity.xz) * delta * 1.8 + max(velocity.y, 0.0) * delta * 3.5), 62.83);
          gl_FragColor = vec4(position + velocity * delta * 7.5, phase);
        }`;
      const velFS = `
        uniform float time; uniform float delta;
        uniform float separationDistance; uniform float alignmentDistance; uniform float cohesionDistance;
        uniform vec3 predator; uniform vec3 center;
        const float width = resolution.x; const float height = resolution.y;
        const float PI = 3.141592653589793; const float PI_2 = PI * 2.0;
        float zoneRadius = 40.0; float zoneRadiusSquared = 1600.0;
        float separationThresh = 0.45; float alignmentThresh = 0.65;
        const float UPPER_BOUNDS = BOUNDS; const float SPEED_LIMIT = 9.0;
        void main() {
          zoneRadius = separationDistance + alignmentDistance + cohesionDistance;
          separationThresh = separationDistance / zoneRadius;
          alignmentThresh = (separationDistance + alignmentDistance) / zoneRadius;
          zoneRadiusSquared = zoneRadius * zoneRadius;
          vec2 uv = gl_FragCoord.xy / resolution.xy;
          vec3 birdPosition, birdVelocity;
          vec3 selfPosition = texture2D(texturePosition, uv).xyz;
          vec3 selfVelocity = texture2D(textureVelocity, uv).xyz;
          float dist; vec3 dir; float distSquared; float f; float percent;
          vec3 velocity = selfVelocity;
          float limit = SPEED_LIMIT;
          dir = predator * UPPER_BOUNDS - selfPosition; dir.z = 0.;
          dist = length(dir); distSquared = dist * dist;
          float preyRadius = 150.0; float preyRadiusSq = preyRadius * preyRadius;
          if (dist < preyRadius) { f = (distSquared / preyRadiusSq - 1.0) * delta * 100.; velocity += normalize(dir) * f; limit += 5.0; }
          dir = selfPosition - center; dist = length(dir);
          dir.y *= 2.5;
          velocity -= normalize(dir) * delta * 5.;
          for (float y = 0.0; y < height; y++) {
            for (float x = 0.0; x < width; x++) {
              vec2 ref = vec2(x + 0.5, y + 0.5) / resolution.xy;
              birdPosition = texture2D(texturePosition, ref).xyz;
              dir = birdPosition - selfPosition; dist = length(dir);
              if (dist < 0.0001) continue;
              distSquared = dist * dist;
              if (distSquared > zoneRadiusSquared) continue;
              percent = distSquared / zoneRadiusSquared;
              if (percent < separationThresh) {
                f = (separationThresh / percent - 1.0) * delta; velocity -= normalize(dir) * f;
              } else if (percent < alignmentThresh) {
                float threshDelta = alignmentThresh - separationThresh;
                float adjustedPercent = (percent - separationThresh) / threshDelta;
                birdVelocity = texture2D(textureVelocity, ref).xyz;
                f = (0.5 - cos(adjustedPercent * PI_2) * 0.5 + 0.5) * delta;
                velocity += normalize(birdVelocity) * f;
              } else {
                float threshDelta = 1.0 - alignmentThresh;
                float adjustedPercent;
                if (threshDelta == 0.) adjustedPercent = 1.; else adjustedPercent = (percent - alignmentThresh) / threshDelta;
                f = (0.5 - (cos(adjustedPercent * PI_2) * -0.5 + 0.5)) * delta;
                velocity += normalize(dir) * f;
              }
            }
          }
          if (length(velocity) > limit) velocity = normalize(velocity) * limit;
          gl_FragColor = vec4(velocity, 1.0);
        }`;
      const birdVS = `
        attribute vec2 reference; attribute float birdVertex; attribute vec3 birdColor;
        uniform sampler2D texturePosition; uniform sampler2D textureVelocity;
        uniform float uScale; uniform vec3 uOffset;
        varying vec4 vColor; varying float vDepth;
        void main() {
          vec4 tmpPos = texture2D(texturePosition, reference);
          vec3 pos = tmpPos.xyz;
          vec3 velocity = normalize(texture2D(textureVelocity, reference).xyz);
          vec3 newPosition = position;
          if (birdVertex == 4.0 || birdVertex == 7.0) newPosition.y = sin(tmpPos.w) * 5.;
          newPosition = mat3(modelMatrix) * newPosition;
          velocity.z *= -1.;
          float xz = length(velocity.xz); float xyz = 1.; float x = sqrt(1. - velocity.y * velocity.y);
          float cosry = velocity.x / xz; float sinry = velocity.z / xz;
          float cosrz = x / xyz; float sinrz = velocity.y / xyz;
          mat3 maty = mat3(cosry, 0, -sinry, 0, 1, 0, sinry, 0, cosry);
          mat3 matz = mat3(cosrz, sinrz, 0, -sinrz, cosrz, 0, 0, 0, 1);
          newPosition = maty * matz * newPosition;
          newPosition += pos;
          vec4 mv = viewMatrix * vec4(newPosition * uScale + uOffset, 1.0);
          vDepth = -mv.z;
          vColor = vec4(birdColor, 1.0);
          gl_Position = projectionMatrix * mv;
        }`;
      // dark birds against the bright fog, fogged with the same exponential fog as the trees
      const birdFS = `
        uniform vec3 fogColor; uniform float fogDensity;
        varying vec4 vColor; varying float vDepth;
        void main() {
          float fog = 1.0 - exp(-fogDensity * fogDensity * vDepth * vDepth);
          vec3 c = vec3(0.10, 0.11, 0.12) * (0.8 + vColor.x * 0.5);
          gl_FragColor = vec4(mix(c, fogColor, clamp(fog, 0., 1.)), 1.0);
        }`;
      const gpu = new T.GPUComputationRenderer(W, W, r);
      if (/Safari/i.test(navigator.userAgent) && !/Chrome|Android/i.test(navigator.userAgent)) gpu.setDataType(T.HalfFloatType);
      const dtP = gpu.createTexture(), dtV = gpu.createTexture();
      for (let k = 0, a = dtP.image.data; k < a.length; k += 4) { a[k] = Math.random() * BOUNDS - HALF; a[k + 1] = (Math.random() * BOUNDS - HALF) * 0.4; a[k + 2] = Math.random() * BOUNDS - HALF; a[k + 3] = 1; }
      for (let k = 0, a = dtV.image.data; k < a.length; k += 4) { a[k] = (Math.random() - 0.5) * 10; a[k + 1] = (Math.random() - 0.5) * 10; a[k + 2] = (Math.random() - 0.5) * 10; a[k + 3] = 1; }
      const velVar = gpu.addVariable('textureVelocity', velFS, dtV);
      const posVar = gpu.addVariable('texturePosition', posFS, dtP);
      gpu.setVariableDependencies(velVar, [posVar, velVar]);
      gpu.setVariableDependencies(posVar, [posVar, velVar]);
      const pU = posVar.material.uniforms, vU = velVar.material.uniforms;
      pU.time = { value: 0 }; pU.delta = { value: 0 };
      vU.time = { value: 1 }; vU.delta = { value: 0 };
      vU.separationDistance = { value: 20 }; vU.alignmentDistance = { value: 20 }; vU.cohesionDistance = { value: 20 };
      vU.predator = { value: new T.Vector3(100, 100, 0) };
      vU.center = { value: new T.Vector3() };
      velVar.material.defines.BOUNDS = BOUNDS.toFixed(2);
      velVar.wrapS = velVar.wrapT = posVar.wrapS = posVar.wrapT = T.RepeatWrapping;
      if (gpu.init() !== null) return;

      const tris = N * 3, pts = tris * 3;
      const g = new T.BufferGeometry();
      const vtx = new Float32Array(pts * 3), col = new Float32Array(pts * 3), ref = new Float32Array(pts * 2), bv = new Float32Array(pts);
      let v = 0;
      const push = (...a) => { for (const n of a) vtx[v++] = n; };
      for (let f = 0; f < N; f++) { push(0, 0, -20, 0, 4, -20, 0, 0, 30); push(0, 0, -15, -20, 0, 0, 0, 0, 15); push(0, 0, 15, 20, 0, 0, 0, 0, -15); }
      for (let i = 0; i < pts; i++) {
        const bird = ~~(~~(i / 3) / 3);
        const c = new T.Color(0x444444 + (~~(i / 9) / N) * 0x666666);
        col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
        ref[i * 2] = (bird % W) / W; ref[i * 2 + 1] = ~~(bird / W) / W;
        bv[i] = i % 9;
      }
      g.setAttribute('position', new T.BufferAttribute(vtx, 3));
      g.setAttribute('birdColor', new T.BufferAttribute(col, 3));
      g.setAttribute('reference', new T.BufferAttribute(ref, 2));
      g.setAttribute('birdVertex', new T.BufferAttribute(bv, 1));
      g.scale(0.2, 0.2, 0.2);
      const fc = new T.Color(FOG);
      const bU = {
        texturePosition: { value: null }, textureVelocity: { value: null },
        uScale: { value: SCALE }, uOffset: { value: OFFSET },
        fogColor: { value: new T.Vector3(fc.r, fc.g, fc.b) }, fogDensity: { value: DENSITY },
      };
      const mesh = new T.Mesh(g, new T.ShaderMaterial({ uniforms: bU, vertexShader: birdVS, fragmentShader: birdFS, side: T.DoubleSide }));
      mesh.rotation.y = Math.PI / 2; mesh.matrixAutoUpdate = false; mesh.updateMatrix(); mesh.frustumCulled = false;
      scene.add(mesh);

      // the pointer is a hawk: find where it points on the flock's plane, in flock units
      const ndc = new T.Vector2(), ray = new T.Raycaster(), plane = new T.Plane(new T.Vector3(0, 0, 1), -OFFSET.z), hit = new T.Vector3();
      let pointing = false;
      addEventListener('pointermove', (e) => {
        if (e.isPrimary === false) return;
        const b = cv.getBoundingClientRect();
        ndc.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1);
        pointing = true;
      }, { passive: true });
      flock = (now, d) => {
        pU.time.value = now; pU.delta.value = d; vU.time.value = now; vU.delta.value = d;
        if (pointing) {
          ray.setFromCamera(ndc, camera);
          if (ray.ray.intersectPlane(plane, hit)) vU.predator.value.set((hit.x - OFFSET.x) / SCALE / BOUNDS, (hit.y - OFFSET.y) / SCALE / BOUNDS, 0);
          pointing = false;
        } else vU.predator.value.set(100, 100, 0);
        // the flock's home drifts: most of the time deep among the trees, and about
        // once a minute it sweeps forward and the birds fly past close to the camera
        const ts = now / 1000;
        vU.center.value.set(220 * Math.sin(ts * 0.05), -40 - 30 * Math.sin(ts * 0.11 - 0.4), 115 + 265 * Math.sin(ts * 0.11 - 0.4));
        gpu.compute();
        bU.texturePosition.value = gpu.getCurrentRenderTarget(posVar).texture;
        bU.textureVelocity.value = gpu.getCurrentRenderTarget(velVar).texture;
      };
    }

    // ---- camera: eye height, a very slow drift, and a walk in as you scroll ----
    // the pointer does not move the view: only the scroll walks you through the forest
    const target = new T.Vector3();
    function size() {
      const w = cv.clientWidth, h = cv.clientHeight; if (!w || !h) return;
      r.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
      if (snowU) snowU.uScale.value = (h * 0.5 * r.getPixelRatio()) / Math.tan((camera.fov * Math.PI) / 360);
    }
    let t = 0;
    function place(dt) {
      if (!reduce) t += dt;
      const p = reduce ? 0 : stageP;
      camera.position.set(0.4 + Math.sin(t * 0.05) * 0.35, 1.7 + Math.sin(t * 0.09) * 0.04, 9 - p * 2.6);
      target.set(-0.2, 1.9 + p * 0.5, camera.position.z - 17);
      camera.lookAt(target);
    }

    let visible = true, last = performance.now(), started = false;
    new IntersectionObserver((es) => { visible = es[0].isIntersecting; }).observe(cv);
    function frame(now) {
      requestAnimationFrame(frame);
      let d = (now - last) / 1000; if (d > 1) d = 1; last = now;
      if (!visible || document.hidden) return;
      if (flock) flock(now, d);
      if (!reduce) for (const m of mists) m.uniforms.uTime.value = now / 1000;
      if (snowU && !reduce) snowU.uTime.value = now / 1000;
      if (leafU && !reduce) leafU.uTime.value = now / 1000;
      place(d);
      r.render(scene, camera);
      if (!started) { started = true; cv.classList.add('on'); }
    }
    // grow the trees after first paint, so the page never waits on them
    setTimeout(() => {
      grow(); mist(); snow(); leaves(); birds(); size(); addEventListener('resize', size);
      last = performance.now(); requestAnimationFrame(frame);
    }, 30);
  })();
})();
