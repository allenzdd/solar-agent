(function(global){
  'use strict';
  const DAY=86400000, kinds=['monthly','profit','temperature','offline'];
  const titles={monthly:'运营报告自动推送',profit:'连续无收益提醒',temperature:'逆变器高温提醒',offline:'设备离线提醒'};
  function cn(s){if(/^\d+$/.test(s))return +s;const d={'零':0,'一':1,'二':2,'两':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9};if(s.includes('十')){const a=s.split('十');return (a[0]?d[a[0]]:1)*10+(a[1]?d[a[1]]:0);}return d[s];}
  const local=ms=>new Date(ms+8*3600000), iso=ms=>local(ms).toISOString().slice(0,10);
  function monthBefore(now){const d=local(now);return new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()-1,1)).toISOString().slice(0,7);}
  function nextRun(s,now){
    const d=local(now),[hh,mm]=s.time.split(':').map(Number);let y=d.getUTCFullYear(),m=d.getUTCMonth();
    if(s.kind==='monthly'){
      const at=(yy,mo)=>Date.UTC(yy,mo,Math.min(s.day,new Date(Date.UTC(yy,mo+1,0)).getUTCDate()),hh,mm)-8*3600000;
      let n=at(y,m);if(n<=now)n=at(y,m+1);return n;
    }
    let n=Date.UTC(y,m,d.getUTCDate(),hh,mm)-8*3600000;if(n<=now)n+=DAY;return n;
  }
  function format(ms){const d=local(ms),p=n=>String(n).padStart(2,'0');return `${d.getUTCFullYear()}年${d.getUTCMonth()+1}月${d.getUTCDate()}日 ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;}
  function defaults(kind='monthly'){return {kind,title:titles[kind],day:3,time:'08:00',scope:'all',channel:kind==='monthly'?'email':kind==='profit'?'sms':'inapp',recipient:'',days:3,threshold:kind==='temperature'?70:0,minutes:kind==='offline'?30:5,status:'active'};}
  function parse(text,base){
    const q=String(text||'');let kind=base?.kind;
    if(/连续|连着/.test(q)&&/不受益|不收益|无收益|没有收益|零收益|收益|亏损|不赚钱/.test(q))kind='profit';
    else if(/温度|高温|过热/.test(q)&&/提醒|短信|邮件|告诉|通知|订阅/.test(q))kind='temperature';
    else if(/离线|断连/.test(q)&&/提醒|短信|邮件|告诉|通知|订阅/.test(q))kind='offline';
    else if(/月报|运营报告|上个月.*报告/.test(q)&&/每月|每个月|月初|发送|邮箱|订阅|推送|邮件/.test(q))kind='monthly';
    if(!kind||!kinds.includes(kind))return null;
    const s={...defaults(kind),...(base?.kind===kind?base:{}),kind,title:titles[kind]};
    const day=/(?:每(?:个)?月(?:的)?(?:月初)?|月初)(?:第)?\s*([一二三四五六七八九十两\d]+)\s*(?:日|号)/.exec(q);if(day)s.day=cn(day[1]);
    const days=/(?:连续|连着)\s*([一二三四五六七八九十两\d]+)\s*(?:个)?(?:完整)?(?:自然)?天/.exec(q);if(days)s.days=cn(days[1]);
    const clock=/(\d{1,2})[:：](\d{2})/.exec(q);const clock2=/(上午|早上|下午|晚上|晚间)?\s*([一二三四五六七八九十两\d]+)点(半|\d{1,2}分?)?/.exec(q);
    if(clock)s.time=clock[1].padStart(2,'0')+':'+clock[2];else if(clock2){let h=cn(clock2[2]);if(/下午|晚上|晚间/.test(clock2[1]||'')&&h<12)h+=12;s.time=String(h).padStart(2,'0')+':'+(clock2[3]==='半'?'30':String(parseInt(clock2[3]||'0',10)).padStart(2,'0'));}
    const oldChannel=s.channel;
    if(/短信|手机号|手机号码/.test(q))s.channel='sms';else if(/邮箱|邮件/.test(q))s.channel='email';else if(/站内|小源里|App内/i.test(q))s.channel='inapp';
    if(oldChannel!==s.channel)s.recipient='';
    const email=/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.exec(q),phone=/(?:^|\D)(1[3-9]\d{9})(?!\d)/.exec(q);if(email&&s.channel==='email')s.recipient=email[0];if(phone&&s.channel==='sms')s.recipient=phone[1];
    const threshold=/(?:超过|高于|达到|大于|低于|不超过|≤|>=|>=|>)[\s]*(-?\d+(?:\.\d+)?)/.exec(q);if(threshold)s.threshold=+threshold[1];
    const minutes=/(?:连续|超过|持续|离线|断连)\s*([一二三四五六七八九十两\d]+)\s*分钟/.exec(q);if(minutes)s.minutes=cn(minutes[1]);
    return s;
  }
  function validate(s){
    const e=[];if(!kinds.includes(s.kind))e.push('请选择有效的订阅类型');
    if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(s.time))e.push('请选择有效时间');
    if(s.kind==='monthly'&&(!Number.isInteger(s.day)||s.day<1||s.day>31))e.push('执行日期应为1至31日');
    if(s.kind==='profit'&&(!Number.isInteger(s.days)||s.days<1||s.days>30))e.push('连续天数应为1至30天');
    if(['temperature','offline'].includes(s.kind)&&(!Number.isInteger(s.minutes)||s.minutes<1||s.minutes>1440))e.push('持续时长应为1至1440分钟');
    if(!Number.isFinite(s.threshold))e.push('阈值必须是数字');
    if(!['email','sms','inapp'].includes(s.channel))e.push('请选择发送方式');
    if(s.channel==='email'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.recipient||''))e.push('请填写接收邮箱，或使用演示地址');
    if(s.channel==='sms'&&s.recipient!=='演示号码'&&!/^1[3-9]\d{9}$/.test(s.recipient||''))e.push('请填写11位手机号，或使用演示号码');
    if((s.recipient||'').length>254)e.push('接收地址过长');return e;
  }
  function description(s){
    if(s.kind==='monthly')return `每月${s.day}日 ${s.time}，生成上一个自然月的运营报告`;
    if(s.kind==='profit')return `连续${s.days}个完整自然日收益≤${s.threshold}元，每日${s.time}检查`;
    if(s.kind==='temperature')return `逆变器温度≥${s.threshold}℃，持续${s.minutes}分钟`;
    return `设备连续离线${s.minutes}分钟`;
  }
  function mask(s){if(s.channel==='inapp')return '小源站内通知';if(s.recipient==='演示号码')return '演示号码';if(s.channel==='sms')return s.recipient.replace(/^(\d{3})\d{4}(\d{4})$/,'$1****$2');return s.recipient;}
  function signature(s){return JSON.stringify([s.kind,s.day,s.time,s.scope,s.channel,(s.recipient||'').toLowerCase(),s.days,s.threshold,s.minutes]);}
  function profitMatch(s,days){
    const rows=days.filter(d=>d.complete===true).sort((a,b)=>a.date.localeCompare(b.date)).slice(-s.days);if(rows.length<s.days)return false;
    return rows.every((r,i)=>Number.isFinite(r.revenue)&&r.revenue<=s.threshold&&(!i||Date.parse(r.date)-Date.parse(rows[i-1].date)===DAY));
  }
  function evidence(s,now){
    const midnight=Date.parse(iso(now)+'T00:00:00+08:00');
    if(s.kind==='profit')return {simulated:true,kind:'profit',days:Array.from({length:s.days},(_,i)=>({date:iso(midnight-(s.days-i)*DAY),complete:true,revenue:i%2?Math.min(0,s.threshold):Math.min(0,s.threshold)-18-i}))};
    if(s.kind==='temperature')return {simulated:true,kind:'temperature',temperature:s.threshold+2,durationMinutes:s.minutes,points:[s.threshold-18,s.threshold-12,s.threshold-6,s.threshold+1,s.threshold+2]};
    return {simulated:true,kind:'offline',durationMinutes:s.minutes};
  }
  function shouldSend(s,state,data){if(s.status!=='active')return {send:false,reason:'订阅未启用，请先启用再演示'};if(state.latched)return {send:false,reason:'本轮异常已经模拟提醒，恢复正常后才会再次提醒'};const match=s.kind==='profit'?profitMatch(s,data.days||[]):s.kind==='temperature'?data.temperature>=s.threshold&&data.durationMinutes>=s.minutes:data.durationMinutes>=s.minutes;return {send:!!match,reason:match?'条件已满足':'尚未满足订阅条件'};}
  global.SubscriptionDemoModel=Object.freeze({defaults,parse,validate,nextRun,format,monthBefore,description,mask,signature,profitMatch,evidence,shouldSend,titles,iso});
})(globalThis);
