/**
 * ZBS portal HTTP client.
 *
 * All authenticated calls are POST + form-urlencoded + Cookie: JSESSIONID.
 * Server returns the standard envelope (see types/index.ts).
 *
 * noAuth handling: if the response is a 302 to /noAuth.json or the body has
 * resultCode === "noAuth", we re-login once via auth.reloginCached() and retry.
 */

import { ApiError } from "./errors.ts";
import { ensureSession, reloginCached } from "./auth.ts";
import { saveSession } from "./config.ts";
import type { ZbsEnvelope, SessionContext } from "../types/index.ts";

export const BASE = "https://zbs.zigbang.in";

function commonHeaders(jsessionid: string): Record<string, string> {
  return {
    Cookie: `JSESSIONID=${jsessionid}`,
    "User-Agent": "zbs-cli",
    Accept: "application/json,text/plain,*/*",
    "X-Requested-With": "XMLHttpRequest",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    Origin: BASE,
    Referer: `${BASE}/biz/main/main.esvc`,
  };
}

interface RawResult {
  status: number;
  text: string;
  redirected: boolean;
  location: string | null;
}

async function rawPost(jsessionid: string, path: string, fields: Record<string, string>): Promise<RawResult> {
  const body = new URLSearchParams(fields);
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: commonHeaders(jsessionid),
    body,
    redirect: "manual",
  });
  const text = await res.text();
  return {
    status: res.status,
    text,
    redirected: res.status === 301 || res.status === 302,
    location: res.headers.get("location"),
  };
}

function isNoAuth(r: RawResult, parsed: ZbsEnvelope | null): boolean {
  if (r.redirected && r.location && /noAuth\.json/.test(r.location)) return true;
  if (parsed?.resultCode === "noAuth") return true;
  return false;
}

/**
 * POST a JSON endpoint and return the parsed envelope.
 * Auto re-login + retry once on noAuth.
 */
export async function postJson(path: string, fields: Record<string, string> = {}): Promise<ZbsEnvelope> {
  let session = await ensureSession();
  let r = await rawPost(session.jsessionid, path, fields);

  let parsed: ZbsEnvelope | null = null;
  if (r.status === 200) {
    try { parsed = JSON.parse(r.text) as ZbsEnvelope; } catch { /* fall through */ }
  }

  if (isNoAuth(r, parsed)) {
    session = await reloginCached();
    r = await rawPost(session.jsessionid, path, fields);
    parsed = null;
    if (r.status === 200) {
      try { parsed = JSON.parse(r.text) as ZbsEnvelope; } catch { /* fall through */ }
    }
    // Refresh ss* context if present
    if (parsed && (parsed.ssEmplyrId || parsed.ssAuthCode)) {
      const updated: SessionContext = {
        ...session,
        ssEmplyrId: parsed.ssEmplyrId ?? session.ssEmplyrId,
        ssUserNm: parsed.ssUserNm ?? session.ssUserNm,
        ssAuthCode: parsed.ssAuthCode ?? session.ssAuthCode,
        ssOrgnztNm: parsed.ssOrgnztNm ?? session.ssOrgnztNm,
      };
      await saveSession(updated);
    }
  }

  if (r.status !== 200) {
    throw new ApiError(path, r.status, r.text.slice(0, 400), r.text);
  }
  if (!parsed) {
    throw new ApiError(path, r.status, "response is not JSON", r.text);
  }
  if (parsed.resultCode === "fail") {
    throw new ApiError(path, r.status, parsed.resultMsg ?? "fail", r.text);
  }
  return parsed;
}

/**
 * GET a binary file (used for /biz/support/downloadFile.json etc.).
 * Returns { filename, data } where filename comes from Content-Disposition if present.
 */
export async function getBinary(path: string): Promise<{ filename: string | null; data: Buffer }> {
  let session = await ensureSession();

  const doFetch = async (sid: string) => {
    return await fetch(BASE + path, {
      method: "GET",
      headers: {
        Cookie: `JSESSIONID=${sid}`,
        "User-Agent": "zbs-cli",
        Referer: `${BASE}/biz/main/main.esvc`,
      },
      redirect: "manual",
    });
  };

  let res = await doFetch(session.jsessionid);
  if (res.status === 302 && /noAuth\.json/.test(res.headers.get("location") ?? "")) {
    session = await reloginCached();
    res = await doFetch(session.jsessionid);
  }
  if (res.status !== 200) {
    const body = await res.text();
    throw new ApiError(path, res.status, body.slice(0, 300), body);
  }

  const cd = res.headers.get("content-disposition") ?? "";
  let filename: string | null = null;
  // RFC 5987 (filename*=UTF-8''xxx) takes precedence; fallback to plain filename=
  const star = cd.match(/filename\*\s*=\s*([^']+)''([^;]+)/i);
  if (star) {
    try { filename = decodeURIComponent(star[2]!); } catch { filename = star[2]!; }
  } else {
    const plain = cd.match(/filename\s*=\s*"?([^";]+)"?/i);
    if (plain) filename = plain[1]!;
  }

  const buf = Buffer.from(await res.arrayBuffer());
  return { filename, data: buf };
}
