/* BIM Viewer - the world both views share: renderer, sky, sun, ground, trees,
   stars and the post-processing chain. One scene and one camera serve the BIM
   view and the walk view, so switching between them never reloads anything. */

import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// what each preset turns on. ratio is the most pixels per CSS pixel it allows
export const QUALITY = {
  low:    { ratio: 1,    shadow: 0,    ao: false, bloom: false, msaa: 0 },
  medium: { ratio: 1.5,  shadow: 2048, ao: false, bloom: false, msaa: 4 },
  high:   { ratio: 2,    shadow: 2048, ao: true,  bloom: true,  msaa: 4 },
  ultra:  { ratio: 2.5,  shadow: 4096, ao: true,  bloom: true,  msaa: 4 },
};

// The r186 sky is physically bright, so the whole scene is exposed for it and
// the lights are scaled to match, the way a camera exposes for daylight.
const EXPOSURE = 0.16;
const SUN = 26;

const tmp = new THREE.Vector3();
const warm = new THREE.Color(0xffa25c);
const noon = new THREE.Color(0xfff3e2);
const moon = new THREE.Color(0x8fa8ff);

export class World {
  constructor(canvas) {
    const renderer = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = EXPOSURE;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.localClippingEnabled = true;

    const scene = this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.05, 6000);
    this.camera.position.set(30, 20, 30);

    // ---- sky and the sun it is lit by ------------------------------------
    this.sky = makeSky(5000);
    scene.add(this.sky);
    this.envSky = makeSky(100);           // a copy for the reflections, which a mesh cannot share
    this.envScene = new THREE.Scene();
    this.envScene.add(this.envSky);
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envTarget = null;
    this.studioEnv = null;

