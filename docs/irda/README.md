# iRDA prelaunch improvements

- [Implementation, module map and learner controls](prelaunch-improvements.md)
- [Validation and remaining release checks](validation.md)
- [Desktop/mobile screenshot gallery](screenshots.md)

## Defect audit

| Finding | Resolution |
| --- | --- |
| Repeated completion checks could earn again after the short cooldown | Once-per-run completion guards and stable per-workspace/day reward receipts; 16-earned-XP recall threshold retained |
| Mode clicks during a delayed studio import could be lost | Queue the last selection; conceal study text when opening independent recall |
| Interleaved Latin text contaminated copyable assembled Arabic | Separate the exact Arabic line from its source-backed Latin reading strip |
| Wrong checks were easy to miss; some edits left stale feedback | Shared explicit check/X feedback; preserve arrangements; clear stale outcomes when pieces move |
| Long Blocks runs silently recycled the physics board | Bounded active board with source-ordered archived floors, manual inspection and resumable per-ayah section checkpoints |
| Grouped counts could label 26 pieces as 26 words in a 128-word ayah | Distinct piece and canonical source-word counters |
| Five-word labels could overflow a narrow board | Wrap Arabic without splitting words; clamp labels within the board; respond to resizing without changing physics |
| Active floor could scroll out of the progress rail | Follow the active floor on paint/container resize; explicit inspection disables follow until returning |
| New runs could overwrite a checkpoint from an older source revision | Archive prior metadata in the exportable store before replacing the active revision |
| Some games lacked source-backed reading aids | Shared optional transliteration, with bounded companion panels for small objects and readable inline choices elsewhere |
| Small Star Runner targets make phone transliteration hard to read | Lane-labelled phone companion panel using the original source strings; original desktop cards retained |
| Partial/missing group pronunciation could be misleading | Require complete source mappings; show unavailable status instead of inventing or emitting partial pronunciation |

## Release scope

No canonical Arabic, approved recitation boundaries, FSRS parameters, entitlement policies or historical game IDs are changed. No new Supabase migration is required for this work. Native signing, store/sandbox billing and live Supabase authorization remain separate operator validation gates.
