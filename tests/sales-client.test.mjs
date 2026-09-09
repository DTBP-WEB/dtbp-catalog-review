import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import * as folders from '../public/sales-folders.js';
// Real event handlers, synthetic data and a minimal document stub. No browser QA.
async function client(failImport=false){
  const elements=new Map(),el=id=>{if(!elements.has(id))elements.set(id,{value:'',files:[],innerHTML:'',textContent:'',disabled:false,hidden:false});return elements.get(id);};
  const buttons=['6','12','18'].map(view=>({dataset:{view},setAttribute(){}}));
  const record={productId:'00000000-0000-4000-8000-000000000001',sku:'TEST-01',name:'Test <part>',brand:'Example',isActive:true,itemType:'stockedProduct',createdDate:'2020-01-01',lastRecordedSaleDate:'2025-03-09',historyUncertain:false,stockStatus:'zero'};
  const data={hash:'initial',snapshot:{asOf:'2026-09-09',catalogCapturedAt:'2026-09-09T12:00:00Z',coverage:'Test history',dateBasis:'Test activity dates',counts:{ordersScanned:50},records:Array.from({length:35},(_,n)=>({...record,productId:String(n),sku:'TEST-'+n}))}};
  const requests=[],location={search:'?view=18',assign(){}},history={replaceState(_,__,path){location.search=path.slice(path.indexOf('?'));}};
  let printedRows=0;
  const window={addEventListener(){},print(){printedRows=(el('rows').innerHTML.match(/<tr>/g)||[]).length;}};
  const context=vm.createContext({...folders,document:{getElementById:el,querySelectorAll:()=>buttons},location,history,window,URLSearchParams,Intl,fetch:async(path,options)=>{
    assert.equal(path,'/api/sales-review');requests.push(options?.method||'GET');
    if(options?.method==='POST'&&failImport)return {ok:false,status:409,json:async()=>({error:'The report changed in another tab.'})};
    return {ok:true,status:200,json:async()=>structuredClone(data)};
  }});
  const script=readFileSync(new URL('../public/sales-app.js',import.meta.url),'utf8').replace(/^import [^\n]+\n/,'');
  vm.runInContext(script,context);await new Promise(r=>setImmediate(r));
  return {el,buttons,requests,location,get printedRows(){return printedRows;}};
}
test('folder bookmark, stock/search filtering and printing use the actual handlers without saving catalog data',async()=>{
  const c=await client();assert.equal(c.el('count-18').textContent,35);assert.equal((c.el('rows').innerHTML.match(/<tr>/g)||[]).length,30);assert.match(c.el('rows').innerHTML,/Test &lt;part&gt;/);
  c.el('print').onclick();assert.equal(c.printedRows,35);assert.equal((c.el('rows').innerHTML.match(/<tr>/g)||[]).length,30);
  c.el('stock').value='positive';c.el('stock').onchange();assert.equal(c.el('empty').hidden,false);
  c.el('stock').value='';c.el('search').value='TEST-34';c.el('search').oninput();assert.equal((c.el('rows').innerHTML.match(/<tr>/g)||[]).length,1);
  c.buttons[0].onclick();assert.equal(c.location.search,'?view=6');assert.equal(c.el('empty').hidden,false);assert.deepEqual(c.requests,['GET']);
});
test('failed report upload retains current report and chosen file; it cannot save catalog decisions',async()=>{
  const c=await client(true),file={size:50,text:async()=>'{}'};c.el('report-file').files=[file];c.el('report-file').onchange();await c.el('import').onclick();
  assert.equal(c.el('count-18').textContent,35);assert.equal(c.el('report-file').files[0],file);assert.match(c.el('notice').textContent,/preserved/);assert.deepEqual(c.requests,['GET','POST']);
});
