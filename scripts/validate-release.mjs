import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const extensionDir = path.join(root, "extension");
const manifest = JSON.parse(fs.readFileSync(path.join(extensionDir, "manifest.json"), "utf8"));
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const config = fs.readFileSync(path.join(extensionDir, "js", "config.js"), "utf8");

function fail(message) {
  console.error(`Release validation failed: ${message}`);
  process.exitCode = 1;
}

if (manifest.manifest_version !== 3) fail("manifest_version must be 3");
if (manifest.version !== pkg.version) fail(`manifest version ${manifest.version} does not match package version ${pkg.version}`);

const backendMatch = config.match(/DEFAULT_OAUTH_BACKEND\s*=\s*["']([^"']+)["']/);
if (!backendMatch?.[1]) fail("DEFAULT_OAUTH_BACKEND must be set for a release build");
else if (!backendMatch[1].startsWith("https://")) fail("DEFAULT_OAUTH_BACKEND must use HTTPS");

const hosts = manifest.host_permissions || [];
if (hosts.some((host) => host.includes("localhost") || host.includes("127.0.0.1"))) fail("release host_permissions must not contain localhost development origins");
if (hosts.some((host) => host.includes("*.workers.dev"))) fail("release host_permissions must use the exact OAuth Worker host, not a workers.dev wildcard");
if (!hosts.includes("https://api.notion.com/*")) fail("Notion API host permission is missing");
if (!hosts.includes("https://tabs2notion-oauth.nikolaskaralis.workers.dev/*")) fail("production OAuth Worker host permission is missing");

function pngSize(file) {
  const data = fs.readFileSync(file);
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (data.length < 24 || !data.subarray(0, 8).equals(signature)) throw new Error(`${file} is not a valid PNG`);
  return [data.readUInt32BE(16), data.readUInt32BE(20)];
}

for (const size of [16, 32, 48, 128]) {
  const icon = path.join(extensionDir, "icons", `icon${size}.png`);
  if (!fs.existsSync(icon)) {
    fail(`missing ${path.relative(root, icon)}`);
    continue;
  }
  try {
    const [width, height] = pngSize(icon);
    if (width !== size || height !== size) fail(`icon${size}.png must be ${size}x${size}, got ${width}x${height}`);
  } catch (error) {
    fail(error.message);
  }
}

const iconEntries = fs.readdirSync(path.join(extensionDir, "icons"));
const unexpectedIcons = iconEntries.filter((name) => !["icon16.png", "icon32.png", "icon48.png", "icon128.png"].includes(name));
if (unexpectedIcons.length) fail(`remove unexpected files from extension/icons: ${unexpectedIcons.join(", ")}`);

for (const htmlName of fs.readdirSync(extensionDir).filter((name) => name.endsWith(".html"))) {
  const html = fs.readFileSync(path.join(extensionDir, htmlName), "utf8");
  if (/<script[^>]+src=["']https?:\/\//i.test(html)) fail(`${htmlName} contains remotely hosted executable JavaScript`);
}

if (!process.exitCode) console.log(`Release validation passed for Tabs2Notion ${manifest.version}.`);
