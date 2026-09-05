export function vercelRes(res) {
  return {
    statusCode:200,
    status(code) { this.statusCode=code; return this; },
    setHeader(key,value) { res.setHeader(key,value); return this; },
    json(body) { res.statusCode=this.statusCode; res.setHeader('Content-Type','application/json; charset=utf-8'); res.end(JSON.stringify(body)); },
    send(body) { res.statusCode=this.statusCode; res.end(body); },
    end(body) { res.statusCode=this.statusCode; res.end(body ?? ''); }
  };
}
export function readBody(req, maxBytes = 65536) {
  return new Promise((resolve,reject) => {
    let size=0, chunks=[], done=false;
    const finish=(error,value) => { if(done)return; done=true; clearTimeout(timer); chunks=[]; if(error)reject(error);else resolve(value); };
    const failure=(status,message)=>Object.assign(new Error(message),{status});
    const timer=setTimeout(()=>finish(failure(408,'요청 시간이 초과되었습니다.')),10000);
    if(Number(req.headers['content-length'])>maxBytes) {req.resume();finish(failure(413,'요청 본문이 너무 큽니다.'));return;}
    req.on('data',chunk=>{ if(done)return; size+=chunk.length; if(size>maxBytes) {finish(failure(413,'요청 본문이 너무 큽니다.'));return;} chunks.push(chunk); });
    req.on('end',()=>finish(null,Buffer.concat(chunks).toString('utf8')));
    req.on('error',()=>finish(failure(400,'요청을 읽지 못했습니다.')));
    req.on('aborted',()=>finish(failure(400,'요청이 중단되었습니다.')));
    req.on('close',()=>{if(!req.complete)finish(failure(400,'요청이 중단되었습니다.'));});
  });
}
