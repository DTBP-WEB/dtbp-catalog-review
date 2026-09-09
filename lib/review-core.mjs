// Isolated review records only. There is intentionally no storefront/inFlow transport.
export class ReviewError extends Error { constructor(message, status=400) { super(message); this.status=status; } }
const text = (v) => String(v ?? '');
export function validIdentity(fields) {
  return fields.sku && fields.name && !/^(?:unknown|n\/?a|none|unbranded|generic|other|-|aftermarket|online|usa|am|ctbp|dtbo|leaf springs\s*[-–—]\s*oe)?$/i.test(fields.brand)
    && !/[\x00-\x1f\\<>]/.test(fields.sku) && !fields.sku.split('/').some(p => !p.trim() || /^\.{1,2}$/.test(p.trim()))
    && !/\$|\b(?:core charge|cost price|our cost|do not (?:sell|use)|discontinued|this comes in packs|warranty only|restocking fee)\b/i.test(fields.name)
    && !/^\d*\s*(?:year\s*)?warranty$/i.test(fields.name);
}
export function validateDecision(input, item, userId) {
  if (!item || !['held','outside'].includes(item.group) || input.fingerprint !== item.fingerprint) throw new ReviewError('This item changed. Reload and review it again.',409);
  if (!['ok','no','fix','pending'].includes(input.decision)) throw new ReviewError('Choose OK, No, Needs changes or Save for later.');
  const fields = Object.fromEntries(['sku','name','brand'].map(k=>[k,text(input.fields?.[k]).trim()]));
  if (fields.sku.length>80 || fields.name.length>600 || fields.brand.length>120 || Object.values(fields).some(v=>/[\x00-\x1f<>]/.test(v))) throw new ReviewError('Keep values within the displayed limits; do not use HTML.');
  const note=text(input.note).trim();
  if(note.length>3000) throw new ReviewError('Keep Notes to 3,000 characters.');
  if(input.decision==='fix' && !note) throw new ReviewError('Tell me what needs fixing in Notes.');
  if(input.decision==='ok' && !validIdentity(fields)) throw new ReviewError('Before OK, enter a clear SKU, manufacturer and title without prices or internal instructions.');
  if(!Number.isSafeInteger(input.revision)||input.revision<0) throw new ReviewError('Reload before saving.');
  if(!/^[0-9a-f-]{36}$/i.test(input.requestId||'')) throw new ReviewError('Reload before saving.');
  return {id:item.id,decision:input.decision,fields,note,fingerprint:item.fingerprint,websiteProductId:item.websiteProductId,inflowProductId:item.inflowProductId,before:item.website,source:item.source,issuesReviewed:item.issues.map(i=>i.code),scope:'Owner decision only; no automatic catalog write, activation, image/technical/SEO approval or deployment.',savedAt:new Date().toISOString(),reviewerId:userId};
}
export function requireSameOrigin(request) {
  if(request.headers.get('origin')!==new URL(request.url).origin || request.headers.get('sec-fetch-site')==='cross-site' || request.headers.get('content-type')!=='application/json') throw new ReviewError('Open this dashboard directly and reload before saving.',403);
}
export async function readBoundedJson(request,maxBytes) {
  if(Number(request.headers.get('content-length'))>maxBytes) throw new ReviewError('Request is too large.',413);
  const reader=request.body?.getReader(); if(!reader) throw new ReviewError('Missing request body.');
  const chunks=[];let size=0;
  for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel();throw new ReviewError('Request is too large.',413);}chunks.push(value);}
  const bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length;}
  try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw new ReviewError('Invalid review request.');}
}
export function canReview(user, ownerEmail, state) {
  if(!user?.userId || !ownerEmail || user.email?.toLowerCase()!==ownerEmail.toLowerCase()) return false;
  return !state?.owner_id || state.owner_id===user.userId;
}
export async function saveDecision(db, input, item, user) {
  const decision=validateDecision(input,item,user.userId);
  const prior=await db.prepare('SELECT payload FROM review_history WHERE request_id=?').bind(input.requestId).first();
  if(prior){const p=JSON.parse(prior.payload);if(p.after.id!==decision.id||p.after.decision!==decision.decision||JSON.stringify(p.after.fields)!==JSON.stringify(decision.fields)||p.after.note!==decision.note)throw new ReviewError('This save identifier was already used.',409);return {revision:p.revision,decision:p.after};}
  const old=await db.prepare('SELECT payload FROM review_decisions WHERE id=?').bind(item.id).first();
  const event={at:decision.savedAt,id:item.id,revision:input.revision+1,requestId:input.requestId,before:old?JSON.parse(old.payload):null,after:decision};
  // D1 batch is transactional. Each later write requires the event inserted by
  // the compare-and-swap SELECT; a stale tab cannot overwrite another save.
  await db.batch([
    db.prepare('INSERT INTO review_history (revision,request_id,item_id,payload) SELECT revision+1,?,?,? FROM review_state WHERE id=1 AND ready=1 AND revision=? AND (owner_id IS NULL OR owner_id=?)').bind(input.requestId,item.id,JSON.stringify(event),input.revision,user.userId),
    db.prepare('INSERT INTO review_decisions (id,payload) SELECT ?,? WHERE EXISTS (SELECT 1 FROM review_history WHERE request_id=?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').bind(item.id,JSON.stringify(decision),input.requestId),
    db.prepare('UPDATE review_state SET revision=revision+1,owner_id=COALESCE(owner_id,?) WHERE id=1 AND revision=? AND EXISTS (SELECT 1 FROM review_history WHERE request_id=?)').bind(user.userId,input.revision,input.requestId),
  ]);
  const saved=await db.prepare('SELECT payload FROM review_history WHERE request_id=?').bind(input.requestId).first();
  if(!saved)throw new ReviewError('Another tab saved a change. Your edits are still here; copy them before reloading.',409);
  return {revision:input.revision+1,decision};
}
