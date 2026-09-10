import { owner, db, json, failure, setting } from '../../../lib/review-server';
import {readActiveReview,activeReviewRows} from '../../../lib/active-review.mjs';
export const dynamic='force-dynamic';
export async function GET(){try{
  const {state}=await owner();if(!state?.ready)return json({error:'Your remaining items are being prepared. Please try again shortly.'},503);
  const metadata=JSON.parse(String(state.metadata));
  const status=readActiveReview(setting('REVIEW_ACTIVE_STATUS'),metadata);
  const [items,decisions]=await db().batch<{id:string,payload:string,position:number}>([db().prepare('SELECT position,payload FROM review_items ORDER BY position'),db().prepare('SELECT id,payload FROM review_decisions')]);
  const visible=activeReviewRows(items.results,status).map((r:{payload:string})=>JSON.parse(String(r.payload)));
  return json({...metadata,application:'dtbp-remote-owner-review-v1',revision:state.revision,items:visible,counts:Object.fromEntries(['held','outside'].map(group=>[group,visible.filter((item:{group:string})=>item.group===group).length])),activeOnly:{checkedAt:status.capturedAt,visible:visible.length,hidden:status.count-visible.length},decisions:Object.fromEntries(decisions.results.map(r=>[r.id,JSON.parse(String(r.payload))]))});
}catch(error){return failure(error);}}
