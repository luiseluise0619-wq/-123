import { createHash } from 'node:crypto';
import { parseBody, requirePost } from './_request.js';
import { isAllowedOrigin, FORBIDDEN_MSG } from './_origin.js';
import { fetchT } from './_http.js';
import { safeError } from './_err.js';

const text = (v, n) => typeof v === 'string' ? v.slice(0,n) : '';
export function reportInput(raw) {
  const b = parseBody(raw);
  const email = text(b.email,255).trim();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('이메일 형식을 확인해 주세요.');
  if (b.agreed !== true) throw new Error('개인정보 처리 동의가 필요합니다.');
  const rows = (value, keys) => {
    if (value == null) return [];
    if (!Array.isArray(value) || value.length > 30) throw new Error('리포트 항목을 확인해 주세요.');
    return value.map(row => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error('리포트 항목을 확인해 주세요.');
      return Object.fromEntries(keys.map(k => [k,text(row[k],300)]));
    });
  };
  return {email,headline:'상권 분석 리포트',sub:text(b.sub,200),facts:rows(b.facts,['label','value','tag']),survey:rows(b.survey,['label','value']),zones:rows(b.zones,['name','value']),honesty:'매출은 상권 집계에서 계산한 추정치입니다. 입력 조건과 계산값은 사용자가 제공했으며 서버가 검증한 개별 점포 실적이 아닙니다.'};
}
const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// 리포트 본문. 추정값·입력값 표시를 문서에도 남긴다.
function html(d) {
  const row = (k, v, tag) =>
    `<tr>
       <td style="padding:10px 0;border-bottom:1px solid #EDEDF0;color:#4E5968;font-size:14px">${esc(k)}</td>
       <td style="padding:10px 0;border-bottom:1px solid #EDEDF0;text-align:right;font-size:15px;font-weight:600;color:#191F28">${esc(v)}</td>
       <td style="padding:10px 0 10px 12px;border-bottom:1px solid #EDEDF0;text-align:right;color:#8B95A1;font-size:11px;white-space:nowrap">${esc(tag || '')}</td>
     </tr>`;

  const facts = (d.facts || []).map(f => row(f.label, f.value, f.tag)).join('');
  const survey = (d.survey || []).map(s => row(s.label, s.value, '입력')).join('');
  const zones = (d.zones || []).map((z, i) =>
    `<tr>
       <td style="padding:8px 0;color:#8B95A1;font-size:12px">${i + 1}</td>
       <td style="padding:8px 0;font-size:14px;color:#191F28">${esc(z.name)}</td>
       <td style="padding:8px 0;text-align:right;font-size:14px;color:#191F28">${esc(z.value)}</td>
     </tr>`).join('');

  return `<!doctype html><html lang="ko"><body style="margin:0;background:#F5F5F7;font-family:-apple-system,'Apple SD Gothic Neo',sans-serif">
  <div style="max-width:600px;margin:0 auto;padding:28px 20px">
    <div style="background:#FFFFFF;border-radius:20px;padding:28px">
      <div style="font-size:12px;color:#3182F6;font-weight:700;letter-spacing:-0.01em">MYSBIZON 리포트</div>
      <h1 style="font-size:22px;font-weight:700;letter-spacing:-0.02em;line-height:1.3;margin:10px 0 0;color:#191F28">${esc(d.headline || '')}</h1>
      <p style="font-size:14px;color:#4E5968;line-height:1.6;margin:10px 0 0">${esc(d.sub || '')}</p>

      ${facts ? `<table style="width:100%;border-collapse:collapse;margin-top:22px">${facts}</table>` : ''}
      ${zones ? `<div style="font-size:13px;font-weight:600;margin:26px 0 6px;color:#191F28">비교한 자리</div>
                 <table style="width:100%;border-collapse:collapse">${zones}</table>` : ''}
      ${survey ? `<div style="font-size:13px;font-weight:600;margin:26px 0 6px;color:#191F28">직접 알려주신 조건</div>
                  <table style="width:100%;border-collapse:collapse">${survey}</table>` : ''}

      <p style="font-size:11.5px;color:#8B95A1;line-height:1.75;margin:26px 0 0">
        ${esc(d.honesty || '')}
      </p>
    </div>
    <p style="font-size:11px;color:#8B95A1;text-align:center;margin:16px 0 0">
      이 리포트의 입력 조건과 계산값은 사용자가 제공한 참고 자료이며 개별 점포의 실적이나 수익을 보장하지 않습니다.
    </p>
  </div></body></html>`;
}


async function deliver(req,res) {
  if (!requirePost(req,res)) return;
  if (!isAllowedOrigin(req)) return res.status(403).json({error:FORBIDDEN_MSG});
  let data;
  try {data=reportInput(req.body);}catch(e){return res.status(400).json({error:e.message});}
  if (process.env.REPORT_EMAIL_ENABLED !== 'true' || !process.env.BREVO_API_KEY || !process.env.REPORT_FROM_EMAIL) return res.status(503).json({error:'메일 발송은 준비 중입니다. 미리보기와 CSV 저장을 이용해 주세요.'});
  try {
    const response=await fetchT('https://api.brevo.com/v3/smtp/email',{
      method:'POST',headers:{'api-key':process.env.BREVO_API_KEY,'content-type':'application/json',accept:'application/json'},
      body:JSON.stringify({sender:{email:process.env.REPORT_FROM_EMAIL,name:process.env.REPORT_FROM_NAME||'MYSBIZON'},to:[{email:data.email}],subject:'상권 분석 리포트 · MYSBIZON',htmlContent:html(data)})
    },10000);
    if (!response.ok) { console.error('[report] upstream status',response.status); return res.status(502).json({error:'메일 발송을 요청하지 못했습니다. 잠시 후 다시 시도해 주세요.'}); }
    return res.status(200).json({ok:true});
  } catch(e) {return res.status(502).json({error:safeError('report',e,'발송 결과를 확인하지 못했습니다. 수신함을 먼저 확인해 주세요')});}
}

// 메일 발송은 자동 재시도하지 않는다. 같은 요청의 중복 클릭/동시 요청만 합친다.
const requests = new Map();
export default async function handler(req,res) {
  if (!requirePost(req,res))return;
  if (!isAllowedOrigin(req))return res.status(403).json({error:FORBIDDEN_MSG});
  const key=String(req.headers['idempotency-key']||'');
  if(!/^[a-zA-Z0-9-]{16,80}$/.test(key))return res.status(400).json({error:'요청 식별자가 필요합니다. 화면을 새로고침해 주세요.'});
  const signature=createHash('sha256').update(JSON.stringify(parseBody(req.body))).digest('hex');
  const now=Date.now();
  for(const [k,v] of requests)if(v.until<now)requests.delete(k);
  let request=requests.get(key);
  if(request&&request.signature!==signature)return res.status(409).json({error:'입력 내용이 바뀌었습니다. 화면을 새로고침한 뒤 다시 시도해 주세요.'});
  if(!request){
    if(requests.size>=1000)return res.status(503).json({error:'발송 요청이 많습니다. 잠시 후 다시 시도해 주세요.'});
    request={signature,until:now+3600000,promise:null};
    request.promise=(async()=>{let status=200,body;await deliver(req,{status(n){status=n;return this;},json(value){body=value;}});return {status,body};})();
    requests.set(key,request);
  }
  const result=await request.promise;
  return res.status(result.status).json(result.body);
}
