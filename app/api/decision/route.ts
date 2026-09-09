import { owner, db, json, failure } from '../../../lib/review-server';
import { requireSameOrigin, readBoundedJson, saveDecision } from '../../../lib/review-core.mjs';
export async function POST(request:Request){try{
  requireSameOrigin(request);const {user}=await owner();const input=await readBoundedJson(request,24000);
  const row=await db().prepare('SELECT payload FROM review_items WHERE id=?').bind(String(input.id)).first();
  return json(await saveDecision(db(),input,row?JSON.parse(String(row.payload)):null,user));
}catch(error){return failure(error);}}
