export const manualUrl='https://support.huawei.com/enterprise/zh/doc/EDOC1100087912/38c8b93c';
export const referenceVideoHash='213e289b7be758e592cda0df0e9bc45e90d34018060ca9032f380eb3052a4a98';
export function annotatedVideo(input){
 if(!Array.isArray(input.videoHashes)||!input.videoHashes.includes(referenceVideoHash))return null;
 return {source:'annotated-video',task:'indicator',answer:'第四个告警/维护指示灯红色常亮：按所提供的华为手册，逆变器出现重要告警。',observations:['已匹配你提供并标注的演示视频，第四灯为红色常亮。','PV连接灯、并网灯是否绿灯快闪未作标注，下面一次给出两种对应处理路径。'],lamps:[{name:'PV灯',state:'unknown',behavior:'unknown',note:'快闪状态未确认'},{name:'并网灯',state:'unknown',behavior:'unknown',note:'快闪状态未确认'},{name:'通信灯',state:'unknown',behavior:'unknown',note:'不作为本次告警分支判断依据'},{name:'告警灯',state:'red',behavior:'steady',note:'第四灯红色常亮（用户标注视频）'}],site:{verdict:'needs_measurement',reasons:[],hazards:[]}};
}
export function addIndicatorGuide(result){
 const alarm=result.lamps?.find(l=>l.name==='告警灯');
 if(alarm?.state!=='red')return result;
 const steady=alarm.behavior==='steady';
 return {...result,task:'indicator',guide:{title:steady?'第四灯红色常亮 · 重要告警':'第四灯红色 · 先按常亮条件说明',conclusion:steady?'逆变器出现重要告警。':'若第四灯为红色常亮，手册定义为重要告警；仅检测到红色时不能确认常亮或闪烁。',paths:[{title:'PV连接灯或并网灯为绿灯快闪',text:'按照 App 告警指示排查直流或交流环境类故障。'},{title:'PV连接灯和并网灯均不为绿灯快闪',text:'按照 App 告警指示进入部件更换或整机更换处理流程，由安装商或授权运维人员执行。'}],next:'先在 App 查看具体告警码与处理指引；无法确定快闪分支时，上述两条路径均保留，不直接判定需要更换。',sourceUrl:manualUrl,scope:'依据所提供手册的机型灯语，不自动套用于所有逆变器。'}};
}