    this.sun = new THREE.DirectionalLight(0xffffff, SUN);
    this.sun.castShadow = true;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.035;
    scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xbfd6ff, 0x6b5a45, 2);
    scene.add(this.hemi);
    this.sunDir = new THREE.Vector3(0.5, 0.8, 0.3).normalize();
    this.night = 0;

    // ---- ground, trees, stars --------------------------------------------
    this.ground = makeGround(renderer);
    scene.add(this.ground);
    this.trees = new THREE.Group();
    scene.add(this.trees);
    this.treeSpots = [];                  // [x, z, radius] for the walk view to bump into
    this.stars = makeStars();
    scene.add(this.stars);

    this.fog = new THREE.Fog(0xcfdcea, 120, 1400);
    scene.fog = this.fog;

    this.settings = { quality: 'high', shadows: true, ao: true, bloom: false, fog: true, clouds: true,
                      trees: true, env: 'sky', time: 15.5 };
    this.composer = null;
    this.size = new THREE.Vector2(1, 1);
    this._envDirty = true;
    this._envTimer = 0;
  }

  // ------------------------------------------------------------- settings
  apply(settings) {
    const prev = this.settings;
    this.settings = { ...prev, ...settings };
    const s = this.settings;
    const q = QUALITY[s.quality] || QUALITY.high;
    this.q = q;
    this.renderer.shadowMap.enabled = s.shadows && q.shadow > 0;
    if (q.shadow && this.sun.shadow.mapSize.x !== q.shadow) {
      this.sun.shadow.mapSize.set(q.shadow, q.shadow);
      if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
    }
    this.sun.castShadow = this.renderer.shadowMap.enabled;
    this.trees.visible = s.trees;
    this.sky.material.uniforms.cloudCoverage.value = s.clouds ? 0.42 : 0;
    this.envSky.material.uniforms.cloudCoverage.value = s.clouds ? 0.42 : 0;
    if (prev.time !== s.time || prev.env !== s.env || prev.clouds !== s.clouds || !this.composer) this.setTime(s.time);
    if (!this.composer || prev.quality !== s.quality || prev.ao !== s.ao || prev.bloom !== s.bloom) this.buildComposer();
    this.resize(this.size.x, this.size.y);
  }

  // hours 0-24: the sun rises in the east at 6, peaks at noon, sets at 18
  setTime(hours) {
    const t = (hours - 6) / 12;                       // 0 at sunrise, 1 at sunset
    const elev = Math.sin(t * Math.PI) * 68;          // degrees above the horizon
    const az = 90 - t * 180;                          // east, through south at noon, to west
    const phi = THREE.MathUtils.degToRad(90 - elev);
    const theta = THREE.MathUtils.degToRad(az);
    this.sunDir.setFromSphericalCoords(1, phi, theta);
    const day = THREE.MathUtils.smoothstep(elev, -4, 14);       // 0 at night, 1 in daylight
    const low = 1 - THREE.MathUtils.smoothstep(elev, 4, 32);    // 1 near the horizon
    this.night = 1 - day;

    const studio = this.settings.env === 'studio';
    for (const sky of [this.sky, this.envSky]) sky.material.uniforms.sunPosition.value.copy(this.sunDir);
    this.sky.visible = !studio;
    if (studio) {
      this.scene.background = new THREE.Color(0x30343a);
      this.fog.color.set(0x30343a);
      this.sun.color.copy(noon);
      this.sun.intensity = SUN * 0.8;
      this.hemi.intensity = 1.4;
      this.stars.visible = false;
      this.renderer.toneMappingExposure = EXPOSURE * 4;
      this.sunDir.setFromSphericalCoords(1, THREE.MathUtils.degToRad(40), THREE.MathUtils.degToRad(135));
    } else {
      this.scene.background = null;
      // the moon takes over from the sun after dark, from the opposite side
      if (day < 0.02) this.sunDir.set(-this.sunDir.x, Math.max(0.35, -this.sunDir.y), -this.sunDir.z).normalize();
      this.sun.color.copy(noon).lerp(warm, low * 0.85);
      if (day < 0.02) this.sun.color.copy(moon);
      this.sun.intensity = day > 0.02 ? SUN * (0.25 + 0.75 * day) : SUN * 0.06;
      this.hemi.intensity = 0.6 + 1.65 * day;
      this.hemi.color.set(day > 0.02 ? 0xbfd6ff : 0x4a5a8a);
      this.fog.color.set(day > 0.02 ? 0xcfdcea : 0x0b1020).lerp(new THREE.Color(0xe8b48c), low * day * 0.6);
      this.stars.visible = this.night > 0.4;
      this.stars.material.opacity = THREE.MathUtils.smoothstep(this.night, 0.4, 1);
      // after dark the eye adapts; open up so the moonlit scene still reads
      this.renderer.toneMappingExposure = EXPOSURE * (1 + this.night * 7);
    }
    this._envDirty = true;
  }

  // the sky reflected in glass and metal follows the sun; rebuilt at most a few times a second
  updateEnvironment(force) {
    if (!this._envDirty && !force) return;
    this._envDirty = false;
    if (this.settings.env === 'studio') {
      if (!this.studioEnv) this.studioEnv = this.pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      this.scene.environment = this.studioEnv;
      this.scene.environmentIntensity = 0.9;
      return;
    }
    this.envSky.material.uniforms.showSunDisc.value = 0;
    const next = this.pmrem.fromScene(this.envScene, 0, 0.1, 1000);
    this.envSky.material.uniforms.showSunDisc.value = 1;
    if (this.envTarget) this.envTarget.dispose();
    this.envTarget = next;
    this.scene.environment = next.texture;
    this.scene.environmentIntensity = 0.75;
  }

  // ------------------------------------------------------------- the model
  // ground level, fog distance and trees follow the model's size
  fitModel(box, groundY) {
    const size = box.getSize(tmp);
    const span = Math.max(size.x, size.z, 20);
    this.ground.position.y = groundY - 0.015;
    this.fog.near = Math.max(90, span * 4);
    this.fog.far = this.fog.near + 1300;
    this.plantTrees(box, groundY);
  }

  plantTrees(box, groundY) {
    for (const c of [...this.trees.children]) { c.geometry.dispose(); this.trees.remove(c); }
    this.treeSpots = [];
    const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2;
    const rx = (box.max.x - box.min.x) / 2 + 14, rz = (box.max.z - box.min.z) / 2 + 14;
    const count = 46;
    const trunkGeo = new THREE.CylinderGeometry(0.12, 0.2, 1, 7).translate(0, 0.5, 0);
    const crownGeo = new THREE.IcosahedronGeometry(1, 1);
    const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: 0x5b4030, roughness: 1 }), count);
    const crowns = new THREE.InstancedMesh(crownGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true }), count);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    const col = new THREE.Color();
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < count; i++) {
      // a loose ring round the model, never on top of it
      let a = (i / count) * Math.PI * 2 + rnd() * 0.25;
      // keep the view of the south face clear: that is where you arrive
      if (Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2))) < 0.42) a += Math.PI;
      const r = 1 + rnd() * 2.2;
      const x = cx + Math.cos(a) * rx * r, z = cz + Math.sin(a) * rz * r;
      const h = 2.6 + rnd() * 2.8;
      m.compose(p.set(x, groundY, z), q.identity(), s.set(1, h, 1));
      trunks.setMatrixAt(i, m);
      const cr = 1.3 + rnd() * 1.2;
      q.setFromAxisAngle(tmp.set(0, 1, 0), rnd() * 6.28);
      m.compose(p.set(x, groundY + h + cr * 0.55, z), q, s.set(cr, cr * (1.05 + rnd() * 0.5), cr));
      crowns.setMatrixAt(i, m);
      crowns.setColorAt(i, col.setHSL(0.24 + rnd() * 0.08, 0.45 + rnd() * 0.2, 0.26 + rnd() * 0.1));
      this.treeSpots.push([x, z, 0.35]);
    }
    for (const t of [trunks, crowns]) { t.castShadow = true; t.receiveShadow = true; t.computeBoundingSphere(); }
    this.trees.add(trunks, crowns);
  }

  // shadows cover a box round `center`; snapped to the shadow map's texels so they do not shimmer
  fitShadow(center, radius) {
    const cam = this.sun.shadow.camera;
    const r = Math.max(4, radius);
    cam.left = -r; cam.right = r; cam.top = r; cam.bottom = -r;
    cam.near = 0.5; cam.far = r * 6;
    cam.updateProjectionMatrix();
    const texel = (2 * r) / (this.sun.shadow.mapSize.x || 2048);
    const c = tmp.copy(center);
    c.x = Math.round(c.x / texel) * texel;
    c.z = Math.round(c.z / texel) * texel;
    this.sun.target.position.copy(c);
    this.sun.position.copy(c).addScaledVector(this.sunDir, r * 3);
    this.sun.target.updateMatrixWorld();
  }

  // ----------------------------------------------------------- rendering
  buildComposer() {
    if (this.composer) {
      for (const pass of this.composer.passes) if (pass.dispose) pass.dispose();
      this.composer.dispose();
    }
    const q = this.q || QUALITY.high;
    const s = this.settings;
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: q.msaa });
    const composer = new EffectComposer(this.renderer, rt);
    composer.addPass(new RenderPass(this.scene, this.camera));
    this.gtao = null;
    this.bloom = null;
    if (q.ao && s.ao) {
      const ao = new GTAOPass(this.scene, this.camera, 2, 2);
      ao.blendIntensity = 0.85;
      ao.updateGtaoMaterial({ radius: 0.7, distanceExponent: 1.4, thickness: 1.2, scale: 1, samples: 16 });
      ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
      composer.addPass(ao);
      this.gtao = ao;
    }
    if (q.bloom && s.bloom) {
      this.bloom = new UnrealBloomPass(new THREE.Vector2(2, 2), 0.1, 0.35, 25);
      composer.addPass(this.bloom);
    }
    composer.addPass(new OutputPass());
    this.composer = composer;
  }

  // the section planes clip the AO pass's own normal render too, or cut-away walls would still cast AO
  setClipping(planes) {
    if (this.gtao) this.gtao.normalMaterial.clippingPlanes = planes.length ? planes : null;
  }

  resize(w, h) {
    if (!w || !h) return;
    this.size.set(w, h);
    const ratio = Math.min(window.devicePixelRatio || 1, (this.q || QUALITY.high).ratio);
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.composer) { this.composer.setPixelRatio(ratio); this.composer.setSize(w, h); }
  }

  render(dt, elapsed) {
    this.sky.material.uniforms.time.value = elapsed;
    // bloom works on the scene before exposure, so its threshold follows it:
    // only the sun's glint and the brightest sky glow, never a white wall
    if (this.bloom) this.bloom.threshold = 4 / this.renderer.toneMappingExposure;
    this._envTimer += dt;
    if (this._envDirty && this._envTimer > 0.25) { this._envTimer = 0; this.updateEnvironment(); }
    this.composer.render(dt);
  }
}

