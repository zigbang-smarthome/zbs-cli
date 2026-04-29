import { defineCommand, runMain } from "citty";
import { loginCommand } from "./commands/login.ts";
import { logoutCommand } from "./commands/logout.ts";
import { whoamiCommand } from "./commands/whoami.ts";
import { vocCommand } from "./commands/voc.ts";
import { boardCommand } from "./commands/board.ts";
import { dashboardCommand } from "./commands/dashboard.ts";
import { codesCommand } from "./commands/codes.ts";
import { menuCommand } from "./commands/menu.ts";
import { callCommand } from "./commands/call.ts";

const main = defineCommand({
  meta: {
    name: "zbs",
    description: "CLI for zbs.zigbang.in (직방 본사 B2B 포털)",
  },
  subCommands: {
    login: loginCommand,
    logout: logoutCommand,
    whoami: whoamiCommand,
    voc: vocCommand,
    board: boardCommand,
    dashboard: dashboardCommand,
    codes: codesCommand,
    menu: menuCommand,
    call: callCommand,
  },
});

runMain(main);
