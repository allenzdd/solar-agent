// Read-only after-sales sample provider. No manufacturer entitlement or carrier API is connected.
const serviceSource={type:'demo',label:'售后服务演示数据',notice:'未连接厂家质保系统或承运商平台，以下为固定演示记录。',sampleAsOf:'2026-11-18T09:30:00+08:00'};
const devices=[
 {sn:'DEMO-SZ-INV-001',plantName:'苏州仿真电站（演示设备）',model:'SUN2000-6KTL-L1',product:'SUN2000L',description:'太阳能光伏逆变器',shipmentCode:'DEMO-SHIP-20220920',bom:'DEMO-BOM-INV001',packageName:'PV Basic Warranty',startDate:'2022-09-20',endDate:'2032-09-19',region:'中国大陆（演示）'},
 {sn:'DEMO-SZ-ESS-001',plantName:'苏州仿真电站（演示设备）',model:'储能单元（示例型号）',product:'储能系统',description:'工商业储能单元',shipmentCode:'DEMO-SHIP-20211211',bom:'DEMO-BOM-ESS001',packageName:'储能基础服务包（示例）',startDate:'2021-12-11',endDate:'2026-12-10',region:'中国大陆（演示）'},
 {sn:'DEMO-SZ-INV-002',plantName:'苏州仿真电站（演示设备）',model:'并网逆变器（示例型号）',product:'光伏逆变器',description:'太阳能光伏逆变器',shipmentCode:'DEMO-SHIP-20201118',bom:'DEMO-BOM-INV002',packageName:'光伏基础服务包（示例）',startDate:'2020-11-18',endDate:'2025-11-17',region:'中国大陆（演示）'},
];
const orders=[
 {id:'DEMO-RMA-2026111801',serviceId:'DEMO-SR-2026111801',parentServiceId:'DEMO-SR-2026111701',sn:'DEMO-SZ-INV-001',part:'逆变器通信模块（演示备件）',quantity:1,serviceType:'备件先行',serviceStatus:'处理中',applicant:'张*（演示）',stage:'in_transit',carrier:'示例承运商',trackingNumber:'DEMO-WL-2026111801',recipient:'张*',phone:'138****0000',destination:'江苏省苏州市 · 演示地址',appliedAt:'2026-11-17T10:20:00+08:00',shippedAt:'2026-11-18T08:15:00+08:00',estimatedAt:'2026-11-19',signedAt:null,events:[{stage:'requested',at:'2026-11-17T10:20:00+08:00',text:'备件申请已登记'},{stage:'preparing',at:'2026-11-17T11:00:00+08:00',text:'仓库正在备货'},{stage:'awaiting_dispatch',at:'2026-11-17T16:30:00+08:00',text:'备件已完成出库准备'},{stage:'in_transit',at:'2026-11-18T08:15:00+08:00',text:'备件已发出，正在运往苏州服务站'}]},
 {id:'DEMO-RMA-2026111201',serviceId:'DEMO-SR-2026111201',parentServiceId:'DEMO-SR-2026111101',sn:'DEMO-SZ-INV-001',part:'数据采集器（演示备件）',quantity:1,serviceType:'备件先行',serviceStatus:'已关闭',applicant:'张*（演示）',stage:'delivered',carrier:'示例承运商',trackingNumber:'DEMO-WL-2026111201',recipient:'张*',phone:'138****0000',destination:'江苏省苏州市 · 演示地址',appliedAt:'2026-11-12T16:47:11+08:00',shippedAt:'2026-11-15T11:48:54+08:00',estimatedAt:'2026-11-16',signedAt:'2026-11-16T18:52:06+08:00',events:[{stage:'requested',at:'2026-11-12T16:47:11+08:00',text:'备件申请已登记'},{stage:'preparing',at:'2026-11-13T09:00:00+08:00',text:'备件已确认，仓库备货中'},{stage:'awaiting_dispatch',at:'2026-11-14T16:00:00+08:00',text:'已打包，等待出库'},{stage:'in_transit',at:'2026-11-15T11:48:54+08:00',text:'备件已发出'},{stage:'delivered',at:'2026-11-16T18:52:06+08:00',text:'收件人已签收'}]},
];
const serviceStages=[['requested','待申请'],['preparing','备货中'],['awaiting_dispatch','待出库'],['in_transit','运输中'],['delivered','已签收']];
function serviceKey(value){if(typeof value!=='string'||!value.trim()||value.trim().length>64||!/^[A-Za-z0-9-]+$/.test(value.trim()))throw Object.assign(new Error('请输入有效的 SN、服务单号或 RMA 单号（字母、数字或短横线，最多64位）'),{status:400});return value.trim().toUpperCase();}
export function lookupAfterSales(kind,value,now=Date.now()){
 const result={source:{...serviceSource},queriedAt:new Date(now).toISOString()};
 if(kind==='examples')return {...result,devices:devices.map(({sn,model,endDate})=>({sn,model,endDate})),orders:orders.map(({id,serviceId,sn,stage})=>({id,serviceId,sn,stage}))};
 const key=serviceKey(value);
 if(kind==='warranty'){
  const d=devices.find(d=>d.sn===key);if(!d)return {...result,found:false,query:key,device:null,message:'未查询到该 SN 的质保记录。请核对铭牌或联系人工客服；不能据此判断设备已过保。'};
  const today=new Date(now+8*3600000).toISOString().slice(0,10),remainingDays=Math.floor((Date.parse(d.endDate+'T00:00:00+08:00')-Date.parse(today+'T00:00:00+08:00'))/86400000),status=today<d.startDate?'not_started':remainingDays<0?'expired':remainingDays<=30?'expiring':'active';
  return {...result,found:true,query:key,device:{...d,status,statusLabel:({active:'在保',expiring:'即将到期',expired:'已过保',not_started:'服务未开始'})[status],remainingDays:Math.max(0,remainingDays),recommendation:status==='expired'?'建议联系人工客服，咨询检测、付费维修或可购买的服务方案。':status==='expiring'?'服务将在30天内到期，建议核对服务凭证，并向人工客服咨询续保条件。':status==='not_started'?'服务尚未开始，建议核对交付及服务激活信息。':'当前演示记录显示在保，可向人工客服咨询技术支持与服务申请。具体受理范围以正式服务合同及厂家核验为准。'}};
 }
 if(kind==='logistics')return {...result,query:key,found:orders.some(o=>[o.id,o.serviceId,o.parentServiceId,o.sn,o.trackingNumber].includes(key)),stages:serviceStages,orders:orders.filter(o=>[o.id,o.serviceId,o.parentServiceId,o.sn,o.trackingNumber].includes(key)).map(o=>({...o,events:o.events.map(e=>({...e}))}))};
 throw Object.assign(new Error('查询类型不存在'),{status:404});
}
export const afterSalesTools=[['query_device_warranty','按设备SN查询质保状态、服务包和起止日期。当前仅提供明确标记的演示记录；未知SN不可推断在保或过保。','sn'],['query_spare_parts_logistics','按设备SN、服务单或RMA单号查询备件单和物流进度。当前为固定演示数据，不能承诺真实到货时间。','query']].map(([name,description,key])=>({type:'function',function:{name,description,parameters:{type:'object',properties:{[key]:{type:'string'}},required:[key],additionalProperties:false}}}));
export async function handleAfterSales(request,now=Date.now()){
 const json=(data,status=200,headers={})=>Response.json(data,{status,headers:{'Cache-Control':'no-store',...headers}});
 if(request.method!=='GET')return json({error:{message:'仅支持GET查询'}},405,{Allow:'GET'});
 const url=new URL(request.url),kind=url.pathname.split('/').pop(),allowed=kind==='warranty'?'sn':kind==='logistics'?'query':null;
 try{if(!['examples','warranty','logistics'].includes(kind))throw Object.assign(new Error('接口不存在'),{status:404});for(const key of url.searchParams.keys())if(key!==allowed||url.searchParams.getAll(key).length!==1)throw Object.assign(new Error('不支持或重复的查询参数'),{status:400});return json(lookupAfterSales(kind,allowed?url.searchParams.get(allowed):null,now));}catch(e){return json({error:{message:e.message}},e.status||400);}
}
