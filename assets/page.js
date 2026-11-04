// Braintree paper page · title block, the three results (numbers, then two investigation trees), BibTeX, footer.
import { isSafe, imgURL } from './safety.js?v=h46';

const DATA = (document.documentElement.dataset.root || '') + 'shared/data/';
const RM = matchMedia('(prefers-reduced-motion: reduce)');
const REDUCED = () => RM.matches;
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const fD = (d, k = 2) => (d >= 0 ? '+' : '−') + Math.abs(d).toFixed(k);
const frac = v => `<b>${v[0]}</b> of <b>${v[1]}</b>`;
const getJSON = p => fetch(DATA + p, { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); });
const safe = arr => (arr || []).filter(isSafe);
const short = s => String(s).replace(/^CLIP-/, '');
const arm = s => String(s || '').replace(/_/g, ' ');
const img = (t, alt = '') => t ? `<img src="${imgURL(t)}" alt="${esc(alt)}" loading="lazy" decoding="async">` : `<span class="nim"></span>`;

let paper;

async function main() {
  paper = await getJSON('paper.json');
  titleBlock(paper);
  bib(paper);
  footer(paper);
  texts(paper);
  getJSON('replications.json').then(R => { repText(R); repNums(R); }).catch(e => console.error(e));
  Promise.all(TREES.map(([id]) => getJSON(`trees/${id}.json`))).then(investigation).catch(e => console.error(e));
  Promise.all(MODEL_TREES.map(([id]) => getJSON(`trees/${id}.json`))).then(modelInvestigation).catch(e => console.error(e));
}

/* ------------------------------------------------------------------ title, texts */

function titleBlock(p) {
  $('subtitle').textContent = p.tagline;
  $('authors').innerHTML = p.authors.map(a => `<li>${esc(a.name)}<sup>${a.aff.join(',')}</sup></li>`).join('');
  $('affs').innerHTML = p.affiliations.map((a, i) => `<span><sup>${i + 1}</sup>${esc(a)}</span>`).join('');
  const L = p.links || {};
  const at = h => (h || '').replace(/^(\.\.\/)+/, ''); // paper.json is shared with the drafts, whose links start ../../
  const live = h => at(h) && at(h) !== '#';
  const link = (k, href, ext) => live(href) ? `<a href="${esc(at(href))}"${ext ? ' target="_blank" rel="noopener"' : ''}>${k}${ext ? ' ↗' : ''}</a>` : `<span class="off" aria-label="${k}: not yet available">${k} · soon</span>`;
  $('links').innerHTML = [
    link('Preprint', live(L.biorxiv) ? L.biorxiv : L.paper, true),   // the bioRxiv preprint once it is up, else the PDF
    link('Code', L.code, true),
    live(L.data) && link('Data', L.data, true),
    `<a href="#cite">BibTeX ↓</a>`,
  ].filter(Boolean).join('');
}

function texts(p) {
  $('regions-text').innerHTML = `FFA and OFA both respond strongly to faces; PPA and RSC both respond selectively to scenes. What kind of stimuli might drive one region more than the other? Braintree proposes candidate dimensions from what is known about the two regions, builds images that vary one dimension while controlling the rest, and uses each result to design the next experiment.`;
  $('models-text').innerHTML = `How do we tell models of the brain apart? Many now predict its responses about equally well. Braintree searched for the stimuli on which two of them, CLIP models of the same region built on a convolutional network and on a vision transformer, make the most divergent, or controversial, predictions.`;
}
function repText() {
  $('rep-text').innerHTML = `Given only a paper, Braintree works out which finding it reports, rebuilds the experiment, runs it on an in-silico brain model and analyzes the result: first with the authors' original stimuli, then with new ones it builds from scratch.`;
}
function repNums(R) {
  const t = R.totals;
  const n = (v, l) => `<div class="nm"><b>${v[0]}<small>/${v[1]}</small></b><span>${l}</span></div>`;
  $('rep-nums').innerHTML = n(t.replicated, 'published findings replicated, with new stimuli Braintree built')
    + n(t.reproduced, 'reproduced with the authors’ original stimuli')
    + n(t.replicated_of_reproduced, 'of those replicated again, with new stimuli');
}

