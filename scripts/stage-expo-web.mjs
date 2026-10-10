import { cpSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const source = fileURLToPath(new URL('../client/dist/', import.meta.url));
const destination = fileURLToPath(new URL('../public/expo/', import.meta.url));
if (!existsSync(`${source}/index.html`)) throw new Error('Run npm --prefix client run export:web first.');
// Hashed assets may coexist across builds; never delete assets a live tab uses.
cpSync(source, destination, { recursive: true });
const index = readFileSync(`${source}/index.html`, 'utf8').replace('</head>', '<link rel="manifest" href="/manifest.webmanifest" /><meta name="theme-color" content="#CC785C" /></head>');
writeFileSync(`${destination}/index.html`, index);
console.log('Staged Expo web at public/expo. Start Next with MODE_EXPO_WEB=1.');
