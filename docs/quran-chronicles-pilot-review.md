# QUR'AN CHRONICLES — pilot editorial record

## User-provided identity and source preferences

- Editorial contact / pilot owner: **Bilal Ahmad**.
- Provisional review contact: **Bilal Ahmad**. Relevant reviewer qualifications have not yet been recorded, and completed scholarly review is **pending**. Naming a contact is not an approval event.
- The owner plans to find reviewers for the cards. No reviewer credentials, review date or approved lesson text have been invented.
- Preferred references supplied by the owner: **Tafsir Ibn Kathir**, **Tafsir Al-Jalalayn** and **Tafsir Al-Muyassar**.

These are accepted reference preferences for the pilot. They are not imported published lessons or a license grant from a particular edition's publisher. A reference can inform original reviewed writing without reproducing a modern translation or edition's wording.

## Edition and reuse checks still needed

The underlying medieval Arabic works and modern translations/editions must be distinguished. Availability online, permission to consult/cite a reference, and permission to redistribute a specific text are different questions. Record the exact edition/language, the material actually reproduced, its license/permission or applicable public-domain/original-writing basis, and required attribution. Do not assume a modern Al-Muyassar edition or a modern English translation has the same status as the underlying classical works.

Candidate reference locations attempted during this task:

- https://quran.ksu.edu.sa/tafseer/katheer/sura112-aya1.html
- https://quran.ksu.edu.sa/tafseer/jalalayn/sura112-aya1.html
- https://quran.ksu.edu.sa/tafseer/muyassar/sura112-aya1.html
- https://qurancomplex.gov.sa/

The execution environment's proxy returned HTTP 403 for these connections. Their page contents, edition details and reuse terms were **not verified in this run**. They are research starting points, not evidence of a commercial text license. No text was copied from those sites.

## Current publication state

Actual Juz Amma comprehension cards still need to be authored against identified sources and approved by an assigned reviewer. The application supports draft preview now; public publication remains gated. The mechanics fixtures and authoring scaffold are not approved religious content.

For Bilal Ahmad's initial author/publisher assignment (without granting reviewer approval), see [the account-specific setup SQL](../supabase/CHRONICLES_SETUP_BILAL.sql). It uses the previously provided verified owner email only to locate the Auth UUID. Confirm that account in Supabase before running it. Qualified reviewers must receive their own role assignments after their identity/qualifications are verified.

## Exact references subsequently supplied by the owner

These replace the earlier candidate locations as the preferred editions/hosts:

| Reference | Owner-supplied location | Verification status |
| --- | --- | --- |
| Ibn Kathir | https://www.qtafsir.com/ | Proxy CONNECT rejected with HTTP 403, including a retried request. Contents, translator/edition and reuse terms not inspected. |
| Al-Jalalayn, English PDF | https://www.qalamlib.com/book_files/pdf/en/tafsir-al-jalalain-Eng-PDF.pdf | Proxy CONNECT rejected with HTTP 403. Front matter, translator/edition and reuse terms not inspected. |
| Al-Tafsir Al-Muyassar translations | https://tulayhah.wordpress.com/al-tafsir-al-muyassar-translation-index/ | Proxy CONNECT rejected with HTTP 403. Index entries, translators, coverage and reuse terms not inspected. |

The authoring scaffold now includes these exact source records. License, attribution and actual lesson wording remain unfilled; no blanket rights grant or scholarly approval is inferred from the links. For each card, staff must choose the source(s) actually supporting it and fill an exact passage/page locator. Remove unused source records from a particular lesson. An index/root URL alone is not a passage locator. Original summaries based on accessible source information should be distinguished from copying a translation verbatim.

The owner was asked for relevant Al-Ikhlas passages and edition reuse notices because the linked material could not be retrieved here. No religious explanation or historical report has been invented to fill that gap.

The owner subsequently confirmed that no copyright/reuse notices are available to provide. This is recorded as **unverified**, not as either a grant or a denial. A formal notice is not the only possible reuse basis: staff may document an applicable public-domain basis or original editorial writing with citations and no reproduction of third-party translation wording. The actual material and edition still need to be checked; the links alone do not supply reviewed lesson text. No further notice is presumed to exist.