/* ------------------------------------------------------------------ shared: segmented buttons, the stimulus panel */

function seg(nav, items, onPick) {
  nav.innerHTML = items.map(it => `<button type="button" data-k="${esc(it.k)}" aria-pressed="false">${esc(it.label)}${it.n ? `<span class="n">${esc(it.n)}</span>` : ''}</button>`).join('');
  const bs = [...nav.querySelectorAll('button')];
  const pick = k => { bs.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.k === k))); onPick(k); };
  bs.forEach(b => b.addEventListener('click', () => pick(b.dataset.k)));
  return pick;
}

// two rows of up to five stimuli, labelled; paired edits stay column-aligned
function strips(rows) {
  return `<div class="st">${rows.map(([lab, arr]) => `<div class="st-l">${esc(lab)}</div><div class="st-r">${Array.from({ length: 5 }, (_, i) => arr[i] ? `<span class="st-i" style="--i:${i}">${img(arr[i], lab)}</span>` : (i < arr.length || !arr.length ? '<span class="st-i none"></span>' : '')).join('')}</div>`).join('')}</div>`;
}

/* ------------------------------------------------------------------ the investigation tree (Figures 2 and 3) */
// Each dot is one experiment of a Braintree campaign: across, the wave it ran in; up, D toward side A; down, toward side B.
// Lines show which experiment led to which; the splits carry their stimuli. The tree grows wave by wave when it comes
// into view (and on replay); hover a dot for its stimuli and its line of descent. Figure 2 is a pair of regions, Figure 3
// a pair of models of one region; every experiment is built and read on in-silico models.

const TREES = [['ffa_ofa', 'FFA · OFA'], ['ppa_rsc', 'PPA · RSC']];
const MODEL_TREES = [['models_ppa', 'PPA'], ['models_ffa', 'FFA'], ['models_eba', 'EBA']];

function armNames(n) {
  if (n.arms && n.arms.a && n.arms.b) return [n.arms.a, n.arms.b];   // named from the run's record (tools/arm_names.py)
  const r = n.recipe;
  if (r && (r.a || r.b)) {
    const said = x => { const p = String(x.params?.prompt || '').trim(); if (!p) return ''; if (/^no change$/i.test(p)) return 'original'; const c = p.split(/[,;]/)[0].replace(/^(?:make|turn|render|redraw|change)\s+(?:the\s+|a\s+|an\s+)?(?:\w+\s+)?(?:look\s+like|into|appear|be)\s+/i, '').replace(/^make\s+(?:the\s+)?\w+\s+(?=(?:a|an)\s)/i, '').replace(/^make (the |a |an )?/i, ''); return c.length > 30 ? c.slice(0, 29).replace(/\s+\S*$/, '') + '…' : c; };
    const nm = x => !x ? '' : said(x) || (x.op && x.op !== 'none' ? arm(x.op) : x.pool ? arm(x.pool) : '');
    return [nm(r.a) || 'edit', nm(r.b) || (n.paired ? 'original' : arm(r.base || 'base'))];
  }
  const m = /^(.*?)\s+(?:versus|vs\.?|against)\s+(.*)$/i.exec(n.label || '');
  return m ? [m[1], m[2]] : [n.label || 'these photos', 'comparison photos'];
}

