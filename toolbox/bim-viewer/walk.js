/* BIM Viewer - the walk view. A character you steer through the model like
   a game: third or first person, walk, run, jump, wave and dance, with the
   building's own walls, floors and stairs to bump into. Collision is a capsule
   against an octree of the model's triangles, the method three.js uses in its
   FPS example. Doors and rooms are left out so you can walk through doorways. */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Capsule } from 'three/addons/math/Capsule.js';
import { retargetClip } from 'three/addons/utils/SkeletonUtils.js';

const RADIUS = 0.3;
const GRAVITY = 24;
const JUMP = 7.2;
const STEP = 0.36;            // tallest riser or kerb the robot walks up without jumping
const TELEPORT_RANGE = 60;    // metres
const AIM_OK = new THREE.Color(0x39d0ff), AIM_BAD = new THREE.Color(0xff5050);
const SPEED = { walk: 2.3, run: 5.6 };
const EMOTE_KEYS = { 1: 'Wave', 2: 'Dance', 3: 'ThumbsUp', 4: 'Yes', 5: 'No', 6: 'Punch' };
const FACE = { No: 'Sad', Punch: 'Angry', Jump: 'Surprised' };
const THREE_MODELS = 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r186/examples/models/gltf/';

// Who you can play as. The robot is CC0 and served from this site. The soldier
// and X Bot are Adobe Mixamo characters from the three.js examples: Mixamo lets
// them be used in a project like this but not re-shared as files, so they are
// loaded from three.js's own copy on jsDelivr, pinned to r186 with a SHA-384
// fingerprint, and never stored in this repository.
export const CHARACTERS = {
  robot: {
    name: 'Robot', url: new URL('robot.glb', import.meta.url).href, height: 1.62, turn: 0,
    clips: { idle: 'Idle', walk: 'Walking', run: 'Running', jump: 'Jump' },
    emotes: { Wave: 'Wave', Dance: 'Dance', ThumbsUp: 'ThumbsUp', Yes: 'Yes', No: 'No', Punch: 'Punch' },
  },
  soldier: {
    name: 'Soldier', url: THREE_MODELS + 'Soldier.glb', height: 1.8, turn: Math.PI,
    integrity: 'sha384-Y2macG59QjKjnP3v5CqYfrkBo4zyzOYlX+ifmJUeuL59LU47Gw16IY3rOscQG1i+',
    clips: { idle: 'Idle', walk: 'Walk', run: 'Run' },
  },
  xbot: {
    name: 'X Bot', url: THREE_MODELS + 'Xbot.glb', height: 1.8, turn: 0,
    integrity: 'sha384-kOkReSPjTiovmkL/eXerDILZPs35SVd7LbTVhffcQ5gm+fpyBqFYV/f1QYlr9GgB',
    clips: { idle: 'idle', walk: 'walk', run: 'run' },
    additive: { Yes: 'agree', No: 'headShake' },     // layered over whatever it is doing
  },
  // Michelle comes with a dance and nothing else, so she borrows X Bot's
  // idle, walk and run: both are Mixamo rigs, and retargeting copies the
  // moves bone by bone, the way three.js's retargeting example does
  michelle: {
    name: 'Michelle', url: THREE_MODELS + 'Michelle.glb', height: 1.7, turn: 0,
    integrity: 'sha384-MFuf7YYakJ9ipl3IDTmfNtuwyS8RgJOxi/PNEv2/trVAIlxjqlMHsayuHlGkf4LF',
    borrow: 'xbot', clips: { idle: 'idle', walk: 'walk', run: 'run' },
    emotes: { Dance: 'SambaDance' },
  },
};

const up = new THREE.Vector3(0, 1, 0);
const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3();
const stepDir = new THREE.Vector3(), stepMove = new THREE.Vector3();
const ray = new THREE.Ray();
const aimDir = new THREE.Vector3(), aimNormal = new THREE.Vector3(), aimTmp = new THREE.Vector3();
const roomCheck = new Capsule(new THREE.Vector3(), new THREE.Vector3(), RADIUS);

export class Walk {
  constructor(world, canvas, hooks) {
    this.world = world;
    this.canvas = canvas;
    this.hooks = hooks;               // { onPause, onLook, onLevel, onCamera, onMinimap, onInspect, onCycle, onAim, onHud }
    this.active = false;
    this.ready = false;
    this.paused = false;              // the pause card is up: nothing moves
    this.model = null;
    this.octree = null;
    this.firstPerson = false;
    this.yaw = Math.PI;
    this.pitch = -0.12;
    this.distance = 4.6;
    this.sensitivity = 1;
    this.invertY = false;
    this.speedScale = 1;
    this.run = false;
    this.keys = new Set();
    this.stick = new THREE.Vector2();
    this.velocity = new THREE.Vector3();
    this.onFloor = false;
    this.airTime = 0;
    this.height = CHARACTERS.robot.height;
    this.collider = new Capsule(new THREE.Vector3(0, RADIUS, 0), new THREE.Vector3(0, this.height - RADIUS, 0), RADIUS);
    this.cache = {};                  // character key -> promise of a loaded character
    this.char = null;

    // the rig is what moves; the chosen character rides in it
    this.robot = new THREE.Group();
    this.robot.visible = false;
    world.scene.add(this.robot);
    // a torch for after dark; it rides on the chest and looks where the character looks
    const torch = new THREE.SpotLight(0xfff1d6, 0, 26, 0.55, 0.45, 1.6);
    torch.position.set(0, 1.25, 0.15);
    torch.target.position.set(0, 0.9, 4);
    this.robot.add(torch, torch.target);
    this.torch = torch;
    this.flashlight = false;
    this.autoLight = true;
    this.minimap = true;
    this.lookTimer = 0;
    this.lookId = null;
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = 9;
    this._camPos = new THREE.Vector3();
    this._spawnKey = null;

    // minimap: looks straight down from just above the robot's head, so
    // everything higher - the ceiling, the floors above - is cut away like a plan
    this.miniCam = new THREE.OrthographicCamera(-14, 14, 14, -14, 0.05, 400);
    this.miniCam.up.set(0, 0, -1);
    this.miniCam.layers.enable(1);
    const arrow = new THREE.Mesh(
      new THREE.ConeGeometry(0.55, 1.4, 3).rotateX(Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, fog: false }));
    arrow.layers.set(1);
    arrow.renderOrder = 10;
    this.marker = arrow;
    world.scene.add(arrow);

