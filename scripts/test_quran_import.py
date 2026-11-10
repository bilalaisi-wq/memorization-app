"""Offline synthetic-provider tests. Approvals below are test-only, never release evidence."""
import copy
import ctypes
from ctypes import wintypes
import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import MagicMock, patch
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent / 'lib'))
from quran_import import *
CATALOG = read(ROOT / 'supabase/functions/_shared/quran-catalog.json')
REFS = canonical(CATALOG)
BUNDLE = read(ROOT / 'tests/fixtures/2-282.json')


def policy():
    evidence = dict(commercialUse=True, source='TEST ONLY mock provider', version='fixture-v1', reviewer='Test fixture', reviewedAt='2026-11-10', evidence='TEST ONLY, no publication permission')
    return dict(schemaVersion=1, edition=EDITION, sourceVersion='TEST-ONLY-v1', translationResourceId=20, rights={k: copy.deepcopy(evidence) for k in [*REQUIRED_RIGHTS, 'wordAudio']})


def reference_manifest():
    return dict(schemaVersion=1, edition=EDITION, source=dict(provider='TEST ONLY independent fixture', url='https://example.invalid/test-only', version='test-v1', reviewer='Test fixture', reviewedAt='2026-11-10', evidence='Synthetic test; not real attestation', independentOfQuranCom=True), references=[dict(key=k, juz=j) for k, j in REFS.items()])


def response_docs():
    b = BUNDLE
    words = [dict(position=w['position'], text_uthmani=w['text'], char_type_name='word', translation=dict(text=w['translation']), transliteration=dict(text=w['transliteration']), audio_url=f"wbw/002_282_{w['position']:03}.mp3") for w in b['words']]
    return dict(verse=dict(verse_key=b['key'], juz_number=b['juz'], words=words, translations=[dict(resource_id=20, text=b['translationSource']['text'])])), dict(verses=[dict(verse_key=b['key'], text_uthmani=b['textUthmani'])])


class ImportTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='ayah-pipeline-')
        self.root = Path(self.temp.name)
        audio = self.root / 'fixture.mp3'
        subprocess.run(['ffmpeg', '-v', 'error', '-f', 'lavfi', '-i', 'anullsrc=r=22050:cl=mono', '-t', '0.12', '-y', str(audio)], check=True)
        self.audio = audio.read_bytes()
        self.calls = []
        self.fail_audio = False
        self.docs = response_docs()

    def tearDown(self):
        self.temp.cleanup()

    def transport(self, url):
        self.calls.append(url)
        if url.endswith('.mp3'):
            if self.fail_audio:
                raise OSError('Simulated interrupted download')
            return self.audio
        return raw_json(self.docs[1] if 'uthmani?' in url else self.docs[0])

    def importer(self):
        return Importer(self.root / 'private', CATALOG, self.transport)

    def prepare(self, **kw):
        return self.importer().prepare(['2:282'], policy(), reference_manifest(), **kw)

    def validate(self, release):
        return subprocess.run(['node', str(ROOT / 'scripts/validate-quran-release.mjs'), '--release', str(release)], capture_output=True, text=True)

    def test_all_juz_boundaries_and_free_delegation(self):
        for j in CATALOG['juzs']:
            selected = select(REFS, juz=[j['id']])
            self.assertEqual(len(selected), j['verseCount'])
            self.assertEqual(selected[0], f"{j['ranges'][0]['surah']}:{j['ranges'][0]['first']}")
            self.assertEqual(selected[-1], f"{j['ranges'][-1]['surah']}:{j['ranges'][-1]['last']}")
        self.assertEqual(len(select(REFS, all_refs=True)), 6236)
        self.assertEqual(sum(free(k) for k in REFS), 571)
        self.assertEqual(len(select(REFS, surahs=[67])), 30)
        self.assertEqual(select(REFS, span='2:286-3:2'), ['2:286', '3:1', '3:2'])
        self.assertEqual(select(REFS, span='2:141-142'), ['2:141', '2:142'])
        self.assertEqual(select(REFS, span='7:87-88'), ['7:87', '7:88'])

    def test_invalid_selections_and_catalog(self):
        for kwargs in [dict(juz=[0]), dict(juz=[31]), dict(surahs=[115]), dict(span='2:2-1'), dict(span='02:1-2'), dict(span='2:286-3'), dict(references=['2:1', '2:1']), dict(references=['02:1']), dict(juz=[1], surahs=[1]), {}]:
            with self.assertRaises(ValueError):
                select(REFS, **kwargs)
        bad = copy.deepcopy(CATALOG)
        bad['juzs'][0]['ranges'][0]['last'] -= 1
        with self.assertRaises(ValueError):
            canonical(bad)

    def test_source_and_independent_mapping_gates(self):
        p = policy();p['rights']['wordMeanings']['commercialUse'] = False
        with self.assertRaisesRegex(ValueError, 'wordMeanings'):
            self.importer().prepare(['2:282'], p, reference_manifest())
        p = policy();p['translationResourceId'] = 99
        with self.assertRaisesRegex(ValueError, 'resource'):
            verify_policy(p)
        for mutate in [lambda m: m['references'].pop(), lambda m: m['references'][0].update(juz=2), lambda m: m['source'].update(url='https://api.quran.com/api/v4/juzs'), lambda m: m.update(edition='different')]:
            m = reference_manifest();mutate(m)
            with self.assertRaises(ValueError):
                verify_reference_manifest(m, REFS)
        self.assertFalse((self.root / 'private').exists())
        root = self.root / 'private'
        atomic(root / 'manifest.json', b'{malformed')
        with self.assertRaises(json.JSONDecodeError):
            self.prepare()
        self.assertEqual((root / 'manifest.json').read_bytes(), b'{malformed')
        atomic(root / 'manifest.json', raw_json(dict(schemaVersion=99, verses=[])))
        with self.assertRaisesRegex(ValueError, 'Unsupported legacy'):
            self.prepare()

    def test_exact_long_ayah_repeated_words_and_stops(self):
        data, uth = self.docs
        b = build_bundle('2:282', REFS['2:282'], data, uth, [])
        self.assertEqual(b['textUthmani'], BUNDLE['textUthmani'])
        self.assertEqual(normal(''.join(w['text'] for w in b['words'])), normal(BUNDLE['textUthmani']))
        self.assertEqual(' '.join(w['text'] for w in b['words']), BUNDLE['textUthmani'])
        self.assertLess(len(set(w['text'] for w in b['words'])), len(b['words']))
        for mutate in [lambda d: d['verse']['words'].pop(), lambda d: d['verse']['words'][1].update(position=1), lambda d: d['verse'].update(juz_number=1), lambda d: d['verse']['words'][0]['translation'].update(text=''), lambda d: d['verse']['words'][0]['transliteration'].update(text=''), lambda d: d['verse'].update(translations=[]), lambda d: d['verse']['words'][0]['translation'].update(text=' '), lambda d: d['verse']['translations'][0].update(text='<p></p>')]:
            d = copy.deepcopy(data);mutate(d)
            with self.assertRaises(ValueError):
                build_bundle('2:282', REFS['2:282'], d, uth, [])

    def test_import_resume_independent_validation_and_immutability(self):
        release = self.prepare()
        self.assertEqual(self.validate(release).returncode, 0)
        initial = (release / 'manifest.json').read_bytes()
        calls = len(self.calls)
        self.assertEqual(self.prepare(), release)
        self.assertEqual(len(self.calls), calls)
        self.assertEqual((release / 'manifest.json').read_bytes(), initial)
        b = read(release / '2/282/bundle.json')
        self.assertEqual(b['textUthmani'], BUNDLE['textUthmani'])
        self.assertTrue((release / 'upload-manifest.json').exists())
        self.assertFalse((self.root / 'private/manifest.json').exists())
        self.assertFalse((release / 'import.lock').exists())

    def test_interrupted_import_and_resume(self):
        self.fail_audio = True
        with self.assertRaisesRegex(ValueError, 'incomplete'):
            self.prepare()
        journals = list((self.root / 'private/candidates').glob('*/journal.json'))
        self.assertEqual(len(journals), 1)
        self.assertIn('2:282', read(journals[0])['errors'])
        self.assertEqual(read(journals[0].parent / 'missing-assets.json')['status'], 'blocked')
        self.fail_audio = False
        release = self.prepare(recover=True)
        self.assertEqual(read(release / 'journal.json')['errors'], {})
        self.assertEqual(self.validate(release).returncode, 0)

    def test_missing_recording_and_corrupt_resume_preserved(self):
        self.audio = b'not mp3'
        with self.assertRaisesRegex(ValueError, 'incomplete'):
            self.prepare()
        self.assertTrue(list((self.root / 'private/candidates').glob('*/journal.json')))

    def test_validated_legacy_reused_not_rewritten(self):
        release = self.prepare()
        root = self.root / 'private'
        entry = read(release / 'manifest.json')['verses'][0]
        for path in ['2/282/full.mp3', '2/282/bundle.json']:
            atomic(root / path, (release / path).read_bytes())
        legacy = raw_json(dict(schemaVersion=1, verses=[entry]))
        atomic(root / 'manifest.json', legacy)
        self.calls.clear()
        reused = self.prepare()
        self.assertFalse(self.calls)
        self.assertEqual((root / 'manifest.json').read_bytes(), legacy)
        self.assertEqual((root / '2/282/bundle.json').read_bytes(), (reused / '2/282/bundle.json').read_bytes())
        self.assertEqual(self.validate(reused).returncode, 0)
        with self.assertRaisesRegex(ValueError, 'migration'):
            self.prepare(refresh=True)
        p = policy();p['migrationReason'] = 'TEST ONLY migration'
        with self.assertRaisesRegex(ValueError, 'new source version'):
            self.importer().prepare(['2:282'], p, reference_manifest(), refresh=True, migration_from=sha(legacy))
        p['sourceVersion'] = 'TEST-ONLY-v2'
        with self.assertRaisesRegex(ValueError, 'incomplete'):
            self.importer().prepare(['2:282'], p, reference_manifest())
        migrated = self.importer().prepare(['2:282'], p, reference_manifest(), refresh=True, migration_from=sha(legacy))
        self.assertEqual(self.validate(migrated).returncode, 0)
        self.assertEqual((root / 'manifest.json').read_bytes(), legacy)

    def test_reviewed_word_audio_exact_position_and_source(self):
        word = BUNDLE['words'][0]
        review = dict(schemaVersion=1, entries=[dict(key='2:282', position=1, status='approved', textSha256=sha(word['text'].encode()), audioSha256=sha(self.audio), reviewer='TEST ONLY', reviewedAt='2026-11-10', evidence='TEST ONLY alignment')])
        release = self.prepare(word_reviews=review)
        b = read(release / '2/282/bundle.json')
        self.assertTrue(b['words'][0]['audioVerified'])
        self.assertEqual(len(b['audioAssets']), 2)
        result = self.validate(release)
        self.assertEqual(result.returncode, 0, result.stderr)
        review['entries'][0]['textSha256'] = '0' * 64
        with self.assertRaisesRegex(ValueError, 'incomplete'):
            self.prepare(word_reviews=review)

    def test_active_lock_cannot_be_stolen(self):
        release = self.prepare()
        atomic(release / 'import.lock', raw_json(dict(pid=os.getpid(), host=socket.gethostname())))
        with self.assertRaisesRegex(ValueError, 'active'):
            self.prepare(recover=True)
        (release / 'import.lock').unlink()
        atomic(release / 'import.lock', raw_json(dict(pid=2147483647, host=socket.gethostname())))
        self.assertEqual(self.prepare(recover=True), release)
        # Never send signal 0 on Windows: query the process with limited rights.
        kernel = MagicMock()
        kernel.OpenProcess.return_value = 123
        def active(handle, output):
            output._obj.value = 259
            return True
        kernel.GetExitCodeProcess.side_effect = active
        with patch('quran_import.os.name', 'nt'), patch('ctypes.WinDLL', return_value=kernel, create=True), patch('quran_import.os.kill', side_effect=AssertionError('Windows must never signal a process')):
            self.assertTrue(process_alive(123))
        kernel.CloseHandle.assert_called_once_with(123)

    def test_independent_validator_rejects_tampering(self):
        release = self.prepare()
        raw = (release / '2/282/bundle.json').read_bytes()
        b = json.loads(raw);b['words'][0]['text'] = b['words'][1]['text']
        atomic(release / '2/282/bundle.json', raw_json(b))
        self.assertNotEqual(self.validate(release).returncode, 0)
        self.assertEqual(read(release / '2/282/bundle.json')['words'][0]['text'], b['words'][0]['text'])

    def test_free_only_candidate_has_no_private_copy(self):
        release = self.importer().prepare(select(REFS, juz=[30]), policy(), reference_manifest())
        result = self.validate(release)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(read(release / 'manifest.json')['verses'], [])
        self.assertFalse(self.calls)

    def test_disallowed_provider_rejected_without_network(self):
        for url in ['http://api.quran.com/api/v4/juzs', 'https://evil.invalid/a', 'https://api.quran.com:8443/api/v4/juzs', 'https://user:secret@api.quran.com/api/v4/juzs', 'https://verses.quran.com/not-reviewed.mp3']:
            with self.assertRaisesRegex(ValueError, 'Unapproved'):
                fetch(url)

    def test_cli_help_and_dry_run_do_not_write(self):
        for args in [['--help'], ['--all', '--dry-run'], ['--range', '2:286-3:2']]:
            result = subprocess.run([sys.executable, str(ROOT / 'scripts/prepare-quran-content.py'), *args], capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
        result = subprocess.run([sys.executable, str(ROOT / 'scripts/prepare-quran-content.py'), '--juz', '29', '--prepare'], capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('--reference-sha256', result.stderr)


if __name__ == '__main__':
    unittest.main()
