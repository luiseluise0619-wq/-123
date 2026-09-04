// Vercel 서버리스 함수 — 건축물대장(표제부) 실시간 조회.
// 좌표(클릭 위치) → 카카오 coord2address 로 법정동코드·지번 → 국토부 건축HUB 표제부.
// 키는 모두 서버 환경변수(브라우저 노출 안 함):
//   KAKAO_REST_KEY   (필수)  좌표→주소 역지오코딩 (kakao.js 와 동일 키 재사용)
//   DATA_GO_KR_KEY   (필수)  건축HUB 건축물대장정보(활용신청 승인 필요) — 주차/상가정보와 같은 data.go.kr 키
//   ALLOWED_ORIGIN   (선택)  지정 시 그 도메인만 허용
//
// 프론트 호출: POST /api/building  { x:127.02, y:37.49 }   (x=경도, y=위도)
// 응답: { ok, addr, bld:{ name, use, grndFlr, ugrndFlr, totArea, aprDay, struct } }

const BLD_BASE = "https://apis.data.go.kr/1613000/BldRgstHubService/getBrTitleInfo";

function pad4(v){ const s=String(v==null?0:v).replace(/[^0-9]/g,""); return s.padStart(4,"0").slice(-4); }
function num(v){ const n=Number(v); return Number.isFinite(n)?n:null; }
import { isAllowedOrigin, FORBIDDEN_MSG } from "./_origin.js";
import { safeError } from "./_err.js";
// encKey: data.go.kr 인증키 Encoding/Decoding 두 형태 자동 처리. support.js 와 공유(_http.js).
import { fetchT, encKey } from "./_http.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  if (!isAllowedOrigin(req)) return res.status(403).json({ error: FORBIDDEN_MSG });

  const kakaoKey = process.env.KAKAO_REST_KEY;
  const govKey = process.env.DATA_GO_KR_KEY;
  if (!kakaoKey) return res.status(200).json({ ok:false, configured:false, error:"KAKAO_REST_KEY 미설정(Vercel 환경변수)." });
  if (!govKey)  return res.status(200).json({ ok:false, configured:false, error:"DATA_GO_KR_KEY 미설정 — Vercel → Settings → Environment Variables 에 data.go.kr 인증키를 추가하세요(건축물대장 활용신청 승인 필요)." });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};
  const x = num(body.x), y = num(body.y);
  if (x == null || y == null) return res.status(400).json({ error: "좌표(x,y) 필요" });

  try {
    // 1) 좌표 → 법정동코드(b_code) + 지번(본번/부번)
    const geoUrl = `https://dapi.kakao.com/v2/local/geo/coord2address.json?x=${x}&y=${y}`;
    const gr = await fetchT(geoUrl, { headers: { Authorization: `KakaoAK ${kakaoKey}` } });
    const gd = await gr.json().catch(() => ({}));
    const doc = (gd.documents || [])[0];
    const a = doc && doc.address;
    if (!a || !a.b_code) return res.status(200).json({ ok:false, error:"이 위치의 지번 주소를 찾지 못했습니다." });
    const sigunguCd = a.b_code.slice(0,5);
    const bjdongCd  = a.b_code.slice(5,10);
    const platGbCd  = a.mountain_yn === "Y" ? "1" : "0";   // 산 여부
    const bun = pad4(a.main_address_no), ji = pad4(a.sub_address_no);
    const addr = a.address_name || "";

    // 2) 건축물대장 표제부 (serviceKey는 형태 자동 처리 후 수동 조립, 나머지는 인코딩)
    const rest = new URLSearchParams({ sigunguCd, bjdongCd, platGbCd, bun, ji,
                                       _type:"json", numOfRows:"20", pageNo:"1" });
    const br = await fetchT(`${BLD_BASE}?serviceKey=${encKey(govKey)}&${rest}`);
    const bd = await br.json().catch(() => ({}));
    const head = bd?.response?.header;
    if (head && head.resultCode && !["00","000","INFO-000"].includes(String(head.resultCode))) {
      return res.status(200).json({ ok:false, addr, error:`건축물대장 오류: ${head.resultMsg || head.resultCode}` });
    }
    let items = bd?.response?.body?.items?.item;
    if (!items) return res.status(200).json({ ok:false, addr, error:"이 지번의 건축물대장이 없습니다(무허가·미등재 가능)." });
    if (!Array.isArray(items)) items = [items];
    // 대표동: 연면적 가장 큰 것
    items.sort((p,q) => (num(q.totArea)||0) - (num(p.totArea)||0));
    const it = items[0];

    return res.status(200).json({
      ok: true, addr,
      bld: {
        name: it.bldNm || "",
        use: it.mainPurpsCdNm || it.etcPurps || "",
        grndFlr: num(it.grndFlrCnt),
        ugrndFlr: num(it.ugrndFlrCnt),
        totArea: num(it.totArea),
        aprDay: it.useAprDay || "",
        struct: it.strctCdNm || "",
        dongCnt: items.length,
      },
    });
  } catch (e) {
    // 건축HUB 호출 URL 에는 serviceKey 가 들어 있다. 오류 원문을 그대로 내보내면 키가 새어 나간다.
    return res.status(200).json({ ok:false, error: safeError("building", e, "조회 실패") });
  }
}
