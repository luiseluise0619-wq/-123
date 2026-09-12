import { readdir } from 'node:fs/promises';
import path from 'node:path';

export async function filesUnder(root, dir) {
  const files = [];
  for (const entry of await readdir(path.join(root, dir), {withFileTypes:true})) {
    const rel = path.posix.join(dir, entry.name);
    if (entry.isSymbolicLink()) throw new Error('Release must not contain symlinks: ' + rel);
    if (entry.isDirectory()) files.push(...await filesUnder(root, rel));
    else if (entry.isFile()) files.push(rel);
  }
  return files.sort();
}

// Reviewed runtime boundary. Collectors and their intermediate JSON stay in source.
export async function deploymentFiles(root) {
  const files = [
    'package.json', 'package-lock.json', 'server.js', 'scripts/validate-data.mjs','scripts/customer-purge.mjs',
    'deploy/customer-schema.sql', 'deploy/configure-integrations.sh', 'deploy/install-customer-admin.sh',
    'api/config.js', 'api/report.js', 'api/support.js', 'api/customer.js', 'api/integrations.js',
    'api/_origin.js', 'api/_request.js', 'api/_http.js', 'api/_err.js',
    'frontend/zone_rent.json', 'THIRD-PARTY.md',
  ];
  for (const dir of ['server','admin','frontend/vendor','frontend/locales','frontend/data/v3','licenses']) {
    files.push(...await filesUnder(root, dir));
  }
  for (const entry of await readdir(path.join(root, 'frontend'), {withFileTypes:true})) {
    if (entry.isFile() && /\.(?:html|js|css|ico|txt)$/.test(entry.name)) files.push('frontend/'+entry.name);
  }
  return [...new Set(files)].sort();
}
