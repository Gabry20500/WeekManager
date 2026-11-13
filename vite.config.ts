import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { defineConfig, type Plugin } from "vite";

/** Every file under `directory`, as paths relative to it with forward slashes. */
function listFiles(directory: string, root = directory): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? listFiles(path, root) : [relative(root, path).replaceAll("\\", "/")];
  });
}

/**
 * Writes `sw.js` into the build output from `src/sw.template.js`, filling in
 * the list of files to keep for offline use and a version derived from their
 * content, so a new build always replaces the previous cache.
 */
function serviceWorker(): Plugin {
  let outDir = "dist";
  return {
    name: "diario-service-worker",
    apply: "build",
    configResolved(config) {
      outDir = join(config.root, config.build.outDir);
    },
    closeBundle() {
      const template = readFileSync("src/sw.template.js", "utf8");
      const files = listFiles(outDir).filter((file) => file !== "sw.js");
      // The version changes with the app files and with the worker itself.
      const hash = createHash("sha256").update(template);
      for (const file of files.sort()) hash.update(file).update(readFileSync(join(outDir, file)));

      // The page itself is cached as "./", the URL the app is opened at.
      const urls = files.map((file) => (file === "index.html" ? "./" : file));
      const source = template
        .replace("__VERSION__", hash.digest("hex").slice(0, 12))
        .replace('"__FILES__"', JSON.stringify(urls));
      writeFileSync(join(outDir, "sw.js"), source);
    },
  };
}

export default defineConfig({
  // Relative paths, so the app works from any folder (e.g. GitHub Pages project sites).
  base: "./",
  plugins: [serviceWorker()],
});
