import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
for (const args of [
  ['scripts/build.mjs'],
  ['--test','tests/design.test.mjs','tests/after-sales.test.mjs'],
  ['--test','tests/target-soc-server.test.mjs'],
  ['--test','tests/ess-soc.test.mjs'],
  ['--test','tests/seasonal-shade.test.mjs'],
  ['--test','tests/intent-awareness.test.mjs'],
  ['--test','tests/strategy-control.test.mjs','tests/strategy-ui.test.mjs'],
  ['--test','tests/agent-loop.test.mjs','tests/station-data.test.mjs','tests/extend-history.test.mjs'],
  ['--test','tests/vision.test.mjs'],
  ['--test','tests/owner-memory.test.mjs'],
  ['--test','tests/custom-skills.test.mjs'],
  ['--test','tests/commissioning.test.mjs'],
  ['--test','tests/manager-light.test.mjs'],
  ['--test','tests/manager-sync.test.mjs'],
  ['--test', 'tests/api.test.mjs', 'tests/client.test.mjs', 'tests/site.test.mjs', 'tests/worker.test.mjs', 'tests/workspace.test.mjs', 'tests/reminders.test.mjs', 'tests/history.test.mjs', 'tests/energy.test.mjs', 'tests/inverter.test.mjs', 'tests/inverter-risk.test.mjs', 'tests/manager-auth.test.mjs', 'tests/inverter-drill.test.mjs', 'tests/workspace-query.test.mjs', 'tests/subscriptions.test.mjs', 'tests/strategies.test.mjs'],
]) {
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
