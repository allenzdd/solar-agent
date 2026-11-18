import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const css=fs.readFileSync(new URL('../public/css/manager-light.css',import.meta.url),'utf8');
const vars=Object.fromEntries([...css.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/g)].map(m=>[m[1],m[2]]));
function luminance(hex){const rgb=hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;}
function contrast(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
test('light text, captions, status labels and plot numbers exceed 4.5:1 on every management surface',()=>{
  for(const role of ['text','text-body','text-secondary','muted','subtle','accent-text','green','amber','red','sim-plot-text','sim-plot-label','sim-pv','sim-load','sim-bat','sim-grid','sim-revenue']){
    for(const surface of ['page','card','panel','raised','selected','sim-flow-center'])assert.ok(contrast(vars[role],vars[surface])>=4.5,`${role} on ${surface}: ${contrast(vars[role],vars[surface]).toFixed(2)}`);
  }
  assert.ok(contrast('#ffffff',vars.accent)>=4.5);assert.ok(contrast(vars.muted,'#e8edf3')>=4.5);
  for(const [color,bg] of [[vars.green,'#e9f6ef'],[vars.amber,'#fff2db']])assert.ok(contrast(color,bg)>=4.5);
});
test('light changes are scoped to management and load after existing styles',()=>{
  const page=fs.readFileSync(new URL('../public/simulator.html',import.meta.url),'utf8'),app=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
  assert.ok(page.includes('<body class="sim-manager">'));assert.ok(page.indexOf('css/manager-light.css')>page.indexOf('css/manager.css'));assert.equal(app.includes('css/manager-light.css'),false);
  const selectors=[...css.matchAll(/([^{}]+)\{/g)].map(m=>m[1].replace(/\/\*[\s\S]*?\*\//g,'').trim()).filter(s=>!s.startsWith('@'));
  for(const selector of selectors){assert.ok(selector.includes('[data-theme="light"]'),selector);assert.ok(selector.includes('.sim-manager'),selector);}
});
test('generated flow and chart SVGs use theme colors with original dark fallbacks',()=>{
  const source=fs.readFileSync(new URL('../public/js/simulator.js',import.meta.url),'utf8');
  const p={cfg:{invKw:100},pv:34,load:40,bat:-6,grid:12,soc:55,hist:[{pv:20,load:40,bat:0,grid:20},{pv:34,load:40,bat:-6,grid:12}]};
  const c=vm.createContext({SIM:p});vm.runInContext(source.slice(source.indexOf('const FLOW_ICON ='),source.indexOf('function esc(s)')),c);
  const flow=c.simFlow(),plot=c.simChartSVG();
  for(const color of ['sim-flow-node','sim-flow-center','sim-plot-text','sim-plot-label','sim-pv','sim-load','sim-bat','sim-grid'])assert.ok(flow.includes('var(--'+color),color);
  assert.equal(/fill="#(?:151922|0f1320|fff)"/.test(flow),false);assert.equal(flow.includes('NaN'),false);
  for(const color of ['sim-plot-grid','sim-plot-label','sim-pv','sim-load','sim-bat','sim-grid'])assert.ok(plot.includes('var(--'+color),color);
  assert.ok(flow.includes('var(--sim-flow-node,#151922)'));assert.ok(flow.includes('var(--sim-plot-text,#fff)'));
});
