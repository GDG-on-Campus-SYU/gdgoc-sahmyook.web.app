import { constants, existsSync } from "node:fs";
import { copyFile, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export async function normalizeExportSegments(buildDir, exportDir) {
  let added = 0;
  for (const entry of await readdir(buildDir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".segment.rsc")) continue;
    const source = path.join(entry.parentPath, entry.name);
    const parts = path.relative(buildDir, source).split(path.sep);
    const routeEnd = parts.findIndex((part) => part.endsWith(".segments"));
    if (routeEnd < 0 || parts.length - routeEnd <= 2) continue;
    const route = parts.slice(0, routeEnd + 1).join(path.sep).slice(0, -".segments".length);
    const page = path.join(exportDir, route === "index" ? "" : route);
    const segment = parts.slice(routeEnd + 1);
    segment[segment.length - 1] = entry.name.slice(0, -".segment.rsc".length) + ".txt";
    // Next 16.4 converts only '/' to dots, leaving Windows subdirectories in its export.
    if (!existsSync(path.join(page, "__next." + segment.join(path.sep)))) continue;
    const canonical = path.join(page, "__next." + segment.join("."));
    try {
      await copyFile(source, canonical, constants.COPYFILE_EXCL);
      added++;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      if (!(await readFile(canonical)).equals(await readFile(source))) throw new Error(`Conflicting static asset: ${canonical}`);
    }
  }
  return added;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href && process.platform === "win32") {
  const added = await normalizeExportSegments(".next/server/app", "out");
  console.log(`Prepared ${added} Windows static segment file(s)`);
}
