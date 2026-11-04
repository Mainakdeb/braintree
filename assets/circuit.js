// Figure 1 · Braintree as a circuit. A human asks a question; it enters Knowledge, and the plan, the stimuli, the readouts
// and the finding pass from protocol to protocol, the finding returning to where the question came in. Each protocol is a
// box with its parts listed under it: agents (a robot, in ink), code, tools and data (grey). Drawn as SVG from the
// container's width: two by two on wide screens (Knowledge, Design on top; Inference, Execution below), a column on
// narrow ones. Nothing moves until the question is typed; then one pulse carries it around the loop, until the next one.
const RM = matchMedia('(prefers-reduced-motion: reduce)');
const box = document.getElementById('circuit-box'), read = document.getElementById('circuit-read');
const NS = 'http://www.w3.org/2000/svg';

// parts: [kind, label], kind one of agent | code | tool | data; one row each, evenly spaced
const BLOCKS = [
  { k: 'knowledge', name: 'Knowledge', c: '#D24D33', out: 'plan',
    parts: [['agent', 'Scientist'], ['data', 'Literature Scraper'], ['data', 'Past Runs']],
    does: 'the scientist reads the question, the literature and past runs, and writes a plan: what to compare, in which regions, and what each hypothesis predicts.' },
  { k: 'design', name: 'Design', c: '#11A6CC', out: 'stimuli',
    parts: [['tool', 'Generative image edit models'], ['agent', 'Independent auditor agent'], ['data', 'image datasets (~400k images)']],
    does: 'turns the plan into stimuli, drawn from image datasets and edited by generative image edit models; an independent auditor agent checks them before anything runs.' },
  { k: 'execution', name: 'Execution', c: '#603913', out: 'readouts',
    parts: [['code', 'In-silico brain models'], ['data', 'brain data']],
    does: 'runs the stimuli through in-silico models of human visual cortex, trained on brain data, and returns their readouts.' },
  { k: 'inference', name: 'Inference', c: '#008965', out: 'finding',
    parts: [['code', 'Statistics'], ['agent', 'Independent auditor agent']],
    does: 'fixed statistics code turns the readouts into an effect and its intervals; an independent auditor agent checks the reading, and the finding seeds the next question.' },
];
// the orchestrator: the hub on the loop's corner, where the question comes in and each finding comes back
const ORCH = { name: 'Orchestrator', does: 'takes the human\'s question and hands it to Knowledge; each finding comes back to it, and it decides what to ask next.' };
const OR = 16, OSIZE = 26; // its patch of page colour (half width) and its icon size
// questions people asked Braintree (the campaigns and a replication on this page)
const QUESTIONS = [
  'What drives PPA and RSC apart?',
  'Where do two models of FFA disagree?',
  'What drives FFA and OFA apart?',
];
const TYPE_MS = 42, HOLD_MS = 520, REST_MS = 700, LAPS = 2, PERIOD = 8; // PERIOD: seconds per turn of the loop
// sizes: box height, list rows (first baseline under the box, row step), tag height,
// the space under a list, the visible wire between a list and the next box
const BH = 42, LIST0 = 27, ROW = 23, TAG_H = 26, LIST_PAD = 16, SEG = 92;

// icons on a 24 grid, drawn at 15 px
const ICONS = {
  agent: [['rect', { x: 4, y: 8, width: 16, height: 12, rx: 3 }], ['path', { d: 'M12 8V5.4' }], ['circle', { cx: 12, cy: 3.9, r: 1.5 }],
    ['path', { d: 'M1.8 12.5v3.5M22.2 12.5v3.5M9.2 12.8v2.2M14.8 12.8v2.2' }]],
  data: [['ellipse', { cx: 12, cy: 5, rx: 8, ry: 3 }], ['path', { d: 'M4 5v14a8 3 0 0 0 16 0V5M4 12a8 3 0 0 0 16 0' }]],
  code: [['path', { d: 'M16.5 16.5 21 12l-4.5-4.5M7.5 7.5 3 12l4.5 4.5M14 4.5l-4 15' }]],
  tool: [['path', { d: 'M3.5 20.5 14.5 9.5M18 2.5v6M15 5.5h6M20.6 11v2.6M19.3 12.3h2.6M11.2 3.4v2.2M10.1 4.5h2.2' }]],
};

