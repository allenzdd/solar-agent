import {queryWorkspace,workspaceTool} from './workspace-query.mjs';

import { afterSalesTools,lookupAfterSales } from './after-sales.mjs';
// One registry serves HTTP, tool definitions and API documentation.
export const stationEndpoints=[
 ['catalog','list_plants','catalog','电站目录和历史覆盖范围'],
 ['realtime','get_plant_realtime','current','实时快照、仿真时钟和数据新鲜度'],
 ['config','get_plant_config','config','电站配置和装机容量'],
 ['devices','get_plant_devices','devices','仿真虚拟设备清单及电站级遥测'],
 ['history','query_plant_history','history','按日期和分辨率查询历史与全量汇总'],
 ['samples','get_plant_samples','samples','有限近期功率与温度采样'],
 ['alarms','get_plant_alarms','alarms','仿真快照告警与提醒事件'],
 ['weather','get_plant_weather','weather','仿真云量及气象数据可用性，尚无真实天气预报'],
 ['tariffs','get_plant_tariffs','tariffs','电价配置与币种'],
 ['energy','get_plant_energy','energy','功率流、当日电量和收益'],
 ['health','get_plant_health','health','状态、温度、SOC与预警依据'],
 ['reports','get_plant_reports','reports','已保存月报和下载链接'],
 ['operations','get_plant_operations','operations','需管理鉴权的运行权和指令状态，只读'],
];
const querySchema=workspaceTool.function.parameters.properties.queries.items;
const parameters={...querySchema,properties:Object.fromEntries(Object.entries(querySchema.properties).filter(([key])=>key!=='scope')),required:[]};
export const stationTools=[workspaceTool,...afterSalesTools,...stationEndpoints.map(([,name,,description])=>({type:'function',function:{name,description:'只读查询服务器：'+description,parameters}}))];

export function validateDataArguments(value,schema){
 if(schema.type==='object'){
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('参数须为对象');
  if((schema.required||[]).some(k=>!Object.hasOwn(value,k)))throw Error('缺少必填参数');
  for(const [key,v] of Object.entries(value)){if(!Object.hasOwn(schema.properties,key))throw Error('未知参数：'+key);validateDataArguments(v,schema.properties[key]);}
 }else if(schema.type==='array'){
  if(!Array.isArray(value)||value.length<(schema.minItems??0)||value.length>(schema.maxItems??100))throw Error('数组长度或格式无效');
  value.forEach(v=>validateDataArguments(v,schema.items));
 }else{
  if(schema.type==='integer'&&(!Number.isInteger(value)||value<(schema.minimum??-Infinity)||value>(schema.maximum??Infinity)))throw Error('整数参数超出范围');
  if(schema.type==='string'&&(typeof value!=='string'||value.length>2000))throw Error('字符串参数无效');
  if(schema.enum&&!schema.enum.includes(value))throw Error('枚举参数无效');
 }
}
export function createStationToolExecutor(store,context={}){
 return async(name,args)=>{
  const tool=stationTools.find(t=>t.function.name===name);if(!tool)throw Error('工具不存在');
  validateDataArguments(args,tool.function.parameters);
  if(name==='query_device_warranty')return lookupAfterSales('warranty',args.sn,context.now??Date.now());
  if(name==='query_spare_parts_logistics')return lookupAfterSales('logistics',args.query,context.now??Date.now());
  const endpoint=stationEndpoints.find(e=>e[1]===name);
  return queryWorkspace(store,endpoint?{queries:[{...args,scope:endpoint[2]}]}:args,context);
 };
}

export function stationOpenApi(){
 const paths={};
 for(const [route,,scope,description] of stationEndpoints){
  const routePath=route==='catalog'?'/api/workspace/data/catalog':'/api/workspace/data/plants/{plantId}/'+route;
  paths[routePath]={get:{summary:description,parameters:[...(route==='catalog'?[]:[{name:'plantId',in:'path',required:true,schema:{type:'string'}}]),...Object.entries(parameters.properties).filter(([key])=>key!=='plantIds').map(([name,schema])=>({name,in:'query',schema,...(schema.type==='array'?{style:'form',explode:false}:{})}))],responses:{200:{description:'查询结果，含来源、时间、单位与缺失说明'},400:{description:'参数无效'},401:{description:'需要管理登录'},404:{description:'电站不存在'},503:{description:'存储不可用'}},'x-query-scope':scope}};
 }
 paths['/api/workspace/data/query']={post:{summary:'批量只读查询，最多6项',requestBody:{required:true,content:{'application/json':{schema:workspaceTool.function.parameters}}},responses:{200:{description:'每项独立结果，错误在results中返回'},400:{description:'参数无效'}}}};
 return {openapi:'3.1.0',info:{title:'光伏Agent电站数据接口',version:'1.0.0'},paths};
}

export async function handleStationData(request,store,context={}){
 const url=new URL(request.url),prefix='/api/workspace/data';
 const json=(value,status=200,headers={})=>Response.json(value,{status,headers:{'Cache-Control':'no-store',...headers}});
 const fail=(message,status=400)=>Object.assign(new Error(message),{status});
 try{
  if(url.pathname===prefix+'/openapi.json')return request.method==='GET'?json(stationOpenApi()):json({error:{message:'仅支持GET'}},405,{Allow:'GET'});
  const match=new RegExp('^'+prefix+'/plants/([^/]+)/([a-z]+)$').exec(url.pathname);
  const route=url.pathname===prefix+'/catalog'?'catalog':match?.[2];
  const endpoint=stationEndpoints.find(e=>e[0]===route),batch=url.pathname===prefix+'/query';
  if(!batch&&!endpoint)throw fail('接口不存在',404);
  const method=batch?'POST':'GET';if(request.method!==method)return json({error:{message:'请求方法无效'}},405,{Allow:method});
  if(!store)throw fail('共享存储尚未配置',503);
  let args;
  if(batch){
   const reader=request.body?.getReader();if(!reader)throw fail('缺少查询参数');
   let text='',size=0;const decoder=new TextDecoder();
   try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>16000){await reader.cancel();throw fail('查询参数过大',413);}text+=decoder.decode(value,{stream:true});}}finally{reader.releaseLock();}
   args=JSON.parse(text+decoder.decode());
   validateDataArguments(args,workspaceTool.function.parameters);
  }else{
   args={};for(const [key,value] of url.searchParams){
    const schema=parameters.properties[key];if(!schema||key==='plantIds')throw fail('不支持的参数：'+key);
    if(url.searchParams.getAll(key).length!==1)throw fail('参数不可重复：'+key);
    args[key]=schema.type==='integer'?Number(value):schema.type==='array'?value.split(','):value;
   }
   if(match)args.plantIds=[decodeURIComponent(match[1])];
   validateDataArguments(args,parameters);args={queries:[{...args,scope:endpoint[2]}]};
  }
  let result;try{result=await queryWorkspace(store,args,{...context,origin:url.origin});}catch{throw fail('电站数据服务暂时不可用',503);}
  if(!batch){const data=result.results?.[0]?.data;if(data?.requiresManager)throw fail('需要管理登录',401);if(data?.error)throw fail(data.error,data.unknown?404:400);}
  return json(result);
 }catch(cause){return json({error:{message:cause.status?cause.message:cause instanceof SyntaxError?'JSON格式无效':'查询参数或数据服务异常'}},cause.status||400);}
}
