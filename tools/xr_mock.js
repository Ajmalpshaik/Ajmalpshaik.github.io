/**
 * A scripted stand-in for an Android phone's WebXR AR, for tools/check_browser.mjs.
 *
 * Desktop Chromium has no AR, so the AR Viewer's Android path could never run in
 * a check. This replaces navigator.xr before the page loads with a fake session
 * that three.js can draw into. It tracks nothing: the check sets where the phone
 * is and where the floor is through window.__xr, and the session reports exactly
 * that. It proves the page starts, places, moves and ends a session without an
 * error, and puts the preview back after. How AR looks and holds still can only
 * be judged on a real phone.
 *
 * The idea comes from BIM2AR's tests (github.com/isaddiq/BIM2AR, MIT licence).
 */
(() => {
  const ident = () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  // column-major 4x4 from a position and a quaternion
  const matrix = (p, q) => {
    const { x, y, z, w } = q;
    const x2 = x + x, y2 = y + y, z2 = z + z;
    const xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2;
    const wx = w * x2, wy = w * y2, wz = w * z2;
    return new Float32Array([1 - (yy + zz), xy + wz, xz - wy, 0, xy - wz, 1 - (xx + zz), yz + wx, 0,
      xz + wy, yz - wx, 1 - (xx + yy), 0, p.x, p.y, p.z, 1]);
  };
  class RigidTransform {
    constructor(p = {}, q = {}) {
      this.position = { x: p.x || 0, y: p.y || 0, z: p.z || 0, w: 1 };
      this.orientation = { x: q.x || 0, y: q.y || 0, z: q.z || 0, w: q.w === undefined ? 1 : q.w };
      this.matrix = matrix(this.position, this.orientation);
    }
  }
  window.XRRigidTransform = RigidTransform;
  // three.js draws through XRWebGLLayer when there is no XRWebGLBinding
  try { delete window.XRWebGLBinding; } catch { /* ignore */ }
  window.XRWebGLBinding = undefined;
  window.XRWebGLLayer = class {
    constructor(session, gl) {
      this.framebuffer = null;   // the canvas itself
      this.framebufferWidth = gl.drawingBufferWidth;
      this.framebufferHeight = gl.drawingBufferHeight;
      this.ignoreDepthValues = false;
    }
    getViewport() { return { x: 0, y: 0, width: this.framebufferWidth, height: this.framebufferHeight }; }
  };
  for (const C of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
    if (C) C.prototype.makeXRCompatible = () => Promise.resolve();
  }

  // the phone 1.5 m up, tipped 45 degrees down; the floor 1.5 m ahead of it
  const tilt = -Math.PI / 8;
  const state = {
    phone: { p: { x: 0, y: 1.5, z: 0 }, q: { x: Math.sin(tilt), y: 0, z: 0, w: Math.cos(tilt) } },
    floor: { x: 0, y: 0, z: -1.5 },        // null: no surface found yet
    tracking: true,
    features: ['local', 'viewer', 'hit-test', 'anchors', 'dom-overlay'],
    session: null, anchors: 0, ended: 0, requested: null,
  };
  const projection = () => {
    const f = 1 / Math.tan(Math.PI / 6), a = innerWidth / innerHeight, n = 0.02, far = 2000;
    return new Float32Array([f / a, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + n) / (n - far), -1, 0, 0, (2 * far * n) / (n - far), 0]);
  };

  class Space { constructor(kind, anchor) { this.kind = kind; this.anchor = anchor; } }
  class Anchor {
    constructor(t) { this.t = t; this.anchorSpace = new Space('anchor', this); this.gone = false; state.anchors++; }
    delete() { if (!this.gone) { this.gone = true; state.anchors--; } }
  }
  class Frame {
    constructor() { this.active = true; this.trackedAnchors = undefined; }
    getViewerPose() {
      if (!state.tracking) return null;
      const t = new RigidTransform(state.phone.p, state.phone.q);
      return { transform: t, emulatedPosition: false, views: [{ eye: 'none', transform: t, projectionMatrix: projection() }] };
    }
    getPose(space) {
      if (space.kind === 'anchor' && !space.anchor.gone) return { transform: space.anchor.t };
      return null;
    }
    getHitTestResults() {
      if (!state.floor || !state.tracking) return [];
      const t = new RigidTransform(state.floor, {});
      const frame = this;
      return [{
        getPose: () => ({ transform: t }),
        createAnchor: () => frame.active ? Promise.resolve(new Anchor(t))
          : Promise.reject(new DOMException('frame is not active', 'InvalidStateError')),
      }];
    }
  }
  class Session extends EventTarget {
    constructor(opts) {
      super();
      this.renderState = { baseLayer: null, depthNear: 0.1, depthFar: 1000 };
      this.enabledFeatures = state.features.slice();
      this.domOverlayState = opts && opts.domOverlay ? { type: 'screen' } : null;
      this.inputSources = [];
      this.visibilityState = 'visible';
      this.environmentBlendMode = 'alpha-blend';
      this.ids = new Map();
      this.next = 0;
      this.over = false;
    }
    updateRenderState(s) { Object.assign(this.renderState, s); }
    requestReferenceSpace(kind) { return Promise.resolve(new Space(kind)); }
    requestHitTestSource() { return Promise.resolve({ cancel() {} }); }
    requestAnimationFrame(cb) {
      const id = ++this.next;
      this.ids.set(id, window.requestAnimationFrame((t) => {
        if (this.over) return;
        const f = new Frame();
        cb(t, f);
        f.active = false;
      }));
      return id;
    }
    cancelAnimationFrame(id) { window.cancelAnimationFrame(this.ids.get(id)); }
    end() {
      if (this.over) return Promise.resolve();
      this.over = true;
      state.session = null;
      state.ended++;
      setTimeout(() => this.dispatchEvent(new Event('end')));
      return Promise.resolve();
    }
    tap() {   // a tap on the camera view
      const e = new Event('select');
      e.frame = new Frame();
      e.inputSource = { targetRayMode: 'screen', targetRaySpace: new Space('input') };
      this.dispatchEvent(e);
    }
  }
  Object.defineProperty(navigator, 'xr', {
    configurable: true,
    value: {
      isSessionSupported: (mode) => Promise.resolve(mode === 'immersive-ar'),
      requestSession: (mode, opts) => {
        state.requested = { mode, opts: { optionalFeatures: opts && opts.optionalFeatures, overlay: !!(opts && opts.domOverlay) } };
        const s = new Session(opts);
        state.session = s;
        return Promise.resolve(s);
      },
      addEventListener() {}, removeEventListener() {},
    },
  });
  window.__xr = { state, tap: () => state.session && state.session.tap(), ident };
})();