    this.aiming = false;
    this.aim = { point: new THREE.Vector3(), valid: false, dist: 0 };
    this.aimRaycaster = new THREE.Raycaster();
    this.aimRaycaster.far = TELEPORT_RANGE;
    this.poofs = [];
    this._buildTeleportFx(world.scene);

    this._bindInput();
  }

  // ------------------------------------------------------------ teleport
  // Hold T: a glowing pad shows where you would land, with a dotted arc to
  // it. Let go: you are there. On a phone the Teleport button does the same
  // in two taps. You can only land on something you could stand on.
  _buildTeleportFx(scene) {
    // the ring and disc are painted, so they read even on a white wall; the beam glows
    const glow = (opacity, additive) => new THREE.MeshBasicMaterial({ color: AIM_OK, transparent: true, opacity, depthWrite: false,
      side: THREE.DoubleSide, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, fog: false });
    const fade = document.createElement('canvas');
    fade.width = 1; fade.height = 64;
    const g = fade.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, 64);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(1, 'rgba(255,255,255,1)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 1, 64);
    const beamMat = glow(0.65, true);
    beamMat.alphaMap = new THREE.CanvasTexture(fade);     // bright at the floor, gone at the top
    const pad = new THREE.Group();
    pad.add(
      new THREE.Mesh(new THREE.RingGeometry(0.42, 0.56, 48).rotateX(-Math.PI / 2), glow(0.95)),
      new THREE.Mesh(new THREE.CircleGeometry(0.42, 40).rotateX(-Math.PI / 2), glow(0.3)),
      new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 2.4, 32, 1, true).translate(0, 1.2, 0), beamMat),
    );
    pad.children.forEach((m) => { m.renderOrder = 8; });
    pad.visible = false;
    this.pad = pad;

    const dots = new Float32Array(26 * 3);
    const arcGeo = new THREE.BufferGeometry();
    arcGeo.setAttribute('position', new THREE.BufferAttribute(dots, 3));
    const dot = document.createElement('canvas');
    dot.width = dot.height = 32;
    const d = dot.getContext('2d');
    const r = d.createRadialGradient(16, 16, 0, 16, 16, 16);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(0.55, 'rgba(255,255,255,1)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    d.fillStyle = r;
    d.fillRect(0, 0, 32, 32);
    this.arc = new THREE.Points(arcGeo, new THREE.PointsMaterial({ color: AIM_OK, size: 9, sizeAttenuation: false,
      map: new THREE.CanvasTexture(dot), transparent: true, opacity: 0.95, depthWrite: false, fog: false }));
    this.arc.frustumCulled = false;
    this.arc.visible = false;
    this.arc.renderOrder = 8;
    this.poofGeo = new THREE.RingGeometry(0.3, 0.42, 48).rotateX(-Math.PI / 2);
    scene.add(pad, this.arc);
  }

  startAim() {
    if (!this.active || !this.ready || this.paused) return;
    this.aiming = true;
    this.aim.valid = false;
    this._aimKey = '';
    this._aimTeleport();
  }

  // go: true to jump to the target, false to put the pad away
  endAim(go) {
    if (!this.aiming) return false;
    this.aiming = false;
    this.pad.visible = false;
    this.arc.visible = false;
    let went = false;
    if (go && this.aim.valid) {
      this._poof(this.robot.position);
      const p = this.aim.point;
      this.teleport(p.x, p.y + 0.02, p.z);
      this._poof(p);
      this._face('Surprised', 0.7);
      went = true;
    }
    this.hooks.onAim && this.hooks.onAim(null);
    return went;
  }

  // finds where the line of sight lands, and whether there is room to stand there
  _aimTeleport() {
    // along the crosshair: from the eyes in first person, from the camera,
    // past the character, in third
    const cam = this.world.camera;
    const dir = cam.getWorldDirection(aimDir);
    const rc = this.aimRaycaster;
    let eye;
    if (this.firstPerson) {
      eye = v3.set(this.robot.position.x, this.robot.position.y + this.height * 0.92, this.robot.position.z);
      rc.near = 0.3;
    } else {
      eye = v3.copy(cam.position);
      rc.near = cam.position.distanceTo(this.robot.position) + 0.2;
    }
    rc.set(eye, dir);
    rc.far = rc.near + TELEPORT_RANGE;
    const hit = rc.intersectObjects(this.model.meshes(), false)[0];
    const g = this.model.groundY;
    const tGround = dir.y < -1e-3 ? (g - eye.y) / dir.y : Infinity;
    const p = this.aim.point;
    let valid = false;
    if (hit && hit.distance < tGround) {
      aimNormal.copy(hit.face.normal);
      if (aimNormal.dot(dir) > 0) aimNormal.negate();         // faces drawn from both sides
      if (aimNormal.y > 0.6) { p.copy(hit.point); valid = true; }
      else {
        // a wall: land at its foot, on this side of it
        const back = aimTmp.copy(dir).setY(0).normalize().multiplyScalar(-0.55).add(hit.point);
        const floor = this._floorBelow(back.x, back.z, hit.point.y + 0.05);
        if (floor !== null) { p.set(back.x, floor, back.z); valid = true; } else p.copy(hit.point);
      }
    } else if (tGround >= rc.near && tGround <= rc.far) {
      p.copy(eye).addScaledVector(dir, tGround);
      valid = true;
    } else {
      // pointing at the sky: show where it would fall, but do not go
      p.copy(eye).addScaledVector(dir, 14);
      const floor = this._floorBelow(p.x, p.z, p.y);
      p.y = floor !== null ? floor : g;
    }

    // room to stand: nudge away from a wall that is close, refuse a squeeze
    if (valid && this.octree) {
      roomCheck.start.set(p.x, p.y + RADIUS + 0.04, p.z);
      roomCheck.end.set(p.x, p.y + this.height - RADIUS, p.z);
      const hitRoom = this.octree.capsuleIntersect(roomCheck);
      if (hitRoom) {
        if (hitRoom.normal.y < 0.5 && hitRoom.depth < 0.35) {
          p.x += hitRoom.normal.x * (hitRoom.depth + 0.02);
          p.z += hitRoom.normal.z * (hitRoom.depth + 0.02);
          roomCheck.translate(aimTmp.set(hitRoom.normal.x * (hitRoom.depth + 0.02), 0, hitRoom.normal.z * (hitRoom.depth + 0.02)));
          const again = this.octree.capsuleIntersect(roomCheck);
          if (again && again.depth > 0.05) valid = false;
        } else if (hitRoom.depth > 0.05) valid = false;
      }
    }
    this.aim.valid = valid;
    this.aim.dist = Math.hypot(p.x - this.robot.position.x, p.z - this.robot.position.z);

    const col = valid ? AIM_OK : AIM_BAD;
    this.pad.visible = true;
    this.pad.position.copy(p).setY(p.y + 0.02);
    this.pad.children.forEach((m) => m.material.color.copy(col));
    this.arc.material.color.copy(col);
    // a throw arc from the chest to the pad, higher the further it goes
    const a = this.robot.position, pos = this.arc.geometry.getAttribute('position');
    const h0 = a.y + this.height * 0.6, lift = Math.min(4, 0.6 + this.aim.dist * 0.18);
    for (let i = 0; i < pos.count; i++) {
      const t = i / (pos.count - 1);
      pos.setXYZ(i, a.x + (p.x - a.x) * t, h0 + (p.y + 0.05 - h0) * t + Math.sin(Math.PI * t) * lift, a.z + (p.z - a.z) * t);
    }
    pos.needsUpdate = true;
    this.arc.visible = true;

    const key = `${valid}|${Math.round(this.aim.dist)}`;
    if (key !== this._aimKey) { this._aimKey = key; this.hooks.onAim && this.hooks.onAim({ valid, dist: this.aim.dist }); }
  }

  // the first thing below (x, fromY, z) you could stand on: a floor in the
  // model, or the ground
  _floorBelow(x, z, fromY) {
    let best = fromY >= this.model.groundY ? this.model.groundY : null;
    if (this.octree) {
      ray.origin.set(x, fromY, z);
      ray.direction.set(0, -1, 0);
      const hit = this.octree.rayIntersect(ray);
      if (hit) { const y = fromY - hit.distance; if (best === null || y > best) best = y; }
    }
    return best;
  }

  _poof(at) {
    const m = new THREE.Mesh(this.poofGeo, new THREE.MeshBasicMaterial({ color: AIM_OK, transparent: true, opacity: 1,
      depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false }));
    m.position.copy(at).setY(at.y + 0.04);
    m.renderOrder = 8;
    this.world.scene.add(m);
    this.poofs.push({ m, t: 0 });
  }

  _poofs(dt) {
    for (let i = this.poofs.length - 1; i >= 0; i--) {
      const f = this.poofs[i];
      f.t += dt / 0.5;
      f.m.scale.setScalar(1 + f.t * 4);
      f.m.material.opacity = Math.max(0, 1 - f.t);
      if (f.t >= 1) { this.world.scene.remove(f.m); f.m.material.dispose(); this.poofs.splice(i, 1); }
    }
  }

  // -------------------------------------------------------- characters
  async setCharacter(key) {
    const def = CHARACTERS[key] ? key : 'robot';
    if (!this.cache[def]) this.cache[def] = this._loadCharacter(CHARACTERS[def]);
    let ch;
    try { ch = await this.cache[def]; } catch (err) { delete this.cache[def]; throw err; }
    if (this.char === ch) return ch;
    if (this.char) this.robot.remove(this.char.body);
    this.robot.add(ch.body);
    this.char = ch;
    this.charKey = def;
    this.height = ch.def.height;
    const s = this.collider.start;
    this.collider.end.set(s.x, s.y + this.height - 2 * RADIUS, s.z);
    this.torch.position.y = this.height * 0.77;
    this.torch.target.position.y = this.height * 0.55;
    this.ready = true;
    return ch;
  }

  hasEmote(name) { return !!(this.char && (this.char.emotes[name] || this.char.additive[name])); }

  // a fresh copy each time: a character's scene is moved into the rig, so
  // another character borrowing its moves needs its own untouched one
  async _fetchGltf(def) {
    const loader = new GLTFLoader();
    if (!def.integrity) return loader.loadAsync(def.url);
    const res = await fetch(def.url, { integrity: def.integrity });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return loader.parseAsync(await res.arrayBuffer(), '');
  }

  async _loadCharacter(def) {
    const gltf = await this._fetchGltf(def);
    let animRoot = gltf.scene;
    if (def.borrow) {
      const src = await this._fetchGltf(CHARACTERS[def.borrow]);
      const skin = (root) => { let m = null; root.traverse((o) => { if (!m && o.isSkinnedMesh) m = o; }); return m; };
      const target = skin(gltf.scene), source = skin(src.scene);
      if (!target || !source) throw new Error('no skeleton to copy moves onto');
      // the source is its whole scene, not just its skeleton: retargetClip
      // poses it frame by frame and only a scene updates its bones' matrices
      src.scene.skeleton = source.skeleton;
      // and both sides are their whole scenes, so the moves are copied in the
      // same upright frame, whatever each file does inside it
      gltf.scene.skeleton = target.skeleton;
      gltf.scene.updateMatrixWorld(true);
      src.scene.updateMatrixWorld(true);
      const want = new Set(Object.values(def.clips));
      // same rig, same bone names: each bone copies the one called the same
      // (retargetClip needs the map spelled out, or it copies nothing)
      const names = Object.fromEntries(target.skeleton.bones.map((b) => [b.name, b.name]));
      // The two files point their bones differently, so copying a bone's
      // turn as it is would bend her the wrong way. In the rest pose, each
      // pair of bones differs by a fixed turn; adding it back keeps her own rest
      // pose as the starting point and copies only X Bot's movement.
      // (measured as the files load, in their rest pose: Skeleton.pose() would
      // stack the armature's own turn onto the root bone a second time)
      gltf.scene.updateMatrixWorld(true); src.scene.updateMatrixWorld(true);
      const localOffsets = {};
      const qs = new THREE.Quaternion(), qt = new THREE.Quaternion();
      for (const b of target.skeleton.bones) {
        const sb = source.skeleton.getBoneByName(b.name);
        if (!sb) continue;
        sb.getWorldQuaternion(qs); b.getWorldQuaternion(qt);
        localOffsets[b.name] = new THREE.Matrix4().makeRotationFromQuaternion(qs.invert().multiply(qt));
      }
      for (const clip of src.animations) {
        if (!want.has(clip.name)) continue;
        const c = retargetClip(gltf.scene, src.scene, clip, { hip: 'mixamorigHips', hipInfluence: new THREE.Vector3(0, 1, 0), names, localOffsets });
        c.name = clip.name;
        gltf.animations.push(c);
      }
      // retargeted clips drive the skinned mesh's bones directly
      animRoot = target;
      for (const c of gltf.animations) {
        if (want.has(c.name)) continue;
        // the model's own clips are written against the scene: rename their
        // tracks so they find the same bones from the skinned mesh
        c.tracks.forEach((t) => { const [node, prop] = [t.name.slice(0, t.name.lastIndexOf('.')), t.name.slice(t.name.lastIndexOf('.') + 1)]; t.name = `.bones[${node}].${prop}`; });
      }
    }
    const model = gltf.scene;
    model.rotation.y = def.turn;      // every character faces +Z once in the rig
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model, true);
    const s = def.height / Math.max(0.001, box.max.y - box.min.y);
    model.scale.setScalar(s);
    model.position.y = -box.min.y * s;
    const body = new THREE.Group();
    body.add(model);
    let face = null;
    model.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        o.frustumCulled = false;      // skinned bounds lag behind the animation
        if (o.material) o.material.envMapIntensity = 1.3;
        if (o.morphTargetDictionary && 'Surprised' in o.morphTargetDictionary) face = o;
      }
    });

    const mixer = new THREE.AnimationMixer(def.borrow ? animRoot : model);
    const clips = Object.fromEntries(gltf.animations.map((c) => [c.name, c]));
    const action = (name, once) => {
      if (!clips[name]) return null;
      const a = mixer.clipAction(clips[name]);
      if (once) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
      return a;
    };
    const actions = { idle: action(def.clips.idle), walk: action(def.clips.walk), run: action(def.clips.run),
                      jump: action(def.clips.jump, true) };
    const emotes = {};
    for (const [emote, name] of Object.entries(def.emotes || {})) {
      const a = action(name, emote !== 'Dance');
      if (a) emotes[emote] = a;
    }
    const additive = {};
    for (const [emote, name] of Object.entries(def.additive || {})) {
      if (!clips[name]) continue;
      THREE.AnimationUtils.makeClipAdditive(clips[name]);
      const a = mixer.clipAction(clips[name]);
      a.setLoop(THREE.LoopOnce, 1);
      additive[emote] = a;
    }
    actions.idle.play();
    const ch = { def, body, mixer, actions, emotes, additive, face, current: actions.idle, emote: null };
    mixer.addEventListener('finished', (e) => { if (ch.emote && e.action === ch.emotes[ch.emote]) ch.emote = null; });
    return ch;
  }

  // -------------------------------------------------------- enter / exit
  enter(model) {
    this.model = model;
    this.octree = model.collider();
    const key = model;
    if (this._spawnKey !== key) { this._spawnKey = key; this.spawnOutside(); }
    this.active = true;
    this.paused = false;
    this.robot.visible = !this.firstPerson;
    this.marker.visible = true;
    this.velocity.set(0, 0, 0);
    this.lookId = null;
  }

  // A real pause, like a game: the keys are let go of, the aim is dropped and
  // the world stops stepping, so nothing moves on behind the card.
  setPaused(on) {
    this.paused = !!on;
    if (!on) return;
    this.keys.clear();
    this.stick.set(0, 0);
    this.run = false;
    this.velocity.set(0, 0, 0);
    this._jumpWant = 0;
    this.zoom = false;
    this.freeLook = null;
    this._lookBack = null;
    this.endAim(false);
  }

  exit() {
    this.active = false;
    this.paused = false;
    this.keys.clear();
    this.stick.set(0, 0);
    this.endAim(false);
    this.robot.visible = false;
    this.marker.visible = false;
    this.torch.intensity = 0;
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
  }

  // in front of the model's south face, looking at it
  spawnOutside() {
    const box = this.model.box;
    const x = (box.min.x + box.max.x) / 2;
    const z = box.max.z + Math.min(6, 2 + (box.max.z - box.min.z) * 0.2);
    this.yaw = Math.PI;
    this.pitch = -0.12;
    this.teleport(x, this.model.groundY + 0.05, z);
  }

  spawnOnLevel(i) {
    const s = this.model.storeys[i];
    if (!s) return;
    const box = new THREE.Box3();
    for (const id of s.ids) { const el = this.model.elements.get(id); if (el && el.parts.length) box.union(el.box); }
    if (box.isEmpty()) return;
    const c = box.getCenter(v1);
    this.teleport(c.x, (Number.isFinite(s.floor) ? s.floor : box.min.y) + 0.4, c.z);
  }

  teleport(x, y, z) {
    this.collider.start.set(x, y + RADIUS, z);
    this.collider.end.set(x, y + this.height - RADIUS, z);
    this.velocity.set(0, 0, 0);
    this.robot.position.set(x, y, z);
    this.robot.rotation.y = this.yaw;
  }

  setFirstPerson(on) {
    this.firstPerson = on;
    if (this.active) this.robot.visible = !on;
  }

  // false when this character has no such move
  playEmote(name) {
    const ch = this.char;
    if (!ch) return false;
    if (ch.additive[name]) { ch.additive[name].reset().setEffectiveWeight(1).fadeIn(0.15).play(); return true; }
    const a = ch.emotes[name];
    if (!a) return false;
    ch.emote = name;
    a.reset();
    this._fadeTo(a, 0.2);
    return true;
  }

  // ------------------------------------------------------------ input
  _bindInput() {
    const c = this.canvas;
    const typing = () => /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement && document.activeElement.tagName) &&
                         document.activeElement.type !== 'range' && document.activeElement.type !== 'checkbox';
    const owns = () => this.active && !typing() &&
      (document.pointerLockElement === c || c.closest('.bv').contains(document.activeElement) || document.fullscreenElement);
    window.addEventListener('keydown', (e) => {
      if (!owns() || this.paused) return;      // Esc is the app's, and it is the only key a pause listens to
      const k = e.code;
      // The keys the big PC games share: WASD, Shift sprint, Space jump,
      // E interact, V first/third person, hold Alt to look around, L light,
      // M map, B emotes; F (full screen) belongs to the app. Alt is held back so the browser does not take it.
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft', 'ShiftRight', 'AltLeft', 'AltRight'].includes(k)) e.preventDefault();
      if (e.repeat) return;
      this.keys.add(k);
      if (k === 'Space') this.jump();
      else if (k === 'KeyV') { this.setFirstPerson(!this.firstPerson); this.hooks.onCamera && this.hooks.onCamera(this.firstPerson); }
      else if (k === 'AltLeft' || k === 'AltRight') this.startFreeLook();
      else if (k === 'KeyL') { this.flashlight = !this.flashlight; this.autoLight = false; }
      else if (k === 'KeyM') { this.minimap = !this.minimap; this.hooks.onMinimap && this.hooks.onMinimap(this.minimap); }
      else if (k === 'KeyE') this.hooks.onInspect && this.hooks.onInspect(this.lookId);
      else if (k === 'KeyB') this.hooks.onEmotes && this.hooks.onEmotes();
      else if (k === 'KeyH') this.hooks.onHud && this.hooks.onHud();
      else if (k === 'KeyR') this.spawnOutside();
      else if (k === 'KeyT') this.startAim();
      else if (EMOTE_KEYS[e.key]) this.hooks.onEmote ? this.hooks.onEmote(EMOTE_KEYS[e.key]) : this.playEmote(EMOTE_KEYS[e.key]);
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      if (e.code === 'KeyT' && this.aiming) this.endAim(true);
      if (e.code === 'AltLeft' || e.code === 'AltRight') { e.preventDefault(); this.endFreeLook(); }
    });
    window.addEventListener('blur', () => { this.keys.clear(); this.zoom = false; this.endFreeLook(); });

    // mouse look: pointer lock when the browser allows it, plain drag when not
    let drag = null;
    c.addEventListener('pointerdown', (e) => {
      if (!this.active || this.paused || e.pointerType === 'touch') return;
      if (this.aiming && e.button === 2) { this.endAim(false); return; }      // right-click: never mind
      if (e.button === 2) this.zoom = true;      // hold the right button: closer over the shoulder, like aiming
      if (document.pointerLockElement !== c && c.requestPointerLock) {
        try {
          const p = c.requestPointerLock();
          if (p && p.catch) p.catch(() => {});
        } catch { /* not allowed here; drag to look instead */ }
      }
      drag = { x: e.clientX, y: e.clientY };
    });
    window.addEventListener('pointerup', (e) => { drag = null; if (e.button === 2) this.zoom = false; });
    window.addEventListener('pointermove', (e) => {
      if (!this.active || this.paused || e.pointerType === 'touch') return;
      if (document.pointerLockElement === c) {
        // the first moves after the lock starts can carry the whole jump from
        // where the cursor was, and some browsers send one wild spike now and
        // then: both would flick the camera, so they are dropped
        if (this._settle > 0) { this._settle--; return; }
        if (Math.abs(e.movementX) > 250 || Math.abs(e.movementY) > 250) return;
        this.look(e.movementX, e.movementY);
      }
      else if (drag) { this.look(e.clientX - drag.x, e.clientY - drag.y); drag = { x: e.clientX, y: e.clientY }; }
    });
    c.addEventListener('wheel', (e) => {
      if (!this.active || this.paused || this.firstPerson) return;
      e.preventDefault();
      this.distance = THREE.MathUtils.clamp(this.distance * (1 + Math.sign(e.deltaY) * 0.12), 1.4, 10);
    }, { passive: false });
    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement === c) this._settle = 2;
      if (this.active && document.pointerLockElement !== c) { this.endAim(false); this.hooks.onPause && this.hooks.onPause(); }
    });
    c.addEventListener('contextmenu', (e) => { if (this.active) e.preventDefault(); });
  }

  // Hold Alt to look around without changing where you walk; let go and the
  // view swings back behind you, the way PUBG does it
  startFreeLook() {
    if (this.freeLook) return;
    this.freeLook = { yaw: this.yaw, pitch: this.pitch };
    this._lookBack = null;
  }
  endFreeLook() {
    if (!this.freeLook) return;
    this._lookBack = this.freeLook;
    this.freeLook = null;
  }
  get moveYaw() { return this.freeLook ? this.freeLook.yaw : this.yaw; }

  look(dx, dy) {
    // a real move of the mouse takes over from the swing back; the zero-size
    // moves some browsers send on their own do not
    if (Math.abs(dx) + Math.abs(dy) > 3) this._lookBack = null;
    const s = 0.0023 * this.sensitivity;
    this.yaw -= dx * s;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy * s * (this.invertY ? -1 : 1), -1.25, 1.2);
  }

  // A press counts for a short while, the way games do it: pressed just
  // before landing it jumps on landing, and just after stepping off a stair
  // or a kerb it still jumps. Without this, walking over anything uneven
  // swallows the press, because the feet leave the floor for a frame.
  jump() {
    if (!this.active) return;
    this._jumpWant = 0.18;
  }

  _doJump() {
    this._jumpWant = 0;
    this._coyote = 0;
    this.velocity.y = JUMP;
    this.onFloor = false;
    this.airTime = 0.2;
    const ch = this.char;
    if (ch && ch.actions.jump) { ch.emote = null; ch.actions.jump.reset(); this._fadeTo(ch.actions.jump, 0.12); }
    this._face('Surprised', 0.8);
  }

  // ---------------------------------------------------------- per frame
  update(dt) {
    if (!this.active || !this.ready) return;
    // paused: the camera still eases into place, the world does not move
    if (this.paused) { this._camera(Math.min(dt, 0.05)); return; }
    dt = Math.min(dt, 0.05);
    const steps = 4;
    for (let i = 0; i < steps; i++) this._step(dt / steps);
    this._animate(dt);
    this._camera(dt);
    this._lights(dt);
    this._lookAt(dt);
    if (this.aiming) this._aimTeleport();
    if (this.poofs.length) this._poofs(dt);
  }

  _input() {
    const k = this.keys;
    let f = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    let r = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    f += -this.stick.y; r += this.stick.x;
    const len = Math.hypot(f, r);
    if (len > 1) { f /= len; r /= len; }
    const running = this.run || k.has('ShiftLeft') || k.has('ShiftRight') || Math.hypot(this.stick.x, this.stick.y) > 0.92;
    return { f, r, running, amount: Math.min(1, len) };
  }

  _step(dt) {
    const { f, r, running, amount } = this._input();
    const fwd = v1.set(Math.sin(this.moveYaw), 0, Math.cos(this.moveYaw));
    const right = v2.set(-fwd.z, 0, fwd.x);
    const want = v3.set(0, 0, 0).addScaledVector(fwd, f).addScaledVector(right, r);
    if (want.lengthSq() > 1) want.normalize();
    const speed = (running ? SPEED.run : SPEED.walk) * this.speedScale;
    want.multiplyScalar(speed * (amount > 0 ? 1 : 0));

    // snappy on the ground, a little steering in the air
    const grip = 1 - Math.exp(-(this.onFloor ? 14 : 2.5) * dt);
    this.velocity.x += (want.x - this.velocity.x) * grip;
    this.velocity.z += (want.z - this.velocity.z) * grip;
    if (this.onFloor && this.velocity.y <= 0) this.velocity.y = -2;   // stay stuck to stairs going down
    else this.velocity.y -= GRAVITY * dt;

    if (this._jumpWant > 0) {
      if (this.onFloor || this._coyote > 0) this._doJump();
      else this._jumpWant -= dt;
    }
    this.collider.translate(v1.copy(this.velocity).multiplyScalar(dt));
    this._collide();
    this._coyote = this.onFloor ? 0.14 : Math.max(0, (this._coyote || 0) - dt);
    if (this._blocked && this.onFloor && amount > 0) this._stepUp(want);
    if (!this.onFloor) this.airTime += dt; else this.airTime = 0;

    // fell out of the world: back to the start
    if (this.collider.start.y < this.model.groundY - 40) this.spawnOutside();
  }

  _collide() {
    this.onFloor = false;
    this._blocked = false;
    if (this.octree) {
      for (let pass = 0; pass < 2; pass++) {
        const hit = this.octree.capsuleIntersect(this.collider);
        if (!hit) break;
        if (hit.normal.y < 0.75) this._blocked = true;
        if (hit.normal.y > 0.3) this.onFloor = true;
        else this.velocity.addScaledVector(hit.normal, -hit.normal.dot(this.velocity));
        if (hit.depth >= 1e-10) this.collider.translate(hit.normal.multiplyScalar(hit.depth));
      }
    }
    // the ground is a plane, not triangles in the octree, so it costs nothing
    const g = this.model.groundY;
    const bottom = this.collider.start.y - RADIUS;
    if (bottom < g) {
      this.collider.translate(v1.set(0, g - bottom, 0));
      this.onFloor = true;
      if (this.velocity.y < 0) this.velocity.y = 0;
    }
    // tree trunks
    if (this.world.trees.visible) {
      for (const [x, z, r] of this.world.treeSpots) {
        const dx = this.collider.start.x - x, dz = this.collider.start.z - z;
        const d = Math.hypot(dx, dz), min = r + RADIUS;
        if (d < min && d > 1e-4) this.collider.translate(v1.set(dx / d * (min - d), 0, dz / d * (min - d)));
      }
    }
  }

  // a capsule alone slides off the edge of a stair; look just ahead of the
  // feet for a tread no higher than STEP and lift the robot onto it
  _stepUp(want) {
    const dir = stepDir.copy(want).setY(0);
    if (dir.lengthSq() < 1e-6 || !this.octree) return;
    dir.normalize();
    const c = this.collider;
    const feet = c.start.y - RADIUS;
    const reach = RADIUS + 0.06;
    ray.origin.set(c.start.x + dir.x * reach, feet + STEP + 0.05, c.start.z + dir.z * reach);
    ray.direction.set(0, -1, 0);
    const hit = this.octree.rayIntersect(ray);
    if (!hit) return;
    const rise = ray.origin.y - hit.distance - feet;
    if (rise < 0.02 || rise > STEP) return;
    c.translate(stepMove.set(dir.x * 0.04, rise + 0.01, dir.z * 0.04));
    const head = this.octree.capsuleIntersect(c);
    if (head && head.normal.y < 0.3) c.translate(stepMove.negate());     // no headroom there: stay put
    if (this.velocity.y < 0) this.velocity.y = 0;
  }

  _animate(dt) {
    const body = this.robot;
    body.position.set(this.collider.start.x, this.collider.start.y - RADIUS, this.collider.start.z);
    const hs = Math.hypot(this.velocity.x, this.velocity.z);
    if (hs > 0.15) {
      // face where we are going (or where the camera looks, in first person)
      const target = this.firstPerson ? this.moveYaw : Math.atan2(this.velocity.x, this.velocity.z);
      let d = target - body.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      body.rotation.y += d * (1 - Math.exp(-12 * dt));
    } else if (this.firstPerson) body.rotation.y = this.moveYaw;

    const ch = this.char, A = ch.actions;
    let next;
    // stairs leave the ground for a moment at every tread; only a real jump or fall plays Jump
    if (!this.onFloor && A.jump && (this.airTime > 0.3 || this.velocity.y > 2)) next = A.jump;
    else if (hs > 0.25) { ch.emote = null; next = hs > (SPEED.walk * this.speedScale + 0.6) ? A.run : A.walk; }
    else next = ch.emote ? ch.emotes[ch.emote] : A.idle;
    if (next && next !== ch.current) this._fadeTo(next, next === A.jump ? 0.12 : 0.25);
    if (ch.current === A.walk) ch.current.timeScale = THREE.MathUtils.clamp(hs / (SPEED.walk * this.speedScale), 0.6, 1.5);
    if (ch.current === A.run) ch.current.timeScale = THREE.MathUtils.clamp(hs / (SPEED.run * this.speedScale), 0.7, 1.3);
    ch.mixer.update(dt);

    if (ch.face) {
      const inf = ch.face.morphTargetInfluences, dict = ch.face.morphTargetDictionary;
      const want = ch.emote && FACE[ch.emote];
      for (const name of ['Angry', 'Surprised', 'Sad']) {
        const goal = (want === name ? 0.75 : 0) + (this._faceName === name ? this._faceAmt : 0);
        inf[dict[name]] += (Math.min(1, goal) - inf[dict[name]]) * (1 - Math.exp(-8 * dt));
      }
      this._faceAmt = Math.max(0, (this._faceAmt || 0) - dt * 1.2);
    }
  }

  _fadeTo(action, t) {
    const ch = this.char;
    if (ch.current === action) return;
    action.enabled = true;
    if (action.loop === THREE.LoopOnce) action.reset();
    action.setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(t).play();
    if (ch.current) ch.current.fadeOut(t);
    ch.current = action;
  }

  _face(name, amt) { this._faceName = name; this._faceAmt = amt; }

  _camera(dt) {
    const cam = this.world.camera;
    // the view swinging back after a free look
    if (this._lookBack) {
      const b = this._lookBack, k = 1 - Math.exp(-12 * dt);
      let d = b.yaw - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      this.yaw += d * k;
      this.pitch += (b.pitch - this.pitch) * k;
      if (Math.abs(d) < 0.002 && Math.abs(b.pitch - this.pitch) < 0.002) this._lookBack = null;
    }
    // right button held: a narrower view, like aiming down sights
    const fovGoal = (this.baseFov || cam.fov) * (this.zoom ? 0.7 : 1);
    if (this.baseFov && Math.abs(cam.fov - fovGoal) > 0.05) {
      cam.fov += (fovGoal - cam.fov) * (1 - Math.exp(-14 * dt));
      cam.updateProjectionMatrix();
    }
    // The third-person camera follows height a little behind, the way game
    // cameras do, so a jump lifts the character on screen instead of the whole
    // world dropping with it. A teleport or a fall snaps it straight there.
    const ry = this.robot.position.y;
    if (this._camY === undefined || Math.abs(ry - this._camY) > 2.5) this._camY = ry;
    else this._camY += (ry - this._camY) * (1 - Math.exp(-5 * dt));
    const head = v1.set(this.robot.position.x, (this.firstPerson ? ry : this._camY) + this.height * 0.92, this.robot.position.z);
    const fwd = v2.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    if (this.firstPerson) {
      cam.position.copy(head).addScaledVector(fwd, 0.12);
      v3.copy(fwd).multiplyScalar(Math.cos(this.pitch)).addScaledVector(up, Math.sin(this.pitch));
      cam.lookAt(v3.add(cam.position));
      return;
    }
    // aiming a teleport swings the camera over the right shoulder, so the
    // pad at the crosshair is never hidden behind the character
    // The camera rides over the right shoulder, as in Fortnite or PUBG, so
    // the crosshair in the middle is never hidden behind the character;
    // aiming a teleport or holding the right button moves it closer in.
    const close = this.aiming || this.zoom;
    this._shoulder = (this._shoulder ?? 0.7) + ((close ? 0.85 : 0.7) - (this._shoulder ?? 0.7)) * (1 - Math.exp(-10 * dt));
    head.addScaledVector(v3.set(-fwd.z, 0, fwd.x), this._shoulder);
    head.y += this._shoulder * 0.35;
    // a spring arm behind the shoulder, pulled in when a wall is in the way
    const elev = THREE.MathUtils.clamp(-this.pitch + 0.18, -0.35, 1.25);
    const dir = v3.copy(fwd).multiplyScalar(-Math.cos(elev)).addScaledVector(up, Math.sin(elev)).normalize();
    // a tall, narrow phone screen sees less to the sides: stand further back
    let dist = this.distance * THREE.MathUtils.clamp(0.9 / cam.aspect, 1, 1.5) * (this.zoom ? 0.5 : 1);
    if (this.octree) {
      ray.set(head, dir);
      const hit = this.octree.rayIntersect(ray);
      if (hit && hit.distance < dist + 0.3) dist = Math.max(0.6, hit.distance - 0.3);
    }
    const goal = this._camPos.copy(head).addScaledVector(dir, dist);
    goal.y = Math.max(goal.y, this.model.groundY + 0.25);
    // ease out, but snap in, so walls never come between camera and robot
    const near = cam.position.distanceTo(head) > dist + 0.05;
    cam.position.lerp(goal, near ? 1 : 1 - Math.exp(-10 * dt));
    cam.lookAt(head.x, head.y + 0.35, head.z);
  }

  _lights() {
    const on = this.flashlight || (this.autoLight && this.world.night > 0.6);
    this.torch.intensity = on ? 60 : 0;
    // keep the sharpest shadows where the robot is
    this.world.fitShadow(this.robot.position, 24);
    this.marker.position.set(this.robot.position.x, this.robot.position.y + this.height + 0.3, this.robot.position.z);
    this.marker.rotation.y = this.robot.rotation.y;
  }

  // what the camera is pointing at, for "press E to inspect"
  _lookAt(dt) {
    this.lookTimer -= dt;
    if (this.lookTimer > 0) return;
    this.lookTimer = 0.15;
    // along the crosshair: from the eyes in first person, from the camera,
    // past the character, in third, so the prompt names what is under it
    const cam = this.world.camera;
    if (this.firstPerson) {
      this.raycaster.set(v1.set(this.robot.position.x, this.robot.position.y + this.height * 0.92, this.robot.position.z), cam.getWorldDirection(v2));
      this.raycaster.near = 0;
      this.raycaster.far = 9;
    } else {
      const past = cam.position.distanceTo(this.robot.position);
      this.raycaster.set(cam.position, cam.getWorldDirection(v2));
      this.raycaster.near = Math.max(0, past - 0.6);
      this.raycaster.far = past + 9;
    }
    const hit = this.raycaster.intersectObjects(this.model.meshes(), false)[0];
    const id = hit ? this.model.idAt(hit) : null;
    if (id !== this.lookId) { this.lookId = id; this.hooks.onLook && this.hooks.onLook(id); }

    // which level are we on; outside the building's footprint is just outside
    const p = this.robot.position, box = this.model.box;
    const inside = p.x > box.min.x && p.x < box.max.x && p.z > box.min.z && p.z < box.max.z;
    let level = -1;
    if (inside) this.model.storeys.forEach((s, i) => { if (Number.isFinite(s.floor) && p.y + 0.2 >= s.floor - 0.05) level = i; });
    if (level !== this.level) { this.level = level; this.hooks.onLevel && this.hooks.onLevel(level); }
  }

  // drawn after the main frame, into a square in the top-right corner
  renderMinimap(rect) {
    if (!this.active || !this.minimap || !rect) return;
    const w = this.world, r = w.renderer, scene = w.scene;
    const p = this.robot.position;
    this.miniCam.position.set(p.x, p.y + 2.1, p.z);
    this.miniCam.lookAt(p.x, p.y - 50, p.z);
    const keep = { bg: scene.background, fog: scene.fog, sky: w.sky.visible, stars: w.stars.visible, shadows: r.shadowMap.autoUpdate };
    scene.background = MINIMAP_BG;
    scene.fog = null;
    w.sky.visible = false;
    w.stars.visible = false;
    r.shadowMap.autoUpdate = false;
    r.setScissorTest(true);
    r.setScissor(rect.x, rect.y, rect.w, rect.h);
    r.setViewport(rect.x, rect.y, rect.w, rect.h);
    r.render(scene, this.miniCam);
    r.setScissorTest(false);
    r.setViewport(0, 0, w.size.x, w.size.y);
    scene.background = keep.bg;
    scene.fog = keep.fog;
    w.sky.visible = keep.sky;
    w.stars.visible = keep.stars;
    r.shadowMap.autoUpdate = keep.shadows;
  }
}

const MINIMAP_BG = new THREE.Color(0x0e131b);
