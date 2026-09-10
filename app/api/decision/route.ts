import { owner, db, json, failure, setting } from '../../../lib/review-server';
import { requireSameOrigin, readBoundedJson, saveDecision, ReviewError } from '../../../lib/review-core.mjs';
import {readActiveReview,isActivePosition} from '../../../lib/active-review.mjs';
export async function POST(request:Request){try{
  requireSameOrigin(request);const {user,state}=await owner();const input=await readBoundedJson(request,24000);
  if(!state?.ready)throw new ReviewError('Your review is not ready yet.',503);
  const status=readActiveReview(setting('REVIEW_ACTIVE_STATUS'),JSON.parse(String(state.metadata)));
  const row=await db().prepare('SELECT position,payload FROM review_items WHERE id=?').bind(String(input.id)).first();
  if(!row || !isActivePosition(status,row.position))throw new ReviewError('This item is not verified active. It is hidden from review; your earlier choices are preserved. Reload the list.',409);
  return json(await saveDecision(db(),input,row?JSON.parse(String(row.payload)):null,user));
}catch(error){return failure(error);}}
