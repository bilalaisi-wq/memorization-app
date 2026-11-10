import { expect, test } from "@playwright/test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hash, safeRead } from "../scripts/validate-quran-release.mjs";
import {
  deployRelease,
  uploadAsset,
} from "../scripts/upload-quran-content.mjs";
const exec = promisify(execFile);

test("private importer offline integration: all juz, long-ayah source alignment, approvals, recovery, version migration and legacy preservation", async () => {
  test.setTimeout(120000);
  const { stderr } = await exec("python3", ["scripts/test_quran_import.py"], {
    timeout: 110000,
    maxBuffer: 1024 * 1024,
  });
  expect(stderr).toContain("Ran 14 tests");
  expect(stderr).toContain("OK");
});

test("immutable uploads skip identical remote bytes and reject conflicts without overwriting", async () => {
  const data = Buffer.from("canonical fixture"),
    sha256 = hash(data),
    calls = [];
  const request = async (path, o) => {
    calls.push(o.method);
    return new Response(data);
  };
  expect(
    await uploadAsset({
      request,
      path: "x",
      data,
      type: "application/json",
      sha256,
    }),
  ).toBe("unchanged");
  expect(calls).toEqual(["GET"]);
  await expect(
    uploadAsset({
      request: async () => new Response("different"),
      path: "x",
      data,
      type: "application/json",
      sha256,
    }),
  ).rejects.toThrow("conflict");
});

test("uploads are create-only and verify committed bytes before acknowledging", async () => {
  const data = Buffer.from("fixture"), sha256 = hash(data);
  let stored = false;
  const calls = [];
  const request = async (path, o) => {
    calls.push(o);
    if (o.method === "GET") {
      return stored ? new Response(data) : new Response("", { status: 404 });
    }
    expect(o.headers["x-upsert"]).toBe("false");
    stored = true;
    return new Response("{}", { status: 200 });
  };
  expect(
    await uploadAsset({
      request,
      path: "x",
      data,
      type: "application/json",
      sha256,
    }),
  ).toBe("uploaded");
  expect(calls.map((c) => c.method)).toEqual(["GET", "POST", "GET"]);
});

test("crash after remote commit resumes without uploading twice", async () => {
  const data = Buffer.from("fixture"), sha256 = hash(data);
  let stored = false, crash = true, posts = 0;
  const request = async (path, o) => {
    if (o.method === "POST") {
      posts++;
      stored = true;
      throw Error("connection lost after commit");
    }
    if (stored && crash) {
      crash = false;
      throw Error("interrupted");
    }
    return stored ? new Response(data) : new Response("", { status: 404 });
  };
  await expect(
    uploadAsset({ request, path: "x", data, type: "application/json", sha256 }),
  ).rejects.toThrow();
  crash = false;
  expect(
    await uploadAsset({
      request,
      path: "x",
      data,
      type: "application/json",
      sha256,
    }),
  ).toBe("unchanged");
  expect(posts).toBe(1);
});

test("concurrent create conflict is accepted only after verifying exact remote hash", async () => {
  const data = Buffer.from("fixture"), sha256 = hash(data);
  let gets = 0;
  const request = async (path, o) =>
    o.method === "POST"
      ? new Response("", { status: 409 })
      : ++gets === 1
      ? new Response("", { status: 404 })
      : new Response(data);
  expect(
    await uploadAsset({
      request,
      path: "x",
      data,
      type: "application/json",
      sha256,
    }),
  ).toBe("unchanged");
  gets = 0;
  await expect(uploadAsset({
    request: async (p, o) =>
      o.method === "POST"
        ? new Response("", { status: 409 })
        : ++gets === 1
        ? new Response("", { status: 404 })
        : new Response("other"),
    path: "x",
    data,
    type: "application/json",
    sha256,
  })).rejects.toThrow("conflict");
});

test("authorization failures do not become false upload receipts", async () => {
  for (const status of [401, 403, 500]) {
    await expect(uploadAsset({
      request: async () => new Response("", { status }),
      path: "x",
      data: Buffer.from("x"),
      type: "application/json",
      sha256: hash("x"),
    })).rejects.toThrow("Remote comparison failed");
  }
});

