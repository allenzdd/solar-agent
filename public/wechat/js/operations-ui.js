(function(){
  'use strict';
  const DAY=86400000,states=new Map(),bound=new WeakSet();
  const html=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=(value,d=1)=>value.toLocaleString('zh-CN',{maximumFractionDigits:d});
  function series(pid){
    const days=new Map();
    for(const record of globalThis.SolarHistory?.datasets||[]){
      if(record.plantId!==pid)continue;
      for(const day of record.daily||[]){
        if(day.complete!==true||!Number.isFinite(day.totals?.dayRev)||!Number.isFinite(day.totals?.dayPv))continue;
        const utc=Date.parse(day.date+'T00:00:00Z');
        if(Number.isFinite(utc))days.set(utc,{date:day.date,utc,revenue:day.totals.dayRev,energy:day.totals.dayPv});
      }
    }
    return [...days.values()].sort((a,b)=>a.utc-b.utc);
  }
  function period(rows,length){
    const end=rows.at(-1)?.utc;
    if(!Number.isFinite(end))return {days:[],previous:[],start:0,end:0};
    return {days:rows.filter(row=>row.utc>end-length*DAY),previous:rows.filter(row=>row.utc>end-2*length*DAY&&row.utc<=end-length*DAY),start:end-(length-1)*DAY,end};
  }
  const total=(rows,key)=>rows.reduce((sum,row)=>sum+row[key],0);
  function comparison(data,key,length){
    if(data.days.length!==length||data.previous.length!==length)return '上期数据不足';
    const base=total(data.previous,key),current=total(data.days,key);
    if(base===0)return current===0?'较上期持平':'上期为零';
    const change=(current-base)/Math.abs(base)*100;
    return '较前'+length+'天 '+(change>0?'↑ ':change<0?'↓ ':'')+num(Math.abs(change),1)+'%';
  }
  function graph(data,state,sym){
    const rows=data.days,key=state.metric,values=rows.map(row=>row[key]);
    const min=Math.min(0,...values),max=Math.max(1,...values);
    const span=max-min,top=max+span*.15,bottom=min<0?min-span*.08:0;
    const x=utc=>42+264*(utc-data.start)/Math.max(DAY,data.end-data.start);
    const y=value=>154-130*(value-bottom)/(top-bottom);
    let svg='<svg viewBox="0 0 320 188" class="oa-plot" role="slider" tabindex="0" aria-label="'+(key==='revenue'?'每日收益':'每日发电量')+'，使用左右方向键选择日期" aria-valuemin="1" aria-valuemax="'+rows.length+'" aria-valuenow="'+(state.index+1)+'" aria-valuetext="'+html(rows[state.index].date+' '+num(rows[state.index][key],2)+(key==='revenue'?sym:'kWh'))+'">';
    for(let i=0;i<4;i++){
      const value=bottom+(top-bottom)*i/3,py=y(value);
      svg+='<line x1="42" x2="306" y1="'+py+'" y2="'+py+'" class="oa-grid"/><text x="35" y="'+(py+3)+'" text-anchor="end" class="oa-axis">'+num(value,0)+'</text>';
    }
    const selected=rows[state.index],cx=x(selected.utc);
    svg+='<line x1="'+cx+'" x2="'+cx+'" y1="20" y2="154" class="oa-cross"/>';
    if(state.type==='bar'){
      const width=Math.min(22,180/state.length);
      rows.forEach((row,i)=>{const py=y(row[key]),zero=y(0);svg+='<rect x="'+(x(row.utc)-width/2)+'" y="'+Math.min(py,zero)+'" width="'+width+'" height="'+Math.max(1,Math.abs(zero-py))+'" rx="3" class="oa-bar '+(i===state.index?'chosen':'')+'"/>';});
    }else{
      let segments=[],part=[];
      rows.forEach((row,i)=>{if(i&&row.utc-rows[i-1].utc>DAY){segments.push(part);part=[];}part.push(row);});segments.push(part);
      for(const segment of segments){
        const path=segment.map((row,i)=>(i?'L':'M')+x(row.utc)+','+y(row[key])).join(' ');
        const first=segment[0],last=segment.at(-1);
        svg+='<path d="'+path+' L'+x(last.utc)+','+y(0)+' L'+x(first.utc)+','+y(0)+' Z" class="oa-area"/><path d="'+path+'" class="oa-line"/>';
      }
    }
    rows.forEach((row,i)=>{svg+='<circle cx="'+x(row.utc)+'" cy="'+y(row[key])+'" r="'+(i===state.index?5:3)+'" class="oa-point"/><rect x="'+(x(row.utc)-10)+'" y="15" width="20" height="142" fill="transparent" data-oa-point="'+i+'"><title>'+html(row.date+' · '+num(row[key],2)+' '+(key==='revenue'?sym:'kWh'))+'</title></rect>';});
    const indexes=[0,Math.floor((rows.length-1)/2),rows.length-1];
    for(const i of [...new Set(indexes)])svg+='<text x="'+x(rows[i].utc)+'" y="178" text-anchor="middle" class="oa-axis">'+rows[i].date.slice(5)+'</text>';
    return svg+'</svg>';
  }
  function paint(host,plant,state){
    const data=period(series(plant.id),state.length),rows=data.days;
    if(!rows.length){
      host.innerHTML='<div class="oa-empty">正在读取运营数据。历史仿真数据就绪后将自动展示。</div>';return;
    }
    state.index=Math.max(0,Math.min(state.index??rows.length-1,rows.length-1));
    const sym=plant.tariff?.cur||plant.tariff?.sym||'CNY',row=rows[state.index],rev=total(rows,'revenue'),energy=total(rows,'energy');
    const highest=rows.reduce((a,b)=>a.revenue>=b.revenue?a:b),lowest=rows.reduce((a,b)=>a.revenue<=b.revenue?a:b);
    const metric=state.metric==='revenue'?'收益':'发电量',unit=state.metric==='revenue'?sym:'kWh';
    const toggle=(key,value,label)=>'<button type="button" data-oa-'+key+'="'+value+'" aria-pressed="'+(String(state[key])===String(value))+'">'+label+'</button>';
    const notes=[
      ['最佳收益日',highest.date.slice(5)+' · '+num(highest.revenue,2)+' '+sym],
      ['低收益日',lowest.date.slice(5)+' · '+num(lowest.revenue,2)+' '+sym],
      ['发电收益密度',energy>0?num(rev/energy,3)+' '+sym+'/kWh':'暂无可计算发电量']
    ];
    host.innerHTML='<div class="oa-head"><span class="oa-kicker">✦ 小源运营洞察</span><span class="oa-source">历史仿真</span></div>'+
      '<div class="oa-title">近 '+state.length+' 天运营分析</div><div class="oa-sub">'+new Date(data.start).toISOString().slice(0,10)+' — '+new Date(data.end).toISOString().slice(0,10)+'</div>'+
      '<div class="oa-kpis"><button type="button" data-oa-metric="revenue" aria-pressed="'+(state.metric==='revenue')+'"><span>累计收益 · '+html(sym)+'</span><strong>'+num(rev,2)+'</strong><small>'+comparison(data,'revenue',state.length)+'</small></button>'+
      '<button type="button" data-oa-metric="energy" aria-pressed="'+(state.metric==='energy')+'"><span>发电量 · kWh</span><strong>'+num(energy,1)+'</strong><small>'+comparison(data,'energy',state.length)+'</small></button></div>'+
      '<div class="oa-toolbar"><strong>'+metric+'趋势</strong><div class="oa-switch">'+toggle('length',7,'7天')+toggle('length',14,'14天')+'</div><div class="oa-switch">'+toggle('type','line','折线')+toggle('type','bar','柱状')+'</div></div>'+
      '<div class="oa-selected" aria-live="polite"><span>'+row.date.slice(5)+' '+metric+'</span><strong>'+num(row[state.metric],2)+' <small>'+html(unit)+'</small></strong></div>'+
      graph(data,state,sym)+
      '<div class="oa-date-nav"><button type="button" data-oa-move="-1" aria-label="前一天" '+(state.index===0?'disabled':'')+'>‹</button><span>点选图表查看每日明细</span><button type="button" data-oa-move="1" aria-label="后一天" '+(state.index===rows.length-1?'disabled':'')+'>›</button></div>'+
      '<div class="oa-day-detail"><span>'+row.date+'<small>选中日期</small></span><span>'+num(row.revenue,2)+' '+html(sym)+'<small>当日收益</small></span><span>'+num(row.energy,1)+' kWh<small>当日发电</small></span></div>'+
      '<div class="oa-insights"><strong>运营观察</strong>'+notes.map(([title,note])=>'<div><span>'+title+'</span><b>'+html(note)+'</b></div>').join('')+'</div>'+
      '<details class="oa-table" '+(state.table?'open':'')+'><summary>查看每日数据</summary><div><table><thead><tr><th>日期</th><th>收益 '+html(sym)+'</th><th>发电 kWh</th></tr></thead><tbody>'+rows.map(item=>'<tr><td>'+item.date.slice(5)+'</td><td>'+num(item.revenue,2)+'</td><td>'+num(item.energy,1)+'</td></tr>').join('')+'</tbody></table></div></details>'+
      '<p class="oa-foot">最近 '+rows.length+' 个有记录的完整日，数据截至 '+rows.at(-1).date+'。'+(rows.length<state.length?'本区间存在缺失日期。':'')+'收益构成按历史记录汇总。</p>';
  }
  function render(host,plant){
    if(!plant)return;
    let state=states.get(plant.id);
    if(!state){state={length:7,metric:'revenue',type:'line',index:null,table:false};states.set(plant.id,state);}
    host._oaPlant=plant;
    const signature=[plant.id,globalThis.SolarHistory?.generatedAt,JSON.stringify(state),plant.tariff?.cur].join('|');
    if(host.dataset.oaSignature!==signature){paint(host,plant,state);host.dataset.oaSignature=signature;}
    if(bound.has(host))return;
    bound.add(host);
    function redraw(focus){
      state.table=!!host.querySelector('.oa-table')?.open;
      paint(host,host._oaPlant,state);
      host.dataset.oaSignature='';
      if(focus)host.querySelector(focus)?.focus({preventScroll:true});
    }
    host.addEventListener('click',event=>{
      const target=event.target.closest('button');
      if(!target||!host.contains(target))return;
      for(const key of ['metric','length','type']){
        const value=target.getAttribute('data-oa-'+key);
        if(value!==null){
          state[key]=key==='length'?Number(value):value;
          if(key==='length')state.index=null;
          redraw('[data-oa-'+key+'="'+value+'"]');return;
        }
      }
      const move=target.getAttribute('data-oa-move');
      if(move!==null){state.index+=Number(move);redraw('[data-oa-move="'+move+'"]');}
    });
    function select(event){
      const target=event.target.closest('[data-oa-point]');
      if(!target||!host.contains(target))return;
      const index=Number(target.dataset.oaPoint);
      if(state.index!==index){state.index=index;redraw();}
    }
    host.addEventListener('pointermove',event=>{if(event.pointerType==='mouse')select(event);});
    host.addEventListener('pointerdown',select);
    host.addEventListener('keydown',event=>{
      if(!event.target.matches('.oa-plot')||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
      event.preventDefault();
      const rows=period(series(host._oaPlant.id),state.length).days;
      state.index=event.key==='Home'?0:event.key==='End'?rows.length-1:Math.max(0,Math.min(rows.length-1,state.index+(event.key==='ArrowRight'?1:-1)));
      redraw('.oa-plot');
    });
  }
  globalThis.OperationsUI=Object.freeze({render,series,period,comparison});
})();
