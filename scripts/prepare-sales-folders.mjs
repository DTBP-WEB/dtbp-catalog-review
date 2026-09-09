// Build ignored private reports from already-collected, GET-only inFlow evidence.
// No network calls and no catalog/decision changes.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {validateSalesSnapshot} from '../lib/sales-snapshot.mjs';
import {classifySalesItem,salesRows,folderLabels,stockLabel,dateOnly} from '../public/sales-folders.js';
const [sourceArg,outputArg]=process.argv.slice(2);if(!sourceArg||!outputArg)throw Error('Usage: prepare-sales-folders.mjs <private-source-directory> <private-output-directory>');
const source=resolve(sourceArg),output=resolve(outputArg),privateRoot=resolve('private');
if(!output.toLowerCase().startsWith(privateRoot.toLowerCase()+'\\'))throw Error('Output must stay inside the dashboard private directory');
const products=JSON.parse(await readFile(join(source,'sales-folder-products.json'),'utf8'));
const sales=JSON.parse(await readFile(join(source,'sales-folder-history-full.json'),'utf8'));
if(!products.complete||!products.readOnly||!sales.complete||!sales.readOnly)throw Error('Incomplete evidence; stop');
const byId=new Map(sales.products.map(r=>[r.productId,r.lastRecordedSaleDate])),uncertain=new Set(sales.unreliableProductIds);
const snapshot=validateSalesSnapshot({format:'dtbp-sales-folders-v1',asOf:sales.asOf,complete:true,readOnly:true,catalogCapturedAt:products.capturedAt,salesCapturedAt:sales.capturedAt,coverage:sales.coverage,dateBasis:sales.dateBasis,counts:sales.stats,records:products.products.filter(p=>p.isActive&&p.itemType==='stockedProduct').map(p=>({productId:p.productId,sku:p.sku,name:p.name,brand:p.brand,isActive:p.isActive,itemType:p.itemType,createdDate:dateOnly(String(p.createdAt||'').slice(0,10)),lastRecordedSaleDate:byId.get(p.productId)||null,historyUncertain:uncertain.has(p.productId),stockStatus:p.stockStatus}))});
await mkdir(output,{recursive:true});
const payload=JSON.stringify(snapshot);await writeFile(join(output,'sales-folders.json'),payload);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const style='body{font:16px/1.5 system-ui;color:#172a3b;margin:24px auto;padding:0 20px;max-width:1500px}a{color:#165d93}h1{font-size:28px}table{width:100%;border-collapse:collapse;font-size:14px}th,td{padding:12px;border:1px solid #d9e0e7;text-align:left;vertical-align:top}th{background:#eef3f7}small{display:block;color:#536779}nav{display:flex;gap:20px;flex-wrap:wrap}.scroll{overflow:auto}@media print{nav{display:none}body{margin:0;padding:0}table{font-size:10px}th,td{padding:5px}tr{break-inside:avoid}}';
const wrap=(title,body)=>`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>DTBP · ${esc(title)}</title><style>${style}</style><h1>${esc(title)}</h1><p>DTBP private review · As of ${esc(snapshot.asOf)} · Stock snapshot ${esc(snapshot.catalogCapturedAt)}</p>${body}</html>`;
const summary={asOf:snapshot.asOf,activeStockedProducts:snapshot.records.length,folders:{},unclassified:0,sourceSha256:{products:createHash('sha256').update(await readFile(join(source,'sales-folder-products.json'))).digest('hex'),sales:createHash('sha256').update(await readFile(join(source,'sales-folder-history-full.json'))).digest('hex')},snapshotSha256:createHash('sha256').update(payload).digest('hex'),noDecisionsChanged:true};
const paths={'6':'6-11-months','12':'12-17-months','18':'18-plus-months','check':'dates-to-verify'};
for(const view of ['6','12','18','check']){
  const rows=salesRows(snapshot,view);const folder=join(output,paths[view]);await mkdir(folder,{recursive:true});
  summary.folders[view]={count:rows.length,withLastRecordedSale:rows.filter(r=>r.lastRecordedSaleDate).length,noRecordedSaleFound:rows.filter(r=>!r.lastRecordedSaleDate).length,zeroRecordedStock:rows.filter(r=>r.stockStatus==='zero').length};
  await writeFile(join(folder,'items.json'),JSON.stringify(rows,null,2));
  const title=folderLabels[view]||'Dates to verify';
  const html=wrap(title,`<nav><a href="../index.html">All folders</a></nav><p>${rows.length} items. Current stock does not establish historical out-of-stock duration. Nothing is removed or approved by this report.</p><div class="scroll"><table><thead><tr><th>SKU / inFlow title</th><th>Recorded brand</th><th>Last recorded sale</th><th>Current recorded stock</th></tr></thead><tbody>${rows.map(r=>`<tr><td><b>${esc(r.sku||'SKU missing')}</b><br>${esc(r.name)}</td><td>${esc(r.brand||'Brand not recorded')}</td><td>${esc(r.lastRecordedSaleDate||'No recorded sale found')}<small>${esc(classifySalesItem(r,snapshot.asOf).reason)}${!r.lastRecordedSaleDate&&r.createdDate?' Record created '+esc(r.createdDate)+'.':''}</small></td><td>${esc(stockLabel(r.stockStatus))}<small>Out-of-stock duration: not verified</small></td></tr>`).join('')}</tbody></table></div><p>${esc(snapshot.coverage)}</p><p>${esc(snapshot.dateBasis)}</p>`);
  await writeFile(join(folder,'index.html'),html);
}
summary.unclassified=snapshot.records.filter(r=>classifySalesItem(r,snapshot.asOf).bucket===null).length;
await writeFile(join(output,'summary.json'),JSON.stringify(summary,null,2));
await writeFile(join(output,'index.html'),wrap('Slow-selling item review',`<p>Choose a folder. Each item appears in only one age group. Use your browser’s Print command to bring a list to your bosses.</p><nav>${['6','12','18'].map(k=>`<a href="${paths[k]}/index.html">${folderLabels[k]} — ${summary.folders[k].count} items</a>`).join('')}</nav><p><a href="dates-to-verify/index.html">Dates to verify — ${summary.folders.check.count}</a></p><p>No sale found means no qualifying sale in the available active-order history. Those rows use the product record’s age, not an invented sale date. More recent products are excluded.</p><p>Current recorded stock is not a physical count or proof of how long stock was unavailable. Prices, quantities, customer details and website decisions are not included.</p><p>${esc(snapshot.coverage)}</p><p>${esc(snapshot.dateBasis)}</p>`));
console.log(JSON.stringify({...summary,payloadBytes:Buffer.byteLength(payload)},null,2));