// The panel's one line: "<manipulation> activates PPA more than RSC", side names in their arrow colours. The subject is the
// experiment's label ("upside down faces"); "X versus Y" becomes X, compared with Y; the head noun picks activate/activates.
const HARD = /^(by|with|without|into|as|on|in|to|from|upright|versus|against)$/i;
const AFTER = /^(by|with|without|into|as|on|in|to|from|upright|alone|small|childlike|down|up|away)$/i;
const ADJ = /^(indoor|outdoor|night|day|face|close-up|greyscale|grayscale|colour|color|empty|open|enclosed|natural|plain|high|low|coarse|fine|small|large|global|local|upright|inverted|intact|whole|real|fake)$|(ed|al|ic|ous|ful|ive|less)$/i;
function subject(label) {
  let x = String(label || 'this manipulation').trim(), cmp = '';
  const vs = /^(.*?)\s+(?:versus|vs\.?|against)\s+(.*)$/i.exec(x);
  if (vs) { x = vs[1]; cmp = vs[2]; if (!/\s/.test(x) && /\s/.test(cmp) && ADJ.test(x)) x += ' ' + cmp.split(/\s+/).pop(); }
  const w = x.split(/\s+/); let end = w.length;
  for (let i = 1; i < w.length; i++) {
    if (HARD.test(w[i]) || (/ing$/i.test(w[i]) && i < w.length - 1) || (/(ed|en|shrunk)$/i.test(w[i]) && (i === w.length - 1 || AFTER.test(w[i + 1])))) { end = i; break; }
  }
  const head = w.slice(0, end), hw = head[head.length - 1] || '';
  const plural = head.includes('and') || /^(people|children|men|women|feet|teeth)$/i.test(hw) || (/s$/i.test(hw) && !/(ss|us|is)$/i.test(hw));
  return { x: x.charAt(0).toUpperCase() + x.slice(1), cmp, plural };
}
function sentence(n, A, B, R, bb) {
  if (n.pending) return `${esc(subject(n.label).x)}: no reading.`;
  const { x, cmp, plural } = subject(n.arms ? n.arms.a : n.label), v = plural ? 'activate' : 'activates';   // the named set A when the run named it
  const a = `<b class="ga">${esc(A)}</b>`, b = `<b class="gb">${esc(B)}</b>`, [fav, oth] = n.D > 0 ? [a, b] : [b, a];
  const vs = cmp || (n.arms ? bb : bb === 'original' ? 'the original images' : bb && bb !== 'comparison photos' ? bb : '');
  const than = vs ? `, compared with ${esc(vs)}` : '', even = Math.abs(n.D) < paper.models.bound, sure = n.state === 'hit';
  if (R) return even ? `${esc(x)} ${v} ${esc(R)} about equally in ${a} and ${b}${than}.`
    : `${esc(x)} ${v} ${esc(R)} more in ${fav} than in ${oth}${than}${sure ? '' : ', though not in every person'}.`;
  return even ? `${esc(x)} ${v} ${a} and ${b} about equally${than}.` : `${esc(x)} ${v} ${fav} more than ${oth}${than}${sure ? '' : ', but not reliably'}.`;
}

