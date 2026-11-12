// Apply to development, preview and builds; do not serve or bundle operator data.
import { defineConfig } from "vite";
import {offlineManifestPlugin} from "./offline-vite-plugin.mjs";
import { existsSync, realpathSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
const protectedPath =
  /(?:^|[\\/])\.(?:quran-private|recitation-evaluation)(?:[\\/]|$)/;
let viteRoot, publicRoot;
export default defineConfig({
  server: {
    fs: {
      // Retain Vite's default denies when extending this list.
      deny: [
        ".env",
        ".env.*",
        "*.{crt,pem}",
        "**/.git/**",
        "**/.quran-private/**",
        "**/.recitation-evaluation/**",
      ],
    },
  },
  plugins: [offlineManifestPlugin(), {
    name: "private-learning-assets-boundary",
    enforce: "pre",
    configResolved(config) {
      viteRoot = config.root;
      publicRoot = config.publicDir || null;
    },
    buildStart() {
      if (!publicRoot) return;
      for (const name of [".quran-private", ".recitation-evaluation"]) {
        if (existsSync(resolve(publicRoot, name))) {
          throw Error("Protected operator directory found in public assets");
        }
        const path = resolve(viteRoot, name);
        if (existsSync(path)) {
          const target = realpathSync(path),
            inside = relative(publicRoot, target);
          if (!inside || !inside.startsWith(".." + sep) && inside !== "..") {
            throw Error(
              "Protected operator directory resolves inside public assets",
            );
          }
        }
      }
    },
    load(id) {
      if (protectedPath.test(id)) {
        throw Error(
          "Protected operator content cannot enter the Vite module graph",
        );
      }
    },
  }],
});
