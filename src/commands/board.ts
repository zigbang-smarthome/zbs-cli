import { defineCommand } from "citty";
import { writeFile } from "node:fs/promises";
import { resolve as resolvePath, join as pathJoin } from "node:path";
import { postJson, getBinary } from "../lib/client.ts";
import { printList, printObject } from "../lib/output.ts";

const listCommand = defineCommand({
  meta: {
    name: "list",
    description: "게시판 목록. bbs_id 예: 0000000(공지), 0000002(도어록-자료실), 0000004(HN-자료실). 검색은 제목만 동작.",
  },
  args: {
    bbs: { type: "positional", required: true, description: "bbs_id (e.g. 0000000)" },
    keyword: { type: "string", description: "제목(sj_nm) 검색어" },
    json: { type: "boolean" },
    csv: { type: "boolean" },
    plain: { type: "boolean" },
    full: { type: "boolean" },
  },
  async run({ args }) {
    // 본문(rm_cn)/작성자(register_nm) 검색은 서버가 무시하고 전체 결과를 줌. 제목만 의미있게 동작.
    const env = await postJson("/biz/support/selectBoard.json", {
      bbs_id: args.bbs,
      input_keyword: args.keyword ?? "",
      search_keyword: "sj_nm",
    });
    const rows = env.resultList ?? [];
    const cols = args.full ? undefined : [
      "sntnc_sn", "sj_nm", "register_nm", "regist_dt", "inqire_co", "file_cnt",
    ];
    printList(rows, { json: args.json, csv: args.csv, plain: args.plain, columns: cols });
  },
});

const getCommand = defineCommand({
  meta: {
    name: "get",
    description: "게시글 단건 + 첨부 메타.",
  },
  args: {
    bbs: { type: "positional", required: true, description: "bbs_id" },
    sn: { type: "positional", required: true, description: "sntnc_sn" },
    json: { type: "boolean" },
  },
  async run({ args }) {
    const env = await postJson("/biz/support/getBoard.json", {
      bbs_id: args.bbs,
      sntnc_sn: args.sn,
      detail: "Y",
    });
    if (args.json) {
      process.stdout.write(JSON.stringify(env, null, 2) + "\n");
      return;
    }
    const map = env.resultMap ?? {};
    printObject(map);
    const fileList = (env as any).fileList as Record<string, unknown>[] | undefined;
    if (fileList?.length) {
      process.stdout.write("\n# fileList\n");
      printList(fileList, { plain: true });
    }
    const answers = env.resultAnswer;
    if (answers?.length) {
      process.stdout.write("\n# resultAnswer\n");
      printList(answers, { plain: true });
    }
  },
});

const attachCommand = defineCommand({
  meta: {
    name: "attach",
    description: "게시글 첨부 다운로드. --all = 전체 zip.",
  },
  args: {
    bbs: { type: "positional", required: true, description: "bbs_id" },
    sn: { type: "positional", required: true, description: "sntnc_sn" },
    out: { type: "string", description: "출력 디렉토리 (default: cwd)" },
    all: { type: "boolean", description: "downloadFiles.json (전체 zip)" },
  },
  async run({ args }) {
    const detail = await postJson("/biz/support/getBoard.json", {
      bbs_id: args.bbs,
      sntnc_sn: args.sn,
      detail: "Y",
    });
    const fileList = ((detail as any).fileList ?? []) as Array<{ fileId: string; fileSn: string; printFileName?: string; lgclflNm?: string }>;
    if (!fileList.length) {
      process.stderr.write("(no attachments)\n");
      return;
    }
    const fileId = fileList[0]!.fileId;
    const outDir = resolvePath(args.out ?? ".");

    if (args.all) {
      const { filename, data } = await getBinary(`/biz/support/downloadFiles.json?file_id=${encodeURIComponent(fileId)}`);
      const out = pathJoin(outDir, filename ?? `${fileId}.zip`);
      await writeFile(out, data);
      process.stderr.write(`saved ${out} (${data.length} bytes)\n`);
      return;
    }

    for (const f of fileList) {
      const { filename, data } = await getBinary(
        `/biz/support/downloadFile.json?file_id=${encodeURIComponent(f.fileId)}&file_sn=${encodeURIComponent(f.fileSn)}`,
      );
      const out = pathJoin(outDir, filename ?? f.printFileName ?? f.lgclflNm ?? `${f.fileId}-${f.fileSn}`);
      await writeFile(out, data);
      process.stderr.write(`saved ${out} (${data.length} bytes)\n`);
    }
  },
});

export const boardCommand = defineCommand({
  meta: {
    name: "board",
    description: "SUPPORT 게시판 (공지/FAQ/자료실/Q&A).",
  },
  subCommands: {
    list: listCommand,
    get: getCommand,
    attach: attachCommand,
  },
});
