import type { Requirement } from "./requirement.js";
import type { RequirementMatch } from "./requirement-match.js";
import type { MatchingSummary } from "./matching-summary.js";
import type { CoverageBreakdown } from "./coverage.js";
import type { ConfidenceLevel } from "./confidence.js";
import type { ScoringResult } from "./scoring.js";

export type JobAnalysisResult = {
  jobOfferId: string;
  jobAnalysisId: string;
  requirements: Requirement[];
  matches: RequirementMatch[];
  matchingSummary: MatchingSummary;
  coverageBreakdown: CoverageBreakdown;
  globalCoverageScore: number | null;
  confidence: ConfidenceLevel;
  scoringResult: ScoringResult;
};
