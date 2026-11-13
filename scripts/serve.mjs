import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2','.mp3':'audio/mpeg','.ico':'image/x-icon'};
export function createStaticServer({root=resolve('dist')}={}){
 return createServer(async(req,res)=>{
  try{
   if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
   const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=resolve(root,'.'+path);
   if(file!==root&&!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}
   let target=file;
   try{if(!(await stat(target)).isFile())throw Error('not a file');}
   catch{if(path.startsWith('/assets/')||path.startsWith('/.well-known/')||extname(path)&&path!=='/'){res.writeHead(404,{'Cache-Control':'no-store','Content-Type':'text/plain'});res.end('Asset unavailable. Reload the latest app.');return;}target=resolve(root,'index.html');}
   const data=await readFile(target),hashed=path.startsWith('/assets/');
   res.writeHead(200,{'Content-Type':(path==='/.well-known/apple-app-site-association'?'application/json':types[extname(target)])||'application/octet-stream','Cache-Control':hashed?'public, max-age=31536000, immutable':'no-cache, no-store, must-revalidate','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:data);
  }catch{res.writeHead(400,{'Cache-Control':'no-store'});res.end('Unable to serve this request');}
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)createStaticServer().listen(Number(process.env.PORT)||3000,'0.0.0.0');
