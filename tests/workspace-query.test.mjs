import test from 'node:test';
import assert from 'node:assert/strict';
import {queryWorkspace} from '../server/workspace-query.mjs';
import {createApi} from '../server/api.mjs';
const utc=Date.parse('2026-11-04T04:00:00Z'), secret='must-never-appear';
const document={config:[{id:'P3',name:'山东济宁光储电站',invKw:100,ratio:1.2,tariff:{cur:'CNY',sym:'¥'}}],snapshot:{v:3,ts:utc,time:{utc,speed:60,running:true},agg:{},plants:[{id:'P3',name:'山东济宁光储电站',invKw:100,pv:50,dayPv:12,soc:60,batTemp:26,invTemp:85,hist:[{utc:utc-60000,pv:45,load:30,invTemp:80}]}]},lease:{owner:secret,expiresAt:utc+10000},managerSessions:[{id:secret,credential:secret,expiresAt:utc+10000}],commands:[{id:'c1',plantId:'P3',type:'soc',status:'done',ok:true,owner:secret}],assistant:{scenarios:{},events:[{id:'e1',plantId:'P3',plantName:'山东济宁光储电站',type:'inverter-risk',status:'archived',title:'旧演练',summary:'模拟提醒',simUtc:utc,updatedAt:utc}]}};
const history={start:Date.parse('2026-10-01T00:00:00+08:00'),end:Date.parse('2026-11-01T00:00:00+08:00'),datasets:[{plantId:'P3',plantName:'山东济宁光储电站',month:'2026-10',daily:[{date:'2026-10-01',totals:{dayPv:100,dayRev:62},socMin:10,socMax:98},{date:'2026-10-02',totals:{dayPv:200,dayRev:124},socMin:20,socMax:90}],hourly:[{utc:Date.parse('2026-10-01T10:00:00+08:00'),date:'2026-10-01',hour:10,minutes:60,totals:{dayPv:25,dayRev:15.5},socEnd:50,invTempEnd:45,invTempMax:47},{utc:Date.parse('2026-10-01T11:00:00+08:00'),date:'2026-10-01',hour:11,minutes:60,totals:{dayPv:35,dayRev:21.7},socEnd:55}]}]};
const store={read:async k=>structuredClone(k==='workspace'?document:history)};
const query=async q=>(await queryWorkspace(store,q,{now:utc,origin:'http://solar.test'})).results[0].data;
test('history totals cover all filtered records despite pagination; hourly temperature gaps remain null',async()=>{
 const daily=await query({scope:'history',plantIds:['P3'],month:'2026-10',limit:1});assert.equal(daily.totalRows,2);assert.equal(daily.rows.length,1);assert.equal(daily.byPlant[0].totals.dayPv,300);assert.equal(daily.byPlant[0].totals.dayRev,186);assert.equal(daily.hasMore,true);
 const hourly=await query({scope:'history',from:'2026-10-01',to:'2026-10-01',resolution:'hourly'});assert.equal(hourly.rows[0].invTempEnd,45);assert.equal(hourly.rows[1].invTempEnd,null);assert.equal(hourly.byPlant[0].temperatureSummary.maxC,47);
 const aliases=await query({scope:'history',from:'2026-10-01',to:'2026-10-01',resolution:'hourly',startHour:10,endHour:11,fields:['pv','invTemp']});assert.equal(aliases.rows.length,2);assert.equal(aliases.rows[0].dayPv,25);assert.equal(aliases.rows[0].invTempEnd,45);
 const timed=await queryWorkspace(store,{queries:[{scope:'current'}]},{now:utc});assert.equal(timed.lastSnapshotAtBeijing,'2026-11-04 12:00:00 UTC+08:00');assert.equal(timed.stale,false);
 const empty=await query({scope:'history',from:'2027-01-01',resolution:'summary'});assert.equal(empty.byPlant[0].records,0);assert.equal(empty.totalRows,0);
 assert.match((await query({scope:'history',from:'2026-02-30'})).error,/日期/);
 const relative=await query({scope:'history',lastDays:30,resolution:'summary'});assert.equal(relative.requestedRange.from,'2026-10-06');assert.equal(relative.requestedRange.to,'2026-11-04');assert.equal(relative.byPlant[0].coverage.requestedCalendarDays,30);
 const yesterday=await query({scope:'history',dayOffset:-1,resolution:'summary'});assert.equal(yesterday.requestedRange.from,'2026-11-03');assert.equal(yesterday.requestedRange.to,'2026-11-03');
 const lastMonth=await query({scope:'history',monthOffset:-1,resolution:'summary'});assert.equal(lastMonth.requestedRange.from,'2026-10-01');assert.equal(lastMonth.requestedRange.to,'2026-10-31');
});
test('current data uses authoritative normal/drill telemetry and operations enforce manager access without secrets',async()=>{
 const current=await query({scope:'current'});assert.equal(current.plants[0].invTemp,41);assert.equal(current.plants[0].inverterThermal,null);
 assert.equal((await query({scope:'operations'})).requiresManager,true);
 const result=await queryWorkspace(store,{queries:[{scope:'operations'},{scope:'config'},{scope:'storage'},{scope:'reminders'},{scope:'samples'}]},{now:utc,manager:true});
 assert.equal(result.results[0].data.activeLoginSessionCount,1);assert.doesNotMatch(JSON.stringify(result),new RegExp(secret));assert.equal(result.results[3].data.rows[0].status,'archived');
 assert.ok((await query({scope:'config',plantIds:['missing']})).error);
});
test('chat selects server read tools then answers using retrieved history, not browser placeholders',async()=>{
 const calls=[];
 const api=createApi({now:()=>utc,fetchImpl:async(url,options)=>{
  const payload=JSON.parse(options.body);calls.push(payload);
  if(calls.length===1)return Response.json({choices:[{message:{role:'assistant',content:null,tool_calls:[{id:'query-1',type:'function',function:{name:'query_workspace',arguments:JSON.stringify({queries:[{scope:'history',plantIds:['P3'],month:'2026-10',resolution:'summary'}]})}}]}}]});
  return Response.json({choices:[{message:{role:'assistant',content:'300 kWh'},finish_reason:'stop'}]});
 }});
 const request=new Request('http://solar.test/api/workspace/chat',{method:'POST',body:JSON.stringify({messages:[{role:'system',content:'浏览器示意数据999999；'+secret},{role:'user',content:'济宁10月发电多少？'}],stream:false})});
 const response=await api(request,{DEEPSEEK_API_KEY:'provider-secret'},{workspaceStore:store});
 assert.equal(response.headers.get('X-Solar-Data-Source'),'server-query');assert.equal(calls.length,2);assert.doesNotMatch(JSON.stringify(calls),/999999|must-never-appear/);
 const tool=JSON.parse(calls[1].messages.find(m=>m.role==='tool').content);assert.equal(tool.results[0].data.byPlant[0].totals.dayPv,300);
 assert.equal((await response.json()).choices[0].message.content,'300 kWh');
});
