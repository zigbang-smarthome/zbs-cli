/**
 * Per-user state stored under ~/.config/zbs/.
 *
 *   session.json — JSESSIONID + last-known session context (ss* fields)
 *
 * Password is NOT stored here. It comes from $ZBS_PASSWORD or macOS Keychain
 * (zbs-cli service). See lib/auth.ts.
 */

import { join } from "node:path";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { homedir } from "node:os";
import type { SessionContext } from "../types/index.ts";

const CONFIG_DIR = join(homedir(), ".config", "zbs");
const SESSION_FILE = join(CONFIG_DIR, "session.json");

export async function ensureConfigDir(): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true });
}

export async function loadSession(): Promise<SessionContext | null> {
  try {
    const content = await readFile(SESSION_FILE, "utf-8");
    return JSON.parse(content) as SessionContext;
  } catch {
    return null;
  }
}

export async function saveSession(s: SessionContext): Promise<void> {
  await ensureConfigDir();
  await writeFile(SESSION_FILE, JSON.stringify(s, null, 2) + "\n", { mode: 0o600 });
}

export async function clearSession(): Promise<void> {
  try { await unlink(SESSION_FILE); } catch {}
}

export function sessionPath(): string {
  return SESSION_FILE;
}
