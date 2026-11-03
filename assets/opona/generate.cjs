// Generator opony tarczy (assets/opona): napisy ITBoom i "we can do IT" na łukach, cyfry binarne w grupach po 4,
// wygaszane przy napisach. Powstał w iteracjach w .scratch/opona (rundy 1-16), tu jest tylko wersja wybrana.
const fs = require('fs');
const path = require('path');
const OUT = __dirname;
fs.mkdirSync(OUT, { recursive: true });

const R = 500, HOLE = 318, BLEED = 30;
const O = '#F47C20', O2 = '#F9A15E', O3 = '#D8640E', K = '#000000', K2 = '#2C2C30', G = '#C9C9CF', G2 = '#E3E3E7', BG = '#FFFFFF';
const FONT = "'Segoe UI', 'Open Sans', Arial, sans-serif";
const pol = (r, deg) => { const a = (deg - 90) * Math.PI / 180; return [r * Math.cos(a), r * Math.sin(a)]; };
const f2 = n => +n.toFixed(2);
const angOf = ([x, y]) => ((Math.atan2(x, -y) * 180) / Math.PI + 360) % 360;
const mkRnd = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const poly = (pts, attrs) => `<polygon points="${pts.map(p => p.map(f2).join(',')).join(' ')}" ${attrs}/>`;
const tOf = p => Math.min(1, Math.max(0, (Math.hypot(...p) - HOLE) / (R - HOLE)));

const base = `<circle r="${R}" fill="${BG}"/>`;
const clip = `<clipPath id="ann"><path clip-rule="evenodd" d="M${-R},0a${R},${R} 0 1,0 ${2 * R},0a${R},${R} 0 1,0 ${-2 * R},0zM${-HOLE},0a${HOLE},${HOLE} 0 1,0 ${2 * HOLE},0a${HOLE},${HOLE} 0 1,0 ${-2 * HOLE},0z"/></clipPath>`;
const inner = `<circle r="${HOLE + 3}" fill="none" stroke="${G}" stroke-width="3"/>`;
const TR = 402;
const title = `<path id="tl" d="M${-TR},0A${TR},${TR} 0 0,1 ${TR},0" fill="none"/>
  <text font-family="${FONT}" font-size="150" font-weight="700" fill="${K}" letter-spacing="2" text-anchor="middle" dominant-baseline="middle">
  <textPath href="#tl" startOffset="50%">ITBoom</textPath></text>`;
const claim = `<path id="cl" d="M-418,0A418,418 0 0,0 418,0" fill="none"/>
  <text font-family="${FONT}" font-size="70" font-weight="700" fill="${O}" letter-spacing="12" text-anchor="middle" dominant-baseline="middle">
  <textPath href="#cl" startOffset="50%">we can do IT</textPath></text>`;

// Strefy napisów zmierzone na renderze. Poza nimi wolno wszędzie, także za krawędź.
let TITLE = { r0: 363, r1: 471, a: 39 }; // zmierzone pikselami na renderze przy 150 px, TR 402
const CLAIM = { r0: 378, r1: 441, a0: 140, a1: 222 }; // pomiar z rundy 12 (łuk 392) przesunięty na łuk 418
const blocked = (p, pad) => {
  const [x, y] = p, r = Math.hypot(x, y);
  const a = angOf(p), da = (pad / r) * 180 / Math.PI;
  if (r > TITLE.r0 - pad && r < TITLE.r1 + pad && (a < TITLE.a + da || a > 360 - TITLE.a - da)) return true;
  return r > CLAIM.r0 - pad && r < CLAIM.r1 + pad && a > CLAIM.a0 - da && a < CLAIM.a1 + da;
};
const inRing = (p, extra = 0) => { const r = Math.hypot(...p); return r > HOLE - extra && r < R + BLEED + extra; };
const anyBlocked = (pts, pad) => pts.some(p => blocked(p, pad));
const centroid = pts => [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];

