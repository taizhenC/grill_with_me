/** Bounded browser requests. An interrupted write may already have committed. */
export async function browserJson(path: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    const response = await fetch(path, { ...init, signal: controller.signal, redirect: "error" });
    reader = response.body?.getReader();
    const decoder = new TextDecoder("utf-8", { fatal: true });
    let raw = "";
    let bytes = 0;
    if (reader) {
      for (;;) {
        const { value, done } = await reader.read();
        if (controller.signal.aborted) throw new Error("request interrupted");
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 8 * 1024 * 1024) throw new Error("response too large");
        raw += decoder.decode(value, { stream: true });
      }
      raw += decoder.decode();
    }
    const body: unknown = JSON.parse(raw);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("invalid reply");
    return { response, body: body as Record<string, unknown> };
  } catch {
    if (reader) void reader.cancel().catch(() => {});
    controller.abort();
    throw new Error("could not confirm the service response");
  } finally {
    clearTimeout(timer);
    reader?.releaseLock();
  }
}

export function browserErrors(body: Record<string, unknown>, status: number): string[] {
  if (Array.isArray(body.errors) && body.errors.every((value) => typeof value === "string")) return body.errors;
  return [typeof body.error === "string" ? body.error : `request failed (${status})`];
}
