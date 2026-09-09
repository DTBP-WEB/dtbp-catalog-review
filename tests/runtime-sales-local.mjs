// Integration checks and report import ONLY on the loopback fixture. Never hosted.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {salesRows} from '../public/sales-folders.js';
const base='http://127.0.0.1:5540';
const get=(path,options={})=>fetch(base+path,{redirect:'manual',...options});
for(const view of ['6','12','18','check']){
  const r=await get('/review/sales?view='+view);assert.equal(r.status,303);
  const location=new URL(r.headers.get('location'));assert.equal(location.origin,base);assert.equal(location.searchParams.get('return_to'),'/review/sales?view='+view);
}
assert.equal((await get('/api/sales-review')).status,401);
assert.equal((await get('/api/sales-review',{method:'POST',headers:{origin:base,'content-type':'application/json'},body:'{}'})).status,401);
const signin=await get('/signin-with-chatgpt?return_to=%2Freview%2Fsales');
const cookie=signin.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');assert.ok(cookie);const headers={Cookie:cookie};
const before=await (await get('/api/export',{headers})).json();
const report=JSON.parse(readFileSync(new URL('../private/sales-review-20260909/sales-folders.json',import.meta.url),'utf8'));
const current=await get('/api/sales-review',{headers});assert.equal(current.status,200);const initial=await current.json();
const request={method:'POST',headers:{...headers,Origin:base,'Content-Type':'application/json'},body:JSON.stringify({expectedHash:initial.hash,snapshot:report})};
assert.equal((await get('/api/sales-review',{...request,headers:{...request.headers,Origin:'https://wrong.invalid'}})).status,403);
const saved=await get('/api/sales-review',request);assert.equal(saved.status,200,await saved.clone().text());
const loaded=await (await get('/api/sales-review',{headers})).json();assert.deepEqual(loaded.snapshot,report);
for(const [view,n] of Object.entries(JSON.parse(readFileSync(new URL('../private/sales-review-20260909/summary.json',import.meta.url),'utf8')).folders))assert.equal(salesRows(loaded.snapshot,view).length,n.count);
for(const path of ['/api/sales-review','/review/sales?view=18']){
  const r=await get(path,{headers});assert.equal(r.status,200);assert.match(r.headers.get('cache-control'),/private, no-store/);assert.match(r.headers.get('x-robots-tag'),/noindex/);
}
for(const file of ['sales-app.js','sales-folders.js'])assert.equal((await (await get('/'+file)).text()).trim(),readFileSync(new URL('../public/'+file,import.meta.url),'utf8').trim());
const html=await (await get('/review/sales?view=6',{headers})).text();assert.match(html,/id="count-18"/);assert.match(html,/id="report-file"/);
assert.match(await (await get('/review',{headers})).text(),/href="\/review\/sales"/);
const after=await (await get('/api/export',{headers})).json();
delete before.exportedAt;delete after.exportedAt;assert.deepEqual(after,before);
console.log('PASS: private routes, anonymous/CSRF gates, actual report import/read-back, calendar counts, noindex/no-store, current scripts, and byte-equivalent parsed catalog export/history before and after. Local fixture only.');
