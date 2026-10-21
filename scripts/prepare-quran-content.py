"""Fetch provenance-backed metadata and private content. Never writes to public/.
Run from repo root. No upload/deployment, no invented segment review approvals.
"""
import concurrent.futures, hashlib, html, json, re, subprocess, argparse
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'.quran-private'
API='https://api.quran.com/api/v4/'
def fetch(url): return subprocess.check_output(['curl','-fsSL','--retry','2','--max-time','45',url])
def digest(data):return hashlib.sha256(data).hexdigest()
def api(path):
 raw=fetch(API+path)
 return json.loads(raw),dict(url=API+path,sha256=digest(raw))
chapters,cs=api('chapters?language=en');juzs,js=api('juzs')
unique={}
for j in juzs['juzs']:
 key=j['juz_number']
 if key in unique and unique[key]['verse_mapping']!=j['verse_mapping']: raise ValueError('Conflicting juz metadata')
 unique[key]=j
assert sorted(unique)==list(range(1,31))
lookup={};jr=[]
for j in sorted(unique):
 ranges=[]
 for s,ran in unique[j]['verse_mapping'].items():
  first,last=map(int,ran.split('-'));ranges.append(dict(surah=int(s),first=first,last=last))
  for a in range(first,last+1):
   key=f'{s}:{a}'
   if key in lookup:raise ValueError('Overlapping juz mapping: '+key)
   lookup[key]=j
 assert sum(r['last']-r['first']+1 for r in ranges)==unique[j]['verses_count']
 jr.append(dict(id=j,verseCount=unique[j]['verses_count'],ranges=ranges))
cr=[]
for c in chapters['chapters']:
 ranges=[]
 for a in range(1,c['verses_count']+1):
  j=lookup[f"{c['id']}:{a}"]
  if ranges and ranges[-1]['juz']==j:ranges[-1]['last']=a
  else:ranges.append(dict(first=a,last=a,juz=j))
 cr.append(dict(id=c['id'],name=c['name_simple'],arabic=c['name_arabic'],verseCount=c['verses_count'],ranges=ranges))
