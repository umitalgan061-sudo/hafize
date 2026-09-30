import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(process.cwd());
const pub = join(root, "public");
const legacyDir = join(pub, "typed", "legacy");
const read = (p) => readFileSync(join(root, p), "utf8");
const check = (v, m) => assert.ok(v, "TYPESCRIPT_FRONTEND_COMPLETE_WAVE_FAILED: " + m);

const vite = read("vite.config.ts");
const html = read("public/index.html");
const server = read("server.ts");
const shell = read("public/typed/app-shell.ts");
const sw = read("public/sw.ts");
const policy = read("public/sw-policy.ts");
const pkg = JSON.parse(read("package.json"));

check(vite.includes("readdirSync(resolve(ROOT, 'public/typed/legacy'"), "Vite discovery");
check(vite.includes("...LEGACY_TYPED_ENTRIES"), "dynamic entries");
check(vite.includes("'sw': resolve(ROOT, 'public/sw.ts')"), "typed service worker entry");
check(pkg.scripts?.["check:modern"]?.includes("test-typescript-frontend-complete-wave.mjs"), "check wiring");
check(existsSync(join(pub, "sw.ts")), "root sw source");
check(existsSync(join(pub, "sw-policy.ts")), "root sw policy");
check(sw.includes("from './sw-policy.ts'"), "typed policy import");
check(!sw.includes("importScripts("), "no importScripts");
check(shell.includes("import.meta.env.DEV ? '/sw.ts' : '/sw.js'"), "root scope dev registration");
check(shell.includes("{ type: 'module' }"), "module service worker");
check(server.includes("decoded === '/sw.js' ? '/typed-build/sw.js' : decoded"), "production sw mapping");
check(policy.includes("v51"), "cache version");

for (const name of readdirSync(pub).filter((n) => n.endsWith(".js") && n !== "sw.js" && n !== "sw-policy.js")) {
  const source = readFileSync(join(pub, name), "utf8");
  const base = name.slice(0, -3);
  check(source.includes("import('/typed-build/"), "legacy bridge: " + name);
  check(source.length < 700, "bridge size: " + name);
  const core = ["conversation-workspace", "markdown-renderer", "message-workspace", "prompt-library", "scheduled-tasks"].includes(base);
  const candidates = core
    ? [join(pub, "typed", base + ".ts"), join(legacyDir, base + ".ts")]
    : [join(legacyDir, base + ".ts")];
  check(candidates.some(existsSync), "canonical TS: " + name);
  check(!html.includes("<script src=\"/" + name + "\""), "index legacy script: " + name);
}

for (const name of readdirSync(legacyDir).filter((n) => n.endsWith(".ts") && !n.endsWith(".test.ts"))) {
  const base = name.slice(0, -3);
  check(html.includes("/typed-build/legacy-" + base + ".js"), "bundle in index: " + name);
  check(vite.includes("legacy-" + base), "bundle in Vite: " + name);
}

console.log("TypeScript frontend completeness gate: OK");
