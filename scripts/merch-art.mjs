#!/usr/bin/env node
/**
 * Draws one square SVG illustration per merchandise item into public/merch/.
 * Product art is matched by the slug of the product name (see src/lib/merch-art.ts),
 * so adding a product called "Varsity Jacket" picks up public/merch/varsity-jacket.svg.
 *
 *   node scripts/merch-art.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = join(process.cwd(), "public", "merch");
mkdirSync(OUT, { recursive: true });

const PAPER = "#f5f0e8";
const INK = "#24201e";

const frame = (body, { bg = PAPER, tag = "MODE." } = {}) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800">
<defs>
  <pattern id="dots" width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.1" fill="#b8785d" opacity=".18"/></pattern>
  <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="18" stdDeviation="16" flood-color="#24201e" flood-opacity=".22"/></filter>
  <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".12"/></linearGradient>
</defs>
<rect width="800" height="800" fill="${bg}"/>
<rect width="800" height="800" fill="url(#dots)"/>
<g filter="url(#shadow)">${body}</g>
<text x="56" y="748" font-family="Crimson Pro, Georgia, serif" font-size="30" font-weight="700" fill="${INK}" letter-spacing="-1">${tag}<tspan fill="#cc785c">.</tspan></text>
</svg>`;

// ── garment templates ───────────────────────────────────────────────────────
const hoodie = ({ color, accent, text, textColor = "#fff" }) => `
<path d="M250 250 L330 190 Q400 150 470 190 L550 250 L610 330 L560 380 L530 345 L530 640 Q400 665 270 640 L270 345 L240 380 L190 330 Z" fill="${color}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
<path d="M330 190 Q400 260 470 190 Q400 290 330 190 Z" fill="${accent}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
<path d="M330 450 h140 v110 h-140 z" fill="${accent}" opacity=".9" stroke="${INK}" stroke-width="6" rx="12"/>
<path d="M385 300 v90 M415 300 v90" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>
<path d="M250 250 L330 190 Q400 150 470 190 L550 250 L610 330 L560 380 L530 345 L530 640 Q400 665 270 640 L270 345 L240 380 L190 330 Z" fill="url(#sheen)"/>
<text x="400" y="420" text-anchor="middle" font-family="Crimson Pro, Georgia, serif" font-size="46" font-weight="700" fill="${textColor}" letter-spacing="-1">${text}</text>`;

const tee = ({ color, accent, text, textColor = "#fff", art = "" }) => `
<path d="M300 200 Q400 170 500 200 L600 250 L640 340 L560 380 L545 340 L545 630 Q400 655 255 630 L255 340 L240 380 L160 340 L200 250 Z" fill="${color}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
<path d="M330 200 Q400 250 470 200" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>
<path d="M300 200 Q400 170 500 200 L600 250 L640 340 L560 380 L545 340 L545 630 Q400 655 255 630 L255 340 L240 380 L160 340 L200 250 Z" fill="url(#sheen)"/>
${art}
<text x="400" y="470" text-anchor="middle" font-family="Crimson Pro, Georgia, serif" font-size="54" font-weight="700" fill="${textColor}" letter-spacing="-1">${text}</text>
<text x="400" y="510" text-anchor="middle" font-family="DM Sans, Arial, sans-serif" font-size="18" font-weight="700" fill="${accent}" letter-spacing="6">CLUB COLLECTION</text>`;

const jacket = ({ color, sleeve, accent, letter }) => `
<path d="M310 190 Q400 160 490 190 L600 240 L650 350 L575 390 L555 350 L555 640 Q400 665 245 640 L245 350 L225 390 L150 350 L200 240 Z" fill="${color}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
<path d="M200 240 L150 350 L225 390 L245 350 L245 470 L300 470 L300 230 Z" fill="${sleeve}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
<path d="M600 240 L650 350 L575 390 L555 350 L555 470 L500 470 L500 230 Z" fill="${sleeve}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
<path d="M310 190 Q400 230 490 190 L490 215 Q400 260 310 215 Z" fill="${accent}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
<path d="M400 215 V640" stroke="${INK}" stroke-width="6"/>
<circle cx="400" cy="300" r="7" fill="${accent}"/><circle cx="400" cy="380" r="7" fill="${accent}"/><circle cx="400" cy="460" r="7" fill="${accent}"/><circle cx="400" cy="540" r="7" fill="${accent}"/>
<rect x="245" y="600" width="310" height="40" fill="${accent}" stroke="${INK}" stroke-width="6"/>
<text x="330" y="400" text-anchor="middle" font-family="Crimson Pro, Georgia, serif" font-size="92" font-weight="700" fill="${accent}" stroke="${INK}" stroke-width="3">${letter}</text>`;

const cap = ({ color, accent, text }) => `
<path d="M190 430 Q190 250 400 250 Q610 250 610 430 Z" fill="${color}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
<path d="M400 250 V430" stroke="${INK}" stroke-width="5" opacity=".5"/>
<path d="M295 262 Q330 340 310 430 M505 262 Q470 340 490 430" fill="none" stroke="${INK}" stroke-width="5" opacity=".5"/>
<path d="M190 430 H610 Q640 440 630 470 Q560 455 400 455 Q240 455 170 470 Q160 440 190 430 Z" fill="${accent}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
<path d="M170 470 Q400 420 630 470 Q640 520 560 530 Q400 520 240 530 Q160 520 170 470 Z" fill="${color}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
<circle cx="400" cy="250" r="12" fill="${accent}" stroke="${INK}" stroke-width="5"/>
<text x="400" y="385" text-anchor="middle" font-family="DM Sans, Arial, sans-serif" font-size="30" font-weight="800" fill="#fff" letter-spacing="3">${text}</text>`;

const bottle = ({ color, accent, text }) => `
<rect x="345" y="140" width="110" height="50" rx="10" fill="${INK}"/>
<rect x="330" y="185" width="140" height="40" rx="8" fill="${accent}" stroke="${INK}" stroke-width="6"/>
<path d="M330 225 Q300 260 300 320 V620 Q300 660 340 660 H460 Q500 660 500 620 V320 Q500 260 470 225 Z" fill="${color}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
<path d="M330 225 Q300 260 300 320 V620 Q300 660 340 660 H460 Q500 660 500 620 V320 Q500 260 470 225 Z" fill="url(#sheen)"/>
<rect x="325" y="360" width="150" height="140" rx="8" fill="${PAPER}" stroke="${INK}" stroke-width="5"/>
<text x="400" y="420" text-anchor="middle" font-family="Crimson Pro, Georgia, serif" font-size="40" font-weight="700" fill="${INK}">${text}</text>
<text x="400" y="460" text-anchor="middle" font-family="DM Sans, Arial, sans-serif" font-size="14" font-weight="700" fill="${accent}" letter-spacing="4">750 ML · STEEL</text>
<path d="M322 280 V600" stroke="#fff" stroke-width="10" opacity=".35" stroke-linecap="round"/>`;

const tote = ({ color, accent, text }) => `
<path d="M300 300 Q320 180 400 180 Q480 180 500 300" fill="none" stroke="${INK}" stroke-width="14" stroke-linecap="round"/>
<path d="M300 300 Q320 180 400 180 Q480 180 500 300" fill="none" stroke="${accent}" stroke-width="7" stroke-linecap="round"/>
<path d="M230 300 H570 L600 660 H200 Z" fill="${color}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
<path d="M230 300 H570 L600 660 H200 Z" fill="url(#sheen)"/>
<path d="M210 340 H590" stroke="${INK}" stroke-width="4" opacity=".3" stroke-dasharray="10 10"/>
<text x="400" y="470" text-anchor="middle" font-family="Crimson Pro, Georgia, serif" font-size="64" font-weight="700" fill="${accent}" letter-spacing="-2">${text}</text>
<text x="400" y="520" text-anchor="middle" font-family="DM Sans, Arial, sans-serif" font-size="18" font-weight="700" fill="${INK}" letter-spacing="5">A LITTLE LESS ADMIN</text>
<text x="400" y="550" text-anchor="middle" font-family="DM Sans, Arial, sans-serif" font-size="18" font-weight="700" fill="${INK}" letter-spacing="5">A LOT MORE CAMPUS LIFE</text>`;

const pins = () => `
<rect x="190" y="200" width="420" height="400" rx="18" fill="#fffdf9" stroke="${INK}" stroke-width="6"/>
<rect x="190" y="200" width="420" height="70" rx="18" fill="#cc785c" stroke="${INK}" stroke-width="6"/>
<text x="400" y="246" text-anchor="middle" font-family="DM Sans, Arial, sans-serif" font-size="22" font-weight="800" fill="#fff" letter-spacing="6">ENAMEL PIN SET</text>
<circle cx="290" cy="400" r="62" fill="#24201e" stroke="#e8c878" stroke-width="8"/>
<text x="290" y="412" text-anchor="middle" font-family="Crimson Pro, Georgia, serif" font-size="40" font-weight="700" fill="#fff">M<tspan fill="#f0a58b">.</tspan></text>
<g transform="translate(400 330)"><rect x="-26" y="0" width="52" height="140" fill="#f5f0e8" stroke="#24201e" stroke-width="6"/><rect x="-36" y="-10" width="72" height="22" fill="#2e7d5b" stroke="#24201e" stroke-width="6"/><circle cx="0" cy="40" r="18" fill="#fff" stroke="#24201e" stroke-width="5"/><path d="M0 40 V28 M0 40 L8 46" stroke="#24201e" stroke-width="4" stroke-linecap="round"/><rect x="-14" y="80" width="28" height="60" fill="#24201e"/></g>
<g transform="translate(510 400)"><path d="M-60 20 L0 -50 L60 20 Q0 70 -60 20 Z" fill="#e0a257" stroke="#24201e" stroke-width="6" stroke-linejoin="round"/><path d="M-30 12 Q0 -10 30 12" fill="none" stroke="#8f5a1e" stroke-width="5"/><circle cx="-10" cy="22" r="4" fill="#8f5a1e"/><circle cx="14" cy="30" r="4" fill="#8f5a1e"/></g>
<text x="290" y="540" text-anchor="middle" font-family="DM Sans, Arial, sans-serif" font-size="14" font-weight="700" fill="${INK}" letter-spacing="2">CLUB MARK</text>
<text x="400" y="540" text-anchor="middle" font-family="DM Sans, Arial, sans-serif" font-size="14" font-weight="700" fill="${INK}" letter-spacing="2">CLOCK TOWER</text>
<text x="510" y="540" text-anchor="middle" font-family="DM Sans, Arial, sans-serif" font-size="14" font-weight="700" fill="${INK}" letter-spacing="2">SAMOSA</text>`;

const notebook = () => `
<rect x="430" y="170" width="34" height="470" rx="17" transform="rotate(18 447 405)" fill="#cc785c" stroke="${INK}" stroke-width="6"/>
<path d="M447 150 l-14 36 h28 z" transform="rotate(18 447 405)" fill="${INK}"/>
<rect x="190" y="190" width="380" height="460" rx="14" fill="#2f4a53" stroke="${INK}" stroke-width="6"/>
<rect x="190" y="190" width="380" height="460" rx="14" fill="url(#sheen)"/>
<rect x="540" y="190" width="30" height="460" fill="#24201e" opacity=".25"/>
<rect x="205" y="200" width="22" height="440" fill="#f0a500" opacity=".9"/>
<g fill="#fff" opacity=".35">${Array.from({ length: 10 }, (_, r) => Array.from({ length: 12 }, (_, c) => `<circle cx="${270 + c * 24}" cy="${250 + r * 40}" r="2.5"/>`).join("")).join("")}</g>
<rect x="260" y="360" width="250" height="110" rx="8" fill="${PAPER}" stroke="${INK}" stroke-width="5"/>
<text x="385" y="408" text-anchor="middle" font-family="Crimson Pro, Georgia, serif" font-size="40" font-weight="700" fill="${INK}" letter-spacing="-1">Field Notes</text>
<text x="385" y="445" text-anchor="middle" font-family="DM Sans, Arial, sans-serif" font-size="14" font-weight="700" fill="#cc785c" letter-spacing="4">A5 · DOTTED · MODE</text>`;

const stickers = () => `
<rect x="180" y="180" width="440" height="440" rx="20" fill="#fffdf9" stroke="${INK}" stroke-width="6"/>
<path d="M180 220 h440" stroke="${INK}" stroke-width="4" stroke-dasharray="12 10" opacity=".4"/>
<g transform="translate(270 300)"><circle r="58" fill="#cc785c" stroke="#fff" stroke-width="10"/><text y="14" text-anchor="middle" font-family="Crimson Pro, Georgia, serif" font-size="44" font-weight="700" fill="#fff">M.</text></g>
<g transform="translate(400 300)"><rect x="-60" y="-40" width="120" height="80" rx="16" fill="#2e7d5b" stroke="#fff" stroke-width="10"/><text y="10" text-anchor="middle" font-family="DM Sans, Arial, sans-serif" font-size="20" font-weight="800" fill="#fff" letter-spacing="2">SHIP IT</text></g>
<g transform="translate(530 300)"><path d="M0 -60 L18 -18 L62 -14 L28 14 L38 58 L0 34 L-38 58 L-28 14 L-62 -14 L-18 -18 Z" fill="#f0a500" stroke="#fff" stroke-width="10" stroke-linejoin="round"/></g>
<g transform="translate(270 430)"><path d="M-60 30 L0 -50 L60 30 Z" fill="#7657a5" stroke="#fff" stroke-width="10" stroke-linejoin="round"/></g>
<g transform="translate(400 430)"><rect x="-62" y="-30" width="124" height="60" rx="30" fill="#24201e" stroke="#fff" stroke-width="10"/><text y="8" text-anchor="middle" font-family="DM Sans, Arial, sans-serif" font-size="18" font-weight="800" fill="#f0a58b" letter-spacing="2">NMIT</text></g>
<g transform="translate(530 430)"><path d="M-60 20 L0 -50 L60 20 Q0 70 -60 20 Z" fill="#e0a257" stroke="#fff" stroke-width="10" stroke-linejoin="round"/></g>
<g transform="translate(270 550)"><circle r="42" fill="#b8453a" stroke="#fff" stroke-width="10"/><text y="8" text-anchor="middle" font-family="DM Sans, Arial, sans-serif" font-size="18" font-weight="800" fill="#fff">404</text></g>
<g transform="translate(400 550)"><rect x="-58" y="-28" width="116" height="56" rx="12" fill="#e7f2eb" stroke="#fff" stroke-width="10"/><text y="7" text-anchor="middle" font-family="DM Sans, Arial, sans-serif" font-size="16" font-weight="800" fill="#1f6446" letter-spacing="1">ADMITTED</text></g>
<g transform="translate(530 550)"><circle r="42" fill="#fff" stroke="#cc785c" stroke-width="10"/><text y="8" text-anchor="middle" font-family="Crimson Pro, Georgia, serif" font-size="30" font-weight="700" fill="#cc785c">26</text></g>
<text x="400" y="207" text-anchor="middle" font-family="DM Sans, Arial, sans-serif" font-size="14" font-weight="800" fill="${INK}" letter-spacing="5">12 DIE-CUT VINYL STICKERS · WATERPROOF</text>`;

const mountainArt = `<path d="M300 380 L360 300 L410 350 L450 290 L520 380 Z" fill="#f5f0e8" opacity=".95"/><circle cx="470" cy="290" r="14" fill="#f0a500"/>`;
const rhythmArt = `<g stroke="#f0a58b" stroke-width="6" stroke-linecap="round" fill="none"><path d="M300 400 v-40 M330 400 v-80 M360 400 v-20 M390 400 v-60 M420 400 v-95 M450 400 v-30 M480 400 v-70"/></g>`;

// ── catalogue: slug → art ───────────────────────────────────────────────────
const ART = {
  "mode-club-hoodie": frame(hoodie({ color: "#3a3532", accent: "#cc785c", text: "MODE." })),
  "sample-club-hoodie": frame(hoodie({ color: "#2f4a53", accent: "#e8c878", text: "MODE." })),
  "hoodie": frame(hoodie({ color: "#7a3b2e", accent: "#f0a58b", text: "MODE." })),
  "rhythm-2026-fest-tee": frame(tee({ color: "#24201e", accent: "#f0a58b", text: "RHYTHM '26", art: rhythmArt })),
  "sample-club-t-shirt": frame(tee({ color: "#2e7d5b", accent: "#e8c878", text: "MODE." })),
  "trek-dry-fit-tee": frame(tee({ color: "#4a6fa5", accent: "#f0a500", text: "SKANDAGIRI", art: mountainArt })),
  "varsity-jacket": frame(jacket({ color: "#2f4a53", sleeve: "#f5f0e8", accent: "#e8c878", letter: "M" })),
  "hackathon-cap": frame(cap({ color: "#24201e", accent: "#cc785c", text: "HACK THE CAMPUS" })),
  "insulated-steel-bottle": frame(bottle({ color: "#2e7d5b", accent: "#cc785c", text: "MODE." })),
  "canvas-tote-bag": frame(tote({ color: "#efe7d8", accent: "#cc785c", text: "MODE." })),
  "enamel-pin-set": frame(pins()),
  "notebook-and-pen-kit": frame(notebook()),
  "laptop-sticker-pack": frame(stickers()),
  "default": frame(`<rect x="220" y="220" width="360" height="360" rx="28" fill="#fffdf9" stroke="${INK}" stroke-width="6"/><text x="400" y="420" text-anchor="middle" font-family="Crimson Pro, Georgia, serif" font-size="88" font-weight="700" fill="#cc785c">M.</text><text x="400" y="470" text-anchor="middle" font-family="DM Sans, Arial, sans-serif" font-size="16" font-weight="800" fill="${INK}" letter-spacing="5">CLUB COLLECTION</text>`),
};

for (const [slug, svg] of Object.entries(ART)) {
  writeFileSync(join(OUT, `${slug}.svg`), svg);
  console.log("wrote", `public/merch/${slug}.svg`);
}
