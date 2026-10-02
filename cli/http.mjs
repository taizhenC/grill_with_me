import { normalizeHostOrigin } from "./host-credentials.mjs";

export const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 15_000;

export class HttpRequestError extends Error {
  constructor(message, outcomeUnknown = false) {
    super(message);
    this.outcomeUnknown = outcomeUnknown;
  }
}

/** Bound headers and decoded response bytes under one deadline. No redirects. */
export async function fetchJson(url, init = {}, options = {}) {
  const destination = new URL(url);
  if (destination.username || destination.password) {
    throw new HttpRequestError("service URLs must not contain credentials");
  }
  normalizeHostOrigin(destination.origin);
  const maxBytes = options.maxBytes ?? MAX_RESPONSE_BYTES;
  const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const outcomeUnknown = !["GET", "HEAD"].includes((init.method ?? "GET").toUpperCase());
  const controller = new AbortController();
  const signal = init.signal
    ? AbortSignal.any([init.signal, controller.signal]) : controller.signal;
  if (signal.aborted) throw new HttpRequestError("service request interrupted", outcomeUnknown);
  let timer;
  let onAbort;
  const interrupted = new Promise((_, reject) => {
    onAbort = () => reject(new HttpRequestError("service request interrupted", outcomeUnknown));
    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted) onAbort();
    timer = setTimeout(() => {
      reject(new HttpRequestError("service request timed out", outcomeUnknown));
      controller.abort();
    }, timeoutMs);
  });
  let reader;
  try {
    if (signal.aborted) throw new HttpRequestError("service request interrupted", outcomeUnknown);
    const response = await Promise.race([
      fetch(destination, { ...init, signal, redirect: "error" }), interrupted,
    ]);
    const oversized = () => new HttpRequestError(
      `service response too large (limit ${maxBytes} bytes)`, outcomeUnknown,
    );
    const declared = response.headers.get("content-length");
    if (declared && /^\d+$/.test(declared) && Number(declared) > maxBytes) throw oversized();
    let text = "";
    let bytes = 0;
    if (response.body) {
      reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8", { fatal: true });
      for (;;) {
        const { value, done } = await Promise.race([reader.read(), interrupted]);
        if (signal.aborted) throw new HttpRequestError("service request interrupted", outcomeUnknown);
        if (done) break;
        bytes += value.byteLength;
        if (bytes > maxBytes) throw oversized();
        text += decoder.decode(value, { stream: true });
      }
      text += decoder.decode();
    }
    let body;
    try { body = JSON.parse(text); }
    catch { throw new HttpRequestError("service response was not valid JSON", outcomeUnknown); }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new HttpRequestError("service response must be a JSON object", outcomeUnknown);
    }
    return { response, body };
  } catch (error) {
    if (reader) void reader.cancel().catch(() => {});
    controller.abort();
    if (error instanceof HttpRequestError) throw error;
    throw new HttpRequestError("could not complete service request; check the connection and destination", outcomeUnknown);
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", onAbort);
    reader?.releaseLock();
  }
}
