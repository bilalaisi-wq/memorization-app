# Long-ayah memorization segments — research draft for Codex

**Not scholar-reviewed or approved.** These are proposed study/display boundaries based on Arabic phrase units and published Medina-style pause signs. Do not expose them as certified recitation stopping points until a qualified tajwīd/waqf reviewer approves them.

## Sources and method

- [Quran.com 2:255](https://quran.com/2/255) and [2:282](https://quran.com/2/282): Arabic orthographic words and visible Mushaf pause symbols.
- [Quranic Arabic Corpus 2:255](https://corpus.quran.com/wordbyword.jsp?chapter=2&verse=255) and [2:282](https://corpus.quran.com/wordbyword.jsp?chapter=2&verse=282): cross-reference word positions and syntax.
- [Tanzil pause-mark reference](https://tanzil.net/docs/pause_marks): distinction between م, لا, ج (ۚ), قلى (ۗ), صلى (ۖ) and paired marks.

**Important:** ۚ is generally permissible to pause, ۗ generally favors pausing, and ۖ generally favors continuing. These are not interchangeable. A visual segmentation after a phrase with no pause sign **does not** mean a pause is endorsed. A reciter's breath stop and correct restart also require tajwīd instruction. The same pause-marking system must be chosen throughout; markings vary by Mushaf edition.

## Proposed word-indexed boundaries

Start/end word indices below are **inclusive** and 1-based. In 2:282, the initial **يَا أَيُّهَا** is encoded as **one orthographic word** (يَٰٓأَيُّهَا) in the chosen reference, not two. Never count particles detached by Arabic morphological analysis as separate UI words.

### 2:255 — 50 words, 9 study chunks

| Chunk | Word range | Arabic meaning unit | Mushaf mark at boundary | Status |
|---|---|---|---|---|
| 1 | 1–7 | التوحيد والقيومية | ۚ | Published mark; awaiting review |
| 2 | 8–12 | تنزيه الله عن السنة والنوم | ۚ | Published mark; awaiting review |
| 3 | 13–19 | ملك السماوات والأرض | ۗ | Published mark; awaiting review |
| 4 | 20–26 | الشفاعة بإذنه | ۚ | Published mark; awaiting review |
| 5 | 27–32 | علم ما بين أيدي الخلق وما خلفهم | ۖ | Published mark; awaiting review |
| 6 | 33–40 | الإحاطة بالعلم بمشيئته | ۚ | Published mark; awaiting review |
| 7 | 41–44 | سعة الكرسي | ۖ | Published mark; awaiting review |
| 8 | 45–47 | حفظ السماوات والأرض | ۚ | Published mark; awaiting review |
| 9 | 48–50 | العلو والعظمة | end_of_ayah | Ayah end |

### 2:282 — 128 words, 19 study chunks

| Chunk | Word range | Arabic meaning unit | Mushaf mark at boundary | Status |
|---|---|---|---|---|
| 1 | 1–10 | توثيق الدين المؤجل | ۚ | Published mark; awaiting review |
| 2 | 11–14 | الكتابة بالعدل | ۚ | Published mark; awaiting review |
| 3 | 15–22 | واجب الكاتب | ۚ | Published mark; awaiting review |
| 4 | 23–27 | إملاء صاحب الحق | none | Phrase only; NOT a confirmed pause |
| 5 | 28–34 | التقوى وعدم الانتقاص | ۚ | Published mark; awaiting review |
| 6 | 35–51 | حالة العاجز ووليه | ۚ | Published mark; awaiting review |
| 7 | 52–55 | طلب الشاهدين | ۖ | Published mark; awaiting review |
| 8 | 56–65 | بديل الشهادة عند عدم وجود رجلين | none | Phrase only; NOT a confirmed pause |
| 9 | 66–71 | التذكير عند الخطأ | ۚ | Published mark; awaiting review |
| 10 | 72–77 | استجابة الشهود | ۚ | Published mark; awaiting review |
| 11 | 78–86 | كتابة الدين مهما كان مقداره | ۚ | Published mark; awaiting review |
| 12 | 87–95 | حكمة التوثيق | none | Phrase only; NOT a confirmed pause |
| 13 | 96–107 | استثناء التجارة الحاضرة | ۗ | Published mark; awaiting review |
| 14 | 108–110 | الإشهاد عند البيع | ۚ | Published mark; awaiting review |
| 15 | 111–115 | حماية الكاتب والشهيد | ۚ | Published mark; awaiting review |
| 16 | 116–120 | التحذير من الإضرار | ۗ | Published mark; awaiting review |
| 17 | 121–122 | الأمر بالتقوى | ۖ | Published mark; awaiting review |
| 18 | 123–124 | التعليم من الله | ۗ | Published mark; awaiting review |
| 19 | 125–128 | إحاطة علم الله | end_of_ayah | Ayah end |

## Instructions to Codex (implement now, publish reviewed stops only)

1. Load `quran_long_ayah_segments_DRAFT.json` as *draft seed metadata*. Keep Qur'an text in your existing verified Uthmani word dataset; never construct the sacred text by concatenating normalized sample strings.
2. On import, verify canonical word count **50** for 2:255 and **128** for 2:282; verify contiguous ranges, start at 1, finish at final word, no overlaps, no gaps, no repeated words. Abort on mismatch.
3. Verify each endpoint against the actual word and pause symbol in the chosen canonical dataset. The JSON mark values are transcribed reference metadata, not a substitute for direct validation. Flag all symbol mismatches for manual review.
4. Separate `displaySegment` (learning workspace) from `recitationStop` (explicit scholarly-approved boundary). Initial `recitationStop` should be false for every candidate, even boundaries accompanied by a Mushaf mark, until reviewed. **Never auto-promote** from presence of ۖ/ۚ/ۗ alone.
5. Expose a teacher/scholar review interface with: Arabic contextual text; word IDs; suggested division; pause-sign notation; approve/reject for **visual chunking** separately from approve/reject for **waqf**; optional required *restart word*; reviewer name/credential/date; source Mushaf edition and riwāyah; revision history. A separate audit state should say `pending_review`, `approved`, `rejected`.
6. While unapproved, allow bounded word highlighting and per-phrase memorization exercises, but recitation audio/playback and correctness assessments should use continuous full-ayah (or approved recitation portions only). A UI panel boundary cannot be displayed with a stop icon.
7. For `phrase_only_no_attested_pause_mark` boundaries (2:282 after word 27, 65, 95 in 1-based canonical positions), visually continue the phrase onto the next study workspace as needed; do not encourage stopping or restarting there. In a read-aloud quiz, assess the merged longer text.
8. Use the source Qur'an audio timings when available. Do not infer permissible stops from audio pauses, translation punctuation, or line/page breaks.
9. Create tests for 2:255, 2:282 and cross-screen theme modes (simple and night-sky), Arabic right-to-left rendering, Arabic Uthmani font shaping, exact word coverage and unchanged canonical verse text. Never gate hifẓ progress on a teacher-unreviewed recitation stopping rule.
10. Ask a qualified Hafs/waqf-and-ibtidāʾ teacher to approve proposed recitation stops and restart points before enabling segment-by-segment spoken recitation exercises. Different riwāyāt may require distinct reviews.

## Suggested app data model

```ts
type VerseSegment = {
  verseKey: string;
  startWord: number; // 1-based, inclusive
  endWord: number;   // 1-based, inclusive
  pauseMark: string | null;
  displayStatus: 'pending_review' | 'approved' | 'rejected';
  stopStatus: 'pending_review' | 'approved' | 'rejected';
  restartWord?: number; // individually approved, not assumed equal to endWord+1
  reviewerId?: string;
  sourceEdition: string;
  riwayah: string;
  version: number;
};
```

## QA and editorial notes

- The candidate breaks are **not** certified waqf rulings and may need changes after direct comparison with the printed Madinah Mushaf and review of meanings, dependencies and ibtidāʾ.
- In 2:282, the no-symbol breaks are after **الْحَقُّ** (word 27), **الشُّهَدَاءِ** (word 65), and **تَرْتَابُوا** (word 95): useful visual workspaces, but **not published pause marks** in the viewed online edition.
- Present whole-ayah recitation even when an ayah is split over several visual pages. On-screen truncation is never a valid textual omission.
