import { defineCommand } from "citty";
import { loadSession } from "../lib/config.ts";
import { printObject } from "../lib/output.ts";

export const whoamiCommand = defineCommand({
  meta: {
    name: "whoami",
    description: "Show the cached session context.",
  },
  args: {
    json: { type: "boolean" },
  },
  async run({ args }) {
    const s = await loadSession();
    if (!s) {
      process.stderr.write("(no session — run `zbs login`)\n");
      process.exit(1);
    }
    printObject(
      {
        loginId: s.loginId,
        ssUserNm: s.ssUserNm,
        ssEmplyrId: s.ssEmplyrId,
        ssAuthCode: s.ssAuthCode,
        ssOrgnztNm: s.ssOrgnztNm,
        savedAt: s.savedAt,
      },
      { json: args.json },
    );
  },
});
