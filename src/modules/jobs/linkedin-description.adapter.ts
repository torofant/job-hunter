const LINKEDIN_HOST = "linkedin.com";
const DESCRIPTION_PATTERN =
  /<div class="show-more-less-html__markup[^"]*">([\s\S]*?)<\/div>/i;

const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
  "&#39;": "'",
  "&nbsp;": " ",
  "&ntilde;": "ñ"
};

function decodeHtmlEntities(value: string): string {
  return value.replace(
    /&(?:amp|lt|gt|quot|apos|nbsp|ntilde);|&#(?:\d+|x[0-9a-f]+);/gi,
    (entity) => {
      const named = HTML_ENTITIES[entity.toLowerCase()];

      if (named !== undefined) return named;

      const numeric = entity.match(/^&#(x[0-9a-f]+|\d+);$/i);
      if (!numeric) return entity;

      const codePoint = numeric[1]!.startsWith("x")
        ? Number.parseInt(numeric[1]!.slice(1), 16)
        : Number.parseInt(numeric[1]!, 10);

      return Number.isFinite(codePoint)
        ? String.fromCodePoint(codePoint)
        : entity;
    }
  );
}

function extractDescription(html: string): string | null {
  const match = DESCRIPTION_PATTERN.exec(html);
  if (!match?.[1]) return null;

  const text = decodeHtmlEntities(
    match[1]
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(?:p|div|li)>/gi, "\n")
      .replace(/<[^>]*>/g, " ")
  )
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return text.length > 0 ? text : null;
}

export class LinkedInDescriptionAdapter {
  constructor(
    private readonly fetchImplementation: typeof fetch = fetch
  ) {}

  async getDescription(url: string): Promise<string | null> {
    try {
      const parsedUrl = new URL(url);
      const hostname = parsedUrl.hostname.toLowerCase();

      if (
        parsedUrl.protocol !== "https:" ||
        (hostname !== LINKEDIN_HOST &&
          !hostname.endsWith(`.${LINKEDIN_HOST}`))
      ) {
        return null;
      }

      const response = await this.fetchImplementation(parsedUrl, {
        method: "GET",
        redirect: "follow",
        signal: AbortSignal.timeout(15_000),
        headers: {
          Accept: "text/html"
        }
      });

      if (!response.ok) return null;

      const finalUrl = new URL(response.url);
      const finalHostname = finalUrl.hostname.toLowerCase();

      if (
        finalUrl.protocol !== "https:" ||
        (finalHostname !== LINKEDIN_HOST &&
          !finalHostname.endsWith(`.${LINKEDIN_HOST}`))
      ) {
        return null;
      }

      const html = await response.text();

      return extractDescription(html);
    } catch {
      return null;
    }
  }
}