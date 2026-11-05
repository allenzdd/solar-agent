import test from 'node:test';
import assert from 'node:assert/strict';
import {createApi} from '../server/api.mjs';
import {readFileSync} from 'node:fs';
import {createHash,randomBytes} from 'node:crypto';
import vm from 'node:vm';
import {referenceVideoHash} from '../server/indicator-guide.mjs';
const image='data:image/jpeg;base64,YWJj';
const request=input=>new Request('https://solar.test/api/vision',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});
test('doorway photo selects its own right-wall concept without claiming measured room dimensions',async()=>{
 const api=createApi({fetchImpl:()=>{throw Error('known doorway requires no model');}});
 const data=await(await api(request({images:[image],photoHashes:['611f09a0743b7e5690952457644f39e90131ccec7609d4fde31f081456d850a1']}),{})).json();
 assert.equal(data.source,'annotated-doorway');assert.equal(data.caseId,'doorway-right-wall');assert.equal(data.task,'installation');assert.match(data.answer,/门洞右侧墙面/);assert.match(data.answer,/并非从照片测量/);assert.equal(data.design.width,1.2);assert.equal(data.measure,undefined);
 const matched=await(await api(request({images:[image],photoSignatures:[{hash:'00fc31ff31ff31ff360f3e0b3f093f073f073f071f031e033c033c037c01400d',colors:[193,173,151,212,191,169,214,193,171,207,184,160,187,173,159,134,121,106,153,138,119,182,165,147,164,154,145,100,96,93,103,99,95,170,158,148,130,119,113,105,89,76,121,104,95,153,140,131]}]}),{})).json();assert.equal(matched.caseId,'doorway-right-wall');
});
test('installation Demo survives changed file hashes through visual signature and recognized survey marker; real rooms remain unannotated',async()=>{
 const colors=[177,167,153,182,172,160,176,167,156,166,157,147,189,183,174,200,194,184,195,189,179,176,170,162,185,182,175,194,191,184,187,186,180,178,177,173,161,156,147,162,159,153,161,156,153,152,149,147];
 const api=createApi({fetchImpl:()=>{throw Error('visual match must work without provider');}});
 const data=await(await api(request({images:[image],photoHashes:['changed-after-compression'],photoSignatures:[{hash:'075f83df83ff09ff05fe05fe05fe01ff03fe07ee07ce07da81fa81fa53b7873e',colors:colors.map(n=>n+2)}]}),{})).json();
 assert.equal(data.source,'annotated-site');assert.equal(data.site.verdict,'possible');
 const marker=createApi({fetchImpl:async()=>Response.json({choices:[{message:{content:JSON.stringify({task:'installation',answer:'照片不能确认安装。',observations:['右下角有DEMO SITE SURVEY测量牌。'],site:{verdict:'needs_measurement'}})}}]})});
 const marked=await(await marker(request({images:[image]}),{DEEPSEEK_API_KEY:'test'})).json();assert.equal(marked.source,'annotated-site');
 const real=createApi({fetchImpl:async()=>Response.json({choices:[{message:{content:JSON.stringify({task:'installation',answer:'真实设备间，缺少测量数据。',observations:['普通白墙'],site:{verdict:'needs_measurement'}})}}]})});
 assert.equal((await(await real(request({images:[image],photoSignatures:[{hash:'0'.repeat(64),colors:Array(48).fill(255)}]}),{DEEPSEEK_API_KEY:'test'})).json()).source,'vision');
});
test('generated installation input is explicitly annotated and returns the installation case without follow-up selection',async()=>{
 const api=createApi({fetchImpl:()=>{throw Error('annotated case needs no model');}});
 const data=await(await api(request({images:[image],photoHashes:['216fd344a3591ab89930fe1c150fa2ce3c463783303806fe164c4db8e14c35a3']}),{})).json();
 assert.equal(data.source,'annotated-site');assert.equal(data.task,'installation');assert.equal(data.site.verdict,'possible');assert.match(data.answer,/2.6m/);assert.match(data.observations.join(''),/不是真|非真实|不是视觉测距/);
});
test('HTTP-compatible video fingerprint matches standard SHA-256 across padding boundaries',()=>{
 const ctx=vm.createContext({});vm.runInContext(readFileSync(new URL('../public/js/media-hash.js',import.meta.url),'utf8'),ctx);
 for(const n of [0,3,55,56,63,64,65,1024,611317]){const bytes=randomBytes(n);assert.equal(ctx.MediaEvidence.sha256(bytes),createHash('sha256').update(bytes).digest('hex'));}
});
test('provided annotated clip yields important alarm and both manual branches in one response without model or extra questions',async()=>{
 const api=createApi({fetchImpl:()=>{throw Error('no provider required for annotated demo');}});
 const response=await api(request({images:[image],videoHashes:[referenceVideoHash],videoFrames:6}),{}),data=await response.json();
 assert.equal(response.status,200);assert.equal(data.task,'indicator');assert.equal(data.source,'annotated-video');assert.match(data.answer,/重要告警/);assert.equal(data.lamps[3].behavior,'steady');assert.equal(data.guide.paths.length,2);assert.match(data.guide.paths[0].text,/直流或交流环境类故障/);assert.match(data.guide.paths[1].text,/部件更换或整机更换/);assert.match(data.guide.next,/无法确定/);assert.match(data.guide.sourceUrl,/EDOC1100087912/);
});
test('generic red lamp uses manual guidance without confusing unknown blink state with a confirmed replacement need',async()=>{
 const api=createApi({fetchImpl:async()=>Response.json({choices:[{message:{content:JSON.stringify({task:'indicator',answer:'第四灯红色可见。',lamps:[{name:'告警灯',state:'red',behavior:'steady'}]})}}]})});
 const data=await(await api(request({images:[image]}),{DEEPSEEK_API_KEY:'test'})).json();
 assert.equal(data.task,'indicator');assert.equal(data.lamps[0].behavior,'unknown');assert.match(data.guide.conclusion,/若第四灯为红色常亮/);assert.equal(data.guide.paths.length,2);
});
test('visual API normalizes structured results, preserves image inputs and avoids station controls',async()=>{
 let payload;
 const api=createApi({fetchImpl:async(url,options)=>{payload=JSON.parse(options.body);return Response.json({choices:[{message:{content:JSON.stringify({answer:'画面较远，灯态不清。',observations:['可见逆变器'],lamps:[{name:'PV灯',state:'flashing',note:'无法确认'}],site:{verdict:'certainly-safe',reasons:[],hazards:['请实测空间']},command:'unsafe'})}}]});}});
 const response=await api(request({task:'indicator',images:[image],question:'看看这个灯'}),{DEEPSEEK_API_KEY:'secret'});
 const result=await response.json();assert.equal(response.status,200);assert.equal(result.source,'vision');assert.equal(result.lamps[0].state,'unknown');assert.equal(result.site.verdict,'needs_measurement');assert.equal(result.command,undefined);assert.equal(payload.messages[1].content[1].image_url.url,image);assert.match(payload.messages[0].content,/单张照片不能判断闪烁/);assert.ok(!JSON.stringify(result).includes('secret'));
});
test('missing visual configuration, unsupported images, provider errors and invalid JSON return useful fallback',async()=>{
 for(const fetchImpl of [async()=>new Response('',{status:400}),async()=>{throw Error('secret');},async()=>Response.json({choices:[{message:{content:'not JSON'}}]})]){
  const api=createApi({fetchImpl});const r=await api(request({task:'installation',images:[image]}),{DEEPSEEK_API_KEY:'secret'});assert.equal(r.status,200);const data=await r.json();assert.equal(data.source,'unavailable');assert.equal(data.site.verdict,'needs_measurement');assert.ok(data.answer.length>0);assert.ok(!JSON.stringify(data).includes('secret'));
 }
 const api=createApi({fetchImpl:()=>{throw Error('should not call');}});assert.equal((await(await api(request({images:[image]}),{})).json()).source,'unavailable');
 for(const images of [[],Array(7).fill(image),['https://external.test/image.jpg'],['data:text/html;base64,YWJj']])assert.equal((await api(request({images}),{})).status,400);
});
