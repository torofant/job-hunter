
export type TelegramSendResult =
  | {
      status: "SENT";
      messageId: number;
    }
  | {
      status: "FAILED";
      reason: string;
    }
  | {
      status: "UNKNOWN";
      reason: string;
    };

type TelegramClientOptions = {
  botToken: string | undefined;
  chatId: string | undefined;
  fetchImplementation?: typeof fetch;
};

type TelegramApiResponse = {
  ok?: boolean;
  description?: string;
  result?: {
    message_id?: number;
  };
};

export class TelegramClient {
  private readonly fetchImplementation: typeof fetch;

  constructor(private readonly options: TelegramClientOptions) {
    this.fetchImplementation = options.fetchImplementation ?? fetch;
  }

  get isConfigured(): boolean {
    return Boolean(
      this.options.botToken?.trim() &&
      this.options.chatId?.trim()
    );
  }

  async sendMessage(text: string): Promise<TelegramSendResult> {
    const token = this.options.botToken?.trim();
    const chatId = this.options.chatId?.trim();

    if (!token || !chatId) {
      throw new Error("Telegram no está configurado");
    }

    let response: Response;

    try {
      response = await this.fetchImplementation(
        `https://api.telegram.org/bot${token}/sendMessage`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            chat_id: chatId,
            text,
            disable_web_page_preview: true
          })
        }
      );
    } catch {
      return {
        status: "UNKNOWN",
        reason: "No se pudo confirmar el resultado de la petición a Telegram"
      };
    }

    if (response.status >= 500) {
      return {
        status: "UNKNOWN",
        reason: `Telegram respondió con HTTP ${response.status}`
      };
    }

    let data: TelegramApiResponse;

    try {
      data = await response.json() as TelegramApiResponse;
    } catch {
      return {
        status: "UNKNOWN",
        reason: "La respuesta de Telegram no se pudo interpretar"
      };
    }

    if (!response.ok || data.ok !== true) {
      return {
        status: "FAILED",
        reason: data.description ?? `Telegram rechazó la petición (HTTP ${response.status})`
      };
    }

    const messageId = data.result?.message_id;

    if (typeof messageId !== "number") {
      return {
        status: "UNKNOWN",
        reason: "Telegram aceptó la petición, pero no devolvió un identificador de mensaje válido"
      };
    }

    return {
      status: "SENT",
      messageId
    };
  }
}
