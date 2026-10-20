/* BIM Viewer - IFC reader. Runs in a worker so a big model never freezes the
   page while it is read. Opens the file with web-ifc, merges every element's
   triangles into one batch per colour, and sends the batches back with the
   ranges that say which element owns which triangles. Properties are read on
   demand, one element at a time, when the user selects it. */

import * as WebIFC from '../../vendor/web-ifc/web-ifc-api.js';

const WASM_DIR = new URL('../../vendor/web-ifc/', import.meta.url).href;

let api = null;
let modelID = -1;
let units = { length: '', area: 'm²', volume: 'm³' };

self.onmessage = async (e) => {
  const msg = e.data;
  try {
    if (msg.cmd === 'open') await open(msg.buffer);
    else if (msg.cmd === 'props') post({ type: 'props', id: msg.id, props: await properties(msg.id) });
  } catch (err) {
    post({ type: 'error', cmd: msg.cmd, message: String(err && err.message || err) });
  }
};

function post(m, transfer) { self.postMessage(m, transfer || []); }

async function init() {
  if (api) return;
  api = new WebIFC.IfcAPI();
  api.SetWasmPath(WASM_DIR, true);
  // GitHub Pages cannot send the headers a multithreaded build needs
  await api.Init(undefined, true);
}

async function open(buffer) {
  post({ type: 'progress', stage: 'engine' });
  await init();
  if (modelID >= 0) { api.CloseModel(modelID); modelID = -1; }

  post({ type: 'progress', stage: 'parse' });
  modelID = api.OpenModel(new Uint8Array(buffer), {
    COORDINATE_TO_ORIGIN: true,     // georeferenced exports sit km from 0,0,0
    CIRCLE_SEGMENTS: 16,
  });
  units = readUnits();

  // ---- geometry: one batch per colour -----------------------------------
  const batches = new Map();         // colour key -> batch
  const boxes = new Map();           // expressID -> [minx,miny,minz,maxx,maxy,maxz]
  const types = new Map();           // expressID -> IFC class name
  let triangles = 0;
  let lastReport = 0;

  api.StreamAllMeshes(modelID, (mesh, index, total) => {
    const id = mesh.expressID;
    if (!types.has(id)) types.set(id, className(api.GetLineType(modelID, id)));
    const placed = mesh.geometries;
    for (let i = 0; i < placed.size(); i++) {
      const pg = placed.get(i);
      const geom = api.GetGeometry(modelID, pg.geometryExpressID);
      const verts = api.GetVertexArray(geom.GetVertexData(), geom.GetVertexDataSize());
      const index3 = api.GetIndexArray(geom.GetIndexData(), geom.GetIndexDataSize());
      if (verts.length && index3.length) {
        const c = pg.color;
        const key = `${q(c.x)},${q(c.y)},${q(c.z)},${q(c.w)}`;
        let b = batches.get(key);
        if (!b) {
          b = { color: [c.x, c.y, c.z, c.w], pos: [], nor: [], idx: [], ranges: [], vcount: 0, icount: 0 };
          batches.set(key, b);
        }
        append(b, id, verts, index3, pg.flatTransformation, boxes);
        triangles += index3.length / 3;
      }
      geom.delete();
    }
    if (index - lastReport > 40 || index === total - 1) {
      lastReport = index;
      post({ type: 'progress', stage: 'geometry', done: index + 1, total });
    }
  });

  // ---- send geometry, largest transfer first is fine --------------------
  for (const b of batches.values()) {
    const pos = concat(Float32Array, b.pos, b.vcount * 3);
    const nor = concat(Float32Array, b.nor, b.vcount * 3);
    const idx = concat(Uint32Array, b.idx, b.icount);
    const ranges = Int32Array.from(b.ranges);
    post({ type: 'batch', color: b.color, pos, nor, idx, ranges },
         [pos.buffer, nor.buffer, idx.buffer, ranges.buffer]);
  }

  // ---- what each element is, where it sits, and which level owns it -----
  const ids = Int32Array.from(boxes.keys());
  const bbox = new Float32Array(ids.length * 6);
  ids.forEach((id, i) => bbox.set(boxes.get(id), i * 6));
  const typeNames = Array.from(ids, (id) => types.get(id) || 'IfcProduct');
  const tree = await api.properties.getSpatialStructure(modelID, false);
  const storeys = collectStoreys(tree);

  post({
    type: 'model',
    info: {
      schema: api.GetModelSchema(modelID),
      project: label(firstOf(WebIFC.IFCPROJECT), 'Name') || '',
      building: label(firstOf(WebIFC.IFCBUILDING), 'Name') || '',
      elements: ids.length,
      triangles,
    },
    ids, bbox, typeNames, storeys,
  }, [ids.buffer, bbox.buffer]);
}

