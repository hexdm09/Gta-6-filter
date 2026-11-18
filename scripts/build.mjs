import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { adapters } from "../src/sites/index.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = join(root, "dist");
const assets = join(root, "assets");
const icons = Object.fromEntries([16, 32, 48, 128].map((size) => [size, "icons/icon" + size + ".png"]));
const contentScripts = adapters.map(({ site, hosts }) => ({
  matches: hosts.map((host) => "https://" + host + "/*"),
  css: ["content.css", "gate-" + site + ".css"],
  js: ["content.js"],
  run_at: "document_start",
  world: "ISOLATED",
}));

async function bundle(entry, format) {
  const { outputFiles } = await build({
    entryPoints: [join(root, "src", entry + ".ts")],
    bundle: true,
    write: false,
    target: "es2022",
    charset: "utf8",
    format,
  });
  return outputFiles[0].contents;
}

const [content, popup] = await Promise.all([bundle("content", "iife"), bundle("popup", "esm")]);
const manifest = {
  manifest_version: 3,
  name: "__MSG_appName__",
  description: "__MSG_appDescription__",
  version: JSON.parse(await readFile(join(root, "package.json"), "utf8")).version,
  default_locale: "en",
  icons,
  action: { default_popup: "popup.html", default_title: "__MSG_appName__", default_icon: icons },
  permissions: ["storage"],
  content_scripts: contentScripts,
};

for (const target of ["chromium", "firefox"]) {
  const output = join(dist, target);
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  const targetManifest = target === "firefox" ? {
    ...manifest,
    browser_specific_settings: {
      gecko: {
        id: "gta6-filter@gta6filter.local",
        strict_min_version: "140.0",
        data_collection_permissions: { required: ["none"] },
      },
    },
  } : manifest;
  await Promise.all([
    writeFile(join(output, "manifest.json"), JSON.stringify(targetManifest, null, 2) + "\n"),
    writeFile(join(output, "content.js"), content),
    writeFile(join(output, "popup.js"), popup),
    ...["content.css", "popup.html", "popup.css", "_locales", "icons"].map((name) =>
      cp(join(assets, name), join(output, name), { recursive: true })),
    ...adapters.map(({ site, cards }) =>
      writeFile(join(output, "gate-" + site + ".css"),
        ':root:not([data-gta6f-off]) :is(' + cards + '):not([data-gta6f-state="open"]) {\n  display: none !important;\n}\n')),
  ]);
  console.log("Built " + output);
}
