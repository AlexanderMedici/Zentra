// Minimal Inngest-like client stub to satisfy imports
// Replace with a real Inngest client if/when needed.

type InngestEvent = {
  name: string;
  data?: Record<string, unknown>;
};

export const inngest = {
  send: async (event: InngestEvent) => {
    // No-op stub: log event locally for development
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.log("[inngest] send", event);
    }
    return { ok: true } as const;
  },
};

