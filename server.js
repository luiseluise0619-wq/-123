// Render(및 일반 Node 호스팅)용 초경량 서버.
// - frontend/ 정적 파일 서빙 (Vercel의 cleanUrls 동작 재현)
// - frontend/api/*.js 서버리스 핸들러를 그대로 실행 (Vercel handler(req,res) 형식 어댑터)
// 외부 npm 의존성 없음(Node 18+ 내장 http/fs/fetch). Vercel 배포에는 영향 없음(Vercel 루트가 frontend/).
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import zlib from "node:zlib";
import { promisify } from "node:util";

const gzip = promisify(zlib.gzip);

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
    let data = "", done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    req.on("data", (c) => { data += c; if (data.length > 2e6) req.destroy(); });
    req.on("end", () => finish(data));
    req.on("error", () => finish(""));
    // destroy()/클라이언트 중단 시 'end'·'error' 가 안 올 수 있다.
    // 그러면 Promise 가 영영 안 풀려 요청 컨텍스트가 그대로 쌓인다(누수). 'close' 로도 반드시 종료시킨다.
    req.on("close", () => finish(""));
  });
}

// 압축해서 보낼 종류 — 텍스트만. 이미 압축된 것(png·woff2)은 다시 압축해도 안 줄고 CPU 만 쓴다.
const COMPRESSIBLE = new Set([".html", ".js", ".mjs", ".json", ".css", ".svg", ".txt", ".csv", ".map", ".geojson"]);
// 이보다 작으면 압축 이득보다 헤더·CPU 가 크다.
const COMPRESS_MIN = 1024;

async function serveStatic(pathname, nodeRes, req) {
  let rel;
  // 주소가 깨진 퍼센트 인코딩이면 decodeURIComponent 가 던진다.
  // 그대로 두면 요청 처리기 밖으로 나가 500 이 된다 — 없는 파일이니 404 가 맞다.
  try { rel = decodeURIComponent(pathname.split("?")[0]); }
  catch { nodeRes.writeHead(404, { "Content-Type": "text/html; charset=utf-8" }); return nodeRes.end("<h1>404</h1>"); }
  // 첫 화면은 인텔리전스(zone.html)다. 들어오는 문이 여러 개면 사용자는 매번 고르게 되는데,
  // 이 서비스가 답하는 질문은 "내 업종으로 어디서 시작하면 기회가 있나" 하나다.
  // index.html 은 상담·데이터·방법 화면을 담은 채 그대로 남아 있다(주소로 직접 닿는다).
  // ※ Vercel 배포에도 같은 규칙이 있어야 한다 — frontend/vercel.json 의 rewrites.
  if (rel === "/") rel = "/zone.html";
  else if (rel.endsWith("/")) rel += "index.html";
  let file = path.normalize(path.join(ROOT, rel));
  // 접두사만 비교하면 "frontendX" 같은 형제 경로가 통과한다. 구분자까지 포함해 검사.
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) { nodeRes.writeHead(403); return nodeRes.end("Forbidden"); }

  async function tryFile(f) { try { const s = await stat(f); return s.isFile() ? f : null; } catch { return null; } }

  let found = await tryFile(file);
  if (!found && !path.extname(file)) found = await tryFile(file + ".html"); // cleanUrls
  if (!found) {
    nodeRes.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    return nodeRes.end("<h1>404</h1>");
  }
  const ext = path.extname(found).toLowerCase();
  let buf = await readFile(found);
  const headers = {
    "Content-Type": MIME[ext] || "application/octet-stream",
    "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=3600",
  };

  // gzip 압축 — 이 서버로 배포할 때(Render·카페24) 사용자가 받는 양을 크게 줄인다.
  // Vercel 은 알아서 압축해 주지만 이 파일은 그 경로가 아니다.
  // 우리 데이터는 반복이 많은 JSON 이라 잘 줄어든다(측정: 386KB → 93KB, 465KB → 70KB).
  // 외부 의존성 없이 Node 내장 zlib 만 쓴다.
  const accepts = String((req && req.headers && req.headers["accept-encoding"]) || "");
  if (COMPRESSIBLE.has(ext) && buf.length >= COMPRESS_MIN && /\bgzip\b/.test(accepts)) {
    try {
      buf = await gzip(buf);
      headers["Content-Encoding"] = "gzip";
      // 같은 주소라도 Accept-Encoding 에 따라 응답이 다르다 —
      // 캐시(프록시·CDN)가 압축본을 비압축 클라이언트에 주지 않도록 알려 준다.
      headers["Vary"] = "Accept-Encoding";
    } catch (e) {
      console.error("[server] gzip 실패 — 원본으로 보냄:", e && e.message);
    }
  }
  nodeRes.writeHead(200, headers);
  nodeRes.end(buf);
}

const server = http.createServer(async (req, nodeRes) => {
  try {
    const url = new URL(req.url, "http://localhost");
    const pathname = url.pathname;

    if (pathname.startsWith("/api/")) {
      const name = pathname.slice(5).replace(/[^a-zA-Z0-9_-]/g, "");
      if (!name || name.startsWith("_")) { nodeRes.writeHead(404); return nodeRes.end("Not found"); }

      // '파일이 없다'와 '파일은 있는데 불러오다 실패했다'를 구분한다.
      // 예전에는 import 실패를 전부 404 "no such endpoint" 로 뭉갰다. 그러면 문법 오류나
      // 빠진 의존성(예: pg 미설치)이 '그런 엔드포인트 없음'으로 보여서 원인을 못 찾는다.
      const file = path.join(API, name + ".js");
      try { const s = await stat(file); if (!s.isFile()) throw new Error("not a file"); }
      catch {
        nodeRes.writeHead(404, { "Content-Type": "application/json" });
        return nodeRes.end(JSON.stringify({ error: "no such endpoint" }));
      }
      let mod;
      try { mod = await import(pathToFileURL(file).href); }
      catch (e) {
        console.error(`[server] /api/${name} 불러오기 실패:`, (e && e.stack) || e);
        nodeRes.writeHead(500, { "Content-Type": "application/json" });
        return nodeRes.end(JSON.stringify({ error: "endpoint load failed" }));
      }
      if (typeof mod.default !== "function") {
        console.error(`[server] /api/${name} 에 default export 핸들러가 없습니다.`);
        nodeRes.writeHead(500, { "Content-Type": "application/json" });
        return nodeRes.end(JSON.stringify({ error: "endpoint has no handler" }));
      }
      const raw = req.method === "POST" || req.method === "PUT" ? await readBody(req) : "";
      const vreq = { method: req.method, headers: req.headers, url: req.url, body: raw, query: Object.fromEntries(url.searchParams) };
      await mod.default(vreq, vercelRes(nodeRes));
      return;
    }

    await serveStatic(pathname, nodeRes, req);
  } catch (e) {
    // 핸들러가 이미 응답을 시작한 뒤 예외가 나면 writeHead 를 다시 부를 수 없다
    // (ERR_HTTP_HEADERS_SENT → 처리되지 않는 예외). 헤더 전송 여부를 보고 안전하게 끝낸다.
    console.error("[server]", e && e.stack || e);
    if (nodeRes.headersSent) { try { nodeRes.end(); } catch { /* 이미 닫힘 */ } return; }
    nodeRes.writeHead(500, { "Content-Type": "application/json" });
    nodeRes.end(JSON.stringify({ error: "internal error" }));
  }
});

server.listen(PORT, () => console.log(`server on :${PORT}  (static=${ROOT})`));
