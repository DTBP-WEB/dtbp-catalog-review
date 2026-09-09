import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {classifySalesItem,monthsBefore,salesRows,salesView} from '../public/sales-folders.js';
import {validateSalesSnapshot,saveSalesSnapshot} from '../lib/sales-snapshot.mjs';
const item={productId:'00000000-0000-4000-8000-000000000001',sku:'TEST-01',name:'Test part',brand:'Example',isActive:true,itemType:'stockedProduct',createdDate:'2020-01-01',lastRecordedSaleDate:'2025-03-09',historyUncertain:false,stockStatus:'zero'};
const snapshot={format:'dtbp-sales-folders-v1',asOf:'2026-09-09',complete:true,readOnly:true,catalogCapturedAt:'2026-09-09T12:00:00Z',salesCapturedAt:'2026-09-09T13:00:00Z',coverage:'All available active orders',dateBasis:'Latest recorded activity',counts:{ordersScanned:12,qualifyingOrders:10},records:[item]};
test('calendar boundaries create exactly one 6/12/18-month folder',()=>{
  for(const [date,bucket] of [['2026-03-10',null],['2026-03-09','6'],['2025-09-10','6'],['2025-09-09','12'],['2025-03-10','12'],['2025-03-09','18'],['2019-01-01','18']])assert.equal(classifySalesItem({...item,lastRecordedSaleDate:date},snapshot.asOf).bucket,bucket,date);
  assert.equal(monthsBefore('2026-08-31',6),'2026-02-28');assert.equal(monthsBefore('2024-08-31',6),'2024-02-29');
  assert.throws(()=>monthsBefore('2026-02-30',6));assert.equal(salesView('?view=18'),'18');assert.equal(salesView('?view=https://bad.invalid'),'6');
});
test('no-sale/new/unreliable/inactive records do not invent a last-sale date',()=>{
  const never={...item,lastRecordedSaleDate:null};assert.equal(classifySalesItem(never,snapshot.asOf).bucket,'18');assert.match(classifySalesItem(never,snapshot.asOf).reason,/not an assumed sale date/);assert.equal(never.lastRecordedSaleDate,null);
  assert.equal(classifySalesItem({...never,createdDate:'2026-09-01'},snapshot.asOf).bucket,null);
  for(const extra of [{historyUncertain:true},{lastRecordedSaleDate:'2027-01-01'},{lastRecordedSaleDate:null,createdDate:null}])assert.equal(classifySalesItem({...item,...extra},snapshot.asOf).bucket,'check');
  assert.equal(classifySalesItem({...item,isActive:false},snapshot.asOf).bucket,null);assert.equal(classifySalesItem({...item,itemType:'service'},snapshot.asOf).bucket,null);
  assert.equal(salesRows(snapshot,'18','test','zero').length,1);assert.equal(salesRows(snapshot,'18','','positive').length,0);
});
test('snapshot validation projects safe fields and rejects invalid identity/dates',()=>{
  const normalized=validateSalesSnapshot({...snapshot,customerName:'secret',records:[{...item,price:99,quantity:999,note:'Do not retain'}]});assert.deepEqual(normalized,snapshot);
  for(const bad of [{...snapshot,complete:false},{...snapshot,records:[item,item]},{...snapshot,records:[{...item,lastRecordedSaleDate:'2026-02-30'}]},{...snapshot,records:[{...item,name:'<script>'}]},{...snapshot,records:[{...item,lastRecordedSaleDate:'2027-01-01'}]}])assert.throws(()=>validateSalesSnapshot(bad));
});
test('append-only snapshot import never mutates catalog choices; stale upload rejected',async()=>{
  const sql=new DatabaseSync(':memory:');sql.exec(readFileSync(new URL('../drizzle/0000_robust_junta.sql',import.meta.url),'utf8'));sql.exec(readFileSync(new URL('../drizzle/0001_parallel_prodigy.sql',import.meta.url),'utf8'));
  sql.exec(`INSERT INTO review_state(id,revision,ready,metadata,owner_id) VALUES(1,83,1,'{}','owner'); INSERT INTO review_decisions(id,payload) VALUES('saved','{"decision":"pending","fields":{"brand":"Owner entered"},"note":"Keep this"}');`);
  const before=sql.prepare('SELECT * FROM review_decisions').all(),stateBefore=sql.prepare('SELECT * FROM review_state').all();
  const db={prepare(query){return {first:async()=>sql.prepare(query).get()||null,bind(...args){return {run:async()=>sql.prepare(query).run(...args)};}};}};
  const first=await saveSalesSnapshot(db,snapshot,null,'owner');assert.equal(first.hash.length,64);
  await saveSalesSnapshot(db,snapshot,null,'owner');assert.equal(sql.prepare('SELECT count(*) n FROM review_sales_snapshots').get().n,1);
  const second=await saveSalesSnapshot(db,{...snapshot,records:[{...item,stockStatus:'positive'}]},first.hash,'owner');
  await assert.rejects(saveSalesSnapshot(db,{...snapshot,records:[]},first.hash,'owner'),/changed in another tab/);
  assert.equal(sql.prepare('SELECT count(*) n FROM review_sales_snapshots').get().n,2);assert.notEqual(first.hash,second.hash);
  assert.deepEqual(sql.prepare('SELECT * FROM review_decisions').all(),before);assert.deepEqual(sql.prepare('SELECT * FROM review_state').all(),stateBefore);sql.close();
});
