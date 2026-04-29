import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";

/**
 * Mock the auth + config modules BEFORE importing client, so the import-time
 * resolution picks up the stubs. Bun's `mock.module` swaps in a synthetic module.
 */

let ensureSessionCalls = 0;
let reloginCalls = 0;
let savedSessions: any[] = [];
let currentSession = { jsessionid: "SID-1", loginId: "test-user" };
let nextSessionAfterRelogin = { jsessionid: "SID-2", loginId: "test-user" };

mock.module("../src/lib/auth.ts", () => ({
  ensureSession: async () => {
    ensureSessionCalls++;
    return currentSession;
  },
  reloginCached: async () => {
    reloginCalls++;
    currentSession = nextSessionAfterRelogin;
    return currentSession;
  },
}));

mock.module("../src/lib/config.ts", () => ({
  saveSession: async (s: any) => { savedSessions.push(s); },
}));

const { postJson } = await import("../src/lib/client.ts");

// fetch stub state — push responses onto the queue, dequeue per call
type FakeResp = { status: number; body: string; location?: string };
let fetchQueue: FakeResp[] = [];
let fetchCalls: { url: string; init: RequestInit | undefined }[] = [];

function makeRes(r: FakeResp): Response {
  // Build a Response shim matching the parts client.ts uses (status / text / headers.get)
  return {
    status: r.status,
    text: async () => r.body,
    arrayBuffer: async () => new TextEncoder().encode(r.body).buffer,
    headers: {
      get: (k: string) => k.toLowerCase() === "location" ? (r.location ?? null) : null,
    },
  } as unknown as Response;
}

beforeEach(() => {
  ensureSessionCalls = 0;
  reloginCalls = 0;
  savedSessions = [];
  currentSession = { jsessionid: "SID-1", loginId: "test-user" };
  nextSessionAfterRelogin = { jsessionid: "SID-2", loginId: "test-user" };
  fetchQueue = [];
  fetchCalls = [];
  globalThis.fetch = (async (url: any, init: any) => {
    fetchCalls.push({ url: String(url), init });
    const r = fetchQueue.shift();
    if (!r) throw new Error(`unexpected fetch: ${url}`);
    return makeRes(r);
  }) as any;
});

afterEach(() => {
  // best-effort restore
  delete (globalThis as any).fetch;
});

describe("postJson — happy path", () => {
  test("returns parsed envelope on 200/success", async () => {
    fetchQueue.push({
      status: 200,
      body: JSON.stringify({ resultCode: "success", resultList: [{ a: 1 }] }),
    });
    const env = await postJson("/biz/x.json", { foo: "bar" });
    expect(env.resultCode).toBe("success");
    expect(env.resultList).toEqual([{ a: 1 }]);
    expect(ensureSessionCalls).toBe(1);
    expect(reloginCalls).toBe(0);
    expect(fetchCalls.length).toBe(1);
    expect((fetchCalls[0]!.init as any).headers.Cookie).toBe("JSESSIONID=SID-1");
  });
});

describe("postJson — noAuth retry", () => {
  test("resultCode=noAuth triggers one re-login + retry", async () => {
    fetchQueue.push({
      status: 200,
      body: JSON.stringify({ resultCode: "noAuth", resultMsg: "expired" }),
    });
    fetchQueue.push({
      status: 200,
      body: JSON.stringify({ resultCode: "success", resultList: [], ssEmplyrId: "USR_X" }),
    });
    const env = await postJson("/biz/x.json");
    expect(env.resultCode).toBe("success");
    expect(reloginCalls).toBe(1);
    expect(fetchCalls.length).toBe(2);
    expect((fetchCalls[1]!.init as any).headers.Cookie).toBe("JSESSIONID=SID-2");
    // ss* fields persisted on retry success
    expect(savedSessions.length).toBe(1);
    expect(savedSessions[0].ssEmplyrId).toBe("USR_X");
  });

  test("302 -> /noAuth.json also triggers re-login", async () => {
    fetchQueue.push({ status: 302, body: "", location: "/combiz/error/noAuth.json" });
    fetchQueue.push({
      status: 200,
      body: JSON.stringify({ resultCode: "success", resultList: [{ ok: 1 }] }),
    });
    const env = await postJson("/biz/x.json");
    expect(env.resultList).toEqual([{ ok: 1 }]);
    expect(reloginCalls).toBe(1);
  });
});

describe("postJson — failures surface as ApiError", () => {
  test("non-200 throws", async () => {
    fetchQueue.push({ status: 500, body: "boom" });
    await expect(postJson("/biz/x.json")).rejects.toThrow(/biz\/x\.json.*500/);
  });
  test("non-JSON 200 throws", async () => {
    fetchQueue.push({ status: 200, body: "<html>error</html>" });
    await expect(postJson("/biz/x.json")).rejects.toThrow(/not JSON/);
  });
  test("resultCode=fail surfaces resultMsg", async () => {
    fetchQueue.push({
      status: 200,
      body: JSON.stringify({ resultCode: "fail", resultMsg: "validation broke" }),
    });
    await expect(postJson("/biz/x.json")).rejects.toThrow(/validation broke/);
  });
});

describe("postJson — request shape", () => {
  test("form-urlencodes the body", async () => {
    fetchQueue.push({
      status: 200,
      body: JSON.stringify({ resultCode: "success", resultList: [] }),
    });
    await postJson("/biz/x.json", { foo: "bar baz", n: "1" });
    const sent = (fetchCalls[0]!.init as any).body as URLSearchParams;
    expect(sent.toString()).toBe("foo=bar+baz&n=1");
    expect((fetchCalls[0]!.init as any).method).toBe("POST");
    const headers = (fetchCalls[0]!.init as any).headers;
    expect(headers["Content-Type"]).toMatch(/application\/x-www-form-urlencoded/);
    expect(headers["X-Requested-With"]).toBe("XMLHttpRequest");
  });
});
