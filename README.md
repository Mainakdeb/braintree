# Braintree

Project page for **Braintree: An agentic framework for in-silico vision neuroscience** (Mainak Deb, Ruolin Wang, Alish
Dipani, N. Apurva Ratan Murty; Georgia Tech). A static site with no build step: GitHub Pages serves this folder as it is.

- `index.html` and `assets/`: the page. `circuit.js` draws Figure 1 (the four protocols and their parts), `page.js` the
  replication numbers and the investigation trees (Figure 2: two pairs of regions; Figure 3: two models of one region),
  `safety.js` shows an image only when its `safe` flag is true. White by default; `?theme=dark` or the toggle for the
  dark look. Bump the `?v=` tags in `index.html` and the import in `page.js` together when the assets change.
- `shared/data/`: what the page shows, as JSON: `paper.json` (title, authors, abstract, headline numbers, links),
  `replications.json` (the 36 studies), `trees/*.json` (one Braintree campaign each).
- `shared/img/`: the stimulus thumbnails the trees show.

| Tree | Campaign |
|---|---|
| FFA · OFA | `ffa__vs__ofa__v4day1` (25 Oct 2026) |
| PPA · RSC | `ppa__vs__rsc__v4day1` (28 Oct 2026) |
| Models of FFA | `models_ffa__clip_rn50__vs__clip_vit_b32__v4h1` (28 Oct 2026) |
| Models of PPA, EBA | the paper's campaigns |

Preview locally: `python3 -m http.server` in this folder, then open http://localhost:8000/.

## Images and their sources

The thumbnails are the images Braintree used in its runs, drawn from public datasets under their own licences, and
Braintree's own edits of them (FLUX.2 [klein] 4B and the lab's algorithmic image operators). Faces and people: FFHQ,
CelebAMask-HQ, Stanford 40 Actions, LIP/ATR human parsing, 11k Hands. Scenes: Places365, ADE20K, SUN, COCO, NYU Depth v2,
HABS (Library of Congress). Objects and animals: THINGS, AFHQ, Oxford-IIIT Pets, Stanford Cars, Food-101, DTD, Google
Cartoon Set. Rights stay with the original owners.
