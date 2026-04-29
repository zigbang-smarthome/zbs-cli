import { defineCommand } from "citty";
import { postJson } from "../lib/client.ts";

export const callCommand = defineCommand({
  meta: {
    name: "call",
    description: "Raw POST to any /biz/.../*.json endpoint. Escape hatch for endpoints not wrapped yet.",
  },
  args: {
    path: {
      type: "positional",
      required: true,
      description: "Endpoint path, e.g. /biz/main/getInitData.json",
    },
    data: {
      type: "string",
      description: 'JSON object of form fields. Example: \'{"searchDtFrom":"2026-04-01"}\'',
    },
  },
  async run({ args }) {
    const fields: Record<string, string> = args.data ? JSON.parse(args.data) : {};
    const env = await postJson(args.path, fields);
    process.stdout.write(JSON.stringify(env, null, 2) + "\n");
  },
});
