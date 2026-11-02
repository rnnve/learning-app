export interface LogContext {
  requestId?: string;
  userId?: string;
  route?: string;
  method?: string;
  status?: number;
  durationMs?: number;
  [key: string]: any;
}

export const logger = {
  info(message: string, context: LogContext = {}) {
    console.log(
      JSON.stringify({
        level: "info",
        timestamp: new Date().toISOString(),
        message,
        ...sanitizeContext(context),
      }),
    );
  },
  warn(message: string, context: LogContext = {}) {
    console.warn(
      JSON.stringify({
        level: "warn",
        timestamp: new Date().toISOString(),
        message,
        ...sanitizeContext(context),
      }),
    );
  },
  error(message: string, context: LogContext = {}) {
    console.error(
      JSON.stringify({
        level: "error",
        timestamp: new Date().toISOString(),
        message,
        ...sanitizeContext(context),
      }),
    );
  },
  debug(message: string, context: LogContext = {}) {
    if (process.env.NODE_ENV !== "production") {
      console.debug(
        JSON.stringify({
          level: "debug",
          timestamp: new Date().toISOString(),
          message,
          ...sanitizeContext(context),
        }),
      );
    }
  },
};

function sanitizeContext(ctx: LogContext): LogContext {
  const sanitized: LogContext = {};
  for (const [key, value] of Object.entries(ctx)) {
    const lower = key.toLowerCase();
    if (
      lower.includes("auth") ||
      lower.includes("token") ||
      lower.includes("secret") ||
      lower.includes("key") ||
      lower.includes("password") ||
      lower.includes("prompt") ||
      lower.includes("body") ||
      lower.includes("text")
    ) {
      sanitized[key] = "[REDACTED]";
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}
