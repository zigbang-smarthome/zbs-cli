#!/usr/bin/env node

import { spawnSync } from "child_process";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const binName = process.platform === "win32" ? "zbs.exe" : "zbs";
const bin = path.join(__dirname, "native", binName);

if (!existsSync(bin)) {
  await import("./install.js");
}
const result = spawnSync(bin, process.argv.slice(2), { stdio: "inherit" });
process.exit(result.status ?? 1);