class InvTree {
  // o: { keep(n), names: [A, B], region (a model pair: name the region), up(A), down(B), split, agree, dLabel(A, B) }
  constructor(host, panel, play, o) {
    this.host = host; this.panel = panel; this.o = o; this.sel = null;
    // the dots' hit areas live in a layer above the pictures, so a dot under a picture can still be hovered and clicked
    host.innerHTML = `<div class="it"><svg class="it-svg" aria-hidden="true"></svg><div class="it-pics"></div><svg class="it-svg it-top" aria-hidden="true"></svg></div>`;
    this.box = host.firstElementChild; this.svg = this.box.firstElementChild; this.pics = this.svg.nextElementSibling; this.top = this.box.lastElementChild;
    new ResizeObserver(() => { const w = Math.round(host.clientWidth); if (w && w !== this.w) { this.w = w; if (this.T) this.draw(); } }).observe(host);
    new IntersectionObserver((es, ob) => { if (es[0].isIntersecting) { this.seen = true; this.grow(); ob.disconnect(); } }, { threshold: 0.3 }).observe(host);
    play.addEventListener('click', () => this.grow(true));
    this.box.addEventListener('pointerleave', () => { if (!this.pinned) this.pick(this.home, true); });
  }
  // a click keeps the card on that experiment until the same one is clicked again
  pin(n) {
    if (this.pinned === n) { this.pinned = null; this.box.classList.remove('pinned'); return; }
    this.pinned = null; this.pick(n); this.pinned = n; this.box.classList.add('pinned');
  }
  hover(n) { if (!this.pinned) this.pick(n); }
  set(T) {
    this.pinned = null; this.box.classList.remove('pinned');
    this.T = T; this.prep(); this.draw();
    this.pick(this.home, true);
    if (this.seen) this.grow(true);
  }
  get names() { return this.o.names || [this.T.a, this.T.b]; }
  prep() {
    const keep = this.o.keep || (() => true), all = new Map(this.T.nodes.map(n => [n.id, n]));
    const nodes = this.T.nodes.filter(keep).map(n => ({ ...n, D: n.D ?? 0, pending: n.D == null, wave: n.wave || 1 }));
    const by = new Map(nodes.map(n => [n.id, n]));
    for (const n of nodes) {
      let p = all.get(n.parent);
      while (p && !by.has(p.id)) p = all.get(p.parent);   // through any experiment that is not drawn
      n.par = p ? by.get(p.id) : null; n.from = all.get(n.parent) || null; n.kids = []; n.anc = false;
    }
    for (const n of nodes) if (n.par) n.par.kids.push(n);
    for (const n of nodes) if (n.state === 'hit') for (let p = n.par; p; p = p.par) p.anc = true;
    for (const n of nodes) { let d = 0; for (let p = n.par; p; p = p.par) d++; n.depth = d; }
    this.nodes = nodes; this.drawn = by; this.Wv = Math.max(...nodes.map(n => n.wave));
    // the node shown first: the most promising experiment. A finding before a plain hit (confirmed and clean, then
    // confirmed with a confound, then sent to confirm and not confirmed), a hit before a flat read, the experiment
    // before its confirmation run, then the larger effect
    const LEVEL = { confirmed: 3, confirmed_confounded: 2, not_confirmed: 1 };
    const score = n => [LEVEL[n.finding] || 0, n.state === 'hit' ? 1 : 0, n.confirm ? 0 : 1, Math.abs(n.D)];
    const better = (a, b) => { const x = score(a), y = score(b); for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] > y[i]; return false; };
    const cand = nodes.filter(n => n.state === 'hit' || n.finding);
    this.home = cand.length ? cand.reduce((a, b) => (better(b, a) ? b : a)) : nodes[0];
  }
  draw() {
    const W = this.host.clientWidth, mob = W < 560, H = mob ? 420 : 480;
    const L = mob ? 58 : 84, R = 16, Tp = 18, Bt = 46, PW = W - L - R, PH = H - Tp - Bt;
    const nodes = this.nodes, Wv = this.Wv, [A, B] = this.names, b = paper.models.bound;
    const ym = Math.max(0.3, Math.ceil((Math.max(...nodes.map(n => Math.abs(n.D))) + 0.06) * 10) / 10);
    const y = v => Tp + (ym - v) / (2 * ym) * PH;
    const x0 = L + 12, colW = (PW - 30) / Wv, xc = w => L + 30 + (w - 0.5) * colW;
    // a beeswarm inside each wave's column: splits first, so they sit on the column's spine
    const r = mob ? 2.5 : 3.1, gap = r * 2 + 1.4;
    for (let w = 1; w <= Wv; w++) {
      const col = nodes.filter(n => n.wave === w).sort((p, q) => (q.state === 'hit') - (p.state === 'hit') || Math.abs(q.D) - Math.abs(p.D));
      const placed = [];
      for (const n of col) {
        const cy = y(n.D); let off = 0;
        for (let k = 0; k < 60; k++) {
          const o = k === 0 ? 0 : (k % 2 ? 1 : -1) * Math.ceil(k / 2) * gap;
          if (Math.abs(o) > colW / 2 - 5) break;
          off = o;
          if (placed.every(p => Math.hypot(p.x - (xc(w) + o), p.y - cy) >= gap)) break;
        }
        n.x = xc(w) + off; n.y = cy; placed.push(n);
      }
    }
    const tk = []; const st = ym > 0.5 ? 0.2 : 0.1;
    for (let v = -Math.floor(ym / st) * st; v <= ym + 1e-9; v += st) tk.push(+v.toFixed(2));
    const ax = mob ? 20 : 28, y0 = y(0);
    const edge = n => { const p = n.par || { x: x0, y: y0 }, dx = (n.x - p.x) * 0.5; return `M${p.x.toFixed(1)} ${p.y.toFixed(1)} C${(p.x + dx).toFixed(1)} ${p.y.toFixed(1)} ${(n.x - dx).toFixed(1)} ${n.y.toFixed(1)} ${n.x.toFixed(1)} ${n.y.toFixed(1)}`; };
    const dir = n => (n.D > 0 ? 'ga' : 'gb');
    const up = (this.o.up || (s => `drives ${s} more →`))(A), down = (this.o.down || (s => `drives ${s} more →`))(B);
    this.svg.setAttribute('viewBox', `0 0 ${W} ${H}`); this.svg.setAttribute('width', W); this.svg.setAttribute('height', H);
    this.svg.innerHTML = `
      <rect x="${L}" y="${y(b)}" width="${PW}" height="${y(-b) - y(b)}" class="it-band"/>
      ${tk.map(v => `<line x1="${L}" x2="${L + PW}" y1="${y(v)}" y2="${y(v)}" class="it-g${v === 0 ? ' z' : ''}"/><text x="${L - 8}" y="${y(v) + 3.5}" class="it-t" text-anchor="end">${v === 0 ? '0' : fD(v, 1)}</text>`).join('')}
      <text x="${L + PW / 2}" y="${H - Bt + 22}" class="it-w" text-anchor="middle">time →</text>
      <text x="${L}" y="${Tp - 6}" class="it-w" text-anchor="start">${esc(this.o.yLabel || 'predicted by in-silico brain models')}</text>
      <path d="M${ax} ${y0 - 6} V${Tp + 2}" class="it-ar ga"/><path d="M${ax - 4} ${Tp + 9} L${ax} ${Tp + 1} L${ax + 4} ${Tp + 9}" class="it-ah ga"/>
      <path d="M${ax} ${y0 + 6} V${Tp + PH - 2}" class="it-ar gb"/><path d="M${ax - 4} ${Tp + PH - 9} L${ax} ${Tp + PH - 1} L${ax + 4} ${Tp + PH - 9}" class="it-ah gb"/>
      <text transform="translate(${ax - 6} ${y0 - 12}) rotate(-90)" class="it-ya ga">${esc(up)}</text>
      <text transform="translate(${ax - 16} ${y0 + 12}) rotate(90)" class="it-ya gb">${esc(down)}</text>
      <g class="it-es">${nodes.map((n, i) => `<path d="${edge(n)}" pathLength="1" class="e${n.state === 'hit' ? ' hit ' + dir(n) : n.anc ? ' anc' : ''}" data-i="${i}" style="--w:${n.wave}"/>`).join('')}</g>
      <circle cx="${x0}" cy="${y0}" r="5" class="it-root"/>
      <g class="it-ns">${nodes.map((n, i) => `<circle cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="${n.state === 'hit' ? r + 1.8 : r}" class="n${n.state === 'hit' ? ' hit ' + dir(n) : ''}${n.pending ? ' pend' : ''}" data-i="${i}" style="--w:${n.wave}"/>`).join('')}</g>`;
    this.top.setAttribute('viewBox', `0 0 ${W} ${H}`); this.top.setAttribute('width', W); this.top.setAttribute('height', H);
    this.top.innerHTML = `<g class="it-hit">${nodes.map((n, i) => `<circle cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="${gap * 0.75}" data-i="${i}"/>`).join('')}</g>`;
    this.edges = [...this.svg.querySelectorAll('.it-es path')];
    this.dots = [...this.svg.querySelectorAll('.it-ns circle')];
    this.top.querySelectorAll('.it-hit circle').forEach(c => {
      c.addEventListener('pointerenter', () => this.hover(nodes[+c.dataset.i]));
      c.addEventListener('click', () => this.pin(nodes[+c.dataset.i]));
    });
    // the splits, pictured: an image of the manipulation with a leader line to its dot, kept on its own side of the band
    const sz = mob ? 38 : 52, many = nodes.filter(n => n.state === 'hit').length > 14;
    this.pics.innerHTML = '';
    const side = n => (n.x > L + PW - 60 ? -1 : 1);
    const pic = nodes.filter(n => n.state === 'hit').map(n => {
      const t = safe(n.thumbs?.a)[0] || safe(n.thumbs?.b)[0];
      return t ? { n, t, px: n.x + side(n) * sz * 0.9, py: n.y + (n.D > 0 ? -1 : 1) * sz * 0.4 } : null;
    }).filter(Boolean);
    const s2 = many ? sz * 0.82 : sz;
    for (let it = 0; it < 180; it++) {
      for (let i = 0; i < pic.length; i++) for (let j = i + 1; j < pic.length; j++) {
        const a = pic[i], c = pic[j], dx = c.px - a.px, dy = c.py - a.py, dd = Math.hypot(dx, dy) || 0.01, m = s2 + 5;
        if (dd < m) { const f = (m - dd) / 2 / dd; a.px -= dx * f; a.py -= dy * f; c.px += dx * f; c.py += dy * f; }
      }
      for (const q of pic) {
        q.px += (q.n.x + side(q.n) * s2 * 0.9 - q.px) * 0.04; q.py += (q.n.y - q.py) * 0.04;
        q.px = clamp(q.px, L + s2 / 2 + 2, L + PW - s2 / 2 - 2); q.py = clamp(q.py, Tp + s2 / 2, Tp + PH - s2 / 2);
        if (q.n.D > 0) q.py = Math.min(q.py, y(b) - s2 / 2 - 2); else q.py = Math.max(q.py, y(-b) + s2 / 2 + 2);
      }
    }
    for (const q of pic) {
      const e = document.createElement('button');
      e.type = 'button'; e.className = `ip ${dir(q.n)}`; e.style.setProperty('--w', q.n.wave);
      e.style.transform = `translate3d(${q.px.toFixed(1)}px, ${q.py.toFixed(1)}px, 0)`;
      e.setAttribute('aria-label', `${q.n.label}: D ${fD(q.n.D)}`);
      const dx = q.n.x - q.px, dy = q.n.y - q.py;
      e.innerHTML = `<i class="ip-l" style="width:${Math.hypot(dx, dy).toFixed(1)}px;transform:rotate(${Math.atan2(dy, dx)}rad)"></i><span class="ip-f"><img src="${imgURL(q.t)}" alt="" decoding="async"></span>`;
      e.addEventListener('mouseenter', () => this.hover(q.n)); e.addEventListener('focus', () => this.hover(q.n)); e.addEventListener('click', () => this.pin(q.n));
      q.n.pic = e; this.pics.appendChild(e);
    }
    this.box.style.width = W + 'px'; this.box.style.height = H + 'px'; this.box.style.setProperty('--sz', s2 + 'px');
    if (REDUCED()) this.box.classList.add('grown', 'still');
    if (this.sel) this.mark(this.sel);
  }
  grow(replay) {
    if (REDUCED()) { this.box.classList.add('grown', 'still'); return; }
    if (replay) { this.box.classList.remove('grown'); void this.box.offsetWidth; }
    requestAnimationFrame(() => this.box.classList.add('grown'));
  }
  mark(n) {
    const line = new Set(); for (let p = n; p; p = p.par) line.add(p);
    this.box.classList.toggle('has-sel', !!n);
    this.edges.forEach((e, i) => e.classList.toggle('on', line.has(this.nodes[i])));
    this.dots.forEach((d, i) => { d.classList.toggle('on', line.has(this.nodes[i])); d.classList.toggle('sel', this.nodes[i] === n); });
    this.nodes.forEach(m => m.pic && m.pic.classList.toggle('sel', m === n));
  }
  pick(n, quiet) {
    if (!n || (this.sel === n && !quiet)) return;
    this.sel = n; this.mark(n);
    this.box.classList.toggle('quiet', !!quiet);
    const [A, B] = this.names, [aa, bb] = armNames(n), o = this.o;
    const hit = n.state === 'hit';
    const R = o.region ? (/\(([^)]+)\)/.exec(this.T.a)?.[1] || '') : null;
    const f = n.from;
    const from = !f ? 'from the opening question' : `followed from <b>${esc(f.label)}</b>`;
    const kids = n.kids.length ? ` · led to ${n.kids.length} more` : '';
    this.panel.classList.remove('in');
    this.panel.innerHTML = `<div class="tp">
      <div class="tp-a">
        <p class="pn-q">${sentence(n, A, B, R, bb)}</p><p class="tp-from">${from}${kids}</p></div>
      <div class="tp-b">${strips([[aa, safe(n.thumbs?.a)], [bb, safe(n.thumbs?.b)]])}</div>
      <div class="tp-c"><div class="pn-d"><b class="${hit ? (n.D > 0 ? 'ga' : 'gb') : ''}">${n.pending ? '—' : fD(n.D)}</b><span>${esc(o.dLabel ? o.dLabel(A, B) : `D = Δ${A} − Δ${B}, su`)}</span></div></div>
    </div>`;
    requestAnimationFrame(() => this.panel.classList.add('in'));
  }
}

