import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readActiveReview,isActivePosition,activeReviewRows} from '../lib/active-review.mjs';
const metadata={remoteItemsFingerprint:'a'.repeat(64),expectedCount:3};
const value={format:'dtbp-active-review-v1',datasetHash:metadata.remoteItemsFingerprint,count:3,bits:'100',capturedAt:'2026-09-10T17:00:00.000Z'};
test('only verified active positions survive; inputs and decisions stay intact',()=>{
 const status=readActiveReview(JSON.stringify(value),metadata),rows=[0,1,2].map(position=>({position,payload:JSON.stringify({id:position})}));
 const before=JSON.stringify(rows);assert.deepEqual(activeReviewRows(rows,status),[rows[0]]);assert.equal(JSON.stringify(rows),before);
 for(const position of [-1,1,2,3,null,undefined,'0',0.5])assert.equal(isActivePosition(status,position),false);
 assert.equal(isActivePosition(status,0),true);
});
test('missing, malformed, wrong dataset and incomplete status fail closed',()=>{
 for(const raw of ['', '{}',JSON.stringify({...value,bits:'1'}),JSON.stringify({...value,bits:'1x0'}),JSON.stringify({...value,datasetHash:'b'.repeat(64)}),JSON.stringify({...value,count:4}),JSON.stringify({...value,capturedAt:'bad'})])assert.throws(()=>readActiveReview(raw,metadata));
 const status=readActiveReview(JSON.stringify(value),metadata);assert.throws(()=>activeReviewRows([],status));assert.throws(()=>activeReviewRows([{position:0},{position:2},{position:1}],status));
});
test('server gates reads and stale saves but never filters the historical export',()=>{
 const source=p=>readFileSync(new URL(p,import.meta.url),'utf8');
 assert.match(source('../app/api/review/route.ts'),/activeReviewRows\(items.results,status\)/);
 assert.match(source('../app/api/decision/route.ts'),/!isActivePosition\(status,row.position\)/);
 assert.doesNotMatch(source('../app/api/export/route.ts'),/activeReview|REVIEW_ACTIVE_STATUS/);
 assert.doesNotMatch(source('../lib/active-review.mjs'),/UPDATE |DELETE |INSERT /);
});
