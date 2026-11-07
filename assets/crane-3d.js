/* ajmalps.com - Crane Lift Calculator, 3D view.
   Draws the lift from the numbers crane-calc.js already worked out (window.craneLift
   and the 'cranelift' event). It computes nothing of its own: if a figure here ever
   disagrees with a card, the card is right and this file is wrong.
   Scale is 1 unit = 1 m. X runs from the slew centre out to the load, Y is up,
   Z is along the carrier. The crane is a generic outline, not any one machine.
   three.js comes from the page's import map (pinned, with SHA-384 fingerprints). */

const $ = (id) => document.getElementById(id);
const card = $('l3dCard');
const stage = $('l3dStage');
const canvas = $('l3dCanvas');
const labelsEl = $('l3dLabels');
const msgEl = $('l3dMsg');

function say(text) {
  if (!msgEl) return;
  msgEl.textContent = text;
  msgEl.hidden = !text;
}

const f = (n, d = 2) => (Number.isFinite(n) ? n : 0).toFixed(d);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

if (card && stage && canvas) {
  const maps = typeof HTMLScriptElement !== 'undefined' &&
    typeof HTMLScriptElement.supports === 'function' && HTMLScriptElement.supports('importmap');
  if (!maps) {
    say('This browser is too old for the 3D view. Every check below works the same without it.');
  } else if ('IntersectionObserver' in window) {
    /* three.js is about 700 kB, so fetch it only once the view is nearly on screen */
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { io.disconnect(); boot(); }
    }, { rootMargin: '400px 0px' });
    io.observe(card);
  } else {
    boot();
  }
}

async function boot() {
  say('Loading the 3D view…');
  let THREE, OrbitControls;
  try {
    const [t, oc] = await Promise.all([import('three'), import('three/addons/controls/OrbitControls.js')]);
    THREE = t; OrbitControls = oc.OrbitControls;
  } catch (e) {
    say('The 3D view could not load. It needs a connection the first time it opens. Every check below still works offline.');
    return;
  }
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: false });
  } catch (e) {
    say('This device has 3D graphics (WebGL) turned off, so the 3D view cannot draw. Every check below works the same.');
    return;
  }
  say('');
  run(THREE, OrbitControls, renderer);
}

