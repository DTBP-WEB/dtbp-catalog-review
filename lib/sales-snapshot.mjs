import {ReviewError} from './review-core.mjs';
import {dateOnly} from '../public/sales-folders.js';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const text=(value,max)=>{if(typeof value!=='string'||value.length>max||/[\x00-\x1f<>]/.test(value))throw new ReviewError('Invalid report text.');return value;};
export function validateSalesSnapshot(input) {
  if(input?.format!=='dtbp-sales-folders-v1'||!dateOnly(input.asOf)||input.complete!==true||input.readOnly!==true)throw new ReviewError('Choose a complete DTBP sales-folder report.');
  if(!Array.isArray(input.records)||input.records.length>6000)throw new ReviewError('Invalid report size.');
  const seen=new Set();
  const records=input.records.map(row=>{
    if(!uuid.test(row.productId)||seen.has(row.productId))throw new ReviewError('Missing or repeated inFlow product identity.');seen.add(row.productId);
    if(typeof row.isActive!=='boolean'||typeof row.historyUncertain!=='boolean'||!['stockedProduct','service'].includes(row.itemType)||!['positive','zero','negative','unknown'].includes(row.stockStatus))throw new ReviewError('Invalid product evidence.');
    for(const key of ['lastRecordedSaleDate','createdDate'])if(row[key]!==null&&!dateOnly(row[key]))throw new ReviewError('Invalid report date.');
    if(row.lastRecordedSaleDate&&row.lastRecordedSaleDate>input.asOf)throw new ReviewError('A sale date is later than the report.');
    // Explicit projection: no prices, quantities, private order/customer details,
    // approval fields or arbitrary extra uploaded properties enter storage.
    return {productId:row.productId,sku:text(row.sku,160),name:text(row.name,1000),brand:text(row.brand,200),isActive:row.isActive,itemType:row.itemType,createdDate:row.createdDate,lastRecordedSaleDate:row.lastRecordedSaleDate,historyUncertain:row.historyUncertain,stockStatus:row.stockStatus};
  });
  for(const key of ['catalogCapturedAt','salesCapturedAt'])if(typeof input[key]!=='string'||!Number.isFinite(Date.parse(input[key])))throw new ReviewError('Missing capture time.');
  const counts={};for(const key of ['ordersScanned','qualifyingOrders']){const n=input.counts?.[key];if(!Number.isSafeInteger(n)||n<0)throw new ReviewError('Invalid history counts.');counts[key]=n;}
  return {format:input.format,asOf:input.asOf,complete:true,readOnly:true,catalogCapturedAt:input.catalogCapturedAt,salesCapturedAt:input.salesCapturedAt,coverage:text(input.coverage,1000),dateBasis:text(input.dateBasis,1500),counts,records};
}
export async function saveSalesSnapshot(db,input,expectedHash,userId) {
  if(expectedHash!==null&&!/^[a-f0-9]{64}$/.test(expectedHash||''))throw new ReviewError('Reload the report before importing.',409);
  const snapshot=validateSalesSnapshot(input),payload=JSON.stringify(snapshot);
  if(new TextEncoder().encode(payload).length>1800000)throw new ReviewError('Report exceeds the private storage limit.',413);
  const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(payload)))].map(x=>x.toString(16).padStart(2,'0')).join('');
  const latest=await db.prepare('SELECT hash FROM review_sales_snapshots ORDER BY id DESC LIMIT 1').first();
  if(latest?.hash===hash)return {hash,snapshot};
  // Append-only evidence history, independent of review_state/items/decisions.
  // The compare-and-swap prevents an older tab from replacing a newer snapshot.
  await db.prepare('INSERT INTO review_sales_snapshots (hash,payload,imported_at,imported_by) SELECT ?,?,?,? WHERE COALESCE((SELECT hash FROM review_sales_snapshots ORDER BY id DESC LIMIT 1),\'\')=?').bind(hash,payload,new Date().toISOString(),userId,expectedHash||'').run();
  const current=await db.prepare('SELECT hash FROM review_sales_snapshots ORDER BY id DESC LIMIT 1').first();
  if(current?.hash!==hash)throw new ReviewError('The report changed in another tab. Reload before importing.',409);
  return {hash,snapshot};
}
