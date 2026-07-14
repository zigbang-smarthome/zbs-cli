import https from "https";
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const REPO = "zigbang-smarthome/zbs-cli";

const PLATFORMS = {
  "darwin-x64":   { artifact: "zbs-darwin-x64",   ext: ".tar.gz", bin: "zbs" },
  "darwin-arm64": { artifact: "zbs-darwin-arm64", ext: ".tar.gz", bin: "zbs" },
  "linux-x64":    { artifact: "zbs-linux-x64",    ext: ".tar.gz", bin: "zbs" },
  "linux-arm64":  { artifact: "zbs-linux-arm64",  ext: ".tar.gz", bin: "zbs" },
  "win32-x64":    { artifact: "zbs-win32-x64",    ext: ".zip",    bin: "zbs.exe" },
};

function download(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        return download(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    });
  });
}

function extract(archivePath, ext, cwd) {
  if (ext === ".zip") {
    const res = spawnSync(
      "powershell.exe",
      ["-NoProfile", "-Command", `Expand-Archive -LiteralPath "${archivePath}" -DestinationPath "${cwd}" -Force`],
      { stdio: "ignore" },
    );
    if (res.status !== 0) throw new Error(`Expand-Archive failed with status ${res.status}`);
    return;
  }
  const res = spawnSync("tar", ["xzf", archivePath], { cwd, stdio: "ignore" });
  if (res.status !== 0) throw new Error(`tar extraction failed with status ${res.status}`);
}

if (process.env.CI) process.exit(0);

const platform = `${process.platform}-${process.arch}`;
const info = PLATFORMS[platform];
if (!info) {
  console.error(`Unsupported platform: ${platform}`);
  process.exit(1);
}

const nativeDir = path.join(__dirname, "native");
const binPath = path.join(nativeDir, info.bin);

if (!fs.existsSync(binPath)) {
  const { version } = require("../package.json");
  if (version) {
    const { artifact, ext } = info;
    const url = `https://github.com/${REPO}/releases/download/v${version}/${artifact}${ext}`;
    console.info(`Downloading zbs v${version} for ${platform}...`);

    const data = await download(url);
    fs.mkdirSync(nativeDir, { recursive: true });

    const tmp = path.join(nativeDir, `tmp${ext}`);
    fs.writeFileSync(tmp, data);
    extract(tmp, ext, nativeDir);
    fs.unlinkSync(tmp);

    if (process.platform !== "win32") {
      fs.chmodSync(binPath, 0o755);
    }
    console.info("Installed successfully.");
  }
}