// Warstwy wielokrotnego użytku.
const FADED_HEX = ['#FDEBDD', '#F3F3F5', '#EAEAEE', '#F8DCC6', '#FFFFFF', '#E2E2E7'];
// Siatka heksów. fill(c, t, rnd) zwraca kolor albo null (pusto); avoid = omijaj napisy.
function hexLayer({ s = 27, seed = 3, fill, avoid = true, gapPx = 3.5 }) {
  const rnd = mkRnd(seed), w = Math.sqrt(3) * s, o = [];
  for (let row = -24; row <= 24; row++) for (let col = -14; col <= 14; col++) {
    const c = [col * w + (row & 1 ? w / 2 : 0), row * s * 1.5];
    if (!inRing(c, s)) continue;
    const pts = [0, 1, 2, 3, 4, 5].map(i => { const [x, y] = pol(s - gapPx, i * 60); return [c[0] + x, c[1] + y]; });
    const col_ = fill(c, tOf(c), rnd, pts);
    if (!col_ || (avoid && anyBlocked([...pts, c], 6))) continue;
    o.push(poly(pts, `fill="${col_}"`));
  }
  return o.join('');
}
function triLayer({ L = 50, seed = 5, fill, avoid = true, stroke = BG }) {
  const rnd = mkRnd(seed), h = L * Math.sqrt(3) / 2, o = [];
  const jr = mkRnd(seed * 7 + 1), jit = new Map(), J = (i, j) => { const k = i + ',' + j; if (!jit.has(k)) jit.set(k, [(jr() - 0.5) * L * 0.28, (jr() - 0.5) * L * 0.28]); return jit.get(k); };
  const V = (i, j) => { const d = J(i, j); return [i * L / 2 + d[0], j * h + d[1]]; };
  for (let j = -Math.ceil(600 / h); j <= Math.ceil(600 / h); j++) for (let i = -Math.ceil(1200 / L); i <= Math.ceil(1200 / L); i++) {
    const up = (i + j) & 1, pts = up ? [V(i - 1, j + 1), V(i + 1, j + 1), V(i, j)] : [V(i - 1, j), V(i + 1, j), V(i, j + 1)];
    const c = centroid(pts);
    if (!inRing(c, 30)) continue;
    const col_ = fill(c, tOf(c), rnd);
    if (!col_ || (avoid && anyBlocked([...pts, c], 5))) continue;
    o.push(poly(pts, `fill="${col_}" stroke="${stroke}" stroke-width="2" stroke-linejoin="round"`));
  }
  return o.join('');
}
const strong = (rnd) => { const x = rnd(); return x < 0.4 ? O : x < 0.65 ? K : x < 0.85 ? G : O2; };
const strongTri = (rnd) => { const x = rnd(); return x < 0.22 ? O : x < 0.36 ? O2 : x < 0.48 ? O3 : x < 0.62 ? K : x < 0.72 ? K2 : x < 0.88 ? G : G2; };
const FADED_TRI = ['#FDEBDD', '#F9DFCB', '#F3F3F5', '#EAEAEE', '#E2E2E7', '#FFF4EC'];
const pickOf = arr => rnd => arr[Math.floor(rnd() * arr.length)];

