import { describe, test, expect, beforeEach, afterEach, spyOn } from "bun:test";
import { isoDate, today, parseDuration, sinceRange, explicitRange } from "../src/lib/since.ts";

describe("isoDate", () => {
  test("formats with zero padding", () => {
    expect(isoDate(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(isoDate(new Date(2026, 11, 31))).toBe("2026-12-31");
  });
});

describe("parseDuration", () => {
  test("d / h / m / s", () => {
    expect(parseDuration("7d")).toBe(7 * 86400_000);
    expect(parseDuration("2h")).toBe(2 * 3600_000);
    expect(parseDuration("30m")).toBe(30 * 60_000);
    expect(parseDuration("45s")).toBe(45 * 1000);
  });
  test("whitespace tolerated", () => {
    expect(parseDuration(" 7 d ")).toBe(7 * 86400_000);
  });
  test("rejects garbage", () => {
    expect(() => parseDuration("7days")).toThrow();
    expect(() => parseDuration("abc")).toThrow();
    expect(() => parseDuration("")).toThrow();
  });
});

describe("sinceRange / explicitRange", () => {
  let fixed: Date;
  let spy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    fixed = new Date(2026, 3, 29, 12, 0, 0); // 2026-04-29 local noon
    spy = spyOn(Date, "now").mockReturnValue(fixed.getTime());
  });
  afterEach(() => {
    spy.mockRestore();
  });

  test("today() honors mocked clock", () => {
    expect(today()).toBe("2026-04-29");
  });

  test("sinceRange('7d') resolves to today and 7 days back", () => {
    const r = sinceRange("7d");
    expect(r.to).toBe("2026-04-29");
    expect(r.from).toBe("2026-04-22");
  });

  test("sinceRange('2h') still floors to a date — same day", () => {
    const r = sinceRange("2h");
    expect(r.to).toBe("2026-04-29");
    expect(r.from).toBe("2026-04-29");
  });

  test("explicitRange prefers explicit args", () => {
    const r = explicitRange("2026-01-01", "2026-02-01", "7d");
    expect(r).toEqual({ from: "2026-01-01", to: "2026-02-01" });
  });

  test("explicitRange falls back to since when both blank", () => {
    const r = explicitRange(undefined, undefined, "7d");
    expect(r).toEqual({ from: "2026-04-22", to: "2026-04-29" });
  });

  test("explicitRange fills missing 'to' with today", () => {
    const r = explicitRange("2026-04-01", undefined, "7d");
    expect(r).toEqual({ from: "2026-04-01", to: "2026-04-29" });
  });
});
