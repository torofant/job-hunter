
import { describe, expect, it, vi } from "vitest";

import { TelegramClient } from "../../src/modules/notifications/telegram.client.js";

function createResponse(
  body: unknown,
  status = 200
): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("TelegramClient", () => {
  const options = {
    botToken: "test-token",
    chatId: "test-chat"
  };

  it("envía un mensaje y devuelve su identificador", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      createResponse({
        ok: true,
        result: { message_id: 123 }
      })
    );

    const client = new TelegramClient({
      ...options,
      fetchImplementation: fetchMock
    });

    const result = await client.sendMessage("Oferta de prueba");

    expect(result).toEqual({
      status: "SENT",
      messageId: 123
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const request = fetchMock.mock.calls[0];
    expect(request[0]).toContain("/sendMessage");
    expect(request[1]?.method).toBe("POST");

    expect(JSON.parse(String(request[1]?.body))).toEqual({
      chat_id: "test-chat",
      text: "Oferta de prueba",
      disable_web_page_preview: true
    });
  });

  it("preserva acentos y emojis al serializar el mensaje", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      createResponse({
        ok: true,
        result: { message_id: 124 }
      })
    );

    const client = new TelegramClient({
      ...options,
      fetchImplementation: fetchMock
    });

    const message =
      "\u{1F4CD} Benic\u00e0ssim, Espa\u00f1a \u00b7 Remoto\n" +
      "\u{1F4B0} 40.000 EUR";

    await client.sendMessage(message);

    const request = fetchMock.mock.calls[0];
    const payload = JSON.parse(String(request[1]?.body));

    expect(payload.text).toBe(message);
    expect(payload.text).toContain("Benic\u00e0ssim");
    expect(payload.text).toContain("Espa\u00f1a");
    expect(payload.text).toContain("\u{1F4CD}");
    expect(payload.text).toContain("\u{1F4B0}");
  });

  it("identifica un rechazo explícito de Telegram", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      createResponse({
        ok: false,
        description: "Chat not found"
      }, 400)
    );

    const client = new TelegramClient({
      ...options,
      fetchImplementation: fetchMock
    });

    await expect(client.sendMessage("Prueba")).resolves.toEqual({
      status: "FAILED",
      reason: "Chat not found"
    });
  });

  it("no reintenta ni oculta un resultado de red ambiguo", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(
      new Error("Network error")
    );

    const client = new TelegramClient({
      ...options,
      fetchImplementation: fetchMock
    });

    await expect(client.sendMessage("Prueba")).resolves.toMatchObject({
      status: "UNKNOWN"
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("no intenta enviar si faltan las credenciales", async () => {
    const fetchMock = vi.fn<typeof fetch>();

    const client = new TelegramClient({
      botToken: undefined,
      chatId: undefined,
      fetchImplementation: fetchMock
    });

    expect(client.isConfigured).toBe(false);

    await expect(client.sendMessage("Prueba")).rejects.toThrow(
      "Telegram no está configurado"
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
