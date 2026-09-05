import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from './server/app.js';
import {validateData} from './scripts/validate-data.mjs';
const port=Number(process.env.PORT||3000);
if(!Number.isInteger(port)||port<1||port>65535)throw new Error('PORT must be 1..65535');
if(process.env.NODE_ENV==='production'&&!process.env.ALLOWED_ORIGIN)throw new Error('ALLOWED_ORIGIN is required');
const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'frontend');
validateData(path.join(root,'data','v3'));
const server=createServer(root);
server.listen(port,process.env.HOST||'0.0.0.0',()=>console.log('Listening on port '+port));
let stopping=false;
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{
  if(stopping)return;stopping=true;
  const timer=setTimeout(()=>{server.closeAllConnections();process.exit(1);},15000);timer.unref();
  server.close(()=>{clearTimeout(timer);process.exit(0);});
  server.closeIdleConnections();
});
