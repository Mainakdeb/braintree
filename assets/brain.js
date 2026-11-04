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
const MS = 1400, DIST = 1000, FILL = 0.86;                                // one change of view; camera distance; share of the canvas used

const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const dark = () => document.documentElement.dataset.theme === 'dark';
const b64 = (s, T) => { const b = Uint8Array.from(atob(s), c => c.charCodeAt(0)); return new T(b.buffer); };
const ease = x => x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const V = a => new THREE.Vector3(...a);

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
      return { k, m, g, col, grp, side: k === 'rh' ? 1 : -1 };
    });
    this.cam = new THREE.PerspectiveCamera(24, 1, DIST * 0.5, DIST * 1.5);
    this.view = null; this.A = this.B = this.state(VIEW.ventral); this.t0 = -1e9;
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
    if (this.view) this.B = this.state(this.view);                 // the scale that fits depends on the canvas's shape
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
    this.cT0 = now || RM.matches ? -1e9 : performance.now(); this.loop();
  }
  set(names) {
    this.names = names.filter(n => n in CODE);
    this.key.innerHTML = this.names.map((n, i) => `<span class="${this.names.length === 1 ? 'k0' : i ? 'kb' : 'ka'}"><i></i>${n}</span>`).join('');
    this.ready.then(() => {
      const v = VIEW[VIEW_OF(this.names)];
      if (v !== this.view) { this.view = v; this.A = this.now(); this.B = this.state(v); this.t0 = RM.matches ? -1e9 : performance.now(); }
      this.paint();
    });
  }
  // the uniform scale at which a pose fills the canvas
  fit(W, H) { const tv = Math.tan(THREE.MathUtils.degToRad(this.cam.fov / 2)) * DIST; return FILL * Math.min(tv / H, tv * this.cam.aspect / W); }
  // a view's end state, with its scale worked out once from its final pose
  state(v) {
    const s = { dir: V(v.dir).normalize(), up: V(v.up), open: v.open, spin: v.spin, scale: 1 };
    const { W, H } = this.pose(s); s.scale = this.fit(W, H);
    return s;
  }
  now() {
    const k = ease((performance.now() - this.t0) / MS), A = this.A, B = this.B, mix = (a, b) => a + (b - a) * k;
    return { dir: A.dir.clone().lerp(B.dir, k).normalize(), up: A.up.clone().lerp(B.up, k).normalize(), open: mix(A.open, B.open), spin: mix(A.spin, B.spin), scale: mix(A.scale, B.scale) };
  }
  // place the hemispheres for a state (unscaled) and return their half extents across and up the screen
  pose(s) {
    const th = s.open * Math.PI * 0.36, sp = s.spin * Math.PI / 2, gap = 6;   // fold short of flat, so PPA's underside shows
    // each hemisphere folds about its own front-back axis (inner face toward the camera), turns a quarter in the view so its back
    // points to the middle, and slides out just far enough that the two never touch
    const yA = new THREE.Vector3(0, 1, 0), zA = new THREE.Vector3(0, 0, 1), p = new THREE.Vector3();
    for (const h of this.h) {
      h.grp.quaternion.setFromAxisAngle(zA, -h.side * sp).multiply(new THREE.Quaternion().setFromAxisAngle(yA, -h.side * th));
      const b = h.g.boundingBox; let lo = Infinity, hi = -Infinity;
      for (let i = 0; i < 8; i++) {
        p.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).applyQuaternion(h.grp.quaternion);
        lo = Math.min(lo, p.x); hi = Math.max(hi, p.x);
      }
      h.grp.position.set(h.side > 0 ? gap / 2 - lo : -gap / 2 - hi, 0, 0);
      h.grp.updateMatrix();
    }
    const fwd = s.dir.clone().negate(), up = s.up.clone().sub(fwd.clone().multiplyScalar(s.up.dot(fwd))).normalize();
    const right = new THREE.Vector3().crossVectors(fwd, up);
    let W = 0, H = 0;
    for (const h of this.h) {
      const b = h.g.boundingBox;
      for (let i = 0; i < 8; i++) {
        p.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).applyMatrix4(h.grp.matrix);
        W = Math.max(W, Math.abs(p.dot(right))); H = Math.max(H, Math.abs(p.dot(up)));
      }
    }
    return { W, H, fwd, up };
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
    let busy = t - this.t0 < MS;
    const s = this.now(), { up, fwd, W, H } = this.pose(s);
    this.brain.scale.setScalar(Math.min(s.scale, this.fit(W, H)));   // eased between the two ends, never wider than the canvas mid-turn
    this.cam.position.copy(fwd).multiplyScalar(-DIST); this.cam.up.copy(up); this.cam.lookAt(0, 0, 0);
    this.lamp.position.copy(this.cam.position).add(up.clone().multiplyScalar(DIST * 0.6));
    // colours
    const c = ease((t - this.cT0) / 450);
    for (const h of this.h) {
      if (!h.to) continue;
      for (let i = 0; i < h.col.length; i++) h.col[i] = h.from[i] + (h.to[i] - h.from[i]) * c;
      h.g.attributes.color.needsUpdate = true; if (c >= 1) h.to = null; else busy = true;
    }
    // a drag eases back two seconds after it ends
    if (!this.held && this.release && t - this.release > 2000) {
      this.drag.slerp(new THREE.Quaternion(), 0.06);
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
