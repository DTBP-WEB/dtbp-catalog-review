import test from 'node:test';
import assert from 'node:assert/strict';
import {decisionStatus,filterReviewItems,nextReviewSelection,reviewView,reviewPath} from '../public/review-queue.js';

const item=(id,group='held',extra={})=>({id,group,fingerprint:'current',compatibleFingerprints:['compatible'],sku:id,name:'Test part',brand:'Example',issues:[],...extra});
const choice=(decision='pending',extra={})=>({decision,fingerprint:'current',fields:{sku:'EDITED',name:'Edited title',brand:'Confirmed brand'},note:'Keep this note',...extra});
const ids=rows=>rows.map(row=>row.id);

test('existing Save for later records are separate from untouched and stale records',()=>{
  const row=item('a');
  assert.equal(decisionStatus(row), 'pending');
  assert.equal(decisionStatus(row,choice()), 'later');
  assert.equal(decisionStatus(row,choice('pending',{fingerprint:'compatible'})), 'later');
  for(const decision of ['pending','ok','no','fix']) {
    assert.equal(decisionStatus(row,choice(decision,{fingerprint:'stale'})), 'pending');
  }
  for(const decision of ['ok','no','fix']) assert.equal(decisionStatus(row,choice(decision)),decision);
  assert.equal(decisionStatus(item('a','completed',{applied:{title:'Done'}}),choice()), 'applied');
});

test('main queues always exclude deferred records, even when including saved decisions',()=>{
  const items=[item('new'),item('deferred'),item('approved'),item('stale'),item('other','outside'),item('other-new','outside')];
  const decisions={deferred:choice(),approved:choice('ok'),stale:choice('pending',{fingerprint:'old'}),other:choice()};
  assert.deepEqual(ids(filterReviewItems(items,decisions)),['new','stale']);
  assert.deepEqual(ids(filterReviewItems(items,decisions,{filter:'all'})),['new','approved','stale']);
  assert.deepEqual(ids(filterReviewItems(items,decisions,{group:'outside',filter:'all'})),['other-new']);
  assert.deepEqual(ids(filterReviewItems(items,decisions,{group:'later'})),['deferred','other']);
  assert.deepEqual(ids(filterReviewItems(items,decisions,{group:'later',query:'keep this note',brand:'Example'})),['deferred','other']);
  assert.deepEqual(filterReviewItems(items,decisions,{group:'later',brand:'Missing'}),[]);
});

test('changing views never rewrites saved values, notes, revisions or fingerprints',()=>{
  const items=[item('a'),item('b','outside')];
  const decisions={a:choice('pending',{savedAt:'2026-09-09',revision:12}),b:choice('ok')};
  const before=JSON.stringify({items,decisions});
  for(const group of ['held','outside','later'])for(const filter of ['pending','all','ok','no','fix'])filterReviewItems(items,decisions,{group,filter});
  assert.equal(JSON.stringify({items,decisions}),before);
});

test('successful deferral advances and completion leaves the later queue',()=>{
  const items=[item('a'),item('b'),item('c')],decisions={};
  const before=filterReviewItems(items,decisions);
  decisions.b=choice();
  let after=filterReviewItems(items,decisions);
  assert.equal(nextReviewSelection(before,after,'b',decisions,'held'),'c');
  decisions.c=choice();after=filterReviewItems(items,decisions);
  assert.equal(nextReviewSelection(before,after,'c',decisions,'held'),'a');
  decisions.a=choice();after=filterReviewItems(items,decisions);
  assert.equal(nextReviewSelection(before,after,'a',decisions,'held'),null);
  const later=filterReviewItems(items,decisions,{group:'later'});
  decisions.b=choice('ok');
  after=filterReviewItems(items,decisions,{group:'later'});
  assert.deepEqual(ids(after),['a','c']);
  assert.equal(nextReviewSelection(later,after,'b',decisions,'later'),'c');
});

test('bookmark and sign-in return paths are limited to the review pages',()=>{
  for(const [search,view,path] of [['?view=later','later','/review?view=later'],['?view=outside','outside','/review?view=outside'],['','held','/review'],['?view=https://evil.invalid','held','/review']]){
    assert.equal(reviewView(search),view);assert.equal(reviewPath(view),path);
  }
});