let S = null; // the drawn state

function el(tag, attrs, parent) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}
function text(parent, x, y, s, cls, anchor = 'start') {
  const t = el('text', { x, y, class: cls, 'text-anchor': anchor }, parent); t.textContent = s; return t;
}
function wrap(s, max) {
  const out = []; let line = '';
  for (const w of s.split(' ')) { if (line && (line + ' ' + w).length > max) { out.push(line); line = w; } else line = line ? line + ' ' + w : w; }
  if (line) out.push(line);
  return out;
}
// the human: a head and shoulders, centred on (x, y)
function person(g, x, y) {
  const p = el('g', { class: 'cs' }, g);
  el('circle', { cx: x, cy: y - 10, r: 6.2, class: 'cs-h' }, p);
  el('path', { d: `M ${x - 12.5} ${y + 13} C ${x - 12.5} ${y + 3} ${x - 7} ${y} ${x} ${y} C ${x + 7} ${y} ${x + 12.5} ${y + 3} ${x + 12.5} ${y + 13} Z`, class: 'cs-b' }, p);
  return p;
}
// a block's parts with their baselines below the box, and the list's height
function rows(b) {
  const out = []; let y = LIST0, first = true;
  for (const p of b.parts) {
    if (!first) y += ROW;
    first = false;
    out.push({ kind: p[0], label: p[1], dy: y });
  }
  return { rows: out, h: y + 6 };
}
// a closed polyline: its path, its length and the point at a distance along it
function loop(pts) {
  const segs = []; let len = 0;
  pts.forEach((p, i) => { const q = pts[(i + 1) % pts.length], l = Math.hypot(q[0] - p[0], q[1] - p[1]); segs.push({ p, q, l, s0: len }); len += l; });
  const at = s => {
    s = ((s % len) + len) % len;
    for (const g of segs) if (s <= g.s0 + g.l) { const t = g.l ? (s - g.s0) / g.l : 0; return { x: g.p[0] + (g.q[0] - g.p[0]) * t, y: g.p[1] + (g.q[1] - g.p[1]) * t }; }
    return { x: pts[0][0], y: pts[0][1] };
  };
  return { d: 'M ' + pts.map(p => p.join(' ')).join(' L ') + ' Z', len, at };
}
// a document tag with a folded corner, centred on (x, y)
function tag(g, x, y, s, w) {
  const t = el('g', { class: 'ctag' }, g), L = x - w / 2, T = y - TAG_H / 2, f = 8;
  el('path', { d: `M ${L} ${T} H ${L + w - f} L ${L + w} ${T + f} V ${T + TAG_H} H ${L} Z`, class: 'ctag-r' }, t);
  el('path', { d: `M ${L + w - f} ${T} V ${T + f} H ${L + w}`, class: 'ctag-f' }, t);
  text(t, x, y + 4.3, s, 'ctag-t', 'middle');
  return t;
}
function icon(g, kind, x, y, cls, size = 15) {
  const ic = el('g', { class: cls, transform: `translate(${x} ${y}) scale(${size / 24})` }, g);
  for (const [t, a] of ICONS[kind]) el(t, a, ic);
}

