import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../app/chatgpt-auth';
import { canReview, ReviewError } from './review-core.mjs';
export function db() { if(!env.DB) throw new ReviewError('Online saving is temporarily unavailable. Your choices are preserved.',503);return env.DB; }
export function setting(key:string) { return (env as unknown as Record<string,string|undefined>)[key] || ''; }
export async function owner() {
  const user=await getChatGPTUser();
  if(!user) throw new ReviewError('Sign in with your ChatGPT account to continue.',401);
  const state=await db().prepare('SELECT * FROM review_state WHERE id=1').first();
  if(!canReview(user,setting('REVIEW_OWNER_EMAIL'),state)) throw new ReviewError('This review belongs to a different account. Sign in with the owner account.',403);
  return {user,state};
}
export const responseHeaders={ 'Cache-Control':'private, no-store', 'X-Robots-Tag':'noindex, nofollow, noarchive, noimageindex', 'X-Content-Type-Options':'nosniff', 'Referrer-Policy':'no-referrer', 'X-Frame-Options':'DENY', 'Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'" };
export function json(body:unknown,status=200,headers:Record<string,string>={}){return Response.json(body,{status,headers:{...responseHeaders,...headers}});}
export function failure(error:unknown) {if(error instanceof ReviewError)return json({error:error.message},error.status);console.error('Review storage unavailable');return json({error:'Online review is temporarily unavailable. Your edits have not been discarded. Retry shortly.'},503);}
