"""Explicit gated operator runner; never publishes content or changes availability."""
import argparse
import json
import os
import subprocess
import sys
from pathlib import Path
sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent / 'lib'))
from quran_import import ROOT, Importer, read, canonical, select, verify_policy, verify_reference_manifest, sha, atomic, raw_json
BATCHES = {'A':[29], 'B':[28,27,26], 'C':[25,24,23,22,21], 'D':list(range(20,10,-1)), 'E':list(range(10,0,-1))}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--batch', required=True, choices=BATCHES)
    parser.add_argument('--prepare', action='store_true')
    parser.add_argument('--upload', action='store_true')
    parser.add_argument('--policy', type=Path)
    parser.add_argument('--reference-manifest', type=Path)
    parser.add_argument('--reference-sha256')
    parser.add_argument('--concurrency', type=int, default=4)
    parser.add_argument('--recover', action='store_true')
    args = parser.parse_args()
    catalog = read(ROOT/'supabase/functions/_shared/quran-catalog.json')
    refs = canonical(catalog)
    planned = [dict(juz=j,first=(keys:=select(refs,juz=[j]))[0],last=keys[-1],ayahs=len(keys)) for j in BATCHES[args.batch]]
    if not args.prepare:
        if args.upload:
            parser.error('--upload also requires --prepare and all approval inputs')
        print(json.dumps(dict(mode='dry-run',batch=args.batch,juzs=planned,network=False,writes=False,publication='not-executed'),indent=2))
        return
    if not args.policy or not args.reference_manifest or not args.reference_sha256:
        parser.error('Blocked: provide --policy, --reference-manifest, --reference-sha256 after completing docs/quran-import-pipeline.md approvals')
    policy = read(args.policy)
    raw = args.reference_manifest.read_bytes()
    if sha(raw) != args.reference_sha256:
        raise ValueError('Independent manifest SHA mismatch')
    independent = json.loads(raw)
    verify_policy(policy)
    verify_reference_manifest(independent, refs)
    if args.upload and not all(os.environ.get(k) for k in ('SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY')):
        raise ValueError('Staging blocked: SUPABASE_URL and secure backend credential required; never paste a secret in chat')
    path = ROOT/'.quran-private/staging-attempts.json'
    journal = read(path) if path.exists() else dict(schemaVersion=1,attempts=[])
    if journal.get('schemaVersion') != 1 or not isinstance(journal.get('attempts'),list):
        raise ValueError('Malformed staging journal: preserve for recovery')
    importer = Importer(ROOT/'.quran-private',catalog)
    for row in planned:
        key = select(refs,juz=[row['juz']])
        attempt = dict(juz=row['juz'],status='started',releaseId=None)
        journal['attempts'].append(attempt)
        atomic(path,raw_json(journal))
        try:
            release = importer.prepare(key,policy,independent,workers=args.concurrency,recover=args.recover)
            subprocess.run(['node',str(ROOT/'scripts/validate-quran-release.mjs'),'--release',str(release)],check=True)
            attempt.update(status='local-validated',releaseId=release.name)
            atomic(path,raw_json(journal))
            if args.upload:
                subprocess.run(['node',str(ROOT/'scripts/upload-quran-content.mjs'),'--release',str(release),'--upload'],check=True)
                attempt['status']='storage-verified'
                atomic(path,raw_json(journal))
        except Exception:
            attempt.update(status='failed',reason='Preparation, independent validation or storage verification failed; inspect the private candidate reports and retry the same batch. No publication performed.')
            atomic(path,raw_json(journal))
            raise
    print('Batch completed only through '+('private storage verification' if args.upload else 'local validation')+'. Edge authorization, desktop/mobile checks and publication remain pending.')


if __name__ == '__main__':
    main()
