import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {CustomerStore,customerSettings,validateSubmission,encrypt,decrypt,csv} from '../server/customer-data.js';
import {createAdminServer} from '../server/customer-admin.js';
const env={CUSTOMER_DATA_ENABLED:'true',CUSTOMER_DATABASE_URL:'postgresql://localhost/test',CUSTOMER_DATA_KEY:'12'.repeat(32),CUSTOMER_RETENTION_DAYS:'30',CUSTOMER_PRIVACY_VERSION:'test-v1',CUSTOMER_CONTROLLER:'Test operator',CUSTOMER_CONTACT:'test@example.invalid'};
const record={id:'12345678-1234-4234-8234-123456789abc',email:'person@example.invalid',agreed:true,privacyVersion:'test-v1',answers:{gu:'마포구',industry:'커피-음료',need:'=HYPERLINK("invalid")'}};
function restoreEnv(snapshot){for(const key of Object.keys(process.env))if(!(key in snapshot))delete process.env[key];Object.assign(process.env,snapshot);}
test('customer collection fails closed without complete settings and explicit consent',()=>{
  assert.equal(customerSettings({}).enabled,false);
  assert.equal(customerSettings({...env,CUSTOMER_DATA_KEY:''}).enabled,false);
  assert.equal(customerSettings({...env,CUSTOMER_RETENTION_DAYS:'0'}).enabled,false);
  for(const invalid of [{...record,agreed:'true'},{...record,privacyVersion:'old'},{...record,answers:{password:'unwanted'}},{...record,email:'bad'}])assert.throws(()=>validateSubmission(invalid,customerSettings(env)));
});
test('customer ciphertext rejects tampering and swapping between submissions',()=>{
  const encoded=encrypt({email:record.email},env.CUSTOMER_DATA_KEY,record.id);
  assert.equal(Buffer.from(encoded,'base64').includes(Buffer.from(record.email)),false);
  assert.deepEqual(decrypt(encoded,env.CUSTOMER_DATA_KEY,record.id),{email:record.email});
  assert.throws(()=>decrypt(encoded,env.CUSTOMER_DATA_KEY,'another-id'));
  const bytes=Buffer.from(encoded,'base64');bytes[15]^=1;
  assert.throws(()=>decrypt(bytes.toString('base64'),env.CUSTOMER_DATA_KEY,record.id));
});
test('PostgreSQL storage, consent, encrypted rows, aggregates, masking, expiry and admin access',async()=>{
  const db=new PGlite();await db.exec(await readFile(new URL('../deploy/customer-schema.sql',import.meta.url),'utf8'));
  const store=new CustomerStore(db,env);
  let server;
  try{
    assert.equal((await store.submit(record)).created,true);
    assert.equal((await store.submit(record)).created,false);
    const stored=(await db.query('SELECT * FROM customer_submissions')).rows[0];
    assert.ok(!JSON.stringify(stored).includes(record.email));assert.ok(!JSON.stringify(stored).includes('마포구'));
    assert.equal((await store.list()).rows[0].email,'p***@example.invalid');
    assert.equal((await store.list({reveal:true})).rows[0].email,record.email);
    await assert.rejects(store.click({event:'report.csv',device:'desktop',agreed:false}));
    await assert.rejects(store.click({event:'report.csv',device:'desktop',agreed:true,email:record.email}));
    await store.click({event:'report.csv',device:'desktop',agreed:true});await store.click({event:'report.csv',device:'desktop',agreed:true});
    assert.equal(Number((await store.clicks())[0].count),2);
    const token='34'.repeat(32);server=createAdminServer(store,token,0);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const base='http://127.0.0.1:'+server.address().port;
    const request=(route,body={},auth=token,origin=base)=>fetch(base+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+auth,Origin:origin},body:JSON.stringify(body)});
    assert.equal((await request('list',{},'bad')).status,401);
    assert.equal((await request('list',{},token,'https://attacker.invalid')).status,403);
    assert.equal((await request('list')).status,200);
    const exported=await(await request('export',{reveal:true})).text();
    assert.ok(exported.includes(record.email));assert.ok(exported.includes("'=HYPERLINK"));
    assert.equal((await db.query('SELECT * FROM customer_admin_audit')).rows.length,2);
    await db.query("UPDATE customer_submissions SET expires_at=now()-interval '1 day'");
    assert.equal((await store.list()).rows.length,0);await store.purge();
    assert.equal((await db.query('SELECT * FROM customer_submissions')).rows.length,0);
    await store.submit(record);await store.remove(record.id);assert.equal((await store.list()).rows.length,0);
  }finally{if(server)await new Promise(resolve=>server.close(resolve));await db.close();}
});
test('CSV escapes spreadsheet formulas and quotes',()=>{assert.equal(csv([{value:'=1+1',note:'a"b'}]),'\uFEFF"value","note"\r\n"\'=1+1","a""b"');});

test('admin assets and API work below the same-domain /admin path',async()=>{
  const previous={...process.env};Object.assign(process.env,{CUSTOMER_ADMIN_BASE_PATH:'/admin',CUSTOMER_ADMIN_PUBLIC:'1',CUSTOMER_ADMIN_ALLOWED_HOSTS:'127.0.0.1',CUSTOMER_ADMIN_ALLOWED_ORIGINS:'127.0.0.1'});
  const db=new PGlite();await db.exec(await readFile(new URL('../deploy/customer-schema.sql',import.meta.url),'utf8'));
  const store=new CustomerStore(db,env),token='56'.repeat(32),server=createAdminServer(store,token,0);
  try{
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
    const redirect=await fetch(base+'/admin',{redirect:'manual'});
    assert.equal(redirect.status,308);assert.equal(redirect.headers.get('location'),'/admin/');
    assert.equal((await fetch(base+'/admin/')).status,200);
    assert.equal((await fetch(base+'/admin/admin.js')).status,200);
    const result=await fetch(base+'/admin/api/clicks',{method:'POST',headers:{Origin:'http://127.0.0.1','Content-Type':'application/json',Authorization:'Bearer '+token},body:'{}'});
    assert.equal(result.status,200);
  }finally{
    server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await db.close();restoreEnv(previous);
  }
});