function run(THREE, OrbitControls, renderer) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  /* ---------- palette: one set of materials, made once ---------- */
  const BG = 0x0f1216;
  const C = {
    ok: 0x4ade80, bad: 0xf87171, warn: 0xfbbf24,
    dim: 0x4aa8ff, dim2: 0x93a4b5, wind: 0x38bdf8, pick: 0xffffff,
  };
  const std = (color, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.62, metalness: 0.15 }, o));
  const M = {
    ground: std(0x161a20, { roughness: 1, metalness: 0 }),
    yellow: std(0xe3a72f, { roughness: 0.5, metalness: 0.2 }),
    yellowD: std(0xb7851f, { roughness: 0.55, metalness: 0.2 }),
    steel: std(0x6b7280, { roughness: 0.4, metalness: 0.6 }),
    steelD: std(0x2f343c, { roughness: 0.5, metalness: 0.4 }),
    tyre: std(0x15171b, { roughness: 0.9, metalness: 0 }),
    glass: std(0x1d3a55, { roughness: 0.15, metalness: 0.5 }),
    cw: std(0x4b5260, { roughness: 0.7, metalness: 0.3 }),
    rope: std(0xcfd6de, { roughness: 0.35, metalness: 0.7 }),
    load: std(0xf2994a, { roughness: 0.55, metalness: 0.05 }),
    building: std(0x353c47, { roughness: 0.92, metalness: 0, transparent: true, opacity: 0.93 }),
    roof: std(0x434b57, { roughness: 0.9, metalness: 0 }),
    timber: std(0x8a6a44, { roughness: 0.9, metalness: 0 }),
    wind: new THREE.MeshBasicMaterial({ color: C.wind, depthTest: false, transparent: true, opacity: 0.95 }),
    legOff: std(0x7b8594, { roughness: 0.5, metalness: 0.3, transparent: true, opacity: 0.45 }),
    ok: std(C.ok, { roughness: 0.6 }), bad: std(C.bad, { roughness: 0.6 }), warn: std(C.warn, { roughness: 0.6 }),
  };
  const lineMat = (color, opacity = 1) => new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthTest: false });
  const LM = {
    dim: lineMat(C.dim), dim2: lineMat(C.dim2, 0.85), wind: lineMat(C.wind),
    edgeLoad: new THREE.LineBasicMaterial({ color: 0x7a3a0c }),
    edgeB: new THREE.LineBasicMaterial({ color: 0x4f5866, transparent: true, opacity: 0.9 }),
    zone: new THREE.LineDashedMaterial({ color: C.dim, dashSize: 0.3, gapSize: 0.2 }),
    axis: new THREE.LineDashedMaterial({ color: C.dim2, dashSize: 0.25, gapSize: 0.18, depthTest: false, transparent: true }),
  };

  /* ---------- scene ---------- */
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  scene.fog = new THREE.Fog(BG, 60, 220);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 2000);
  camera.position.set(14, 14, 34);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = !reduceMotion;
  controls.dampingFactor = 0.09;
  controls.maxPolarAngle = Math.PI * 0.495;   /* never under the ground */
  controls.minDistance = 2;
  controls.maxDistance = 600;
  controls.screenSpacePanning = true;

  scene.add(new THREE.HemisphereLight(0xcfe3ff, 0x1a1d22, 1.15));
  const sun = new THREE.DirectionalLight(0xffffff, 2.1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), M.ground);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const gridMinor = new THREE.GridHelper(400, 400, 0x1d222a, 0x1d222a);
  gridMinor.position.y = 0.003;
  const gridMajor = new THREE.GridHelper(400, 80, 0x2b333e, 0x2b333e);
  gridMajor.position.y = 0.006;
  scene.add(gridMinor, gridMajor);

  const world = new THREE.Group();   /* what the camera fits to */
  const dims = new THREE.Group();    /* dimension lines, drawn over everything */
  const tags = new THREE.Group();    /* wind arrows and the like */
  scene.add(world, dims, tags);

  /* ---------- small builders ---------- */
  const UP = V(0, 1, 0);
  const shadow = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };
  function box(w, h, d, mat, x = 0, y = 0, z = 0) {
    const m = shadow(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat));
    m.position.set(x, y, z);
    return m;
  }
  /* a cylinder whose axis runs from a to b */
  function rod(a, b, r, mat, seg = 12) {
    const d = b.clone().sub(a);
    const len = d.length() || 0.001;
    const m = shadow(new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), mat));
    m.position.copy(a).addScaledVector(d, 0.5);
    m.quaternion.setFromUnitVectors(UP, d.normalize());
    return m;
  }
  function lines(points, mat, group, order = 10) {
    const g = new THREE.BufferGeometry().setFromPoints(points);
    const l = new THREE.LineSegments(g, mat);
    l.renderOrder = order;
    if (mat.isLineDashedMaterial) l.computeLineDistances();
    group.add(l);
    return l;
  }

  /* ---------- labels: HTML over the canvas, so text stays sharp ---------- */
  let labels = [];
  /* when two labels collide the more important one stays: a pass/fail figure
     beats a main dimension, which beats a name, which beats a chain dimension */
  const RANK = { ok: 6, bad: 7, warn: 6, dim: 4, wind: 3, tag: 3, dim2: 2 };
  function label(text, pos, kind, group) {
    const el = document.createElement('div');
    el.className = 'l3d-lbl ' + kind;
    el.textContent = text;
    labelsEl.appendChild(el);
    const rank = Math.max(...kind.split(' ').map((k) => RANK[k] || 1));
    labels.push({ el, pos: pos.clone(), group, rank, w: 0, h: 0 });
    labels.sort((a, b) => b.rank - a.rank);
    return el;
  }
  const show = { dims: true, tags: true };
  const tmp = new THREE.Vector3();
  function placeLabels() {
    const w = stage.clientWidth, h = stage.clientHeight;
    const taken = [];
    for (const l of labels) {
      if (!show[l.group]) { l.el.style.display = 'none'; continue; }
      tmp.copy(l.pos).project(camera);
      if (tmp.z > 1 || tmp.z < -1) { l.el.style.display = 'none'; continue; }
      const x = (tmp.x * 0.5 + 0.5) * w, y = (-tmp.y * 0.5 + 0.5) * h;
      l.el.style.display = '';
      if (!l.w) { l.w = l.el.offsetWidth; l.h = l.el.offsetHeight; }
      const r = [x - l.w / 2 - 2, y - l.h / 2 - 2, x + l.w / 2 + 2, y + l.h / 2 + 2];
      const off = r[2] < 0 || r[0] > w || r[3] < 0 || r[1] > h;
      if (off || taken.some((t) => r[0] < t[2] && r[2] > t[0] && r[1] < t[3] && r[3] > t[1])) {
        l.el.style.display = 'none';
        continue;
      }
      taken.push(r);
      l.el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-50%)`;
    }
  }

  /* a dimension: line a-b, slashed ticks, extension stubs, label at the middle.
     n is the direction the label and ticks lean toward, in the drawing plane. */
  function dim(a, b, text, n, s, mat = LM.dim, cls = 'dim') {
    const d = b.clone().sub(a);
    if (d.length() < 1e-3) return;
    const u = d.clone().normalize();
    const t = u.clone().add(n).normalize().multiplyScalar(s * 0.5);
    lines([a, b, a.clone().sub(t), a.clone().add(t), b.clone().sub(t), b.clone().add(t)], mat, dims);
    label(text, a.clone().add(b).multiplyScalar(0.5).addScaledVector(n, s * 1.1), cls, 'dims');
  }
  function arc(center, r, a0, a1, plane, mat = LM.dim) {
    /* plane: 'xy' sweeps from +X toward +Y; custom basis via plane = [e1, e2] */
    const [e1, e2] = plane;
    const pts = [];
    const n = 28;
    for (let i = 0; i < n; i++) {
      const p = (k) => {
        const ang = a0 + (a1 - a0) * (k / n);
        return center.clone().addScaledVector(e1, Math.cos(ang) * r).addScaledVector(e2, Math.sin(ang) * r);
      };
      pts.push(p(i), p(i + 1));
    }
    lines(pts, mat, dims);
  }

  /* full screen is decided here, before anything asks whether we are in it */
  const shell = $('l3d');
  const fsBtn = $('l3dFull');
  const isFull = () => document.fullscreenElement === shell || shell.classList.contains('l3d-max');

  /* ---------- picking ---------- */
  let pickables = [];
  let selected = null, selBox = null, selKey = null;
  const info = $('l3dInfo');
  function pickable(obj, key, describe) {
    obj.traverse((o) => { if (o.isMesh) o.userData.pick = { key, describe, root: obj }; });
    pickables.push(obj);
    if (!partsByKey[key]) partsByKey[key] = obj;   /* so a selection survives the next rebuild */
    return obj;
  }

  /* ---------- the build ---------- */
  let L = null;          /* latest numbers from the calculator */
  let fitBox = new THREE.Box3();
  let focus = { center: V(0, 5, 0), radius: 10 };   /* the rigging, for the Load view */
  let partsByKey = {};
  const warnEl = $('l3dWarn');

  function clear() {
    for (const g of [world, dims, tags]) {
      g.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      g.clear();
    }
    labelsEl.textContent = '';
    labels = [];
    pickables = [];
    partsByKey = {};
    if (selBox) { scene.remove(selBox); selBox.geometry.dispose(); selBox.material.dispose(); selBox = null; }
    selected = null;
  }

  function build() {
    clear();
    if (!L) return;
    const R = Math.max(L.workingRadius, 0);
    const tipY = Math.max(L.heightRequired, 0);
    const pivotH = Math.max(L.pivotHeight, 0);
    const boomA = (L.boomAngle || 0) * Math.PI / 180;
    const boomLen = Math.max(L.boomLength, 0);
    const S = Math.max(tipY, R, 10);         /* scene size, for ticks and offsets */
    const tick = clamp(S * 0.018, 0.18, 1.2);
    const notes = [];

    /* ===== crane ===== */
    const crane = new THREE.Group();
    world.add(crane);
    const k = clamp(pivotH / 2.1, 0.45, 1.5);          /* carrier height scale */
    const wheelR = 0.55 * k;
    const chBot = wheelR * 0.9, chTop = chBot + 0.75 * k;
    const carrier = new THREE.Group();
    carrier.add(box(2.5, chTop - chBot, 11.2, M.yellow, 0, (chBot + chTop) / 2, -0.3));
    carrier.add(box(2.55, 0.12, 11.3, M.steelD, 0, chBot + 0.06, -0.3));
    for (const z of [3.7, 2.3, -2.0, -3.4]) {
      for (const x of [-1.12, 1.12]) {
        const wh = shadow(new THREE.Mesh(new THREE.CylinderGeometry(wheelR, wheelR, 0.5, 22), M.tyre));
        wh.rotation.z = Math.PI / 2;
        wh.position.set(x, wheelR, z);
        carrier.add(wh);
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(wheelR * 0.45, wheelR * 0.45, 0.52, 14), M.steel);
        hub.rotation.z = Math.PI / 2;
        hub.position.set(x, wheelR, z);
        carrier.add(hub);
      }
    }
    /* driver's cab at the front of the carrier */
    const cabH = 1.5 * k;
    carrier.add(box(2.5, cabH, 1.5, M.yellow, 0, chTop + cabH / 2 - 0.1, 5.0));
    carrier.add(box(2.3, cabH * 0.45, 0.04, M.glass, 0, chTop + cabH * 0.62, 5.77));
    carrier.add(box(0.04, cabH * 0.42, 1.1, M.glass, 1.27, chTop + cabH * 0.62, 5.0));
    carrier.add(box(0.04, cabH * 0.42, 1.1, M.glass, -1.27, chTop + cabH * 0.62, 5.0));
    const craneInfo = () => ({
      t: 'Crane',
      rows: [
        ['Crane weight, excl. counterweight', f(L.craneWeight, 1) + ' T'],
        ['Chart capacity at this radius', f(L.chartCapacity) + ' T'],
        ['Total lift weight', f(L.totalLiftWeight) + ' T'],
        ['Crane utilisation', L.utilization == null ? '--' : f(L.utilization, 1) + ' %', L.utilCls],
      ],
      note: 'Generic outline to scale in metres. Your machine\'s real size, outrigger spread and chart govern.',
    });
    crane.add(pickable(carrier, 'crane', craneInfo));
    partsByKey.crane = carrier;

    /* outriggers and pads */
    const spread = clamp(2.2 + L.craneWeight * 0.04, 2.6, 6.5);
    const pad = Math.max(L.padDimension, 0);
    const padMat = M[L.gpCls] || M.warn;
    const beamY = chBot + 0.3 * k;
    const pads = new THREE.Group();
    crane.add(pads);
    const padTags = [];
    for (const z of [3.05, -3.75]) {
      carrier.add(box(spread * 2, 0.32 * k, 0.4, M.yellowD, 0, beamY, z));
      for (const x of [-spread, spread]) {
        const jackTop = V(x, beamY, z), jackBot = V(x, 0.12 + 0.18, z);
        carrier.add(rod(jackTop, jackBot, 0.13, M.steel));
        carrier.add(box(0.5, 0.06, 0.5, M.steelD, x, 0.12 + 0.15, z));
        if (pad > 0) {
          const p = box(pad, 0.12, pad, padMat, x, 0.06, z);
          p.castShadow = false;
          pads.add(p);
          lines(boxEdges(x, 0.06, z, pad, 0.12, pad), LM.edgeB, world, 1);
        }
        padTags.push(V(x, 0.3, z));
      }
    }
    pickable(pads, 'pads', () => ({
      t: 'Outrigger pads',
      rows: [
        ['Pad size (square)', f(L.padDimension) + ' × ' + f(L.padDimension) + ' m'],
        ['Max outrigger force', f(L.outriggerForce) + ' T'],
        ['Actual ground pressure', f(L.actualPressure) + ' T/m²', L.gpCls],
        ['Allowable GBP', L.gbp > 0 ? f(L.gbp, 1) + ' T/m²' : 'not entered', L.gbp > 0 ? '' : 'warn'],
      ],
      note: 'Every pad shows the worst-case figure. It does not account for working radius: take the real reaction from the OEM outrigger chart.',
    }));
    partsByKey.pads = pads;

    /* superstructure: slews to face the load, which is +X */
    const upper = new THREE.Group();
    crane.add(upper);
    const ttY = chTop + 0.15 * k;
    upper.add(shadow(new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.25, 0.3 * k, 32), M.steelD)).translateY(ttY));
    const deckBot = ttY + 0.15 * k;
    const deckTop = Math.max(pivotH - 0.15, deckBot + 0.35);
    upper.add(box(4.4, deckTop - deckBot, 2.4, M.yellow, -1.2, (deckBot + deckTop) / 2, 0));
    /* boom foot cheeks, so the pivot reads as a pin and not a weld */
    upper.add(box(1.0, Math.max(pivotH - deckBot, 0.3), 0.18, M.yellowD, 0.1, (deckBot + pivotH) / 2 + 0.05, 0.62));
    upper.add(box(1.0, Math.max(pivotH - deckBot, 0.3), 0.18, M.yellowD, 0.1, (deckBot + pivotH) / 2 + 0.05, -0.62));
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.5, 14), M.steel);
    pin.rotation.x = Math.PI / 2;
    pin.position.set(0, pivotH, 0);
    upper.add(pin);
    /* operator cab beside the boom */
    const ocH = 1.55 * k;
    upper.add(box(1.7, ocH, 0.9, M.yellow, 0.35, deckTop + ocH / 2 - 0.4, 1.55));
    upper.add(box(0.04, ocH * 0.55, 0.75, M.glass, 1.21, deckTop + ocH * 0.55 - 0.4, 1.55));
    upper.add(box(1.4, ocH * 0.5, 0.04, M.glass, 0.35, deckTop + ocH * 0.55 - 0.4, 2.01));
    pickable(upper, 'crane', craneInfo);

    /* counterweight, sized from its tonnage at about 7.2 T/m³ (cast iron slab) */
    if (L.counterWeight > 0) {
      const vol = L.counterWeight / 7.2;
      const ch = clamp(Math.cbrt(vol) * 0.9, 0.35, 2.4);
      const cd = clamp(vol / (2.4 * ch), 0.15, 6);
      const cw = box(cd, ch, 2.4, M.cw, -3.4 + cd / 2, deckTop + ch / 2, 0);
      upper.add(cw);
      pickable(cw, 'cw', () => ({
        t: 'Counterweight',
        rows: [['Counterweight', f(L.counterWeight, 1) + ' T'], ['Crane weight, excl.', f(L.craneWeight, 1) + ' T']],
        note: 'Block drawn at the size of its tonnage in cast iron. Fit the counterweight the chart calls for.',
      }));
      label(f(L.counterWeight, 1) + ' T counterweight', V(-3.4 + cd / 2, deckTop + ch + 0.5, 0), 'tag', 'tags');
    }

    /* ===== boom ===== */
    const foot = V(0, pivotH, 0);
    const dir = V(Math.cos(boomA), Math.sin(boomA), 0);
    const perp = V(Math.sin(boomA), -Math.cos(boomA), 0);    /* below the boom */
    const tip = foot.clone().addScaledVector(dir, boomLen);
    const boom = new THREE.Group();
    world.add(boom);
    if (boomLen > 0.2) {
      const secs = [[0, 0.42, 0.92, 1.05], [0.38, 0.65, 0.76, 0.86], [0.61, 0.83, 0.62, 0.7], [0.79, 0.97, 0.5, 0.56]];
      secs.forEach(([s0, s1, w, h], i) => {
        const len = (s1 - s0) * boomLen;
        const m = box(len, h * clamp(boomLen / 25, 0.7, 1.5), w, i === 0 ? M.yellow : (i % 2 ? M.yellowD : M.yellow));
        m.position.copy(foot).addScaledVector(dir, (s0 + s1) / 2 * boomLen);
        m.rotation.z = boomA;
        boom.add(m);
      });
      const head = box(Math.min(0.9, boomLen * 0.06), 0.8, 0.6, M.steelD);
      head.position.copy(foot).addScaledVector(dir, boomLen * 0.985);
      head.rotation.z = boomA;
      boom.add(head);
      const sheave = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.5, 20), M.steel);
      sheave.rotation.x = Math.PI / 2;
      sheave.position.copy(tip);
      boom.add(sheave);
      /* luffing ram from the deck to about a third up the boom */
      const ramA = V(1.3, deckBot + 0.25, 0);
      const ramB = foot.clone().addScaledVector(dir, boomLen * 0.33).addScaledVector(perp, 0.55);
      if (ramB.distanceTo(ramA) > 0.5) {
        const mid = ramA.clone().lerp(ramB, 0.55);
        boom.add(rod(ramA, mid, 0.22, M.steelD));
        boom.add(rod(mid.clone().lerp(ramA, 0.05), ramB, 0.13, M.steel));
      }
    }
    pickable(boom, 'boom', () => ({
      t: 'Boom',
      rows: [
        ['Required boom length', f(L.boomLength) + ' m'],
        ['Required boom angle', f(L.boomAngle) + '°'],
        ['Working radius', f(L.workingRadius) + ' m'],
        ['Boom pivot height', f(L.pivotHeight) + ' m'],
        ['Boom tip height needed', f(L.heightRequired) + ' m'],
        ['Boom clearance over roof edge', L.boomClrText || 'not checked', L.boomClrCls || ''],
      ],
      note: 'Check this length and angle sit inside your crane\'s chart. Radius is from the slew centre.',
    }));
    partsByKey.boom = boom;

    /* ===== hook block ===== */
    const hookH = Math.max(L.hookHeight, 0);
    const hookPt = V(R, tipY - hookH, 0);                  /* where the slings meet */
    /* the calc's rise is never below zero, so with the pivot above the tip height
       needed the boom lies level at the pivot: hang the hoist from there */
    const headY = boomLen > 0.2 ? Math.max(tip.y, tipY) : tipY;
    if (headY > tipY + 0.05) notes.push('Pivot is above the tip height needed, so the boom is drawn level and the hook hangs lower on its rope.');
    const rig = new THREE.Group();
    world.add(rig);
    const hb = new THREE.Group();
    rig.add(hb);
    if (hookH > 0.05) {
      const blockTop = tipY - Math.min(0.35, hookH * 0.15);
      const blockBot = hookPt.y + hookH * 0.32;
      if (blockTop > blockBot) {
        for (const z of [-0.14, 0.14]) hb.add(rod(V(R, headY, z), V(R, blockTop, z), 0.025, M.rope, 6));
        hb.add(box(0.55, blockTop - blockBot, 0.85, M.yellow, R, (blockTop + blockBot) / 2, 0));
        hb.add(box(0.6, (blockTop - blockBot) * 0.5, 0.06, M.steelD, R, (blockTop + blockBot) / 2, 0.45));
        hb.add(box(0.6, (blockTop - blockBot) * 0.5, 0.06, M.steelD, R, (blockTop + blockBot) / 2, -0.45));
      }
      const hr = clamp(hookH * 0.12, 0.06, 0.3);
      const shankTop = Math.max(blockBot, hookPt.y + hr * 2);
      hb.add(rod(V(R, shankTop, 0), V(R, hookPt.y + hr * 2, 0), hr * 0.35, M.steel, 8));
      const hook = new THREE.Mesh(new THREE.TorusGeometry(hr, hr * 0.32, 8, 20, Math.PI * 1.45), M.steel);
      hook.position.set(R, hookPt.y + hr, 0);
      hook.rotation.z = Math.PI * 0.75;
      hook.castShadow = true;
      hb.add(hook);
    } else {
      hb.add(rod(V(R, headY, 0), hookPt.clone().setY(hookPt.y - 0.01), 0.04, M.rope, 6));
    }
    pickable(hb, 'hook', () => ({
      t: 'Hook block',
      rows: [['Hook block weight', f(L.hookBlockWeight) + ' T'], ['Hook block height', f(L.hookHeight) + ' m']],
      note: 'It hangs above the slings, so it is left out of sling tension and wind mass. It is in total lift weight and crane utilisation.',
    }));
    if (L.hookBlockWeight > 0) label(f(L.hookBlockWeight) + ' T hook', V(R + 0.9, (tipY + hookPt.y) / 2, 0), 'tag', 'tags');

    /* ===== slings and load ===== */
    const ang = clamp(L.slingAngle, 0.5, 90) * Math.PI / 180;
    const sp = L.slingLength * Math.cos(ang);
    const drop = L.slingVerticalDrop;
    const topY = hookPt.y - drop;
    const lL = Math.max(L.loadLength, 0.05), lW = Math.max(L.loadWidth, 0.05), lH = Math.max(L.loadHeight, 0.05);
    const legs = clamp(L.slingLegs | 0, 1, 4);
    let pts;
    if (legs === 1) pts = [V(R, topY, 0)];
    else if (legs === 2) pts = [V(R - sp, topY, 0), V(R + sp, topY, 0)];
    else if (legs === 3) pts = [0, 1, 2].map((i) => V(R + sp * Math.cos(i * 2.0944), topY, sp * Math.sin(i * 2.0944)));
    else {
      const a = Math.atan2(lW, lL);
      pts = [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([sx, sz]) => V(R + sx * sp * Math.cos(a), topY, sz * sp * Math.sin(a)));
    }
    /* BS 7121: two legs carry, whatever is fitted. For four, take a diagonal pair. */
    const carrying = legs === 4 ? [0, 2] : [0, 1].slice(0, L.legsSharing);
    const slings = new THREE.Group();
    const legOff = new THREE.Group();
    rig.add(slings, legOff);
    const slingMat = M[L.slingCls] || M.warn;
    const sr = clamp(S * 0.0022, 0.03, 0.09);
    pts.forEach((p, i) => {
      const on = carrying.includes(i);
      (on ? slings : legOff).add(rod(hookPt, p, on ? sr : sr * 0.8, on ? slingMat : M.legOff, 8));
      (on ? slings : legOff).add(box(0.16, 0.12, 0.16, M.steelD, p.x, p.y + 0.04, p.z));
    });
    pickable(slings, 'slings', () => ({
      t: 'Sling legs (carrying)',
      rows: [
        ['Legs fitted / assumed to carry', legs + ' / ' + L.legsSharing],
        ['Hitch', L.hitch],
        ['Leg length', f(L.slingLength) + ' m'],
        ['Angle from horizontal', f(L.slingAngle, 0) + '°', L.slingAngle < 30 ? 'bad' : ''],
        ['Tension per leg', f(L.tensionPerLeg) + ' T'],
        ['Effective WLL per leg', f(L.effectiveWLL) + ' T'],
        ['Sling utilisation', L.slingUtil == null ? '--' : f(L.slingUtil, 1) + ' %', L.slingCls],
        ['Status', L.slingStatus, L.slingCls],
      ],
      note: 'Coloured legs are the two counted. Grey legs are fitted but not relied on (BS 7121).',
    }));
    if (legOff.children.length) pickable(legOff, 'slings-off', () => ({
      t: 'Sling legs (not counted)',
      rows: [['Legs fitted', String(legs)], ['Assumed to carry', String(L.legsSharing)]],
      note: 'Fitted but not relied on. BS 7121 site practice: never assume more than two legs share the load.',
    }));
    partsByKey.slings = slings;
    if (L.tensionPerLeg > 0 && pts.length) {
      const p0 = pts[carrying[0]] || pts[0];
      label(f(L.tensionPerLeg) + ' T/leg', hookPt.clone().lerp(p0, 0.5).add(V(-0.35, 0, 0)), 'tag ' + L.slingCls, 'tags');
    }

    /* the load */
    const loadBot = topY - Math.max(L.loadHeight, 0);
    const load = box(lL, lH, lW, M.load, R, topY - lH / 2, 0);
    rig.add(load);
    lines(boxEdges(R, topY - lH / 2, 0, lL, lH, lW), LM.edgeLoad, rig, 1);
    pickable(load, 'load', () => ({
      t: 'Load',
      rows: [
        ['Weight of load', f(L.loadWeight) + ' T'],
        ['Plus lifting gear', f(L.gearWeight) + ' T'],
        ['Size L × W × H', f(L.loadLength, 1) + ' × ' + f(L.loadWidth, 1) + ' × ' + f(L.loadHeight, 1) + ' m'],
        ['Sail area used', f(L.sailArea) + ' m²'],
        ['Max permissible wind', L.windOk ? f(L.maxWind) + ' m/s' : '--', L.windOk ? '' : 'warn'],
      ],
      note: 'Centre of gravity is assumed central, as in the calculator.',
    }));
    partsByKey.load = load;
    label(f(L.loadWeight) + ' T load', V(R, topY + 0.35, lW / 2 + 0.2), 'tag', 'tags');

    /* lift points outside the load mean the sling length and angle do not fit it */
    const reach = legs === 4 ? Math.hypot(lL, lW) / 2 : legs === 3 ? Math.min(lL, lW) / 2 : lL / 2;
    if (legs > 1 && sp > reach + 0.05) notes.push('Lift points fall outside the load at this sling length and angle.');

    /* ===== building and landing ===== */
    const T = Math.max(L.targetHeight, 0);
    const halfL = lL / 2, halfW = lW / 2;
    /* the edge the user gave, or a stand-in that only shows the landing level */
    const edgeReal = L.buildingEdge != null && L.buildingEdge < R;
    let near = edgeReal ? L.buildingEdge : Math.max(spread + 1.4, R - Math.max(halfL + 2, 4));
    if (!edgeReal && near > R - halfL) near = R - halfL - 0.3;
    const far = R + Math.max(halfL + 3, 6);
    const bz = Math.max(halfW + 3, 6);
    if (T > 0.05) {
      const b = new THREE.Group();
      world.add(b);
      const bw = far - near;
      b.add(box(bw, T, bz * 2, M.building, (near + far) / 2, T / 2, 0));
      b.add(box(bw + 0.2, 0.25, bz * 2 + 0.2, M.roof, (near + far) / 2, T + 0.125 - 0.25, 0));
      const fl = [];
      for (let y = 3.5; y < T - 0.5; y += 3.5) {
        fl.push(V(near, y, bz), V(far, y, bz), V(near, y, -bz), V(far, y, -bz), V(near, y, bz), V(near, y, -bz), V(far, y, bz), V(far, y, -bz));
      }
      lines(fl.concat(boxEdges((near + far) / 2, T / 2, 0, bw, T, bz * 2)), LM.edgeB, b, 1);
      /* landing zone on the roof, the load's own footprint */
      lines([
        V(R - halfL, T + 0.02, -halfW), V(R + halfL, T + 0.02, -halfW), V(R + halfL, T + 0.02, -halfW), V(R + halfL, T + 0.02, halfW),
        V(R + halfL, T + 0.02, halfW), V(R - halfL, T + 0.02, halfW), V(R - halfL, T + 0.02, halfW), V(R - halfL, T + 0.02, -halfW),
      ], LM.zone, b, 2);
      /* timber bearers to land on */
      for (const s of [-0.3, 0.3]) b.add(box(0.15, 0.12, lW * 0.9, M.timber, R + s * lL, T + 0.06, 0));
      pickable(b, 'building', () => ({
        t: 'Building / landing',
        rows: [
          ['Target height', f(L.targetHeight) + ' m'],
          ['Clearance margin', f(L.clearanceMargin) + ' m'],
          ['Working radius to load centre', f(L.workingRadius) + ' m'],
          ['Building edge from slew centre', edgeReal ? f(L.buildingEdge) + ' m' : 'not given'],
          ['Boom clearance over roof edge', L.boomClrText || 'not checked', L.boomClrCls || ''],
        ],
        note: edgeReal ? 'Near face drawn at the edge you gave. Clearance is to the boom centreline: allow for boom depth, deflection and any parapet.'
          : 'No building edge given, so the near face is a stand-in that only shows the landing level. Enter it in Boom Geometry to check boom clearance.',
      }));
    }

    if (edgeReal && T > 0.05 && L.boomAtEdge != null) {
      const ey = L.boomAtEdge;
      lines([V(near, T, 0), V(near, Math.max(ey, T), 0)], LM.dim2, dims);
      label('Edge ' + L.boomClrText, V(near, (T + Math.max(ey, T)) / 2, 0.8), 'tag ' + (L.boomClrCls || 'warn'), 'tags');
    }

    /* ===== wind on the bigger face ===== */
    if (L.windOk) {
      const faceZ = lL >= lW;
      const from = faceZ ? V(R, 0, halfW + 5) : V(R + halfL + 5, 0, 0);
      const toward = faceZ ? V(0, 0, -1) : V(-1, 0, 0);
      const len = 3.2;
      for (const fy of [0.25, 0.55, 0.85]) {
        const o = from.clone().setY(loadBot + lH * fy);
        const e = o.clone().addScaledVector(toward, len);
        lines([o, e], LM.wind, tags, 9);
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.5, 12), M.wind);
        cone.position.copy(e).addScaledVector(toward, 0.25);
        cone.quaternion.setFromUnitVectors(UP, toward);
        cone.renderOrder = 9;
        tags.add(cone);
      }
      label('Max wind ' + f(L.maxWind, 1) + ' m/s', from.clone().setY(topY + 0.5), 'tag wind', 'tags');
    }

    /* ===== dimensions ===== */
    const g = 0.02;
    /* slew centre: radius is measured from here */
    lines([V(0, 0, 0), V(0, pivotH, 0)], LM.axis, dims);
    dim(V(0, g, 0), V(R, g, 0), 'Radius ' + f(R) + ' m', V(0, 0, 1), tick);
    if (pivotH > 0.05) label('Pivot ' + f(pivotH, 1) + ' m', V(-0.2, pivotH * 0.5, 1.4), 'dim2', 'dims');
    if (boomLen > 0.2) {
      const off = perp.clone().multiplyScalar(-1.3);     /* above the boom */
      dim(foot.clone().add(off), tip.clone().add(off), 'Boom ' + f(boomLen) + ' m', V(-Math.sin(boomA), Math.cos(boomA), 0), tick);
      const ar = clamp(boomLen * 0.22, 1.2, 5);
      lines([foot, foot.clone().add(V(ar * 1.25, 0, 0))], LM.dim2, dims);
      arc(foot, ar, 0, boomA, [V(1, 0, 0), V(0, 1, 0)]);
      label(f(L.boomAngle, 1) + '°', foot.clone().add(V(Math.cos(boomA / 2) * (ar + 0.9), Math.sin(boomA / 2) * (ar + 0.9), 0)), 'dim', 'dims');
    }
    /* the rigging stack, as a chain on the near side of the load */
    const cx = R - halfL - Math.max(0.8, tick * 2);
    const left = V(-1, 0, 0);
    if (T > 0.05) dim(V(near - 0.8, 0, 0), V(near - 0.8, T, 0), 'Target ' + f(T) + ' m', left, tick);
    const chain = [
      [T, T + L.clearanceMargin, 'Clear ' + f(L.clearanceMargin, 2)],
      [loadBot, topY, 'Load ' + f(L.loadHeight, 2)],
      [topY, hookPt.y, 'Sling ' + f(drop, 2)],
      [hookPt.y, tipY, 'Hook ' + f(hookH, 2)],
    ];
    if (T > 0.05) lines([V(cx - 0.4, T, 0), V(near - 0.4, T, 0)], LM.dim2, dims);
    for (const [a, b, t] of chain) if (b - a > 0.01) dim(V(cx, a, 0), V(cx, b, 0), t, left, tick * 0.8, LM.dim2, 'dim2');
    /* total tip height on the far side */
    const tx = far + 1.2;
    lines([V(R + 0.4, tipY, 0), V(tx + 0.4, tipY, 0)], LM.dim2, dims);
    dim(V(tx, 0, 0), V(tx, tipY, 0), 'Tip height ' + f(tipY) + ' m', V(1, 0, 0), tick);
    /* sling angle at the first carrying leg */
    if (legs > 1 && L.slingAngle < 89.5 && pts.length) {
      const p = pts[carrying[0]] || pts[0];
      const hx = V(hookPt.x - p.x, 0, hookPt.z - p.z).normalize();
      const r = clamp(L.slingLength * 0.3, 0.35, 1.6);
      lines([p, p.clone().addScaledVector(hx, r * 1.3)], LM.dim2, dims);
      arc(p, r, 0, ang, [hx, V(0, 1, 0)]);
      label(f(L.slingAngle, 0) + '°', p.clone().addScaledVector(hx, r + 0.35).add(V(0, r * 0.45, 0)), 'dim', 'dims');
    }
    /* pad force tag on the nearest pad */
    if (pad > 0) label(f(L.outriggerForce, 1) + ' T on pad', padTags[1].clone().add(V(0, 0.4, 0)), 'tag ' + L.gpCls, 'tags');

    /* ===== bounds, light, focus ===== */
    fitBox = new THREE.Box3().setFromObject(world);
    fitBox.expandByPoint(V(tx + 1, 0, 0));
    const sph = fitBox.getBoundingSphere(new THREE.Sphere());
    const sh = sun.shadow.camera;
    const ext = sph.radius * 1.15;
    sh.left = -ext; sh.right = ext; sh.top = ext; sh.bottom = -ext;
    sh.near = 0.5; sh.far = sph.radius * 6;
    sh.updateProjectionMatrix();
    sun.position.copy(sph.center).add(V(-0.5, 1.2, 0.8).normalize().multiplyScalar(sph.radius * 2.5));
    sun.target.position.copy(sph.center);
    scene.fog.near = sph.radius * 3;
    scene.fog.far = sph.radius * 9;
    const rb = new THREE.Box3().setFromObject(rig);
    focus = { center: rb.getCenter(new THREE.Vector3()), radius: Math.max(rb.getBoundingSphere(new THREE.Sphere()).radius * 1.35, 2.5) };

    if (warnEl) {
      warnEl.textContent = notes.join(' ');
      warnEl.hidden = !notes.length;
    }
    canvas.setAttribute('aria-label',
      `3D view of the lift: crane at ${f(R, 1)} m radius, boom ${f(boomLen, 1)} m at ${f(L.boomAngle, 0)} degrees, ` +
      `${f(L.loadWeight)} tonne load landing on a ${f(T, 1)} metre roof, boom tip ${f(tipY, 1)} m above ground.`);

    if (selKey && partsByKey[selKey]) select(partsByKey[selKey]);
    else hideInfo();
  }

  function boxEdges(x, y, z, w, h, d) {
    const a = [];
    const xs = [x - w / 2, x + w / 2], ys = [y - h / 2, y + h / 2], zs = [z - d / 2, z + d / 2];
    for (const yy of ys) for (const zz of zs) a.push(V(xs[0], yy, zz), V(xs[1], yy, zz));
    for (const xx of xs) for (const zz of zs) a.push(V(xx, ys[0], zz), V(xx, ys[1], zz));
    for (const xx of xs) for (const yy of ys) a.push(V(xx, yy, zs[0]), V(xx, yy, zs[1]));
    return a;
  }

  /* ---------- HUD chips ---------- */
  const hud = $('l3dHud');
  function hudChip(text, cls, key) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'l3d-chip' + (cls ? ' ' + cls : '');
    b.textContent = text;
    if (key) b.addEventListener('click', () => { const o = partsByKey[key]; if (o) { select(o); view(key === 'slings' || key === 'load' ? 'load' : 'iso'); } });
    hud.appendChild(b);
  }
  function drawHud() {
    if (!hud || !L) return;
    hud.textContent = '';
    hudChip('Crane ' + (L.utilization == null ? '--' : f(L.utilization, 1) + ' %'), L.utilCls, 'crane');
    hudChip('Slings ' + L.slingStatus + (L.slingUtil == null ? '' : ' · ' + f(L.slingUtil, 0) + ' %'), L.slingCls, 'slings');
    hudChip('Ground ' + f(L.actualPressure, 1) + (L.gbp > 0 ? ' / ' + f(L.gbp, 0) : '') + ' T/m²', L.gpCls, 'pads');
    hudChip('Wind ≤ ' + (L.windOk ? f(L.maxWind, 1) : '--') + ' m/s', L.windOk ? '' : 'warn', 'load');
    hudChip('Boom ' + f(L.boomLength, 1) + ' m @ ' + f(L.boomAngle, 0) + '°', '', 'boom');
    requestAnimationFrame(placeInfo);
    if (L.buildingEdge != null) hudChip('Edge ' + L.boomClrText.toLowerCase(), L.boomClrCls, 'boom');
  }

  /* ---------- selection ---------- */
  function hideInfo() {
    if (info) info.hidden = true;
    if (selBox) { scene.remove(selBox); selBox.geometry.dispose(); selBox.material.dispose(); selBox = null; }
    selected = null; selKey = null;
    dirty = true;
  }
  function select(obj) {
    let pick = null;
    obj.traverse((o) => { if (!pick && o.userData.pick) pick = o.userData.pick; });
    if (!pick || !pick.describe) { hideInfo(); return; }
    if (selBox) { scene.remove(selBox); selBox.geometry.dispose(); selBox.material.dispose(); }
    selected = obj; selKey = pick.key;
    selBox = new THREE.BoxHelper(obj, C.pick);
    selBox.material.depthTest = false;
    selBox.material.transparent = true;
    selBox.material.opacity = 0.7;
    selBox.renderOrder = 11;
    scene.add(selBox);
    const d = pick.describe();
    if (info) {
      info.textContent = '';
      const head = document.createElement('div');
      head.className = 'l3d-info-h';
      const t = document.createElement('b');
      t.textContent = d.t;
      const x = document.createElement('button');
      x.type = 'button'; x.className = 'l3d-x'; x.setAttribute('aria-label', 'Close'); x.textContent = '×';
      x.addEventListener('click', hideInfo);
      head.append(t, x);
      info.appendChild(head);
      for (const [k, v, cls] of d.rows) {
        const r = document.createElement('div');
        r.className = 'l3d-row';
        const a = document.createElement('span'); a.textContent = k;
        const b = document.createElement('span'); b.textContent = v; b.className = 'v' + (cls ? ' ' + cls : '');
        r.append(a, b);
        info.appendChild(r);
      }
      if (d.note) { const n = document.createElement('p'); n.textContent = d.note; info.appendChild(n); }
      info.hidden = false;
    }
    dirty = true;
  }

  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function hit(ev) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(pickables, true);
    for (const h of hits) if (h.object.userData.pick && h.object.userData.pick.describe) return h.object.userData.pick.root;
    return null;
  }
  let down = null;
  canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('pointerup', (e) => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    down = null;
    if (moved > 6) return;
    if (e.pointerType !== 'mouse' && !engaged) engage(true);
    const o = hit(e);
    if (o) select(o); else hideInfo();
  });
  canvas.addEventListener('pointercancel', () => { down = null; });

  /* ---------- engaging the view ----------
     The view sits in a page that scrolls, with Lenis smoothing the wheel. Left
     to itself it kept every wheel turn and every swipe that landed on it: Lenis
     does not look at preventDefault, so one wheel turn zoomed the model and
     scrolled the page at once; and OrbitControls sets touch-action:none, so on
     a phone, where the view is most of the screen, the page would not scroll
     past it. So it stays quiet until engaged. A mouse engages by pressing in it
     (drag works at once) and lets go when it leaves; a finger engages with a
     tap and lets go with Done, a tap outside, or by scrolling it away. Full
     screen is always engaged. */
  let engaged = false;
  const hintEl = $('l3dHint');
  const doneBtn = $('l3dDone');
  const touchFirst = window.matchMedia && window.matchMedia('(hover: none)').matches;
  if (hintEl) hintEl.textContent = touchFirst ? 'Tap to move the 3D view' : 'Drag to orbit · click, then scroll to zoom';
  function engage(on) {
    if (isFull()) on = true;
    engaged = on;
    controls.enabled = on;
    canvas.style.touchAction = on ? 'none' : 'pan-y';
    if (on) stage.setAttribute('data-lenis-prevent', '');
    else stage.removeAttribute('data-lenis-prevent');
    stage.classList.toggle('l3d-engaged', on);
    if (doneBtn) doneBtn.hidden = !on || isFull() || !touchUsed;
  }
  let touchUsed = false;
  /* capture, so a mouse is engaged before OrbitControls sees the press */
  stage.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') { if (!engaged) engage(true); }
    else touchUsed = true;
  }, true);
  stage.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse' && !e.buttons && engaged) engage(false);
  });
  stage.addEventListener('wheel', () => {
    if (engaged || !hintEl) return;
    hintEl.classList.remove('l3d-nudge');
    void hintEl.offsetWidth;
    hintEl.classList.add('l3d-nudge');
  }, { passive: true });
  document.addEventListener('pointerdown', (e) => {
    if (engaged && e.pointerType !== 'mouse' && !shell.contains(e.target)) engage(false);
  });
  if (doneBtn) doneBtn.addEventListener('click', () => engage(false));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && engaged && !isFull()) engage(false); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((en) => {
      if (engaged && !isFull() && en.some((x) => x.intersectionRatio < 0.35)) engage(false);
    }, { threshold: [0, 0.35] }).observe(stage);
  }
  let hoverQueued = false;
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || e.buttons || hoverQueued) return;
    hoverQueued = true;
    requestAnimationFrame(() => { hoverQueued = false; canvas.style.cursor = hit(e) ? 'pointer' : ''; });
  });

  /* ---------- camera views ---------- */
  let userMoved = false;
  let currentView = 'iso';
  let fly = null;
  /* OrbitControls says 'start' on any press, a tap included; only a press that
     actually moves the camera means the user has taken over the framing */
  let pressing = false;
  controls.addEventListener('start', () => { pressing = true; });
  controls.addEventListener('end', () => { pressing = false; });
  controls.addEventListener('change', () => { if (pressing) { userMoved = true; fly = null; } });
  function view(name, instant) {
    currentView = name;
    if (fitBox.isEmpty()) return;
    const aspect = camera.aspect || 1;
    const vf = camera.fov * Math.PI / 180;
    const hf = 2 * Math.atan(Math.tan(vf / 2) * aspect);
    let center, radius;
    if (name === 'load') { center = focus.center; radius = focus.radius; }
    else {
      const s = fitBox.getBoundingSphere(new THREE.Sphere());
      center = s.center; radius = s.radius;
    }
    const dirs = { iso: V(0.42, 0.42, 1), side: V(0, 0.04, 1), top: V(0, 1, 0.0015), front: V(1, 0.12, 0.0015), load: V(0.55, 0.3, 1) };
    const d = (dirs[name] || dirs.iso).clone().normalize();
    const dist = radius / Math.sin(Math.min(vf, hf) / 2) * (name === 'load' ? 0.9 : 0.8);
    const pos = center.clone().addScaledVector(d, dist);
    controls.maxDistance = Math.max(600, dist * 3);
    camera.near = Math.max(dist / 200, 0.05);
    camera.far = dist * 30;
    camera.updateProjectionMatrix();
    if (instant || reduceMotion) {
      camera.position.copy(pos); controls.target.copy(center); controls.update(); dirty = true;
    } else {
      fly = { p0: camera.position.clone(), t0: controls.target.clone(), p1: pos, t1: center.clone(), start: performance.now(), ms: 650 };
    }
    for (const b of document.querySelectorAll('[data-l3d-view]')) b.setAttribute('aria-pressed', String(b.dataset.l3dView === name));
  }
  for (const b of document.querySelectorAll('[data-l3d-view]')) {
    b.addEventListener('click', () => { userMoved = false; view(b.dataset.l3dView); });
  }
  for (const b of document.querySelectorAll('[data-l3d-toggle]')) {
    b.addEventListener('click', () => {
      const key = b.dataset.l3dToggle;
      show[key] = !show[key];
      (key === 'dims' ? dims : tags).visible = show[key];
      b.setAttribute('aria-pressed', String(show[key]));
      dirty = true;
    });
  }

  /* ---------- fullscreen (a fixed overlay where the API is missing, as on iPhone) ---------- */
  /* the fixed-sheet fallback covers the page but does not remove it, so make
     everything else inert while it is up, or Tab walks off behind it */
  let inerted = [];
  function trapFocus(on) {
    inerted.forEach((el) => { el.inert = false; });
    inerted = [];
    if (!on) return;
    for (let n = shell; n && n !== document.body; n = n.parentElement) {
      for (const sib of n.parentElement ? n.parentElement.children : []) {
        if (sib !== n && !sib.inert && sib.tagName !== 'SCRIPT') { sib.inert = true; inerted.push(sib); }
      }
    }
  }
  function setFsLabel() {
    trapFocus(shell.classList.contains('l3d-max'));
    if (fsBtn) { fsBtn.textContent = isFull() ? 'Exit full screen' : 'Full screen'; fsBtn.setAttribute('aria-pressed', String(isFull())); }
    engage(isFull());
  }
  if (fsBtn && shell) {
    fsBtn.addEventListener('click', () => {
      if (isFull()) {
        if (document.fullscreenElement) document.exitFullscreen();
        shell.classList.remove('l3d-max');
        document.documentElement.classList.remove('l3d-lock');
      } else if (shell.requestFullscreen && document.fullscreenEnabled) {
        shell.requestFullscreen().catch(() => { shell.classList.add('l3d-max'); document.documentElement.classList.add('l3d-lock'); setFsLabel(); });
      } else {
        shell.classList.add('l3d-max');
        document.documentElement.classList.add('l3d-lock');
      }
      setFsLabel();
    });
    document.addEventListener('fullscreenchange', setFsLabel);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && shell.classList.contains('l3d-max')) {
        shell.classList.remove('l3d-max'); document.documentElement.classList.remove('l3d-lock'); setFsLabel();
      }
    });
  }

  /* ---------- quick sliders: they drive the real inputs, never a copy ---------- */
  const sliders = [...document.querySelectorAll('.l3d-quick input[type=range]')];
  for (const s of sliders) {
    const field = $(s.dataset.for);
    const out = s.parentElement.querySelector('output');
    if (!field) continue;
    s.addEventListener('input', () => {
      field.value = s.value;
      if (out) out.textContent = s.value;
      field.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }
  function syncSliders() {
    for (const s of sliders) {
      const field = $(s.dataset.for);
      if (!field) continue;
      const v = parseFloat(field.value) || 0;
      if (v > parseFloat(s.max)) s.max = String(Math.ceil(v));
      if (document.activeElement !== s) s.value = String(v);
      const out = s.parentElement.querySelector('output');
      if (out) out.textContent = field.value === '' ? '--' : String(v);
      s.disabled = !!field.readOnly;
    }
  }

  /* ---------- size, loop ---------- */
  let dirty = true;
  let visible = true;
  /* the part card sits under the status chips, however many rows they wrap to */
  function placeInfo() {
    if (hud && shell) shell.style.setProperty('--l3d-hud', hud.offsetHeight + 'px');
  }
  function resize() {
    placeInfo();
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (!userMoved && !fly) view(currentView, true);
    dirty = true;
  }
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(stage);
  else window.addEventListener('resize', resize);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((en) => { visible = en.some((e) => e.isIntersecting); if (visible) dirty = true; }).observe(stage);
  }
  controls.addEventListener('change', () => { dirty = true; });

  const ease = (t) => 1 - Math.pow(1 - t, 3);
  function loop(now) {
    requestAnimationFrame(loop);
    if (!visible || document.hidden) return;
    if (fly) {
      const t = Math.min((now - fly.start) / fly.ms, 1);
      const e = ease(t);
      camera.position.lerpVectors(fly.p0, fly.p1, e);
      controls.target.lerpVectors(fly.t0, fly.t1, e);
      if (t >= 1) fly = null;
      dirty = true;
    }
    const moving = controls.update();
    if (moving || dirty) {
      if (selBox && selected) selBox.setFromObject(selected);
      renderer.render(scene, camera);
      placeLabels();
      dirty = false;
    }
  }

  /* ---------- wire to the calculator ---------- */
  let queued = false;
  function update(detail) {
    L = detail || window.craneLift || null;
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      build();
      drawHud();
      syncSliders();
      if (!userMoved && !fly) view(currentView, true);
      dirty = true;
    });
  }
  window.addEventListener('cranelift', (e) => update(e.detail));
  engage(false);
  resize();
  update(window.craneLift);
  card.classList.add('l3d-on');
  requestAnimationFrame(loop);
}
