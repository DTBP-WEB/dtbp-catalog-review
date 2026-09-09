import {owner,db,json,failure} from '../../../lib/review-server';
import {requireSameOrigin,readBoundedJson,ReviewError} from '../../../lib/review-core.mjs';
import {saveSalesSnapshot} from '../../../lib/sales-snapshot.mjs';
export const dynamic='force-dynamic';
export async function GET(){try{
  const {state}=await owner();if(!state?.ready)throw new ReviewError('Your review is not ready yet.',503);
  const row=await db().prepare('SELECT hash,payload FROM review_sales_snapshots ORDER BY id DESC LIMIT 1').first<{hash:string,payload:string}>();
  return json({hash:row?.hash||null,snapshot:row?JSON.parse(row.payload):null});
}catch(error){return failure(error);}}
export async function POST(request:Request){try{
  requireSameOrigin(request);const {user,state}=await owner();if(!state?.ready)throw new ReviewError('Your review is not ready yet.',503);
  const body=await readBoundedJson(request,2000000);
  return json(await saveSalesSnapshot(db(),body.snapshot,body.expectedHash,user.userId));
}catch(error){return failure(error);}}
