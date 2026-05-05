import pino from "pino";

interface AccessFields {
  method: string;
  route: string;
  status_code: number;
  duration_ms: number;
  request_id?: string;
}

const consoleDestination = {
  write(chunk: string): void {
    const line = chunk.endsWith("\n") ? chunk.slice(0, -1) : chunk;
    let level: string | undefined;
    try {
      level = (JSON.parse(line) as { level?: string }).level;
    } catch {
      level = undefined;
    }
    if (level === "error" || level === "fatal") {
      console.error(line);
    } else if (level === "warn") {
      console.warn(line);
    } else {
      // biome-ignore lint/suspicious/noConsole: pino destination — CF Workers Logs ingest console.log JSON
      console.log(line);
    }
  },
};

export const logger = pino(
  {
    level: "info",
    base: { service: "feed-finder" },
    formatters: {
      level: (label) => ({ level: label }),
    },
    timestamp: () => `,"ts":"${new Date().toISOString()}"`,
  },
  consoleDestination,
);

export const logAccess = (fields: AccessFields): void => {
  const status = fields.status_code;
  const payload = {
    event: "http_access",
    method: fields.method,
    route: fields.route,
    status_code: status,
    duration_ms: Math.round(fields.duration_ms),
    ...(fields.request_id !== undefined
      ? { request_id: fields.request_id }
      : {}),
  };
  if (status >= 500) {
    logger.error(payload, "http_access");
  } else if (status >= 400) {
    logger.warn(payload, "http_access");
  } else {
    logger.info(payload, "http_access");
  }
};
