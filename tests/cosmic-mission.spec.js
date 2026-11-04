import { test, expect } from '@playwright/test';
import { cosmicSurahs, createMission, selectMissionRange, COSMIC_GAMEPLAY_AVAILABLE } from '../src/quest/cosmic/mission.js';

test('free catalog and every full-surah mission preserve exact contiguous coverage', async () => {
  expect(cosmicSurahs).toHaveLength(38);
  expect(COSMIC_GAMEPLAY_AVAILABLE).toBe(true);
  let count = 0;
  for (const surah of cosmicSurahs) {
    const mission = await createMission({surahId:surah.id, selection:'entire'});
    expect(mission.refs).toEqual(surah.verses.map(v=>`${surah.id}:${v.id}`));
    expect(mission.stages.flatMap(s=>s.refs)).toEqual(mission.refs);
    expect(mission.stages).toHaveLength(Math.ceil(surah.verses.length/5));
    expect(mission.stages.every((s,i)=>s.order===i+1&&s.refs.length>=1&&s.refs.length<=5)).toBe(true);
    expect(new Set(mission.stages.map(s=>s.id)).size).toBe(mission.stages.length);
    expect(JSON.stringify(mission)).not.toMatch(/[\u0600-\u06ff]/);
    count += mission.refs.length;
  }
  expect(count).toBe(571);
});

test('presets, custom boundaries and short surahs are deterministic', async () => {
  for (const size of [5,10,15,20]) {
    const m = await createMission({surahId:78,selection:String(size),start:3});
    expect(m.refs).toHaveLength(size);
    expect(m.first).toBe(3);
    expect(m.last).toBe(2+size);
    expect(m.stages).toHaveLength(size/5);
  }
  const short = await createMission({surahId:108,selection:'20'});
  expect(short.refs).toEqual(['108:1','108:2','108:3']);
  expect(short.stages).toHaveLength(1);
  const a = await createMission({surahId:78,selection:'custom',start:4,end:14});
  const b = await createMission({surahId:78,selection:'custom',start:4,end:14});
  expect(a).toEqual(b);
  expect(a.stages.map(s=>[s.first,s.last])).toEqual([[4,8],[9,13],[14,14]]);
  expect((await createMission({surahId:78,selection:'custom',start:5,end:14})).id).not.toBe(a.id);
  expect(selectMissionRange({surahId:1,selection:'5',start:7}).refs).toEqual(['1:7']);
});

test('rejects premium, malformed, noncontiguous and invalid configuration without entitlements override', () => {
  for (const surahId of [2,7,67,77,115,0,'1',1.5]) expect(()=>selectMissionRange({surahId,selection:'entire',developer:true,plan:'pathfinder'})).toThrow();
  for (const [start,end] of [[0,2],[4,3],[1,8],[1.2,4],[1,NaN]]) expect(()=>selectMissionRange({surahId:1,selection:'custom',start,end})).toThrow();
  for (const selection of ['6','all','05',5]) expect(()=>selectMissionRange({surahId:1,selection})).toThrow();
});