test("private release assets reject path traversal and symbolic-link escapes", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ayah-safe-release-"));
  try {
    await mkdir(join(dir, "release"));
    await writeFile(join(dir, "secret"), "private");
    await symlink(join(dir, "secret"), join(dir, "release", "escape"));
    for (
      const path of [
        "../secret",
        "/secret",
        "a/../secret",
        "a\\secret",
        "escape",
      ]
    ) await expect(safeRead(join(dir, "release"), path)).rejects.toThrow();
    await writeFile(join(dir, "release", "safe"), "fixture");
    expect((await safeRead(join(dir, "release"), "safe")).toString()).toBe(
      "fixture",
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("operator entry points default to no network and no credential requirement", async () => {
  const { stdout } = await exec("python3", [
    "scripts/prepare-quran-content.py",
    "--all",
    "--dry-run",
  ]);
  const plan = JSON.parse(stdout);
  expect(plan.references).toBe(6236);
  expect(plan.private).toBe(5665);
  expect(plan.freeDelegated).toBe(571);
  expect(plan.network).toBe(false);
  expect(plan.writes).toBe(false);
  const { stdout: free } = await exec("python3", [
    "scripts/prepare-quran-content.py",
    "--juz",
    "30",
  ]);
  expect(JSON.parse(free).private).toBe(0);
});

let candidateRoot;
test.beforeAll(async () => {
  candidateRoot = await mkdtemp(join(tmpdir(), "ayah-upload-release-"));
  await exec("python3", [
    "-c",
    "import sys,shutil;sys.path.insert(0,'scripts');from test_quran_import import ImportTests;t=ImportTests();t.setUp();r=t.prepare();assert t.validate(r).returncode==0;shutil.copytree(r,sys.argv[1],dirs_exist_ok=True);t.tearDown()",
    candidateRoot,
  ]);
});
test.afterAll(async () => {
  if (candidateRoot) await rm(candidateRoot, { recursive: true, force: true });
});

test("release upload dry run independently validates and requires neither credentials nor network", async () => {
  const result = await deployRelease(candidateRoot, {
    transport: () => {
      throw Error("No network allowed");
    },
  });
  expect(result.mode).toBe("dry-run");
  expect(result.assets).toBe(2);
  expect(result.activation).toBe("not-activated");
});

test("public bucket and browser credentials are rejected before uploading content", async () => {
  let calls = 0;
  await expect(
    deployRelease(candidateRoot, {
      upload: true,
      url: "https://project.supabase.co",
      key: "sb_publishable_test",
      transport: async () => {
        calls++;
        return new Response("{}");
      },
    }),
  ).rejects.toThrow("Backend service");
  expect(calls).toBe(0);
  await expect(
    deployRelease(candidateRoot, {
      upload: true,
      url: "https://project.supabase.co",
      key: "sb_secret_TEST_ONLY",
      transport: async () => new Response(JSON.stringify({ public: true })),
    }),
  ).rejects.toThrow("must exist and be private");
});

test("idempotent deployment verifies private bucket, local pins and remote bytes across interruption and rerun", async () => {
  const remote = new Map();
  let posts = 0;
  const transport = async (url, o) => {
    expect(o.redirect).toBe("error");
    expect(o.headers.apikey).toBe("sb_secret_TEST_ONLY");
    url = url.replace("/object/authenticated/", "/object/");
    if (url.includes("/bucket/")) {
      return new Response(JSON.stringify({ public: false }));
    }
    if (o.method === "POST") {
      expect(o.headers["x-upsert"]).toBe("false");
      posts++;
      remote.set(url, o.body);
      return new Response("{}");
    }
    return remote.has(url)
      ? new Response(remote.get(url))
      : new Response("", { status: 404 });
  };
  const options = {
    upload: true,
    url: "https://project.supabase.co",
    key: "sb_secret_TEST_ONLY",
    transport,
  };
  expect((await deployRelease(candidateRoot, options)).mode).toBe("uploaded");
  expect(posts).toBe(2);
  expect((await deployRelease(candidateRoot, options)).mode).toBe("uploaded");
  expect(posts).toBe(2);
  const journal = await readFile(
    join(candidateRoot, "upload-journal.json"),
    "utf8",
  );
  expect(journal).not.toContain("sb_secret");
  expect(Object.keys(JSON.parse(journal).completed)).toHaveLength(2);
  await expect(
    deployRelease(candidateRoot, {
      ...options,
      url: "https://different.supabase.co",
    }),
  ).rejects.toThrow("project/release mismatch");
});

test("stale upload manifests and malformed journals are preserved and rejected", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ayah-stale-release-"));
  try {
    const { cp } = await import("node:fs/promises");
    await cp(candidateRoot, dir, { recursive: true });
    const path = join(dir, "upload-manifest.json"),
      original = await readFile(path);
    await writeFile(path, "{}");
    await expect(deployRelease(dir)).rejects.toThrow("stale");
    expect((await readFile(path)).toString()).toBe("{}");
    await writeFile(path, original);
    await writeFile(join(dir, "upload-journal.json"), "malformed");
    await expect(
      deployRelease(dir, {
        upload: true,
        url: "https://project.supabase.co",
        key: "sb_secret_TEST_ONLY",
        transport: async () => new Response(JSON.stringify({ public: false })),
      }),
    ).rejects.toThrow("Malformed");
    expect((await readFile(join(dir, "upload-journal.json"))).toString()).toBe(
      "malformed",
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
