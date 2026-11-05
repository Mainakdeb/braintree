// The brain beside the paragraphs of Figures 2 and 3: both hemispheres of the standard fsaverage brain (inflated), with the pair's
// regions in the plot's own colours (the first-named region green, the other blue; a model figure's one region in ink).
// Approximate anatomy from group atlases (brain.json says which), never data: the encoders read out one number per region.
// Faces stand upright, seen from below; for scenes each hemisphere folds open so its inner face shows and turns to lie
// on its side, the two back to back with the backs of the brain meeting in the middle; bodies are seen from the right.
// The canvas and the camera never change: a change of view only rotates, slides and uniformly scales the brain, all eased
// together. It floats gently and can be dragged to turn.
import * as THREE from '../shared/vendor/three/three.module.min.js';

const RM = matchMedia('(prefers-reduced-motion: reduce)');
const CODE = { FFA: 1, OFA: 2, PPA: 3, RSC: 4, EBA: 5, OPA: 6 };
// where to look from (RAS: x right, y front, z up), which way is up on screen, and how far the hemispheres are folded open
const VIEW = {
  ventral: { dir: [0, -0.3, -1], up: [0, 1, 0], open: 0, spin: 0 },   // from below, front at the top: fusiform and inferior occipital
  medial: { dir: [0, -0.05, -1], up: [0, 1, 0], open: 1, spin: 1 },                // folded open and laid side by side: retrosplenial, parahippocampal
  lateral: { dir: [1, -0.35, -0.1], up: [0, 0, 1], open: 0, spin: 0 },             // from the right: lateral occipitotemporal (EBA)
};
const VIEW_OF = names => names.includes('RSC') || names.includes('PPA') ? 'medial' : names.includes('EBA') ? 'lateral' : 'ventral';
const MS = 850, FADE = 350, DIST = 1000, FILL = 0.86;                     // one change of view; one change of colour; camera distance; share of the canvas used

const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const dark = () => document.documentElement.dataset.theme === 'dark';
const b64 = (s, T) => { const b = Uint8Array.from(atob(s), c => c.charCodeAt(0)); return new T(b.buffer); };
// the CSS curve cubic-bezier(x1, y1, x2, y2), solved for time by Newton's method
const bezier = (x1, y1, x2, y2) => {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  return x => {
    if (!(x > 0)) return 0; if (x >= 1) return 1;
    let u = x; for (let i = 0; i < 8; i++) u -= (((ax * u + bx) * u + cx) * u - x) / ((3 * ax * u + 2 * bx) * u + cx);
    u = Math.min(1, Math.max(0, u)); return ((ay * u + by) * u + cy) * u;
  };
};
const ease = bezier(0.4, 0, 0.2, 1);   // a soft start and a long, gentle landing
const V = a => new THREE.Vector3(...a);
const X = V([1, 0, 0]), Y = V([0, 1, 0]), Z = V([0, 0, 1]);

let DATA = null;
function load() {
  return DATA || (DATA = fetch(new URL('brain.json', import.meta.url)).then(r => r.json()).then(d => {
    const hemi = h => {
      const q = b64(h.pos, Int16Array), pos = new Float32Array(q.length);
      for (let i = 0; i < q.length; i++) pos[i] = q[i] / 32767 * h.scale;
      return { n: h.n, half: h.half, pos, idx: b64(h.idx, Uint16Array), sulc: b64(h.sulc, Uint8Array), roi: b64(h.roi, Uint8Array), alpha: b64(h.alpha, Uint8Array) };
    };
    return { lh: hemi(d.lh), rh: hemi(d.rh), source: d.source };
  }));
}

