(function (global) {
  'use strict';
  const shade = document.getElementById('chat-skill-sheet');
  const form = shade.querySelector('form');
  const fields = form.querySelector('.skill-fields');
  const preview = form.querySelector('.skill-query');
  const submit = form.querySelector('.skill-send');
  const closeButton = form.querySelector('.skill-close');
  let key, opener;
  let disabledSiblings = [];

  const goals = {
    backup: '停电备电', life: '电池寿命优先', profit: 'SOC 约束内收益优先', arbitrage: '谷充峰放'
  };
  function field(label, name, type, value, attrs = {}) {
    const wrapper = document.createElement('label');
    wrapper.textContent = label;
    const node = document.createElement(type === 'select' ? 'select' : 'input');
    node.name = name;
    node.required = true;
    if (type === 'select') {
      for (const [v, title] of value) node.add(new Option(title, v));
    } else {
      node.type = type;
      Object.assign(node, attrs);
      node.value = value;
    }
    wrapper.append(node);
    fields.append(wrapper);
    return node;
  }
  function chooseStation() {
    const stations = PLANTS.length ? PLANTS.map(p => [p.name,p.name]) : [['演示电站','演示电站']];
    const choice = field('电站', 'station', 'select', stations);
    if (stations.some(([name]) => name === xyScope)) choice.value = xyScope;
  }
  function setGoal(mode) {
    for (const button of fields.querySelectorAll('[data-goal]')) {
      button.setAttribute('aria-pressed', String(button.dataset.goal === mode));
    }
    fields.dataset.goal = mode;
    for (const input of fields.querySelectorAll('[data-mode]')) {
      input.disabled = mode !== input.dataset.mode;
      input.parentElement.hidden = input.disabled;
    }
    update();
  }
  function build(initial) {
    const d = global.SolarDesignModel.defaults;
    if (key === 'design') {
      field('项目位置', 'location', 'select', [[d.location,d.location]]);
      field('屋顶面积（㎡）','area','number',initial.area ?? d.area,{min:10,max:100000000,step:'any'});
      field('年用电量（度）','load','number',initial.annualLoad ?? d.annualLoad,{min:1,max:100000000000,step:'any'});
    } else if (key === 'report') {
      field('每月几号','day','number',3,{min:1,max:31,step:1});
      field('推送时间（北京时间）','time','time','08:00');
    } else {
      chooseStation();
      if (key === 'battery') {
        const group = document.createElement('div');
        group.className = 'skill-goals';
        group.setAttribute('role','group');
        group.setAttribute('aria-label','优化目标');
        for (const [mode,label] of Object.entries(goals)) {
          const button = document.createElement('button');
          button.type = 'button';
          button.dataset.goal = mode;
          button.textContent = label;
          button.onclick = () => setGoal(mode);
          group.append(button);
        }
        fields.append(group);
        field('停电开始（时）','start','number',10,{min:0,max:23,step:1}).dataset.mode = 'backup';
        field('恢复供电（时）','end','number',16,{min:1,max:24,step:1}).dataset.mode = 'backup';
        const defaults = global.StrategyDemoModel.defaults('profit');
        field('SOC 下限（%）','socMin','number',defaults.min,{min:0,max:100,step:0.1}).dataset.mode = 'profit';
        field('SOC 上限（%）','socMax','number',defaults.max,{min:0,max:100,step:0.1}).dataset.mode = 'profit';
        setGoal('profit');
      }
    }
  }
  function update() {
    const v = name => form.elements.namedItem(name).value;
    let query, hint;
    if (key === 'design') query = `请为${v('location')}的厂房生成光储定容报告，屋顶面积 ${v('area')} ㎡，年用电量 ${v('load')} 度。`;
    if (key === 'report') query = `请每月${v('day')}号 ${v('time')} 在小源里推送上月运营报告。`;
    if (key === 'health') query = `请对「${v('station')}」进行逆变器健康诊断。`;
    if (key === 'battery') {
      const mode = fields.dataset.goal;
      const end = form.elements.namedItem('end');
      end.setCustomValidity(mode === 'backup' && Number(v('end')) <= Number(v('start')) ? '恢复供电时间应晚于停电开始时间' : '');
      const upper = form.elements.namedItem('socMax');
      upper.setCustomValidity('');
      if (mode === 'profit') {
        hint = 'SOC 上下限须在 0%–100% 之间，至少相差 5 个百分点。';
        if (upper.valueAsNumber - form.elements.namedItem('socMin').valueAsNumber < 5) upper.setCustomValidity(hint);
      }
      const goal = {
        backup: `明天 ${v('start')}:00 至 ${v('end')}:00 停电，请生成重要负载备用电策略。`,
        life: '请生成电池寿命优先的充放电策略，减少深充深放。',
        profit: `请在 SOC ${v('socMin')}%–${v('socMax')}% 约束内，生成收益优先的充放电策略。`,
        arbitrage: '请生成谷充峰放策略，比较低谷充电和高峰放电的节费效果。'
      };
      query = `针对「${v('station')}」，${goal[mode]}`;
    }
    const valid = Array.from(form.elements).every(control => !control.willValidate || control.validity.valid);
    preview.textContent = valid ? query : hint || '请补全有效参数后发送。';
    submit.disabled = !valid;
  }
  function close() {
    shade.hidden = true;
    disabledSiblings.forEach(e => { e.inert = false; });
    disabledSiblings = [];
    if (opener?.isConnected) opener.focus();
  }
  function open(skill, initial = {}) {
    if (!shade.hidden) return;
    key = skill;
    opener = document.activeElement;
    fields.replaceChildren();
    form.querySelector('h2').textContent = welcomeSkills.find(([id]) => id === key)[1];
    build(initial);
    update();
    shade.hidden = false;
    disabledSiblings = Array.from(shade.parentElement.children).filter(e => e !== shade && !e.inert);
    disabledSiblings.forEach(e => { e.inert = true; });
    closeButton.focus();
  }
  form.addEventListener('input', update);
  form.addEventListener('change', update);
  form.addEventListener('submit', event => {
    event.preventDefault();
    update();
    if (submit.disabled || !canAskWelcome()) return;
    const query = preview.textContent;
    close();
    askAI(query);
  });
  closeButton.onclick = close;
  shade.onclick = event => { if (event.target === shade) close(); };
  shade.onkeydown = event => {
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    if (event.key !== 'Tab') return;
    const controls = [...form.querySelectorAll('button,input,select')].filter(el => !el.disabled && el.getClientRects().length);
    if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1).focus(); }
    else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0].focus(); }
  };
  global.ChatSkillSheet = { open };
})(globalThis);
