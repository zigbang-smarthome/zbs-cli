/**
 * ZBS portal common response envelope.
 *
 * Every authenticated JSON response has these shell fields plus one of:
 *   - resultList: array  (list endpoints)
 *   - resultMap:  object (single/lookup endpoints)
 *   - resultAnswer: array (Q&A subqueries)
 */
export interface ZbsEnvelope {
  resultCode: "success" | "noAuth" | "fail" | string;
  resultMsg?: string;
  conMode?: string;
  contextPath?: string;
  serverProfile?: string;
  ssEmplyrId?: string;
  ssUserNm?: string;
  ssAuthCode?: string;
  ssOrgnztNm?: string;
  kakaoApiRestKey?: string;
  kakaoApiJsKey?: string;

  resultList?: Record<string, unknown>[];
  resultMap?: Record<string, unknown>;
  resultAnswer?: Record<string, unknown>[];

  [k: string]: unknown;
}

export interface SessionContext {
  jsessionid: string;
  loginId: string;
  ssEmplyrId?: string;
  ssUserNm?: string;
  ssAuthCode?: string;
  ssOrgnztNm?: string;
  savedAt: string; // ISO timestamp
}

export type Pillar = "idp" | "hms";
