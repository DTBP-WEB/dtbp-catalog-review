// A view over saved decisions, not a new storage format or a data migration.
export function matches(item, decision) {
  return Boolean(decision && (decision.fingerprint === item.fingerprint ||
    item.compatibleFingerprints?.includes(decision.fingerprint)));
}

export function decisionStatus(item, decision) {
  if (item.applied) return 'applied';
  if (!matches(item, decision)) return 'pending';
  // Existing Save for later records already use "pending" in durable storage.
  return decision.decision === 'pending' ? 'later' : decision.decision;
}

export function reviewView(search) {
  const view = new URLSearchParams(search).get('view');
  return ['later', 'outside'].includes(view) ? view : 'held';
}

export function reviewPath(view) {
  return view === 'later' ? '/review?view=later' :
    view === 'outside' ? '/review?view=outside' : '/review';
}

export function filterReviewItems(items, decisions, {group = 'held', filter = 'pending', brand = '', query = ''} = {}) {
  const q = query.trim().toLowerCase();
  return items.filter(item => {
    if (!['held', 'outside'].includes(item.group)) return false;
    const status = decisionStatus(item, decisions[item.id]);
    if (group === 'later') {
      if (status !== 'later') return false;
    } else if (item.group !== group || status === 'later' || (filter !== 'all' && status !== filter)) {
      return false;
    }
    return (!brand || item.brand === brand) && (!q ||
      [item.sku, item.name, item.brand, item.source?.name,
        ...(item.issues || []).map(issue => issue.issue), decisions[item.id]?.note]
        .join(' ').toLowerCase().includes(q));
  });
}

export function nextReviewSelection(before, after, currentId, decisions, group) {
  const at = before.findIndex(item => item.id === currentId);
  const visible = new Set(after.map(item => item.id));
  const preferred = group === 'later' ? 'later' : 'pending';
  const next = [...before.slice(at + 1), ...before.slice(0, at)].find(item =>
    item.id !== currentId && visible.has(item.id) &&
    decisionStatus(item, decisions[item.id]) === preferred);
  return next?.id || after[0]?.id || null;
}
