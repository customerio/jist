// Send-time validation demo: the backend checks an in-app message with the
// SAME compiled jist-core the devices render it with — the wasm module the
// web SDK already ships. No SDK, no browser, plain Node.
//
// Run from the repo root (after `npm run build:wasm` in web/):
//   node web/examples/server-validate.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const core = await import(path.join(webDir, "src/wasm/jist_core.js"));
await core.default(fs.readFileSync(path.join(webDir, "src/wasm/jist_core_bg.wasm")));

const check = (label, json) => {
  try {
    const t = core.parse_template(json);
    console.log(`✓ ${label}: OK — root=${t.root.type}, parses identically to iOS/Android/web`);
  } catch (e) {
    console.log(`✗ ${label}: REJECTED at send time — ${e}`);
  }
};

check("valid campaign message", JSON.stringify({
  version: "1",
  root: { type: "layout", direction: "vertical", children: [
    { type: "heading", name: "title" }, { type: "button", name: "cta" },
  ]},
}));
check("truncated payload (bad cache/CDN)", '{"version":"1","root":{"type":"lay');
check("malformed by composer bug", '{"version":1,"root":[]}');