// one figure: buttons for each campaign, the question line, the tree
function treeFigure(trees, list, pre, o) {
  const tree = new InvTree($(pre + '-plot'), $(pre + '-panel'), $(pre + '-play'), o);
  const by = new Map(trees.map(t => [t.id, t]));
  seg($(pre + '-seg'), list.filter(([id]) => by.has(id)).map(([id, label]) => ({ k: id, label })), id => {
    const T = by.get(id);
    $(pre + '-ask').innerHTML = `“${esc(T.ask)}” · every node tests a hypothesis.`;
    tree.set(T);
    document.dispatchEvent(new CustomEvent('bt:tree', { detail: { fig: pre, T } }));   // for add-ons such as the brain inset
  })(list[0][0]);
}

function investigation(trees) {
  treeFigure(trees, TREES, 'tree', {});
}

function modelInvestigation(trees) {
  const [A, B] = paper.numbers.models.pair.map(short);
  treeFigure(trees, MODEL_TREES, 'mod', {
    keep: n => n.kind === 'built', region: true,
    names: [A, B],
    up: s => `${s} predicts more →`, down: s => `${s} predicts more →`,
    split: 'split the models', agree: 'the models agree',
    dLabel: (a, b) => `D = Δ${a} − Δ${b}, su`,
  });
}

/* ------------------------------------------------------------------ cite, footer */

function bib(p) {
  $('bibtex').textContent = p.bibtex;
  const btn = $('copy');
  btn.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(p.bibtex); }
    catch { const r = document.createRange(); r.selectNodeContents($('bibtex')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); document.execCommand && document.execCommand('copy'); }
    btn.textContent = 'copied ✓'; btn.classList.add('ok');
    setTimeout(() => { btn.textContent = 'copy'; btn.classList.remove('ok'); }, 1800);
  });
}
function footer(p) {
  $('mails').innerHTML = p.emails.map(m => `<a href="mailto:${esc(m)}">${esc(m)}</a>`).join(' · ');
}

main().catch(e => console.error(e));
