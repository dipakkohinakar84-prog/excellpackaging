import { writeFileSync } from 'fs';
import { resolve } from 'path';

const version = String(Date.now());

writeFileSync(
  resolve(process.cwd(), 'public/version.json'),
  JSON.stringify({ version }, null, 2),
  'utf-8',
);

console.log(`✓ version set to ${version}`);
