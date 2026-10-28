import type { ScoringCategory } from "../jobs/scoring.js";

export type NotificationMessageInput = {
  title: string;
  company: string | null;
  city: string | null;
  country: string | null;
  modality: string | null;
  salary: string | number | null;
  score: number | null;
  category: ScoringCategory | null;
  coverage: number | null;
  url: string | null;
};

export type NotificationMessageResult =
  | { ok: true; message: string }
  | { ok: false; reason: string };

const categoryLabels: Record<ScoringCategory, string> = {
  HIGH_MATCH: "HIGH MATCH",
  GOOD_MATCH: "GOOD MATCH",
  POSSIBLE_MATCH: "POSSIBLE MATCH",
  LOW_MATCH: "LOW MATCH"
};

function usableUrl(value: string | null): string | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = new URL(value);

    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

function nonEmpty(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function formatSalaryMetadata(
  metadata: Record<string, unknown> | null | undefined
): string | null {
  if (!metadata) return null;

  const scalar = (value: unknown): string | null => {
    if (typeof value === "number") {
      return Number.isFinite(value) ? String(value) : null;
    }

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    return null;
  };

  const minimum = scalar(metadata.salary_min);
  const maximum = scalar(metadata.salary_max);
  const salary = scalar(metadata.salary);

  let amount: string | null;

  if (minimum !== null || maximum !== null) {
    amount = `${minimum ?? ""}${minimum !== null && maximum !== null ? "–" : ""}${maximum ?? ""}`;
  } else {
    amount = salary;
  }

  if (amount === null) return null;

  const currency = scalar(metadata.salary_currency);
  const period = scalar(metadata.salary_period);

  return `${amount}${currency ? ` ${currency}` : ""}${period ? `/${period}` : ""}`;
}
export function buildNotificationMessage(
  input: NotificationMessageInput
): NotificationMessageResult {
  const url = usableUrl(input.url);

  if (!url) {
    return {
      ok: false,
      reason: "URL ausente o no utilizable (se requiere HTTP o HTTPS)"
    };
  }

  const title = nonEmpty(input.title) ?? "Oferta de empleo";
  const company = nonEmpty(input.company);
  const city = nonEmpty(input.city);
  const country = nonEmpty(input.country);
  const modality = nonEmpty(input.modality);

  const lines = [
    `🔎 ${title}${company ? ` — ${company}` : ""}`
  ];

  const location = [city, country]
    .filter((part, index, parts) =>
      part !== null && parts.indexOf(part) === index
    )
    .join(", ");

  const locationParts = [
    location || null,
    modality
  ].filter((part): part is string => part !== null);

  if (locationParts.length > 0) {
    lines.push(`📍 ${locationParts.join(" · ")}`);
  }

  if (input.salary !== null && input.salary !== "") {
    lines.push(`💰 ${String(input.salary)}`);
  }

  if (input.score !== null) {
    const category = input.category
      ? categoryLabels[input.category]
      : null;

    lines.push(
      `🎯 ${Math.round(input.score)}/100${category ? ` · ${category}` : ""}`
    );
  }

  if (input.coverage !== null) {
    lines.push(`📊 Cobertura: ${Math.round(input.coverage)}%`);
  }

  lines.push(`🔗 Ver oferta: ${url}`);

  return {
    ok: true,
    message: lines.join("\n")
  };
}