function makeSky(scale) {
  const sky = new Sky();
  sky.scale.setScalar(scale);
  const u = sky.material.uniforms;
  u.turbidity.value = 6;
  u.rayleigh.value = 1.6;
  u.mieCoefficient.value = 0.004;
  u.mieDirectionalG.value = 0.82;
  u.cloudCoverage.value = 0.42;
  u.cloudDensity.value = 0.45;
  u.cloudElevation.value = 0.55;
  return sky;
}

// grass drawn once on a canvas: soft noise in a few greens, tiled across the ground
function makeGround(renderer) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#5f7d3c';
  g.fillRect(0, 0, 256, 256);
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 2600; i++) {
    const x = rnd() * 256, y = rnd() * 256, r = 0.6 + rnd() * 2.2;
    const l = 26 + rnd() * 16;
    g.fillStyle = `hsla(${84 + rnd() * 20}, ${32 + rnd() * 18}%, ${l}%, ${0.35 + rnd() * 0.4})`;
    g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(900, 900);
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(3600, 3600).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, metalness: 0 }));
  mesh.receiveShadow = true;
  mesh.name = 'ground';
  return mesh;
}

function makeStars() {
  const n = 1800;
  const pos = new Float32Array(n * 3);
  let seed = 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < n; i++) {
    const u = rnd(), v = rnd() * 0.92;
    const th = u * Math.PI * 2, ph = Math.acos(1 - v);   // upper sky only
    pos.set([Math.sin(ph) * Math.cos(th) * 2000, Math.cos(ph) * 2000, Math.sin(ph) * Math.sin(th) * 2000], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false,
    transparent: true, opacity: 0, depthWrite: false, fog: false }));
  pts.visible = false;
  pts.frustumCulled = false;
  return pts;
}
