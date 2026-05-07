import { cpSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';

rmSync('dist', { force: true, recursive: true });
mkdirSync('dist', { recursive: true });
cpSync('index.html', 'dist/index.html');
cpSync('src', 'dist/src', { recursive: true });
writeFileSync('dist/.nojekyll', '');
