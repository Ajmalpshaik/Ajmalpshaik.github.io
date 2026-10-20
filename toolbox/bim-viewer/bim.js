/* BIM Viewer - the BIM view. Orbit, pan and zoom like a Revit 3D view (middle
   button pans, wheel zooms at the cursor), click an element for its
   properties, double-click to zoom to it, and measure between two points. */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const VIEWS = {
  home: new THREE.Vector3(1, 0.78, 1),       // south-east, from above
  top: new THREE.Vector3(0, 1, 0.0001),
  front: new THREE.Vector3(0, 0.1, 1),       // south elevation
  side: new THREE.Vector3(1, 0.1, 0),        // east elevation
};

const markMat = new THREE.PointsMaterial({ color: 0xffc83d, size: 9, sizeAttenuation: false, depthTest: false });
const lineMat = new THREE.LineBasicMaterial({ color: 0xffc83d, depthTest: false });

export class Bim {
  constructor(world, canvas, overlay, hooks) {
    this.world = world;
    this.canvas = canvas;
    this.overlay = overlay;            // where measurement labels go
    this.hooks = hooks;                // { pick(id), measured(text) }
    this.model = null;
    const c = this.controls = new OrbitControls(world.camera, canvas);
    c.enableDamping = true;
    c.dampingFactor = 0.09;
    c.screenSpacePanning = true;
    c.zoomToCursor = true;
    c.maxPolarAngle = Math.PI * 0.97;
    c.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.PAN };
    c.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    this.tween = null;
    this.measuring = false;
    this.pending = null;
    this.measures = [];
    this.group = new THREE.Group();
    this.group.renderOrder = 20;
    world.scene.add(this.group);
    this.raycaster = new THREE.Raycaster();
    this.instant = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // a click is a press and release close together; timed by the events
    // themselves, so a slow frame in between does not turn a tap into a hold
    let down = null;
    canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: e.timeStamp }; });
    canvas.addEventListener('pointerup', (e) => {
      if (!this.controls.enabled || !down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      if (moved < 6 && e.timeStamp - down.t < 600) this._click(e);
      down = null;
    });
    canvas.addEventListener('dblclick', (e) => {
      if (!this.controls.enabled || this.measuring) return;
      const hit = this._hit(e);
      if (hit) { const id = this.model.idAt(hit); if (id != null) this.zoomTo(this.model.elements.get(id).box); }
    });
  }

  setModel(model) { this.model = model; this.clearMeasures(); }

  setActive(on) {
    this.controls.enabled = on;
    this.group.visible = on;
    this.overlay.hidden = !on;
    if (on) { this.world.camera.up.set(0, 1, 0); this.controls.update(); }
  }

  // ------------------------------------------------------------- camera
  view(name, box = this.model && this.model.visibleBox(), instant = false) {
    if (!box) return;
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const cam = this.world.camera;
    const fov = THREE.MathUtils.degToRad(cam.fov);
    const fit = Math.min(fov, 2 * Math.atan(Math.tan(fov / 2) * cam.aspect));
    const dist = Math.max(2, sphere.radius / Math.sin(fit / 2)) * 1.02;
    const dir = (VIEWS[name] || VIEWS.home).clone().normalize();
    this._go(sphere.center.clone().addScaledVector(dir, dist), sphere.center.clone(), instant);
  }

  zoomTo(box) {
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const cam = this.world.camera;
    const dir = cam.position.clone().sub(this.controls.target).normalize();
    const dist = Math.max(1.5, sphere.radius * 2.6 / Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2) / 2);
    this._go(sphere.center.clone().addScaledVector(dir, dist), sphere.center.clone());
  }

  _go(pos, target, instant) {
    const cam = this.world.camera;
    this.tween = null;
    if (instant || this.instant) {
      cam.position.copy(pos); this.controls.target.copy(target); this.controls.update(); return;
    }
    this.tween = { t: 0, p0: cam.position.clone(), t0: this.controls.target.clone(), p1: pos, t1: target };
  }

  update(dt) {
    if (this.tween) {
      const tw = this.tween;
      tw.t = Math.min(1, tw.t + dt / 0.6);
      const k = 1 - Math.pow(1 - tw.t, 3);
      this.world.camera.position.lerpVectors(tw.p0, tw.p1, k);
      this.controls.target.lerpVectors(tw.t0, tw.t1, k);
      if (tw.t >= 1) this.tween = null;
    }
    this.controls.update(dt);
    this._labels();
  }

  // ------------------------------------------------------------ picking
  _hit(e) {
    if (!this.model) return null;
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.world.camera);
    const hits = this.raycaster.intersectObjects(this.model.meshes(), false);
    const planes = this.model.planes;
    // a ray does not know about section planes: skip what they have cut away
    return hits.find((h) => planes.every((p) => p.distanceToPoint(h.point) >= -1e-4)) || null;
  }

  _click(e) {
    const hit = this._hit(e);
    if (this.measuring) { if (hit) this._measurePoint(hit.point); return; }
    const id = hit ? this.model.idAt(hit) : null;
    this.hooks.pick(id);
  }

  // ------------------------------------------------------------ measure
  setMeasuring(on) {
    this.measuring = on;
    this._cancelPending();
    this.canvas.style.cursor = on ? 'crosshair' : '';
  }

  _measurePoint(p) {
    if (!this.pending) {
      const g = new THREE.BufferGeometry().setFromPoints([p]);
      const dot = new THREE.Points(g, markMat);
      dot.renderOrder = 20;
      this.group.add(dot);
      this.pending = { p: p.clone(), dot };
      return;
    }
    const a = this.pending.p, b = p.clone();
    this.group.remove(this.pending.dot);
    this.pending.dot.geometry.dispose();
    this.pending = null;
    const pts = new THREE.Points(new THREE.BufferGeometry().setFromPoints([a, b]), markMat);
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), lineMat);
    pts.renderOrder = line.renderOrder = 20;
    this.group.add(pts, line);
    const d = a.distanceTo(b), dz = Math.abs(b.y - a.y);
    const label = document.createElement('div');
    label.className = 'bv-measure';
    label.innerHTML = `<b>${d.toFixed(3)} m</b><span>Δh ${dz.toFixed(3)} m</span>`;
    this.overlay.appendChild(label);
    this.measures.push({ a, b, mid: a.clone().add(b).multiplyScalar(0.5), pts, line, label });
    this.hooks.measured(`${d.toFixed(3)} m (${Math.round(d * 1000)} mm)`);
  }

  _cancelPending() {
    if (!this.pending) return;
    this.group.remove(this.pending.dot);
    this.pending.dot.geometry.dispose();
    this.pending = null;
  }

  clearMeasures() {
    this._cancelPending();
    for (const m of this.measures) {
      this.group.remove(m.pts, m.line);
      m.pts.geometry.dispose(); m.line.geometry.dispose();
      m.label.remove();
    }
    this.measures = [];
  }

  _labels() {
    if (!this.measures.length) return;
    const cam = this.world.camera, r = this.canvas.getBoundingClientRect();
    const v = new THREE.Vector3();
    for (const m of this.measures) {
      v.copy(m.mid).project(cam);
      const show = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
      m.label.style.display = show ? '' : 'none';
      if (show) m.label.style.transform = `translate(${(v.x + 1) / 2 * r.width}px, ${(1 - v.y) / 2 * r.height}px) translate(-50%, -130%)`;
    }
  }
}
