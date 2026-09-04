// Vercel 서버리스 함수 — 사업자등록번호로 사업장 기본정보 조회.
//
// 무엇을 하나
//   사업자등록번호 10자리를 받아 국세청 공표 정보를 돌려준다.
//     · 계속사업자 / 휴업자 / 폐업자
//     · 과세유형(일반·간이·면세)
//     · 폐업일 · 과세유형 전환일
//   '이미 운영 중' 진단에서 사장님이 직접 적지 않아도 되게 하려는 것이다.
//
// 무엇을 하지 않나 — 여기가 중요하다
//   · **사업자등록번호를 저장하지 않는다.** 조회에 쓰고 그대로 버린다.
//     로그에도 남기지 않는다(번호 전체를 print 하지 않는다).
//   · 대표자 성명·주민번호 같은 것은 애초에 요청하지 않는다.
//     국세청 '진위확인' API 는 성명·개업일을 함께 보내야 하지만, 우리는
//     그 쪽을 쓰지 않고 **상태조회(status)** 만 쓴다 — 개인정보를 받을 이유가 없다.
//
// 필요 환경변수 (Vercel → Settings → Environment Variables)
//   DATA_GO_KR_KEY  공공데이터포털 「국세청_사업자등록정보 진위확인 및 상태조회」 서비스키(Decoding)
//   키가 없으면 configured:false 로 정직하게 답한다(빈 값을 지어내지 않는다).
//
// 프론트 호출: POST /api/bizinfo  { bno: "1234567890" }
// 응답: { ok, configured, found, status, statusCode, taxType, closedAt, changedAt }
import { isAllowedOrigin, FORBIDDEN_MSG } from "./_origin.js";
import { fetchT, encKey } from "./_http.js";
import { redact } from "./_err.js";

const ENDPOINT = "https://api.odcloud.kr/api/nts-businessman/v1/status";

// 사업자등록번호 체크섬(모듈러스). **막는 데 쓰지 않는다.**
//
// 왜 안 막나
//   이 식이 조금이라도 틀리면 멀쩡한 번호를 가진 사장님이 조회 자체를 못 한다.
//   API 호출 한 번 아끼려다 진짜 사용자를 막는 건 남는 장사가 아니다.
//   맞고 틀림을 판정할 권한은 국세청에 있다 — 형식(숫자 10자리)만 확인하고 보낸다.
//   체크섬은 결과 문구에 "자릿수를 확인해 보세요" 힌트를 붙이는 데만 쓴다.
function bnoLooksOdd(d) {
  const w = [1, 3, 7, 1, 3, 7, 1, 3, 5];
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(d[i]) * w[i];
  sum += Math.floor((Number(d[8]) * 5) / 10);
  return (10 - (sum % 10)) % 10 !== Number(d[9]);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!isAllowedOrigin(req)) return res.status(403).json({ error: FORBIDDEN_MSG });

  const body = typeof req.body === "string" ? safeJson(req.body) : (req.body || {});
  const bno = String(body.bno || "").replace(/\D/g, "");

  if (!/^\d{10}$/.test(bno)) {
    return res.status(200).json({
      ok: false, configured: true, found: false,
      error: "사업자등록번호 10자리를 숫자로 넣어 주세요.",
    });
  }
  const odd = bnoLooksOdd(bno);   // 힌트로만 쓴다 — 이것 때문에 조회를 막지 않는다

  const key = process.env.DATA_GO_KR_KEY;
  if (!key) {
    return res.status(200).json({
      ok: false, configured: false, found: false,
      error: "사업자 조회 키가 설정되지 않았습니다. 공공데이터포털에서 「국세청_사업자등록정보 진위확인 및 상태조회」를 신청해 DATA_GO_KR_KEY 로 넣어 주세요.",
    });
  }

  try {
    const r = await fetchT(`${ENDPOINT}?serviceKey=${encKey(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ b_no: [bno] }),
    });
    const j = await r.json().catch(() => null);
    const d = j && Array.isArray(j.data) ? j.data[0] : null;

    if (!d) {
      return res.status(200).json({
        ok: false, configured: true, found: false,
        error: "국세청에서 조회 결과를 받지 못했습니다. 잠시 후 다시 시도해 주세요.",
      });
    }
    // b_stt_cd: 01 계속사업자 · 02 휴업자 · 03 폐업자. 빈 값이면 등록되지 않은 번호다.
    const code = d.b_stt_cd || "";
    if (!code) {
      return res.status(200).json({
        ok: true, configured: true, found: false,
        error: odd
          ? "국세청에 등록되지 않은 번호입니다. 자릿수를 한 번 더 확인해 보세요."
          : "국세청에 등록되지 않은 번호입니다.",
      });
    }
    return res.status(200).json({
      ok: true, configured: true, found: true,
      statusCode: code,
      status: d.b_stt || (code === "01" ? "계속사업자" : code === "02" ? "휴업자" : "폐업자"),
      taxType: d.tax_type || "",
      closedAt: d.end_dt || "",
      changedAt: d.tax_type_change_dt || "",
      // 사업자번호는 되돌려주지 않는다. 화면이 이미 갖고 있고, 여기서 다시 흘릴 이유가 없다.
    });
  } catch (e) {
    // 사업자등록번호는 로그에도 남기지 않는다(파일 머리말의 약속). 오류 원인만 남긴다.
    console.error("[bizinfo]", redact((e && e.stack) || e));
    return res.status(200).json({
      ok: false, configured: true, found: false,
      error: "조회 중 오류가 났습니다. 잠시 후 다시 시도해 주세요.",
    });
  }
}

function safeJson(s) { try { return JSON.parse(s); } catch { return {}; } }
