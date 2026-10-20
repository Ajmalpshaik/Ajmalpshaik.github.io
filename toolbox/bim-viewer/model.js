/* BIM Viewer - the model in the scene. Turns the worker's colour batches into
   meshes, and keeps the map from triangles back to IFC elements so an element
   can be picked, highlighted, hidden, isolated, x-rayed or cut through. */

import * as THREE from 'three';
import { Octree } from 'three/addons/math/Octree.js';

// IFC class -> the Revit category a modeller would look for it under
const CATEGORY = {
  IfcWall: 'Walls', IfcWallStandardCase: 'Walls', IfcCurtainWall: 'Curtain Walls', IfcSlab: 'Floors',
  IfcRoof: 'Roofs', IfcColumn: 'Columns', IfcBeam: 'Structural Framing', IfcMember: 'Curtain Wall Mullions',
  IfcPlate: 'Curtain Panels', IfcDoor: 'Doors', IfcWindow: 'Windows', IfcStair: 'Stairs', IfcStairFlight: 'Stairs',
  IfcRamp: 'Ramps', IfcRampFlight: 'Ramps', IfcRailing: 'Railings', IfcCovering: 'Ceilings',
  IfcFurniture: 'Furniture', IfcFurnishingElement: 'Furniture', IfcSpace: 'Rooms',
  IfcFooting: 'Structural Foundations', IfcPile: 'Structural Foundations', IfcBuildingElementProxy: 'Generic Models',
  IfcDuctSegment: 'Ducts', IfcDuctFitting: 'Duct Fittings', IfcAirTerminal: 'Air Terminals', IfcDamper: 'Duct Accessories',
  IfcPipeSegment: 'Pipes', IfcPipeFitting: 'Pipe Fittings', IfcValve: 'Pipe Accessories',
  IfcCableCarrierSegment: 'Cable Trays', IfcCableCarrierFitting: 'Cable Tray Fittings', IfcCableSegment: 'Cables',
  IfcSanitaryTerminal: 'Plumbing Fixtures', IfcFireSuppressionTerminal: 'Sprinklers', IfcLightFixture: 'Lighting Fixtures',
  IfcFlowTerminal: 'Flow Terminals', IfcFlowSegment: 'Flow Segments', IfcFlowFitting: 'Flow Fittings',
  IfcFlowController: 'Flow Controllers', IfcUnitaryEquipment: 'Mechanical Equipment', IfcPump: 'Mechanical Equipment',
  IfcFan: 'Mechanical Equipment', IfcEnergyConversionDevice: 'Mechanical Equipment', IfcFlowMovingDevice: 'Mechanical Equipment',
  IfcElectricAppliance: 'Electrical Equipment', IfcOutlet: 'Electrical Fixtures', IfcSwitchingDevice: 'Lighting Devices',
  IfcDistributionControlElement: 'Devices', IfcTransportElement: 'Specialty Equipment', IfcGeographicElement: 'Planting',
  IfcSite: 'Topography', IfcBuildingElementPart: 'Parts', IfcElementAssembly: 'Assemblies',
  IfcReinforcingBar: 'Structural Rebar', IfcOpeningElement: 'Openings', IfcAnnotation: 'Annotations',
  IfcShadingDevice: 'Shading Devices',
};
export const categoryOf = (cls) => CATEGORY[cls] || cls.replace(/^Ifc/, '').replace(/([a-z])([A-Z])/g, '$1 $2');

// hidden until asked for, the way a Revit 3D view leaves them off
export const HIDDEN_BY_DEFAULT = new Set(['Rooms', 'Openings', 'Annotations']);
// what the walk view lets you pass through
const PASS_THROUGH = new Set(['Doors', 'Rooms', 'Openings', 'Annotations']);
// what is left to bump into when a model is too big to collide with everything
const STRUCTURE = new Set(['Walls', 'Curtain Walls', 'Floors', 'Roofs', 'Stairs', 'Ramps', 'Railings',
  'Columns', 'Curtain Panels', 'Windows', 'Topography']);
const BIG_COLLIDER = 1500000;     // triangles

const highlightMat = new THREE.MeshStandardMaterial({
  color: 0x2f8cff, emissive: 0x1f6bff, emissiveIntensity: 0.9, roughness: 0.5, transparent: true, opacity: 0.55,
  depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
});
const edgeMat = new THREE.LineBasicMaterial({ color: 0x9fd0ff, transparent: true, opacity: 0.95 });

