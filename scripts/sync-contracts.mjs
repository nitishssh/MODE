import { readFile, writeFile, mkdir } from 'node:fs/promises';
const source = new URL('../src/lib/contracts.ts', import.meta.url);
const target = new URL('../client/src/generated/contracts.ts', import.meta.url);
const expected = '// Generated from src/lib/contracts.ts. Run npm run sync-contracts.\n' + (await readFile(source, 'utf8')).replace(/\r\n/g, '\n');
if (process.argv.includes('--check')) {
  const actual = await readFile(target, 'utf8').catch(() => '');
  if (actual.replace(/\r\n/g, '\n') !== expected) {
    console.error('Client contracts drifted. Run npm run sync-contracts and commit the generated file.');
    process.exitCode = 1;
  } else console.log('Client contracts match the server.');
} else {
  await mkdir(new URL('../client/src/generated/', import.meta.url), { recursive: true });
  await writeFile(target, expected);
  console.log('Generated client contracts.');
}
