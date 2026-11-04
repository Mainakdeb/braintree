// Image rule (policy confirmed by the authors): the page shows the original stimuli Braintree used in its runs. An image is
// shown if and only if its `safe` flag is true, read at runtime (files may be swapped in place). No other gating.
// The note about the images comes from paper.json `image_note`, also read at runtime.

/** A thumbnail entry may be shown only if its flag says so. */
export function isSafe(t) {
  return !!(t && t.safe === true && typeof t.src === 'string');
}

/** First safe image per arm (used to decide whether a node has images at all). */
export function nodeThumbs(n) {
  const th = n && n.thumbs;
  const total = th ? (th.a || []).length + (th.b || []).length : 0;
  if (!th || !total) return { a: null, b: null, withheld: false, none: true };
  const a = (th.a || []).find(isSafe) || null, b = (th.b || []).find(isSafe) || null;
  return { a, b, withheld: !a || !b };
}

/** Up to k pairs where both images are safe (canvas strips). Paired edits stay index-aligned (base i -> edit i). */
export function nodeThumbsAll(n, k = 5) {
  const th = n && n.thumbs;
  if (!th) return { a: [], b: [], any: false };
  const A = th.a || [], B = th.b || [], a = [], b = [];
  if (n.paired) {
    for (let i = 0; i < Math.min(k, Math.max(A.length, B.length)); i++) if (isSafe(A[i]) && isSafe(B[i])) { a.push(A[i]); b.push(B[i]); }
  } else {
    const xa = A.filter(isSafe), xb = B.filter(isSafe);
    for (let i = 0; i < Math.min(k, xa.length, xb.length); i++) { a.push(xa[i]); b.push(xb[i]); }
  }
  return { a, b, any: a.length > 0 };
}

/** Up to k images per arm for the hover card. Paired edits stay index-aligned (an unsafe image leaves its slot empty). */
export function nodeThumbsCardAll(n, k = 5) {
  const th = n && n.thumbs;
  const total = th ? (th.a || []).length + (th.b || []).length : 0;
  if (!th || !total) return { a: [], b: [], none: true, any: false };
  const A = th.a || [], B = th.b || [];
  let a, b;
  if (n.paired) {
    a = []; b = [];
    for (let i = 0; i < Math.min(k, Math.max(A.length, B.length)); i++) {
      if (isSafe(A[i]) || isSafe(B[i])) { a.push(isSafe(A[i]) ? A[i] : null); b.push(isSafe(B[i]) ? B[i] : null); }
    }
  } else {
    a = A.filter(isSafe).slice(0, k); b = B.filter(isSafe).slice(0, k);
  }
  return { a, b, none: false, any: a.some(Boolean) || b.some(Boolean) };
}

export const SHARED = (document.documentElement.dataset.root || '') + 'shared/';   // data-root lets a page in a subfolder reuse shared/
export const imgURL = t => SHARED + t.src;
