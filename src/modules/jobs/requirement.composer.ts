import type { MatchEvaluation } from "./match-evaluation.js";

type MatchResult = MatchEvaluation["result"];

export function composeAlternativeResult(
  matches: MatchEvaluation[]
): MatchResult {
  if (matches.length === 0) {
    throw new Error(
      "Una alternativa debe contener al menos un resultado"
    );
  }

  if (matches.some((match) => match.result === "MATCH")) {
    return "MATCH";
  }

  if (matches.every((match) => match.result === "MISSING")) {
    return "MISSING";
  }

  return "UNKNOWN";
}

export function composeGroupResult(
  matches: MatchEvaluation[]
): MatchResult {
  if (matches.length === 0) {
    throw new Error(
      "Un grupo debe contener al menos un resultado"
    );
  }

  const hasMissing = matches.some(
    (match) => match.result === "MISSING"
  );

  const hasUnknown = matches.some(
    (match) => match.result === "UNKNOWN"
  );

  const hasMatch = matches.some(
    (match) => match.result === "MATCH"
  );

  if (hasMissing && hasUnknown) {
    return "MISSING";
  }

  if (hasMissing && hasMatch) {
    return "PARTIAL";
  }

  if (!hasMissing && hasUnknown) {
    return "UNKNOWN";
  }

  if (matches.every((match) => match.result === "MISSING")) {
    return "MISSING";
  }

  return "MATCH";
}