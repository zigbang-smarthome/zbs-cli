import { describe, test, expect } from "bun:test";
import { asPillar, pillarParam, PILLAR_TO_CODE } from "../src/lib/pillar.ts";

describe("asPillar", () => {
  test("accepts canonical names", () => {
    expect(asPillar("idp")).toBe("idp");
    expect(asPillar("hms")).toBe("hms");
  });
  test("accepts ZBS code aliases", () => {
    expect(asPillar("ddl")).toBe("idp");
    expect(asPillar("DDL")).toBe("idp");
    expect(asPillar("HN")).toBe("hms");
  });
  test("undefined when blank", () => {
    expect(asPillar(undefined)).toBeUndefined();
    expect(asPillar("")).toBeUndefined();
  });
  test("throws on garbage", () => {
    expect(() => asPillar("foo")).toThrow();
  });
});

describe("pillarParam", () => {
  test("maps to endpoint-specific param key", () => {
    expect(pillarParam("idp", "searchPrdtgrpCode")).toEqual({ searchPrdtgrpCode: "DDL" });
    expect(pillarParam("hms", "searchPrductGroupCode")).toEqual({ searchPrductGroupCode: "HN" });
    expect(pillarParam("idp", "prdtgrp_code")).toEqual({ prdtgrp_code: "DDL" });
  });
  test("returns empty object when pillar undefined", () => {
    expect(pillarParam(undefined, "anything")).toEqual({});
  });
});

describe("PILLAR_TO_CODE", () => {
  test("matches doc §7.5", () => {
    expect(PILLAR_TO_CODE).toEqual({ idp: "DDL", hms: "HN" });
  });
});
