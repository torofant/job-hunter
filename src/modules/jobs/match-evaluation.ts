import type { RequirementMatch } from "./requirement-match.js";

export type MatchEvaluation = Pick<
  RequirementMatch,
  "result" | "evidence"
>;