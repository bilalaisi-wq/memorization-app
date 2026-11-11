import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sha = (data) => createHash("sha256").update(data).digest("hex");
export async function buildInfo(
  { directory = root, environment = process.env, clock = () => new Date() } =
    {},
) {
  const git = (args) => {
    try {
      return execFileSync("git", args, {
        cwd: directory,
        stdio: ["ignore", "pipe", "ignore"],
        encoding: "utf8",
      }).trim();
    } catch {
      return null;
    }
  };
  const commit = environment.RAILWAY_GIT_COMMIT_SHA ||
    git(["rev-parse", "HEAD"]);
  const snake = await readFile(
      resolve(directory, "src/puzzles/arcade/snake/engine.js"),
      "utf8",
    ),
    runner = await readFile(
      resolve(directory, "src/puzzles/arcade/cosmic/flow-runner.js"),
      "utf8",
    );
  const number = (text, name) => {
    const value = text.match(new RegExp(name + "\\s*[:=]\\s*([0-9.]+)"));
    return value ? Number(value[1]) : null;
  };
  return {
    schemaVersion: 1,
    commit: /^[a-f0-9]{40,64}$/.test(commit || "") ? commit : "unknown",
    builtAt: clock().toISOString(),
    sourceHashes: { snake: sha(snake), starRunner: sha(runner) },
    games: {
      snake: {
        boostMultiplier: number(snake, "multiplier"),
        boostDurationMs: number(snake, "durationMs"),
        boostCooldownMs: number(snake, "cooldownMs"),
      },
      starRunner: {
        normalFlightRate: number(runner, "NORMAL_FLIGHT_RATE"),
        boostMultiplier: number(runner, "BOOST_MULTIPLIER"),
      },
    },
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const output = resolve(root, "dist");
  await mkdir(output, { recursive: true });
  await writeFile(
    resolve(output, "build-info.json"),
    JSON.stringify(await buildInfo(), null, 2) + "\n",
  );
}
