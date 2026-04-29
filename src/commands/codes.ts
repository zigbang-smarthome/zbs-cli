import { defineCommand } from "citty";
import { postJson } from "../lib/client.ts";
import { printList } from "../lib/output.ts";

/**
 * 공통코드. 응답이 `resultMap[UPPER_CODE] = [{code, code_nm}, ...]` 형식 (resultList 가
 * 아니라). 한 번 호출로 여러 카테고리를 받아오므로 평탄화해 `category` 컬럼을 붙인다.
 */
export const codesCommand = defineCommand({
  meta: {
    name: "codes",
    description: "공통코드 조회 (selectCmmnCode.json). 코드→한글명 매핑 캐시용.",
  },
  args: {
    upper: {
      type: "string",
      required: true,
      description: "UPPER_CODE_ARR (콤마 구분, 예: PRDUCT_GROUP_CODE,CMPNS_GRTS_CODE,RCEPT_SE_CODE)",
    },
    json: { type: "boolean" },
    csv: { type: "boolean" },
    plain: { type: "boolean" },
  },
  async run({ args }) {
    // 페이지 JS 컨벤션: 앞 콤마 prefix
    const upper = args.upper.startsWith(",") ? args.upper : "," + args.upper;
    const env = await postJson("/combiz/code/selectCmmnCode.json", {
      UPPER_CODE_ARR: upper,
    });
    const map = (env.resultMap ?? {}) as Record<string, Array<Record<string, unknown>>>;
    const rows: Record<string, unknown>[] = [];
    for (const [category, entries] of Object.entries(map)) {
      if (!category || !Array.isArray(entries)) continue;
      for (const e of entries) {
        rows.push({ category, code: e.code, code_nm: e.code_nm });
      }
    }
    if (args.json) {
      // 원본 dict 형태 그대로 (downstream 매핑에 편함)
      const out: Record<string, Array<{ code: unknown; code_nm: unknown }>> = {};
      for (const [k, v] of Object.entries(map)) {
        if (k && Array.isArray(v)) out[k] = v.map((e) => ({ code: e.code, code_nm: e.code_nm }));
      }
      process.stdout.write(JSON.stringify(out, null, 2) + "\n");
      return;
    }
    printList(rows, { csv: args.csv, plain: args.plain, columns: ["category", "code", "code_nm"] });
  },
});
