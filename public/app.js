/* Standalone authenticated review. Durable online saves; no storefront writes. */
import {matches,decisionStatus,reviewView,reviewPath,filterReviewItems,nextReviewSelection} from './review-queue.js?v=20260909';
const $=(id)=>document.getElementById(id);
const esc=(v)=>String(v??'').replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={pending:'Not reviewed',later:'Saved for later',ok:'OK for website',no:'No — leave off',fix:'Needs changes',applied:'Title applied'};
let data=null,group=reviewView(window.location.search),page=0,selected=null,dirty=false,busy=false;
const pageSize=25;
const mainStatusOptions=$('status').innerHTML;
function status(item){return decisionStatus(item,data.decisions[item.id]);}
function setGroup(next){
  group=next;
  $('status').innerHTML=group==='later'?'<option value="all">Saved for later</option>':mainStatusOptions;
  $('status').value=group==='later'?'all':'pending';$('status').disabled=group==='later';
  window.history.replaceState(null,'',reviewPath(group));
}
function notice(message,error=false){$('notice').textContent=message;$('notice').className='notice show'+(error?' error':'');}
function selectionAllowed(){if(busy)return false;if(!dirty)return true;notice('You have unsaved edits. Choose a decision or Save for later before moving to another item.',true);return false;}
function renderGroups(){
  $('page-title').textContent=group==='later'?'Saved for later':'Items to check';
  $('page-subtitle').textContent=group==='later'?'Your saved items, edits and notes are kept here until you are ready. Nothing publishes from here.':'Review the issue, choose OK or tell me what to fix. Save for later moves an item to its own page.';
  document.title=group==='later'?'DTBP · Saved for later':'DTBP · Catalog review';
  if(data.activeOnly) $('page-subtitle').textContent+=' Only verified-active items are shown (checked '+data.activeOnly.checkedAt.slice(0,10)+'). Hidden items and saved history are preserved.';
  $('groups').innerHTML=Object.entries({held:'Website items to check',outside:'Other items not on website',later:'Saved for later'}).map(([key,label])=>`<button class="tab ${group===key?'active':''}" data-group="${key}" aria-current="${group===key?'page':'false'}">${label} · ${filterReviewItems(data.items,data.decisions,{group:key}).length.toLocaleString()}</button>`).join('');
  $('groups').querySelectorAll('[data-group]').forEach((button)=>button.onclick=()=>{if(!selectionAllowed())return;setGroup(button.dataset.group);applyFilters();document.body.classList.remove('detail-open');});
}
function filtered(){return filterReviewItems(data.items,data.decisions,{group,filter:$('status').value,brand:$('brand').value,query:$('search').value});}
function renderList(){
  const rows=filtered(),pages=Math.max(1,Math.ceil(rows.length/pageSize));page=Math.min(page,pages-1);
  $('list-count').textContent=`${rows.length.toLocaleString()} items`;$('page-count').textContent=`${page+1} / ${pages}`;
  $('prev').disabled=page===0||busy;$('next').disabled=page+1===pages||busy;
  $('list').innerHTML=rows.slice(page*pageSize,(page+1)*pageSize).map((r)=>`<button class="item ${selected===r.id?'active':''}" data-item="${esc(r.id)}" aria-current="${selected===r.id?'true':'false'}"><div class="sku">${esc(r.sku||'SKU missing')}</div><div class="item-name">${esc(r.name||'Untitled item')}</div><div class="item-meta"><span>${esc(r.brand||'Brand missing')}</span><span class="pill ${status(r)}">${labels[status(r)]}</span></div></button>`).join('')||'<p class="empty">No items match these filters.</p>';
  $('list').querySelectorAll('[data-item]').forEach((button)=>button.onclick=()=>{if(selectionAllowed()){selected=button.dataset.item;renderList();renderDetail();document.body.classList.add('detail-open');}});
  const remaining=filterReviewItems(data.items,data.decisions,{group}).length;
  $('progress').textContent=`${remaining.toLocaleString()} ${group==='later'?'saved for later':'left to check'}`;
  renderGroups();
  return rows;
}
function snapshot(title,record,other){return `<div class="snapshot"><h3>${esc(title)}</h3>${record?['name','sku','brand'].map((k)=>`<div class="field ${other&&record[k]!==other[k]?'changed':''}"><small>${{name:'Title',sku:'SKU',brand:'Brand'}[k]}</small>${esc(record[k]||'Not recorded')}</div>`).join('')+(typeof record.isActive==='boolean'?`<p class="sub">Saved source status: <strong>${record.isActive?'Active':'Inactive'}</strong></p>`:''):'<p class="muted">No unique matching record.</p>'}</div>`;}
function renderDetail(){
  const item=data.items.find((r)=>r.id===selected);
  if(!item){$('detail').innerHTML=`<button type="button" class="back" id="back">← Back to list</button><p class="empty">${group==='later'?'No saved-for-later items match these filters. Use Save for later on an item to keep it here with your edits and notes.':'No items match these filters. Choose another queue or change your filters to continue.'}</p>`;$('back').onclick=()=>document.body.classList.remove('detail-open');return;}
  if(item.applied){
    dirty=false;$('detail').innerHTML=`<div class="detail-top"><button type="button" class="back" id="back">← List</button><span class="pill ok">Title applied · local preview</span></div><h2>${esc(item.applied.title)}</h2><p class="sku">${esc(item.sku)} · ${esc(item.brand)}</p><p>This approved title is included in the updated local website. It has been removed from your outstanding review queue. No SKU, manufacturer, inFlow record or publication setting changed.</p><div class="comparison">${snapshot('Previous website title',item.website)}${snapshot('Approved website title',{...item.website,name:item.applied.title})}</div>${data.decisions[item.id]?.note?`<p><strong>Your saved note:</strong> ${esc(data.decisions[item.id].note)}</p>`:''}<p class="sub">The original decision and history are preserved. If you need to change this completed title again, tell me the SKU and correction.</p>`;
    $('back').onclick=()=>document.body.classList.remove('detail-open');return;
  }
  const decision=data.decisions[item.id],stale=decision&&!matches(item,decision);
  const saved=!stale?decision:null,fields=saved?.fields||item.proposed;
  const note=saved?.note||'';dirty=false;
  $('detail').innerHTML=`<div class="detail-top"><div><button type="button" class="back" id="back">← List</button> <span class="sku">${esc(item.sku||'SKU missing')}</span></div><span class="pill ${status(item)}">${labels[status(item)]}</span></div>
  <h2>${esc(item.name||'Untitled product')}</h2>
  ${item.batchHold?.length?`<div class="issues"><h3>Why this stayed in your review</h3><ul>${item.batchHold.map((reason)=>`<li>${esc(reason)}</li>`).join('')}</ul></div>`:''}
  ${stale?'<div class="issues"><strong>This item changed after your last decision.</strong><p>Your old decision is preserved, but it is no longer treated as approval. Review it again below.</p></div>':''}
  <div class="issues"><h3>What needs checking</h3>${item.issues.length?`<ul>${item.issues.map((i)=>`<li><strong>${esc(i.issue)}</strong><span>Proposed fix: ${esc(i.fix)}</span></li>`).join('')}</ul>`:'<p>This item already passes the current catalog filter. Check its displayed identity before final inclusion.</p>'}</div>
  <div class="comparison">${snapshot(item.website?'Website now':'Website — not listed',item.website,item.source)}${snapshot('Saved inFlow record',item.source,item.website)}</div>
  ${item.research?.length?`<div class="issues"><h3>Saved research to check</h3><p class="sub">Earlier notes about this SKU, not a new supplier lookup or automatic approval.</p>${item.research.map((r)=>`<p>${esc(r.note)}</p>${r.suggestedTitle?`<p><strong>Research suggests this title:</strong> ${esc(r.suggestedTitle)}</p>`:''}`).join('')}</div>`:''}
  ${item.laterSource?`<div class="issues"><h3>A later saved export is different</h3>${snapshot('Later saved identity — confirm which is current',item.laterSource,item.source)}</div>`:''}
  ${item.sourceCandidates.length?`<details open><summary>Possible source records — exact match needs your decision</summary><div class="comparison">${item.sourceCandidates.map((s)=>snapshot(`Source record ${s.productId}`,s,item.website)).join('')}</div></details>`:''}
  <form id="review-form" class="proposal"><h3>Proposed website values</h3><p>${esc(item.proposalNote)}</p><div class="editor">
  <label class="wide" for="proposed-name">Product title<input id="proposed-name" maxlength="600" value="${esc(fields.name)}" autocomplete="off"></label>
  <label for="proposed-sku">SKU<input id="proposed-sku" maxlength="80" value="${esc(fields.sku)}" autocomplete="off" placeholder="Confirm the exact part number"></label>
  <label for="proposed-brand">Manufacturer / brand<input id="proposed-brand" maxlength="120" value="${esc(fields.brand)}" autocomplete="off" placeholder="Confirm the actual brand"></label>
  <label class="wide" for="note">Notes — what should I fix?<textarea id="note" maxlength="3000" placeholder="For example: keep this off, wrong manufacturer, correct years are…">${esc(note)}</textarea></label></div>
  <p class="footer-note">OK approves these exact values for the next website batch. It does not approve images, unverified cross-references, or a public launch. Website and inFlow records stay unchanged here.</p>
  <details><summary>Record details${stale?' and previous decision':''}</summary><div class="technical">${esc(item.id)}<br>Saved source date: ${esc(data.snapshotAt||'Unknown')}<br>Current issues: ${esc(item.issues.map((i)=>i.code).join(', ')||'None')}${stale?`<br>Previous choice: ${esc(labels[decision.decision])}<br>Previous notes: ${esc(decision.note)}<br>Previous values: ${esc(JSON.stringify(decision.fields))}`:''}</div></details>
  <div class="actions"><button type="button" class="ok-btn" data-decision="ok">✓ OK for website</button><button type="button" class="no-btn" data-decision="no">✕ No — leave off</button><button type="button" class="fix-btn" data-decision="fix">Needs changes</button><button type="button" data-decision="pending">Save for later</button><p class="save-hint" id="save-hint">${saved?'Saved online. You can change your decision.':'Choose a decision to save. After saving, the next unreviewed item opens.'}</p></div></form>`;
  $('back').onclick=()=>{if(selectionAllowed())document.body.classList.remove('detail-open');};
  $('review-form').onsubmit=(e)=>e.preventDefault();
  $('review-form').oninput=()=>{dirty=true;$('save-hint').textContent='Unsaved edits — choose a decision to save them.';};
  document.querySelectorAll('[data-decision]').forEach((button)=>button.onclick=()=>save(button.dataset.decision));
}
async function save(decision){
  if(busy)return;
  const item=data.items.find((r)=>r.id===selected);if(!item)return;
  const input={id:item.id,fingerprint:item.fingerprint,revision:data.revision,requestId:crypto.randomUUID(),decision,
    fields:{name:$('proposed-name').value,sku:$('proposed-sku').value,brand:$('proposed-brand').value},note:$('note').value};
  if(decision==='fix'&&!input.note.trim()){notice('Tell me what needs changing in the Notes box first.',true);$('note').focus();return;}
  const before=filtered();
  busy=true;document.querySelectorAll('[data-decision], #review-form input, #review-form textarea').forEach((b)=>b.disabled=true);
  try{
    const response=await fetch('/api/decision',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});
    const result=await response.json();if(!response.ok)throw new Error(result.error||'Could not save your choice.');
    data.revision=result.revision;data.decisions[item.id]=result.decision;dirty=false;
    notice(decision==='pending'?`Saved ${item.sku||'item'} for later, with your edits and notes. Find it on the Saved for later page.`:`Saved ${item.sku||'item'}: ${labels[decision]}. Nothing was published.`);
    const after=filtered();selected=nextReviewSelection(before,after,item.id,data.decisions,group);
    const newIndex=after.findIndex((r)=>r.id===selected);if(newIndex>=0)page=Math.floor(newIndex/pageSize);
    busy=false;renderList();renderDetail();
  }catch(error){notice(error.message+' Your unsaved edits are still here.',true);}
  finally{busy=false;document.querySelectorAll('[data-decision], #review-form input, #review-form textarea').forEach((b)=>b.disabled=false);}
}
function applyFilters(){if(!selectionAllowed())return;page=0;const rows=renderList();selected=rows[0]?.id||null;renderList();renderDetail();}
async function load(){
  if(busy)return;if(dirty&&!confirm('Reloading will discard your unsaved edits. Continue?'))return;
  busy=true;$('reload').disabled=true;
  try{
    const response=await fetch('/api/review');if(response.status===401){window.location.assign('/signin-with-chatgpt?return_to='+encodeURIComponent(reviewPath(group)));return;}if(!response.ok)throw new Error((await response.json()).error||'Could not load your online review.');
    data=await response.json();dirty=false;
    const priorBrand=$('brand').value;$('brand').innerHTML='<option value="">All brands</option>'+[...new Set(data.items.filter((r)=>['held','outside'].includes(r.group)).map((r)=>r.brand).filter(Boolean))].sort().map((b)=>`<option value="${esc(b)}">${esc(b)}</option>`).join('');$('brand').value=priorBrand;
    busy=false;const rows=filtered();if(!rows.some((r)=>r.id===selected))selected=rows[0]?.id||null;renderList();renderDetail();
  }catch(error){notice(error.message,true);if(!data)$('detail').innerHTML='<p class="empty">Unable to load your online review. Use Reload to try again. Existing choices have not been changed.</p>';}
  finally{busy=false;$('reload').disabled=false;}
}
$('search').oninput=applyFilters;$('status').onchange=applyFilters;$('brand').onchange=applyFilters;
$('prev').onclick=()=>{if(selectionAllowed()){page--;renderList();$('list').scrollTop=0;}};
$('next').onclick=()=>{if(selectionAllowed()){page++;renderList();$('list').scrollTop=0;}};
$('reload').onclick=load;window.addEventListener('beforeunload',(event)=>{if(dirty||busy){event.preventDefault();event.returnValue='';}});
setGroup(group);load();
// Optional browser-agent navigation shares the normal filtered review state.
if(document.modelContext?.registerTool){
 const lifecycle=new AbortController();
 try{Promise.resolve(document.modelContext.registerTool({name:'open_review_item',description:'Open an existing product in the review editor; does not approve or save it.',inputSchema:{type:'object',properties:{id:{type:'string'}},required:['id'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},execute(input){if(!data||typeof input?.id!=='string'||!selectionAllowed())throw new Error('Review is not ready or has unsaved edits.');const item=data.items.find(r=>r.id===input.id);if(!item)throw new Error('Item not found.');setGroup(status(item)==='later'?'later':item.group);$('search').value='';$('brand').value='';$('status').value='all';selected=item.id;page=Math.max(0,Math.floor(filtered().findIndex(r=>r.id===selected)/pageSize));renderList();renderDetail();document.body.classList.add('detail-open');return{id:item.id,sku:item.sku,decision:status(item)};}},{signal:lifecycle.signal})).catch(()=>{});}catch{}
 window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
}
