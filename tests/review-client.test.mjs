import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import * as queue from '../public/review-queue.js';

// Exercise the real client handlers against a tiny document stub, not a browser
// or live records. Rendering/layout is deliberately outside this unit test.
const decode=s=>s.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
function documentStub(){
  const elements=new Map();
  const element=id=>{
    if(elements.has(id))return elements.get(id);
    const node={id,value:'',textContent:'',disabled:false,dataset:{},focus(){},querySelectorAll(selector){return this.children?.filter(child=>selector==='[data-group]'?child.dataset.group:child.dataset.item)||[];}};
    Object.defineProperty(node,'innerHTML',{get(){return this.html||'';},set(html){
      this.html=html;this.children=[];
      for(const match of html.matchAll(/<(input|textarea|button|select|form|p)\b([^>]*)>/g)){
        const attrs=match[2],childId=attrs.match(/\bid="([^"]+)"/)?.[1];
        const child=childId?element(childId):{dataset:{}};
        for(const key of ['group','item','decision']){const value=attrs.match(new RegExp(`data-${key}="([^"]+)"`))?.[1];if(value)child.dataset[key]=decode(value);}
        if(match[1]==='input')child.value=decode(attrs.match(/\bvalue="([^"]*)"/)?.[1]||'');
        if(match[1]==='textarea')child.value=decode(html.slice(match.index+match[0].length).split('</textarea>')[0]);
        this.children.push(child);
      }
    }});
    elements.set(id,node);return node;
  };
  element('status').innerHTML='<option value="pending">Needs my check</option><option value="all">Include saved decisions</option>';
  element('status').value='pending';
  const document={getElementById:element,body:{classList:{add(){},remove(){}}},querySelectorAll(selector){
    if(selector==='[data-decision]')return element('detail').children.filter(child=>child.dataset.decision);
    return element('detail').children.filter(child=>child.dataset.decision||['proposed-name','proposed-sku','proposed-brand','note'].includes(child.id));
  }};
  return {document,element};
}
const item=(id,group='held')=>({id,group,fingerprint:'current',sku:id,name:'Test part '+id,brand:'Example',issues:[],proposed:{sku:id,name:'Test part '+id,brand:'Example'},sourceCandidates:[],proposalNote:'Invented unit test item.'});
const fixture=()=>({revision:7,items:[item('a'),item('b'),item('c','outside')],decisions:{c:{decision:'pending',fingerprint:'current',fields:{sku:'c',name:'Saved title',brand:'Confirmed'},note:'Existing note'}}});

async function client({search='',failSave=false,rows=fixture()}={}){
  const {document,element}=documentStub(),requests=[];
  let online=structuredClone(rows);
  const window={location:{search,assign(path){this.assigned=path;}},history:{replaceState(_,__,path){window.location.search=path.includes('?')?path.slice(path.indexOf('?')):'';}},addEventListener(){}};
  const context=vm.createContext({...queue,document,window,URLSearchParams,crypto:{randomUUID},confirm:()=>false,fetch:async(path,options)=>{
    if(path==='/api/review')return {ok:true,status:200,json:async()=>structuredClone(online)};
    assert.equal(path,'/api/decision');assert.equal(options.method,'POST');
    const input=JSON.parse(options.body);requests.push(input);
    if(failSave)return {ok:false,status:409,json:async()=>({error:'Another tab saved first.'})};
    const decision={decision:input.decision,fingerprint:input.fingerprint,fields:input.fields,note:input.note};
    online.decisions[input.id]=decision;online.revision++;
    return {ok:true,status:200,json:async()=>({revision:online.revision,decision:structuredClone(decision)})};
  }});
  const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  assert.match(source,/^import \{[^\n]+\} from '\.\/review-queue\.js\?v=20260909';$/m);
  vm.runInContext(source.replace(/^import [^\n]+\n/m,'')+'\nglobalThis.ui={save,load,filtered,setGroup,renderList,renderDetail,get selected(){return selected},get dirty(){return dirty},get data(){return data}};',context);
  await new Promise(resolve=>setImmediate(resolve));
  const ui=context.ui;
  const go=view=>element('groups').querySelectorAll('[data-group]').find(button=>button.dataset.group===view).onclick();
  const edit=()=>{element('proposed-name').value='Edited & verified title';element('proposed-brand').value='Confirmed brand';element('note').value='Keep every note';element('review-form').oninput();};
  return {ui,element,go,edit,requests,window};
}

test('Save for later saves all fields, advances, and restores the exact edits after reopening/reload',async()=>{
  const {ui,element,edit,go,requests,window}=await client();
  assert.equal(ui.selected,'a');edit();await ui.save('pending');
  assert.equal(requests[0].decision,'pending');assert.equal(requests[0].fields.brand,'Confirmed brand');
  assert.equal(requests[0].fields.name,'Edited & verified title');assert.equal(requests[0].note,'Keep every note');
  assert.equal(ui.selected,'b');assert.equal(ui.dirty,false);
  assert.deepEqual(Array.from(ui.filtered(),row=>row.id),['b']);
  assert.match(element('notice').textContent,/Saved for later page/);
  go('later');assert.equal(window.location.search,'?view=later');
  assert.equal(element('page-title').textContent,'Saved for later');
  assert.deepEqual(Array.from(ui.filtered(),row=>row.id),['a','c']);
  assert.equal(element('proposed-brand').value,'Confirmed brand');assert.equal(element('note').value,'Keep every note');
  await ui.load();
  assert.equal(element('proposed-name').value,'Edited & verified title');
  assert.equal(element('note').value,'Keep every note');assert.equal(ui.data.decisions.c.note,'Existing note');
  await ui.save('ok');
  assert.deepEqual(Array.from(ui.filtered(),row=>row.id),['c']);assert.equal(ui.data.decisions.a.decision,'ok');
  assert.equal(ui.data.decisions.a.note,'Keep every note');
});

test('failed saves and attempted navigation keep the item and unsaved edits intact',async()=>{
  const {ui,element,edit,go}=await client({failSave:true});
  edit();go('later');assert.equal(ui.selected,'a');assert.match(element('notice').textContent,/unsaved edits/);
  await ui.save('pending');
  assert.equal(ui.selected,'a');assert.equal(ui.dirty,true);assert.equal(ui.data.revision,7);
  assert.equal(ui.data.decisions.a,undefined);assert.equal(element('proposed-brand').value,'Confirmed brand');
  assert.equal(element('note').value,'Keep every note');assert.equal(element('proposed-brand').disabled,false);
  assert.match(element('notice').textContent,/Your unsaved edits are still here/);
});

test('saved-for-later bookmarks reopen the separate queue without making any save request',async()=>{
  const {ui,element,requests}=await client({search:'?view=later'});
  assert.equal(ui.selected,'c');assert.equal(element('status').disabled,true);
  assert.equal(element('note').value,'Existing note');assert.equal(element('progress').textContent,'1 saved for later');
  assert.equal(requests.length,0);
});

test('saving the last main item leaves a usable empty state and retains it in the later queue',async()=>{
  const {ui,element,go}=await client({rows:{revision:0,items:[item('only')],decisions:{}}});
  await ui.save('pending');assert.equal(ui.selected,null);
  assert.match(element('detail').innerHTML,/Back to list/);
  go('later');assert.equal(ui.selected,'only');assert.equal(ui.data.decisions.only.decision,'pending');
  await ui.save('no');assert.equal(ui.selected,null);assert.equal(ui.data.decisions.only.decision,'no');
});
