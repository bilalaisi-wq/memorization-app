import { expect, test } from "@playwright/test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  BATCHES,
  dashboard,
  releaseStatus,
  summarizeRelease,
} from "../scripts/quran-release-status.mjs";
import { auditQuran } from "../scripts/audit-quran-manifest.mjs";
const exec = promisify(execFile);
test("release order covers every remaining juz once and all exact canonical boundaries remain intact", async () => {
  expect(Object.values(BATCHES).flat()).toEqual(
    Array.from({ length: 29 }, (_, i) => 29 - i),
  );
  const a = await auditQuran(), r = summarizeRelease(a);
  expect(r.references).toBe(6236);
  expect(r.perJuz).toHaveLength(30);
  expect(r.perJuz.flatMap((j) => j.references)).toHaveLength(6236);
  expect(r.perJuz[28].expected).toBe(431);
  expect(r.perJuz[28].first).toBe("67:1");
  expect(r.perJuz[28].last).toBe("77:50");
  expect(r.perJuz[29].existingFree).toBe(564);
  expect(r.perJuz[0].existingFree).toBe(7);
  expect(r.newlyReleased).toBe(0);
  expect(r.perJuz.every((j) => j.releaseStatus !== "released")).toBe(true);
  expect(dashboard(r)).not.toMatch(/[\u0600-\u06ff]/);
});
test("failed deployments and unvalidated candidates cannot masquerade as released content", async () => {
  const a = await auditQuran(),
    r = summarizeRelease(a, {
      candidates: [{
        id: "test",
        juzs: [29],
        status: "present-validation-not-run",
      }],
      attempts: [{ juz: 29, status: "failed", reason: "network unavailable" }],
    });
  expect(r.perJuz[28].deployment).toBe("failed");
  expect(r.perJuz[28].releaseStatus).toBe("blocked");
  expect(r.perJuz[28].rights).toBe("not-attested");
  expect(r.perJuz[28].sourceReview).toBe("not-attested");
  const bad = structuredClone(a);
  bad.manifest.verses[1].key = bad.manifest.verses[0].key;
  expect(() => summarizeRelease(bad)).toThrow("canonical");
});
test("batch previews are offline and executing without evidence fails before downloads or uploads", async () => {
  for (const batch of Object.keys(BATCHES)) {
    const { stdout } = await exec("python3", [
      "scripts/stage-quran-batches.py",
      "--batch",
      batch,
    ]);
    const p = JSON.parse(stdout);
    expect(p.network).toBe(false);
    expect(p.writes).toBe(false);
    expect(p.juzs.map((j) => j.juz)).toEqual(BATCHES[batch]);
  }
  await expect(
    exec("python3", [
      "scripts/stage-quran-batches.py",
      "--batch",
      "A",
      "--prepare",
    ]),
  ).rejects.toThrow("Blocked");
});
