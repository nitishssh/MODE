/**
 * The front face of the member pass on the sign-in lanyard, drawn as an SVG
 * data URL so the NAME line can show whatever the visitor is typing. Same
 * artwork as public/lanyard/card-front.svg, which stays as the static copy.
 */

const esc = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Fit the typed text on one line: longer strings get a smaller size. */
function nameLine(raw: string): { text: string; size: number } {
  const text = raw.trim().slice(0, 40);
  if (!text) return { text: "", size: 58 };
  const size = text.length <= 12 ? 66 : text.length <= 18 ? 56 : text.length <= 26 ? 46 : 36;
  return { text, size };
}

export function cardFrontSvg(name: string, { role = "MEMBER", code = "7DP9 1CXQ VA" }: { role?: string; code?: string } = {}): string {
  const line = nameLine(name);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1440" width="1024" height="1440">
<defs>
<pattern id="dots" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="1.6" fill="#b8785d" opacity=".22"/></pattern>
<linearGradient id="band" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#cc785c"/><stop offset="1" stop-color="#b8654a"/></linearGradient>
</defs>
<rect width="1024" height="1440" fill="#fdfaf5"/>
<rect width="1024" height="1440" fill="url(#dots)"/>
<rect x="0" y="0" width="1024" height="150" fill="url(#band)"/>
<rect x="412" y="40" width="200" height="56" rx="28" fill="#24201e" opacity=".35"/>
<text x="72" y="104" font-family="Crimson Pro, Georgia, serif" font-size="72" font-weight="700" fill="#fdfaf5" letter-spacing="-2">MODE<tspan fill="#f0a500">.</tspan></text>
<text x="952" y="98" text-anchor="end" font-family="DM Sans, Arial, sans-serif" font-size="24" font-weight="800" fill="#fdfaf5" letter-spacing="7">MEMBER PASS</text>
<rect x="72" y="214" width="880" height="4" fill="#24201e" opacity=".9"/>
<text x="72" y="300" font-family="DM Sans, Arial, sans-serif" font-size="26" font-weight="800" fill="#6b645d" letter-spacing="7">SPECTRUM COLLECTIVE · NMIT</text>
<text x="72" y="430" font-family="Crimson Pro, Georgia, serif" font-size="104" font-weight="700" fill="#24201e" letter-spacing="-4">A little less</text>
<text x="72" y="540" font-family="Crimson Pro, Georgia, serif" font-size="104" font-weight="700" fill="#a95638" letter-spacing="-4">admin.</text>
<text x="72" y="650" font-family="Crimson Pro, Georgia, serif" font-size="104" font-weight="700" fill="#24201e" letter-spacing="-4">A lot more</text>
<text x="72" y="760" font-family="Crimson Pro, Georgia, serif" font-size="104" font-weight="700" fill="#a95638" letter-spacing="-4">campus life.</text>
<rect x="72" y="846" width="880" height="2" fill="#ded8cf"/>
<text x="72" y="920" font-family="DM Sans, Arial, sans-serif" font-size="24" font-weight="800" fill="#6b645d" letter-spacing="6">NAME / STUDENT ID</text>
${line.text
    ? `<text x="72" y="1000" font-family="Crimson Pro, Georgia, serif" font-size="${line.size}" font-weight="700" fill="#24201e" letter-spacing="-1">${esc(line.text)}</text><rect x="72" y="1016" width="560" height="3" fill="#cc785c"/>`
    : `<rect x="72" y="944" width="560" height="56" rx="10" fill="#f5f0e8"/><rect x="88" y="966" width="4" height="22" fill="#cc785c"><animate attributeName="opacity" values="1;0;1" dur="1s" repeatCount="indefinite"/></rect>`}
<text x="72" y="1090" font-family="DM Sans, Arial, sans-serif" font-size="24" font-weight="800" fill="#6b645d" letter-spacing="6">ROLE</text>
<rect x="72" y="1114" width="300" height="56" rx="28" fill="#f4e4dc"/>
<text x="222" y="1152" text-anchor="middle" font-family="DM Sans, Arial, sans-serif" font-size="26" font-weight="800" fill="#a95638" letter-spacing="3">${esc(role)}</text>
<g transform="translate(700 920)">
<rect width="252" height="252" rx="18" fill="#fff" stroke="#ded8cf" stroke-width="4"/>
<g fill="#24201e">
<rect x="28" y="28" width="60" height="60" rx="6"/><rect x="40" y="40" width="36" height="36" fill="#fff"/><rect x="50" y="50" width="16" height="16"/>
<rect x="164" y="28" width="60" height="60" rx="6"/><rect x="176" y="40" width="36" height="36" fill="#fff"/><rect x="186" y="50" width="16" height="16"/>
<rect x="28" y="164" width="60" height="60" rx="6"/><rect x="40" y="176" width="36" height="36" fill="#fff"/><rect x="50" y="186" width="16" height="16"/>
<rect x="110" y="28" width="12" height="12"/><rect x="134" y="40" width="12" height="12"/><rect x="110" y="64" width="12" height="12"/><rect x="134" y="76" width="12" height="12"/>
<rect x="28" y="110" width="12" height="12"/><rect x="52" y="122" width="12" height="12"/><rect x="76" y="110" width="12" height="12"/><rect x="40" y="134" width="12" height="12"/>
<rect x="110" y="110" width="12" height="12"/><rect x="134" y="110" width="12" height="12"/><rect x="122" y="134" width="12" height="12"/><rect x="158" y="122" width="12" height="12"/><rect x="182" y="110" width="12" height="12"/><rect x="206" y="134" width="12" height="12"/><rect x="170" y="146" width="12" height="12"/><rect x="194" y="158" width="12" height="12"/>
<rect x="110" y="170" width="12" height="12"/><rect x="134" y="182" width="12" height="12"/><rect x="158" y="194" width="12" height="12"/><rect x="182" y="182" width="12" height="12"/><rect x="206" y="206" width="12" height="12"/><rect x="122" y="206" width="12" height="12"/><rect x="170" y="212" width="12" height="12"/>
</g>
</g>
<text x="72" y="1300" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="40" font-weight="700" fill="#24201e" letter-spacing="10">${esc(code)}</text>
<text x="72" y="1360" font-family="DM Sans, Arial, sans-serif" font-size="22" font-weight="700" fill="#6b645d" letter-spacing="5">DOOR CODE · SCAN AT THE DOOR</text>
<circle cx="952" cy="1330" r="40" fill="#2e7d5b"/>
<path d="M932 1330 l14 14 l26 -30" fill="none" stroke="#fdfaf5" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