function draw() {
  const W = Math.round(box.clientWidth);
  if (!W) return;
  box.innerHTML = '';
  const svg = el('svg', { width: W, role: 'img', 'aria-hidden': 'true' }, box);
  const g = el('g', {}, svg);
  // measure the faces: one mono character (the bubble), each part's label (the lists), each tag
  const probe = text(g, 0, -100, 'MMMMMMMMMM', 'cq'); const cwid = probe.getComputedTextLength() / 10 || 6.6; probe.remove();
  const meas = (s, cls) => { const t = text(g, 0, -100, s, cls); const w = t.getComputedTextLength(); t.remove(); return w; };
  const R = BLOCKS.map(b => {
    const r = rows(b);
    r.w = Math.max(...r.rows.map(p => meas(p.label, 'ci-t') || p.label.length * 7)) + 32;
    r.tw = Math.ceil((meas(b.out, 'ctag-t') || b.out.length * 7.5) + 26);
    return r;
  });
  const listMax = Math.max(...R.map(r => r.w));
  const tagMax = Math.max(...R.map(r => r.tw));

  // the wide layout needs room for the left margin (the human, the orchestrator, the finding tag), two boxes at least as
  // wide as Design's list (Design sits at the right edge), and a gap that holds a tag
  const xr = 128, KL = xr + R[3].tw + 44, avail = W - KL - 2;
  const bwMin = Math.max(R[1].w + 4, 200);
  const wide = avail - 2 * bwMin >= tagMax + 90;

  let bw, pos, pts, entry, bubble, H, who, tagAt;
  if (wide) {
    bw = Math.max(bwMin, Math.min(290, Math.round(avail * 0.35)));
    const G = avail - 2 * bw, DL = KL + bw + G, cxD = DL + bw / 2, px = 26;
    const room = KL + bw * 0.55 - 6, maxc = Math.max(14, Math.floor((room - 22) / cwid));
    const nl = Math.max(...QUESTIONS.map(q => wrap(q, maxc).length));
    const bwid = Math.min(room, Math.max(...QUESTIONS.flatMap(q => wrap(q, maxc)).map(l => l.length)) * cwid + 22), bh = 14 + nl * 15;
    const y1 = bh + 44;
    const y2 = y1 + BH / 2 + R[1].h + LIST_PAD + SEG + BH / 2;
    H = y2 + BH / 2 + Math.max(R[2].h, R[3].h) + 8;
    // boxes: [left, top]
    pos = [[KL, y1 - BH / 2], [DL, y1 - BH / 2], [DL, y2 - BH / 2], [KL, y2 - BH / 2]];
    pts = [[xr, y1], [cxD, y1], [cxD, y2], [xr, y2]];
    const by = y1 - 30 - bh;
    bubble = { x: 6, y: by, w: bwid, h: bh, tail: `M ${px - 4} ${by + bh - 0.5} L ${px} ${by + bh + 9} L ${px + 8} ${by + bh - 0.5}`, tx: 17, ty: by + 19, maxc };
    who = person(g, px, y1);
    text(g, px, y1 + 32, 'human', 'cwd', 'middle');
    entry = { x0: px + 20, y0: y1, x1: xr, y1, dir: 'r' };
    const zD = y1 + BH / 2 + R[1].h + LIST_PAD;
    tagAt = [[(KL + bw + DL) / 2, y1], [cxD, (zD + y2 - BH / 2) / 2], [(KL + bw + DL) / 2, y2], [(xr + KL) / 2, y2]];
  } else {
    // a column: the human at the top, the question down into Knowledge, the boxes stacked, the way back up the right
    bw = Math.min(W - 40, Math.max(listMax + 8, 240));
    const span = Math.max(bw, listMax + 8) + 30, L = Math.max(0, Math.round((W - span) / 2) - 6), cx = L + bw / 2;
    const xR = L + Math.max(bw, listMax + 8) + 22;
    const bx = cx + 22, room = Math.max(120, W - 4 - bx), maxc = Math.max(12, Math.floor((room - 22) / cwid));
    const nl = Math.max(...QUESTIONS.map(q => wrap(q, maxc).length));
    const bwid = Math.min(room, Math.max(...QUESTIONS.flatMap(q => wrap(q, maxc)).map(l => l.length)) * cwid + 22), bh = 14 + nl * 15;
    const py = Math.max(30, Math.round(bh / 2) + 18), yJ = py + 76;
    pos = []; tagAt = [];
    let T = yJ + OR + 34;
    BLOCKS.forEach((b, i) => {
      pos.push([L, T]);
      const z = T + BH + R[i].h + LIST_PAD, next = z + SEG;
      tagAt.push([cx, (z + next) / 2]);
      T = next;
    });
    // after Inference the wire only needs room for its tag before it turns back up
    const zI = T - SEG, yEnd = zI + TAG_H + 40;
    tagAt[3] = [cx, zI + 14 + TAG_H / 2];
    H = yEnd + 10;
    pts = [[cx, yJ], [cx, yEnd], [xR, yEnd], [xR, yJ]];
    const by = py - 14 - bh / 2;
    bubble = { x: bx, y: by, w: bwid, h: bh, tail: `M ${bx + 0.5} ${py - 16} L ${bx - 9} ${py - 12} L ${bx + 0.5} ${py - 6}`, tx: bx + 11, ty: by + 19, maxc };
    who = person(g, cx, py);
    text(g, cx - 20, py + 8, 'human', 'cwd', 'end');
    entry = { x0: cx, y0: py + 18, x1: cx, y1: yJ, dir: 'd' };
  }
  svg.setAttribute('height', H); svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

  // wires: the question coming in (dashed, its arrowhead at the orchestrator), then the loop, which the orchestrator,
  // the boxes, lists and tags cover
  const L0 = loop(pts), tip = OR + 3;
  if (entry.dir === 'r') {
    el('path', { d: `M ${entry.x0} ${entry.y0} H ${entry.x1 - tip - 4}`, class: 'cw cw-q' }, g);
    el('path', { d: `M ${entry.x1 - tip - 6} ${entry.y1 - 5} L ${entry.x1 - tip} ${entry.y1} L ${entry.x1 - tip - 6} ${entry.y1 + 5}`, class: 'cw-arrow' }, g);
  } else {
    el('path', { d: `M ${entry.x0} ${entry.y0} V ${entry.y1 - tip - 4}`, class: 'cw cw-q' }, g);
    el('path', { d: `M ${entry.x1 - 5} ${entry.y1 - tip - 6} L ${entry.x1} ${entry.y1 - tip} L ${entry.x1 + 5} ${entry.y1 - tip - 6}`, class: 'cw-arrow' }, g);
  }
  el('path', { d: L0.d, class: 'cw' }, g);

  // the pulse goes under everything that follows
  const under = el('g', {}, svg);
  const trail = Array.from({ length: 7 }, (_, k) => el('circle', { r: 3.4 - k * 0.32, class: 'cp', opacity: 0 }, under));
  const top = el('g', {}, svg);

  // the blocks: the box, then its parts (over a patch of page colour that hides the wire running under the list)
  const spans = BLOCKS.map((b, i) => {
    const [L, T] = pos[i], r = R[i], lw = Math.max(bw, r.w + 8);
    const blk = el('g', { class: 'cb', 'data-i': i, tabindex: 0, role: 'button', 'aria-label': `${b.name}: ${r.rows.map(p => p.label).join(', ')}` }, top);
    el('rect', { x: L, y: T + BH, width: lw, height: r.h + LIST_PAD, class: 'cb-z' }, blk);
    el('rect', { x: L + 0.5, y: T + 0.5, width: bw - 1, height: BH - 1, rx: 10, class: 'cb-r' }, blk);
    el('rect', { x: L + 16, y: T + BH / 2 - 5, width: 10, height: 10, rx: 2, fill: b.c, class: 'cb-sw' }, blk);
    text(blk, L + 34, T + BH / 2 + 5.6, b.name, 'cb-n');
    for (const p of r.rows) {
      const ag = p.kind === 'agent' ? ' ag' : '';
      icon(blk, p.kind, L + 7, T + BH + p.dy - 12, 'ci' + ag);
      text(blk, L + 31, T + BH + p.dy, p.label, 'ci-t' + ag);
    }
    // where the pulse is inside this block (the box and the list), as a stretch of distance along the loop
    const zone = { x0: L, x1: L + lw, y0: T, y1: T + BH + r.h + LIST_PAD };
    let a = Infinity, z = -Infinity;
    for (let s = 0; s <= L0.len; s += 2) {
      const p = L0.at(s);
      if (p.x >= zone.x0 && p.x <= zone.x1 && p.y >= zone.y0 && p.y <= zone.y1) { a = Math.min(a, s); z = Math.max(z, s); }
    }
    return { i, a, b: z, blk };
  });
  // the tags, each lit while the pulse passes under it
  const labs = BLOCKS.map((b, i) => {
    const [x, y] = tagAt[i], node = tag(top, x, y, b.out, R[i].tw);
    let best = 0, bd = Infinity;
    for (let s = 0; s <= L0.len; s += 2) { const p = L0.at(s), d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = s; } }
    return { node, s: best };
  });

  // the orchestrator: a larger robot on the loop's corner, over a patch of page colour so the wires stop at it
  const [ox, oy] = pts[0];
  const orc = el('g', { class: 'co', tabindex: 0, role: 'button', 'aria-label': 'Orchestrator' }, top);
  el('rect', { x: ox - OR, y: oy - OR, width: 2 * OR, height: 2 * OR, rx: 6, class: 'co-z' }, orc);
  icon(orc, 'agent', ox - OSIZE / 2, oy - OSIZE / 2, 'ci ag', OSIZE);
  if (wide) text(top, ox + 9, oy + OR + 15, 'orchestrator', 'cwd');
  else text(top, ox - OR - 8, oy + 4, 'orchestrator', 'cwd', 'end');

  // the speech bubble and its text (typed one character at a time)
  const bg = el('g', { class: 'cq-g' }, top);
  el('rect', { x: bubble.x, y: bubble.y, width: bubble.w, height: bubble.h, rx: 8, class: 'cq-b' }, bg);
  el('path', { d: bubble.tail, class: 'cq-t' }, bg);
  const qt = el('text', { x: bubble.tx, y: bubble.ty, class: 'cq' }, bg);
  const caret = el('rect', { width: 1.6, height: 12, class: 'cq-c' }, bg);

  const keep = S ? S.seq : null;
  const e = Math.hypot(entry.x1 - entry.x0, entry.y1 - entry.y0);
  S = { svg, path: L0, len: L0.len, trail, spans, labs, entry, e, qt, caret, bubble, cwid, maxc: bubble.maxc, who, orc,
    hover: S ? S.hover : -1, seq: keep || { qi: 0, phase: 'type', t: performance.now() }, shown: '' };
  for (const [node, i] of [...spans.map(s => [s.blk, s.i]), [orc, BLOCKS.length]]) {
    node.addEventListener('mouseenter', () => setHover(i));
    node.addEventListener('mouseleave', () => setHover(-1));
    node.addEventListener('focus', () => setHover(i));
    node.addEventListener('blur', () => setHover(-1));
    node.addEventListener('click', () => setHover(S.hover === i ? -1 : i));
  }
  setHover(S.hover);
  if (RM.matches) still(); else kick();
}

