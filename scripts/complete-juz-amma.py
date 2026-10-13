"""Import remaining Juz Amma surahs (87–78) and exact ordinal word audio.
Sources: Quran.com API v4 (translation 20), Quran.com WBW, Alafasy verse CDN.
Run from repository root; safe to rerun, preserves existing surah records.
"""
import concurrent.futures
import html
import json
from pathlib import Path
import re
import time
import subprocess

ROOT = Path(__file__).resolve().parents[1]
CACHE = Path('/tmp/ayah-juz-import')
CACHE.mkdir(exist_ok=True)

def fetch(url):
    for attempt in range(4):
        try:
            return subprocess.check_output(["curl", "-fsSL", "--max-time", "45", url])
        except Exception:
            if attempt == 3:
                raise
            time.sleep(attempt + 1)

def api(path):
    return json.loads(fetch('https://api.quran.com/api/v4/' + path))

path = ROOT / 'src/additional-surahs.json'
surahs = json.loads(path.read_text())
manifest_path = ROOT / 'public/additional-quran-source.json'
manifest = json.loads(manifest_path.read_text())
meaning_art = {meaning: art for s in surahs for v in s['verses'] for meaning, art in v['meanings']}

def art(word, meaning):
    spelling = re.sub(r'[\u0640\u064b-\u065f\u0670\u06d6-\u06ed]', '', word).replace('ٱ', 'ا')
    if re.search(r'الله|لله|ربك|ربه|ربهم|ربنا|ربها|ربكم|الرحمن|الرحيم|الأعلى|الكريم|العزيز|الحميد|الغفور|الودود|المجيد', spelling):
        return 'gold'
    if meaning in meaning_art:
        return meaning_art[meaning]
    for key, pattern in [('fire', r'fire|burn|hell'), ('water', r'water|sea|river|rain'), ('tree', r'tree|plant|grass|garden'), ('moon', r'moon'), ('day', r'sun|day|dawn|morning'), ('book', r'book|record|scroll'), ('food', r'food|eat|fruit|drink'), ('people', r'people|man|human|believer'), ('path', r'path|guide|way'), ('praise', r'glorify|praise'), ('judgment', r'judgment|recompense'), ('worlds', r'earth|sky|heaven|mountain|star')]:
        if re.search(pattern, meaning, re.I):
            return key
    return 'name'

downloads = []
for sid in range(87, 77, -1):
    if any(s['id'] == sid for s in surahs):
        continue
    chapter = api(f'chapters/{sid}?language=en')['chapter']
    raw = api(f'verses/by_chapter/{sid}?words=true&word_fields=text_uthmani,audio_url&translations=20&per_page=50')['verses']
    (CACHE / f'{sid}.json').write_text(json.dumps(raw, ensure_ascii=False))
    chapter_data = dict(id=sid, name=chapter['name_simple'], arabic=chapter['name_arabic'], meaning=chapter['translated_name']['name'], origin=chapter['revelation_place'].capitalize(), verses=[])
    for verse in raw:
        aid = verse['verse_number']
        words = [w for w in verse['words'] if w['char_type_name'] == 'word']
        chapter_data['verses'].append(dict(id=aid, text=' '.join(w['text_uthmani'] for w in words), words=[w['text_uthmani'] for w in words], roman=[w['transliteration']['text'] for w in words], translation=html.unescape(re.sub('<[^>]+>', '', verse['translations'][0]['text'])), meanings=[[w['translation']['text'], art(w['text_uthmani'], w['translation']['text'])] for w in words]))
        source = dict(verse_key=verse['verse_key'], words=[])
        for index, word in enumerate(words, 1):
            audio = f'wbw/{sid:03}_{aid:03}_{index:03}.mp3'
            record = dict(text=word['text_uthmani'], audio_url=audio)
            if word['audio_url'] != audio:
                record['api_audio_url'] = word['audio_url']
            source['words'].append(record)
            downloads.append(('https://audio.qurancdn.com/' + audio, ROOT / 'public/audio' / audio.split('/')[-1]))
        manifest['verses'].append(source)
        name = f'{sid:03}{aid:03}.mp3'
        downloads.append(('https://verses.quran.com/Alafasy/mp3/' + name, ROOT / 'public/audio' / name))
    surahs.append(chapter_data)
    print(f"Prepared {chapter['name_simple']}: {len(raw)} ayahs", flush=True)

def download(pair):
    url, dest = pair
    if dest.exists() and dest.stat().st_size > 100:
        return
    data = fetch(url)
    if len(data) < 100 or data[:1] == b'<':
        raise ValueError(f'Invalid audio: {url}')
    dest.write_bytes(data)

with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
    for i, _ in enumerate(pool.map(download, downloads), 1):
        if i % 200 == 0:
            print(f'Downloaded {i}/{len(downloads)} recordings', flush=True)
# Write manifests only after all recordings succeed.
path.write_text(json.dumps(surahs, ensure_ascii=False, indent=2) + '\n')
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
print(f'Added {len(downloads)} recordings. Juz Amma complete.', flush=True)
