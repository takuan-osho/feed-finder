import pino from "pino/browser";

interface AccessFields {
  method: string;
  route: string;
  status_code: number;
  duration_ms: number;
  request_id?: string;
}

// Pino's Node entry uses node:diagnostics_channel and sonic-boom, which break in
// Cloudflare Workers (see workerd discussion #3423). The browser entry is the
// supported path; we still keep all output on the existing console channels so
// Cloudflare Workers Logs / the Grafana drain ingest unchanged JSON lines.
const formatLine = (level: string, o: object): string => {
  // Drop pino's auto-added numeric `level` and epoch `time`; emit the string
  // level label and an ISO `ts` instead so Loki/Grafana can index them.
  // `service` is added here rather than via pino's `base` because base bindings
  // are not auto-applied to root-logger calls in browser mode.
  const stripped: Record<string, unknown> = {
    ...(o as Record<string, unknown>),
  };
  delete stripped["level"];
  delete stripped["time"];
  return JSON.stringify({
    level,
    ts: new Date().toISOString(),
    service: "feed-finder",
    ...stripped,
  });
};

const writeError = (o: object): void => {
  console.error(formatLine("error", o));
};
const writeWarn = (o: object): void => {
  console.warn(formatLine("warn", o));
};
const writeInfo = (o: object): void => {
  // biome-ignore lint/suspicious/noConsole: pino destination — CF Workers Logs ingest console.log JSON
  console.log(formatLine("info", o));
};

export const logger = pino({
  level: "info",
  browser: {
    asObject: true,
    write: {
      info: writeInfo,
      warn: writeWarn,
      error: writeError,
      fatal: writeError,
      debug: writeInfo,
      trace: writeInfo,
    },
  },
});

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
