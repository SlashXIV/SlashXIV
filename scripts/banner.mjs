/**
 * Generates the profile banner (assets/banner-dark.svg, assets/banner-light.svg)
 * in the style of gabrielifrim.com: contour lines of a relief, the name inside
 * a YOLO-style detection box, telemetry, and a scan line sweeping across.
 *
 * Text is converted to paths (an SVG shown through <img> cannot load fonts).
 * Run: npm run banner
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import opentype from "opentype.js";

const here = (rel) => fileURLToPath(new URL(rel, import.meta.url));

const W = 1200;
const H = 330;

const display = opentype.loadSync(here("../fonts/Syne-ExtraBold.ttf"));
const body = opentype.loadSync(here("../fonts/Manrope-Medium.ttf"));

const THEMES = {
  dark: { bg: "#0d0f12", fg: "#e0e0e0", muted: "#a0a0a0", faint: "#858585", accent: "#45b08c", onAccent: "#121212", ink: "rgba(224,224,224,0.12)", major: "rgba(69,176,140,0.55)" },
  light: { bg: "#f4f4f3", fg: "#1a1a1a", muted: "#565656", faint: "#6b6b6b", accent: "#276b55", onAccent: "#ffffff", ink: "rgba(26,26,26,0.11)", major: "rgba(39,107,85,0.55)" },
};

/** Contour lines (marching squares) of the same relief as the site's TopoField, frozen. */
function contours() {
  const bumps = [
    { u: 0.12, v: 0.25, r: 0.3, a: 0.9 },
    { u: 0.62, v: 0.1, r: 0.22, a: 0.75 },
    { u: 0.8, v: 0.85, r: 0.3, a: 1 },
    { u: 0.38, v: 1.05, r: 0.25, a: 0.6 },
  ];
  const aspect = W / H;
  const height = (u, v) => {
    let z = 0;
    for (const b of bumps) {
      const du = (u - b.u) * aspect * 0.45;
      const dv = v - b.v;
      z += b.a * Math.exp(-(du * du + dv * dv) / (b.r * b.r));
    }
    return z + 0.06 * Math.sin(u * 14) * Math.cos(v * 5);
  };
  const cols = 120;
  const rows = Math.round((cols * H) / W);
  const cw = W / cols;
  const ch = H / rows;
  const f = [];
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) f.push(height(i / cols, j / rows));
  let minor = "";
  let major = "";
  for (let k = 0; k < 10; k++) {
    const level = 0.12 + k * 0.13;
    let d = "";
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const a = f[j * (cols + 1) + i];
        const b = f[j * (cols + 1) + i + 1];
        const c = f[(j + 1) * (cols + 1) + i + 1];
        const dd = f[(j + 1) * (cols + 1) + i];
        const id = (a > level ? 8 : 0) | (b > level ? 4 : 0) | (c > level ? 2 : 0) | (dd > level ? 1 : 0);
        if (id === 0 || id === 15) continue;
        const x0 = i * cw;
        const y0 = j * ch;
        const e = (n) => {
          const p =
            n === 0 ? [x0 + ((level - a) / (b - a)) * cw, y0]
            : n === 1 ? [x0 + cw, y0 + ((level - b) / (c - b)) * ch]
            : n === 2 ? [x0 + ((level - dd) / (c - dd)) * cw, y0 + ch]
            : [x0, y0 + ((level - a) / (dd - a)) * ch];
          return `${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
        };
        const seg = (p, q) => (d += `M${e(p)}L${e(q)}`);
        switch (id) {
          case 1: case 14: seg(3, 2); break;
          case 2: case 13: seg(2, 1); break;
          case 3: case 12: seg(3, 1); break;
          case 4: case 11: seg(0, 1); break;
          case 6: case 9: seg(0, 2); break;
          case 7: case 8: seg(0, 3); break;
          case 5: seg(0, 1); seg(3, 2); break;
          case 10: seg(0, 3); seg(1, 2); break;
        }
      }
    }
    if (k % 4 === 3) major += d;
    else minor += d;
  }
  return { minor, major };
}

/** Text as an SVG path; returns its width too. */
function text(font, str, x, y, size, opts = {}) {
  const options = { letterSpacing: opts.tracking ?? 0 };
  const width = font.getAdvanceWidth(str, size, options);
  const ax = opts.align === "end" ? x - width : x;
  return { d: font.getPath(str, ax, y, size, options).toPathData(1), width };
}

function banner(t) {
  const lines = contours();
  // Name, two lines, as on the home page.
  const size = 92;
  const nameX = 76;
  const top = 92;
  const l1 = text(display, "GABRIEL", nameX, top + size * 0.8, size, { tracking: -0.045 });
  const l2 = text(display, "IFRIM", nameX, top + size * 0.8 + size * 0.9, size, { tracking: -0.045 });
  const pad = 18;
  const box = { x: nameX - pad, y: top - pad + 4, w: Math.max(l1.width, l2.width) + pad * 2, h: size * 1.8 + pad * 2 - 6 };
  const label = text(body, "person 0.99", box.x + 9, box.y - 8, 15);

  // Telemetry, right column.
  const rx = W - 64;
  const tele = [
    { s: "consultant @ sii · from nov. 2026", y: 132, c: t.accent, size: 19 },
    { s: "software · data · automation", y: 166, c: t.fg, size: 19 },
    { s: "bordeaux · fr", y: 196, c: t.muted, size: 17 },
    { s: "gabrielifrim.com", y: 248, c: t.fg, size: 22 },
  ].map((r) => ({ ...r, p: text(body, r.s, rx, r.y, r.size, { align: "end" }) }));
  const meta = text(body, "frame 01 · depth 0.62", rx, 38, 14, { align: "end" });
  const metaL = text(body, "portfolio · github.com/SlashXIV", 64, 38, 14);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gabriel Ifrim — consultant @ SII, software · data · automation">
<style>
  .scan { animation: sweep 6s cubic-bezier(.65,0,.35,1) infinite; }
  @keyframes sweep { 0% { transform: translateY(-12px); opacity: 0 } 3% { opacity: 1 } 40% { transform: translateY(${H + 12}px); opacity: 1 } 41%, 100% { transform: translateY(${H + 12}px); opacity: 0 } }
  @media (prefers-reduced-motion: reduce) { .scan { animation: none; opacity: 0 } }
</style>
<defs>
  <linearGradient id="glow" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${t.accent}" stop-opacity="0"/>
    <stop offset="1" stop-color="${t.accent}" stop-opacity="0.28"/>
  </linearGradient>
  <clipPath id="frame"><rect width="${W}" height="${H}" rx="14"/></clipPath>
</defs>
<g clip-path="url(#frame)">
  <rect width="${W}" height="${H}" fill="${t.bg}"/>
  <path d="${lines.minor}" stroke="${t.ink}" stroke-width="1.1" fill="none"/>
  <path d="${lines.major}" stroke="${t.major}" stroke-width="1.5" fill="none"/>
  <path d="${metaL.d}" fill="${t.faint}"/>
  <path d="${meta.d}" fill="${t.faint}"/>
  <rect x="${box.x}" y="${box.y}" width="${box.w.toFixed(1)}" height="${box.h.toFixed(1)}" rx="4" fill="${t.bg}" fill-opacity="0.55" stroke="${t.accent}" stroke-width="2.5"/>
  <rect x="${box.x - 1.25}" y="${box.y - 27}" width="${(label.width + 18).toFixed(1)}" height="27" rx="3" fill="${t.accent}"/>
  <path d="${label.d}" fill="${t.onAccent}"/>
  <path d="${l1.d}" fill="${t.fg}"/>
  <path d="${l2.d}" fill="${t.accent}"/>
  ${tele.map((r) => `<path d="${r.p.d}" fill="${r.c}"/>`).join("\n  ")}
  <g class="scan">
    <rect x="0" y="-40" width="${W}" height="40" fill="url(#glow)"/>
    <rect x="0" y="-2" width="${W}" height="2" fill="${t.accent}"/>
  </g>
</g>
</svg>
`;
}

for (const [name, theme] of Object.entries(THEMES)) {
  const svg = banner(theme);
  const out = here(`../assets/banner-${name}.svg`);
  writeFileSync(out, svg);
  console.log(`banner-${name}.svg  ${(svg.length / 1024).toFixed(1)} KB`);
}