// the bubble shows the first n characters of the question, wrapped, with the caret after the last one
function typeTo(q, n, caretOn) {
  const lines = wrap(q, S.maxc); let left = n, out = [];
  for (const l of lines) { if (left <= 0) break; out.push(l.slice(0, left)); left -= l.length + 1; }
  const key = out.join('\n') + (caretOn ? '|' : '');
  if (key === S.shown) return;
  S.shown = key;
  S.qt.textContent = '';
  out.forEach((l, i) => { const ts = el('tspan', { x: S.bubble.tx, dy: i ? 15 : 0 }, S.qt); ts.textContent = l; });
  const li = Math.max(0, out.length - 1), last = out[li] || '';
  S.caret.setAttribute('x', (S.bubble.tx + last.length * S.cwid + 1).toFixed(1));
  S.caret.setAttribute('y', (S.bubble.ty - 10 + li * 15).toFixed(1));
  S.caret.style.opacity = caretOn ? 1 : 0;
}

function setHover(i) {
  if (!S) return;
  S.hover = i;
  S.spans.forEach(s => s.blk.classList.toggle('hl', s.i === i));
  S.orc.classList.toggle('hl', i === BLOCKS.length);
  box.classList.toggle('has-hl', i >= 0);
  if (i < 0) { read.innerHTML = '&nbsp;'; return; }
  const b = i === BLOCKS.length ? ORCH : BLOCKS[i];
  read.innerHTML = `${b.c ? `<i style="background:${b.c}"></i>` : ''}<b>${b.name}</b>${b.does.charAt(0).toUpperCase() + b.does.slice(1)}`;
}

