import { describe, expect, it, vi } from "vitest";

import { LinkedInDescriptionAdapter } from "../../src/modules/jobs/linkedin-description.adapter.js";

function createResponse(
  body: string,
  options: {
    status?: number;
    url?: string;
  } = {}
): Response {
  const response = new Response(body, {
    status: options.status ?? 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8"
    }
  });

  Object.defineProperty(response, "url", {
    value: options.url ?? linkedinUrl
  });

  return response;
}

const linkedinUrl =
  "https://www.linkedin.com/jobs/view/4468882543/";

function createHtml(description: string): string {
  return `
    <html>
      <body>
        <div class="show-more-less-html__markup">
          ${description}
        </div>
      </body>
    </html>
  `;
}

describe("LinkedInDescriptionAdapter", () => {
  it("extrae y limpia la descripción del HTML", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      createResponse(
        createHtml(
          "<p>Desarrollador <strong>TypeScript</strong></p>" +
          "<p>Experiencia con Node.js</p>"
        ),
        { url: linkedinUrl }
      )
    );

    const adapter = new LinkedInDescriptionAdapter(fetchMock);

    await expect(adapter.getDescription(linkedinUrl)).resolves.toBe(
      "Desarrollador TypeScript\nExperiencia con Node.js"
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const request = fetchMock.mock.calls[0];

    expect(String(request[0])).toBe(linkedinUrl);
    expect(request[1]?.method).toBe("GET");
    expect(request[1]?.redirect).toBe("follow");
  });

  it("decodifica entidades HTML y conserva acentos", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      createResponse(
        createHtml(
          "Desarrollo en Espa&ntilde;a &amp; Europa. " +
          "Salario: 40.000 EUR &#128187;"
        ),
        { url: linkedinUrl }
      )
    );

    const adapter = new LinkedInDescriptionAdapter(fetchMock);

    await expect(adapter.getDescription(linkedinUrl)).resolves.toContain(
      "España"
    );
  });

  it("devuelve null cuando no encuentra el marcador de descripción", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      createResponse(
        "<html><body>Contenido sin descripción</body></html>",
        { url: linkedinUrl }
      )
    );

    const adapter = new LinkedInDescriptionAdapter(fetchMock);

    await expect(adapter.getDescription(linkedinUrl)).resolves.toBeNull();
  });

  it("devuelve null cuando la descripción está vacía", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      createResponse(
        createHtml("   <p></p>   "),
        { url: linkedinUrl }
      )
    );

    const adapter = new LinkedInDescriptionAdapter(fetchMock);

    await expect(adapter.getDescription(linkedinUrl)).resolves.toBeNull();
  });

  it("devuelve null ante una respuesta HTTP fallida", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      createResponse("Not found", {
        status: 404,
        url: linkedinUrl
      })
    );

    const adapter = new LinkedInDescriptionAdapter(fetchMock);

    await expect(adapter.getDescription(linkedinUrl)).resolves.toBeNull();
  });

  it("devuelve null ante un error de red", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(
      new Error("Network error")
    );

    const adapter = new LinkedInDescriptionAdapter(fetchMock);

    await expect(adapter.getDescription(linkedinUrl)).resolves.toBeNull();
  });

  it("rechaza URLs que no pertenecen a LinkedIn", async () => {
    const fetchMock = vi.fn<typeof fetch>();

    const adapter = new LinkedInDescriptionAdapter(fetchMock);

    await expect(
      adapter.getDescription("https://example.com/jobs/123")
    ).resolves.toBeNull();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rechaza URLs que no usan HTTPS", async () => {
    const fetchMock = vi.fn<typeof fetch>();

    const adapter = new LinkedInDescriptionAdapter(fetchMock);

    await expect(
      adapter.getDescription("http://www.linkedin.com/jobs/view/123/")
    ).resolves.toBeNull();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("devuelve null si la respuesta redirige fuera de LinkedIn", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      createResponse(
        createHtml("Descripción de prueba"),
        { url: "https://example.com/redirected" }
      )
    );

    const adapter = new LinkedInDescriptionAdapter(fetchMock);

    await expect(adapter.getDescription(linkedinUrl)).resolves.toBeNull();
  });
});
