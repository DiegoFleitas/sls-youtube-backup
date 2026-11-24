/**
 * SYB-02: reduce an unknown error to non-sensitive fields.
 *
 * Axios errors carry `config.url`, and any URL built with a query-string
 * credential (`?key=...`) is therefore written to CloudWatch by a plain
 * `console.error(err)`. This helper never returns the raw error object, and it
 * redacts credential-looking substrings from the message.
 */
const REDACTIONS: [RegExp, string][] = [
  [
    /\b(key|api_key|apikey|access_key|secret|token|password)=[^&\s"']+/gi,
    "$1=<redacted>",
  ],
  [/\bBearer\s+\S+/gi, "Bearer <redacted>"],
  [/\b[A-Za-z0-9_-]{32,}\b/g, "<redacted>"],
];

function redact(text: string): string {
  return REDACTIONS.reduce(
    (acc, [pattern, replacement]) => acc.replace(pattern, replacement),
    text
  );
}

export function summariseError(
  error: unknown
): Record<string, string | number> {
  if (typeof error !== "object" || error === null) {
    return { message: redact(String(error)) };
  }
  const { name, message, code, status } = error as {
    name?: unknown;
    message?: unknown;
    code?: unknown;
    status?: unknown;
  };
  const summary: Record<string, string | number> = {};
  if (typeof name === "string") summary.name = name;
  if (typeof code === "string") summary.code = code;
  if (typeof status === "number") summary.status = status;
  if (typeof message === "string") summary.message = redact(message);
  return summary;
}
