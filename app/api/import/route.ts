import { timingSafeEqual } from 'node:crypto';
import { db,setting,json,failure } from '../../../lib/review-server';
import { readBoundedJson,ReviewError } from '../../../lib/review-core.mjs';
export async function POST(request:Request){try{
  const expected=setting('REVIEW_IMPORT_KEY'),given=request.headers.get('authorization')?.replace(/^Bearer /,'')||'';
  if(!expected||expected.length<48||given.length!==expected.length||!timingSafeEqual(Buffer.from(given),Buffer.from(expected)))return json({error:'Not authorized.'},401);
  const input=await readBoundedJson(request,900000);
  const state=await db().prepare('SELECT * FROM review_state WHERE id=1').first();
  if(state?.ready)throw new ReviewError('The initial import is sealed. Existing review data cannot be replaced.',409);
  if(input.action==='begin'){
    if(!/^[a-f0-9]{64}$/.test(input.metadata?.datasetFingerprint||'')||!Number.isSafeInteger(input.metadata?.expectedCount)||input.metadata.expectedCount<1||input.metadata.expectedCount>5000)throw new ReviewError('Invalid import manifest.');
    if(state && state.metadata!==JSON.stringify(input.metadata))throw new ReviewError('A different import is already staged.',409);
    await db().prepare('INSERT OR IGNORE INTO review_state (id,revision,ready,metadata) VALUES (1,0,0,?)').bind(JSON.stringify(input.metadata)).run();
    return json({staged:true});
  }
  if(!state)throw new ReviewError('Begin the import first.',409);
  if(input.datasetFingerprint!==JSON.parse(String(state.metadata)).datasetFingerprint)throw new ReviewError('The import fingerprint differs.',409);
  if(input.action==='items'){
    if(!Array.isArray(input.items)||!input.items.length||input.items.length>40)throw new ReviewError('Use a bounded import batch.');
    const statements=[];
    for(const entry of input.items){
      const item=entry.item;
      if(!item||!['held','outside'].includes(item.group)||!/^\w+:[0-9a-f-]{36}$/i.test(item.id||'')||!/^[a-f0-9]{64}$/.test(item.fingerprint||'')||item.applied||!Number.isSafeInteger(entry.position)||entry.position<0)throw new ReviewError('Invalid review record.');
      const previous=await db().prepare('SELECT payload FROM review_items WHERE id=?').bind(item.id).first();
      if(previous&&previous.payload!==JSON.stringify(item))throw new ReviewError('Existing staged item differs; no overwrite was made.',409);
      statements.push(db().prepare('INSERT OR IGNORE INTO review_items (id,fingerprint,review_group,position,payload) VALUES (?,?,?,?,?)').bind(item.id,item.fingerprint,item.group,entry.position,JSON.stringify(item)));
      if(entry.decision){if(entry.decision.id!==item.id)throw new ReviewError('Decision identity differs.');statements.push(db().prepare('INSERT OR IGNORE INTO review_decisions (id,payload) VALUES (?,?)').bind(item.id,JSON.stringify(entry.decision)));}
    }
    await db().batch(statements);return json({staged:input.items.length});
  }
  if(input.action==='finish'){
    const result=await db().prepare('SELECT COUNT(*) AS count,COUNT(DISTINCT position) AS positions FROM review_items').first();
    const metadata=JSON.parse(String(state.metadata));
    if(!result||result.count!==metadata.expectedCount||result.positions!==metadata.expectedCount)throw new ReviewError('Import is incomplete.',409);
    const rows=await db().prepare('SELECT payload FROM review_items ORDER BY position').all();
    const serialized=JSON.stringify(rows.results.map(r=>JSON.parse(String(r.payload))));
    const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(serialized)))).map(n=>n.toString(16).padStart(2,'0')).join('');
    if(digest!==metadata.remoteItemsFingerprint)throw new ReviewError('Imported content does not match the checked snapshot.',409);
    await db().prepare('UPDATE review_state SET ready=1 WHERE id=1 AND ready=0').run();return json({ready:true,count:result.count,hash:digest});
  }
  throw new ReviewError('Unknown import action.');
}catch(error){return failure(error);}}