// ------------------------------------------------------------------ geometry
const q = (v) => Math.round(v * 255);

function append(b, id, verts, index3, m, boxes) {
  const base = b.vcount;
  const n = verts.length / 6;
  const pos = new Float32Array(n * 3);
  const nor = new Float32Array(n * 3);
  let box = boxes.get(id);
  if (!box) { box = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]; boxes.set(id, box); }
  for (let k = 0, j = 0; k < verts.length; k += 6, j += 3) {
    const x = verts[k], y = verts[k + 1], z = verts[k + 2];
    const px = m[0] * x + m[4] * y + m[8] * z + m[12];
    const py = m[1] * x + m[5] * y + m[9] * z + m[13];
    const pz = m[2] * x + m[6] * y + m[10] * z + m[14];
    pos[j] = px; pos[j + 1] = py; pos[j + 2] = pz;
    if (px < box[0]) box[0] = px; if (py < box[1]) box[1] = py; if (pz < box[2]) box[2] = pz;
    if (px > box[3]) box[3] = px; if (py > box[4]) box[4] = py; if (pz > box[5]) box[5] = pz;
    const nx = verts[k + 3], ny = verts[k + 4], nz = verts[k + 5];
    let ox = m[0] * nx + m[4] * ny + m[8] * nz;
    let oy = m[1] * nx + m[5] * ny + m[9] * nz;
    let oz = m[2] * nx + m[6] * ny + m[10] * nz;
    const len = Math.hypot(ox, oy, oz) || 1;
    nor[j] = ox / len; nor[j + 1] = oy / len; nor[j + 2] = oz / len;
  }
  // a mirrored placement turns every triangle inside out; swap two corners back
  const det = m[0] * (m[5] * m[10] - m[6] * m[9]) - m[4] * (m[1] * m[10] - m[2] * m[9]) + m[8] * (m[1] * m[6] - m[2] * m[5]);
  const idx = new Uint32Array(index3.length);
  for (let i = 0; i < index3.length; i += 3) {
    idx[i] = index3[i] + base;
    idx[i + 1] = (det < 0 ? index3[i + 2] : index3[i + 1]) + base;
    idx[i + 2] = (det < 0 ? index3[i + 1] : index3[i + 2]) + base;
  }
  // one range per placed geometry; the viewer looks triangles up by index position
  b.ranges.push(id, b.icount, idx.length);
  b.pos.push(pos); b.nor.push(nor); b.idx.push(idx);
  b.vcount += n; b.icount += idx.length;
}

