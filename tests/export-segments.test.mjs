import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { normalizeExportSegments } from "../scripts/normalize-export-segments.mjs";

test("copies only generated nested page segments and never overwrites an existing asset", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "gdgoc-export-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const build = path.join(root, "app");
  const out = path.join(root, "out");
  const generated = path.join(build, "projects", "detail.segments", "projects", "detail");
  const page = path.join(out, "projects", "detail");
  const nested = path.join(page, "__next.projects", "detail");
  await mkdir(generated, { recursive: true });
  await mkdir(nested, { recursive: true });
  await writeFile(path.join(generated, "__PAGE__.segment.rsc"), "fixture");
  await writeFile(path.join(nested, "__PAGE__.txt"), "fixture");
  await writeFile(path.join(nested, "unrelated.txt"), "other");
  const expected = path.join(page, "__next.projects.detail.__PAGE__.txt");
  assert.equal(await normalizeExportSegments(build, out), 1);
  assert.equal(await readFile(expected, "utf8"), "fixture");
  await assert.rejects(readFile(path.join(page, "__next.projects.detail.unrelated.txt")), { code: "ENOENT" });
  assert.equal(await normalizeExportSegments(build, out), 0);
  await writeFile(expected, "unrelated existing asset");
  await assert.rejects(normalizeExportSegments(build, out), /Conflicting static asset/);
  assert.equal(await readFile(expected, "utf8"), "unrelated existing asset");
});
