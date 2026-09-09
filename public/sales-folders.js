// Shared calendar rules. This public module contains no business data.
export const folderLabels = { '6': '6–11 months', '12': '12–17 months', '18': '18+ months' };
export function dateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10) === value ? value : null;
}
export function monthsBefore(asOf, months) {
  if (!dateOnly(asOf)) throw Error('Invalid report date');
  const [year, month, day] = asOf.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1 - months, 1));
  const lastDay = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth()+1, 0)).getUTCDate();
  start.setUTCDate(Math.min(day,lastDay));
  return start.toISOString().slice(0,10);
}
export function classifySalesItem(item, asOf) {
  if (!item.isActive || item.itemType !== 'stockedProduct') return {bucket:null, reason:'Not an active stocked product'};
  if (item.historyUncertain) return {bucket:'check', reason:'A qualifying order has a missing or future date. Check the history before using an age.'};
  const sale = dateOnly(item.lastRecordedSaleDate);
  const created = dateOnly(item.createdDate);
  if (sale && sale > asOf) return {bucket:'check',reason:'The recorded sale date is after this report.'};
  // Creation is only a minimum record-age check for products with NO recorded sale.
  // It is never substituted into the displayed Last recorded sale field.
  const reference = sale || created;
  if (!reference || reference > asOf) return {bucket:'check', reason:'No usable sale date or product creation date was found.'};
  const bucket = ['18','12','6'].find(months => reference <= monthsBefore(asOf,Number(months))) || null;
  return {bucket, reason:sale ? 'Age since last recorded sales activity' : 'No recorded sale found; folder uses the age of the inFlow product record, not an assumed sale date.'};
}
export function salesView(search) {
  const view = new URLSearchParams(search).get('view');
  return ['6','12','18','check'].includes(view) ? view : '6';
}
export function stockLabel(status) {
  return {positive:'Stock recorded',zero:'Zero recorded stock',negative:'Negative stock — check count',unknown:'Stock not verified'}[status] || 'Stock not verified';
}
export function salesRows(snapshot, view, query='', stock='') {
  const search=query.trim().toLowerCase();
  return snapshot.records.filter(row=>classifySalesItem(row,snapshot.asOf).bucket===view &&
    (!stock||row.stockStatus===stock) && (!search||[row.sku,row.name,row.brand].join(' ').toLowerCase().includes(search)))
    .sort((a,b)=>(a.lastRecordedSaleDate||'0000').localeCompare(b.lastRecordedSaleDate||'0000')||a.sku.localeCompare(b.sku)||a.productId.localeCompare(b.productId));
}
