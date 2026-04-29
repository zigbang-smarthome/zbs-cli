/**
 * IDP/HMS pillar mapping.
 *
 * The portal uses two product group codes:
 *   DDL = 도어록 (IDP)
 *   HN  = 월패드/홈네트워크 (HMS)
 *
 * The parameter NAME differs per endpoint:
 *   tchnlgyCnsltManage:        searchPrdtgrpCode
 *   managtResultDownload:      searchPrductGroupCode
 */

import type { Pillar } from "../types/index.ts";

export const PILLAR_TO_CODE: Record<Pillar, string> = {
  idp: "DDL",
  hms: "HN",
};

export function asPillar(s: string | undefined): Pillar | undefined {
  if (!s) return undefined;
  const v = s.toLowerCase();
  if (v === "idp" || v === "ddl") return "idp";
  if (v === "hms" || v === "hn") return "hms";
  throw new Error(`unknown pillar: ${s} (expected idp|hms)`);
}

export function pillarParam(pillar: Pillar | undefined, paramKey: string): Record<string, string> {
  if (!pillar) return {};
  return { [paramKey]: PILLAR_TO_CODE[pillar] };
}
