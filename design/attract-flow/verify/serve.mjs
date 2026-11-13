// Production-like static server for timing: serves the assembly repo root byte-for-byte,
// gzip for compressible files, and normal cache headers (like a CDN would).
// Vite dev is fine for working on the prototype, but it transforms every module and
// inlines a source map (playcanvas.min.mjs grows from 2.4 MB to 12 MB, uncompressed),
// which makes throttled first-paint numbers meaningless.
//
//   node design/attract-flow/verify/serve.mjs [port]     (default 5792)

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { extname, join, normalize, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const port = Number(process.argv[2] ?? 5792);
const types = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript', '.js': 'text/javascript', '.txt': 'text/plain',
  '.json': 'application/json', '.wasm': 'application/wasm', '.woff2': 'font/woff2', '.png': 'image/png', '.task': 'application/octet-stream' };
const compressible = new Set(['.html', '.mjs', '.js', '.txt', '.json', '.wasm', '.task']);
const gz = new Map();

createServer(async (req, res) => {
  try {
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
    const file = join(root, path.endsWith('/') ? `${path}index.html` : path);
    if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
    const info = await stat(file);
    const ext = extname(file);
    const etag = `"${info.size}-${info.mtimeMs}"`;
    const headers = { 'content-type': types[ext] ?? 'application/octet-stream', etag,
      'cache-control': ext === '.html' ? 'no-cache' : 'public, max-age=3600' };
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, headers).end(); return; }
    let body = await readFile(file);
    if (compressible.has(ext) && /\bgzip\b/.test(req.headers['accept-encoding'] ?? '')) {
      if (!gz.has(file) || gz.get(file).etag !== etag) gz.set(file, { etag, body: gzipSync(body, { level: 6 }) });
      body = gz.get(file).body;
      headers['content-encoding'] = 'gzip';
      headers.vary = 'accept-encoding';
    }
    headers['content-length'] = body.length;
    res.writeHead(200, headers).end(body);
  } catch { res.writeHead(404).end(); }
}).listen(port, '0.0.0.0', () => console.log(`serving ${root} at http://127.0.0.1:${port}/design/attract-flow/`));
