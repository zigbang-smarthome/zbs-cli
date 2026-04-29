/**
 * Output formatters.
 *
 *   --json            raw JSON.stringify of the resultList (envelope stripped)
 *   --csv             UTF-8 with BOM for Excel compatibility
 *   --plain (or pipe) TSV
 *   default (TTY)     pretty box-drawn table
 */

export type Format = "table" | "tsv" | "json" | "csv";

export interface OutputOpts {
  json?: boolean;
  csv?: boolean;
  plain?: boolean;
  /** Subset of columns to show (in this order). Falsy = use all keys from first row. */
  columns?: string[];
}

export function pickFormat(opts: OutputOpts): Format {
  if (opts.json) return "json";
  if (opts.csv) return "csv";
  if (opts.plain) return "tsv";
  return process.stdout.isTTY ? "table" : "tsv";
}

function toStr(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function csvEscape(s: string): string {
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function visualWidth(s: string): number {
  // 1 cell for ASCII, 2 for most CJK / fullwidth ranges.
  let w = 0;
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    if (
      (cp >= 0x1100 && cp <= 0x115f) ||
      (cp >= 0x2e80 && cp <= 0x9fff) ||
      (cp >= 0xa000 && cp <= 0xa4cf) ||
      (cp >= 0xac00 && cp <= 0xd7a3) ||
      (cp >= 0xf900 && cp <= 0xfaff) ||
      (cp >= 0xfe30 && cp <= 0xfe4f) ||
      (cp >= 0xff00 && cp <= 0xff60) ||
      (cp >= 0xffe0 && cp <= 0xffe6)
    ) w += 2;
    else w += 1;
  }
  return w;
}

function padRight(s: string, w: number): string {
  return s + " ".repeat(Math.max(0, w - visualWidth(s)));
}

function deriveColumns(rows: Record<string, unknown>[], cols?: string[]): string[] {
  if (cols && cols.length) return cols;
  return Object.keys(rows[0] ?? {});
}

export function printList(rows: Record<string, unknown>[], opts: OutputOpts = {}): void {
  const fmt = pickFormat(opts);

  if (fmt === "json") {
    process.stdout.write(JSON.stringify(rows, null, 2) + "\n");
    return;
  }

  if (rows.length === 0) {
    if (fmt === "csv") process.stdout.write("﻿\n");
    else process.stderr.write("(no rows)\n");
    return;
  }

  const cols = deriveColumns(rows, opts.columns);

  if (fmt === "csv") {
    process.stdout.write("﻿"); // BOM
    process.stdout.write(cols.map(csvEscape).join(",") + "\n");
    for (const r of rows) {
      process.stdout.write(cols.map((c) => csvEscape(toStr(r[c]))).join(",") + "\n");
    }
    return;
  }

  if (fmt === "tsv") {
    process.stdout.write(cols.join("\t") + "\n");
    for (const r of rows) {
      process.stdout.write(cols.map((c) => toStr(r[c]).replace(/[\t\n\r]/g, " ")).join("\t") + "\n");
    }
    return;
  }

  // table — width-aware, capped per column
  const MAX_W = 40;
  const widths = cols.map((c) => Math.min(MAX_W, Math.max(visualWidth(c), ...rows.map((r) => visualWidth(toStr(r[c]).slice(0, MAX_W))))));
  const fmtRow = (vals: string[]) =>
    vals.map((v, i) => padRight(v.length > MAX_W ? v.slice(0, MAX_W - 1) + "…" : v, widths[i]!)).join("  ");
  process.stdout.write(fmtRow(cols) + "\n");
  process.stdout.write(widths.map((w) => "─".repeat(w)).join("  ") + "\n");
  for (const r of rows) {
    process.stdout.write(fmtRow(cols.map((c) => toStr(r[c]).replace(/\n/g, " "))) + "\n");
  }
}

export function printObject(obj: Record<string, unknown> | undefined | null, opts: OutputOpts = {}): void {
  const fmt = pickFormat(opts);
  if (fmt === "json") {
    process.stdout.write(JSON.stringify(obj ?? {}, null, 2) + "\n");
    return;
  }
  if (!obj) {
    process.stderr.write("(empty)\n");
    return;
  }
  for (const [k, v] of Object.entries(obj)) {
    process.stdout.write(`${k}\t${toStr(v).replace(/\n/g, " ")}\n`);
  }
}
