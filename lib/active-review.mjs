import {ReviewError} from './review-core.mjs';

// Private deployment setting, bound to the immutable sealed import's order/hash.
// No product identities, decisions or source records are changed by this view.
export function readActiveReview(raw, metadata) {
  let status; try { status=JSON.parse(raw); } catch { /* fail closed */ }
  if(status?.format!=='dtbp-active-review-v1' ||
    status.datasetHash!==metadata.remoteItemsFingerprint ||
    status.count!==metadata.expectedCount || !Number.isSafeInteger(status.count) || status.count<1 || status.count>10000 ||
    typeof status.bits!=='string' || status.bits.length!==status.count || !/^[01]+$/.test(status.bits) ||
    typeof status.capturedAt!=='string' || !Number.isFinite(Date.parse(status.capturedAt))) {
    throw new ReviewError('The active-item check is unavailable. Your saved choices are safe; please try again later.',503);
  }
  return status;
}

export function isActivePosition(status, position) {
  return Number.isSafeInteger(position) && position>=0 && position<status.count && status.bits[position]==='1';
}

export function activeReviewRows(rows, status) {
  if(rows.length!==status.count || rows.some((row,index)=>row.position!==index))
    throw new ReviewError('The catalog snapshot changed. Refresh its active-item check before continuing.',503);
  return rows.filter(row=>isActivePosition(status,row.position));
}