// reduced motion: the first question asked, the circuit drawn, no pulse
function still() { typeTo(QUESTIONS[0], QUESTIONS[0].length, false); }

// the dot takes the colour of the last block it passed through; the question on its way in keeps the default ink
function dotColour(s) {
  if (s < S.e) return '';
  const u = (s - S.e) % S.len;
  let last = -1;
  for (const sp of S.spans) if (u >= sp.b) last = sp.i;
  if (last >= 0) return BLOCKS[last].c;
  return s - S.e >= S.len ? BLOCKS[BLOCKS.length - 1].c : '';
}

let raf = 0, inView = false;
function kick() { if (!raf && inView && !RM.matches) raf = requestAnimationFrame(frame); }
function frame(now) {
  raf = 0;
  if (!S || !inView) return;
  const q = S.seq, Q = QUESTIONS[q.qi % QUESTIONS.length], dt = now - q.t;
  let pulse = null; // distance along entry + loop, when the pulse is out
  if (q.phase === 'type') {
    const n = Math.floor(dt / TYPE_MS);
    typeTo(Q, n, true);
    S.who.classList.add('on');
    if (n >= Q.length) { q.phase = 'hold'; q.t = now; }
  } else if (q.phase === 'hold') {
    typeTo(Q, Q.length, Math.floor(dt / 260) % 2 === 0);
    if (dt >= HOLD_MS) { q.phase = 'run'; q.t = now; }
  } else if (q.phase === 'run') {
    typeTo(Q, Q.length, false);
    S.who.classList.remove('on');
    pulse = dt / 1000 * (S.len / PERIOD);
    if (pulse > S.e + LAPS * S.len) { q.phase = 'rest'; q.t = now; pulse = null; }
  } else if (q.phase === 'rest') {
    S.qt.style.opacity = Math.max(0, 1 - dt / REST_MS).toFixed(2);
    if (dt >= REST_MS) { q.qi++; q.phase = 'type'; q.t = now; S.qt.style.opacity = 1; S.shown = ''; }
  }
  // the dot and its trail: first the dashed wire from the human into the loop, then around it
  const E = S.entry;
  const at = s => {
    if (s < S.e) { const t = s / S.e; return { x: E.x0 + (E.x1 - E.x0) * t, y: E.y0 + (E.y1 - E.y0) * t }; }
    return S.path.at(s - S.e);
  };
  S.trail.forEach((c, k) => {
    const s = pulse == null ? -1 : pulse - k * 7;
    if (s < 0) { c.setAttribute('opacity', 0); return; }
    const p = at(s);
    c.setAttribute('cx', p.x.toFixed(1)); c.setAttribute('cy', p.y.toFixed(1));
    c.setAttribute('opacity', (0.9 * (1 - k / S.trail.length)).toFixed(2));
    c.style.fill = dotColour(s);
  });
  const u = pulse == null || pulse < S.e ? null : (pulse - S.e) % S.len;
  for (const s of S.spans) s.blk.classList.toggle('on', u != null && u >= s.a - 6 && u <= s.b + 26);
  for (const l of S.labs) l.node.classList.toggle('on', u != null && Math.abs(u - l.s) < 40);
  S.orc.classList.toggle('on', pulse != null && ((pulse > S.e - 30 && pulse < S.e) || (u != null && (u < 30 || u > S.len - 30))));
  kick();
}

new IntersectionObserver(es => { inView = es[0].isIntersecting; if (inView) kick(); }, { threshold: 0.1 }).observe(box);
let rw = 0;
new ResizeObserver(() => { const w = Math.round(box.clientWidth); if (w !== rw) { rw = w; draw(); } }).observe(box);
RM.addEventListener?.('change', () => draw());
document.fonts?.ready.then(() => draw()); // the lists, tags and bubble are measured in the page's faces
