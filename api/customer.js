import {customerSettings,openCustomerPool,CustomerStore} from '../server/customer-data.js';
import {parseBody} from './_request.js';
let storePromise;
async function handle(req,res,type,injectedStore){
  if(!(injectedStore?.settings||customerSettings()).enabled)return res.status(503).json({error:'고객 정보 저장은 아직 준비 중이에요.'});
  try{
    if(!injectedStore&&!storePromise)storePromise=openCustomerPool().then(db=>new CustomerStore(db)).catch(e=>{storePromise=null;throw e;});
    const store=injectedStore||await storePromise;
    const body=parseBody(req.body);
    const result=type==='submit'?await store.submit(body):await store.click(body);
    return res.status(200).json(result);
  }catch(e){
    if(/^(CONSENT_REQUIRED|INVALID_|UNKNOWN_FIELD)/.test(e.message))return res.status(400).json({error:'동의와 입력 내용을 확인해 주세요.'});
    console.error('[customer-data] storage unavailable');
    return res.status(503).json({error:'저장하지 못했어요. 잠시 후 다시 시도해 주세요.'});
  }
}
export const submitCustomer=(req,res)=>handle(req,res,'submit');
export const recordClick=(req,res)=>handle(req,res,'click');
export const customerHandler=(type,store)=>(req,res)=>handle(req,res,type,store);
