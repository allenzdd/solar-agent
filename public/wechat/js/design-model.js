(function(g){
'use strict';
const moduleWatts = 580;
const inverterKw = 100;
const cabinetKw = 108;
const cabinetKwh = 241;
const defaults=Object.freeze({location:'上海青浦',area:10000,annualLoad:10000000,usable:65,density:200,moduleW:moduleWatts,yieldHours:1000,selfUse:95,retail:.65,exportPrice:.30,pvCost:3,om:1.5,storageCount:5,storageKwh:cabinetKwh,storageKw:cabinetKw,storageCost:1000,peak:.95,valley:.35,efficiency:90,dod:90,cycles:1,days:300});
const ranges={area:[10,1e8],annualLoad:[1,1e11],usable:[1,100],density:[50,300],moduleW:[100,1000],yieldHours:[100,2500],selfUse:[0,100],retail:[0,5],exportPrice:[0,5],pvCost:[.1,20],om:[0,20],storageCount:[0,10000],storageKwh:[1,10000],storageKw:[1,10000],storageCost:[1,10000],peak:[0,5],valley:[0,5],efficiency:[1,100],dod:[1,100],cycles:[0,3],days:[1,365]};
function validate(input){const p={...defaults,...input};p.location=String(p.location||'').trim();if(!p.location||p.location.length>60)throw Error('请填写有效项目位置');for(const[k,[min,max]]of Object.entries(ranges)){p[k]=Number(p[k]);if(!Number.isFinite(p[k])||p[k]<min||p[k]>max)throw Error(k+' 参数超出有效范围');}if(!Number.isInteger(p.storageCount))throw Error('储能柜数量应为整数');return p;}
function parse(q){const p={};const n='([\\d,.]+)\\s*(万|亿)?';const area=q.match(new RegExp(n+'\\s*(?:平方米|平米|平|㎡|m²|m2)','i'));const load=q.match(new RegExp('(?:年度?负[载荷]|年用电量?|年耗电|年度用电)\\s*(?:约|为|是|大约|[:：])?\\s*'+n+'\\s*(?:度|kwh|千瓦时)','i'));function num(m){return Number(m[1].replaceAll(',',''))*(m[2]==='万'?1e4:m[2]==='亿'?1e8:1);}if(area)p.area=num(area);if(load)p.annualLoad=num(load);if(/上海.*青浦|青浦/.test(q))p.location='上海青浦';return p;}
// Illustrative seasonal generation shares, paired with a constant daily factory load.
function estimateMonths(generation, annualLoad, selfUse) {
  const shares = [5, 6, 8, 9, 10, 9, 11, 11, 9, 9, 7, 6];
  const days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return shares.map((share, i) => {
    const pv = generation * share / 100;
    const load = annualLoad * days[i] / 365;
    const self = Math.min(pv * selfUse / 100, load);
    return {month: i + 1, pv, load, self, exported: pv - self, imported: load - self};
  });
}
function referenceEquipment(p, modules, invCount) {
  const panel = p.moduleW === moduleWatts ? {
    brand:'隆基', model:'LR5-72HTH-580M',
    source:'https://static.longi.com/Hi_MO_6_LR_5_72_HTH_580_600_M_V03_DG_d2232d806b.pdf'
  } : {model:'按输入规格选型'};
  const cabinet = p.storageKw === cabinetKw && p.storageKwh === cabinetKwh ? {
    brand:'华为', model:'LUNA2000-241-2S1-CN',
    source:'https://solar.huawei.com/cn/products/luna2000-215-series/specs/'
  } : {model:'按输入规格选型'};
  return [
    {name:'光伏组件', ...panel, spec:p.moduleW+' W', count:modules, unit:'块'},
    {name:'组串式逆变器', brand:'华为', model:'SUN2000-100KTL-M2', spec:inverterKw+' kW', count:invCount, unit:'台',
      source:'https://solar.huawei.com/dam/asset/view/4eb507396914425f8ae7ec16976a9fd6.pdf'},
    {name:'通信网关', brand:'华为', model:'SmartLogger3000A', spec:'站级数据采集', count:Math.ceil(invCount/80), unit:'台',
      source:'https://solar.huawei.com/en-GB/Solar/Home/Commercial'},
    {name:'组件优化器', spec:'常规组串方案未配置', count:0, unit:'台'},
    {name:'储能柜', ...cabinet, spec:p.storageKw+' kW / '+p.storageKwh+' kWh', count:p.storageCount, unit:'台', optional:true}
  ];
}
function calculate(input={}){const p=validate(input),usableArea=p.area*p.usable/100,modules=Math.floor(usableArea*p.density/p.moduleW),pvKw=modules*p.moduleW/1000,invCount=Math.ceil(pvKw/1.2/inverterKw),invKw=invCount*inverterKw,generation=pvKw*p.yieldHours,monthly=estimateMonths(generation,p.annualLoad,p.selfUse),selfKwh=Math.min(monthly.reduce((sum,m)=>sum+m.self,0),p.annualLoad,generation),exportKwh=generation-selfKwh,pvGross=selfKwh*p.retail+exportKwh*p.exportPrice,pvInvestment=pvKw*1000*p.pvCost,pvOm=pvInvestment*p.om/100,pvNet=pvGross-pvOm,storageKwh=p.storageCount*p.storageKwh,storageKw=p.storageCount*p.storageKw,storageDischarge=storageKwh*p.dod/100*p.cycles*p.days,storageCharge=storageDischarge/(p.efficiency/100),storageGross=storageDischarge*p.peak-storageCharge*p.valley,storageInvestment=storageKwh*p.storageCost,storageOm=storageInvestment*p.om/100,storageNet=storageGross-storageOm;return{p,monthly,equipment:referenceEquipment(p, modules, invCount),gridKwh:p.annualLoad-selfKwh,usableArea,modules,pvKw,invCount,invKw,generation,selfKwh,exportKwh,coverage:selfKwh/p.annualLoad*100,pvGross,pvInvestment,pvOm,pvNet,pvPayback:pvNet>0?pvInvestment/pvNet:null,storageKwh,storageKw,storageDischarge,storageCharge,storageGross,storageInvestment,storageOm,storageNet,storagePayback:storageNet>0?storageInvestment/storageNet:null,totalInvestment:pvInvestment+storageInvestment,totalNet:pvNet+storageNet,loadAverage:p.annualLoad/8760};}
g.SolarDesignModel=Object.freeze({defaults,validate,parse,calculate});
})(globalThis);
