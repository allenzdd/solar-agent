import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
export function ensureWorkspaceSecrets(root) {
  const filename = path.join(root, '.env');
  let text = fs.existsSync(filename) ? fs.readFileSync(filename, 'utf8') : '';
  let changed = false;
  for (const key of ['MANAGER_TOKEN', 'APP_CONTROL_TOKEN']) {
    const current = process.env[key];
    if (current && !current.startsWith('replace_with_')) continue;
    const value = randomBytes(24).toString('base64url');
    process.env[key] = value;
    const expression = new RegExp('^' + key + '=.*$', 'm');
    text = expression.test(text) ? text.replace(expression, key + '=' + value) : text + '\n' + key + '=' + value + '\n';
    changed = true;
  }
  if (changed) fs.writeFileSync(filename, text, { mode: 0o600 });
}
