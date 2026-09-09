import {folderLabels,classifySalesItem,salesRows,salesView,stockLabel} from './sales-folders.js?v=20260909';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const formatDate=v=>v?new Intl.DateTimeFormat('en-US',{year:'numeric',month:'short',day:'numeric',timeZone:'UTC'}).format(new Date(v+'T00:00:00Z')):'No recorded sale found';
let snapshot=null,hash=null,view=salesView(location.search),page=0,busy=false,loaded=false;
const size=30;
function message(text){$('notice').textContent=text;}
function selected(){return snapshot?salesRows(snapshot,view,$('search').value,$('stock').value):[];}
function render(printAll=false){
  for(const button of document.querySelectorAll('[data-view]'))button.setAttribute('aria-pressed',String(button.dataset.view===view));
  $('folder-title').textContent=view==='check'?'Dates to verify':folderLabels[view];
  const rows=selected();page=Math.max(0,Math.min(page,Math.ceil(rows.length/size)-1));
  const dated=rows.filter(row=>row.lastRecordedSaleDate).length;
  $('result-count').textContent=rows.length+' items · '+dated+' with a sale date · '+(rows.length-dated)+' with no recorded sale';
  $('rows').innerHTML=(printAll?rows:rows.slice(page*size,(page+1)*size)).map(row=>`<tr><td class="part"><span class="sku">${esc(row.sku||'SKU missing')}</span><strong>${esc(row.name||'Title missing')}</strong><span>${esc(row.brand||'Brand not recorded')}</span></td><td data-label="Last recorded sale">${esc(formatDate(row.lastRecordedSaleDate))}<span class="note">${esc(classifySalesItem(row,snapshot.asOf).reason)}${!row.lastRecordedSaleDate&&row.createdDate?' Record created '+esc(formatDate(row.createdDate))+'.':''}</span></td><td data-label="Current recorded stock"><span class="stock ${esc(row.stockStatus)}">${esc(stockLabel(row.stockStatus))}</span><span class="note">Out-of-stock duration: not verified</span></td></tr>`).join('');
  $('empty').hidden=rows.length>0;$('empty').textContent=snapshot?'No items match this folder and filter.':'No sales report has been loaded yet. Your catalog decisions are still saved.';
  $('prev').disabled=busy||page===0;$('next').disabled=busy||(page+1)*size>=rows.length;
  $('print').disabled=busy||!snapshot||!rows.length;$('page-count').textContent=rows.length?`${page+1} / ${Math.ceil(rows.length/size)}`:'0 / 0';
  if(snapshot){
    for(const key of Object.keys(folderLabels))$('count-'+key).textContent=salesRows(snapshot,key).length;
    $('as-of').textContent='As of '+formatDate(snapshot.asOf)+' · Stock checked '+new Date(snapshot.catalogCapturedAt).toLocaleString();
    $('coverage').textContent=snapshot.coverage+' '+snapshot.counts.ordersScanned.toLocaleString()+' sales orders checked.';
    $('date-basis').textContent=snapshot.dateBasis;
    const unknown=salesRows(snapshot,'check').length;$('check-history').hidden=!unknown;$('check-history').textContent=`Dates to verify (${unknown})`;
  }
}
function navigate(next){if(busy)return;view=next;page=0;history.replaceState(null,'','/review/sales?view='+view);render();}
async function load(){
  if(busy)return;busy=true;$('reload').disabled=true;$('import').disabled=true;
  try{const response=await fetch('/api/sales-review',{cache:'no-store'});
    if(response.status===401){location.assign('/signin-with-chatgpt?return_to='+encodeURIComponent('/review/sales?view='+view));return;}
    const result=await response.json();if(!response.ok)throw Error(result.error||'Could not load this report.');
    snapshot=result.snapshot;hash=result.hash;loaded=true;message('');
  }catch(error){message(error.message+' Your saved choices have not changed.');}
  finally{busy=false;$('reload').disabled=false;$('import').disabled=!loaded||!$('report-file').files.length;render();}
}
for(const button of document.querySelectorAll('[data-view]'))button.onclick=()=>navigate(button.dataset.view);
$('check-history').onclick=()=>navigate('check');
$('search').oninput=$('stock').onchange=()=>{page=0;render();};
$('prev').onclick=()=>{page--;render();};$('next').onclick=()=>{page++;render();};
$('reload').onclick=load;
$('print').onclick=()=>{render(true);window.print();render();};
window.addEventListener('afterprint',()=>render());
$('report-file').onchange=()=>{$('import').disabled=busy||!loaded||!$('report-file').files.length;};
$('import').onclick=async()=>{
  const file=$('report-file').files[0];if(!file||busy||!loaded)return;
  if(file.size>1900000){message('Choose the prepared report file, under 1.9 MB.');return;}
  busy=true;$('import').disabled=true;$('reload').disabled=true;
  try{const input=JSON.parse(await file.text());const response=await fetch('/api/sales-review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({snapshot:input,expectedHash:hash})});const result=await response.json();if(!response.ok)throw Error(result.error||'Report not loaded.');snapshot=result.snapshot;hash=result.hash;page=0;message('Private report loaded. Your catalog decisions and notes were not changed.');}
  catch(error){message(error.message+' Your previous report and saved choices are preserved.');}
  finally{busy=false;$('import').disabled=false;$('reload').disabled=false;render();}
};
load();