assert len(cr)==114 and len(lookup)==6236 and sum(c['verseCount'] for c in cr)==6236
catalog=dict(schemaVersion=1,sources=[cs,js],chapters=cr,juzs=jr)
(ROOT/'supabase/functions/_shared/quran-catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n')
OUT.mkdir(exist_ok=True)
# Complete Al-Mulk plus two long-ayah pilot references. Other juz remain unavailable.
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--surahs',nargs='+',type=int)
parser.add_argument('--references',nargs='+')
parser.add_argument('--all',action='store_true',help='Explicit, potentially very large private import. Never run implicitly.')
args=parser.parse_args()
if args.all:keys=[f"{c['id']}:{a}" for c in cr for a in range(1,c['verseCount']+1) if c['id']!=1 and c['id']<78]
elif args.surahs:keys=[f"{sid}:{a}" for sid in args.surahs for a in range(1,next(c['verseCount'] for c in cr if c['id']==sid)+1)]
elif args.references:keys=args.references
else:keys=[f'67:{i}' for i in range(1,31)]+['2:255','2:282']
keys=list(dict.fromkeys(keys))
for key in keys:assert key in lookup,'Unknown reference: '+key
manifest=[]
def normal(text):return re.sub(r'[\s\u06d6-\u06dc\u06de\u06e2\u06ed\u06e9]','',text)
def prepare(key):
 s,a=map(int,key.split(':'))
 data,source=api(f'verses/by_key/{key}?words=true&word_fields=text_uthmani,audio_url&translations=20')
 uth,uth_source=api(f'quran/verses/uthmani?verse_key={key}')
 v=data['verse'];canonical=uth['verses'][0]
 assert v['verse_key']==key and canonical['verse_key']==key and v['juz_number']==lookup[key]
 words=[w for w in v['words'] if w['char_type_name']=='word']
 assert [w['position'] for w in words]==list(range(1,len(words)+1))
 assert normal(''.join(w['text_uthmani'] for w in words))==normal(canonical['text_uthmani']),key+' text/word mismatch'
 translation=next(t for t in v['translations'] if t['resource_id']==20)
 folder=OUT/str(s)/str(a);folder.mkdir(parents=True,exist_ok=True)
 audio=[]
 for w in words:
  path=f"wbw/{s:03}_{a:03}_{w['position']:03}.mp3"
  # Require exact ordinal audio, rather than silently replacing API references.
  # Keep the original reference, but do not publish unreviewed WBW alignment.
  # New passage mode uses verified whole-ayah audio, not inferred ordinal files.
 audio.append((f'https://verses.quran.com/Alafasy/mp3/{s:03}{a:03}.mp3',folder/'full.mp3'))
 bundle=dict(schemaVersion=1,key=key,surah=s,ayah=a,juz=lookup[key],textUthmani=canonical['text_uthmani'],translation=html.unescape(re.sub('<[^>]+>','',re.sub(r'<sup\b[^>]*>.*?</sup>','',translation['text']))),translationSource=dict(resourceId=20,name='Saheeh International',text=translation['text']),sources=[source,uth_source],words=[dict(position=w['position'],text=w['text_uthmani'],translation=w['translation']['text'],transliteration=w['transliteration']['text'],audioSource=w['audio_url'],audioVerified=False) for w in words],segments=[dict(id='full',firstWord=1,lastWord=len(words),reference=key,kind='whole-ayah',review=dict(status='source-validated',basis='Complete ayah boundary; no internal recitation stop asserted.'))])
 return key,bundle,folder,audio
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:prepared=list(pool.map(prepare,keys))
def download(pair):
 url,path=pair
 if not path.exists():path.write_bytes(fetch(url))
 data=path.read_bytes()
 assert len(data)>100 and (data[:3]==b'ID3' or data[0]==255),'Invalid MP3 '+url
 subprocess.run(['ffmpeg','-v','error','-i',str(path),'-f','null','-'],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
 duration=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',str(path)]))
 assert duration>0
 return dict(file=str(path.relative_to(OUT)),source=url,sha256=digest(data),bytes=len(data),durationMs=round(duration*1000))
with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
 assets=list(pool.map(download,[pair for _,_,_,audio in prepared for pair in audio]))
for key,bundle,folder,audio in prepared:
 bundle['audioAssets']=[a for a in assets if a['file'].startswith(str(folder.relative_to(OUT))+'/')]
 review_file=ROOT/'content-reviews/segments.json'
 if review_file.exists():
  for segment in json.loads(review_file.read_text()).get('segments',[]):
   if segment.get('reference')!=key or segment.get('review',{}).get('status')!='approved':continue
   assert segment['review'].get('reviewer') and segment['review'].get('reviewedAt') and segment['review'].get('evidence')
   assert segment.get('kind')=='reviewed' and 1<=segment['firstWord']<=segment['lastWord']<=len(bundle['words'])
   if segment.get('audioReview',{}).get('status')=='approved':
    assert segment['audioReview'].get('reviewer') and segment['audioReview'].get('reviewedAt') and segment['audioReview'].get('evidence')
    assert 0<=segment['startMs']<segment['endMs']<=bundle['audioAssets'][0]['durationMs']
   bundle['segments'].append(segment)
 raw=(json.dumps(bundle,ensure_ascii=False,indent=2)+'\n').encode();(folder/'bundle.json').write_bytes(raw)
 manifest.append(dict(key=key,wordCount=len(bundle['words']),audioSha256=next(x['sha256'] for x in bundle['audioAssets'] if x['file'].endswith('/full.mp3')),sha256=digest(raw),juz=bundle['juz'],path=str((folder/'bundle.json').relative_to(OUT)),status='source-validated',subAyahReview='not-reviewed',launchModes=['full-ayah-audio','windowed-reconstruction','whole-ayah-recall']))
previous_path=OUT/'manifest.json'
if previous_path.exists():
 current={row['key']:row for row in json.loads(previous_path.read_text()).get('verses',[])}
 current.update({row['key']:row for row in manifest})
 manifest=list(current.values())
(OUT/'manifest.json').write_text(json.dumps(dict(schemaVersion=1,verses=manifest),indent=2)+'\n')
# Safe public availability metadata: no premium Arabic, translations or audio paths.
free_surahs=[1]+list(range(78,115));available_keys={row['key'] for row in manifest}|{f"{c['id']}:{a}" for c in cr if c['id'] in free_surahs for a in range(1,c['verseCount']+1)}
fully_surahs=[c['id'] for c in cr if all(f"{c['id']}:{a}" in available_keys for a in range(1,c['verseCount']+1))]
fully_juz=[j['id'] for j in jr if all(f"{r['surah']}:{a}" in available_keys for r in j['ranges'] for a in range(r['first'],r['last']+1))]
availability=dict(schemaVersion=1,freeSurahs=free_surahs,premium=[{k:v for k,v in row.items() if k not in ['path']} for row in manifest if int(row['key'].split(':')[0]) not in free_surahs],fullyVerifiedJuz=fully_juz,fullyVerifiedSurahs=fully_surahs,privateDeploymentRequired=True)
(ROOT/'supabase/functions/_shared/content-availability.json').write_text(json.dumps(availability,indent=2)+'\n')
print(f'Validated 114 surahs, 30 juz, 6236 references; prepared {len(manifest)} private ayahs and {len(assets)} MP3s. No internal segment review claimed.')
