(function(){
 'use strict';
 const screen=document.querySelector('.screen'),menu=document.getElementById('app-more-menu');if(!screen||!menu)return;
 const assets=['/images/commissioning-cabinet.png','/images/commissioning-surroundings.png'];
 const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
 const btn=(text,fn,cls='')=>{const b=el('button',cls,text);b.type='button';b.onclick=fn;return b;};
 const layer=el('section','co-layer');layer.hidden=true;layer.setAttribute('role','dialog');layer.setAttribute('aria-modal','true');screen.append(layer);
 let view='auth',prompt=true,photos=[],review=null,password='',filled=false,authorized=false,busy=false,version=0,previousFocus=null;
 const input=(capture)=>{const n=el('input');n.type='file';n.accept='image/*';n.hidden=true;if(capture)n.setAttribute('capture','environment');else n.multiple=true;n.onchange=()=>{const files=Array.from(n.files||[]);n.value='';void addFiles(files);};screen.append(n);return n;};
 const camera=input(true),gallery=input(false);
 function image(src){const im=new Image();im.src=src;return im.decode().then(()=>im);}
 function invalidate(){review=null;password='';filled=false;authorized=false;}
 function goReview(take=false){prompt=false;view='review';render();if(take&&!busy)camera.click();}
 function reset(){version++;busy=false;photos=[];invalidate();prompt=true;view='auth';render();}
 // This dedicated commissioning page simulates approval; it never authorizes a real device.
 // Rephotographed/compressed demo inputs must not be gated by matching original image bytes.
 async function addFiles(files){if(!files.length||busy||layer.hidden)return;if(files.length>2-photos.length){toast('请保留两张照片：柜体正面和周边环境');return;}const seq=version;invalidate();busy=true;render();try{const decoded=await Promise.all(files.map(async file=>{if(file.size>25*1024*1024)throw Error('单张照片请控制在 25 MB 以内');if(file.type&&!file.type.startsWith('image/'))throw Error('请选择照片文件');const url=URL.createObjectURL(file);try{let im;try{im=await image(url);}catch{throw Error('这张照片暂时无法读取，请重新拍摄，或转为 JPG/PNG 后上传');}if(!(im.naturalWidth>0&&im.naturalHeight>0))throw Error('照片内容无法读取，请重新选择');const c=document.createElement('canvas'),scale=Math.min(1,960/Math.max(im.naturalWidth,im.naturalHeight));c.width=Math.max(1,Math.round(im.naturalWidth*scale));c.height=Math.max(1,Math.round(im.naturalHeight*scale));c.getContext('2d').drawImage(im,0,0,c.width,c.height);return {src:c.toDataURL('image/jpeg',.8)};}finally{URL.revokeObjectURL(url);}}));if(seq!==version)return;photos.push(...decoded);if(photos.length===2)finish();}catch(e){if(seq===version)toast(e.message||'照片读取失败');}finally{if(seq===version){busy=false;render();}}}
 function finish(){review='demo-pass';password='DEMO-'+String(crypto.getRandomValues(new Uint32Array(1))[0]%1000000).padStart(6,'0');filled=false;authorized=false;}
 function examples(){if(busy)return;version++;invalidate();photos=assets.map(src=>({src}));finish();render();}
 function close(){version++;busy=false;layer.hidden=true;globalThis.SolarReminders?.setContext(null);previousFocus?.focus();}
 function backfill(){if(review!=='demo-pass'||!password)return;filled=true;view='auth';prompt=false;render();}
 function submit(){if(!filled||review!=='demo-pass'||!password||authorized)return;authorized=true;render();toast('演示开机授权已提交');}
 function device(name,state,fields){const box=el('section','co-card'),h=el('div','co-device-head');h.append(el('strong','',name),el('span',state==='已授权'?'co-good':'co-muted',state));box.append(h);for(const [key,val]of fields){const row=el('div','co-row');row.append(el('span','',key),el('strong','',val));box.append(row);}return box;}
 function auth(body,footer){body.append(el('p','co-note','请按小源指引完成现场照片审核，再回填开机密码。此页面仅演示储能开机授权。'),device('SmartLogger5000A','已授权',[['SN','DEMO-LOGGER-01'],['通信地址','COM1–1'],['验证码','012345']]));const ibcu=device('IBCU',authorized?'已授权':'未授权',[['SN','DEMO-IBCU-01'],['验证码','123456']]);const label=el('label','co-field','开机密码'),code=el('input');code.placeholder='审核通过后回填';code.value=filled?password:'';code.readOnly=true;label.append(code);ibcu.append(label);body.append(ibcu);
  if(authorized){const result=el('div','co-success');result.append(el('strong','','✓ 演示授权提交成功'),el('p','','IBCU 已标记为已授权。没有向设备发送开机指令。'));body.append(result,btn('重新演示',reset,'co-secondary'));}
  else body.append(btn(filled?'查看审核记录':'拍照审核',()=>goReview(),'co-secondary'));

  const send=btn(authorized?'已提交':'提交',submit,'co-primary');send.disabled=!filled||authorized;footer.append(send);
 }
 function reviewPage(body,footer){body.append(el('p','co-note','请拍摄柜体正面和周边环境各一张，或从相册上传。两张照片读取完成后，将按工商业开局演练预设展示审核通过结果。'));const media=el('div','co-photos');photos.forEach((p,i)=>{const tile=el('div'),im=el('img');im.src=p.src;im.alt='现场照片 '+(i+1);tile.append(im,btn('移除照片 '+(i+1),()=>{if(busy)return;photos.splice(i,1);invalidate();render();},'co-remove'));media.append(tile);});if(photos.length)body.append(media);
  const controls=el('div','co-actions');for(const b of [btn('拍照',()=>camera.click(),'co-secondary'),btn('从相册上传',()=>gallery.click(),'co-secondary'),btn('使用演示照片',()=>void examples(),'co-secondary')]){b.disabled=busy||(photos.length>=2&&b.textContent!=='使用演示照片');controls.append(b);}body.append(controls);
  if(busy){body.append(el('p','co-note','正在读取并审核照片…'));return;}
  if(review!=='demo-pass'){if(photos.length===1)body.append(el('p','co-note','已收到 1 张照片，再补充一张即可完成本次演练审核。'));return;}
  const box=el('section','co-card');box.append(el('strong','co-good','✓ 审核通过 · 可继续模拟授权'),el('p','co-note','已收到两张照片，以下为本次演练预设的复核结果。'));
  const checks=[['遮阳防雨','已按演练预设完成防雨设施与排水核验。'],['安全间距','已按演练预设完成可燃物与维护间距核验。'],['基础与固定','已按演练预设完成基座与固定方式核验。'],['设备外观','已按演练预设完成柜体与标识核验。']];for(const [title,note]of checks){const row=el('div','co-check');row.append(el('span','','✓'),el('div','',title+'：'+note));box.append(row);}
  const pass=el('div','co-password');pass.append(el('small','','储能开机密码（演示）'),el('strong','',password));box.append(pass,el('p','co-note','Demo 结果与密码仅在本页面有效；实际安装及开机须现场复核。'));body.append(box);footer.append(btn('回填开机密码并返回',backfill,'co-primary'));
 }
 function openNotice(){
  const session=version;
  layer.hidden=true;SolarReminders.setContext(null);
  SolarReminders.openPrepared('commissioning:'+session,'完成储能开机授权，还需要准备什么？',()=>{
   const row=addMsg('ai','请准备两张现场照片：一张储能柜正面，一张周边环境。拍照或从相册上传后，可查看审核结果，再回填开机密码。');
   function resume(take){
    if(version!==session||filled||authorized){toast('授权状态已变化，请重新查看授权页');return;}
    closeXY();layer.hidden=false;prompt=false;
    if(take)goReview(true);else{view='auth';render();}
   }
   const actions=el('div','co-actions');actions.append(btn('去拍照',()=>resume(true),'co-primary'),btn('稍后',()=>resume(false),'co-secondary'));row.querySelector('.bubble').append(actions);return row;
  });
 }
 function render(){if(layer.hidden)return;layer.replaceChildren();const header=el('header','co-header'),body=el('div','co-body'),footer=el('footer','co-footer');const title=view==='auth'?'储能开机授权':view==='notice'?'华为小源':'华为小源 · 安全审核';layer.setAttribute('aria-label',title);header.append(btn('‹',()=>{if(view!=='auth'){view='auth';render();}else close();},'co-back'),el('h2','',title),el('span','co-badge','Demo'));layer.append(header,body,footer);if(view==='auth')auth(body,footer);else reviewPage(body,footer);footer.hidden=!footer.childElementCount;globalThis.SolarReminders?.setContext(view==='auth'&&!authorized&&!filled?{visible:prompt,title:'储能开机授权待完成',summary:'是否要去拍照？小源可以帮你整理安全审核意见。',onOpen:openNotice}:null);}
 layer.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
 const link=el('a','','▣ 中型工商业电站开局 ›');link.href='#commissioning';link.setAttribute('role','menuitem');link.onclick=e=>{e.preventDefault();closeAppMenu();previousFocus=document.getElementById('app-menu-trigger');layer.hidden=false;view='auth';render();layer.querySelector('button').focus();};menu.append(link);
})();
