import { defineCommand } from "citty";
import { postJson } from "../lib/client.ts";
import { printList } from "../lib/output.ts";

/**
 * 메뉴 트리. 응답 키는 `menuList` (resultList 가 아님). 노드 필드는 camelCase
 * (menuId/menuNm/upperMenuId/menuUrl/menuSortNo/menuTyCode...).
 */
export const menuCommand = defineCommand({
  meta: {
    name: "menu",
    description: "메뉴 트리 덤프 (menuLoad.json). --tree 로 들여쓰기 출력.",
  },
  args: {
    tree: { type: "boolean", description: "들여쓰기 트리 (default: 평탄 표/JSON)" },
    json: { type: "boolean" },
    csv: { type: "boolean" },
    plain: { type: "boolean" },
  },
  async run({ args }) {
    const env = await postJson("/combiz/menu/menuLoad.json", {});
    const rows = ((env as any).menuList ?? []) as Array<Record<string, unknown>>;

    if (args.tree && !args.json && !args.csv) {
      const children: Record<string, typeof rows> = {};
      for (const r of rows) {
        const parent = (r.upperMenuId as string) || "ROOT";
        (children[parent] ??= []).push(r);
      }
      const walk = (parent: string, depth: number) => {
        const list = (children[parent] ?? []).slice().sort(
          (a, b) => Number(a.menuSortNo ?? 0) - Number(b.menuSortNo ?? 0),
        );
        for (const c of list) {
          const url = (c.menuUrl as string) || "";
          const ty = (c.menuTyCode as string) || "";
          const marker = ty === "EMPTY" ? "·" : "→";
          process.stdout.write(
            "  ".repeat(depth) + `${marker} ${c.menuNm}  [${c.menuId}]${url ? "  " + url : ""}\n`,
          );
          walk(c.menuId as string, depth + 1);
        }
      };
      walk("ROOT", 0);
      return;
    }

    printList(rows, {
      json: args.json,
      csv: args.csv,
      plain: args.plain,
      columns: ["menuId", "menuNm", "upperMenuId", "menuSortNo", "menuTyCode", "menuUrl"],
    });
  },
});
