import { mkdir, copyFile, readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { deploymentFiles } from './deploy-files.mjs';
import { build } from './build-html.mjs';
import { buildAssets, BUNDLE_PATH } from './build-assets.mjs';
import { validateData } from './validate-data.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
export async function buildDeployment(destination) {
  const dest = path.resolve(destination);
  // Never overwrite a source checkout, existing release, or external arbitrary tree.
  await mkdir(dest, {recursive:true});
  if ((await readdir(dest)).length) throw new Error('Choose an empty release directory: ' + dest);
  const html = await readFile(path.join(ROOT, 'frontend/index.html'), 'utf8');
  if (html !== build()) throw new Error('Run npm run build:html first');
  if (await readFile(BUNDLE_PATH,'utf8') !== buildAssets()) throw new Error('Run npm run build:html first');
  validateData(path.join(ROOT, 'frontend/data/v3'));
  const manifest = {};
  for (const rel of await deploymentFiles(ROOT)) {
    const from = path.join(ROOT, rel), to = path.join(dest, rel);
    await mkdir(path.dirname(to), {recursive:true});
    await copyFile(from, to);
    if (rel === 'package.json') {
      const pkg = JSON.parse(await readFile(to, 'utf8'));
      pkg.scripts = {start:'node server.js', 'check:data':'node scripts/validate-data.mjs'};
      await writeFile(to, JSON.stringify(pkg,null,2)+'\n');
    }
    const bytes = await readFile(to);
    manifest[rel] = {bytes:bytes.length, sha256:createHash('sha256').update(bytes).digest('hex')};
  }
  await writeFile(path.join(dest, 'DEPLOY-MANIFEST.json'), JSON.stringify(manifest,null,2)+'\n');
  return {directory:dest, files:Object.keys(manifest).length, bytes:Object.values(manifest).reduce((sum,v)=>sum+v.bytes,0)};
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  console.log(JSON.stringify(await buildDeployment(process.argv[2] || path.join(ROOT,'dist')),null,2));
}
