// Read-only checks against the existing loopback preview. No seed or decision writes.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const base='http://127.0.0.1:5540';
const get=(path,extra={})=>fetch(base+path,{redirect:'manual',...extra});
for(const view of ['later','outside']){
  const response=await get('/review?view='+view);
  assert.equal(response.status,303);
  const redirect=new URL(response.headers.get('location'));
  assert.equal(redirect.origin,base);
  assert.equal(redirect.pathname,'/signin-with-chatgpt');
  assert.equal(redirect.searchParams.get('return_to'),'/review?view='+view);
}
for(const path of ['/api/review','/api/export','/api/identity'])assert.equal((await get(path)).status,401,path);
const signin=await get('/signin-with-chatgpt?return_to=%2Freview%3Fview%3Dlater');
const cookie=signin.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ');assert.ok(cookie);
const headers={Cookie:cookie};
const before=await (await get('/api/review',{headers})).json();assert.ok(Array.isArray(before.items));
for(const view of ['later','outside']){
  const response=await get('/review?view='+view,{headers});
  assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/);
  assert.match(response.headers.get('x-robots-tag'),/noindex/);
  assert.match(response.headers.get('content-security-policy'),/script-src 'self'/);
  const html=await response.text();
  assert.match(html,/id="page-title"/);assert.match(html,/<script type="module" src="\/app.js\?v=saved-later-20260909"/);
}
for(const file of ['app.js','review-queue.js']){
  const response=await get('/'+file+'?v=saved-later-20260909');
  assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/javascript/);
  assert.equal((await response.text()).trim(),readFileSync(new URL('../public/'+file,import.meta.url),'utf8').trim());
}
const after=await (await get('/api/review',{headers})).json();assert.deepEqual(after,before);
console.log('PASS: later/outside routes, same-origin sign-in return paths, anonymous gates, noindex/no-store, current module assets, and unchanged local decisions. No writes made.');
