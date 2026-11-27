import fs from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'dist');
const webStyles = [
  'css/theme.css',
  'css/monitor.css',
  'css/reminders.css',
  'css/subscriptions.css',
  'css/strategies.css',
  'css/multimodal.css',
  'css/human-support.css',
  'css/health.css',
  'css/commissioning.css',
  'css/device-parameters.css',
  'css/ess-soc.css',
  'css/task-follow.css',
  'css/operations-ui.css',
  'css/owner-memory.css',
  'css/custom-skills.css',
  'css/design.css',
  'css/after-sales.css',
  'css/assistant.css',
  'css/desktop.css',
];
const webCss = webStyles.map(file => fs.readFileSync(path.join(root,'public',file),'utf8').replace(/\r\n/g,'\n')).join('\n');
fs.writeFileSync(path.join(root,'public/css/web-layout.css'),webCss);
const assets = {};
const types = { '.txt': 'text/plain; charset=utf-8', '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg' };
function collect(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink() || entry.name.startsWith('.')) throw new Error('Public assets must not contain symlinks or hidden files');
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) collect(filename);
    else {
      if (!types[path.extname(filename)]) throw new Error('Unsupported public asset: ' + filename);
      const key = '/' + path.relative(path.join(root, 'public'), filename).split(path.sep).join('/');
      const bytes = fs.readFileSync(filename);
      const etag = '"' + createHash('sha256').update(bytes).digest('hex') + '"';
      assets[key] = { type: types[path.extname(filename)], etag, body: bytes.toString('base64') };
    }
  }
}
collect(path.join(root, 'public'));
const querySource=fs.readFileSync(path.join(root,'server/workspace-query.mjs'),'utf8').replace("import {applyInverterDrill} from './inverter-drill.mjs';",'').replace("import {enrichEnergySnapshot} from './energy.mjs';",'').replace("import {applySeasonalShade} from './seasonal-shade.mjs';",'').replace("import {projectTargetSoc} from './target-soc.mjs';",'').replaceAll('export ','');
const queryBundle='const {queryWorkspace,workspaceTool}=(()=>{\n'+querySource+'\nreturn {queryWorkspace,workspaceTool};})();\n';
const targetSoc=fs.readFileSync(path.join(root,'server/target-soc.mjs'),'utf8').replaceAll('export ','');
const seasonalShade=fs.readFileSync(path.join(root,'server/seasonal-shade.mjs'),'utf8').replaceAll('export ','');
const agentLoop=fs.readFileSync(path.join(root,'server/agent-loop.mjs'),'utf8').replaceAll('export ','');
const afterSales=fs.readFileSync(path.join(root,'server/after-sales.mjs'),'utf8').replaceAll('export ','');
const stationData=fs.readFileSync(path.join(root,'server/station-data.mjs'),'utf8').replace("import {queryWorkspace,workspaceTool} from './workspace-query.mjs';",'').replace("import { afterSalesTools,lookupAfterSales } from './after-sales.mjs';",'').replaceAll('export ','');
const api=fs.readFileSync(path.join(root,'server/api.mjs'),'utf8').replace("import {queryWorkspace,workspaceTool} from './workspace-query.mjs';",'').replace("import {createManagerSessions} from './manager-auth.mjs';",'').replace("import {analyzeMedia} from './vision.mjs';",'').replace("import {runAgentLoop} from './agent-loop.mjs';",'').replace("import {stationTools,createStationToolExecutor} from './station-data.mjs';",'').replace('export function createApi','function createApi');
const vision=fs.readFileSync(path.join(root,'server/vision.mjs'),'utf8').replace("import {annotatedVideo,addIndicatorGuide} from './indicator-guide.mjs';",'').replace('export async function','async function');
const indicatorGuide=fs.readFileSync(path.join(root,'server/indicator-guide.mjs'),'utf8').replaceAll('export ','');
const inverterRiskSource = 'const inverterRisk = (() => {\n' + fs.readFileSync(path.join(root, 'server/inverter-risk.mjs'), 'utf8').replaceAll('export function ', 'function ') + '\nreturn inverterRisk;})();\n';
const reminders = fs.readFileSync(path.join(root, 'server/reminders.mjs'), 'utf8').replace("import { applyInverterDrill } from './inverter-drill.mjs';", '').replace("import { inverterRisk } from './inverter-risk.mjs';", '').replaceAll('export function ', 'function ');
const report = fs.readFileSync(path.join(root, 'server/report.mjs'), 'utf8').replaceAll('export function ', 'function ');
const energy = fs.readFileSync(path.join(root, 'server/energy.mjs'), 'utf8').replaceAll('export function ', 'function ');
const inverterDrill=fs.readFileSync(path.join(root,'server/inverter-drill.mjs'),'utf8').replaceAll('export function ', 'function ');
const managerAuth = fs.readFileSync(path.join(root,'server/manager-auth.mjs'),'utf8').replaceAll('export function ', 'function ');
const workspace = fs.readFileSync(path.join(root, 'server/workspace.mjs'), 'utf8').replace("import { applyInverterDrill } from './inverter-drill.mjs';", '').replace("import { createManagerSessions } from './manager-auth.mjs';", '').replace("import { evaluateReminders, reminderFeed, setReminderScenario, resetReminders } from './reminders.mjs';", '').replace("import { renderMonthlyReport } from './report.mjs';", '').replace("import { enrichEnergySnapshot } from './energy.mjs';", '').replace("import { handleStationData } from './station-data.mjs';",'').replace("import { intentEventFor,applySeasonalShade } from './seasonal-shade.mjs';",'').replace("import { savedTargetSoc,projectTargetSoc } from './target-soc.mjs';",'').replace("import { handleAfterSales } from './after-sales.mjs';",'').replaceAll('export function ', 'function ');
const worker = fs.readFileSync(path.join(root, 'worker/index.js'), 'utf8').replace("import { createApi } from '../server/api.mjs';", '').replace("import { createWorkspaceApi, createR2WorkspaceStore } from '../server/workspace.mjs';", '');
if (/^\s*import\s/m.test(api + workspace + worker + agentLoop + stationData)) throw new Error('Add new server dependencies to the build bundler before using imports');
// Only remove this checkout's generated dist directory, never source or neighboring paths.
if (path.dirname(output) !== root || path.basename(output) !== 'dist') throw new Error('Invalid build output path');
fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(path.join(output, 'server'), { recursive: true });
fs.mkdirSync(path.join(output, '.openai'), { recursive: true });
fs.writeFileSync(path.join(output, 'server/index.js'), 'const ASSETS = ' + JSON.stringify(assets) + ';\n' + inverterDrill + '\n' + inverterRiskSource + reminders + '\n' + report + '\n' + energy + '\n' + targetSoc + '\n' + seasonalShade + '\n' + queryBundle + afterSales + '\n' + stationData + '\n' + agentLoop + '\n' + indicatorGuide + '\n' + vision + '\n' + api + '\n' + managerAuth + '\n' + workspace + '\n' + worker);
fs.copyFileSync(path.join(root, '.openai/hosting.json'), path.join(output, '.openai/hosting.json'));
console.log('Built Worker with shared API and ' + Object.keys(assets).length + ' public assets');
