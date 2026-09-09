import { owner, db, json, failure } from '../../../lib/review-server';
export const dynamic='force-dynamic';
export async function GET(){try{
  const {state}=await owner();if(!state?.ready)return json({error:'The review is not ready yet.'},503);
  const [decisions,history]=await db().batch<{id:string,payload:string}>([db().prepare('SELECT id,payload FROM review_decisions'),db().prepare('SELECT payload FROM review_history ORDER BY revision')]);
  return json({...JSON.parse(String(state.metadata)),version:1,exportedAt:new Date().toISOString(),revision:state.revision,decisions:Object.fromEntries(decisions.results.map(r=>[r.id,JSON.parse(String(r.payload))])),history:history.results.map(r=>JSON.parse(String(r.payload))),applied:false},200,{'Content-Disposition':'attachment; filename="DTBP-online-review-decisions.json"'});
}catch(error){return failure(error);}}
