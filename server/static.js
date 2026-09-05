import {readFile,stat,realpath} from 'node:fs/promises';
import path from 'node:path';
import {gzip as compress} from 'node:zlib';
import {promisify} from 'node:util';
const gzip=promisify(compress);
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.woff2':'font/woff2','.txt':'text/plain; charset=utf-8'};
const cache=new Map();let cacheBytes=0;
const MAX_FILE=10*1024*1024,MAX_CACHE=24*1024*1024;
function remember(key,value){
  const old=cache.get(key);if(old){cacheBytes-=old.bytes;cache.delete(key);}
  while(cache.size && cacheBytes+value.bytes>MAX_CACHE){const oldest=cache.keys().next().value;cacheBytes-=cache.get(oldest).bytes;cache.delete(oldest);}
  if(value.bytes<=MAX_CACHE){cache.set(key,value);cacheBytes+=value.bytes;}
}
export async function serveStatic(root,pathname,res,req){
  let rel=pathname==='/'?'/index.html':pathname;
  if(rel.endsWith('/'))rel+='index.html';
  const notFound=()=>{res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end(req.method==='HEAD'?undefined:'Not found');};
  if(rel.split('/').some(p=>p.toLowerCase()==='api'||p.startsWith('.')))return notFound();
  let file=path.resolve(root,'.'+rel);
  if(!file.startsWith(path.resolve(root)+path.sep))return notFound();
  let info;
  try{info=await stat(file);}catch{if(path.extname(file))return notFound();file+='.html';try{info=await stat(file);}catch{return notFound();}}
  if(!info.isFile()||info.size>MAX_FILE)return notFound();
  const actual=await realpath(file),actualRoot=await realpath(root);
  if(!actual.startsWith(actualRoot+path.sep))return notFound();
  const ext=path.extname(file).toLowerCase();if(!MIME[ext])return notFound();
  const stamp=info.mtimeMs+':'+info.size;
  let entry=cache.get(file);
  if(!entry||entry.stamp!==stamp){
    const raw=await readFile(file);
    const zipped=['.html','.js','.json','.css','.svg','.txt'].includes(ext)&&raw.length>=1024?await gzip(raw):null;
    entry={stamp,raw,zipped,bytes:raw.length+(zipped?.length||0)};remember(file,entry);
  }
  const encoding=String(req.headers['accept-encoding']||'').split(',').map(x=>x.trim());
  const useGzip=entry.zipped&&encoding.some(x=>/^gzip(?:\s*;\s*q=(?:1(?:\.0*)?|0\.[0-9]*[1-9][0-9]*))?$/i.test(x));
  const body=useGzip?entry.zipped:entry.raw;
  const etag='W/"'+stamp+'"';
  const headers={'Content-Type':MIME[ext],'Cache-Control':'no-cache','Vary':'Accept-Encoding','ETag':etag};
  if(useGzip)headers['Content-Encoding']='gzip';
  if(req.headers['if-none-match']===etag){res.writeHead(304,headers);return res.end();}
  headers['Content-Length']=body.length;res.writeHead(200,headers);res.end(req.method==='HEAD'?undefined:body);
}
