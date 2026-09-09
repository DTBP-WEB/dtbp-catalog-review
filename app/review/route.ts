import { owner,responseHeaders } from '../../lib/review-server';
import { ReviewError } from '../../lib/review-core.mjs';
import { dashboardHtml } from '../../lib/dashboard-html';
import { reviewView,reviewPath } from '../../public/review-queue.js';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{
  await owner();return new Response(dashboardHtml,{headers:{...responseHeaders,'Content-Type':'text/html; charset=utf-8'}});
}catch(error){
  if(error instanceof ReviewError&&error.status===401){
    const returnTo=reviewPath(reviewView(new URL(request.url).search));
    return Response.redirect(new URL('/signin-with-chatgpt?return_to='+encodeURIComponent(returnTo),request.url),303);
  }
  const message=error instanceof ReviewError?error.message:'The review is temporarily unavailable. Try again shortly.';
  return new Response('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DTBP review access</title><body style="font:16px/1.6 system-ui;max-width:540px;padding:28px;margin:8vh auto"><h1>DTBP Catalog Review</h1><p>'+message+'</p><p><a href="/signout-with-chatgpt?return_to=%2F">Sign out and use the owner account</a></p><a href="/review">Try again</a></body></html>',{status:error instanceof ReviewError?error.status:503,headers:{...responseHeaders,'Content-Type':'text/html; charset=utf-8'}});
}}
