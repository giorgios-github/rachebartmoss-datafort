// Build a Leaflet tile pyramid (XYZ, CRS.Simple) for the North-America map's raster layers
// (cartography = layer4, place-names = layer2) from img/maps/usa-source.svg, using Inkscape.
//
// Run:  node scripts/build-map-tiles.mjs            (writes /tmp action files + tile dirs)
//   then: inkscape --shell < /tmp/wm-tiles-actions.txt   (renders every tile in one process)
//   then: node scripts/build-map-tiles.mjs --prune  (delete blank tiles)
//
// Tiles land in img/maps/tiles/<layer>/<z>/<x>/<y>.png. Leaflet config (in js/nightcity.js):
//   PPU, W, H, Z below must match the map setup.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRC = path.join(ROOT, 'img/maps/usa-source.svg');
const OUTDIR = path.join(ROOT, 'img/maps/tiles');
const TILE = 256, Z = 5;                       // deepest level → full width = 256*2^5 = 8192px
const LAYERS = { carto: 'layer4', text: 'layer2' };

let svg = fs.readFileSync(SRC, 'utf8').replace(/Flexi IBM VGA False/g, 'Terminal Grotesque').replace(/sans-serif/g, 'Terminal Grotesque');
// CRITICAL: strip the root <svg> width/height (they are in mm). With them present, Inkscape's
// --export-area numbers are interpreted in px (document space) while the runtime marker layer places
// icons in viewBox user-units — a ~1.0665x scale mismatch that misaligns icons more the further they
// are from the origin. Removing width/height makes user-units == px (1:1), so tiles and markers share
// ONE coordinate system (the viewBox). See _WM_VB / PPU in js/nightcity.js.
svg = svg.replace(/<svg\b[^>]*>/, function (tag) { return tag.replace(/\s(width|height)="[^"]*"/g, ''); });
const vb = svg.match(/viewBox="([^"]+)"/)[1].trim().split(/\s+/).map(Number);
const VBW = vb[2], VBH = vb[3];
const W = TILE * Math.pow(2, Z), PPU = W / VBW, H = Math.round(VBH * PPU);

if (process.argv.includes('--prune')) {
  let del = 0, kept = 0;
  (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (e.name.endsWith('.png')) { if (fs.statSync(p).size < 360) { fs.unlinkSync(p); del++; } else kept++; } } })(OUTDIR);
  console.log('pruned blank tiles:', del, ' kept:', kept);
  process.exit(0);
}

function isolate(keepId) {
  let s = svg;
  Object.values(LAYERS).concat(['layer1', 'layer3']).forEach(function (id) {
    if (id === keepId) return;
    s = s.replace(new RegExp('(<g\\b[^>]*\\sid="' + id + '")'), '$1 style="display:none"');
  });
  return s;
}

const lines = [];
let total = 0;
for (const [name, id] of Object.entries(LAYERS)) {
  const file = '/tmp/wm-' + name + '.svg';
  fs.writeFileSync(file, isolate(id));
  lines.push('file-open:' + file);
  // Cartography is the bottom layer → opaque WHITE field (land has no fill). Text stays transparent.
  lines.push('export-background:#ffffff');
  lines.push('export-background-opacity:' + (name === 'carto' ? '1.0' : '0.0'));
  for (let z = 0; z <= Z; z++) {
    const F = Math.pow(2, Z - z), sizeU = (TILE * F) / PPU;
    const gx = Math.ceil(W / (TILE * F)), gy = Math.ceil(H / (TILE * F));
    for (let x = 0; x < gx; x++) for (let y = 0; y < gy; y++) {
      const x0 = x * sizeU, y0 = y * sizeU;
      if (x0 >= VBW || y0 >= VBH) continue;            // tile fully outside the artwork
      const dir = path.join(OUTDIR, name, String(z), String(x));
      fs.mkdirSync(dir, { recursive: true });
      lines.push('export-area:' + x0.toFixed(3) + ':' + y0.toFixed(3) + ':' + (x0 + sizeU).toFixed(3) + ':' + (y0 + sizeU).toFixed(3));
      lines.push('export-width:' + TILE); lines.push('export-height:' + TILE);
      lines.push('export-filename:' + path.join(dir, y + '.png'));
      lines.push('export-do');
      total++;
    }
  }
  lines.push('file-close');
}
fs.writeFileSync('/tmp/wm-tiles-actions.txt', lines.join('\n') + '\n');   // EOF exits the shell
console.log('layers:', Object.keys(LAYERS).join(','), ' tiles:', total, ' PPU:', PPU.toFixed(4), ' W:', W, ' H:', H, ' Z:', Z);
