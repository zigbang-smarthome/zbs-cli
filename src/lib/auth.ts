/**
 * Login + session management for zbs.zigbang.in.
 *
 * Auth model (much simpler than EAC — no SSO):
 *   - POST /biz/login/procLogin.json with LOGIN_ID + SECRET_NO (form-urlencoded)
 *   - Server returns Set-Cookie: JSESSIONID=<sid>; HttpOnly
 *   - Subsequent calls just need the cookie
 *
 * Password sources (priority order):
 *   1. $ZBS_PASSWORD env (cron / one-shot use)
 *   2. macOS Keychain: `security add-generic-password -s zbs-cli -a <loginId> -w <pw>`
 *      Set automatically on `zbs login` if no env override.
 *
 * Session expiry: server doesn't publish TTL. Java Servlet default = 30min idle.
 * On any noAuth response we re-login once if a password is available.
 */

import { execSync, spawnSync } from "node:child_process";
import { saveSession, loadSession, clearSession } from "./config.ts";
import { AuthError, ApiError } from "./errors.ts";
import type { SessionContext, ZbsEnvelope } from "../types/index.ts";

const BASE = "https://zbs.zigbang.in";
const LOGIN_PATH = "/biz/login/procLogin.json";
const KEYCHAIN_SERVICE = "zbs-cli";

export interface LoginResult {
  jsessionid: string;
  envelope: ZbsEnvelope;
}

/** Extract JSESSIONID from a Set-Cookie header. */
function parseSetCookie(setCookie: string | null): string | null {
  if (!setCookie) return null;
  const m = setCookie.match(/JSESSIONID=([^;]+)/);
  return m ? m[1]! : null;
}

/** Raw POST to procLogin.json. Throws AuthError on bad credentials. */
export async function rawLogin(loginId: string, password: string): Promise<LoginResult> {
  const body = new URLSearchParams({ LOGIN_ID: loginId, SECRET_NO: password });
  const res = await fetch(BASE + LOGIN_PATH, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest",
      "User-Agent": "zbs-cli",
    },
    body,
    redirect: "manual",
  });

  const text = await res.text();
  if (res.status !== 200) {
    throw new ApiError(LOGIN_PATH, res.status, text.slice(0, 300), text);
  }

  let env: ZbsEnvelope;
  try { env = JSON.parse(text); }
  catch { throw new ApiError(LOGIN_PATH, res.status, "response is not JSON", text); }

  if (env.resultCode !== "success") {
    throw new AuthError(`login failed: ${env.resultCode} — ${env.resultMsg ?? "unknown"}`);
  }

  const sid = parseSetCookie(res.headers.get("set-cookie"));
  if (!sid) throw new AuthError("login succeeded but no JSESSIONID cookie returned");

  return { jsessionid: sid, envelope: env };
}

// ── Keychain (macOS) ────────────────────────────────────────────────

function isMac(): boolean {
  return process.platform === "darwin";
}

export function keychainSet(loginId: string, password: string): void {
  if (!isMac()) {
    throw new AuthError("password keychain is only supported on macOS — use $ZBS_PASSWORD env on this platform");
  }
  // -U updates if exists; suppress prompt by passing -w on the command line.
  // Note: the password ends up briefly in argv. Acceptable for a single-user dev box.
  spawnSync("security", [
    "add-generic-password",
    "-U",
    "-s", KEYCHAIN_SERVICE,
    "-a", loginId,
    "-w", password,
  ], { stdio: "ignore" });
}

export function keychainGet(loginId: string): string | null {
  if (!isMac()) return null;
  try {
    const out = execSync(
      `security find-generic-password -s "${KEYCHAIN_SERVICE}" -a "${loginId}" -w 2>/dev/null`,
      { encoding: "utf-8" },
    );
    return out.trim() || null;
  } catch {
    return null;
  }
}

export function keychainDelete(loginId: string): void {
  if (!isMac()) return;
  spawnSync("security", [
    "delete-generic-password",
    "-s", KEYCHAIN_SERVICE,
    "-a", loginId,
  ], { stdio: "ignore" });
}

// ── High-level: login & ensureSession ───────────────────────────────

/** Resolve a password from env or keychain. Returns null if neither has one. */
export function resolvePassword(loginId: string): string | null {
  if (process.env.ZBS_PASSWORD) return process.env.ZBS_PASSWORD;
  return keychainGet(loginId);
}