function concat(Type, parts, length) {
  const out = new Type(length);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

// ------------------------------------------------------------ spatial tree
function collectStoreys(tree) {
  const out = [];
  const walk = (node, storey) => {
    const type = String(node.type).toUpperCase();
    let here = storey;
    if (type === 'IFCBUILDINGSTOREY') {
      const line = api.GetLine(modelID, node.expressID);
      here = { id: node.expressID, name: val(line.Name) || val(line.LongName) || `Level ${out.length + 1}`,
               elevation: Number(val(line.Elevation)) || 0, elements: [] };
      out.push(here);
    } else if (here) {
      here.elements.push(node.expressID);
    }
    for (const c of node.children || []) walk(c, here);
  };
  walk(tree, null);
  return out;
}

// --------------------------------------------------------------- properties
const val = (v) => (v && typeof v === 'object' && 'value' in v ? v.value : v);
// web-ifc names classes the way the schema spells them: IfcWall, IfcDuctSegment
const className = (code) => api.GetNameFromTypeCode(code) || 'IfcProduct';

function firstOf(type) {
  const ids = api.GetLineIDsWithType(modelID, type);
  return ids.size() ? api.GetLine(modelID, ids.get(0)) : null;
}
function label(line, key) { return line ? val(line[key]) : null; }

function readUnits() {
  const u = { length: '', area: 'm²', volume: 'm³' };
  const ids = api.GetLineIDsWithType(modelID, WebIFC.IFCSIUNIT);
  for (let i = 0; i < ids.size(); i++) {
    const line = api.GetLine(modelID, ids.get(i));
    if (val(line.UnitType) === 'LENGTHUNIT') {
      const prefix = val(line.Prefix);
      u.length = prefix === 'MILLI' ? 'mm' : prefix === 'CENTI' ? 'cm' : prefix === 'DECI' ? 'dm' : prefix ? '' : 'm';
    }
  }
  if (!u.length) {
    // feet and inches arrive as conversion-based units
    const conv = api.GetLineIDsWithType(modelID, WebIFC.IFCCONVERSIONBASEDUNIT);
    for (let i = 0; i < conv.size(); i++) {
      const line = api.GetLine(modelID, conv.get(i));
      if (val(line.UnitType) === 'LENGTHUNIT') u.length = String(val(line.Name) || '').toLowerCase().startsWith('inch') ? 'in' : 'ft';
      if (val(line.UnitType) === 'AREAUNIT') u.area = 'ft²';
      if (val(line.UnitType) === 'VOLUMEUNIT') u.volume = 'ft³';
    }
  }
  return u;
}

const MEASURE_UNIT = () => ({
  IFCLENGTHMEASURE: units.length, IFCPOSITIVELENGTHMEASURE: units.length, IFCNONNEGATIVELENGTHMEASURE: units.length,
  IFCAREAMEASURE: units.area, IFCVOLUMEMEASURE: units.volume, IFCPLANEANGLEMEASURE: '°',
  IFCTHERMALTRANSMITTANCEMEASURE: 'W/m²K', IFCMASSMEASURE: 'kg', IFCPOWERMEASURE: 'W',
  IFCVOLUMETRICFLOWRATEMEASURE: 'm³/s', IFCTHERMODYNAMICTEMPERATUREMEASURE: 'K',
});

function show(v) {
  if (v === null || v === undefined) return '';
  if (Array.isArray(v)) return v.map(show).filter(Boolean).join(', ');
  if (typeof v !== 'object') return fmt(v);
  const raw = v.value;
  if (raw === undefined) return '';
  const kind = v.name || '';
  if (kind === 'IFCBOOLEAN') return raw === true || raw === 'T' || raw === '.T.' ? 'Yes' : 'No';
  if (kind === 'IFCLOGICAL') return raw === 'T' || raw === true ? 'Yes' : raw === 'F' || raw === false ? 'No' : 'Unknown';
  const unit = MEASURE_UNIT()[kind] || '';
  return fmt(raw) + (unit && typeof raw === 'number' ? ' ' + unit : '');
}

function fmt(x) {
  if (typeof x === 'number') return Number.isInteger(x) ? String(x) : String(Math.round(x * 1000) / 1000);
  if (typeof x === 'boolean') return x ? 'Yes' : 'No';
  return decodeIfcText(String(x));
}

// IFC strings escape anything outside ASCII as \X\hh or \X2\hhhh\X0\
function decodeIfcText(s) {
  return s.replace(/\\X2\\([0-9A-F]+)\\X0\\/gi, (_, hex) => hex.match(/.{4}/g).map((h) => String.fromCharCode(parseInt(h, 16))).join(''))
          .replace(/\\X\\([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
          .replace(/\\S\\(.)/g, (_, c) => String.fromCharCode(c.charCodeAt(0) + 128));
}

function rowsOfSet(set) {
  const rows = [];
  for (const p of set.HasProperties || []) {
    const name = val(p.Name);
    if (!name) continue;
    let v = '';
    if (p.NominalValue !== undefined) v = show(p.NominalValue);
    else if (p.EnumerationValues) v = show(p.EnumerationValues);
    else if (p.ListValues) v = show(p.ListValues);
    else if (p.UpperBoundValue || p.LowerBoundValue) v = `${show(p.LowerBoundValue)} – ${show(p.UpperBoundValue)}`;
    else if (p.HasProperties) v = rowsOfSet(p).map((r) => `${r[0]}: ${r[1]}`).join('; ');
    rows.push([decodeIfcText(String(name)), v]);
  }
  for (const qn of set.Quantities || []) {
    const name = val(qn.Name);
    const key = ['LengthValue', 'AreaValue', 'VolumeValue', 'CountValue', 'WeightValue', 'TimeValue'].find((k) => qn[k] !== undefined);
    if (!name || !key) continue;
    const unit = { LengthValue: units.length, AreaValue: units.area, VolumeValue: units.volume, WeightValue: 'kg', TimeValue: 's' }[key] || '';
    rows.push([decodeIfcText(String(name)), fmt(val(qn[key])) + (unit ? ' ' + unit : '')]);
  }
  return rows;
}

async function properties(id) {
  const item = await api.properties.getItemProperties(modelID, id, false);
  const ident = [];
  const add = (k, v) => { const s = show(v); if (s) ident.push([k, s]); };
  add('Class', { value: className(api.GetLineType(modelID, id)) });
  add('Name', item.Name);
  add('Room name', item.LongName);
  add('Description', item.Description);
  add('Object type', item.ObjectType);
  add('Tag (Revit Id)', item.Tag);
  add('Predefined type', item.PredefinedType);
  add('Overall width', item.OverallWidth && { ...item.OverallWidth, name: 'IFCLENGTHMEASURE' });
  add('Overall height', item.OverallHeight && { ...item.OverallHeight, name: 'IFCLENGTHMEASURE' });
  add('GlobalId', item.GlobalId);

  const sets = [];
  let typeName = '';
  try {
    const types = await api.properties.getTypeProperties(modelID, id, true);
    for (const t of types) {
      typeName = typeName || show(t.Name);
      for (const s of t.HasPropertySets || []) {
        const rows = rowsOfSet(s);
        if (rows.length) sets.push({ name: `${show(s.Name)} (type)`, rows });
      }
    }
  } catch { /* some exports point at type objects web-ifc cannot read; skip them */ }
  if (typeName) ident.splice(2, 0, ['Type', typeName]);

  const own = await api.properties.getPropertySets(modelID, id, true);
  for (const s of own) {
    const rows = rowsOfSet(s);
    if (rows.length) sets.unshift({ name: show(s.Name) || 'Properties', rows });
  }

  let materials = [];
  try {
    const mats = await api.properties.getMaterialsProperties(modelID, id, true);
    const names = new Set();
    const dig = (m) => {
      if (!m || typeof m !== 'object') return;
      if (m.Name && (m.type === WebIFC.IFCMATERIAL)) names.add(show(m.Name));
      for (const k of ['Material', 'Materials', 'MaterialLayers', 'ForLayerSet', 'MaterialConstituents', 'MaterialProfiles']) {
        const v = m[k];
        if (Array.isArray(v)) v.forEach(dig); else if (v) dig(v);
      }
    };
    mats.forEach(dig);
    materials = [...names].filter(Boolean);
  } catch { /* materials are optional */ }

  return { ident, sets, materials };
}
