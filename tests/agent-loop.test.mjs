import test from 'node:test';
import assert from 'node:assert/strict';
import {runAgentLoop} from '../server/agent-loop.mjs';
import {createApi} from '../server/api.mjs';
import {stationTools} from '../server/station-data.mjs';

const tool=(name,args,id='c1')=>({id,type:'function',function:{name,arguments:JSON.stringify(args)}});
const answer=content=>Response.json({choices:[{message:{role:'assistant',content},finish_reason:'stop'}]});
const planning=calls=>Response.json({choices:[{message:{role:'assistant',content:null,tool_calls:calls},finish_reason:'tool_calls'}]});
const messages=[{role:'user',content:'查找电站并分析温度告警'}];
const options={messages,tools:stationTools,signal:new AbortController().signal};

test('loop follows evidence across three calls, preserves conversation and returns model answer',async()=>{
 const calls=[],executions=[];
 const response=await runAgentLoop({...options,execute:async(name,args)=>{executions.push({name,args});return {temperature:42};},call:async payload=>{
  calls.push(structuredClone(payload));
  if(calls.length===1)return planning([tool('query_workspace',{queries:[{scope:'catalog'}]})]);
  if(calls.length===2)return planning([tool('get_plant_health',{plantIds:['P1']},'c2')]);
  return answer('温度42℃，请结合告警记录判断。');
 }});
 assert.equal(executions.length,2);assert.equal(calls[1].tool_choice,'auto');assert.equal(calls[2].messages.filter(m=>m.role==='tool').length,2);
 assert.deepEqual(calls[2].messages[0],messages[0]);assert.equal((await response.json()).agent.steps,3);
});

test('invalid tool arguments become model feedback and may be corrected',async()=>{
 let attempts=0;
 const response=await runAgentLoop({...options,execute:async()=>{if(attempts===1)throw Error('secret');return {plants:[]};},call:async payload=>{
  attempts++;if(attempts===1)return planning([tool('not_registered',{})]);
  if(attempts===2){assert.match(payload.messages.at(-1).content,/参数无效/);assert.doesNotMatch(payload.messages.at(-1).content,/secret/);return planning([tool('query_workspace',{queries:[{scope:'catalog'}]},'c2')]);}
  return answer('没有电站记录。');
 }});assert.equal((await response.json()).agent.toolCalls,2);
});

test('repeat detection, step/call limits, incomplete output and cancellation stop further inference',async()=>{
 const base={...options,execute:async()=>({value:1}),call:async()=>planning([tool('query_workspace',{})])};
 await assert.rejects(runAgentLoop(base),e=>e.code==='tool_loop_detected');
 await assert.rejects(runAgentLoop({...base,maxSteps:2}),e=>e.code==='step_limit_exceeded');
 await assert.rejects(runAgentLoop({...base,maxCalls:1}),e=>e.code==='tool_budget_exceeded');
 await assert.rejects(runAgentLoop({...base,call:async()=>Response.json({choices:[{message:{content:'partial'},finish_reason:'length'}]})}),e=>e.code==='incomplete_response');
 const abort=new AbortController();abort.abort();let called=false;
 await assert.rejects(runAgentLoop({...base,signal:abort.signal,call:()=>{called=true;}}),e=>e.name==='AbortError');assert.equal(called,false);
});

function sse(events){return new Response(events.map(e=>'data: '+(typeof e==='string'?e:JSON.stringify(e))+'\n\n').join(''),{headers:{'Content-Type':'text/event-stream'}});}
const delta=(value,finish_reason=null)=>({choices:[{delta:value,finish_reason}]});
test('SSE reassembles split tool arguments, emits final tokens before completion and hides tool arguments',async()=>{
 let count=0,finish;
 const response=await runAgentLoop({...options,stream:true,execute:async(name,args)=>{assert.equal(name,'query_workspace');assert.equal(args.queries[0].scope,'catalog');return {plants:[]};},call:async()=>{
  if(++count===1)return sse([delta({tool_calls:[{index:0,id:'c1',function:{name:'query_workspace',arguments:'{"queries":['}}]}),delta({tool_calls:[{index:0,function:{arguments:'{"scope":"catalog"}]}'}}]},'tool_calls'),'[DONE]']);
  return new Response(new ReadableStream({start(c){finish=c;c.enqueue(new TextEncoder().encode('data: '+JSON.stringify(delta({content:'没有电站'}))+'\n\n'));}}));
 }});
 const reader=response.body.getReader();let text='';
 while(!text.includes('没有电站'))text+=new TextDecoder().decode((await reader.read()).value);
 assert.equal(count,2);assert.doesNotMatch(text, /"arguments"/);
 finish.enqueue(new TextEncoder().encode('data: '+JSON.stringify(delta({},'stop'))+'\n\ndata: [DONE]\n\n'));finish.close();
 while(true){const r=await reader.read();if(r.done)break;text+=new TextDecoder().decode(r.value);}
 assert.match(text, /completed/);assert.match(text,/\[DONE\]/);
});

test('truncated provider stream emits an error without a successful completion',async()=>{
 const response=await runAgentLoop({...options,stream:true,execute:async()=>({}),call:async()=>sse([delta({content:'partial'})])});
 const text=await response.text();assert.match(text,/incomplete_stream/);assert.doesNotMatch(text,/\[DONE\]/);
});

test('cancelling the returned stream aborts the in-flight model request',async()=>{
 let modelSignal;
 const response=await runAgentLoop({...options,stream:true,execute:async()=>({}),call:async(_,signal)=>{
  modelSignal=signal;return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));
 }});
 await response.body.cancel();assert.equal(modelSignal.aborted,true);
});

test('workspace chat queries an empty catalog and never forwards browser system data',async()=>{
 let count=0;
 const api=createApi({fetchImpl:async(_,options)=>{
  const p=JSON.parse(options.body);assert.doesNotMatch(JSON.stringify(p),/FAKE_BROWSER_DATA/);
  return ++count===1?planning([tool('query_workspace',{queries:[{scope:'catalog'}]})]):answer('未保存电站数据。');
 }});
 const response=await api(new Request('https://solar.test/api/workspace/chat',{method:'POST',body:JSON.stringify({messages:[{role:'system',content:'FAKE_BROWSER_DATA'},{role:'user',content:'目前电站发电多少'}]})}),{DEEPSEEK_API_KEY:'test'},{workspaceStore:{read:async()=>null}});
 assert.equal(response.status,200);assert.equal(count,2);assert.match((await response.json()).choices[0].message.content,/未保存/);
});

test('workspace chat requires a configured authoritative store',async()=>{
 const api=createApi({fetchImpl:()=>{throw Error('must not call provider');}});
 const response=await api(new Request('https://solar.test/api/workspace/chat',{method:'POST',body:'{}'}),{DEEPSEEK_API_KEY:'test'});
 assert.equal(response.status,503);assert.equal((await response.json()).error.code,'workspace_not_configured');
});
