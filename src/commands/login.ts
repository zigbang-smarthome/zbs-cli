import { defineCommand } from "citty";
import { login } from "../lib/auth.ts";

export const loginCommand = defineCommand({
  meta: {
    name: "login",
    description: "Login and cache JSESSIONID. Username/password via prompt, $ZBS_LOGIN_ID, or $ZBS_PASSWORD env. Password saved to macOS Keychain.",
  },
  args: {
    id: {
      type: "string",
      description: "LOGIN_ID (else $ZBS_LOGIN_ID env, else interactive prompt)",
    },
    "no-keychain": {
      type: "boolean",
      description: "Don't save the password to macOS Keychain",
    },
  },
  async run({ args }) {
    const ctx = await login({
      loginId: args.id,
      saveToKeychain: !args["no-keychain"],
      interactive: true,
    });
    process.stderr.write(
      `logged in as ${ctx.loginId} (${ctx.ssUserNm ?? ""}, ${ctx.ssAuthCode ?? ""}, ${ctx.ssOrgnztNm ?? ""})\n`,
    );
  },
});
