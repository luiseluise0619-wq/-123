"""Offline repository inventory; no imports/execution of the audited application.

Usage: python scripts/audit-repository.py [repository] [output.json]
LOC means physical text lines (including comments/blank lines) in source files.
Generated/vendor/data/docs are reported separately, never counted as source LOC.
"""
import ast
import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parents[1]
EXCLUDE = {'.git', 'node_modules', 'dist', '__pycache__', 'scratchpad'}
FILES = sorted(p for p in ROOT.rglob('*') if p.is_file() and not EXCLUDE.intersection(p.relative_to(ROOT).parts))
TEXT = {}
for p in FILES:
    try: TEXT[p.relative_to(ROOT).as_posix()] = p.read_text(encoding='utf-8')
    except UnicodeError: pass

# Literal references supplement explicit runtime/build knowledge. They are not proof of dead code.
imports = {}
for name, text in TEXT.items():
    if name.endswith('.py'):
        try:
            nodes = ast.walk(ast.parse(text))
            imports[name] = sorted({n.module for n in nodes if isinstance(n, ast.ImportFrom) and n.module})
        except SyntaxError:
            imports[name] = ['SYNTAX ERROR']
    elif name.endswith(('.js','.mjs')):
        imports[name] = sorted(set(re.findall(r'(?:from\s*|import\s*\()\s*[\'"]([^\'"]+)',text)))

workflow = '\n'.join(v for k,v in TEXT.items() if k.startswith('.github/workflows/'))
runtime_roots = {'zone_rent.json'}
records=[];hashes={}
for p in FILES:
    rel=p.relative_to(ROOT).as_posix(); text=TEXT.get(rel,''); ext=p.suffix
    if rel=='frontend/index.html': kind='generated'
    elif rel.startswith('frontend/vendor/') or rel in ['frontend/dc-runtime.js','frontend/doc-page.js']: kind='vendor'
    elif ext in {'.json','.geojson','.csv','.pkl','.parquet'}: kind='data'
    elif ext in {'.js','.mjs','.py','.html','.css','.ts'}: kind='source'
    else: kind='documentation/config/asset'
    if rel in ['frontend/vercel.json','verification.json','verification-syntax.json']:
        category,reason=4,'obsolete deployment config or historical verification snapshot (archived evidence)'
    elif rel.startswith('frontend/'):
        inside=rel[len('frontend/'):]
        if inside.startswith('screens/'):
            category,reason=2,'build-html ORDER / HTML source'
        elif inside.startswith(('logic/','vendor/','locales/','data/v3/')) or (p.parent==ROOT/'frontend' and (ext in {'.html','.js','.css','.ico','.txt'} or p.name in runtime_roots)):
            category,reason=1,'browser entry/script/data or runtime asset; reviewed deploy boundary'
        else:
            category,reason=2,'collector intermediate/reference data; excluded from runtime artifact'
    elif rel=='server.js' or rel.startswith('server/') or (rel.startswith('api/') and rel!='api/market.js') or rel in ['package.json','scripts/validate-data.mjs','THIRD-PARTY.md'] or rel.startswith('licenses/'):
        category,reason=1,'Node entry, explicit public handler/import dependency, validation or license'
    elif rel.startswith('scripts/') or rel.startswith('.github/') or rel.startswith('deploy/') or rel=='render.yaml':
        category,reason=2,'build, audit, collection workflow or deployment tooling'
    elif rel.startswith('backend/') and (p.name in workflow or rel=='backend/app/data/collectors/seoul_trdar_client.py' or p.name=='collect_util.py'):
        category,reason=2,'workflow command or imported data generation dependency'
    else:
        category,reason=3,'source-only development, experiments, tests or documentation; preserve'
    digest=hashlib.sha256(p.read_bytes()).hexdigest();hashes.setdefault(digest,[]).append(rel)
    refs=[name for name,src in TEXT.items() if name!=rel and (rel in src or (len(p.name)>8 and p.name in src))]
    records.append(dict(path=rel,category=category,reason=reason,kind=kind,bytes=p.stat().st_size,
                        lines=len(text.splitlines()),literalReferenceFiles=refs[:30],imports=imports.get(rel,[])))

source=[r for r in records if r['kind']=='source']
summary=dict(files=len(records),bytes=sum(r['bytes'] for r in records),sourceLOC=sum(r['lines'] for r in source),
    frontendSourceLOC=sum(r['lines'] for r in source if r['path'].startswith('frontend/')),
    nodeServerApiLOC=sum(r['lines'] for r in source if r['path']=='server.js' or r['path'].startswith(('server/','api/'))),
    pythonToolingLOC=sum(r['lines'] for r in source if r['path'].endswith('.py')),
    sourceTop10=sorted(source,key=lambda r:r['lines'],reverse=True)[:10],
    nonSource={k:dict(files=sum(r['kind']==k for r in records),bytes=sum(r['bytes'] for r in records if r['kind']==k),lines=sum(r['lines'] for r in records if r['kind']==k)) for k in ['generated','vendor','data','documentation/config/asset']})
result=dict(locDefinition='physical lines including blank lines and comments; source extensions only; excludes generated/vendor/data/docs',
    warning='Literal references are evidence only. Dynamic template/global binding and workflows require review; no deletion is inferred.',
    summary=summary,exactDuplicateGroups=[v for v in hashes.values() if len(v)>1],files=records)
output=Path(sys.argv[2]) if len(sys.argv)>2 else ROOT/'repository-inventory.json'
output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:v for k,v in summary.items() if k not in ['sourceTop10','nonSource']},ensure_ascii=False))
