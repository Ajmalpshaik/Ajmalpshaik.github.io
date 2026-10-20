/* BIM Viewer - wires the page together: the shared world, the BIM view and
   the walk view, the IFC worker, the panels and the settings. Started by the
   small loader at the end of index.html, once it knows this browser can run it. */

import * as THREE from 'three';
import { World, QUALITY } from './world.js';
import { Model } from './model.js';
import { Bim } from './bim.js';
import { Walk, CHARACTERS } from './walk.js';

const $ = (id) => document.getElementById(id);
const SAMPLE = new URL('sample-villa.ifc', import.meta.url).href;
const STORE = 'ajps-bimv';
const BIG_FILE = 150 * 1048576;

const touchFirst = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
const DEFAULTS = {
  quality: touchFirst || Math.min(screen.width, screen.height) < 700 ? 'medium' : 'high',
  shadows: true, ao: true, bloom: false, clouds: true, trees: true, env: 'sky', time: 15.5,
  char: 'robot', cam: 'third', fov: 60, sens: 1, speed: 1, invert: false, minimap: true, torch: true, fps: false,
};

export function start() {
  const ui = {
    needs: $('bvNeeds'), stage: $('bv'), canvas: $('bvCanvas'), measures: $('bvMeasures'),
    tabBim: $('bvTabBim'), tabWalk: $('bvTabWalk'), treeBtn: $('bvTreeBtn'), file: $('bvFile'),
    shot: $('bvShot'), gear: $('bvGear'), full: $('bvFull'),
    tree: $('bvTree'), treeClose: $('bvTreeClose'), name: $('bvName'), meta: $('bvMeta'), levels: $('bvLevels'), cats: $('bvCats'),
    props: $('bvProps'), propsClose: $('bvPropsClose'), propTitle: $('bvPropTitle'), propBody: $('bvPropBody'),
    tools: $('bvTools'), measure: $('bvMeasure'), xray: $('bvXray'), hide: $('bvHide'), isolate: $('bvIsolate'), reset: $('bvReset'),
    cutOn: $('bvCutOn'), cut: $('bvCut'), secOn: $('bvSecOn'), sec: $('bvSec'),
    hud: $('bvHud'), level: $('bvLevel'), cross: $('bvCross'), look: $('bvLook'), keys: $('bvKeys'), emotes: $('bvEmotes'),
    mini: $('bvMini'), goLevel: $('bvGoLevel'), who: $('bvChar'), chars: $('bvChars'), touch: $('bvTouch'), stick: $('bvStick'),
    tJump: $('bvTJump'), tRun: $('bvTRun'), tCam: $('bvTCam'), tLook: $('bvTLook'),
    pause: $('bvPause'), play: $('bvPlay'), back: $('bvBack'), pauseNote: $('bvPauseNote'),
    settings: $('bvSettings'), setClose: $('bvSetClose'),
    loading: $('bvLoading'), loadText: $('bvLoadText'), loadBar: $('bvLoadBar'), drop: $('bvDrop'), fps: $('bvFps'), toast: $('bvToast'),
  };
  ui.needs.hidden = true;
  ui.stage.hidden = false;

  const settings = { ...DEFAULTS, ...load() };
  const world = new World(ui.canvas);
  const bim = new Bim(world, ui.canvas, ui.measures, {
    pick: (id) => select(id),
    measured: (text) => toast(`Distance ${text}`),
  });
  const walk = new Walk(world, ui.canvas, {
    onPause: () => { if (mode === 'walk' && !isTouch) showPause(true); },
    onLook: (id) => showLook(id),
    onInspect: (id) => { if (id != null) select(id); else hideProps(); },
    onLevel: (i) => { ui.level.querySelector('span').textContent = i >= 0 && model ? model.storeys[i].name : 'Outside'; },
    onCamera: (fp) => { settings.cam = fp ? 'first' : 'third'; save(); syncSettingsUI(); ui.cross.hidden = !fp; },
    onMinimap: (on) => { settings.minimap = on; save(); syncSettingsUI(); ui.stage.dataset.minimap = on ? 'on' : 'off'; },
    onCycle: () => { const keys = Object.keys(CHARACTERS); chooseCharacter(keys[(keys.indexOf(settings.char) + 1) % keys.length]); },
    onEmote: (name) => emote(name),
  });

  let model = null;
  let mode = 'bim';
  let busy = false;
  let fileName = 'Sample villa';
  let isTouch = touchFirst;
  let bimCam = null;
  let robotPromise = null;
  let shotPending = false;
  const worker = new Worker(new URL('./ifc-worker.js', import.meta.url), { type: 'module' });

  // -------------------------------------------------------------- loading
  function loading(text, frac) {
    ui.loading.classList.remove('done', 'err');
    ui.loading.hidden = false;
    ui.loadText.textContent = text;
    ui.loadBar.style.width = `${Math.round((frac || 0) * 100)}%`;
  }
  function loaded() { ui.loading.classList.add('done'); }
  function failed(text) {
    ui.loading.classList.remove('done');
    ui.loading.classList.add('err');
    ui.loadText.textContent = text;
    ui.stage.dataset.state = 'error';
  }

  async function openSample() {
    try {
      loading('Downloading the sample villa…', 0.05);
      const res = await fetch(SAMPLE);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      openBuffer(await res.arrayBuffer(), 'Sample villa');
    } catch (err) {
      failed(`The sample model did not load (${err.message}). You can still open your own IFC file.`);
      busy = false;
    }
  }

  function openFile(file) {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'rvt' || ext === 'rfa' || ext === 'rte') {
      toast('A browser cannot read Revit files. In Revit use File › Export › IFC, then drop the .ifc here.', 7000);
      return;
    }
    if (ext === 'ifczip' || ext === 'ifcxml') { toast('Save it as a plain .ifc file, then open that.', 6000); return; }
    if (busy) { toast('Still opening the last file…'); return; }
    if (file.size > BIG_FILE) toast('Large file: this can take a minute and a lot of memory.', 6000);
    const reader = new FileReader();
    loading(`Reading ${file.name}…`, 0.02);
    reader.onload = () => {
      const head = new TextDecoder().decode(new Uint8Array(reader.result, 0, Math.min(64, reader.result.byteLength)));
      if (!head.startsWith('ISO-10303-21')) {
        loaded();
        toast('That file is not an IFC (it does not start with ISO-10303-21).', 6000);
        return;
      }
      openBuffer(reader.result, file.name.replace(/\.ifc$/i, ''));
    };
    reader.onerror = () => failed('The file could not be read.');
    reader.readAsArrayBuffer(file);
  }

  function openBuffer(buffer, name) {
    busy = true;
    ui.stage.dataset.state = 'loading';
    if (mode === 'walk') setMode('bim');
    if (model) { world.scene.remove(model.group); model.dispose(); }
    select(null);
    model = new Model();
    fileName = name;
    loading('Starting the IFC engine…', 0.08);
    worker.postMessage({ cmd: 'open', buffer }, [buffer]);
  }

  worker.onmessage = (e) => {
    const m = e.data;
    if (m.type === 'progress') {
      if (m.stage === 'engine') loading('Starting the IFC engine…', 0.1);
      else if (m.stage === 'parse') loading('Reading the IFC…', 0.18);
      else loading(`Building geometry · ${m.done} of ${m.total} elements`, 0.2 + 0.75 * (m.done / Math.max(1, m.total)));
    } else if (m.type === 'batch') {
      model.addBatch(m);
    } else if (m.type === 'model') {
      model.finish(m);
      world.scene.add(model.group);
      model.setClipping([]);
      bim.setModel(model);
      walk.model = model;
      world.fitModel(model.box, model.groundY);
      fitShadowToModel();
      setupCuts();
      buildTree(m.info);
      bim.view('home', undefined, true);    // a new model starts framed, not flying in
      world.updateEnvironment(true);
      loaded();
      busy = false;
      ui.stage.dataset.state = 'ready';
      ui.stage.dataset.elements = String(model.elements.size);
      if (!robotPromise) robotPromise = startCharacter();
    } else if (m.type === 'props') {
      if (model && model.selected === m.id) renderProps(m.id, m.props);
    } else if (m.type === 'error') {
      busy = false;
      if (m.cmd === 'open') failed(`This IFC could not be opened: ${m.message}`);
      else toast(`Could not read properties: ${m.message}`);
    }
  };
  worker.onerror = (e) => { busy = false; failed(`The IFC engine failed to start${e.message ? `: ${e.message}` : ''}.`); };

  function fitShadowToModel() {
    if (!model) return;
    const s = model.box.getBoundingSphere(new THREE.Sphere());
    world.fitShadow(s.center, s.radius * 1.15);
  }

  // ------------------------------------------------------------ the tree
  function buildTree(info) {
    ui.name.textContent = fileName;
    ui.name.title = fileName;
    const tri = model.triangles >= 1e6 ? `${(model.triangles / 1e6).toFixed(1)}M` : `${Math.round(model.triangles / 1000)}k`;
    ui.meta.textContent = `${info.schema} · ${model.elements.size} elements · ${tri} triangles`;

    ui.levels.textContent = '';
    model.storeys.forEach((s, i) => {
      const li = document.createElement('li');
      const label = document.createElement('label');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !model.hiddenStoreys.has(i);
      cb.addEventListener('change', () => {
        if (cb.checked) model.hiddenStoreys.delete(i); else model.hiddenStoreys.add(i);
        model.applyVisibility();
      });
      const name = document.createElement('span');
      name.textContent = s.name;
      name.title = `${s.name} · ${s.ids.length} elements`;
      label.append(cb, name);
      const only = document.createElement('button');
      only.type = 'button';
      only.textContent = 'Only';
      only.title = `Show only ${s.name}`;
      only.addEventListener('click', () => {
        model.storeys.forEach((_, j) => { if (j === i) model.hiddenStoreys.delete(j); else model.hiddenStoreys.add(j); });
        ui.levels.querySelectorAll('input').forEach((c, j) => { c.checked = j === i; });
        model.applyVisibility();
        bim.view('home', model.visibleBox());
      });
      li.append(label, only);
      ui.levels.appendChild(li);
    });
    if (!model.storeys.length) ui.levels.innerHTML = '<li><em>No levels in this file</em></li>';

    ui.cats.textContent = '';
    for (const [cat, count] of model.categories()) {
      const li = document.createElement('li');
      const label = document.createElement('label');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !model.hiddenCats.has(cat);
      cb.addEventListener('change', () => {
        if (cb.checked) model.hiddenCats.delete(cat); else model.hiddenCats.add(cat);
        model.applyVisibility();
      });
      const name = document.createElement('span');
      name.textContent = cat;
      const n = document.createElement('em');
      n.textContent = count;
      label.append(cb, name, n);
      li.append(label);
      ui.cats.appendChild(li);
    }

    ui.goLevel.textContent = '';
    const out = new Option('Outside', 'out');
    ui.goLevel.add(out);
    model.storeys.forEach((s, i) => ui.goLevel.add(new Option(s.name, String(i))));
  }

  // ---------------------------------------------------------- selection
  function select(id) {
    if (!model) return;
    model.select(id);
    if (id == null) { hideProps(); return; }
    const el = model.elements.get(id);
    ui.props.hidden = false;
    ui.propTitle.textContent = el ? el.cat : 'Properties';
    ui.propBody.innerHTML = '<p class="bv-empty">Reading properties…</p>';
    worker.postMessage({ cmd: 'props', id });
  }

  function hideProps() {
    ui.props.hidden = true;
    if (model && model.selected != null) model.select(null);
  }

  function renderProps(id, p) {
    const el = model.elements.get(id);
    const level = el && el.storey >= 0 ? model.storeys[el.storey].name : '';
    const name = (p.ident.find((r) => r[0] === 'Name') || [])[1] || el.cls;
    ui.propTitle.textContent = name;
    ui.propTitle.title = name;
    const body = document.createDocumentFragment();
    const chip = document.createElement('span');
    chip.className = 'bv-chip';
    chip.textContent = el.cat + (level ? ` · ${level}` : '');
    body.appendChild(chip);
    const rows = [...p.ident];
    if (p.materials.length) rows.push(['Materials', p.materials.join(', ')]);
    body.appendChild(dl(rows));
    p.sets.forEach((s, i) => {
      const d = document.createElement('details');
      d.open = i < 2;
      const sum = document.createElement('summary');
      sum.textContent = s.name;
      d.append(sum, dl(s.rows));
      body.appendChild(d);
    });
    if (!p.sets.length) {
      const none = document.createElement('p');
      none.className = 'bv-empty';
      none.textContent = 'No property sets on this element.';
      body.appendChild(none);
    }
    ui.propBody.textContent = '';
    ui.propBody.appendChild(body);
  }

  function dl(rows) {
    const list = document.createElement('dl');
    list.className = 'bv-rows';
    for (const [k, v] of rows) {
      const row = document.createElement('div');
      const dt = document.createElement('dt');
      const dd = document.createElement('dd');
      dt.textContent = k;
      dd.textContent = v === '' ? '—' : v;
      row.append(dt, dd);
      list.appendChild(row);
    }
    return list;
  }

  function showLook(id) {
    if (id == null || !model) { ui.look.hidden = true; return; }
    const el = model.elements.get(id);
    ui.look.hidden = false;
    ui.look.innerHTML = '';
    const b = document.createElement('b');
    b.textContent = el.cat;
    const s = document.createElement('span');
    s.textContent = isTouch ? 'Tap Inspect for its properties' : 'Press E for its properties';
    ui.look.append(b, s);
  }

  // ------------------------------------------------------- section cuts
  const planCut = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
  const section = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
  function setupCuts() {
    ui.cutOn.checked = false; ui.secOn.checked = false;
    ui.cut.value = 600; ui.sec.value = 500;
    applyCuts();
  }
  function applyCuts() {
    if (!model) return;
    const b = model.box;
    planCut.constant = b.min.y + (b.max.y - b.min.y) * (ui.cut.value / 1000) + 0.001;
    section.constant = b.min.z + (b.max.z - b.min.z) * (ui.sec.value / 1000);
    const planes = [];
    if (ui.cutOn.checked && mode === 'bim') planes.push(planCut);
    if (ui.secOn.checked && mode === 'bim') planes.push(section);
    ui.cut.disabled = !ui.cutOn.checked;
    ui.sec.disabled = !ui.secOn.checked;
    model.setClipping(planes);
    world.setClipping(planes);
  }
  ui.cutOn.addEventListener('change', applyCuts);
  ui.secOn.addEventListener('change', applyCuts);
  ui.cut.addEventListener('input', () => { ui.cutOn.checked = true; applyCuts(); });
  ui.sec.addEventListener('input', () => { ui.secOn.checked = true; applyCuts(); });

  // -------------------------------------------------------------- tools
  ui.tools.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => bim.view(b.dataset.view)));
  const setMeasure = (on) => { bim.setMeasuring(on); ui.measure.setAttribute('aria-pressed', on); if (!on) bim.clearMeasures(); else toast('Click two points to measure. Esc to stop.'); };
  const setXray = (on) => { model && model.setXray(on); ui.xray.setAttribute('aria-pressed', on); if (world.gtao) world.gtao.enabled = !on; };
  ui.measure.addEventListener('click', () => setMeasure(ui.measure.getAttribute('aria-pressed') !== 'true'));
  ui.xray.addEventListener('click', () => setXray(ui.xray.getAttribute('aria-pressed') !== 'true'));
  ui.hide.addEventListener('click', () => { if (!model || model.selected == null) return toast('Select an element first.'); model.hideSelected(); hideProps(); });
  ui.isolate.addEventListener('click', () => { if (!model || model.selected == null) return toast('Select an element first.'); const box = model.elements.get(model.selected).box; model.isolateSelected(); bim.zoomTo(box); });
  ui.reset.addEventListener('click', () => { if (model) model.resetTemporary(); });

  ui.canvas.addEventListener('pointerdown', () => ui.canvas.focus({ preventScroll: true }));
  ui.stage.addEventListener('keydown', (e) => {
    if (mode !== 'bim' || /^(INPUT|SELECT)$/.test(e.target.tagName) && e.target.type !== 'checkbox' && e.target.type !== 'range') return;
    const k = e.key.toLowerCase();
    if (k === 'escape') { if (bim.measuring) setMeasure(false); else select(null); ui.settings.hidden = true; ui.gear.setAttribute('aria-expanded', 'false'); }
    else if (k === 'h') ui.hide.click();
    else if (k === 'i') ui.isolate.click();
    else if (k === 'u') ui.reset.click();
    else if (k === 'x') ui.xray.click();
    else if (k === 'm') ui.measure.click();
    else if (k === 'f') { if (model && model.selected != null) bim.zoomTo(model.elements.get(model.selected).box); else bim.view('home'); }
  });

  // ------------------------------------------------------------- modes
  async function setMode(next) {
    if (next === mode || !model) return;
    if (next === 'walk') {
      if (busy) return;
      if (!walk.ready) {
        loading(`Getting ${CHARACTERS[settings.char].name} ready…`, 0.5);
        try { await robotPromise; } catch { /* reported already */ }
        loaded();
        if (!walk.ready) return;
      }
      if (!model.octree) loading('Preparing the walk view…', 0.7);
      await new Promise((r) => setTimeout(r, 30));      // let the message paint before the octree build
      bimCam = { pos: world.camera.position.clone(), target: bim.controls.target.clone() };
      mode = 'walk';
      setMeasure(false);
      setXray(false);
      applyCuts();
      model.select(null);
      bim.setActive(false);
      walk.enter(model);
      loaded();
      if (model.colliderNote) toast(model.colliderNote, 6000);
      world.camera.fov = settings.fov;
      world.camera.updateProjectionMatrix();
      ui.props.hidden = true;
      ui.hud.hidden = false;
      ui.touch.hidden = !isTouch;
      ui.cross.hidden = !walk.firstPerson;
      ui.keys.classList.remove('dim');
      clearTimeout(setMode.keysTimer);
      setMode.keysTimer = setTimeout(() => ui.keys.classList.add('dim'), 9000);
      showPause(!isTouch);
    } else {
      mode = 'bim';
      walk.exit();
      showPause(false);
      ui.hud.hidden = true;
      ui.touch.hidden = true;
      ui.look.hidden = true;
      hideProps();
      world.camera.fov = 55;
      world.camera.updateProjectionMatrix();
      bim.setActive(true);
      if (bimCam) { world.camera.position.copy(bimCam.pos); bim.controls.target.copy(bimCam.target); bim.controls.update(); }
      applyCuts();
      fitShadowToModel();
    }
    ui.stage.dataset.mode = mode;
    slow.settle = 2;
    ui.tabBim.setAttribute('aria-selected', mode === 'bim');
    ui.tabWalk.setAttribute('aria-selected', mode === 'walk');
  }
  ui.tabBim.addEventListener('click', () => setMode('bim'));
  ui.tabWalk.addEventListener('click', () => setMode('walk'));

  function showPause(on) {
    ui.pause.hidden = !on;
    ui.pauseNote.hidden = isTouch;
  }
  ui.play.addEventListener('click', () => {
    showPause(false);
    ui.canvas.focus();
    if (!isTouch && ui.canvas.requestPointerLock) {
      try { const p = ui.canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch { /* drag to look instead */ }
    }
  });
  ui.back.addEventListener('click', () => setMode('bim'));
  ui.goLevel.addEventListener('change', () => {
    if (ui.goLevel.value === 'out') walk.spawnOutside(); else walk.spawnOnLevel(Number(ui.goLevel.value));
    ui.canvas.focus();
  });
  ui.emotes.querySelectorAll('[data-emote]').forEach((b) => b.addEventListener('click', () => { emote(b.dataset.emote); ui.canvas.focus({ preventScroll: true }); }));

  // ------------------------------------------------------- characters
  // the saved character first; if it cannot be fetched, the robot, which lives here
  async function startCharacter() {
    try {
      await walk.setCharacter(settings.char);
    } catch (err) {
      if (settings.char !== 'robot') toast(`${CHARACTERS[settings.char].name} did not load, so you are the robot (${err.message}).`, 6000);
      settings.char = 'robot';
      try { await walk.setCharacter('robot'); } catch (e2) { ui.stage.dataset.robot = 'error'; toast(`The robot did not load: ${e2.message}`, 6000); return; }
    }
    ui.stage.dataset.robot = 'ready';
    syncCharacterUI();
  }

  async function chooseCharacter(key) {
    if (!CHARACTERS[key]) return;
    const before = settings.char;
    settings.char = key;
    syncCharacterUI();
    if (!walk.ready) return;                 // the first load picks it up
    if (walk.charKey !== key && !walk.cache[key]) toast(`Loading ${CHARACTERS[key].name}…`, 8000);
    try {
      await walk.setCharacter(key);
      if (settings.char === key) toast(`Playing as ${CHARACTERS[key].name}`, 1800);
      save();
    } catch (err) {
      toast(`${CHARACTERS[key].name} did not load (${err.message}).`, 6000);
      settings.char = walk.charKey || before;
    }
    syncCharacterUI();
  }

  function syncCharacterUI() {
    ui.who.value = settings.char;
    S.char.value = settings.char;
    ui.chars.querySelectorAll('[data-char]').forEach((b) => b.setAttribute('aria-checked', b.dataset.char === settings.char));
    ui.emotes.querySelectorAll('[data-emote]').forEach((b) => b.classList.toggle('off', walk.ready && !walk.hasEmote(b.dataset.emote)));
  }

  function emote(name) {
    if (!walk.playEmote(name)) toast(`${CHARACTERS[walk.charKey].name} does not know that move. Try the robot.`, 2600);
  }

  ui.who.addEventListener('change', () => { chooseCharacter(ui.who.value); ui.canvas.focus({ preventScroll: true }); });
  ui.chars.querySelectorAll('[data-char]').forEach((b) => b.addEventListener('click', () => chooseCharacter(b.dataset.char)));

  // --------------------------------------------------------- touch input
  function useTouch(on) {
    isTouch = on;
    ui.stage.classList.toggle('is-touch', on);
    if (mode === 'walk') { ui.touch.hidden = !on; if (on) showPause(false); }
  }
  useTouch(touchFirst);
  ui.stage.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch' && !isTouch) useTouch(true); else if (e.pointerType === 'mouse' && isTouch && !touchFirst) useTouch(false); }, true);

  let stickId = null;
  const knob = ui.stick.querySelector('i');
  const moveStick = (e) => {
    const r = ui.stick.getBoundingClientRect();
    const max = r.width / 2;
    let x = e.clientX - (r.left + max), y = e.clientY - (r.top + max);
    const d = Math.hypot(x, y);
    if (d > max) { x *= max / d; y *= max / d; }
    knob.style.transform = `translate(${x}px, ${y}px)`;
    walk.stick.set(x / max, y / max);
  };
  ui.stick.addEventListener('pointerdown', (e) => { stickId = e.pointerId; ui.stick.setPointerCapture(e.pointerId); moveStick(e); });
  ui.stick.addEventListener('pointermove', (e) => { if (e.pointerId === stickId) moveStick(e); });
  const endStick = (e) => { if (e.pointerId !== stickId) return; stickId = null; knob.style.transform = ''; walk.stick.set(0, 0); };
  ui.stick.addEventListener('pointerup', endStick);
  ui.stick.addEventListener('pointercancel', endStick);

  // look by dragging anywhere else on the view
  const lookers = new Map();
  ui.canvas.addEventListener('pointerdown', (e) => { if (mode === 'walk' && e.pointerType === 'touch') lookers.set(e.pointerId, { x: e.clientX, y: e.clientY }); });
  ui.canvas.addEventListener('pointermove', (e) => {
    const l = lookers.get(e.pointerId);
    if (!l) return;
    walk.look((e.clientX - l.x) * 1.6, (e.clientY - l.y) * 1.6);
    l.x = e.clientX; l.y = e.clientY;
  });
  const endLook = (e) => lookers.delete(e.pointerId);
  ui.canvas.addEventListener('pointerup', endLook);
  ui.canvas.addEventListener('pointercancel', endLook);
  ui.tJump.addEventListener('click', () => walk.jump());
  ui.tRun.addEventListener('click', () => { walk.run = !walk.run; ui.tRun.setAttribute('aria-pressed', walk.run); });
  ui.tCam.addEventListener('click', () => { walk.setFirstPerson(!walk.firstPerson); settings.cam = walk.firstPerson ? 'first' : 'third'; ui.cross.hidden = !walk.firstPerson; save(); syncSettingsUI(); });
  ui.tLook.addEventListener('click', () => { if (walk.lookId != null) select(walk.lookId); else hideProps(); });

  // ---------------------------------------------------------- panels
  ui.treeBtn.addEventListener('click', () => {
    ui.tree.hidden = !ui.tree.hidden;
    ui.treeBtn.setAttribute('aria-expanded', !ui.tree.hidden);
    if (!ui.tree.hidden && window.innerWidth < 760) { ui.props.hidden = true; ui.settings.hidden = true; }
  });
  ui.treeClose.addEventListener('click', () => { ui.tree.hidden = true; ui.treeBtn.setAttribute('aria-expanded', 'false'); });
  if (ui.stage.clientWidth < 760) { ui.tree.hidden = true; ui.treeBtn.setAttribute('aria-expanded', 'false'); }
  ui.propsClose.addEventListener('click', () => { hideProps(); if (mode === 'walk') ui.canvas.focus(); });
  ui.gear.addEventListener('click', () => {
    ui.settings.hidden = !ui.settings.hidden;
    ui.gear.setAttribute('aria-expanded', !ui.settings.hidden);
    if (!ui.settings.hidden && mode === 'walk') showPause(false);
  });
  ui.setClose.addEventListener('click', () => { ui.settings.hidden = true; ui.gear.setAttribute('aria-expanded', 'false'); });

  // ----------------------------------------------------------- settings
  const S = {
    quality: $('sQuality'), shadows: $('sShadows'), ao: $('sAo'), bloom: $('sBloom'), clouds: $('sClouds'), trees: $('sTrees'),
    env: $('sEnv'), time: $('sTime'), cam: $('sCam'), fov: $('sFov'), sens: $('sSens'), speed: $('sSpeed'),
    invert: $('sInvert'), minimap: $('sMini'), torch: $('sTorch'), fps: $('sFps'), char: $('sChar'),
  };
  const OUT = { time: $('sTimeOut'), fov: $('sFovOut'), sens: $('sSensOut'), speed: $('sSpeedOut') };
  const clock = (h) => `${String(Math.floor(h) % 24).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;

  function syncSettingsUI() {
    for (const [k, el] of Object.entries(S)) {
      if (el.type === 'checkbox') el.checked = !!settings[k]; else el.value = settings[k];
    }
    OUT.time.textContent = clock(settings.time);
    OUT.fov.textContent = `${settings.fov}°`;
    OUT.sens.textContent = `${Number(settings.sens).toFixed(1)}×`;
    OUT.speed.textContent = `${Number(settings.speed).toFixed(1)}×`;
    const q = QUALITY[settings.quality];
    S.ao.disabled = !q.ao;
    S.bloom.disabled = !q.bloom;
    S.shadows.disabled = !q.shadow;
  }

  function applySettings() {
    world.apply({ quality: settings.quality, shadows: settings.shadows, ao: settings.ao, bloom: settings.bloom,
      clouds: settings.clouds, trees: settings.trees, env: settings.env, time: settings.time });
    if (ui.xray.getAttribute('aria-pressed') === 'true' && world.gtao) world.gtao.enabled = false;
    applyCuts();
    walk.setFirstPerson(settings.cam === 'first');
    walk.sensitivity = Number(settings.sens);
    walk.speedScale = Number(settings.speed);
    walk.invertY = settings.invert;
    walk.minimap = settings.minimap;
    walk.autoLight = settings.torch;
    ui.stage.dataset.minimap = settings.minimap ? 'on' : 'off';
    ui.fps.hidden = !settings.fps;
    if (mode === 'walk') { world.camera.fov = settings.fov; world.camera.updateProjectionMatrix(); ui.cross.hidden = !walk.firstPerson; }
    if (mode === 'bim') fitShadowToModel();
  }

  for (const [k, el] of Object.entries(S)) {
    el.addEventListener(el.type === 'range' ? 'input' : 'change', () => {
      settings[k] = el.type === 'checkbox' ? el.checked : el.type === 'range' ? Number(el.value) : el.value;
      if (k === 'quality') settings.picked = true;
      if (k === 'char') { chooseCharacter(el.value); return; }
      save();
      syncSettingsUI();
      applySettings();
    });
  }
  $('sReset').addEventListener('click', () => { Object.assign(settings, DEFAULTS); delete settings.picked; save(); syncSettingsUI(); applySettings(); chooseCharacter(settings.char); });

  function load() { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; } }
  function save() { try { localStorage.setItem(STORE, JSON.stringify(settings)); } catch { /* private mode: settings last for this visit */ } }

  // ------------------------------------------------- open, drop, shots
  ui.file.addEventListener('change', () => { openFile(ui.file.files[0]); ui.file.value = ''; });
  let dragDepth = 0;
  ui.stage.addEventListener('dragenter', (e) => { if ([...e.dataTransfer.types].includes('Files')) { e.preventDefault(); dragDepth++; ui.drop.hidden = false; } });
  ui.stage.addEventListener('dragover', (e) => { if ([...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
  ui.stage.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; ui.drop.hidden = true; } });
  ui.stage.addEventListener('drop', (e) => {
    e.preventDefault();
    dragDepth = 0;
    ui.drop.hidden = true;
    openFile(e.dataTransfer.files[0]);
  });

  ui.shot.addEventListener('click', () => { shotPending = true; });
  function takeShot() {
    shotPending = false;
    ui.canvas.toBlob((blob) => {
      if (!blob) return toast('The screenshot could not be made.');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${fileName.replace(/[^\w.-]+/g, '-') || 'model'}-${mode}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }, 'image/png');
  }

  ui.full.addEventListener('click', () => {
    const el = ui.stage;
    if (document.fullscreenElement) { document.exitFullscreen(); return; }
    if (el.classList.contains('is-full')) { el.classList.remove('is-full'); document.body.style.overflow = ''; resize(); return; }
    if (el.requestFullscreen) el.requestFullscreen().catch(() => pseudoFull());
    else pseudoFull();
  });
  function pseudoFull() { ui.stage.classList.add('is-full'); document.body.style.overflow = 'hidden'; resize(); }
  document.addEventListener('fullscreenchange', () => setTimeout(resize, 50));

  let toastTimer = 0;
  function toast(text, ms = 3200) {
    ui.toast.textContent = text;
    ui.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ui.toast.classList.remove('show'), ms);
  }

  // ---------------------------------------------------------- the loop
  function resize() {
    const w = ui.stage.clientWidth, h = ui.stage.clientHeight;
    world.resize(w, h);
  }
  new ResizeObserver(resize).observe(ui.stage);

  let visible = true;
  new IntersectionObserver((entries) => { visible = entries[0].isIntersecting; loop(); }, { threshold: 0.01 }).observe(ui.stage);
  document.addEventListener('visibilitychange', loop);

  const timer = new THREE.Timer();
  timer.connect(document);
  let fpsAcc = 0, fpsN = 0;
  // A device that cannot keep up gets one step down in quality, once a
  // second for as long as it struggles, unless someone chose the quality.
  const slow = { acc: 0, n: 0, bad: 0, settle: 0 };
  const LADDER = ['low', 'medium', 'high', 'ultra'];
  function watchSpeed(dt) {
    if (settings.picked || busy || ui.stage.dataset.state !== 'ready' || settings.quality === 'low') return;
    if ((slow.settle -= dt) > 0) return;
    slow.acc += dt; slow.n++;
    if (slow.acc < 1) return;
    const fps = slow.n / slow.acc;
    slow.acc = 0; slow.n = 0;
    slow.bad = fps < 24 ? slow.bad + 1 : 0;
    if (slow.bad < 3) return;
    slow.bad = 0;
    slow.settle = 2;
    settings.quality = LADDER[Math.max(0, LADDER.indexOf(settings.quality) - 1)];
    save();
    syncSettingsUI();
    applySettings();
    toast(`Quality set to ${S.quality.selectedOptions[0].textContent} to keep it smooth. Change it in Settings.`, 4500);
  }

  function frame(t) {
    timer.update(t);
    const raw = timer.getDelta();
    const dt = Math.min(raw, 0.1);
    watchSpeed(raw);
    if (mode === 'bim') bim.update(dt); else walk.update(dt);
    world.render(dt, timer.getElapsed());
    if (mode === 'walk' && settings.minimap) walk.renderMinimap(miniRect());
    if (shotPending) takeShot();
    if (settings.fps) {
      fpsAcc += dt; fpsN++;
      if (fpsAcc > 0.5) { ui.fps.textContent = `${Math.round(fpsN / fpsAcc)} fps`; fpsAcc = 0; fpsN = 0; }
    }
  }
  function loop() {
    world.renderer.setAnimationLoop(visible && !document.hidden ? frame : null);
  }
  function miniRect() {
    if (ui.mini.offsetParent === null) return null;
    const s = ui.stage.getBoundingClientRect(), m = ui.mini.getBoundingClientRect();
    return { x: m.left - s.left + 2, y: s.bottom - m.bottom + 2, w: m.width - 4, h: m.height - 4 };
  }

  // ---------------------------------------------------------- go
  // the browser checks drive the viewer through this; it is not an API
  ui.stage.viewer = { world, bim, walk, get model() { return model; }, get mode() { return mode; } };
  syncSettingsUI();
  applySettings();
  resize();
  loop();
  openSample();
}
