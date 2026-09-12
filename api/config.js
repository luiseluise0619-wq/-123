import {customerSettings} from '../server/customer-data.js';

function kakaoMapSettings() {
  const javascriptKey=String(process.env.KAKAO_JAVASCRIPT_KEY||'').trim();
  // JavaScript 키는 지도 SDK가 브라우저에서 직접 쓰는 공개 식별자다. 고정된
  // Kakao SDK 주소에 URL 인코딩해 넣고, REST/어드민 키는 절대 내려보내지 않는다.
  const valid=/^[A-Za-z0-9_-]{16,128}$/.test(javascriptKey);
  return valid?{enabled:true,javascriptKey}:{enabled:false};
}

function publicContactSettings(){
  const email=String(process.env.PUBLIC_CONTACT_EMAIL||'').trim();
  // 이 값은 사이트 하단에 공개되는 주소다. 잘못된 값이나 줄바꿈을 그대로
  // HTML/mailto에 넣지 않도록 일반 이메일 형태와 길이만 통과시킨다.
  return /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/.test(email)&&email.length<=254
    ? {email} : {};
}

export function publicConfig(customerData=customerSettings()) {
  return {
    reportEmailEnabled:process.env.REPORT_EMAIL_ENABLED === 'true' && !!process.env.BREVO_API_KEY && !!process.env.REPORT_FROM_EMAIL,
    customerData,
    kakaoMap:kakaoMapSettings(),
    publicContact:publicContactSettings(),
  };
}

export default function handler(req,res) {
  return res.status(200).json(publicConfig());
}