// Lotki krążące wokół tarczy ze smugami.
function darts({ n = 24, seed = 17, minD = 125, sc = [1.0, 1.6], trail = true }) {
  const rnd = mkRnd(seed), o = [], placed = [];
  const dart = (p, rot, k, flight) => `<g transform="translate(${f2(p[0])} ${f2(p[1])}) rotate(${f2(rot)}) scale(${f2(k)})">
    <path d="M0,0L16,-2.2L16,2.2Z" fill="${K}"/><rect x="16" y="-5" width="30" height="10" rx="4" fill="${K}"/>
    <rect x="22" y="-5" width="3" height="10" fill="${G}"/><rect x="32" y="-5" width="3" height="10" fill="${G}"/>
    <rect x="46" y="-1.8" width="24" height="3.6" fill="${K2}"/>
    <path d="M58,0L80,-17L88,-17L76,0L88,17L80,17Z" fill="${flight}" stroke="${BG}" stroke-width="1.5"/></g>`;
  for (let tries = 0; tries < 6000 && placed.length < n; tries++) {
    const a = rnd() * 360, r = HOLE + 40 + rnd() * (R - HOLE), k = sc[0] + (sc[1] - sc[0]) * rnd();
    const h = a + 8 + rnd() * 10, dv = [Math.cos(h * Math.PI / 180), Math.sin(h * Math.PI / 180)], p = pol(r, a);
    const body = [0, 1, 2, 3, 4].map(i => [p[0] - dv[0] * 22 * i * k, p[1] - dv[1] * 22 * i * k]);
    if (anyBlocked(body, 8 + 8 * k) || body.some(q => Math.hypot(...q) < HOLE + 14) || placed.some(q => Math.hypot(q[0] - p[0], q[1] - p[1]) < minD)) continue;
    if (trail) {
      const tl = body[4], ta = angOf(tl), tr = Math.hypot(...tl), pts = [];
      for (let i = 1; i < 30; i++) { const q = pol(tr + i * 0.9, ta - 2 - i * 1.1); if (blocked(q, 6)) break; pts.push(q); }
      if (pts.length > 3) o.push(`<polyline points="${pts.map(q => q.map(f2).join(',')).join(' ')}" fill="none" stroke="${placed.length % 3 ? G : O2}" stroke-width="4" stroke-dasharray="10 9" stroke-linecap="round"/>`);
    }
    o.push(dart(p, h + 180, k, placed.length % 3 === 2 ? K : O));
    placed.push(p);
  }
  return o.join('');
}

// Runda 12: binarny wzór z rundy 6. Cyfry nie urywają się przy napisach: w pasie F px przed napisem maleją, bledną i rzedną.
// Odległość liczona od łuku napisu, więc margines jest zaokrąglony i biegnie równo z literami.
let ZONES = [{ ...TITLE, mid: 0, half: TITLE.a }, { r0: CLAIM.r0, r1: CLAIM.r1, mid: 180, half: (CLAIM.a1 - CLAIM.a0) / 2 }];
const textDist = p => Math.min(...ZONES.map(z => {
  const r = Math.hypot(...p), da = Math.max(0, Math.abs(((angOf(p) - z.mid + 540) % 360) - 180) - z.half) * Math.PI / 180;
  return Math.hypot(Math.max(0, z.r0 - r, r - z.r1), da * r);
}));
const claimT = (fill = O) => `<path id="cl" d="M-418,0A418,418 0 0,0 418,0" fill="none"/>
  <text font-family="${FONT}" font-size="80" font-weight="700" fill="${fill}" letter-spacing="12" text-anchor="middle" dominant-baseline="middle">
  <textPath href="#cl" startOffset="50%">we can do IT</textPath></text>`;
