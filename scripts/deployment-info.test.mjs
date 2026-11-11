import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildInfo } from "./write-build-info.mjs";
test("build information identifies actual game settings without exposing environment credentials", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ayah-release-"));
  try {
    await mkdir(join(dir, "src/puzzles/arcade/snake"), { recursive: true });
    await mkdir(join(dir, "src/puzzles/arcade/cosmic"), { recursive: true });
    await writeFile(
      join(dir, "src/puzzles/arcade/snake/engine.js"),
      "const boost={multiplier:1.6,durationMs:5000,cooldownMs:2000}",
    );
    await writeFile(
      join(dir, "src/puzzles/arcade/cosmic/flow-runner.js"),
      "export const NORMAL_FLIGHT_RATE=.7;export const BOOST_MULTIPLIER=4.851;",
    );
    const info = await buildInfo({
      directory: dir,
      environment: {
        RAILWAY_GIT_COMMIT_SHA: "a".repeat(40),
        SUPABASE_SERVICE_ROLE_KEY: "TEST_ONLY_SECRET",
      },
      clock: () => new Date("2026-11-11T00:00:00Z"),
    });
    assert.equal(info.commit, "a".repeat(40));
    assert.equal(info.games.snake.boostDurationMs, 5000);
    assert.equal(info.games.starRunner.boostMultiplier, 4.851);
    assert.equal(info.games.starRunner.normalFlightRate, .7);
    assert.match(info.sourceHashes.snake, /^[a-f0-9]{64}$/);
    assert.equal(JSON.stringify(info).includes("TEST_ONLY_SECRET"), false);
    assert.equal(
      JSON.stringify(info).includes("SUPABASE_SERVICE_ROLE_KEY"),
      false,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("invalid deployment commit metadata is never reported as a verified revision", async () => {
  const info = await buildInfo({
    environment: { RAILWAY_GIT_COMMIT_SHA: "not-a-commit" },
  });
  assert.equal(info.commit, "unknown");
  assert.equal(info.games.snake.boostMultiplier, 1.6);
});
