(function(global){
 'use strict';
 function bounds(plant){return {min:Math.max(0,Math.ceil(plant?.socMin??0)),max:Math.min(100,Math.floor(plant?.socMax??100))};}
 function recommended(plant){const b=bounds(plant);return Math.max(b.min,Math.min(b.max,85));}
 function validate(draft,plant){const b=bounds(plant);if(!['stop','charge','discharge'].includes(draft.direction))return '请选择有效的充放电方式';if(!Number.isInteger(draft.target)||draft.target<b.min||draft.target>b.max)return '目标 SOC 应为 '+b.min+'%–'+b.max+'% 范围内的整数';return '';}
 function advice(draft,plant){if(draft.target!==100)return null;return {recommended:recommended(plant),title:'目标 SOC 100%，建议日常留一点余量',summary:'长期维持满电可能增加电池老化压力。日常可先考虑 '+recommended(plant)+'%，备电或厂家校准需求另行评估。',bounds:bounds(plant)};}
 global.EssSocModel=Object.freeze({bounds,recommended,validate,advice});
})(globalThis);
