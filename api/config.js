import {customerSettings} from '../server/customer-data.js';

function kakaoMapSettings() {
  const javascriptKey=String(process.env.KAKAO_JAVASCRIPT_KEY||'').trim();
  // JavaScript 키는 지도 SDK가 브라우저에서 직접 쓰는 공개 식별자다. 고정된
  // Kakao SDK 주소에 URL 인코딩해 넣고, REST/어드민 키는 절대 내려보내지 않는다.
  const valid=/^[A-Za-z0-9_-]{16,128}$/.test(javascriptKey);
  return valid?{enabled:true,javascriptKey}:{enabled:false};
}

export function publicConfig(customerData=customerSettings()) {
  return {
    reportEmailEnabled:process.env.REPORT_EMAIL_ENABLED === 'true' && !!process.env.BREVO_API_KEY && !!process.env.REPORT_FROM_EMAIL,
    customerData,
    kakaoMap:kakaoMapSettings(),
  };
}

export default function handler(req,res) {
  return res.status(200).json(publicConfig());
}
