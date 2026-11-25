// Runtime-neutral tool loop. Never accepts executable tools from the browser.
export async function runAgentLoop({call,messages,tools,execute,signal,stream=false,maxSteps=8,maxCalls=24,maxTokens=4096}) {
 const history=structuredClone(messages), encoder=new TextEncoder();
 const stopped=(code,message,status=502)=>Object.assign(new Error(message),{code,status});
 async function run(emit=()=>{}) {
  const seen=new Map(); let count=0;
  for(let step=1;step<=maxSteps;step++) {
   signal.throwIfAborted();
   emit({agent:{type:'model_start',step}});
   const response=await call({messages:history,tools,tool_choice:step===1?{type:'function',function:{name:'query_workspace'}}:step===maxSteps||count>=maxCalls?'none':'auto',stream,max_tokens:maxTokens},signal);
   if(!response.ok){await response.body?.cancel();throw stopped('upstream_error','模型服务暂时不可用，请稍后重试',response.status===429?429:502);}
   let message, finish;
   if(stream) {
    const reader=response.body?.getReader();if(!reader)throw stopped('empty_response','模型未返回内容');
    const decoder=new TextDecoder(); let buffer='',content='',reasoning='',ended=false;const calls=[];
    function event(block){
     const data=block.split(/\r?\n/).filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n');
     if(!data)return;if(data==='[DONE]'){ended=true;return;}
     const p=JSON.parse(data);if(p.error)throw stopped('upstream_error','模型生成中断，请重试');
     const choice=p.choices?.[0];if(!choice)return;const d=choice.delta||{};
     if(choice.finish_reason)finish=choice.finish_reason;
     if(typeof d.content==='string'){content+=d.content;emit({choices:[{index:0,delta:{content:d.content}}]});}
     if(typeof d.reasoning_content==='string')reasoning+=d.reasoning_content;
     for(const c of d.tool_calls||[]){
      if(!Number.isInteger(c.index)||c.index<0||c.index>=6)throw stopped('invalid_tool_calls','模型工具调用格式无效');
      const target=calls[c.index]??={id:'',type:'function',function:{name:'',arguments:''}};
      if(c.id)target.id+=c.id;if(c.function?.name)target.function.name+=c.function.name;if(c.function?.arguments)target.function.arguments+=c.function.arguments;
      if(target.function.arguments.length>16000)throw stopped('invalid_tool_calls','查询参数过大');
     }
     if(content.length+reasoning.length>100000)throw stopped('response_too_large','模型返回内容过大');
    }
    try {
     while(!ended){signal.throwIfAborted();const {value,done}=await reader.read();buffer+=done?decoder.decode():decoder.decode(value,{stream:true});
      if(buffer.length>200000)throw stopped('response_too_large','模型返回内容过大');
      let boundary;while((boundary=/\r?\n\r?\n/.exec(buffer))){event(buffer.slice(0,boundary.index));buffer=buffer.slice(boundary.index+boundary[0].length);}
      if(done){if(buffer.trim())event(buffer);break;}
     }
     if(!ended||!finish)throw stopped('incomplete_stream','模型连接中断，请重试');
    }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
    message={role:'assistant',content:content||null,...(calls.length?{tool_calls:calls}:{}),...(reasoning?{reasoning_content:reasoning}:{})};
   }else{
    const payload=await response.json();message=payload.choices?.[0]?.message;finish=payload.choices?.[0]?.finish_reason;
   }
   if(!message||finish==='length')throw stopped('incomplete_response','模型响应不完整，请缩小查询范围后重试');
   const calls=message.tool_calls;
   if(!calls?.length){
    if(step===1)throw stopped('query_required','模型未执行电站数据查询，请重试');
    if(typeof message.content!=='string'||!message.content.trim())throw stopped('empty_response','模型未返回回答');
    emit({agent:{type:'completed',step,toolCalls:count}});
    return {choices:[{index:0,message:{role:'assistant',content:message.content},finish_reason:'stop'}],agent:{steps:step,toolCalls:count}};
   }
   if(!Array.isArray(calls)||calls.length>6||Array.from(calls).some(c=>!c||!c.id||typeof c.id!=='string')||new Set(calls.map(c=>c.id)).size!==calls.length)throw stopped('invalid_tool_calls','模型工具调用格式无效');
   history.push({role:'assistant',content:message.content||null,tool_calls:calls,...(typeof message.reasoning_content==='string'?{reasoning_content:message.reasoning_content}:{})});
   for(const tool of calls){
    signal.throwIfAborted();if(++count>maxCalls)throw stopped('tool_budget_exceeded','本次查询次数已达上限，请缩小问题范围',422);
    let result;const name=tool.function?.name;
    try{
     if(typeof tool.function?.arguments!=='string'||tool.function.arguments.length>16000)throw Error('查询参数无效');
     emit({agent:{type:'tool_start',step,name}});
     result=await execute(name,JSON.parse(tool.function.arguments));
    }catch{result={error:'工具或查询参数无效，请按工具定义修正。'};}
    const stable=v=>v&&typeof v==='object'?Array.isArray(v)?v.map(stable):Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
    let args;try{args=stable(JSON.parse(tool.function.arguments));}catch{args=tool.function?.arguments;}
    const key=JSON.stringify([name,args]), repeats=(seen.get(key)||0)+1;seen.set(key,repeats);
    if(repeats>=3)throw stopped('tool_loop_detected','检测到重复查询，已停止循环；请补充电站或日期条件',422);
    let content=JSON.stringify(result);
    if(content.length>100000)content=JSON.stringify({error:'查询结果过大，请减少电站、使用summary汇总或缩小limit后重试。'});
    history.push({role:'tool',tool_call_id:tool.id,content});
    if(JSON.stringify(history).length>600000)throw stopped('context_budget_exceeded','本次查询上下文过大，请缩小问题范围',422);
    emit({agent:{type:'tool_end',step,name}});
   }
  }
  throw stopped('step_limit_exceeded','本次分析已达步骤上限，请缩小查询范围',422);
 }
 if(!stream)return Response.json(await run(),{headers:{'Cache-Control':'no-store','X-Solar-Data-Source':'server-query'}});
 const controller=new AbortController();signal=AbortSignal.any([signal,controller.signal]);
 return new Response(new ReadableStream({
  async start(output){
   const emit=event=>{signal.throwIfAborted();output.enqueue(encoder.encode('data: '+JSON.stringify(event)+'\n\n'));};
   try{await run(emit);output.enqueue(encoder.encode('data: [DONE]\n\n'));output.close();}
   catch(cause){if(!controller.signal.aborted){try{output.enqueue(encoder.encode('data: '+JSON.stringify({error:{code:cause.code||'agent_failed',message:cause.name==='TimeoutError'?'分析超时，请缩小查询范围后重试':cause.code?cause.message:'分析中断，请重试'}})+'\n\n'));output.close();}catch{}}}
  },cancel(){controller.abort();}
 }),{headers:{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-store','X-Accel-Buffering':'no','X-Solar-Data-Source':'server-query','X-Content-Type-Options':'nosniff'}});
}
