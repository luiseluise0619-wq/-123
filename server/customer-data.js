import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

export const EVENT_IDS = Object.freeze(['nav.zone','nav.fine','nav.price','nav.report','comparison.add','market.filter','report.preview','report.csv','report.email','survey.save']);
export const SURVEY_FIELDS = Object.freeze(['sido','gu','industry','stage','age','business','when','need','cost']);
export function customerSettings(env = process.env) {
  const days = Number(env.CUSTOMER_RETENTION_DAYS);
  const enabled = env.CUSTOMER_DATA_ENABLED === 'true' && !!env.CUSTOMER_DATABASE_URL
    && /^[a-f0-9]{64}$/i.test(env.CUSTOMER_DATA_KEY || '') && Number.isInteger(days) && days >= 1 && days <= 365
    && !!env.CUSTOMER_PRIVACY_VERSION && !!env.CUSTOMER_CONTROLLER && !!env.CUSTOMER_CONTACT;
  return {enabled, retentionDays:enabled?days:0, privacyVersion:enabled?env.CUSTOMER_PRIVACY_VERSION:'',
    controller:enabled?env.CUSTOMER_CONTROLLER:'', contact:enabled?env.CUSTOMER_CONTACT:''};
}
export function validateSubmission(raw, settings) {
  if (!raw || raw.agreed !== true || raw.privacyVersion !== settings.privacyVersion) throw new Error('CONSENT_REQUIRED');
  if (!/^[0-9a-f-]{36}$/i.test(raw.id || '')) throw new Error('INVALID_ID');
  if (typeof raw.email !== 'string' || raw.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.email.trim())) throw new Error('INVALID_EMAIL');
  if (!raw.answers || typeof raw.answers !== 'object' || Array.isArray(raw.answers)) throw new Error('INVALID_ANSWERS');
  if (Object.keys(raw).some(k=>!['id','agreed','privacyVersion','email','answers'].includes(k)) || Object.keys(raw.answers).some(k=>!SURVEY_FIELDS.includes(k))) throw new Error('UNKNOWN_FIELD');
  const answers = {};
  for (const field of SURVEY_FIELDS) {
    const value = raw.answers[field] ?? '';
    if (typeof value !== 'string' || value.length > 120 || /[\x00-\x1f\x7f]/.test(value)) throw new Error('INVALID_ANSWER');
    answers[field] = value;
  }
  return {id:raw.id,email:raw.email.trim(),answers,privacyVersion:settings.privacyVersion};
}
export function encrypt(value, key, id) {
  const nonce=randomBytes(12), cipher=createCipheriv('aes-256-gcm',Buffer.from(key,'hex'),nonce);
  cipher.setAAD(Buffer.from(id));
  return Buffer.concat([nonce,cipher.update(JSON.stringify(value)),cipher.final(),cipher.getAuthTag()]).toString('base64');
}
export function decrypt(value, key, id) {
  const bytes=Buffer.from(value,'base64'), decipher=createDecipheriv('aes-256-gcm',Buffer.from(key,'hex'),bytes.subarray(0,12));
  decipher.setAAD(Buffer.from(id));decipher.setAuthTag(bytes.subarray(-16));
  return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(12,-16)),decipher.final()]).toString());
}
export function maskEmail(email) { const at=email.lastIndexOf('@');return email.slice(0,1)+'***'+email.slice(at); }
export async function openCustomerPool(env=process.env) {
  const {Pool}=await import('pg');
  const url = new URL(env.CUSTOMER_DATABASE_URL);
  const local=['127.0.0.1','localhost','[::1]'].includes(url.hostname);
  if (!local && url.searchParams.get('sslmode') !== 'verify-full') throw new Error('Remote customer DB requires sslmode=verify-full');
  const pool=new Pool({connectionString:env.CUSTOMER_DATABASE_URL,max:4,connectionTimeoutMillis:5000,idleTimeoutMillis:10000,statement_timeout:5000});
  pool.on('error',()=>console.error('[customer-db] connection error'));
  return pool;
}
export class CustomerStore {
  constructor(db,env=process.env){this.db=db;this.env=env;this.settings=customerSettings(env);}
  async submit(raw){
    const d=validateSubmission(raw,this.settings), encrypted=encrypt({email:d.email,answers:d.answers},this.env.CUSTOMER_DATA_KEY,d.id);
    const result=await this.db.query(`INSERT INTO customer_submissions (id,payload,privacy_version,expires_at)
      VALUES ($1,$2,$3,now()+($4::int * interval '1 day')) ON CONFLICT (id) DO NOTHING RETURNING id`,[d.id,encrypted,d.privacyVersion,this.settings.retentionDays]);
    return {ok:true,created:result.rows.length===1};
  }
  async click(raw){
    if (!raw || raw.agreed!==true || !EVENT_IDS.includes(raw.event) || !['mobile','tablet','desktop'].includes(raw.device) || Object.keys(raw).some(k=>!['event','device','agreed'].includes(k))) throw new Error('INVALID_EVENT');
    await this.db.query(`INSERT INTO customer_clicks (day,event,device,count) VALUES ((now() AT TIME ZONE 'Asia/Seoul')::date,$1,$2,1)
      ON CONFLICT(day,event,device) DO UPDATE SET count=customer_clicks.count+1`,[raw.event,raw.device]);
    return {ok:true};
  }
  async list({before='',reveal=false}={}){
    if(before && !/^\d{4}-\d\d-\d\dT[0-9:.]+Z$/.test(before))throw new Error('INVALID_CURSOR');
    const {rows}=await this.db.query(`SELECT id,payload,created_at,privacy_version,expires_at FROM customer_submissions
      WHERE expires_at>now() AND ($1::timestamptz IS NULL OR created_at<$1::timestamptz) ORDER BY created_at DESC LIMIT 101`,[before||null]);
    const page=rows.slice(0,100);
    return {rows:page.map(r=>{const d=decrypt(r.payload,this.env.CUSTOMER_DATA_KEY,r.id);return {id:r.id,createdAt:r.created_at,email:reveal?d.email:maskEmail(d.email),...d.answers,privacyVersion:r.privacy_version,expiresAt:r.expires_at};}),next:rows.length>100?new Date(page.at(-1).created_at).toISOString():null};
  }
  async clicks(){return (await this.db.query(`SELECT day,event,device,count FROM customer_clicks WHERE day>=(now() AT TIME ZONE 'Asia/Seoul')::date-29 ORDER BY day DESC,event,device`)).rows;}
  async audit(action){await this.db.query('INSERT INTO customer_admin_audit (action) VALUES ($1)',[action]);}
  async remove(id){if(!/^[0-9a-f-]{36}$/i.test(id||''))throw new Error('INVALID_ID');await this.db.query('DELETE FROM customer_submissions WHERE id=$1',[id]);}
  async purge(){await this.db.query('DELETE FROM customer_submissions WHERE expires_at<=now()');await this.db.query('DELETE FROM customer_clicks WHERE day<CURRENT_DATE-90');await this.db.query("DELETE FROM customer_admin_audit WHERE created_at<now()-interval '365 days'");}
}
export function csv(rows){
  if(!rows.length)return '\uFEFF';
  const keys=Object.keys(rows[0]);
  const quote=v=>{let s=String(v??'');if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
  return '\uFEFF'+[keys,...rows.map(r=>keys.map(k=>r[k]))].map(row=>row.map(quote).join(',')).join('\r\n');
}
export function tokenHash(value){return createHash('sha256').update(value).digest();}