// M: czysty margines, F: szerokość wygaszania, fs/step: wielkość cyfr i odstęp pierścieni, dark: ile czerni na zewnątrz.
// Jedna cyfra z wygaszaniem przy napisach. Zwraca '' gdy cyfra wypada.
function digit(p, a, col, fs, { M, F, flip }, keep, density, bit) {
  const f = Math.min(1, Math.max(0, (textDist(p) - M) / F));
  if (f <= 0 || keep > (0.25 + 0.75 * f) * density) return '';
  return `<text x="${f2(p[0])}" y="${f2(p[1])}" transform="rotate(${f2(flip && a > 90 && a < 270 ? a + 180 : a)} ${f2(p[0])} ${f2(p[1])})" fill="${col}" font-size="${f2(fs * (0.5 + 0.5 * f))}"${f < 1 ? ` opacity="${f2(0.25 + 0.75 * f)}"` : ''}>${bit}</text>`;
}
const G_ = s => `<g font-family="Consolas, 'Courier New', monospace" font-weight="700" text-anchor="middle" dominant-baseline="central">${s}</g>`;
// Pierścienie cyfr. greyKeep: jaka część szarych zostaje. group: cyfry w grupach (bajty) z przerwą.
// grow: cyfry rosną ku krawędzi (0 = równe).
function binary(o) {
  const { fs = 17, step = 17, seed = 9, dark = 0.5, orange = 0.14, sparseIn = 0, greyKeep = 1, group = 0, grow = 0 } = o;
  const rnd = mkRnd(seed), out = [];
  // edge: pierścienie dosunięte tak, żeby ostatni mieścił się w całości przy krawędzi (zamiast wycinać ucięte cyfry).
  const top = R - fs * 0.6, r0 = o.edge ? top - Math.floor((top - HOLE - fs * 0.8) / step) * step : HOLE + fs * 0.8;
  for (let r = r0; r <= (o.edge ? top + 0.5 : R + 8);) {
    const t = (r - HOLE) / (R - HOLE), sz = fs * (1 + grow * (t - 0.5)), n = Math.floor(2 * Math.PI * r / (sz * 0.76)), ph = rnd() * 360;
    for (let k = 0; k < n; k++) {
      const a = (k * 360 / n + ph) % 360, x = rnd(), bit = rnd() < 0.5 ? 0 : 1, keep = rnd(), g = rnd();
      if (group && k % (group + 1) === group) continue;
      const col = x < orange ? O : x < orange + dark * t ? K : G;
      if (col === G && g > greyKeep) continue;
      out.push(digit(pol(r, a), a, col, sz, o, keep, 1 - sparseIn * (1 - t), bit));
    }
    r += step * sz / fs;
  }
  return G_(out.join(''));
}
// Strumienie: promieniste smugi cyfr od krawędzi ku tarczy. Głowa przy krawędzi ciemna, ogon jaśnieje i rzednie.
function streams(o) {
  const { fs = 22, seed = 41, spokes = 150, orange = 0.16 } = o, rnd = mkRnd(seed), out = [];
  for (let s = 0; s < spokes; s++) {
    const a = s * 360 / spokes + rnd() * 1.2, len = 0.35 + rnd() * 0.65;
    for (let r = R + 6; r > R - len * (R - HOLE); r -= fs * 0.95) {
      const u = (R - r) / (len * (R - HOLE)), x = rnd(), bit = rnd() < 0.5 ? 0 : 1, keep = rnd();
      const col = x < orange ? O : x < 0.85 - u ? K : G;
      out.push(digit(pol(r, a), a, col, fs, o, keep, 1 - 0.5 * u, bit));
    }
  }
  return G_(out.join(''));
}
// Wersja finalna (z rundy 16, wariant 2). Runda 15: jak 14, "we can do IT" na środku pierścienia (łuk 418 zamiast 392). Runda 14: wariant 4 z rundy 13, mniejszy ITBoom wyśrodkowany w pierścieniu, żeby cyfry były nad nim i pod nim.
// Strefę napisu skaluję z pomiaru przy 150 px: od linii łuku 39 px w dół i 69 px w górę, kąt 39°.
const BIG = { fs: 22, step: 23, M: 4, F: 75, seed: 27, flip: true, sparseIn: 0.6, dark: 0.35, orange: 0.12 };
function sizedTitle(size) {
  const k = size / 150, tr = Math.round((HOLE + R) / 2 - 15 * k);
  TITLE = { r0: tr - 39 * k, r1: tr + 69 * k, a: 39 * k * 402 / tr };
  ZONES[0] = { ...TITLE, mid: 0, half: TITLE.a };
  return `<path id="tl" d="M${-tr},0A${tr},${tr} 0 0,1 ${tr},0" fill="none"/>
  <text font-family="${FONT}" font-size="${size}" font-weight="700" fill="${K}" letter-spacing="2" text-anchor="middle" dominant-baseline="middle">
  <textPath href="#tl" startOffset="50%">ITBoom</textPath></text>`;
}
const at = (size, opts) => () => { const t = sizedTitle(size), o = { ...BIG, ...opts }; return [o.streams ? streams(o) : binary(o), t]; };
// Runda 16: baza to wariant 3 z rundy 15 (ITBoom 128 px, wygaszenie 40 px), mniej szarości, inne układy cyfr.
const B3 = { ...BIG, F: 40 };
const designs = {
  // Wersja wybrana: grupy po 4 (wariant 2 z rundy 16), tak jak w rundzie 16 (cyfry przy krawędzi przycięte jak na makiecie).
  'opona': at(128, { ...B3, greyKeep: 0.6, dark: 0.75, sparseIn: 0.15, group: 4, seed: 31 }),
};

