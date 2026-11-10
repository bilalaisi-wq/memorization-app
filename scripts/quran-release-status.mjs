// Operator dashboard only. Local presence or upload receipts never imply publication.
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { auditQuran } from "./audit-quran-manifest.mjs";
import { validateRelease } from "./validate-quran-release.mjs";
export const BATCHES = {
  A: [29],
  B: [28, 27, 26],
  C: [25, 24, 23, 22, 21],
  D: [20, 19, 18, 17, 16, 15, 14, 13, 12, 11],
  E: [10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
};
export function summarizeRelease(
  audit,
  { candidates = [], attempts = [] } = {},
) {
  const verses = audit.manifest.verses;
  const approved = new Set(
    candidates.filter((c) => c.status === "independently-validated-local")
      .flatMap((c) => c.references || []),
  );
  if (
    verses.length !== 6236 || new Set(verses.map((v) => v.key)).size !== 6236 ||
    new Set(verses.map((v) => v.surah)).size !== 114
  ) throw Error("Invalid canonical coverage");
  const preparedEntries = new Map(
    candidates.filter((c) => c.status === "independently-validated-local")
      .flatMap((c) => c.entries || []).map((e) => [e.key, e]),
  );
  const juzs = Array.from({ length: 30 }, (_, i) => {
    const juz = i + 1,
      rows = verses.filter((v) => v.juz === juz),
      privateRows = rows.filter((v) => v.policy !== "free");
    const latest = attempts.filter((a) => a.juz === juz).at(-1) || null;
    return {
      schemaVersion: 1,
      juz,
      batch: Object.entries(BATCHES).find(([, js]) => js.includes(juz))?.[0] ||
        "existing-free",
      first: rows[0].key,
      last: rows.at(-1).key,
      expected: rows.length,
      preparedValidated: rows.filter((v) =>
        v.stages.validated || approved.has(v.key)
      ).length,
      existingFree: rows.filter((v) => v.policy === "free").length,
      localValidated: rows.filter((v) => v.stages.validated).length,
      missingAyahs: rows.filter((v) =>
        !v.stages.validated && !approved.has(v.key)
      ).map((v) => v.key),
      assetIssues: rows.filter((v) =>
        v.missingRequired.length || v.issues.length
      ).map((v) => ({
        key: v.key,
        missing: v.missingRequired,
        issues: v.issues,
      })),
      rights:
        privateRows.length && privateRows.every((v) => approved.has(v.key))
          ? "documented-in-validated-candidates"
          : "not-attested",
      sourceReview: "not-attested",
      deployment: latest?.status === "failed"
        ? "failed"
        : latest?.status === "storage-verified"
        ? "storage-verified-edge-tests-pending"
        : "not-verified",
      candidates: candidates.filter((c) => c.juzs?.includes(juz)),
      latestAttempt: latest,
      releaseStatus: privateRows.length ? "blocked" : "existing-free-preserved",
      outstanding: [
        "Independent reference/edition attestation",
        "Documented commercial reuse and attribution",
        "Required source review",
        "Verified private staging upload",
        "Authenticated/unauthorized Edge Function tests",
        "Desktop/mobile authorized-content tests",
        "Explicit release approval",
      ],
      references: rows.map((v) => ({
        key: v.key,
        juz: v.juz,
        wordCount: preparedEntries.get(v.key)?.wordCount ?? v.wordCount,
        candidateValidated: approved.has(v.key),
        sourceVersion: preparedEntries.get(v.key)?.sourceVersion || null,
        bundleSha256: preparedEntries.get(v.key)?.sha256 || v.hashes.bundle ||
          null,
        sourceSha256: v.contentHash || null,
        fullAudioSha256: preparedEntries.get(v.key)?.audioSha256 ||
          v.assets.fullAyahAudio?.sha256 || null,
        localValidated: v.stages.validated,
        missing: v.missingRequired,
        issues: v.issues,
      })),
    };
  });
  return {
    schemaVersion: 1,
    numbering: "Existing Quran.com catalog: 6236 canonical ayahs",
    surahs: 114,
    juzs: 30,
    references: 6236,
    localValidated: verses.filter((v) => v.stages.validated).length,
    preparedValidated:
      verses.filter((v) => v.stages.validated || approved.has(v.key)).length,
    missing:
      verses.filter((v) => !v.stages.validated && !approved.has(v.key)).length,
    newlyReleased: 0,
    batches: BATCHES,
    issues: audit.issues,
    candidates,
    candidateIssues: candidates.filter((c) =>
      c.status === "invalid-or-incomplete-preserved"
    ),
    sourceProvenance: audit.provenance,
    checks: {
      missingAyahs: juzs.flatMap((j) => j.missingAyahs),
      duplicateAyahs: audit.issues.filter((i) =>
        /duplicate|overlap/.test(i.kind)
      ),
      inconsistentWordCounts: verses.filter((v) =>
        v.issues.some((i) => /word-count|word.*alignment/.test(i))
      ).map((v) => v.key),
      missingTranslations: verses.filter((v) =>
        !v.assets.translation?.present && !approved.has(v.key)
      ).map((v) => v.key),
      missingWordMeanings: verses.filter((v) =>
        !v.assets.wordMeanings?.present && !approved.has(v.key)
      ).map((v) => v.key),
      missingAudio: verses.filter((v) =>
        !v.assets.fullAyahAudio?.present && !approved.has(v.key)
      ).map((v) => v.key),
      incompleteRights: (audit.provenance?.sources || []).filter((s) =>
        s.rights?.commercialUse !== true || !s.rights?.evidence?.length
      ).map((s) => s.id),
      unvalidatedSourceRevisions: verses.filter((v) =>
        v.policy !== "free" && !approved.has(v.key)
      ).map((v) => v.key),
      failedStagedDeployments: attempts.filter((a) => a.status === "failed"),
    },
    perJuz: juzs,
    freePolicy:
      "Al-Fatihah and Juz Amma remain unrestricted; no availability changes",
    publication: "not-executed",
  };
}
export async function releaseStatus(
  { privateRoot = resolve(".quran-private"), validateCandidates = false } = {},
) {
  const audit = await auditQuran({ privateRoot }), candidates = [];
  let attempts = [];
  try {
    for (
      const dir of await readdir(resolve(privateRoot, "candidates"), {
        withFileTypes: true,
      })
    ) {
      if (!dir.isDirectory() || !/^[a-f0-9]{24}$/.test(dir.name)) continue;
      const root = resolve(privateRoot, "candidates", dir.name);
      try {
        const selection = JSON.parse(
            await readFile(resolve(root, "selection.json"), "utf8"),
          ),
          juzs = [
            ...new Set(
              selection.references.map((k) =>
                audit.manifest.verses.find((v) => v.key === k)?.juz
              ),
            ),
          ];
        if (validateCandidates) {
          await validateRelease(root);
          const prepared = JSON.parse(
            await readFile(resolve(root, "manifest.json"), "utf8"),
          );
          candidates.push({
            id: dir.name,
            juzs,
            status: "independently-validated-local",
            sourceVersion: selection.sourceVersion,
            references: selection.references,
            entries: prepared.verses.map((v) => ({
              key: v.key,
              wordCount: preparedEntries.get(v.key)?.wordCount ?? v.wordCount,
              candidateValidated: approved.has(v.key),
              sourceVersion: preparedEntries.get(v.key)?.sourceVersion || null,
              sha256: v.sha256,
              audioSha256: v.audioSha256,
              sourceVersion: v.sourceVersion || null,
            })),
          });
        } else {candidates.push({
            id: dir.name,
            juzs,
            status: "present-validation-not-run",
            sourceVersion: selection.sourceVersion,
            references: selection.references,
          });}
      } catch {
        candidates.push({
          id: dir.name,
          juzs: [],
          status: "invalid-or-incomplete-preserved",
        });
      }
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  try {
    const journal = JSON.parse(
      await readFile(resolve(privateRoot, "staging-attempts.json"), "utf8"),
    );
    if (journal.schemaVersion !== 1 || !Array.isArray(journal.attempts)) {
      throw Error("Malformed staging journal; preserve for recovery");
    }
    attempts = journal.attempts.map((a) => ({
      juz: a.juz,
      status: a.status,
      releaseId: a.releaseId || null,
      reason: a.reason || null,
    }));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  return summarizeRelease(audit, { candidates, attempts });
}
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c]),
  );
export function dashboard(report) {
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Qur’an release status</title><style>body{font:18px system-ui;background:#10172e;color:#e8ecff;margin:0;padding:24px}main{max-width:1100px;margin:auto}section{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:16px}article{background:#202c4c;border:1px solid #5b729b;padding:20px;border-radius:18px}progress{width:100%;accent-color:#6ee1d0}strong{color:#ffe098}a{color:#91efe1}p{line-height:1.5}summary{cursor:pointer}</style><main><h1>Qur’an release status</h1><p>114 surahs · 30 juz · 6,236 canonical ayahs. ${report.localValidated} locally validated; ${report.missing} missing. <strong>No new content published.</strong></p><p>Al-Fatihah and Juz Amma remain free. Local integrity, rights review, staging and publication are separate gates. This operator dashboard contains references and hashes, never private Qur’anic text.</p><section>${
    report.perJuz.map((j) =>
      `<article><h2>Juz ${j.juz} · ${esc(j.batch)}</h2><p>${esc(j.first)} → ${
        esc(j.last)
      }</p><progress value="${j.localValidated}" max="${j.expected}" aria-label="Local validated ayahs in Juz ${j.juz}"></progress><p>${j.localValidated}/${j.expected} existing local · ${j.preparedValidated}/${j.expected} prepared · ${j.existingFree} existing free</p><strong>${
        esc(j.releaseStatus)
      }</strong><p>Deployment: ${
        esc(j.deployment)
      }</p><details><summary>Release gates</summary><ul>${
        j.outstanding.map((x) => `<li>${esc(x)}</li>`).join("")
      }</ul></details><p><a href="juz-${j.juz}.json">Per-juz manifest and provenance</a></p></article>`
    ).join("")
  }</section></main></html>`;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const args = process.argv.slice(2);
  if (args.some((a) => a !== "--validate-candidates")) {
    throw Error(
      "Usage: node scripts/quran-release-status.mjs [--validate-candidates]",
    );
  }
  try {
    const report = await releaseStatus({
        validateCandidates: args.includes("--validate-candidates"),
      }),
      out = resolve("content-audit/releases");
    await mkdir(out, { recursive: true });
    await writeFile(
      resolve(out, "status.json"),
      JSON.stringify(
        {
          ...report,
          perJuz: report.perJuz.map((
            { references, assetIssues, missingAyahs, ...summary },
          ) => ({
            ...summary,
            missingAyahCount: missingAyahs.length,
            assetIssueCount: assetIssues.length,
            manifestFile: `juz-${summary.juz}.json`,
          })),
        },
        null,
        2,
      ) + "\n",
    );
    for (const j of report.perJuz) {
      await writeFile(
        resolve(out, `juz-${j.juz}.json`),
        (() => {
          const { references, assetIssues, ...metadata } = j;
          return JSON.stringify(
            { ...metadata, assetIssueCount: assetIssues.length },
            null,
            2,
          ).slice(0, -2) + ',\n  "references": [\n' + references.map((r) =>
            "    " + JSON.stringify(r)
          ).join(",\n") + "\n  ]\n}\n";
        })(),
      );
    }
    await writeFile(resolve(out, "index.html"), dashboard(report));
    console.log(
      JSON.stringify({
        surahs: 114,
        juzs: 30,
        references: 6236,
        localValidated: report.localValidated,
        missing: report.missing,
        newlyReleased: 0,
        dashboard: "content-audit/releases/index.html",
      }),
    );
  } catch (error) {
    const out = resolve("content-audit/releases");
    await mkdir(out, { recursive: true });
    const category = /duplicate|overlap/i.test(error.message)
      ? "duplicate-or-overlapping-references"
      : "invalid-audit-input";
    const failure = {
      schemaVersion: 1,
      status: "blocked",
      category,
      publication: "not-executed",
      action:
        "Preserve the original manifests and journals; inspect duplicate references or malformed inputs. Historical per-juz reports are not current validation.",
    };
    const previous = resolve(out, "status.json");
    try {
      const raw = await readFile(previous);
      if (JSON.parse(raw).perJuz) {
        await writeFile(resolve(out, "status.previous.json"), raw);
      }
    } catch {}
    await writeFile(previous, JSON.stringify(failure, null, 2) + "\n");
    await writeFile(
      resolve(out, "index.html"),
      `<!doctype html><html lang="en"><meta charset="utf-8"><title>Release audit blocked</title><h1>Release audit blocked</h1><p>${category}. No publication performed. Preserve original inputs; historical per-juz reports do not establish current validation.</p></html>`,
    );
    console.error("Release audit blocked: " + category);
    process.exitCode = 1;
  }
}
