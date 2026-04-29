import { defineCommand } from "citty";
import { logout } from "../lib/auth.ts";

export const logoutCommand = defineCommand({
  meta: {
    name: "logout",
    description: "Clear cached session and remove the password from macOS Keychain.",
  },
  async run() {
    await logout();
    process.stderr.write("logged out\n");
  },
});
