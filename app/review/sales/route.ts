import {owner,responseHeaders} from '../../../lib/review-server';
import {ReviewError} from '../../../lib/review-core.mjs';
import {salesHtml} from '../../../lib/sales-html';
import {salesView} from '../../../public/sales-folders.js';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{
  await owner();return new Response(salesHtml,{headers:{...responseHeaders,'Content-Type':'text/html; charset=utf-8'}});
}catch(error){
  if(error instanceof ReviewError&&error.status===401)return Response.redirect(new URL('/signin-with-chatgpt?return_to='+encodeURIComponent('/review/sales?view='+salesView(new URL(request.url).search)),request.url),303);
  return new Response('This private report is unavailable. Sign in with the owner account or try again shortly.',{status:error instanceof ReviewError?error.status:503,headers:responseHeaders});
}}
