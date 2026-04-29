import { defineCommand } from "citty";
import { postJson } from "../lib/client.ts";
import { printList } from "../lib/output.ts";

/**
 * 로그인 직후 페이지가 호출하는 dashboard 페이로드 (getInitData.json).
 * resultMap 안에 4 종 묶음:
 *   - popupList: 강제 popup 글
 *   - noticeList: 공지사항 latest 10
 *   - dataList:   자료실 latest 10 (bbs_id 포함)
 *   - qnaList:    Q&A latest (현재 비어있음)
 *
 * "오늘 새로 올라온 거 있나?" 단 한 번 호출로 끝.
 */
export const dashboardCommand = defineCommand({
  meta: {
    name: "dashboard",
    description: "로그인 직후 dashboard payload (notice/data/qna/popup latest).",
  },
  args: {
    section: { type: "string", description: "notice | data | qna | popup. 생략하면 전체" },
    json: { type: "boolean" },
    csv: { type: "boolean" },
    plain: { type: "boolean" },
  },
  async run({ args }) {
    const env = await postJson("/biz/main/getInitData.json", {});
    const rm = (env.resultMap ?? {}) as Record<string, Array<Record<string, unknown>>>;

    if (args.json) {
      process.stdout.write(JSON.stringify(rm, null, 2) + "\n");
      return;
    }

    const sections: Array<[string, Array<Record<string, unknown>>, string[]]> = [
      ["popupList",   rm.popupList   ?? [], ["notice_sntnc_popup_sn", "sntnc_sn"]],
      ["noticeList",  rm.noticeList  ?? [], ["sntnc_sn", "sj_nm", "writng_dt", "inqire_co", "file_cnt", "notice_sntnc_at"]],
      ["dataList",    rm.dataList    ?? [], ["sntnc_sn", "bbs_id", "sj_nm", "writng_dt", "inqire_co", "file_cnt"]],
      ["qnaList",     rm.qnaList     ?? [], ["sntnc_sn", "sj_nm", "writng_dt"]],
    ];

    const wantedKey: Record<string, string> = {
      popup: "popupList", notice: "noticeList", data: "dataList", qna: "qnaList",
    };
    const filter = args.section ? wantedKey[args.section.toLowerCase()] : null;
    if (args.section && !filter) throw new Error(`unknown --section: ${args.section} (notice|data|qna|popup)`);

    let first = true;
    for (const [key, rows, cols] of sections) {
      if (filter && key !== filter) continue;
      if (!first) process.stdout.write("\n");
      first = false;
      process.stdout.write(`# ${key} (${rows.length})\n`);
      if (rows.length) {
        printList(rows, { csv: args.csv, plain: args.plain, columns: cols });
      } else {
        process.stderr.write("(empty)\n");
      }
    }
  },
});
