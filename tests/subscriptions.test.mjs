import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const c=vm.createContext({});vm.runInContext(fs.readFileSync(new URL('../public/js/subscription-model.js',import.meta.url),'utf8'),c);const M=c.SubscriptionDemoModel;
test('natural language produces editable monthly and non-profit subscriptions without inventing contact information',()=>{
 const m=M.parse('每个月的月初三号，给我发上个月的运营报告，到我邮箱');assert.equal(m.kind,'monthly');assert.equal(m.day,3);assert.equal(m.time,'08:00');assert.equal(m.recipient,'');assert.ok(M.validate(m).some(e=>e.includes('邮箱')));
 const p=M.parse('如果连续三天不受益，给我发短信告诉我');assert.equal(p.kind,'profit');assert.equal(p.days,3);assert.equal(p.threshold,0);assert.equal(p.channel,'sms');assert.equal(p.recipient,'');
 const change=M.parse('改成每月5号下午3点，发到demo@example.com',m);assert.equal(change.day,5);assert.equal(change.time,'15:00');assert.equal(change.recipient,'demo@example.com');assert.equal(M.validate(change).length,0);
 assert.equal(M.parse('济宁今天发了多少电'),null);
});
test('monthly dates use Beijing calendar, handle year rollover and short months',()=>{
 const s={...M.defaults('monthly'),recipient:'demo@example.com'};
 assert.equal(M.format(M.nextRun(s,Date.parse('2026-11-04T12:00:00+08:00'))),'2026年12月3日 08:00');
 assert.equal(M.format(M.nextRun(s,Date.parse('2026-12-31T23:00:00+08:00'))),'2027年1月3日 08:00');
 assert.equal(M.format(M.nextRun({...s,day:31},Date.parse('2027-02-01T00:00:00+08:00'))),'2027年2月28日 08:00');
 assert.equal(M.monthBefore(Date.parse('2027-01-01T01:00:00+08:00')),'2026-12');
});
test('profit requires consecutive complete days; pauses and duplicate episodes suppress sends',()=>{
 const s={...M.defaults('profit'),recipient:'演示号码'},now=Date.parse('2026-11-04T12:00:00+08:00'),data=M.evidence(s,now);
 assert.equal(data.days[0].date,'2026-11-01');assert.equal(data.days.at(-1).date,'2026-11-03');assert.equal(M.profitMatch(s,data.days),true);
 assert.equal(M.profitMatch(s,data.days.map((d,i)=>({...d,revenue:i===1?1:d.revenue}))),false);
 assert.equal(M.profitMatch(s,data.days.map((d,i)=>({...d,complete:i!==1}))),false);
 assert.equal(M.profitMatch(s,data.days.map((d,i)=>({...d,date:i===1?'2026-10-30':d.date}))),false);
 assert.equal(M.shouldSend(s,{latched:false},data).send,true);assert.equal(M.shouldSend(s,{latched:true},data).send,false);assert.equal(M.shouldSend({...s,status:'paused'},{},data).send,false);
});
test('extended alert templates parse thresholds, duration and channel; invalid contacts cannot be saved',()=>{
 const heat=M.parse('如果逆变器温度超过75度持续5分钟，短信提醒我');assert.equal(heat.kind,'temperature');assert.equal(heat.threshold,75);assert.equal(heat.minutes,5);assert.equal(heat.channel,'sms');
 const offline=M.parse('设备离线超过30分钟给我站内提醒');assert.equal(offline.kind,'offline');assert.equal(offline.minutes,30);assert.equal(offline.channel,'inapp');assert.equal(M.validate(offline).length,0);
 assert.ok(M.validate({...heat,recipient:'123'}).length);assert.ok(M.validate({...M.defaults(),recipient:'bad-address'}).length);
});
