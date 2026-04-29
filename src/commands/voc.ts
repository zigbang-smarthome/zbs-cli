import { defineCommand } from "citty";
import { postJson } from "../lib/client.ts";
import { asPillar, pillarParam } from "../lib/pillar.ts";
import { explicitRange } from "../lib/since.ts";
import { printList } from "../lib/output.ts";

const outputArgs = {
  json: { type: "boolean" as const },
  csv: { type: "boolean" as const },
  plain: { type: "boolean" as const, description: "TSV output (default when piped)" },
  full: { type: "boolean" as const, description: "Show all columns (default: curated subset)" },
};

const consultCommand = defineCommand({
  meta: {
    name: "consult",
    description: "콜센터 상담 (raw VOC). Endpoint: selectTchnlgyCnsltManageList.",
  },
  args: {
    pillar: { type: "string", description: "idp (DDL) | hms (HN). Required." },
    from: { type: "string", description: "YYYY-MM-DD" },
    to: { type: "string", description: "YYYY-MM-DD" },
    since: { type: "string", description: "Relative range (e.g. 7d). Default 7d.", default: "7d" },
    status: { type: "string", description: "open | closed (sets searchTicketComptAt)" },
    product: { type: "string", description: "Product code (searchPrductCode)" },
    rcept: { type: "string", description: "Receipt no (searchRceptNo)" },
    ...outputArgs,
  },
  async run({ args }) {
    const pillar = asPillar(args.pillar);
    if (!pillar) throw new Error("--pillar idp|hms is required");
    const { from, to } = explicitRange(args.from, args.to, args.since);

    const fields: Record<string, string> = {
      searchDtFrom: from,
      searchDtTo: to,
      ...pillarParam(pillar, "searchPrdtgrpCode"),
    };
    if (args.product) fields.searchPrductCode = args.product;
    if (args.rcept) fields.searchRceptNo = args.rcept;
    if (args.status === "closed") fields.searchTicketComptAt = "Y";
    if (args.status === "open") fields.searchTicketComptAt = "N";

    const env = await postJson(
      "/biz/managt/tchnlgyCnsltManage/tchnlgyCnsltManage/selectTchnlgyCnsltManageList.json",
      fields,
    );
    const rows = env.resultList ?? [];
    const cols = args.full ? undefined : [
      "rcept_no", "prdtgrp_code", "prduct_code", "ticket_compt_at_disp",
      "regist_dt_disp", "rcept_cn", "cstmr_nm", "cstmr_telno",
    ];
    printList(rows, { json: args.json, csv: args.csv, plain: args.plain, columns: cols });
  },
});

const repairCommand = defineCommand({
  meta: {
    name: "repair",
    description: "조치결과 (수리 완료). Endpoint: selectManagtResultDownloadList.",
  },
  args: {
    pillar: { type: "string", description: "idp (DDL) | hms (HN). Required." },
    from: { type: "string", description: "YYYY-MM-DD" },
    to: { type: "string", description: "YYYY-MM-DD" },
    since: { type: "string", description: "Relative range (e.g. 30d). Default 30d.", default: "30d" },
    sclas: { type: "string", description: "sclas_code (소분류)" },
    model: { type: "string", description: "search_model_code" },
    cmpns: { type: "string", description: "FREE | COST" },
    "rcept-se": { type: "string", description: "search_rcept_se_code (e.g. OUTER=외근, INNER=내근). Default: 모두" },
    ...outputArgs,
  },
  async run({ args }) {
    const pillar = asPillar(args.pillar);
    if (!pillar) throw new Error("--pillar idp|hms is required");
    const { from, to } = explicitRange(args.from, args.to, args.since);

    const fields: Record<string, string> = {
      // searchDateOpt=1 (접수날짜) is REQUIRED — without it the server silently ignores
      // the date range and returns the entire dataset. The page form defaults to "1".
      searchDateOpt: "1",
      searchDateFrom: from,
      searchDateTo: to,
      ...pillarParam(pillar, "searchPrductGroupCode"),
    };
    if (args.sclas) fields.sclas_code = args.sclas;
    if (args.model) fields.search_model_code = args.model;
    if (args.cmpns) fields.search_cmpns_grts_code = args.cmpns.toUpperCase();
    if (args["rcept-se"]) fields.search_rcept_se_code = args["rcept-se"];

    const env = await postJson(
      "/biz/managt/managtResultManage/managtResultDownload/selectManagtResultDownloadList.json",
      fields,
    );
    const rows = env.resultList ?? [];
    const cols = args.full ? undefined : [
      "rcept_no", "managt_no", "prduct_group_code", "model_code",
      "sttus_nm", "symptms_code_nm", "cmpns_grts_code",
      "afsvc_end_dt", "cstmr_nm",
    ];
    printList(rows, { json: args.json, csv: args.csv, plain: args.plain, columns: cols });
  },
});

const refurbCommand = defineCommand({
  meta: {
    name: "refurb",
    description: "양품화 (refurbishment) 결과. Endpoint: getGdqtybeResultList. ⚠ 서버 날짜 필터 무시 → 클라이언트 측에서 rcept_dt_disp 로 필터.",
  },
  args: {
    from: { type: "string", description: "YYYY-MM-DD (rcept_dt_disp 기준 클라이언트 필터)" },
    to: { type: "string", description: "YYYY-MM-DD (rcept_dt_disp 기준 클라이언트 필터)" },
    since: { type: "string", description: "Relative range. Default 30d.", default: "30d" },
    status: { type: "string", description: "gdqtybe_sttus_code (e.g. P50)" },
    sclas: { type: "string", description: "sclas_code" },
    model: { type: "string", description: "model_code" },
    pillar: { type: "string", description: "idp (DDL) | hms (HN)" },
    ...outputArgs,
  },
  async run({ args }) {
    const { from, to } = explicitRange(args.from, args.to, args.since);
    // 서버 측 begin_date/end_date 는 무시되지만 페이지 form 모양 맞춰 같이 보냄
    const fields: Record<string, string> = {
      search_date_code: "01",
      begin_date: from,
      end_date: to,
    };
    if (args.status) fields.gdqtybe_sttus_code = args.status;
    if (args.sclas) fields.sclas_code = args.sclas;
    if (args.model) fields.model_code = args.model;
    const pillar = asPillar(args.pillar);
    if (pillar) Object.assign(fields, pillarParam(pillar, "prdtgrp_code"));

    const env = await postJson(
      "/biz/managt/managtResult/dwldGdqtybeResult/getGdqtybeResultList.json",
      fields,
    );
    let rows = env.resultList ?? [];
    // 클라이언트 측 날짜 필터: rcept_dt_disp 는 "YYYY-MM-DD (HH:MM:SS)" 형태
    const inRange = (s: unknown) => {
      if (typeof s !== "string") return false;
      const date = s.slice(0, 10);
      return date >= from && date <= to;
    };
    rows = rows.filter((r) => inRange((r as any).rcept_dt_disp));
    const cols = args.full ? undefined : [
      "rcept_no", "prdtgrp_code", "model_code", "gdqtybe_sttus_code_nm",
      "gdqtybe_rcept_symptms_code_nm", "rcept_dt_disp", "repair_dt_disp",
      "cmpns_grts_code", "rcept_entrps_code_nm",
    ];
    printList(rows, { json: args.json, csv: args.csv, plain: args.plain, columns: cols });
  },
});

export const vocCommand = defineCommand({
  meta: {
    name: "voc",
    description: "VOC 데이터 조회 (consult / repair / refurb)",
  },
  subCommands: {
    consult: consultCommand,
    repair: repairCommand,
    refurb: refurbCommand,
  },
});