class Brain {
  constructor(host) {
    this.host = host; this.names = [];
    host.innerHTML = `<div class="br-c"><canvas aria-hidden="true"></canvas></div><div class="br-k"></div>
      <p class="br-n" title="">approximate location<br>standard brain</p>`;
    this.canvas = host.querySelector('canvas'); this.key = host.querySelector('.br-k'); this.note = host.querySelector('.br-n');
    this.ready = load().then(d => this.build(d));
  }
  build(d) {
    this.note.title = 'Group atlases on fsaverage: ' + d.source + '. The models read out each person’s own region.';
    const r = this.r = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    r.setPixelRatio(Math.min(2, devicePixelRatio));
    this.scene = new THREE.Scene(); this.pivot = new THREE.Group(); this.brain = new THREE.Group();
    this.pivot.add(this.brain); this.scene.add(this.pivot);
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.6)); this.lamp = new THREE.DirectionalLight(0xffffff, 1.5); this.scene.add(this.lamp);
    this.h = ['lh', 'rh'].map(k => {
      const m = d[k], g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(m.pos, 3)); g.setIndex(new THREE.BufferAttribute(m.idx, 1)); g.computeVertexNormals();
      const col = new Float32Array(m.n * 3); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeBoundingBox();
      const mesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true })), grp = new THREE.Group();
      grp.add(mesh); this.brain.add(grp);
      const bb = g.boundingBox, box = new Float32Array(24);
      for (let i = 0; i < 8; i++) box.set([i & 1 ? bb.max.x : bb.min.x, i & 2 ? bb.max.y : bb.min.y, i & 4 ? bb.max.z : bb.min.z], i * 3);
      const sub = new Float32Array(Math.ceil(m.n / 4) * 3);   // every fourth vertex: enough to plan a turn
      for (let i = 0, j = 0; i < m.n; i += 4, j += 3) sub.set(m.pos.subarray(i * 3, i * 3 + 3), j);
      return { k, m, g, col, grp, box, sub, side: k === 'rh' ? 1 : -1 };
    });
    this.cam = new THREE.PerspectiveCamera(24, 1, DIST * 0.5, DIST * 1.5);
    this.view = null; this.A = this.B = this.state(VIEW.ventral); this.dip = 0; this.bulge = [0, 0]; this.t0 = -1e9; this.cT0 = -1e9;
    this.drag = new THREE.Quaternion();
    this.pointer();
    new ResizeObserver(() => this.size()).observe(this.host.querySelector('.br-c')); this.size();
    new IntersectionObserver(es => { this.vis = es[0].isIntersecting; this.loop(); }).observe(this.host);
    new MutationObserver(() => this.paint(true)).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    this.paint(true);
  }
  size() {
    const c = this.host.querySelector('.br-c'), w = c.clientWidth, h = c.clientHeight;
    if (!w || !h || !this.r) return;
    this.r.setSize(w, h, false); this.cam.aspect = w / h; this.cam.updateProjectionMatrix();
    if (this.view) { this.B = this.state(this.view); this.plan(); }   // the scale that fits depends on the canvas's shape
    this.frame(performance.now());                                 // a resize clears the canvas: draw at once, or it blinks
  }
  // cortex shaded by sulcal depth; the active regions in the figure's colours; a change fades
  target(m) {
    const out = new Float32Array(m.n * 3), dk = dark();
    const gy = new THREE.Color(dk ? '#3b3b3a' : '#ecebe7'), sl = new THREE.Color(dk ? '#1f1f1f' : '#c3c2bd');
    const paint = {}, [A, B] = this.names, one = this.names.length === 1;
    if (A) paint[CODE[A]] = new THREE.Color(one ? css('--k') : css('--green'));
    if (B) paint[CODE[B]] = new THREE.Color(css('--blue'));
    const c = new THREE.Color();
    for (let i = 0; i < m.n; i++) {
      c.copy(gy).lerp(sl, m.sulc[i] / 255);
      const p = paint[m.roi[i]]; if (p) c.lerp(p, m.alpha[i] / 255);
      out[i * 3] = c.r; out[i * 3 + 1] = c.g; out[i * 3 + 2] = c.b;
    }
    return out;
  }
  paint(now) {
    if (!this.h) return;
    for (const h of this.h) { h.from = Float32Array.from(h.col); h.to = this.target(h.m); }
    this.cT0 = now || RM.matches ? -1e9 : null; this.loop();   // null: the fade starts on the next frame drawn
  }
  set(names) {
    this.names = names.filter(n => n in CODE);
    this.key.innerHTML = this.names.map((n, i) => `<span class="${this.names.length === 1 ? 'k0' : i ? 'kb' : 'ka'}"><i></i>${n}</span>`).join('');
    this.ready.then(() => {
      const v = VIEW[VIEW_OF(this.names)];
      if (v !== this.view) {
        // from the pose now on screen to the new view; the turn starts on the next frame drawn, after the figure beside it is
        // rebuilt, so none of its first steps is lost to that work
        this.A = this.t0 == null ? this.A : this.mixed(this.lastT ?? performance.now());
        this.view = v; this.B = this.state(v); this.plan(); this.t0 = RM.matches ? -1e9 : null;
      }
      this.paint();
    });
  }
  // the uniform scale at which a pose fills the canvas
  fit(W, H) { const tv = Math.tan(THREE.MathUtils.degToRad(this.cam.fov / 2)) * DIST; return FILL * Math.min(tv / H, tv * this.cam.aspect / W); }
  // a view's end state: the camera's turn (a quaternion, so a change of view turns at an even rate with no sudden roll), the
  // fold, each hemisphere's place and the scale. The end pose is the one the page has always drawn: each hemisphere slid out
  // and the whole scaled by the corners of its bounding box
  state(v) {
    const back = V(v.dir).normalize(), up = V(v.up).sub(back.clone().multiplyScalar(V(v.up).dot(back))).normalize();
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(up, back), up, back));
    const s = { q, open: v.open, spin: v.spin, px: null, scale: 1 };
    s.px = this.apart(s, h => h.box); this.turn(s);
    const { W, H } = this.extent(s, h => h.box); s.scale = this.fit(W, H);
    return s;
  }
  // the state a share k of the way through the current change of view. Each hemisphere slides straight from one end's place
  // to the other's and the scale goes from one end's to the other's at an even ratio, each with a smooth bulge or dip (planned
  // once per change, the least that works) where the turning hemispheres would touch or the brain would come wider than the
  // canvas. Measured afresh on every frame, the slide and the scale would jolt wherever the point that sets the outline jumps
  at(k) {
    const A = this.A, B = this.B, mix = (a, b) => a + (b - a) * k, sn = Math.sin(Math.PI * k);
    return { q: A.q.clone().slerp(B.q, k), open: mix(A.open, B.open), spin: mix(A.spin, B.spin),
             px: A.px.map((x, i) => mix(x, B.px[i]) + this.bulge[i] * sn), scale: A.scale ** (1 - k) * B.scale ** k * (1 - this.dip * sn), k };
  }
  mixed(t) { return this.at(this.t0 == null ? 0 : ease((t - this.t0) / MS)); }
  plan() {
    const N = 32, sn = i => Math.sin(Math.PI * i / N), b = [0, 0];
    this.bulge = [0, 0]; this.dip = 0;
    for (let i = 1; i < N; i++) {
      const s = this.at(i / N), need = this.apart(s, h => h.sub);
      this.h.forEach((h, j) => { b[j] = Math.max(b[j], h.side * (need[j] - s.px[j]) / sn(i)); });
    }
    this.bulge = b.map((x, j) => x * this.h[j].side);
    let d = 0;
    for (let i = 1; i < N; i++) {
      const s = this.at(i / N); this.turn(s);
      const { W, H } = this.extent(s, h => h.sub); d = Math.max(d, (1 - this.fit(W, H) / s.scale) / sn(i));
    }
    this.dip = Math.min(d, 0.6); this.placed = null;
  }
  // the least and greatest of u·(point) over a hemisphere's points (its mesh vertices or its box's corners), as placed now
  span(h, pts, u) {
    const w = u.clone().applyQuaternion(h.grp.quaternion.clone().invert()), o = u.dot(h.grp.position);
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < pts.length; i += 3) { const d = w.x * pts[i] + w.y * pts[i + 1] + w.z * pts[i + 2]; if (d < lo) lo = d; if (d > hi) hi = d; }
    return [lo + o, hi + o];
  }
  // each hemisphere folds about its own front-back axis (inner face toward the camera) and turns a quarter in the view so its
  // back points to the middle; then it slides to the state's place (unscaled)
  turn(s) {
    const th = s.open * Math.PI * 0.36, sp = s.spin * Math.PI / 2, qy = new THREE.Quaternion();   // fold short of flat, so PPA's underside shows
    this.h.forEach((h, i) => {
      h.grp.quaternion.setFromAxisAngle(Z, -h.side * sp).multiply(qy.setFromAxisAngle(Y, -h.side * th));
      if (s.px) h.grp.position.set(s.px[i], 0, 0);
    });
  }
  // where each hemisphere, folded and turned for a state, must sit to be just clear of the middle, so the two never touch
  apart(s, pts) {
    const gap = 6; this.turn({ ...s, px: null });
    return this.h.map(h => { h.grp.position.set(0, 0, 0); const [lo, hi] = this.span(h, pts(h), X); return h.side > 0 ? gap / 2 - lo : -gap / 2 - hi; });
  }
  // the hemispheres' half extents across and up the screen, as placed now
  extent(s, pts) {
    const right = X.clone().applyQuaternion(s.q), up = Y.clone().applyQuaternion(s.q);
    let W = 0, H = 0;
    for (const h of this.h) {
      const a = this.span(h, pts(h), right), b = this.span(h, pts(h), up);
      W = Math.max(W, -a[0], a[1]); H = Math.max(H, -b[0], b[1]);
    }
    return { W, H };
  }
  pointer() {
    let on = null;
    this.canvas.addEventListener('pointerdown', e => { on = { x: e.clientX, y: e.clientY, q: this.drag.clone() }; this.canvas.setPointerCapture(e.pointerId); this.held = true; this.loop(); });
    this.canvas.addEventListener('pointermove', e => {
      if (!on) return;
      const fwd = this.cam.position.clone().normalize().negate(), right = new THREE.Vector3().crossVectors(fwd, this.cam.up).normalize();
      const qy = new THREE.Quaternion().setFromAxisAngle(this.cam.up, (e.clientX - on.x) / 90);
      const qx = new THREE.Quaternion().setFromAxisAngle(right, (e.clientY - on.y) / 90);
      this.drag.copy(qy).multiply(qx).multiply(on.q); this.loop();
    });
    const up = () => { on = null; this.held = false; this.release = performance.now(); this.loop(); };
    this.canvas.addEventListener('pointerup', up); this.canvas.addEventListener('pointercancel', up);
  }
  loop() { if (!this.raf && this.r && this.vis) this.raf = requestAnimationFrame(t => { this.raf = 0; this.frame(t); }); }
  frame(t) {
    // every step is posed at its frame's own time (never the moment its code happens to run), so the steps come out even
    t = Math.max(t, this.lastT || 0); const dt = this.lastT ? Math.min(t - this.lastT, 100) : 16.7; this.lastT = t;
    if (this.t0 == null) this.t0 = t;
    if (this.cT0 == null) this.cT0 = t;
    const s = this.mixed(t); let busy = s.k < 1;
    if (busy || this.placed !== this.B) {   // the pose changes only during a change of view or after a resize
      this.turn(s); const up = Y.clone().applyQuaternion(s.q), back = Z.clone().applyQuaternion(s.q);
      this.brain.scale.setScalar(s.scale);
      this.cam.position.copy(back).multiplyScalar(DIST); this.cam.up.copy(up); this.cam.lookAt(0, 0, 0);
      this.lamp.position.copy(this.cam.position).add(up.clone().multiplyScalar(DIST * 0.6));
      this.up = up; this.placed = busy ? null : this.B;
    }
    const up = this.up;
    // colours
    const c = ease((t - this.cT0) / FADE);
    for (const h of this.h) {
      if (!h.to) continue;
      for (let i = 0; i < h.col.length; i++) h.col[i] = h.from[i] + (h.to[i] - h.from[i]) * c;
      h.g.attributes.color.needsUpdate = true; if (c >= 1) h.to = null; else busy = true;
    }
    // a drag eases back two seconds after it ends, at the same pace whatever the screen's frame rate
    if (!this.held && this.release && t - this.release > 2000) {
      this.drag.slerp(new THREE.Quaternion(), 1 - Math.exp(-dt / 280));
      if (this.drag.angleTo(new THREE.Quaternion()) > 1e-3) busy = true; else this.release = 0;
    }
    // hovering: a slow sway and a small rise and fall
    const sway = RM.matches ? 0 : Math.sin(t / 2600) * 0.07, bob = RM.matches ? 0 : Math.sin(t / 1900) * DIST * 0.006;
    this.pivot.quaternion.copy(this.drag).premultiply(new THREE.Quaternion().setFromAxisAngle(up, sway));
    this.pivot.position.copy(up).multiplyScalar(bob);
    this.r.render(this.scene, this.cam);
    if (busy || this.held || !RM.matches) this.loop();
  }
}

// one brain per tree figure, in the margin beside its section's heading and paragraph (below the paragraph on narrow screens)
const insets = {}; window.__brains = insets;   // for checks from the console
function inset(fig) {
  if (insets[fig]) return insets[fig];
  const col = document.getElementById(fig + '-fig').closest('section').querySelector('.col');
  const host = document.createElement('div'); host.className = 'br'; col.classList.add('br-col'); col.append(host);
  return (insets[fig] = new Brain(host));
}
document.addEventListener('bt:tree', e => {
  const { fig, T } = e.detail;
  const region = s => (/\(([^)]+)\)/.exec(s)?.[1] || s).toUpperCase();
  const names = T.purpose === 'models' ? [region(T.a)] : [String(T.a).toUpperCase(), String(T.b).toUpperCase()];
  inset(fig).set(names);
});
