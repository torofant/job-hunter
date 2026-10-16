const TECHNOLOGY_ALIASES: Record<string, string> = {
  js: "javascript",
  javascript: "javascript",

  ts: "typescript",
  typescript: "typescript",

  node: "nodejs",
  "node.js": "nodejs",
  nodejs: "nodejs",

  "react.js": "react",
  react: "react",

  "react native": "react-native",
  "react-native": "react-native"
};

export function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizeTechnology(value: string): string {
  const normalized = normalizeText(value);

  return TECHNOLOGY_ALIASES[normalized] ?? normalized;
}