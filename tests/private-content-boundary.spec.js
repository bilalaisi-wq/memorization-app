import { expect, test } from "@playwright/test";
import { build, createServer as createVite } from "vite";
import { createServer } from "node:http";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
const configFile = resolve("scripts/private-vite.config.mjs");
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "ayah-private-boundary-"));
  for (const name of [".quran-private", ".recitation-evaluation"]) {
    await mkdir(join(root, name));
    await writeFile(
      join(root, name, "probe.json"),
      JSON.stringify({ sentinel: "TEST_ONLY_PRIVATE_SENTINEL" }),
    );
  }
  await writeFile(join(root, ".env"), "TEST_ONLY_SECRET=not-real");
  await writeFile(
    join(root, "index.html"),
    '<h1>Free app</h1><script type="module" src="/main.js"></script>',
  );
  await writeFile(join(root, "main.js"), 'document.body.dataset.ready="true"');
  return root;
}
test("Vite refuses private files through static, raw and absolute routes while free app stays accessible", async () => {
  const root = await fixture();
  let vite, server;
  try {
    vite = await createVite({
      root,
      configFile,
      logLevel: "silent",
      server: { middlewareMode: true, hmr: false },
    });
    server = createServer(vite.middlewares);
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    const origin = "http://127.0.0.1:" + server.address().port;
    for (
      const path of [
        "/.quran-private/probe.json",
        "/.quran-private/probe.json?raw",
        "/.quran-private/probe.json?import",
        "/.recitation-evaluation/probe.json",
        "/.env",
        "/@fs/" + join(root, ".quran-private/probe.json"),
      ]
    ) {
      const response = await fetch(origin + path);
      expect([403, 404], path).toContain(response.status);
      expect(await response.text()).not.toContain("TEST_ONLY_PRIVATE_SENTINEL");
    }
    expect((await fetch(origin + "/")).status).toBe(200);
    expect((await fetch(origin + "/main.js")).status).toBe(200);
  } finally {
    await new Promise((r) => server ? server.close(r) : r());
    await vite?.close();
    await rm(root, { recursive: true, force: true });
  }
});
test("production bundle rejects protected imports and retains valid free builds", async () => {
  const root = await fixture();
  try {
    const valid = await build({
      root,
      configFile,
      logLevel: "silent",
      build: { write: false },
    });
    expect(
      valid.output.every((a) =>
        !String(a.code || a.source || "").includes("TEST_ONLY_PRIVATE_SENTINEL")
      ),
    ).toBe(true);
    await writeFile(
      join(root, "main.js"),
      'import data from "./.quran-private/probe.json";console.log(data)',
    );
    await expect(
      build({ root, configFile, logLevel: "silent", build: { write: false } }),
    ).rejects.toThrow("Protected operator content");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test("copied protected directories in public assets fail the build before copying", async () => {
  const root = await fixture();
  try {
    await mkdir(join(root, "public/.quran-private"), { recursive: true });
    await writeFile(join(root, "public/.quran-private/probe.json"), "{}");
    await expect(
      build({ root, configFile, logLevel: "silent", build: { write: false } }),
    ).rejects.toThrow("Protected operator directory");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
