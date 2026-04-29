import { describe, test, expect, beforeEach, afterEach, spyOn } from "bun:test";
import { printList, printObject, pickFormat } from "../src/lib/output.ts";

let stdoutBuf = "";
let stderrBuf = "";
let outSpy: ReturnType<typeof spyOn>;
let errSpy: ReturnType<typeof spyOn>;

function captureStdout() {
  stdoutBuf = "";
  stderrBuf = "";
  outSpy = spyOn(process.stdout, "write").mockImplementation(((chunk: any) => {
    stdoutBuf += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf-8");
    return true;
  }) as any);
  errSpy = spyOn(process.stderr, "write").mockImplementation(((chunk: any) => {
    stderrBuf += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf-8");
    return true;
  }) as any);
}

beforeEach(captureStdout);
afterEach(() => {
  outSpy.mockRestore();
  errSpy.mockRestore();
});

describe("pickFormat", () => {
  test("explicit flags win over TTY/pipe", () => {
    expect(pickFormat({ json: true })).toBe("json");
    expect(pickFormat({ csv: true })).toBe("csv");
    expect(pickFormat({ plain: true })).toBe("tsv");
  });
});

describe("printList — json", () => {
  test("emits the rows array verbatim", () => {
    printList([{ a: 1, b: "x" }, { a: 2, b: "y" }], { json: true });
    const parsed = JSON.parse(stdoutBuf);
    expect(parsed).toEqual([{ a: 1, b: "x" }, { a: 2, b: "y" }]);
  });
});

describe("printList — csv", () => {
  test("starts with UTF-8 BOM, escapes quotes/commas/newlines", () => {
    printList(
      [{ name: 'a,b', desc: 'c"d', note: "e\nf" }],
      { csv: true, columns: ["name", "desc", "note"] },
    );
    expect(stdoutBuf.charCodeAt(0)).toBe(0xfeff); // BOM
    // single record but contains an embedded newline in the last field
    const body = stdoutBuf.slice(1).trimEnd();
    expect(body).toBe('name,desc,note\n"a,b","c""d","e\nf"');
  });
  test("empty list still emits BOM", () => {
    printList([], { csv: true });
    expect(stdoutBuf.charCodeAt(0)).toBe(0xfeff);
  });
});

describe("printList — tsv", () => {
  test("collapses tabs/newlines in values", () => {
    printList(
      [{ a: "x\ty", b: "p\nq" }],
      { plain: true, columns: ["a", "b"] },
    );
    const lines = stdoutBuf.trimEnd().split("\n");
    expect(lines[0]).toBe("a\tb");
    expect(lines[1]).toBe("x y\tp q");
  });
});

describe("printList — column selection", () => {
  test("explicit columns override row keys and ordering", () => {
    printList(
      [{ a: 1, b: 2, c: 3 }],
      { plain: true, columns: ["c", "a"] },
    );
    const lines = stdoutBuf.trimEnd().split("\n");
    expect(lines[0]).toBe("c\ta");
    expect(lines[1]).toBe("3\t1");
  });
  test("derives columns from first row when not specified", () => {
    printList([{ x: 10, y: 20 }], { plain: true });
    expect(stdoutBuf.split("\n")[0]).toBe("x\ty");
  });
});

describe("printList — null handling", () => {
  test("null/undefined become empty strings, objects JSON-stringified", () => {
    printList(
      [{ a: null, b: undefined, c: { nested: 1 } }],
      { plain: true, columns: ["a", "b", "c"] },
    );
    const lines = stdoutBuf.trimEnd().split("\n");
    expect(lines[1]).toBe('\t\t{"nested":1}');
  });
});

describe("printList — empty result", () => {
  test("non-csv writes (no rows) hint to stderr", () => {
    printList([], { plain: true });
    expect(stdoutBuf).toBe("");
    expect(stderrBuf).toContain("no rows");
  });
});

describe("printObject — json", () => {
  test("serializes object", () => {
    printObject({ a: 1, b: "x" }, { json: true });
    expect(JSON.parse(stdoutBuf)).toEqual({ a: 1, b: "x" });
  });
  test("non-json writes key\\tvalue per line", () => {
    printObject({ a: 1, b: "x" });
    const lines = stdoutBuf.trimEnd().split("\n");
    expect(lines).toContain("a\t1");
    expect(lines).toContain("b\tx");
  });
});
