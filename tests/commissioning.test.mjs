import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
const source=fs.readFileSync(new URL('../public/js/commissioning.js',import.meta.url),'utf8');
function setup(){
  class Node{
    constructor(tag='div'){this.tagName=tag;this.className='';this.children=[];this.attrs={};this.hidden=false;this.disabled=false;this.value='';this._text='';}
    set textContent(v){this._text=String(v);this.children=[];}
    get textContent(){return this._text+this.children.map(n=>n.textContent).join('');}
    get childElementCount(){return this.children.length;}
    append(...nodes){nodes.forEach(n=>{n.parentElement=this;this.children.push(n);});}
    replaceChildren(...nodes){this.children=[];this._text='';this.append(...nodes);}
    setAttribute(k,v){this.attrs[k]=v;}
    addEventListener(k,fn){this['on'+k]=fn;}
    matches(sel){return sel.startsWith('.')?this.className.split(' ').includes(sel.slice(1)):this.tagName===sel;}
    descendants(){return this.children.flatMap(n=>[n,...n.descendants()]);}
    querySelectorAll(sel){return this.descendants().filter(n=>n.matches(sel));}
    querySelector(sel){return this.querySelectorAll(sel)[0];}
    click(){if(!this.disabled)this.onclick?.({preventDefault(){}});}
    focus(){}
    getContext(){return {drawImage(){}};}
    toDataURL(){return 'data:image/jpeg;base64,decoded-photo';}
  }
  const screen=new Node(),menu=new Node(),files=new Map(),notes=[];screen.append(menu);let seq=0;
  const doc={activeElement:null,querySelector:q=>q==='.screen'?screen:null,getElementById:id=>id==='app-more-menu'?menu:null,createElement:tag=>new Node(tag)};
  class Photo{
    async decode(){const file=files.get(this.src);if(file?.wait)await file.wait;if(file?.bad)throw Error('decode failed');this.naturalWidth=file?.width||4800;this.naturalHeight=file?.height||6400;}
  }
  const c=vm.createContext({document:doc,Image:Photo,URL:{createObjectURL(file){const url='blob:photo-'+(++seq);files.set(url,file);return url;},revokeObjectURL(url){files.delete(url);}},crypto:webcrypto,Uint32Array,toast:text=>notes.push(text),closeAppMenu(){},SolarReminders:{setContext(){}}});vm.runInContext(source,c);
  const layer=screen.querySelector('.co-layer'),camera=screen.querySelectorAll('input').find(n=>n.attrs.capture==='environment'),gallery=screen.querySelectorAll('input').find(n=>n.multiple);
  const click=text=>{const b=layer.querySelectorAll('button').find(n=>n.textContent===text);assert.ok(b,'button '+text);b.click();return b;};
  const open=()=>menu.querySelector('a').click();
  const upload=(photos,input=gallery)=>{input.files=photos;input.onchange();};
  return {layer,camera,gallery,notes,click,open,upload};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const photo=(name,extra={})=>({name,type:'image/jpeg',size:500000,...extra});
test('two newly captured photos pass demo review and backfill a local-only password',async()=>{
  const u=setup();u.open();u.click('拍照审核');u.upload([photo('IMG_4921.JPG')],u.camera);await tick();
  assert.ok(u.layer.textContent.includes('已收到 1 张'));assert.equal(u.layer.textContent.includes('DEMO-'),false);
  u.upload([photo('IMG_4922.JPG',{width:1600,height:1200})],u.camera);await tick();assert.ok(u.layer.textContent.includes('审核通过'));assert.ok(u.layer.textContent.includes('本次演练预设'));assert.equal(u.layer.textContent.includes('需要现场复核 · 未发放密码'),false);
  const code=u.layer.querySelector('.co-password').textContent.match(/DEMO-\d{6}/)[0];assert.ok(code);
  u.click('回填开机密码并返回');const input=u.layer.querySelectorAll('input').find(n=>n.readOnly);assert.equal(input.value,code);
  const submit=u.layer.querySelectorAll('button').find(n=>n.textContent==='提交');assert.equal(submit.disabled,false);submit.click();assert.ok(u.layer.textContent.includes('授权提交成功'));assert.ok(u.layer.textContent.includes('没有向设备发送开机指令'));
});
test('compressed gallery copies pass without sample hashes or image fingerprint services',async()=>{
  const u=setup();u.open();u.click('拍照审核');u.upload([photo('cropped-surroundings.png',{type:'image/png',width:925,height:693}),photo('screen-photo.jpeg',{width:1100,height:1600})]);await tick();
  assert.ok(u.layer.textContent.includes('审核通过'));assert.equal(u.notes.length,0);assert.equal(u.layer.querySelectorAll('img').length,2);
  u.click('移除照片 1');assert.equal(u.layer.querySelector('.co-password'),undefined);assert.ok(u.layer.textContent.includes('已收到 1 张'));
  u.upload([photo('replacement.jpg')]);await tick();assert.ok(u.layer.querySelector('.co-password'));
});
test('unreadable and oversized files cannot manufacture a passing review; valid replacement recovers',async()=>{
  const u=setup();u.open();u.click('拍照审核');u.upload([photo('valid.jpg')]);await tick();u.upload([photo('broken.heic',{bad:true,type:'image/heic'})]);await tick();assert.ok(u.notes.at(-1).includes('重新拍摄'));assert.equal(u.layer.querySelector('.co-password'),undefined);
  u.upload([photo('large.jpg',{size:26*1024*1024})]);await tick();assert.ok(u.notes.at(-1).includes('25 MB'));assert.equal(u.layer.querySelector('.co-password'),undefined);
  u.upload([photo('replacement.jpg')]);await tick();assert.ok(u.layer.textContent.includes('审核通过'));
});
test('built-in examples still work and closing cancels an in-flight photo read',async()=>{
  const u=setup();u.open();u.click('拍照审核');u.click('使用演示照片');assert.ok(u.layer.textContent.includes('审核通过'));u.click('回填开机密码并返回');u.click('提交');u.click('重新演示');u.click('拍照审核');
  let release;const wait=new Promise(resolve=>{release=resolve;});u.upload([photo('pending.jpg',{wait})]);u.layer.onkeydown({key:'Escape'});release();await tick();assert.equal(u.layer.hidden,true);
  u.open();u.click('拍照审核');assert.equal(u.layer.querySelectorAll('img').length,0);assert.equal(u.layer.querySelector('.co-password'),undefined);
});
