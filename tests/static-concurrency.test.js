import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {createServer} from '../server/app.js';

test('initial page load serves more than 20 cold static assets without 503',async t=>{
  const root=await mkdtemp(path.join(tmpdir(),'mysbizon-static-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const payload=randomBytes(256*1024);
  await Promise.all(Array.from({length:30},(_,i)=>writeFile(path.join(root,`asset-${i}.js`),payload)));

  const server=createServer(root);
  await new Promise((resolve,reject)=>{
    server.once('error',reject);
    server.listen(0,'127.0.0.1',resolve);
  });
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const {port}=server.address();
  const agent=new http.Agent({keepAlive:false,maxSockets:64});
  t.after(()=>agent.destroy());

  const statuses=await Promise.all(Array.from({length:30},(_,i)=>new Promise((resolve,reject)=>{
    const req=http.get({host:'127.0.0.1',port,path:`/asset-${i}.js`,agent,headers:{'Accept-Encoding':'gzip'}},res=>{
      res.resume();
      res.once('end',()=>resolve(res.statusCode));
    });
    req.once('error',reject);
  })));

  assert.deepEqual([...new Set(statuses)],[200]);
});
