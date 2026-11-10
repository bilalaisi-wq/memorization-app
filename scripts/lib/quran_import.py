"""Operator-only private release preparation. No runtime availability mutations."""
import argparse
import concurrent.futures
import hashlib
import html
import json
import os
import re
import socket
import subprocess
import threading
import unicodedata
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
API = 'https://api.quran.com/api/v4/'
EDITION = 'quran-com-v4-uthmani'
REQUIRED_RIGHTS = ('arabic', 'translation', 'transliteration', 'wordMeanings', 'fullAyahAudio')


def sha(data):
    return hashlib.sha256(data).hexdigest()


def raw_json(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode()


def atomic(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(path.name + '.partial')
    temp.write_bytes(data)
    os.replace(temp, path)


def read(path):
    return json.loads(Path(path).read_bytes())


def canonical(catalog):
    refs = {}
    for c in catalog['chapters']:
        for a in range(1, c['verseCount'] + 1):
            ranges = [r for r in c['ranges'] if r['first'] <= a <= r['last']]
            if len(ranges) != 1:
                raise ValueError('Invalid chapter mapping')
            refs[f"{c['id']}:{a}"] = ranges[0]['juz']
    independent = {}
    for j in catalog['juzs']:
        count = 0
        for r in j['ranges']:
            for a in range(r['first'], r['last'] + 1):
                key = f"{r['surah']}:{a}"
                if key in independent:
                    raise ValueError('Overlapping juz')
                independent[key] = j['id']
                count += 1
        if count != j['verseCount']:
            raise ValueError('Juz count mismatch')
    if refs != independent or len(refs) != 6236 or len(catalog['chapters']) != 114 or [j['id'] for j in catalog['juzs']] != list(range(1, 31)):
        raise ValueError('Canonical catalog mismatch')
    return refs


def select(refs, *, juz=None, surahs=None, span=None, references=None, all_refs=False):
    keys = list(refs)
    if sum(bool(x) for x in (juz, surahs, span, references, all_refs)) != 1:
        raise ValueError('Choose exactly one of --juz, --surahs, --range, --references, --all')
    if juz:
        if any(j not in range(1, 31) for j in juz):
            raise ValueError('Juz must be 1–30')
        chosen = [k for k in keys if refs[k] in juz]
    elif surahs:
        if any(s not in range(1, 115) for s in surahs):
            raise ValueError('Surah must be 1–114')
        chosen = [k for k in keys if int(k.split(':')[0]) in surahs]
    elif span:
        match = re.fullmatch(r'([1-9]\d*:[1-9]\d*)-([1-9]\d*(?::[1-9]\d*)?)', span)
        if not match:
            raise ValueError('Range must be SURAH:START-SURAH:END (or SURAH:START-END)')
        start, end = match.groups()
        if ':' not in end:
            end = start.split(':')[0] + ':' + end
        if start not in refs or end not in refs or keys.index(start) > keys.index(end):
            raise ValueError('Invalid or reversed range')
        chosen = keys[keys.index(start):keys.index(end) + 1]
    elif references:
        if len(set(references)) != len(references) or any(k not in refs for k in references):
            raise ValueError('Invalid, duplicate or noncanonical reference')
        chosen = [k for k in keys if k in references]
    else:
        chosen = keys
    return chosen


def free(key):
    return int(key.split(':')[0]) in [1, *range(78, 115)]


def verify_reference_manifest(document, refs):
    source = document.get('source', {})
    if document.get('schemaVersion') != 1 or document.get('edition') != EDITION:
        raise ValueError('Independent manifest edition/schema mismatch')
    if not all(source.get(x) for x in ('provider', 'url', 'version', 'reviewer', 'reviewedAt', 'evidence')) or not source.get('independentOfQuranCom'):
        raise ValueError('Independent manifest requires documented independent source and reviewer')
    from urllib.parse import urlparse
    host = urlparse(source['url']).hostname
    if urlparse(source['url']).scheme != 'https' or not host or host == 'quran.com' or host.endswith('.quran.com'):
        raise ValueError('Reference manifest must be independent of Quran.com')
    rows = document.get('references', [])
    if len(rows) != len(refs) or len({r.get('key') for r in rows}) != len(refs) or {r.get('key'): r.get('juz') for r in rows} != refs:
        raise ValueError('Independent reference/juz mapping mismatch')


def verify_policy(policy):
    if policy.get('schemaVersion') != 1 or policy.get('edition') != EDITION or not policy.get('sourceVersion') or policy.get('translationResourceId') != 20:
        raise ValueError('Source edition/version/resource mismatch; a reviewed migration is required')
    missing = []
    for kind in REQUIRED_RIGHTS:
        item = policy.get('rights', {}).get(kind, {})
        if item.get('commercialUse') is not True or not all(isinstance(item.get(k), str) and item[k].strip() for k in ('source', 'version', 'evidence', 'reviewer', 'reviewedAt')):
            missing.append(kind)
    if missing:
        raise ValueError('Missing documented commercial-use evidence: ' + ', '.join(missing))


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        raise ValueError('Source redirects require explicit provider review')


def fetch(url):
    from urllib.parse import urlparse
    p = urlparse(url)
    allowed = (p.hostname == 'api.quran.com' and p.path.startswith('/api/v4/')) or (p.hostname == 'verses.quran.com' and re.fullmatch(r'/Alafasy/mp3/\d{6}\.mp3', p.path)) or (p.hostname == 'audio.qurancdn.com' and re.fullmatch(r'/wbw/\d{3}_\d{3}_\d{3}\.mp3', p.path))
    if p.scheme != 'https' or p.port not in (None, 443) or p.username or p.password or not allowed:
        raise ValueError('Unapproved source provider/path')
    last = None
    for _ in range(3):
        try:
            with urllib.request.build_opener(NoRedirect).open(url, timeout=45) as response:
                data = response.read(32 * 1024 * 1024 + 1)
                if len(data) > 32 * 1024 * 1024:
                    raise ValueError('Source exceeds 32 MiB limit')
                return data
        except (OSError, TimeoutError) as error:
            last = error
    raise ValueError('Source unavailable: ' + url) from last


def normal(text):
    return re.sub(r'[\s\u06d6-\u06dc\u06de\u06e2\u06ed\u06e9]', '', unicodedata.normalize('NFD', text))


def build_bundle(key, juz, data, uth, sources):
    v, canonical_verse = data['verse'], uth['verses'][0]
    if v['verse_key'] != key or canonical_verse['verse_key'] != key or v['juz_number'] != juz:
        raise ValueError('Provider reference/juz mismatch: ' + key)
    words = [w for w in v['words'] if w['char_type_name'] == 'word']
    if not words or [w['position'] for w in words] != list(range(1, len(words) + 1)):
        raise ValueError('Missing/reordered words: ' + key)
    text = canonical_verse['text_uthmani']
    tokens, prefix = [], ''
    for token in text.split():
        if normal(token):
            tokens.append(prefix + token)
            prefix = ''
        elif tokens:
            tokens[-1] += ' ' + token
        else:
            prefix += token + ' '
    if prefix or len(tokens) != len(words) or any(normal(t) != normal(w['text_uthmani']) for t, w in zip(tokens, words)):
        raise ValueError('Canonical ordinal alignment mismatch: ' + key)
    translation = next((t for t in v.get('translations', []) if t['resource_id'] == 20), None)
    if not translation or not isinstance(translation.get('text'), str) or not translation['text'].strip():
        raise ValueError('Missing licensed translation: ' + key)
    if any(not isinstance(w.get(kind, {}).get('text'), str) or not w[kind]['text'].strip() for w in words for kind in ('translation', 'transliteration')):
        raise ValueError('Missing word meaning/transliteration: ' + key)
    display_translation = html.unescape(re.sub('<[^>]+>', '', re.sub(r'<sup\b[^>]*>.*?</sup>', '', translation['text'])))
    if not display_translation.strip():
        raise ValueError('Missing display translation: ' + key)
    s, a = map(int, key.split(':'))
    return dict(schemaVersion=1, key=key, surah=s, ayah=a, juz=juz, textUthmani=text,
                translation=display_translation,
                translationSource=dict(resourceId=20, name='Saheeh International', text=translation['text']), sources=sources,
                words=[dict(position=w['position'], text=t, translation=w['translation']['text'], transliteration=w['transliteration']['text'], audioSource=w.get('audio_url'), audioVerified=False) for w, t in zip(words, tokens)],
                segments=[dict(id='full', firstWord=1, lastWord=len(words), reference=key, kind='whole-ayah', review=dict(status='source-validated', basis='Complete ayah; no internal recitation stop asserted.'))])


def audio_metadata(path):
    data = path.read_bytes()
    if len(data) <= 100 or not (data.startswith(b'ID3') or data[0] == 255):
        raise ValueError('Invalid MP3: ' + str(path))
    subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-protocol_whitelist', 'file,pipe', '-i', str(path), '-f', 'null', '-'], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, timeout=120)
    duration = float(subprocess.check_output(['ffprobe', '-v', 'error', '-protocol_whitelist', 'file,pipe', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', str(path)], timeout=30))
    if duration <= 0:
        raise ValueError('Missing audio duration')
    return dict(sha256=sha(data), bytes=len(data), durationMs=round(duration * 1000))


def check_existing(root, entry):
    expected = entry['key'].replace(':', '/') + '/bundle.json'
    if entry['path'] != expected:
        raise ValueError('Noncanonical bundle path')
    raw = (root / expected).read_bytes()
    if sha(raw) != entry['sha256']:
        raise ValueError('Existing validated bundle changed: ' + entry['key'])
    bundle = json.loads(raw)
    if bundle['key'] != entry['key'] or bundle['juz'] != entry['juz'] or len(bundle['words']) != entry['wordCount']:
        raise ValueError('Existing metadata mismatch')
    full = []
    for asset in bundle['audioAssets']:
        if asset['file'] != entry['key'].replace(':', '/') + '/full.mp3':
            if not re.fullmatch(entry['key'].replace(':', '/') + r'/word-[1-9]\d*\.mp3', asset['file']) or not asset.get('wordReview'):
                raise ValueError('Optional word audio missing review')
            data = (root / asset['file']).read_bytes()
            if sha(data) != asset['sha256'] or len(data) != asset['bytes']:
                raise ValueError('Optional audio mismatch')
            continue
        data = (root / asset['file']).read_bytes()
        if sha(data) != asset['sha256'] or len(data) != asset['bytes'] or asset['durationMs'] <= 0 or asset['sha256'] != entry['audioSha256']:
            raise ValueError('Existing audio mismatch')
        full.append(asset)
    if len(full) != 1:
        raise ValueError('Missing full-ayah audio')
    return raw, bundle


def process_alive(pid):
    """Read-only process probe; os.kill(pid, 0) is not safe on Windows."""
    if type(pid) is not int or pid <= 0:
        raise ValueError('Malformed lock process ID; preserve for recovery')
    if os.name == 'nt':
        import ctypes
        from ctypes import wintypes
        kernel = ctypes.WinDLL('kernel32', use_last_error=True)
        kernel.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
        kernel.OpenProcess.restype = wintypes.HANDLE
        kernel.GetExitCodeProcess.argtypes = [wintypes.HANDLE, ctypes.POINTER(wintypes.DWORD)]
        kernel.GetExitCodeProcess.restype = wintypes.BOOL
        kernel.CloseHandle.argtypes = [wintypes.HANDLE]
        handle = kernel.OpenProcess(0x1000, False, pid)  # PROCESS_QUERY_LIMITED_INFORMATION
        if not handle:
            if ctypes.get_last_error() == 87:  # ERROR_INVALID_PARAMETER: no such PID
                return False
            raise PermissionError('Cannot safely verify lock owner; do not remove its lock')
        try:
            code = wintypes.DWORD()
            if not kernel.GetExitCodeProcess(handle, ctypes.byref(code)):
                raise PermissionError('Cannot safely query lock owner')
            return code.value == 259  # STILL_ACTIVE
        finally:
            kernel.CloseHandle(handle)
    try:
        os.kill(pid, 0)
        return True
    except ProcessLookupError:
        return False


class Importer:
    def __init__(self, private_root, catalog, transport=fetch, decoder=audio_metadata):
        self.root = Path(private_root)
        self.refs = canonical(catalog)
        self.transport, self.decoder = transport, decoder
        self.mutex = threading.Lock()

    def prepare(self, keys, policy, reference_manifest, workers=4, refresh=False, migration_from=None, recover=False, word_reviews=None):
        verify_policy(policy)
        verify_reference_manifest(reference_manifest, self.refs)
        word_reviews = word_reviews or dict(schemaVersion=1, entries=[])
        if any(r.get('key') not in keys or free(r.get('key', '1:1')) for r in word_reviews.get('entries', [])):
            raise ValueError('Word audio review outside selected private references')
        reviewed = word_reviews.get('entries', [])
        if word_reviews.get('schemaVersion') != 1 or len({(r['key'], r['position']) for r in reviewed}) != len(reviewed):
            raise ValueError('Malformed/duplicate word audio review')
        if reviewed:
            rights = policy.get('rights', {}).get('wordAudio', {})
            if rights.get('commercialUse') is not True or not all(rights.get(k) for k in ('source', 'version', 'evidence', 'reviewer', 'reviewedAt')):
                raise ValueError('Missing word audio commercial-use evidence')
            if any(r.get('status') != 'approved' or not all(r.get(k) for k in ('key', 'position', 'textSha256', 'audioSha256', 'reviewer', 'reviewedAt', 'evidence')) for r in reviewed):
                raise ValueError('Word audio reviews need approval and exact source pins')
        if not 1 <= workers <= 8:
            raise ValueError('Concurrency must be 1–8')
        if not keys or len(set(keys)) != len(keys) or any(k not in self.refs for k in keys):
            raise ValueError('Invalid selection')
        legacy_path = self.root / 'manifest.json'
        legacy_raw = legacy_path.read_bytes() if legacy_path.exists() else raw_json(dict(schemaVersion=1, verses=[]))
        legacy = json.loads(legacy_raw)
        if legacy.get('schemaVersion') != 1 or not isinstance(legacy.get('verses'), list):
            raise ValueError('Unsupported legacy manifest; preserve original for recovery')
        rows = legacy['verses']
        if any(r.get('key') not in self.refs or r.get('juz') != self.refs.get(r.get('key')) or not re.fullmatch(r'[a-f0-9]{64}', r.get('sha256', '')) or not re.fullmatch(r'[a-f0-9]{64}', r.get('audioSha256', '')) for r in rows):
            raise ValueError('Malformed legacy manifest records; preserve original for recovery')
        if len({r['key'] for r in rows}) != len(rows):
            raise ValueError('Duplicate legacy records; preserve and recover original manifest')
        old = {r['key']: r for r in rows}
        if refresh and (migration_from != sha(legacy_raw) or not policy.get('migrationReason')):
            raise ValueError('Refresh requires --migration-from exact old manifest SHA and policy migrationReason')
        if refresh and any(old.get(k, {}).get('sourceVersion') == policy['sourceVersion'] for k in keys):
            raise ValueError('Explicit new source version required')
        config = dict(schemaVersion=1, pipelineVersion=2, edition=EDITION, sourceVersion=policy['sourceVersion'], references=keys,
                      privateReferences=[k for k in keys if not free(k)], freeReferences=[k for k in keys if free(k)],
                      wordReviewSha256=sha(raw_json(word_reviews)), policySha256=sha(raw_json(policy)), referenceManifestSha256=sha(raw_json(reference_manifest)),
                      catalogSha256=sha(raw_json(self.refs)), legacyManifestSha256=sha(legacy_raw), refresh=refresh)
        release_id = sha(raw_json(config))[:24]
        release = self.root / 'candidates' / release_id
        if not release.resolve().is_relative_to(self.root.resolve()):
            raise ValueError('Candidate escapes private root')
        release.mkdir(parents=True, exist_ok=True)
        if any(p.is_symlink() for p in release.rglob('*')):
            raise ValueError('Candidate symlinks require operator recovery')
        lock = release / 'import.lock'
        if lock.exists() and recover:
            prior = read(lock)
            if prior.get('host') != socket.gethostname():
                raise ValueError('Cannot recover a lock from another host automatically')
            if process_alive(prior['pid']):
                raise ValueError('Import is still active; do not steal its lock')
            lock.unlink()
        fd = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        os.write(fd, raw_json(dict(pid=os.getpid(), host=socket.gethostname())))
        os.close(fd)
        try:
            atomic(release / 'legacy-manifest.json', legacy_raw)
            atomic(release / 'selection.json', raw_json(config))
            atomic(release / 'source-policy.json', raw_json(policy))
            atomic(release / 'word-audio-review.json', raw_json(word_reviews))
            atomic(release / 'reference-manifest.json', raw_json(reference_manifest))
            journal_path = release / 'journal.json'
            journal = read(journal_path) if journal_path.exists() else dict(schemaVersion=1, releaseId=release_id, completed={}, errors={})
            if journal.get('releaseId') != release_id or not isinstance(journal.get('completed'), dict) or not isinstance(journal.get('errors'), dict):
                raise ValueError('Journal belongs to a different release')
            def work(key):
                try:
                    if key in journal['completed']:
                        entry = journal['completed'][key]
                        check_existing(release, entry)
                    elif key in old and not refresh:
                        if any(r['key'] == key for r in reviewed):
                            raise ValueError('Adding word assets to validated content requires explicit refresh migration')
                        entry = dict(old[key])
                        if entry.get('sourceVersion') and entry['sourceVersion'] != policy['sourceVersion']:
                            raise ValueError('Existing source version differs; explicit refresh migration required')
                        raw, bundle = check_existing(self.root, entry)
                        # Never relabel legacy assets as a newly fetched source version.
                        entry['provenance'] = dict(kind='legacy-reuse', legacyManifestSha256=sha(legacy_raw))
                        for asset in bundle['audioAssets']:
                            atomic(release / asset['file'], (self.root / asset['file']).read_bytes())
                        atomic(release / entry['path'], raw)
                    else:
                        folder = key.replace(':', '/')
                        sources, docs = [], []
                        for endpoint in (f'verses/by_key/{key}?words=true&word_fields=text_uthmani,audio_url&translations=20', f'quran/verses/uthmani?verse_key={key}'):
                            url = API + endpoint
                            raw = self.transport(url)
                            digest = sha(raw)
                            atomic(release / 'sources' / (digest + '.json'), raw)
                            sources.append(dict(url=url, sha256=digest))
                            docs.append(json.loads(raw))
                        bundle = build_bundle(key, self.refs[key], *docs, sources)
                        s, a = map(int, key.split(':'))
                        audio_url = f'https://verses.quran.com/Alafasy/mp3/{s:03}{a:03}.mp3'
                        audio_path = release / folder / 'full.mp3'
                        atomic(audio_path, self.transport(audio_url))
                        asset = dict(file=folder + '/full.mp3', source=audio_url, **self.decoder(audio_path))
                        bundle['audioAssets'] = [asset]
                        for review in (r for r in reviewed if r['key'] == key):
                            position = review['position']
                            if type(position) is not int or not 1 <= position <= len(bundle['words']):
                                raise ValueError('Invalid reviewed word position')
                            word = bundle['words'][position - 1]
                            expected = f'wbw/{s:03}_{a:03}_{position:03}.mp3'
                            if sha(word['text'].encode()) != review['textSha256'] or word['audioSource'] not in (expected, 'https://audio.qurancdn.com/' + expected):
                                raise ValueError('Reviewed word/source mismatch')
                            word_url = 'https://audio.qurancdn.com/' + expected
                            word_file = folder + f'/word-{position}.mp3'
                            atomic(release / word_file, self.transport(word_url))
                            metadata = self.decoder(release / word_file)
                            if metadata['sha256'] != review['audioSha256']:
                                raise ValueError('Reviewed word audio hash mismatch')
                            bundle['audioAssets'].append(dict(file=word_file, source=word_url, wordPosition=position, wordReview=review, **metadata))
                            word['audioVerified'] = True
                        raw = raw_json(bundle)
                        atomic(release / folder / 'bundle.json', raw)
                        entry = dict(key=key, juz=self.refs[key], wordCount=len(bundle['words']), path=folder + '/bundle.json', sha256=sha(raw), audioSha256=asset['sha256'], status='source-validated', subAyahReview='not-reviewed', sourceVersion=policy['sourceVersion'], provenance=dict(kind='provider-fetch', sources=sources), launchModes=['full-ayah-audio', 'windowed-reconstruction', 'whole-ayah-recall'])
                        if key in old:
                            entry['migration'] = dict(previousSha256=old[key]['sha256'], previousAudioSha256=old[key]['audioSha256'], reason=policy['migrationReason'])
                    with self.mutex:
                        journal['completed'][key] = entry
                        journal['errors'].pop(key, None)
                        atomic(journal_path, raw_json(journal))
                except Exception as error:
                    with self.mutex:
                        journal['errors'][key] = str(error)
                        atomic(journal_path, raw_json(journal))
            with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
                list(pool.map(work, config['privateReferences']))
            atomic(release / 'missing-assets.json', raw_json(dict(schemaVersion=1, releaseId=release_id, status='blocked' if journal['errors'] else 'complete', errors=[dict(key=k, reason=v, action='Inspect source assets or original records, then re-run the identical selection; do not invent replacements') for k, v in journal['errors'].items()])))
            if journal['errors']:
                # Do not leave an old successful upload manifest usable after failed recovery.
                (release / 'upload-manifest.json').unlink(missing_ok=True)
                raise ValueError(f"Import incomplete; see {journal_path}. Re-run the same selection to resume.")
            entries = [journal['completed'][k] for k in config['privateReferences']]
            atomic(release / 'manifest.json', raw_json(dict(schemaVersion=1, pipelineVersion=2, releaseId=release_id, verses=entries)))
            return release
        finally:
            lock.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    choose = parser.add_mutually_exclusive_group()
    choose.add_argument('--juz', nargs='+', type=int)
    choose.add_argument('--surahs', nargs='+', type=int)
    choose.add_argument('--range', dest='span')
    choose.add_argument('--references', nargs='+')
    choose.add_argument('--all', action='store_true')
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--prepare', action='store_true')
    mode.add_argument('--dry-run', action='store_true')
    mode.add_argument('--validate-only', action='store_true')
    parser.add_argument('--release', type=Path)
    parser.add_argument('--policy', type=Path)
    parser.add_argument('--reference-manifest', type=Path)
    parser.add_argument('--reference-sha256')
    parser.add_argument('--word-audio-review', type=Path)
    parser.add_argument('--concurrency', type=int, default=4)
    parser.add_argument('--refresh', action='store_true')
    parser.add_argument('--migration-from')
    parser.add_argument('--recover', action='store_true')
    args = parser.parse_args()
    if args.validate_only:
        if not args.release:
            parser.error('--validate-only requires --release')
        subprocess.run(['node', str(ROOT / 'scripts/validate-quran-release.mjs'), '--release', str(args.release)], check=True)
        return
    refs = canonical(read(ROOT / 'supabase/functions/_shared/quran-catalog.json'))
    keys = select(refs, juz=args.juz, surahs=args.surahs, span=args.span, references=args.references, all_refs=args.all)
    if not args.prepare:
        print(json.dumps(dict(mode='dry-run', references=len(keys), private=sum(not free(k) for k in keys), freeDelegated=sum(free(k) for k in keys), first=keys[0], last=keys[-1], requiredGates=['independent reference manifest + pinned SHA-256', 'documented commercial-use source policy', 'independent release validator'], writes=False, network=False), indent=2))
        return
    if not args.policy or not args.reference_manifest or not args.reference_sha256:
        parser.error('--prepare requires --policy, --reference-manifest and --reference-sha256; see docs/quran-import-pipeline.md')
    reference_raw = args.reference_manifest.read_bytes()
    if sha(reference_raw) != args.reference_sha256:
        raise ValueError('Independent reference manifest SHA mismatch')
    release = Importer(ROOT / '.quran-private', read(ROOT / 'supabase/functions/_shared/quran-catalog.json')).prepare(keys, read(args.policy), json.loads(reference_raw), args.concurrency, args.refresh, args.migration_from, args.recover, read(args.word_audio_review) if args.word_audio_review else None)
    subprocess.run(['node', str(ROOT / 'scripts/validate-quran-release.mjs'), '--release', str(release)], check=True)
    print('Validated isolated candidate: ' + str(release) + '; not published or activated.')
