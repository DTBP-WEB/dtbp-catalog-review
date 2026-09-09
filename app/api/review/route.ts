import { owner, db, json, failure } from '../../../lib/review-server';
export const dynamic='force-dynamic';
export async function GET(){try{
  const {state}=await owner();if(!state?.ready)return json({error:'Your remaining items are being prepared. Please try again shortly.'},503);
  const [items,decisions]=await db().batch<{id:string,payload:string}>([db().prepare('SELECT payload FROM review_items ORDER BY position'),db().prepare('SELECT id,payload FROM review_decisions')]);
  return json({...JSON.parse(String(state.metadata)),application:'dtbp-remote-owner-review-v1',revision:state.revision,items:items.results.map(r=>JSON.parse(String(r.payload))),decisions:Object.fromEntries(decisions.results.map(r=>[r.id,JSON.parse(String(r.payload))]))});
}catch(error){return failure(error);}}