export class Model {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'ifc-model';
    this.batches = [];
    this.elements = new Map();
    this.storeys = [];
    this.box = new THREE.Box3();
    this.hidden = new Set();          // ids hidden by hand
    this.hiddenCats = new Set(HIDDEN_BY_DEFAULT);
    this.hiddenStoreys = new Set();
    this.isolated = null;             // Set of ids, or null
    this.selected = null;
    this.highlight = null;
    this.planes = [];
    this.xray = false;
    this.triangles = 0;
    this.octree = null;
    this._octreeKey = '';
  }

  // ------------------------------------------------------------- building
  addBatch({ color, pos, nor, idx, ranges }) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setIndex(new THREE.BufferAttribute(idx.slice(), 1));
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    const [r, g, b, a] = color;
    const glass = a < 0.99;
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace),
      roughness: glass ? 0.05 : 0.82, metalness: glass ? 0.1 : 0,
      transparent: glass, opacity: glass ? Math.max(a, 0.2) : 1, depthWrite: !glass,
      side: THREE.DoubleSide, envMapIntensity: glass ? 1.8 : 1,
    });
    mat.userData.base = { opacity: mat.opacity, transparent: mat.transparent, depthWrite: mat.depthWrite };
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = !glass;          // glass lets the sun into the rooms
    mesh.receiveShadow = true;
    if (glass) mesh.renderOrder = 2;
    const batch = { mesh, full: idx, ranges, work: { starts: null, ids: null } };
    mesh.userData.batch = batch;
    this.batches.push(batch);
    this.group.add(mesh);
    this.triangles += idx.length / 3;
  }

  finish({ ids, bbox, typeNames, storeys }) {
    ids.forEach((id, i) => {
      const box = new THREE.Box3(new THREE.Vector3(bbox[i * 6], bbox[i * 6 + 1], bbox[i * 6 + 2]),
                                 new THREE.Vector3(bbox[i * 6 + 3], bbox[i * 6 + 4], bbox[i * 6 + 5]));
      const cls = typeNames[i];
      this.elements.set(id, { id, cls, cat: categoryOf(cls), box, storey: -1, parts: [] });
    });
    this.batches.forEach((b) => {
      const r = b.ranges;
      for (let i = 0; i < r.length; i += 3) {
        const el = this.elements.get(r[i]);
        if (el) el.parts.push({ batch: b, start: r[i + 1], count: r[i + 2] });
      }
    });

    // levels, lowest first, each with the height of its floor
    this.storeys = storeys.map((s) => ({ ...s, ids: s.elements.filter((id) => this.elements.has(id)) }))
      .sort((a, b) => a.elevation - b.elevation);
    this.storeys.forEach((s, i) => {
      for (const id of s.ids) this.elements.get(id).storey = i;
      s.floor = this._floorOf(s.ids);
    });
    this.box = this.visibleBox();
    const nearZero = this.storeys.slice().sort((a, b) => Math.abs(a.elevation) - Math.abs(b.elevation))[0];
    this.groundY = nearZero && Number.isFinite(nearZero.floor) ? nearZero.floor : this.box.min.y;
    this.applyVisibility();
  }

  // the top of the biggest slab on a level is its floor; failing that, its lowest point
  _floorOf(ids) {
    let best = null, area = 0, low = Infinity;
    for (const id of ids) {
      const el = this.elements.get(id);
      if (el.cat === 'Structural Foundations' || el.cat === 'Rooms') continue;
      low = Math.min(low, el.box.min.y);
      if (el.cls !== 'IfcSlab') continue;
      const a = (el.box.max.x - el.box.min.x) * (el.box.max.z - el.box.min.z);
      if (a > area) { area = a; best = el; }
    }
    return best ? best.box.max.y : low;
  }

  // --------------------------------------------------------- visibility
  isVisible(el) {
    if (this.isolated) return this.isolated.has(el.id);
    return !this.hidden.has(el.id) && !this.hiddenCats.has(el.cat) && !(el.storey >= 0 && this.hiddenStoreys.has(el.storey));
  }

  // writes the visible elements' triangles to the front of each batch's index
  // and draws only that much, so hiding costs nothing at render time
  applyVisibility() {
    for (const b of this.batches) {
      const work = b.mesh.geometry.index.array;
      const starts = [], ids = [];
      let n = 0;
      const r = b.ranges;
      for (let i = 0; i < r.length; i += 3) {
        const el = this.elements.get(r[i]);
        if (el && !this.isVisible(el)) continue;
        const s = r[i + 1], c = r[i + 2];
        work.set(b.full.subarray(s, s + c), n);
        starts.push(n); ids.push(r[i]);
        n += c;
      }
      b.work.starts = Int32Array.from(starts);
      b.work.ids = Int32Array.from(ids);
      b.mesh.geometry.setDrawRange(0, n);
      b.mesh.geometry.index.needsUpdate = true;
      b.mesh.visible = n > 0;
    }
    if (this.selected && !this.isVisible(this.elements.get(this.selected))) this.select(null);
    this._octreeKey = '';
  }

  visibleBox() {
    const box = new THREE.Box3();
    for (const el of this.elements.values()) if (this.isVisible(el) && el.parts.length) box.union(el.box);
    if (box.isEmpty()) box.set(new THREE.Vector3(-5, 0, -5), new THREE.Vector3(5, 3, 5));
    return box;
  }

  categories() {
    const map = new Map();
    for (const el of this.elements.values()) {
      if (!el.parts.length) continue;
      map.set(el.cat, (map.get(el.cat) || 0) + 1);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }

  hideSelected() { if (this.selected) { this.hidden.add(this.selected); this.applyVisibility(); } }
  isolateSelected() { if (this.selected) { this.isolated = new Set([this.selected]); this.applyVisibility(); } }
  resetTemporary() { this.hidden.clear(); this.isolated = null; this.applyVisibility(); }

  // ------------------------------------------------------------ picking
  idAt(hit) {
    const b = hit.object.userData.batch;
    if (!b || hit.faceIndex == null) return null;
    const at = hit.faceIndex * 3;
    const s = b.work.starts;
    let lo = 0, hi = s.length - 1;
    while (lo < hi) {                                  // last range starting at or before `at`
      const mid = (lo + hi + 1) >> 1;
      if (s[mid] <= at) lo = mid; else hi = mid - 1;
    }
    return b.work.ids[lo];
  }

  meshes() { return this.batches.map((b) => b.mesh).filter((m) => m.visible); }

  select(id) {
    if (this.highlight) {
      this.group.remove(this.highlight);
      this.highlight.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      this.highlight = null;
    }
    this.selected = id;
    if (id == null) return;
    const el = this.elements.get(id);
    if (!el) return;
    const g = new THREE.Group();
    for (const p of el.parts) {
      // its own copy of the triangles: disposing a geometry that shared the
      // batch's buffers would delete them from the GPU under the batch
      const src = p.batch.mesh.geometry;
      const sp = src.getAttribute('position').array, sn = src.getAttribute('normal').array;
      const pos = new Float32Array(p.count * 3), nor = new Float32Array(p.count * 3);
      for (let i = 0; i < p.count; i++) {
        const v = p.batch.full[p.start + i] * 3;
        pos[i * 3] = sp[v]; pos[i * 3 + 1] = sp[v + 1]; pos[i * 3 + 2] = sp[v + 2];
        nor[i * 3] = sn[v]; nor[i * 3 + 1] = sn[v + 1]; nor[i * 3 + 2] = sn[v + 2];
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      const m = new THREE.Mesh(geo, highlightMat);
      m.renderOrder = 5;
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 28), edgeMat);
      edges.renderOrder = 6;
      g.add(m, edges);
    }
    this.highlight = g;
    this.group.add(g);
  }

  // ----------------------------------------------------- x-ray, sections
  setXray(on) {
    this.xray = on;
    for (const b of this.batches) {
      const m = b.mesh.material, base = m.userData.base;
      m.transparent = on || base.transparent;
      m.opacity = on ? Math.min(base.opacity, 0.14) : base.opacity;
      m.depthWrite = on ? false : base.depthWrite;
      m.needsUpdate = true;
      b.mesh.castShadow = !on && !base.transparent;
    }
  }

  setClipping(planes) {
    this.planes = planes;
    const list = planes.length ? planes : null;
    for (const b of this.batches) b.mesh.material.clippingPlanes = list;
    highlightMat.clippingPlanes = list;
    edgeMat.clippingPlanes = list;
  }

  // ------------------------------------------------------------ collision
  // built the first time the walk view needs it, and again only if what is
  // visible has changed since
  collider() {
    const key = `${this.hidden.size}|${[...this.hiddenCats].sort()}|${[...this.hiddenStoreys]}|${this.isolated ? [...this.isolated] : ''}`;
    if (this.octree && this._octreeKey === key) return this.octree;
    const big = this.triangles > BIG_COLLIDER;
    const octree = new Octree();
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    let added = 0;
    for (const el of this.elements.values()) {
      if (!this.isVisible(el) || PASS_THROUGH.has(el.cat) || (big && !STRUCTURE.has(el.cat))) continue;
      for (const p of el.parts) {
        const pos = p.batch.mesh.geometry.getAttribute('position');
        const ix = p.batch.full;
        for (let i = p.start; i < p.start + p.count; i += 3) {
          a.fromBufferAttribute(pos, ix[i]); b.fromBufferAttribute(pos, ix[i + 1]); c.fromBufferAttribute(pos, ix[i + 2]);
          octree.addTriangle(new THREE.Triangle(a.clone(), b.clone(), c.clone()));
          added++;
        }
      }
    }
    if (added) octree.build();
    this.octree = added ? octree : null;
    this.colliderNote = big ? 'Large model: you collide with walls, floors, roofs and stairs only.' : '';
    this._octreeKey = key;
    return this.octree;
  }

  dispose() {
    this.select(null);
    for (const b of this.batches) { b.mesh.geometry.dispose(); b.mesh.material.dispose(); }
    this.batches = [];
    this.elements.clear();
    this.octree = null;
  }
}
