// js/tech/law.js — the ONE shared <defs> (DF-TO-000). Identical bytes wherever emitted.
// Hatches: angle first, pitch second — h45 steel 7px · h135 adjacent part ·
// f45 alloy 4px · f135 · pot 2.6px. 1-bit photocopy rule: ink #111 on #fff only.
export function defsBlock() {
  const hat = (id, rot, wpx, sw) =>
    `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${wpx}" height="${wpx}" patternTransform="rotate(${rot})"><line x1="0" y1="0" x2="0" y2="${wpx}" stroke="#111" stroke-width="${sw}"/></pattern>`;
  return '<defs>' +
    hat('h45', 45, 7, 0.8) + hat('h135', -45, 7, 0.8) +
    hat('f45', 45, 4, 0.6) + hat('f135', -45, 4, 0.6) +
    hat('pot', 45, 2.6, 0.5) +
    '<pattern id="xmesh" patternUnits="userSpaceOnUse" width="5" height="5"><path d="M0,0 L5,5 M5,0 L0,5" stroke="#111" stroke-width="0.5"/></pattern>' +
    '<marker id="ar" markerWidth="12" markerHeight="9" refX="11" refY="4.5" orient="auto-start-reverse"><path d="M0,1 11,4.5 0,8 Z" fill="#111"/></marker>' +
    '</defs>';
}
