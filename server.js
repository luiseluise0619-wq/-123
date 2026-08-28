// Render(및 일반 Node 호스팅)용 초경량 서버.
// - frontend/ 정적 파일 서빙 (Vercel의 cleanUrls 동작 재현)
// - frontend/api/*.js 서버리스 핸들러를 그대로 실행 (Vercel handler(req,res) 형식 어댑터)
// 외부 npm 의존성 없음(Node 18+ 내장 http/fs/fetch). Vercel 배포에는 영향 없음(Vercel 루트가 frontend/).
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "frontend");   // 정적 루트
const API = path.join(ROOT, "api");
const PORT = process.env.PORT || 3000;

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif",
  ".ico": "image/x-icon", ".woff2": "font/woff2", ".woff": "font/woff", ".map": "application/json",
  ".txt": "text/plain; charset=utf-8", ".csv": "text/csv; charset=utf-8",
};

// Vercel 스타일 res 어댑터 (핸들러는 res.status(x).json(y) / setHeader 만 사용)
function vercelRes(nodeRes) {
  return {
    statusCode: 200,
    _headers: {},
    status(c) { this.statusCode = c; return this; },
    setHeader(k, v) { this._headers[k] = v; return this; },
    json(obj) {
      nodeRes.writeHead(this.statusCode, { ...this._headers, "Content-Type": "application/json; charset=utf-8" });
      nodeRes.end(JSON.stringify(obj));
    },
    send(body) { nodeRes.writeHead(this.statusCode, this._headers); nodeRes.end(body); },
    end(b) { nodeRes.writeHead(this.statusCode, this._headers); nodeRes.end(b ?? ""); },
  };
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = ""; req.on("data", (c) => { data += c; if (data.length > 2e6) req.destroy(); });
    req.on("end", () => resolve(data)); req.on("error", () => resolve(""));
  });
}

async function serveStatic(pathname, nodeRes) {
  let rel = decodeURIComponent(pathname.split("?")[0]);
  if (rel.endsWith("/")) rel += "index.html";
  let file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(ROOT)) { nodeRes.writeHead(403); return nodeRes.end("Forbidden"); }

  async function tryFile(f) { try { const s = await stat(f); return s.isFile() ? f : null; } catch { return null; } }

  let found = await tryFile(file);
  if (!found && !path.extname(file)) found = await tryFile(file + ".html"); // cleanUrls
  if (!found) {
    nodeRes.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    return nodeRes.end("<h1>404</h1>");
  }
  const ext = path.extname(found).toLowerCase();
  const buf = await readFile(found);
  nodeRes.writeHead(200, {
    "Content-Type": MIME[ext] || "application/octet-stream",
    "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=3600",
  });
  nodeRes.end(buf);
}

const server = http.createServer(async (req, nodeRes) => {
  try {
    const url = new URL(req.url, "http://localhost");
    const pathname = url.pathname;

    if (pathname.startsWith("/api/")) {
      const name = pathname.slice(5).replace(/[^a-zA-Z0-9_-]/g, "");
      if (!name || name.startsWith("_")) { nodeRes.writeHead(404); return nodeRes.end("Not found"); }
      let mod;
      try { mod = await import(pathToFileURL(path.join(API, name + ".js")).href); }
      catch { nodeRes.writeHead(404, { "Content-Type": "application/json" }); return nodeRes.end(JSON.stringify({ error: "no such endpoint" })); }
      const raw = req.method === "POST" || req.method === "PUT" ? await readBody(req) : "";
      const vreq = { method: req.method, headers: req.headers, url: req.url, body: raw, query: Object.fromEntries(url.searchParams) };
      await mod.default(vreq, vercelRes(nodeRes));
      return;
    }

    await serveStatic(pathname, nodeRes);
  } catch (e) {
    nodeRes.writeHead(500, { "Content-Type": "application/json" });
    nodeRes.end(JSON.stringify({ error: String(e && e.message || e) }));
  }
});

server.listen(PORT, () => console.log(`server on :${PORT}  (static=${ROOT})`));
