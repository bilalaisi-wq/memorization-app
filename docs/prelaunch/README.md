# Ayah a Day: pre-launch review pack

November 10, 2026. Source inspected from `d4597e4`; the accompanying repair preserves unsupported legacy migration backups and unreadable legacy mirrors. No Quran text, FSRS settings, paid access rules or SQL schema changes.

1. **[GPT-ready feature breakdown](FEATURES-FOR-GPT.md)** — complete implemented/public/preview inventory, each game's mechanics and learning purpose, progression, accounts, audio, rewards, privacy and billing. Upload this Markdown file to GPT, or copy its text. A ready-to-use analysis prompt is at the end.
2. **[Bug findings and launch checks](BUGS-AND-LAUNCH-CHECKS.md)** — reproduced/fixed defects, current test evidence, hosted observations and external release gates.
3. **[Screenshots and responsive evidence](ui/README.md)** — current learner-facing labs at mobile/desktop widths; Chronicles correctly hidden.
4. **[Machine-readable test summary](validation.json)** and **[read-only hosted probes](hosted-probes.json)**.

Validation: **916 full-suite tests + 29 backend tests passed**, Edge Function types/build passed, 24 responsive checks passed. This is local automated evidence, not certification of hosted accounts, payments, reviewed religious content, privacy compliance or physical-device accessibility.

## Applying the recovery fix

Deploy this commit's frontend manually on Railway. The fix adds no migration or secret. Export device/account progress before deployment as usual. If an existing backup needs recovery, retain/download its raw bytes; do not clear localStorage as a repair shortcut. Core study can continue where canonical data is valid while unreadable compatibility mirrors remain untouched. A blocked initial migration requires explicit recovery of the preserved original records.

The responsive audit script now writes here by default rather than overwriting the older dated Phase 8 evidence. It requires a running local Vite server. No real learner accounts or payment transactions were created for this review.
