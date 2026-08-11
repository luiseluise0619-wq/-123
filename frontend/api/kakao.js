// Vercel 서버리스 함수 — 카카오 로컬(REST) 검색 프록시.
// REST API 키는 서버 전용 비밀키라 브라우저에 노출하지 않는다. 여기서만 사용.
// 필요 환경변수(Vercel → Settings → Environment Variables):
//   KAKAO_REST_KEY   (필수)  카카오 developers 앱의 REST API 키
//   ALLOWED_ORIGIN   (선택)  지정 시 그 도메인만 허용(없으면 자기 배포 도메인)
//
// 프론트 호출: POST /api/kakao
//   { mode:"keyword", query:"스타벅스", x:127.02, y:37.49, radius:500, page:1 }
//   { mode:"category", code:"FD6", x:127.02, y:37.49, radius:500, page:1 }
//     code: 카카오 카테고리 그룹 코드(FD6 음식점, CE7 카페, CS2 편의점, HP8 병원 …)
// 응답: { ok, total, pageable, items:[{id,name,category,phone,address,road,x,y,url,dist}] }

const GROUP = new Set(["MT1","CS2","PS3","SC4","AC5","PK6","OL7","SW8","BK9","CT1","AG2","PO3","AT4","AD5","FD6","CE7","HP8","PM9"]);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  // 같은 사이트에서 온 요청만 허용 → REST 키 남용 차단(chat.js 와 동일 방어).
  const origin = req.headers.origin || "";
  const host = req.headers.host || "";
  const allow = process.env.ALLOWED_ORIGIN;
  const sameSite = origin && (origin.endsWith(host) || (host && origin.includes(host.split(":")[0])));
  const okOrigin = allow ? origin === allow : (sameSite || origin.endsWith(".vercel.app") || !origin);
  if (!okOrigin) return res.status(403).json({ error: "이 사이트에서만 사용할 수 있습니다." });

  const key = process.env.KAKAO_REST_KEY;
  if (!key) {
    return res.status(200).json({
      ok: false, configured: false, items: [],
      error: "카카오 REST 키가 설정되지 않았습니다. Vercel → Settings → Environment Variables 에 KAKAO_REST_KEY 를 추가하세요.",
    });
  }

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};
  const mode = body.mode === "category" ? "category" : "keyword";
  const x = body.x != null ? Number(body.x) : null;   // 경도 lon
  const y = body.y != null ? Number(body.y) : null;   // 위도 lat
  const radius = Math.max(0, Math.min(20000, Number(body.radius) || 0)); // m, 최대 20km(카카오 제한)
  const page = Math.max(1, Math.min(45, Number(body.page) || 1));
  const size = Math.max(1, Math.min(15, Number(body.size) || 15));

  // 좌표 → 주소·자치구·행정동 (핀 분석용). 카카오 geo 2종을 서버에서 합쳐 반환.
  if (body.mode === "coord") {
    if (x == null || y == null || isNaN(x) || isNaN(y)) return res.status(400).json({ error: "x·y 가 필요합니다." });
    const H = { Authorization: "KakaoAK " + key };
    try {
      const [ar, rr] = await Promise.all([
        fetch(`https://dapi.kakao.com/v2/local/geo/coord2address.json?x=${x}&y=${y}`, { headers: H }).then((r) => r.json()).catch(() => null),
        fetch(`https://dapi.kakao.com/v2/local/geo/coord2regioncode.json?x=${x}&y=${y}`, { headers: H }).then((r) => r.json()).catch(() => null),
      ]);
      const a = ar && ar.documents && ar.documents[0];
      const regs = (rr && rr.documents) || [];
      const h = regs.find((d) => d.region_type === "H") || regs[0] || {};
      return res.status(200).json({
        ok: true, configured: true,
        address: a ? ((a.road_address && a.road_address.address_name) || (a.address && a.address.address_name) || "") : "",
        gu: h.region_2depth_name || "", dong: h.region_3depth_name || "", sido: h.region_1depth_name || "",
      });
    } catch (e) {
      return res.status(200).json({ ok: false, configured: true, error: "좌표 변환 실패: " + String(e) });
    }
  }

  let url;
  const qs = new URLSearchParams();
  qs.set("size", String(size));
  qs.set("page", String(page));
  if (x != null && y != null && !isNaN(x) && !isNaN(y)) { qs.set("x", String(x)); qs.set("y", String(y)); }
  if (radius > 0) { qs.set("radius", String(radius)); qs.set("sort", "distance"); }

  if (mode === "category") {
    const code = String(body.code || "").toUpperCase();
    if (!GROUP.has(code)) return res.status(400).json({ error: "유효한 category_group_code 가 필요합니다(예: FD6, CE7, CS2)." });
    if (!(radius > 0 && x != null && y != null)) return res.status(400).json({ error: "카테고리 검색은 x·y·radius 가 필요합니다." });
    qs.set("category_group_code", code);
    url = "https://dapi.kakao.com/v2/local/search/category.json?" + qs.toString();
  } else {
    const query = String(body.query || "").trim().slice(0, 100);
    if (!query) return res.status(400).json({ error: "query 가 필요합니다." });
    qs.set("query", query);
    if (body.code && GROUP.has(String(body.code).toUpperCase())) qs.set("category_group_code", String(body.code).toUpperCase());
    url = "https://dapi.kakao.com/v2/local/search/keyword.json?" + qs.toString();
  }

  try {
    const r = await fetch(url, { headers: { Authorization: "KakaoAK " + key } });
    const data = await r.json();
    if (!r.ok) {
      return res.status(200).json({
        ok: false, configured: true, items: [],
        error: "카카오 검색 오류(" + r.status + "): " + (data?.message || data?.errorType || "알 수 없음"),
      });
    }
    const docs = Array.isArray(data.documents) ? data.documents : [];
    const items = docs.map((d) => ({
      id: d.id, name: d.place_name, category: d.category_name,
      group: d.category_group_code, phone: d.phone,
      address: d.address_name, road: d.road_address_name,
      x: Number(d.x), y: Number(d.y), url: d.place_url,
      dist: d.distance ? Number(d.distance) : null,
    }));
    const meta = data.meta || {};
    return res.status(200).json({
      ok: true, configured: true,
      total: meta.total_count || items.length,
      pageable: !(meta.is_end),
      items,
    });
  } catch (e) {
    return res.status(200).json({ ok: false, configured: true, items: [], error: "카카오 호출 실패: " + String(e) });
  }
}