/** Read a line from TTY. If `mask` is true, characters are not echoed. */
async function readLine(prompt: string, mask: boolean): Promise<string> {
  if (!process.stdin.isTTY) {
    throw new AuthError(`stdin is not a TTY — cannot prompt for "${prompt.trim()}" interactively`);
  }
  process.stderr.write(prompt);
  const wasRaw = process.stdin.isRaw;
  process.stdin.setRawMode?.(true);
  process.stdin.resume();

  let input = "";
  return await new Promise<string>((resolve, reject) => {
    const onData = (chunk: Buffer) => {
      const s = chunk.toString("utf-8");
      for (const ch of s) {
        const code = ch.charCodeAt(0);
        if (code === 0x0d || code === 0x0a) {
          cleanup();
          process.stderr.write("\n");
          resolve(input);
          return;
        }
        if (code === 0x03) { // Ctrl-C
          cleanup();
          process.stderr.write("\n");
          reject(new AuthError("aborted"));
          return;
        }
        if (code === 0x7f || code === 0x08) {
          if (input.length) {
            input = input.slice(0, -1);
            if (!mask) process.stderr.write("\b \b");
          }
          continue;
        }
        input += ch;
        if (!mask) process.stderr.write(ch);
      }
    };
    const cleanup = () => {
      process.stdin.off("data", onData);
      process.stdin.setRawMode?.(wasRaw);
      process.stdin.pause();
    };
    process.stdin.on("data", onData);
  });
}

export async function promptUsername(): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const v = (await readLine("Username: ", false)).trim();
    if (v) return v;
    process.stderr.write("Username is required.\n");
  }
  throw new AuthError("username not provided after 3 attempts");
}

export async function promptPassword(): Promise<string> {
  return await readLine("Password: ", true);
}

/**
 * Perform a fresh login and persist the session. Saves password to keychain
 * unless using $ZBS_PASSWORD env (caller-managed).
 *
 * Resolution order for loginId: explicit opts > $ZBS_LOGIN_ID env > interactive prompt.
 * Resolution order for password: explicit opts > $ZBS_PASSWORD env > Keychain > prompt.
 */
export async function login(opts: { loginId?: string; password?: string; saveToKeychain?: boolean; interactive?: boolean }): Promise<SessionContext> {
  const loginId = opts.loginId
    ?? process.env.ZBS_LOGIN_ID
    ?? (opts.interactive
        ? await promptUsername()
        : (() => { throw new AuthError("loginId required — pass --id, set $ZBS_LOGIN_ID, or run `zbs login` interactively"); })());
  const password = opts.password ?? resolvePassword(loginId) ?? await promptPassword();

  const { jsessionid, envelope } = await rawLogin(loginId, password);

  if (opts.saveToKeychain !== false && !process.env.ZBS_PASSWORD && isMac()) {
    keychainSet(loginId, password);
  }

  const ctx: SessionContext = {
    jsessionid,
    loginId,
    ssEmplyrId: envelope.ssEmplyrId,
    ssUserNm: envelope.ssUserNm,
    ssAuthCode: envelope.ssAuthCode,
    ssOrgnztNm: envelope.ssOrgnztNm,
    savedAt: new Date().toISOString(),
  };
  await saveSession(ctx);
  return ctx;
}

/** Load existing session. If absent, error out asking the user to run `zbs login` first. */
export async function ensureSession(): Promise<SessionContext> {
  const cached = await loadSession();
  if (cached?.jsessionid) return cached;
  throw new AuthError("no session — run `zbs login` first");
}

/** Re-login using cached loginId + resolved password. Used for noAuth retry. */
export async function reloginCached(): Promise<SessionContext> {
  const cached = await loadSession();
  if (!cached?.loginId) {
    throw new AuthError("session expired and no cached loginId — run `zbs login` again");
  }
  const password = resolvePassword(cached.loginId);
  if (!password) {
    throw new AuthError(
      `session expired and no password available for ${cached.loginId}. ` +
      `Run \`zbs login\` interactively or set $ZBS_PASSWORD.`,
    );
  }
  return await login({ loginId: cached.loginId, password, saveToKeychain: false });
}

export async function logout(): Promise<void> {
  const cached = await loadSession();
  await clearSession();
  if (cached?.loginId) keychainDelete(cached.loginId);
}
