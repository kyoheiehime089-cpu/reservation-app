import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const port = Number(process.env.PORT || 5173);
const root = process.cwd();

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

function resolvePath(url) {
  const path = decodeURIComponent(new URL(url, `http://localhost:${port}`).pathname);
  const target = normalize(join(root, path === '/' ? 'index.html' : path));
  return target.startsWith(root) ? target : join(root, 'index.html');
}

createServer((request, response) => {
  const filePath = resolvePath(request.url || '/');
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }

  response.writeHead(200, { 'content-type': contentTypes[extname(filePath)] || 'application/octet-stream' });
  createReadStream(filePath).pipe(response);
}).listen(port, () => {
  console.log(`friends reservation app: http://localhost:${port}/`);
});
