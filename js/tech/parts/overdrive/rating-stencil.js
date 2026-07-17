// parts/overdrive/rating-stencil.js — maker's rating plate + its STRUCK state.
// The strike is deliberate design language (owner customization), never wear.
import { L, C, RC, TX, frame, fitK, W, QUANT } from '../lib.js';

export const meta = {
  id: 'rating-stencil', bin: 'OVERDRIVE', label: 'RATING STENCIL',
  params: { rating: { def: '1.0' }, struck: { def: false }, newRating: { def: '+2' } },
  slots: [],
  functions: { provides: ['indicate (rated envelope, human-readable)'], needs: [], rates: {} },
  envelope: { rated: 1, pushMax: 0, instabilityPerPush: 0 },
  pushedDraw: ['the stencil IS the pushed-state drawable of its host: pushing strikes it through and scrawls the new figure beside — drawn, never badged'],
  graftsInto: ['every part face (it is paint)'],
  variants: [
    { label: 'RATED 1.0', p: {} },
    { label: 'STRUCK → +2', p: { struck: true } },
    { label: 'RATED 0.5 · STRUCK → +1', p: { rating: '0.5', struck: true, newRating: '+1' } }
  ]
};
const norm = p => ({ rating: String(p?.rating ?? '1.0'), struck: !!p?.struck, newRating: String(p?.newRating ?? '+2') });

export function draw(p, view = {}) {
  const q = norm(p), heavy = view.lod === 'thumb', dens = view.density ?? 2;
  const Wm = 22, Hm = 8;
  const k = view.k ?? fitK(Wm + 10, Hm + 6, view.fit ?? 150);
  const wpx = Wm * k, hpx = Hm * k;
  // stencil frame: corner ticks only (paint through a mask, not an engraved plate)
  let out = '';
  for (const [cx, cy, dx, dy] of [[0, 0, 1, 1], [wpx, 0, -1, 1], [wpx, hpx, -1, -1], [0, hpx, 1, -1]]) {
    out += L(cx, cy, cx + dx * 2.4 * k, cy, heavy ? W.cut : W.vis) + L(cx, cy, cx, cy + dy * 2.4 * k, heavy ? W.cut : W.vis);
  }
  const label = `RATED ${q.rating}`;
  out += TX(wpx / 2, hpx / 2 + (heavy ? 5 : 0.14 * hpx), heavy ? q.rating : label, heavy ? 4.6 * k : 2.6 * k, 'middle', true);
  if (q.struck) {
    // double strike, deliberate: two parallel bars at a set angle (design, not scribble)
    out += L(wpx * 0.08, hpx * 0.72, wpx * 0.92, hpx * 0.26, heavy ? W.cut : W.vis);
    out += L(wpx * 0.08, hpx * 0.88, wpx * 0.92, hpx * 0.42, heavy ? W.vis : W.mid);
    // new figure beside, hand voice (mono, not display)
    if (!heavy) out += TX(wpx + 3.4 * k, hpx / 2 + 4, q.newRating, 2.8 * k, 'start');
  }
  if (dens >= 3 && !heavy) out += TX(wpx / 2, hpx + 14, q.struck ? 'STRUCK = PUSHED HOST' : 'MAKER’S RATING', 8);
  return frame(wpx + (q.struck && !heavy ? 8 * k : 2 * k), hpx + (dens >= 3 && !heavy ? 18 : 2), out);
}
export function thumb(p) { return draw(norm(p ?? {}), { lod: 'thumb', density: 1, fit: 52 }); }
export function binGlyph() { return thumb({ struck: true }); }
