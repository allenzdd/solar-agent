// Model UI and conversation lifecycle. Provider configuration stays on the server.
let generating = false, abortCtl = null, lastAsk = '';
let convoId = newConvoId();
const convo = { history: [] };
let modelConfig = { model: 'deepseek-flash', configured: false };
function newConvoId() { return globalThis.crypto?.randomUUID?.() || 'c-' + Date.now() + '-' + Math.random().toString(16).slice(2); }
function setNote(state) {
  const note = document.getElementById('xy-note'); if (!note) return;
  note.textContent = state === 'connecting' ? '正在连接模型服务…' : state === 'online' ? modelConfig.model + ' · 内容由AI生成，仅供参考' : '模型服务未连接，请检查后端配置';
}
function setModelLabel() {
  for (const id of ['xy-model-name', 'set-llm-val', 'configured-model']) { const el = document.getElementById(id); if (el) el.textContent = modelConfig.model; }
}
async function initializeAI() {
  setNote('connecting');
  try { for (const key of ['xy_ds_key', 'xy_ds_model', 'xy_source']) localStorage.removeItem(key); } catch {}
  try { modelConfig = await SolarApi.config(); setNote(modelConfig.configured ? 'online' : 'offline'); } catch { setNote('offline'); }
  setModelLabel();
}
function openSetPage() { document.getElementById('page-settings')?.classList.add('open'); setModelLabel(); }
function closeSetPage() { document.getElementById('page-settings')?.classList.remove('open'); }
function cycleModel() { openSettings(); }
function openSettings() {
  setModelLabel(); setSheetStatus(''); document.getElementById('sheet-mask').classList.add('on'); document.getElementById('sheet').classList.add('on');
}
function closeSettings() { document.getElementById('sheet-mask').classList.remove('on'); document.getElementById('sheet').classList.remove('on'); }
function setSheetStatus(message, ok) { const el = document.getElementById('sheet-status'); if (el) { el.textContent = message || ''; el.style.color = ok ? '#30d158' : '#8e8e93'; } }
async function testModelConnection() {
  setSheetStatus('正在测试…');
  try {
    await SolarApi.chat({ messages: [{ role: 'user', content: '请只回复：连接成功' }], stream: false, maxTokens: 32 });
    await initializeAI(); setSheetStatus(modelConfig.model + ' 连接成功', true);
  } catch (cause) { setSheetStatus(cause.message); }
}
function attachRetry(row, question, images) {
  const retry = document.createElement('button'); retry.type = 'button'; retry.className = 'retry'; retry.textContent = '重试';
  retry.onclick = function () { retry.remove(); sendRetry(question, images); }; row.querySelector('.bubble').appendChild(retry);
}
async function askModel(question, images) {
  if (generating) return;
  const started = performance.now();
  const row = addMsg('ai', '', true), controller = new AbortController(), conversation = convoId;
  abortCtl = controller; setGenerating(true);
  let text = '', dataSource = '';
  try {
    text = await SolarApi.chat({ messages: buildMessages(question, images), signal: controller.signal, onSource(value){dataSource=value;}, onAgentEvent(event){if(convoId!==conversation)return;const note=document.getElementById('xy-note');if(note)note.textContent=event.type==='tool_start'?'正在查询电站数据…':event.type==='completed'?'电站数据分析完成':'正在分析 · 第 '+event.step+' 步';}, onDelta(value) { text = value; if (convoId === conversation) setBubbleText(row, value); } });
    if (convoId !== conversation) return;
    if(dataSource==='server-query'){const source=document.createElement('small');source.className='xy-query-source';source.textContent='已查询服务器保存的电站数据';row.querySelector('.bubble').append(source);}
    if (!text) setBubbleText(row, '（模型未返回内容，请重试）');
    else { showAnswerTime(row, started); convo.history.push({ role: 'user', content: question }, { role: 'assistant', content: text }); globalThis.HumanSupportDemo?.afterAnswer(question,text); }
  } catch (cause) {
    if (convoId !== conversation) return;
    if (cause.name === 'AbortError') {
      setBubbleText(row, (text || '（已停止生成）') + (text ? '\n\n[已停止]' : ''));
      if (text) convo.history.push({ role: 'user', content: question }, { role: 'assistant', content: text });
    } else { setBubbleText(row, (text ? text + '\n\n' : '') + '⚠ ' + cause.message); attachRetry(row, question, images); globalThis.HumanSupportDemo?.afterFailure(question); }
  } finally { if (abortCtl === controller) { setGenerating(false); abortCtl = null; setNote(modelConfig.configured?'online':'offline'); } }
}