const wrap = body => `<g clip-path="url(#ann)">${body}</g>`;
const svg = body => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-500 -500 1000 1000" width="1000" height="1000"><defs>${clip}</defs>${body}</svg>`;
const files = [];
for (const [name, fn] of Object.entries(designs)) {
  const [raw, t = title, c = claimT()] = fn(), body = wrap(raw);
  fs.writeFileSync(path.join(OUT, `${name}.svg`), svg(base + body + inner + t + c));
  files.push([name, body, t, c]);
}

// Makieta tarczy i ściana jak w rundzie 4.
const wedge = (r1, r2, a1, a2, attrs) => {
  const [x1, y1] = pol(r2, a1), [x2, y2] = pol(r2, a2), [x3, y3] = pol(r1, a2), [x4, y4] = pol(r1, a1);
  return `<path ${attrs} d="M${f2(x1)},${f2(y1)}A${r2},${r2} 0 0,1 ${f2(x2)},${f2(y2)}L${f2(x3)},${f2(y3)}A${r1},${r1} 0 0,0 ${f2(x4)},${f2(y4)}z"/>`;
};
const SECT = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
const s = HOLE / 225.5, b = [`<circle r="${HOLE}" fill="#111"/>`];
SECT.forEach((n, i) => {
  const a1 = i * 18 - 9, a2 = a1 + 18, dark = i % 2 === 0, ring = dark ? '#c8102e' : '#00843d';
  b.push(wedge(16 * s, 170 * s, a1, a2, `fill="${ring}"`), wedge(16 * s, 162 * s, a1, a2, `fill="${dark ? '#1a1a1a' : '#efe3c2'}"`), wedge(99 * s, 107 * s, a1, a2, `fill="${ring}"`));
  const [x, y] = pol(195 * s, i * 18);
  b.push(`<text x="${f2(x)}" y="${f2(y + 9)}" font-family="Arial" font-size="26" font-weight="700" fill="#ddd" text-anchor="middle">${n}</text>`);
});
b.push(`<circle r="${16 * s}" fill="#00843d"/><circle r="${6.35 * s}" fill="#c8102e"/>`);
const FELT = ['#E8762B', '#1E1E22', '#B9B6CC'];
const wall = (() => {
  const hr = 210, w = Math.sqrt(3) * hr, o = [`<rect x="-900" y="-900" width="1800" height="1800" fill="#D4D2DC"/>`];
  let sd = 5; const r2 = () => (sd = (sd * 48271) % 2147483647) / 2147483647;
  for (let row = -3; row <= 3; row++) for (let col = -3; col <= 3; col++) {
    const cx = col * w + (row & 1 ? w / 2 : 0), cy = row * hr * 1.5;
    const pts = [0, 1, 2, 3, 4, 5].map(i => pol(hr - 6, i * 60).map(f2));
    o.push(`<polygon transform="translate(${f2(cx)} ${f2(cy)})" points="${pts.map(p => p.join(',')).join(' ')}" fill="${FELT[Math.floor(r2() * 3)]}"/>`);
  }
  o.push(`<defs><filter id="glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="22"/></filter></defs>`,
    `<circle r="585" fill="none" stroke="${O}" stroke-width="70" opacity=".55" filter="url(#glow)"/>`,
    `<circle r="600" fill="none" stroke="#9C9CA2" stroke-width="56"/><circle r="600" fill="none" stroke="#B4B4BA" stroke-width="18"/>`);
  return o.join('');
})();
const card = ([name, body, t, c]) => `<figure><svg viewBox="-660 -660 1320 1320"><defs>${clip}</defs>${wall}${base}${body}${inner}${t}${c}${b.join('')}</svg><figcaption>${name}</figcaption></figure>`;
fs.writeFileSync(path.join(__dirname, 'makieta.html'), `<!doctype html><meta charset="utf-8"><style>
body{margin:0;padding:20px;background:#555;font-family:Segoe UI,sans-serif;display:grid;grid-template-columns:repeat(1,600px);gap:20px}
figure{margin:0}svg{width:600px;height:600px;display:block}figcaption{text-align:center;color:#fff;font-weight:600;margin-top:4px}</style>
${files.map(card).join('\n')}`);
console.log(files.map(([n]) => n).join(' '));

